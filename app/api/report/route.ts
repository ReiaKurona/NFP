// app/api/report/route.ts
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeId, token, stats } = body;

    // 驗證 Token (簡易驗證，防止惡意刷接口)
    const node: any = await kv.hget("nodes", nodeId);
    if (!node || node.token !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 更新最後在線時間與狀態
    // 這裡我們只更新 stats 和 lastSeen，不覆蓋整個 node 對象
    node.lastSeen = Date.now();
    node.stats = stats;
    await kv.hset("nodes", { [nodeId]: node });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
