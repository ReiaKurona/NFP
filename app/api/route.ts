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

    if (action === "DOWNLOAD_CONFIG") {
        const nodeId = searchParams.get("node_id");
        const token = searchParams.get("token");
        if (!nodeId || !token) return NextResponse.json({ error: "Missing params" }, { status: 400 });
        const node: any = await kv.hget("nodes", nodeId);
        if (!node || node.token !== token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) ||[];
        await kv.del(`cmd:${nodeId}`);
        return NextResponse.json({ success: true, rules: rules });
    }

    // === 新增：Agent 上傳檢測結果接口 ===
    if (action === "UPLOAD_DIAGNOSE") {
        const dataStr = searchParams.get("data");
        if (!dataStr) return NextResponse.json({ error: "Missing data" }, { status: 400 });
        const cleanData = dataStr.replace(/ /g, '+');
        let data;
        try {
            data = JSON.parse(Buffer.from(cleanData, 'base64').toString('utf-8'));
        } catch (e) { return NextResponse.json({ error: "Decode Error" }, { status: 400 }); }

        const { nodeId, token, taskId, results } = data;
        const node: any = await kv.hget("nodes", nodeId);
        if (!node || node.token !== token) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

        // 將檢測結果寫入 KV，設置 5 分鐘過期防止佔用空間
        await kv.set(`task:${taskId}`, { status: 'completed', results }, { ex: 300 });
        return NextResponse.json({ success: true });
    }

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

      // === 新增：檢查是否有等待下發的檢測任務 ===
      const pendingTaskStr = await kv.get(`pending_task:${nodeId}`);
      let diagnose_task = null;
      if (pendingTaskStr) {
          diagnose_task = pendingTaskStr; // 取出任務
          await kv.del(`pending_task:${nodeId}`); // 取出後即刪除，保證只下發一次
      }

      return NextResponse.json({
        success: true,
        interval: isActive ? 3 : 30,
        has_cmd: !!pendingCmd,
        diagnose_task: diagnose_task // 下發給 Agent
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
        if (isPwdCorrect) return NextResponse.json({ success: true, token: currentHash });
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (action === "KEEP_ALIVE") { await kv.set("panel_activity", Date.now()); return NextResponse.json({ success: true }); }

    // === 新增：前端發起檢測任務 ===
    if (action === "START_DIAGNOSE") {
        const taskId = `diag_${data.nodeId}_${Date.now()}`;
        const taskPayload = { taskId, ip: data.ip, port: data.port };
        // 初始化任務狀態為 pending
        await kv.set(`task:${taskId}`, { status: 'pending' }, { ex: 300 });
        // 把任務掛載到節點的 pending 隊列，過期時間 60 秒 (防止節點掉線導致死任務)
        await kv.set(`pending_task:${data.nodeId}`, taskPayload, { ex: 60 });
        return NextResponse.json({ success: true, taskId });
    }

    // === 新增：前端輪詢獲取檢測結果 ===
    if (action === "GET_DIAGNOSE_RESULT") {
        const taskInfo = await kv.get(`task:${data.taskId}`);
        return NextResponse.json({ success: true, task: taskInfo });
    }

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
    
    // 備份
    if (action === "EXPORT_ALL") { const nodes = await kv.hgetall("nodes") || {}; const rules: any = {}; for (const id of Object.keys(nodes)) rules[id] = await kv.lrange(`rules:${id}`, 0, -1) ||[]; return NextResponse.json({ nodes, rules }); }
    if (action === "IMPORT_ALL") { const { nodes, rules } = data.backupData; await kv.del("nodes"); if (Object.keys(nodes).length > 0) await kv.hset("nodes", nodes); for (const nodeId of Object.keys(rules)) { await kv.del(`rules:${nodeId}`); if (rules[nodeId].length > 0) await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]); await kv.set(`cmd:${nodeId}`, "UPDATE"); } return NextResponse.json({ success: true }); }

    return NextResponse.json({ error: "Unknown Action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
        }
