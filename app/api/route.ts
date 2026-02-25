import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

// 兼容 Vercel Turbopack
const { authenticator } = require("otplib");

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

function encryptPayload(data: any, token: string) {
  const key = crypto.createHash("sha256").update(token).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { payload: encrypted + cipher.getAuthTag().toString("hex"), iv: iv.toString("hex") };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    // --- 公開接口：Agent 心跳回報 (最核心的改動) ---
    if (action === "HEARTBEAT") {
      const { nodeId, token, stats } = data;
      const node: any = await kv.hget("nodes", nodeId);
      
      // 1. 鑒權
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

      // 2. 更新節點狀態
      node.lastSeen = Date.now();
      node.stats = stats; // 保存 CPU、流量等信息
      await kv.hset("nodes", { [nodeId]: node });

      // 3. 檢查是否有待下發的指令 (信箱機制)
      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      
      // 4. 檢查面板是否處於「活躍狀態」
      // 前端每 10 秒會打一次 KEEP_ALIVE，如果 30 秒內有活動，則讓 Agent 進入快速模式
      const lastActivity = await kv.get<number>("panel_activity") || 0;
      const isActive = (Date.now() - lastActivity) < 30000;

      return NextResponse.json({
        success: true,
        interval: isActive ? 3 : 60, // 活躍時 3秒一跳，閒置時 60秒一跳
        has_cmd: !!pendingCmd // 告訴 Agent 有沒有新規則
      });
    }

    // --- 公開接口：Agent 拉取配置 ---
    if (action === "FETCH_CONFIG") {
      const { nodeId, token } = data;
      const node: any = await kv.hget("nodes", nodeId);
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

      // 讀取規則並清除待辦標記
      const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) || [];
      await kv.del(`cmd:${nodeId}`); // 清空信箱

      // 加密返回，確保配置不被中間人竊取
      return NextResponse.json(encryptPayload({ rules }, token));
    }

    // ==========================================
    // --- 以下為管理員接口 (需要登錄) ---
    // ==========================================
    
    // 初始化密碼
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) {
      currentHash = hashPassword("admin123");
      await kv.set("admin_password", currentHash);
    }
    const isFirstLogin = currentHash === hashPassword("admin123");
    const totpSecret = await kv.get<string>("totp_secret");

    // 登錄
    if (action === "LOGIN") {
      const isPwdCorrect = hashPassword(data.password) === currentHash;
      let isTotpCorrect = false;
      if (totpSecret && data.password.length === 6 && /^\d+$/.test(data.password)) {
         try { isTotpCorrect = authenticator.check(data.password, totpSecret); } catch(e){}
      }
      if (isPwdCorrect || isTotpCorrect) return NextResponse.json({ success: true, token: currentHash, isFirstLogin });
      return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 面板保活信號 (前端定時發送，告訴後端我還在用)
    if (action === "KEEP_ALIVE") {
      await kv.set("panel_activity", Date.now());
      return NextResponse.json({ success: true });
    }

    // 節點管理
    if (action === "ADD_NODE") {
      const id = Date.now().toString();
      const node = { ...data.node, id, lastSeen: 0 };
      await kv.hset("nodes", { [id]: node });
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
      await kv.del(`cmd:${data.nodeId}`);
      return NextResponse.json({ success: true });
    }
    if (action === "GET_NODES") return NextResponse.json(await kv.hgetall("nodes") || {});
    
    // 規則管理 (保存時設置 cmd 標記，通知 Agent 來取)
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      // 設置信箱標記：有新指令！
      await kv.set(`cmd:${data.nodeId}`, "UPDATE_RULES"); 
      return NextResponse.json({ success: true });
    }
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []);

    // 其他功能 (2FA/備份等)
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
        await kv.set(`cmd:${nodeId}`, "UPDATE_RULES"); // 導入後觸發所有節點更新
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}