import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

// 強制動態渲染，禁止緩存，確保獲取最新指令
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // ==========================================
    // 1. 配置下載接口 (類似訂閱鏈接)
    // Agent 收到 has_cmd=true 後調用此接口
    // ==========================================
    if (action === "DOWNLOAD_CONFIG") {
        const nodeId = searchParams.get("node_id");
        const token = searchParams.get("token");

        if (!nodeId || !token) {
            return NextResponse.json({ error: "Missing params" }, { status: 400 });
        }

        const node: any = await kv.hget("nodes", nodeId);
        
        // 嚴格校驗 Token，防止配置洩露
        if (!node || node.token !== token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 從 Redis 讀取該節點的規則列表
        const rules = await kv.lrange(`rules:${nodeId}`, 0, -1) || [];
        
        // 關鍵步驟：清除更新標記 (cmd)，表示 Agent 已成功獲取最新配置
        await kv.del(`cmd:${nodeId}`);

        // 返回明文 JSON 配置
        return NextResponse.json({ success: true, rules: rules });
    }

    // ==========================================
    // 2. 心跳上報接口 (Heartbeat)
    // Agent 定時調用，彙報狀態並檢查是否有新指令
    // ==========================================
    const dataStr = searchParams.get("data");
    if (action === "HEARTBEAT" && dataStr) {
      // 處理 URL 編碼可能導致的空格問題
      const cleanData = dataStr.replace(/ /g, '+');
      let data;
      try {
        data = JSON.parse(Buffer.from(cleanData, 'base64').toString('utf-8'));
      } catch (e) { 
        return NextResponse.json({ error: "Decode Error" }, { status: 400 }); 
      }

      const { nodeId, token, stats } = data;
      const node: any = await kv.hget("nodes", nodeId);

      // 校驗節點身份
      if (!node || node.token !== token) {
          return NextResponse.json({ error: "Auth failed" }, { status: 401 });
      }

      // 更新節點狀態 (最後在線時間、性能數據)
      node.lastSeen = Date.now();
      node.stats = stats;
      await kv.hset("nodes", { [nodeId]: node });

      // 檢查是否有待執行的指令 (例如：配置已更新)
      const pendingCmd = await kv.get(`cmd:${nodeId}`);
      
      // 檢查管理面板是否活躍 (用於動態調整心跳頻率)
      // panel_activity 由管理員面板接口寫入
      const lastActivity = await kv.get<number>("panel_activity") || 0;
      const isActive = (Date.now() - lastActivity) < 60000;

      return NextResponse.json({
        success: true,
        // 如果面板活躍，要求 Agent 每 3 秒上報一次，否則 90 秒
        interval: isActive ? 3 : 90,
        // 如果有指令 (如 UPDATE)，通知 Agent 去下載配置
        has_cmd: !!pendingCmd 
      });
    }
    
    return NextResponse.json({ error: "Invalid Action" }, { status: 400 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
