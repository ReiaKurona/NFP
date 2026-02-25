import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { encryptPayload } from "@/lib/utils";

// 處理所有的 API 請求
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, ...data } = body;

    // --- Agent 同步接口 ---
    if (action === "SYNC_AGENT") {
       const { nodeId } = data;
       const node: any = await kv.hget("nodes", nodeId);
       if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
       const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) || [];
       
       const payload = { action: "APPLY", rules };
       const encryptedBody = encryptPayload(payload, node.token);
       
       const agentUrl = `http://${node.ip}:${node.port}/sync`;
       const res = await fetch(agentUrl, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(encryptedBody),
         signal: AbortSignal.timeout(5000),
       });
       
       if (!res.ok) throw new Error("Connection failed");
       const stats = await res.json();
       await kv.hset("nodes", { [nodeId]: { ...node, lastSeen: Date.now(), stats } });
       return NextResponse.json({ success: true, stats });
    }

    // --- 面板管理接口 ---
    if (action === "ADD_NODE") {
      const id = Date.now().toString();
      const node = { ...data.node, id, lastSeen: 0 };
      await kv.hset("nodes", { [id]: node });
      return NextResponse.json(node);
    }
    if (action === "GET_NODES") {
      const nodes = await kv.hgetall("nodes");
      return NextResponse.json(nodes || {});
    }
    if (action === "SAVE_RULES") {
      await kv.del(`rules:${data.nodeId}`);
      if (data.rules.length > 0) await kv.rpush(`rules:${data.nodeId}`, ...data.rules);
      return NextResponse.json({ success: true });
    }
    if (action === "GET_RULES") {
      const rules = await kv.lrange(`rules:${data.nodeId}`, 0, -1);
      return NextResponse.json(rules || []);
    }
    
    return NextResponse.json({ error: "Unknown action" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
