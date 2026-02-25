import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic';
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

// GET: 處理 Agent 心跳 (被動模式)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    let dataStr = searchParams.get("data");

    if (action === "HEARTBEAT" && dataStr) {
      dataStr = dataStr.replace(/ /g, '+');
      const jsonStr = Buffer.from(dataStr, 'base64').toString('utf-8');
      const { nodeId, token, stats } = JSON.parse(jsonStr);

      const node: any = await kv.hget("nodes", nodeId);
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth" }, { status: 401 });

      node.lastSeen = Date.now();
      node.stats = stats;
      await kv.hset("nodes", { [nodeId]: node });

      // 檢查是否有待下發的指令 (信箱)
      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      return NextResponse.json({ success: true, has_cmd: !!pendingCmd });
    }
    return NextResponse.json({ error: "Invalid" });
  } catch (e) { return NextResponse.json({ error: "Err" }, { status: 500 }); }
}

// POST: 面板操作與主動下發
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    // Agent 拉取配置 (被動模式回調)
    if (action === "FETCH_CONFIG") {
      const { nodeId, token } = data;
      const node: any = await kv.hget("nodes", nodeId);
      if (!node || node.token !== token) return NextResponse.json({ error: "Auth" }, { status: 401 });
      const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) || [];
      await kv.del(`cmd:${nodeId}`); // 清空信箱
      return NextResponse.json(encryptPayload({ rules }, token));
    }

    // --- 權限驗證 ---
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) { currentHash = hashPassword("admin123"); await kv.set("admin_password", currentHash); }
    
    // 登錄邏輯
    if (action === "LOGIN") {
        // ... (保持原樣)
        const isPwdCorrect = hashPassword(data.password) === currentHash;
        const totpSecret = await kv.get<string>("totp_secret");
        let isTotpCorrect = false;
        if (totpSecret) try { isTotpCorrect = authenticator.check(data.password, totpSecret); } catch(e){}
        if (isPwdCorrect || isTotpCorrect) return NextResponse.json({ success: true, token: currentHash });
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 核心邏輯：保存並嘗試主動下發 (互補模式)
    if (action === "SAVE_AND_SYNC") {
      const { nodeId, rules } = data;
      const node: any = await kv.hget("nodes", nodeId);
      
      // 1. 保存到數據庫
      await kv.del(`rules:${nodeId}`);
      if (rules.length > 0) await kv.rpush(`rules:${nodeId}`, ...rules);
      
      // 2. 設置信箱標記 (作為保底，Agent 心跳會讀到)
      await kv.set(`cmd:${nodeId}`, "UPDATE");
      
      // 3. 嘗試主動推送 (Active Push)
      let pushResult = "queued";
      try {
          const payload = encryptPayload({ action: "APPLY", rules }, node.token);
          // 假設 Agent 監聽 8080 (這需要 Agent 有公網 IP)
          const agentUrl = `http://${node.ip}:8080/sync`;
          
          const res = await fetch(agentUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(2000) // 2秒超時，失敗就走被動
          });
          
          if (res.ok) {
              pushResult = "pushed";
              await kv.del(`cmd:${nodeId}`); // 推送成功，清除信箱
          }
      } catch (e) {
          // 推送失敗 (例如防火牆阻擋)，不做處理，依賴步驟 2 的信箱機制
          console.log("Active push failed, fallback to passive.");
      }
      
      return NextResponse.json({ success: true, mode: pushResult });
    }

    // 其他管理接口 (保持不變)
    if (action === "GET_NODES") return NextResponse.json(await kv.hgetall("nodes") || {});
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []);
    if (action === "ADD_NODE") {
       const id = Date.now().toString();
       await kv.hset("nodes", { [id]: { ...data.node, id, lastSeen: 0 } });
       return NextResponse.json({ success: true });
    }
    if (action === "DELETE_NODE") {
       // ... (刪除邏輯保持不變)
       const nodes: any = await kv.hgetall("nodes");
       if(nodes) { delete nodes[data.nodeId]; await kv.del("nodes"); await kv.hset("nodes", nodes); }
       await kv.del(`rules:${data.nodeId}`);
       return NextResponse.json({ success: true });
    }
    // ... (備份、2FA 等接口保持不變)
    
    return NextResponse.json({ success: true }); // Fallback
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}