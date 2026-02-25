"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Activity, Server, Shield, Plus, Save, RefreshCw, Trash2, Globe } from "lucide-react";

export default function Dashboard() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);

  useEffect(() => { fetchNodes(); }, []);

  const api = async (action: string, data: any = {}) => {
    return (await axios.post("/api", { action, ...data })).data;
  };

  const fetchNodes = async () => {
    const res = await api("GET_NODES");
    setNodes(Object.values(res));
  };

  const handleAddNode = async () => {
    if(!newNode.name || !newNode.ip) return alert("請填寫完整資訊");
    await api("ADD_NODE", { node: newNode });
    setNewNode({ name: "", ip: "", port: "8080", token: "" });
    fetchNodes();
  };

  const handleOpenRules = async (node: any) => {
    setSelectedNode(node);
    const res = await api("GET_RULES", { nodeId: node.id });
    setRules(res);
  };

  const handleSaveRules = async () => {
    await api("SAVE_RULES", { nodeId: selectedNode.id, rules });
    alert("規則已保存，請點擊「部署」生效");
  };

  const handleSync = async (nodeId: string) => {
    setLoading(true);
    try {
      const res = await api("SYNC_AGENT", { nodeId });
      if(res.error) throw new Error(res.error);
      alert("部署成功！Agent 已更新");
      fetchNodes();
    } catch (e: any) {
      alert("部署失敗: " + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex justify-between items-center pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-500">
            AeroPanel <span className="text-xs text-gray-400 font-mono">Serverless</span>
          </h1>
        </div>
        <button onClick={fetchNodes} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition">
          <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
      </header>

      {/* 節點列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes.map((node) => (
          <div key={node.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-gray-400" />
                <div>
                  <h3 className="font-bold text-lg">{node.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{node.ip}:{node.port}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-bold ${node.stats ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {node.stats ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            
            <div className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>負載</span>
                <span className="font-mono">{node.stats?.cpu_load || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>最後更新</span>
                <span className="font-mono">{node.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : "-"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleOpenRules(node)} className="py-2 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 font-medium text-sm hover:brightness-95">
                編輯規則
              </button>
              <button onClick={() => handleSync(node.id)} disabled={loading} className="py-2 px-4 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? '...' : '部署'}
              </button>
            </div>
          </div>
        ))}

        {/* 新增卡片 */}
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex flex-col justify-center gap-3">
          <h3 className="font-bold text-gray-500 text-center">添加新節點</h3>
          <input className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border text-sm" placeholder="名稱 (如: 香港伺服器)" value={newNode.name} onChange={e=>setNewNode({...newNode, name: e.target.value})} />
          <input className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border text-sm" placeholder="IP 地址" value={newNode.ip} onChange={e=>setNewNode({...newNode, ip: e.target.value})} />
          <input className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border text-sm" placeholder="Token (由安裝腳本生成)" value={newNode.token} onChange={e=>setNewNode({...newNode, token: e.target.value})} />
          <button onClick={handleAddNode} className="w-full py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold text-sm">確認添加</button>
        </div>
      </div>

      {/* 規則編輯彈窗 */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                配置規則: {selectedNode.name}
              </h2>
              <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {rules.length === 0 && <div className="text-center text-gray-400 py-8">暫無轉發規則，請點擊下方按鈕添加</div>}
              {rules.map((rule, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-gray-400">本機</span>
                    <input value={rule.listen_port} onChange={e=>{const n=[...rules];n[idx].listen_port=e.target.value;setRules(n)}} className="w-24 p-2 rounded border bg-white dark:bg-gray-800 text-center font-mono text-sm" placeholder="8080" />
                  </div>
                  <span className="hidden md:block text-gray-300">➜</span>
                  <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
                    <span className="text-xs font-bold text-gray-400">目標</span>
                    <input value={rule.dest_ip} onChange={e=>{const n=[...rules];n[idx].dest_ip=e.target.value;setRules(n)}} className="flex-1 p-2 rounded border bg-white dark:bg-gray-800 font-mono text-sm" placeholder="1.1.1.1" />
                    <span className="text-gray-400">:</span>
                    <input value={rule.dest_port} onChange={e=>{const n=[...rules];n[idx].dest_port=e.target.value;setRules(n)}} className="w-20 p-2 rounded border bg-white dark:bg-gray-800 text-center font-mono text-sm" placeholder="80" />
                  </div>
                  <button onClick={()=>{const n=[...rules];n.splice(idx,1);setRules(n)}} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between">
              <button onClick={()=>setRules([...rules, {listen_port:"", dest_ip:"", dest_port:"", protocol:"tcp"}])} className="flex items-center gap-2 text-primary font-bold px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                <Plus className="w-4 h-4" /> 添加規則
              </button>
              <button onClick={handleSaveRules} className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:brightness-110 transition">
                <Save className="w-4 h-4" /> 保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
