import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic'; // 關鍵：禁止緩存

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

// GET: 處理 Agent 心跳
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    let dataStr = searchParams.get("data");

    if (action === "HEARTBEAT" && dataStr) {
      // 修復 URL 編碼問題
      dataStr = dataStr.replace(/ /g, '+');
      
      let data;
      try {
        const jsonStr = Buffer.from(dataStr, 'base64').toString('utf-8');
        data = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Heartbeat JSON Decode Error");
        return NextResponse.json({ error: "Invalid Data" }, { status: 400 });
      }

      const { nodeId, token, stats } = data;
      const node: any = await kv.hget("nodes", nodeId);

      if (!node) return NextResponse.json({ error: "Node Not Found" }, { status: 404 });
      if (node.token !== token) return NextResponse.json({ error: "Token Mismatch" }, { status: 401 });

      // 更新狀態
      node.lastSeen = Date.now();
      node.stats = stats;
      await kv.hset("nodes", { [nodeId]: node });

      // 檢查指令信箱
      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      
      // 檢查面板活躍度 (決定 Agent 輪詢速度)
      const lastActivity = await kv.get<number>("panel_activity") || 0;
      const isActive = (Date.now() - lastActivity) < 60000; // 60秒內有操作算活躍

      return NextResponse.json({
        success: true,
        interval: isActive ? 3 : 30, // 活躍3秒，閒置30秒
        has_cmd: !!pendingCmd
      });
    }
    return NextResponse.json({ error: "Invalid Action" });
  } catch (e: any) {
    console.error("API Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: 處理指令下發與面板操作
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    // Agent 拉取配置
    if (action === "FETCH_CONFIG") {
      const { nodeId, token } = data;
      const node: any = await kv.hget("nodes", nodeId);
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth" }, { status: 401 });
      
      const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) || [];
      await kv.del(`cmd:${nodeId}`);
      return NextResponse.json(encryptPayload({ rules }, token));
    }

    // --- 管理員接口 ---
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) {
        currentHash = hashPassword("admin123");
        await kv.set("admin_password", currentHash);
    }
    
    // 登錄校驗
    if (action === "LOGIN") {
        const isPwdCorrect = hashPassword(data.password) === currentHash;
        const totpSecret = await kv.get<string>("totp_secret");
        let isTotpCorrect = false;
        if (totpSecret && data.password.length === 6) {
            try { isTotpCorrect = authenticator.check(data.password, totpSecret); } catch(e){}
        }
        if (isPwdCorrect || isTotpCorrect) return NextResponse.json({ success: true, token: currentHash });
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (action === "KEEP_ALIVE") {
      await kv.set("panel_activity", Date.now());
      return NextResponse.json({ success: true });
    }

    // 保存規則並通知 Agent
    if (action === "SAVE_AND_SYNC") {
      const { nodeId, rules } = data;
      const node: any = await kv.hget("nodes", nodeId);
      
      await kv.del(`rules:${nodeId}`);
      if (rules.length > 0) await kv.rpush(`rules:${nodeId}`, ...rules);
      
      // 設置信箱標記
      await kv.set(`cmd:${nodeId}`, "UPDATE");
      
      // 嘗試主動推送 (可選)
      let mode = "passive";
      try {
          // 只有當 Agent 暴露了 HTTP 端口時才有效，若無則依賴心跳拉取
          // 這裡為了簡化，主要依賴被動拉取，確保穩定性
      } catch (e) {}
      
      return NextResponse.json({ success: true, mode });
    }

    // 節點增刪
    if (action === "ADD_NODE") {
       const id = Date.now().toString();
       await kv.hset("nodes", { [id]: { ...data.node, id, lastSeen: 0 } });
       return NextResponse.json({ success: true });
    }
    if (action === "DELETE_NODE") {
       const nodes: any = await kv.hgetall("nodes");
       if(nodes) { delete nodes[data.nodeId]; await kv.del("nodes"); await kv.hset("nodes", nodes); }
       await kv.del(`rules:${data.nodeId}`);
       await kv.del(`cmd:${data.nodeId}`);
       return NextResponse.json({ success: true });
    }
    if (action === "GET_NODES") return NextResponse.json(await kv.hgetall("nodes") || {});
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []);

    // 密碼與 2FA
    if (action === "CHANGE_PASSWORD") {
        const newHash = hashPassword(data.newPassword);
        await kv.set("admin_password", newHash);
        return NextResponse.json({ success: true, token: newHash });
    }
    if (action === "GENERATE_2FA") {
        const secret = authenticator.generateSecret();
        return NextResponse.json({ secret, otpauth: authenticator.keyuri("Admin", "AeroNode", secret) });
    }
    if (action === "VERIFY_AND_ENABLE_2FA") {
        if (authenticator.check(data.code, data.secret)) {
            await kv.set("totp_secret", data.secret);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: "Code invalid" }, { status: 400 });
    }
    if (action === "DISABLE_2FA") { await kv.del("totp_secret"); return NextResponse.json({ success: true }); }
    if (action === "CHECK_2FA_STATUS") return NextResponse.json({ enabled: !!totpSecret });

    // 備份
    if (action === "EXPORT_ALL") {
        const nodes = await kv.hgetall("nodes") || {};
        const rules: any = {};
        for (const id of Object.keys(nodes)) rules[id] = await kv.lrange(`rules:${id}`, 0, -1) || [];
        return NextResponse.json({ nodes, rules });
    }
    if (action === "IMPORT_ALL") {
        const { nodes, rules } = data.backupData;
        await kv.del("nodes");
        if (Object.keys(nodes).length > 0) await kv.hset("nodes", nodes);
        for (const nodeId of Object.keys(rules)) {
            await kv.del(`rules:${nodeId}`);
            if (rules[nodeId].length > 0) await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]);
            await kv.set(`cmd:${nodeId}`, "UPDATE");
        }
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown" });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}