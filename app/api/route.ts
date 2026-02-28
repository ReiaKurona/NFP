import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import crypto from "crypto";

// 強制動態渲染
export const dynamic = 'force-dynamic';

// 密碼哈希輔助函數 (加鹽)
function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password + "aero_salt").digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, auth, ...data } = body;

    // 初始化：如果沒有管理員密碼，設置默認密碼 admin123
    let currentHash = await kv.get<string>("admin_password");
    if (!currentHash) { 
        currentHash = hashPassword("admin123"); 
        await kv.set("admin_password", currentHash); 
    }

    // ==========================================
    // 1. 登錄邏輯
    // ==========================================
    if (action === "LOGIN") {
        const isPwdCorrect = hashPassword(data.password) === currentHash;
        
        if (isPwdCorrect) {
            // 返回哈希值作為 Token (簡單鑑權模式)
            return NextResponse.json({ success: true, token: currentHash });
        }
        return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    // ==========================================
    // 2. 鑑權中間件
    // 所有非登錄操作均需校驗 auth 字段
    // ==========================================
    if (auth !== currentHash) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ==========================================
    // 3. 業務邏輯處理
    // ==========================================

    // 面板保活：更新活躍時間戳，影響 Agent 的心跳頻率
    if (action === "KEEP_ALIVE") { 
        await kv.set("panel_activity", Date.now()); 
        return NextResponse.json({ success: true }); 
    }

    // 保存規則：寫入規則列表並設置更新標記 (cmd)
    if (action === "SAVE_RULES") {
      const { nodeId, rules } = data;
      // 先刪除舊規則
      await kv.del(`rules:${nodeId}`);
      // 如果有新規則則寫入
      if (rules.length > 0) {
          await kv.rpush(`rules:${nodeId}`, ...rules);
      }
      // 設置指令，通知 Agent 下次心跳時更新
      await kv.set(`cmd:${nodeId}`, "UPDATE"); 
      return NextResponse.json({ success: true });
    }

    // 添加節點
    if (action === "ADD_NODE") {
       const id = Date.now().toString(); // 使用時間戳作為簡單 ID
       await kv.hset("nodes", { [id]: { ...data.node, id, lastSeen: 0 } });
       return NextResponse.json({ success: true });
    }

    // 刪除節點
    if (action === "DELETE_NODE") {
       const nodes: any = await kv.hgetall("nodes");
       if(nodes) { 
           delete nodes[data.nodeId]; 
           await kv.del("nodes"); 
           await kv.hset("nodes", nodes); 
       }
       // 同時清理該節點關聯的規則和指令
       await kv.del(`rules:${data.nodeId}`); 
       await kv.del(`cmd:${data.nodeId}`);
       return NextResponse.json({ success: true });
    }

    // 獲取所有節點信息
    if (action === "GET_NODES") {
        return NextResponse.json(await kv.hgetall("nodes") || {});
    }

    // 獲取指定節點的規則
    if (action === "GET_RULES") {
        return NextResponse.json(await kv.lrange(`rules:${data.nodeId}`, 0, -1) || []);
    }

    // 修改管理員密碼
    if (action === "CHANGE_PASSWORD") { 
        const newHash = hashPassword(data.newPassword); 
        await kv.set("admin_password", newHash); 
        return NextResponse.json({ success: true, token: newHash }); 
    }
    
    // 導出備份 (所有節點 + 所有規則)
    if (action === "EXPORT_ALL") { 
        const nodes = await kv.hgetall("nodes") || {}; 
        const rules: any = {}; 
        for (const id of Object.keys(nodes)) {
            rules[id] = await kv.lrange(`rules:${id}`, 0, -1) || [];
        }
        return NextResponse.json({ nodes, rules }); 
    }

    // 導入備份
    if (action === "IMPORT_ALL") { 
        const { nodes, rules } = data.backupData; 
        
        // 恢復節點
        await kv.del("nodes"); 
        if (Object.keys(nodes).length > 0) {
            await kv.hset("nodes", nodes); 
        }

        // 恢復規則並觸發所有節點更新
        for (const nodeId of Object.keys(rules)) { 
            await kv.del(`rules:${nodeId}`); 
            if (rules[nodeId].length > 0) {
                await kv.rpush(`rules:${nodeId}`, ...rules[nodeId]); 
            }
            // 讓所有 Agent 在恢復後立即同步配置
            await kv.set(`cmd:${nodeId}`, "UPDATE"); 
        } 
        return NextResponse.json({ success: true }); 
    }

    return NextResponse.json({ error: "Unknown Action" }, { status: 400 });

  } catch (e: any) { 
    return NextResponse.json({ error: e.message }, { status: 500 }); 
  }
}
