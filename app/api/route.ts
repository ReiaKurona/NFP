import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

// 使用 require 引入 otplib 以解決 Vercel Turbopack 的構建錯誤
const { authenticator } = require("otplib");

function encryptPayload(data: any, token: string) {
  const key = crypto.createHash("sha256").update(token).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { payload: encrypted + cipher.getAuthTag().toString("hex"), iv: iv.toString("hex") };
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

// 重點：這裡必須是 POST，因為前端是用 axios.post 請求的
export async function POST(req: Request) {
  try {
    const { action, auth, ...data } = await req.json();
    
    // 初始化預設密碼
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) {
      currentHash = hashPassword("admin123");
      await kv.set("admin_password", currentHash);
    }
    
    const isFirstLogin = currentHash === hashPassword("admin123");
    const totpSecret = await kv.get<string>("totp_secret");

    // 登錄邏輯
    if (action === "LOGIN") {
      const isPwdCorrect = hashPassword(data.password) === currentHash;
      let isTotpCorrect = false;
      if (totpSecret && data.password.length === 6 && /^\d+$/.test(data.password)) {
        try { isTotpCorrect = authenticator.check(data.password, totpSecret); } catch (e) {}
      }
      
      if (isPwdCorrect || isTotpCorrect) {
        return NextResponse.json({ success: true, token: currentHash, isFirstLogin });
      }
      return NextResponse.json({ error: "密碼或 2FA 驗證碼錯誤" }, { status: 401 });
    }

    // --- 以下接口需要授權 ---
    if (auth !== currentHash) return NextResponse.json({ error: "未授權" }, { status: 401 });

    if (action === "CHANGE_PASSWORD") {
      const newHash = hashPassword(data.newPassword);
      await kv.set("admin_password", newHash);
      return NextResponse.json({ success: true, token: newHash });
    }

    // 2FA 設置
    if (action === "GENERATE_2FA") {
      const secret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri("Admin", "AeroNode", secret);
      return NextResponse.json({ secret, otpauth });
    }
    if (action === "VERIFY_AND_ENABLE_2FA") {
      if (authenticator.check(data.code, data.secret)) {
        await kv.set("totp_secret", data.secret);
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: "驗證碼錯誤" }, { status: 400 });
    }
    if (action === "DISABLE_2FA") {
      await kv.del("totp_secret");
      return NextResponse.json({ success: true });
    }
    if (action === "CHECK_2FA_STATUS") {
      return NextResponse.json({ enabled: !!totpSecret });
    }

    // 備份與還原
    if (action === "EXPORT_ALL") {
      const nodes = await kv.hgetall("nodes") || {};
      const rules: any = {};
      for (const id of Object.keys(nodes)) rules[id] = await kv.lrange(`rules:${id}`, 0, -1) ||[];
      return NextResponse.json({ nodes, rules });
    }
    if (action === "IMPORT_ALL") {
      const { nodes, rules } = data.backupData;
      await kv.del("nodes");
      if (Object.keys(nodes).length > 0) await kv.hset("nodes", nodes);
      for (const nodeId of Object.keys(rules)) {
        await kv.del(`rules:${nodeId}`);
        if (rules[nodeId].length > 0) await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]);
      }
      return NextResponse.json({ success: true });
    }

    // 節點管理 (你遇到的報錯就是這裡沒被觸發)
    if (action === "ADD_NODE") {
      const id = Date.now().toString();
      const node = { ...data.node, id, lastSeen: 0 };
      await kv.hset("nodes", {[id]: node });
      
      // 嘗試連接 (失敗也不報錯，因為 Agent 還沒裝)
      try {
        const payload = encryptPayload({ action: "PULL_EXISTING" }, node.token);
        const res = await fetch(`http://${node.ip}:${node.port}/sync`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000)
        });
        const agentData = await res.json();
        if (agentData.existing_rules && agentData.existing_rules.length > 0) {
          await kv.rpush(`rules:${id}`, ...agentData.existing_rules);
        }
      } catch (e) {}

      return NextResponse.json({ success: true });
    }
    
    if (action === "DELETE_NODE") {
      const nodes: any = await kv.hgetall("nodes");
      if (nodes && nodes[data.nodeId]) {
        delete nodes[data.nodeId];
        await kv.del("nodes");
        if (Object.keys(nodes).length > 0) await kv.hset("nodes", nodes);
      }
      await kv.del(`rules:${data.nodeId}`);
      return NextResponse.json({ success: true });
    }
    if (action === "GET_NODES") return NextResponse.json(await kv.hgetall("nodes") || {});
    
    // 規則管理
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      return NextResponse.json({ success: true });
    }
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) ||[]);
    
    // Agent 通信
    if (action === "SYNC_AGENT" || action === "POLL_STATUS") {
       const node: any = await kv.hget("nodes", data.nodeId);
       if (!node) return NextResponse.json({ error: "Node missing" }, { status: 404 });
       const rules = action === "SYNC_AGENT" ? (await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []) :[];
       const cmd = action === "SYNC_AGENT" ? "APPLY" : "STATUS";
       
       const payload = encryptPayload({ action: cmd, rules }, node.token);
       const res = await fetch(`http://${node.ip}:${node.port}/sync`, {
         method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000),
       });
       if (!res.ok) throw new Error("Offline");
       const { stats } = await res.json();
       await kv.hset("nodes", {[data.nodeId]: { ...node, lastSeen: Date.now(), stats } });
       return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ error: "Unknown action" });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}