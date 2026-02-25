import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

function encryptPayload(data: any, token: string) {
  const key = crypto.createHash("sha256").update(token).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const text = JSON.stringify(data);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { payload: encrypted + cipher.getAuthTag().toString("hex"), iv: iv.toString("hex") };
}

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

export async function POST(req: Request) {
  try {
    const { action, auth, ...data } = await req.json();
    let currentHash = await kv.get<string>("admin_password") || hashPassword("admin123");
    if (!await kv.get("admin_password")) await kv.set("admin_password", currentHash);

    if (action === "LOGIN") {
      if (hashPassword(data.password) === currentHash) return NextResponse.json({ success: true, token: currentHash });
      return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
    }

    if (auth !== currentHash) return NextResponse.json({ error: "未授權" }, { status: 401 });

    if (action === "ADD_NODE") {
      const id = Date.now().toString();
      const node = { ...data.node, id, lastSeen: 0 };
      await kv.hset("nodes", {[id]: node });

      // 嘗試向剛添加的節點拉取現有規則
      try {
        const payload = encryptPayload({ action: "PULL_EXISTING" }, node.token);
        const res = await fetch(`http://${node.ip}:${node.port}/sync`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000)
        });
        const agentData = await res.json();
        if (agentData.existing_rules && agentData.existing_rules.length > 0) {
          await kv.rpush(`rules:${id}`, ...agentData.existing_rules);
        }
      } catch (e) { /* 忽略連線失敗，可能 Agent 還沒啟動完 */ }
      
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
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      return NextResponse.json({ success: true });
    }
    if (action === "GET_RULES") return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) ||[]);

    if (action === "SYNC_AGENT" || action === "POLL_STATUS") {
       const node: any = await kv.hget("nodes", data.nodeId);
       if (!node) return NextResponse.json({ error: "Node missing" }, { status: 404 });
       
       const rules = action === "SYNC_AGENT" ? (await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []) :[];
       const cmd = action === "SYNC_AGENT" ? "APPLY" : "STATUS"; // PING 模式不帶規則
       
       const payload = encryptPayload({ action: cmd, rules }, node.token);
       const res = await fetch(`http://${node.ip}:${node.port}/sync`, {
         method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000),
       });
       if (!res.ok) throw new Error("Offline");
       const { stats } = await res.json();
       await kv.hset("nodes", {[data.nodeId]: { ...node, lastSeen: Date.now(), stats } });
       return NextResponse.json({ success: true, stats });
    }

    // 備份還原與密碼修改保持不變...
    if (action === "EXPORT_ALL") {
      const nodes = await kv.hgetall("nodes") || {};
      const rules: any = {};
      for (const id of Object.keys(nodes)) rules[id] = await kv.lrange(`rules:${id}`, 0, -1) ||[];
      return NextResponse.json({ nodes, rules });
    }
    if (action === "CHANGE_PASSWORD") {
      const newHash = hashPassword(data.newPassword);
      await kv.set("admin_password", newHash);
      return NextResponse.json({ success: true, token: newHash });
    }

    return NextResponse.json({ error: "Unknown" });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
