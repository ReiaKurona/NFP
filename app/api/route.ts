import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

// 強制禁用 Vercel 的 GET 請求緩存，確保每次心跳都執行數據庫寫入
export const dynamic = 'force-dynamic';

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

// 處理 Agent 的 GET 心跳請求
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    let dataStr = searchParams.get("data");

    // 調試日誌：查看是否有請求進來
    if (action === "HEARTBEAT") {
       console.log(`[Heartbeat] Received request at ${new Date().toISOString()}`);
    }

    if (action === "HEARTBEAT" && dataStr) {
      // 處理 URL 編碼可能將 + 轉為空格的問題
      dataStr = dataStr.replace(/ /g, '+');
      
      // 1. 解碼 Base64 數據
      let data;
      try {
        const jsonStr = Buffer.from(dataStr, 'base64').toString('utf-8');
        data = JSON.parse(jsonStr);
      } catch (err) {
        console.error("[Heartbeat] Decode Error:", err);
        return NextResponse.json({ error: "Decode Failed" }, { status: 400 });
      }

      const { nodeId, token, stats } = data;

      // 2. 驗證節點
      const node: any = await kv.hget("nodes", nodeId);
      
      if (!node) {
        console.error(`[Heartbeat] Node not found: ${nodeId}`);
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }
      
      if (node.token !== token) {
        console.error(`[Heartbeat] Token mismatch for node: ${nodeId}`);
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
      }

      // 3. 更新狀態 (這是關鍵步驟)
      node.lastSeen = Date.now();
      node.stats = stats;
      await kv.hset("nodes", { [nodeId]: node });
      
      console.log(`[Heartbeat] Success updated node: ${nodeId}`);

      // 4. 檢查是否有指令
      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      
      // 5. 檢查面板活躍度
      const lastActivity = await kv.get<number>("panel_activity") || 0;
      const isActive = (Date.now() - lastActivity) < 30000;

      return NextResponse.json({
        success: true,
        interval: isActive ? 3 : 60,
        has_cmd: !!pendingCmd
      });
    }
    
    return NextResponse.json({ error: "Invalid GET action" });
  } catch (e: any) {
    console.error("[API Error]", e);
    return NextResponse.json({ error: "Server Error: " + e.message }, { status: 500 });
  }
}

// 處理 POST 請求 (保持不變，但加上日誌)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    if (action === "FETCH_CONFIG") {
      const { nodeId, token } = data;
      const node: any = await kv.hget("nodes", nodeId);
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

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
    const isFirstLogin = currentHash === hashPassword("admin123");
    const totpSecret = await kv.get<string>("totp_secret");

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

    if (action === "KEEP_ALIVE") {
      await kv.set("panel_activity", Date.now());
      return NextResponse.json({ success: true });
    }

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
    
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      await kv.set(`cmd:${data.nodeId}`, "UPDATE_RULES"); 
      return NextResponse.json({ success: true });
    }
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []);

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
        await kv.set(`cmd:${nodeId}`, "UPDATE_RULES");
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}