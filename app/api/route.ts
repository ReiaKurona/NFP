import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = 'force-dynamic'; // 禁止緩存

// 2FA 功能暫時註釋
// const { authenticator } = require("otplib");

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // === 新增：類似訂閱鏈接的配置下載接口 ===
    if (action === "DOWNLOAD_CONFIG") {
        const nodeId = searchParams.get("node_id");
        const token = searchParams.get("token");

        if (!nodeId || !token) return NextResponse.json({ error: "Missing params" }, { status: 400 });

        const node: any = await kv.hget("nodes", nodeId);
        
        // 嚴格校驗 Token
        if (!node || node.token !== token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 讀取規則
        const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) ||[];
        
        // 清除更新標記
        await kv.del(`cmd:${nodeId}`);

        // 直接返回明文 JSON 配置，方便瀏覽器調試和 Agent 下載
        return NextResponse.json({ success: true, rules: rules });
    }

    // === 原有：心跳上報 ===
    const dataStr = searchParams.get("data");
    if (action === "HEARTBEAT" && dataStr) {
      const cleanData = dataStr.replace(/ /g, '+');
      let data;
      try {
        data = JSON.parse(Buffer.from(cleanData, 'base64').toString('utf-8'));
      } catch (e) { return NextResponse.json({ error: "Decode Error" }, { status: 400 }); }

      const { nodeId, token, stats } = data;
      const node: any = await kv.hget("nodes", nodeId);

      if (!node || node.token !== token) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

      node.lastSeen = Date.now();
      node.stats = stats;
      await kv.hset("nodes", {[nodeId]: node });

      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      const lastActivity = await kv.get<number>("panel_activity") || 0;
      const isActive = (Date.now() - lastActivity) < 60000;

      return NextResponse.json({
        success: true,
        interval: isActive ? 3 : 30,
        has_cmd: !!pendingCmd // 通知 Agent 去下載配置
      });
    }
    
    return NextResponse.json({ error: "Invalid Action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) { currentHash = hashPassword("admin123"); await kv.set("admin_password", currentHash); }

    if (action === "LOGIN") {
        const isPwdCorrect = hashPassword(data.password) === currentHash;
        // 2FA 登錄邏輯暫時註釋
        /*
        const totpSecret = await kv.get<string>("totp_secret");
        let isTotpCorrect = false;
        if (totpSecret && data.password.length === 6) try { isTotpCorrect = authenticator.check(data.password, totpSecret); } catch(e){}
        if (isPwdCorrect || isTotpCorrect) return NextResponse.json({ success: true, token: currentHash });
        */
        if (isPwdCorrect) return NextResponse.json({ success: true, token: currentHash });
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (action === "KEEP_ALIVE") { await kv.set("panel_activity", Date.now()); return NextResponse.json({ success: true }); }

    // 規則管理
    if (action === "SAVE_RULES") {
      const { nodeId, rules } = data;
      await kv.del(`rules:${nodeId}`);
      if (rules.length > 0) await kv.rpush(`rules:${nodeId}`, ...rules);
      await kv.set(`cmd:${nodeId}`, "UPDATE"); 
      return NextResponse.json({ success: true });
    }

    // 節點管理
    if (action === "ADD_NODE") {
       const id = Date.now().toString();
       await kv.hset("nodes", { [id]: { ...data.node, id, lastSeen: 0 } });
       return NextResponse.json({ success: true });
    }
    if (action === "DELETE_NODE") {
       const nodes: any = await kv.hgetall("nodes");
       if(nodes) { delete nodes[data.nodeId]; await kv.del("nodes"); await kv.hset("nodes", nodes); }
       await kv.del(`rules:${data.nodeId}`); await kv.del(`cmd:${data.nodeId}`);
       return NextResponse.json({ success: true });
    }
    if (action === "GET_NODES") return NextResponse.json(await kv.hgetall("nodes") || {});
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) ||[]);

    // 密碼修改
    if (action === "CHANGE_PASSWORD") { const newHash = hashPassword(data.newPassword); await kv.set("admin_password", newHash); return NextResponse.json({ success: true, token: newHash }); }
    
    // 2FA 接口暫時註釋
    /*
    if (action === "GENERATE_2FA") { const secret = authenticator.generateSecret(); return NextResponse.json({ secret, otpauth: authenticator.keyuri("Admin", "AeroNode", secret) }); }
    if (action === "VERIFY_AND_ENABLE_2FA") { if (authenticator.check(data.code, data.secret)) { await kv.set("totp_secret", data.secret); return NextResponse.json({ success: true }); } return NextResponse.json({ error: "Code invalid" }, { status: 400 }); }
    if (action === "DISABLE_2FA") { await kv.del("totp_secret"); return NextResponse.json({ success: true }); }
    if (action === "CHECK_2FA_STATUS") return NextResponse.json({ enabled: !!totpSecret });
    */
    
    // 備份
    if (action === "EXPORT_ALL") { const nodes = await kv.hgetall("nodes") || {}; const rules: any = {}; for (const id of Object.keys(nodes)) rules[id] = await kv.lrange(`rules:${id}`, 0, -1) ||[]; return NextResponse.json({ nodes, rules }); }
    if (action === "IMPORT_ALL") { const { nodes, rules } = data.backupData; await kv.del("nodes"); if (Object.keys(nodes).length > 0) await kv.hset("nodes", nodes); for (const nodeId of Object.keys(rules)) { await kv.del(`rules:${nodeId}`); if (rules[nodeId].length > 0) await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]); await kv.set(`cmd:${nodeId}`, "UPDATE"); } return NextResponse.json({ success: true }); }

    return NextResponse.json({ error: "Unknown Action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}