import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

// AES-256-GCM 加密 (與 Agent 通信)
function encryptPayload(data: any, token: string) {
  const key = crypto.createHash("sha256").update(token).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const text = JSON.stringify(data);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { payload: encrypted + tag, iv: iv.toString("hex") };
}

// 密碼 Hash 函數
function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    // 1. 初始化預設密碼 (如果數據庫是空的，預設為 admin123)
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) {
      currentHash = hashPassword("admin123");
      await kv.set("admin_password", currentHash);
    }

    // 2. 登入校驗 API
    if (action === "LOGIN") {
      if (hashPassword(data.password) === currentHash) {
        return NextResponse.json({ success: true, token: currentHash });
      }
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }

    // 🛡️ 權限攔截：以下所有 API 都需要 auth token (即 hashed password)
    if (auth !== currentHash) {
      return NextResponse.json({ error: "未授權或登入已過期，請重新登入" }, { status: 401 });
    }

    // 修改密碼
    if (action === "CHANGE_PASSWORD") {
      const newHash = hashPassword(data.newPassword);
      await kv.set("admin_password", newHash);
      return NextResponse.json({ success: true, token: newHash });
    }

    // 全局導出 (JSON)
    if (action === "EXPORT_ALL") {
      const nodes = await kv.hgetall("nodes") || {};
      const rules: any = {};
      for (const nodeId of Object.keys(nodes)) {
        rules[nodeId] = await kv.lrange(`rules:${nodeId}`, 0, -1) ||[];
      }
      return NextResponse.json({ nodes, rules });
    }

    // 全局導入 (還原 JSON)
    if (action === "IMPORT_ALL") {
      const { nodes, rules } = data.backupData;
      await kv.del("nodes"); // 清空舊節點
      if (Object.keys(nodes).length > 0) {
        await kv.hset("nodes", nodes);
      }
      // 還原規則
      for (const nodeId of Object.keys(rules)) {
        await kv.del(`rules:${nodeId}`);
        if (rules[nodeId].length > 0) {
          await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]);
        }
      }
      return NextResponse.json({ success: true });
    }

    // --- 節點管理 ---
    if (action === "ADD_NODE") {
      const id = Date.now().toString();
      const node = { ...data.node, id, lastSeen: 0 };
      await kv.hset("nodes", { [id]: node });
      return NextResponse.json({ success: true });
    }
    
    if (action === "DELETE_NODE") {
      const { nodeId } = data;
      // 獲取當前所有節點
      const nodes: any = await kv.hgetall("nodes");
      if (nodes && nodes[nodeId]) {
        delete nodes[nodeId];
        await kv.del("nodes"); // 清空
        if (Object.keys(nodes).length > 0) {
          await kv.hset("nodes", nodes); // 寫回剩下的
        }
      }
      await kv.del(`rules:${nodeId}`); // 刪除關聯規則
      return NextResponse.json({ success: true });
    }

    if (action === "GET_NODES") {
      const nodes = await kv.hgetall("nodes");
      return NextResponse.json(nodes || {});
    }

    // --- 規則管理 ---
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      return NextResponse.json({ success: true });
    }
    
    if (action === "GET_RULES") {
      const rules = await kv.lrange(`rules:${data.nodeId}`, 0, -1);
      return NextResponse.json(rules ||[]);
    }

    // --- Agent 同步下發指令 ---
    if (action === "SYNC_AGENT") {
       const { nodeId } = data;
       const node: any = await kv.hget("nodes", nodeId);
       if (!node) return NextResponse.json({ error: "找不到節點" }, { status: 404 });
       const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) ||[];
       
       const payload = { action: "APPLY", rules };
       const encryptedBody = encryptPayload(payload, node.token);
       
       const agentUrl = `http://${node.ip}:${node.port}/sync`;
       const res = await fetch(agentUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(encryptedBody),
         signal: AbortSignal.timeout(5000),
       });
       
       if (!res.ok) throw new Error("節點離線或密鑰錯誤");
       const stats = await res.json();
       await kv.hset("nodes", { [nodeId]: { ...node, lastSeen: Date.now(), stats } });
       return NextResponse.json({ success: true, stats });
    }

    return NextResponse.json({ error: "Unknown action" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
