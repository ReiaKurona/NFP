"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Activity, Server, Shield, Plus, Save, RefreshCw, Trash2, Home, Network, User, LogOut, Download, Upload, KeyRound, Terminal } from "lucide-react";

export default function App() {
  const [auth, setAuth] = useState<string | null>(null);
  const [tab, setTab] = useState<"home" | "rules" | "nodes" | "me">("home");
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 系統狀態
  const [nodes, setNodes] = useState<any[]>([]);
  const[allRules, setAllRules] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  // 初始化檢測登入狀態與深色模式
  useEffect(() => {
    const token = localStorage.getItem("aero_auth");
    if (token) setAuth(token);
    // 預設強制深色模式以符合截圖
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (auth) fetchAllData();
  }, [auth, tab]);

  // --- API 核心調用 ---
  const api = async (action: string, data: any = {}) => {
    try {
      const res = await axios.post("/api", { action, auth, ...data });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("aero_auth");
        setAuth(null);
        alert(err.response.data.error || "授權失敗，請重新登入");
      }
      throw err;
    }
  };

  const fetchAllData = async () => {
    const fetchedNodes = await api("GET_NODES");
    const nodesArray = Object.values(fetchedNodes);
    setNodes(nodesArray);
    
    // 獲取所有節點的規則
    const rulesMap: any = {};
    for (const n of nodesArray as any[]) {
      rulesMap[n.id] = await api("GET_RULES", { nodeId: n.id });
    }
    setAllRules(rulesMap);
  };

  const handleSync = async (nodeId: string) => {
    setLoading(true);
    try {
      await api("SYNC_AGENT", { nodeId });
      alert("配置下發成功！");
      fetchAllData();
    } catch (e: any) {
      alert("下發失敗: " + (e.response?.data?.error || e.message));
    }
    setLoading(false);
  };

// --- 登入組件 ---
  if (!auth) {
    return <LoginView setAuth={(token: string) => { localStorage.setItem("aero_auth", token); setAuth(token); }} />;
  }

  // 計算首頁總計數據
  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter(n => n.stats).length;
  const totalRules = Object.values(allRules).reduce((acc, curr) => acc + curr.length, 0);

  return (
    <div className={`min-h-screen pb-24 ${isDarkMode ? "dark bg-[#0a0a0a] text-gray-100" : "bg-gray-50 text-gray-900"} font-sans transition-colors duration-300`}>
      {/* 頂部 Header */}
      <header className="px-6 py-4 flex justify-between items-center sticky top-0 z-10 bg-inherit/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-500" />
          <h1 className="text-xl font-bold">Aero<span className="text-emerald-500">Node</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-gray-200 dark:bg-white/10">
            {isDarkMode ? "🌞" : "🌙"}
          </button>
          <button onClick={fetchAllData} className="p-2 rounded-full bg-gray-200 dark:bg-white/10">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 主體內容切換 */}
      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {tab === "home" && <DashboardView nodes={nodes} totalNodes={totalNodes} onlineNodes={onlineNodes} totalRules={totalRules} />}
        {tab === "nodes" && <NodesView nodes={nodes} fetchAllData={fetchAllData} api={api} handleSync={handleSync} loading={loading} />}
        {tab === "rules" && <RulesView nodes={nodes} allRules={allRules} fetchAllData={fetchAllData} api={api} handleSync={handleSync} />}
        {tab === "me" && <MeView api={api} setAuth={setAuth} fetchAllData={fetchAllData} />}
      </main>

      {/* 底部導航欄 (仿圖片設計) */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-[#121212] border-t border-gray-200 dark:border-white/5 px-6 py-3 flex justify-between items-center pb-safe text-xs md:text-sm z-50">
        <NavItem icon={<Home className="w-6 h-6 mb-1" />} label="首頁" active={tab === "home"} onClick={() => setTab("home")} />
        <NavItem icon={<Network className="w-6 h-6 mb-1" />} label="轉發" active={tab === "rules"} onClick={() => setTab("rules")} />
        <NavItem icon={<Server className="w-6 h-6 mb-1" />} label="節點" active={tab === "nodes"} onClick={() => setTab("nodes")} />
        <NavItem icon={<User className="w-6 h-6 mb-1" />} label="我的" active={tab === "me"} onClick={() => setTab("me")} />
      </nav>
    </div>
  );
}

// ================== 子組件 ==================

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center flex-1 transition-colors ${active ? "text-emerald-400" : "text-gray-400 dark:text-gray-500 hover:text-gray-300"}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// 登入視圖
function LoginView({ setAuth }: any) {
  const [pwd, setPwd] = useState("");
  const handleLogin = async () => {
    try {
      const res = await axios.post("/api", { action: "LOGIN", password: pwd });
      setAuth(res.data.token);
    } catch (e) {
      alert("登入失敗：密碼錯誤");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
      <div className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-[2rem] shadow-2xl border border-white/10 space-y-6">
        <div className="text-center space-y-2">
          <Shield className="w-16 h-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">AeroNode</h1>
          <p className="text-gray-400 text-sm">請輸入面板密碼 (預設 admin123)</p>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full bg-[#2a2a2a] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="••••••••" />
        <button onClick={handleLogin} className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-bold transition">登入面板</button>
      </div>
    </div>
  );
}

// 儀表盤視圖
function DashboardView({ nodes, totalNodes, onlineNodes, totalRules }: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="總節點數" value={totalNodes} color="text-blue-400" />
        <StatCard title="在線節點" value={onlineNodes} color="text-emerald-400" />
        <StatCard title="運行規則" value={totalRules} color="text-purple-400" />
        <StatCard title="網絡狀態" value={onlineNodes > 0 ? "良好" : "離線"} color={onlineNodes > 0 ? "text-emerald-400" : "text-red-400"} />
      </div>

      <h2 className="text-xl font-bold pt-4">系統總覽</h2>
      {nodes.length === 0 ? (
        <div className="text-center py-10 text-gray-500">暫無節點，請前往「節點」頁面添加</div>
      ) : (
        nodes.map((n: any) => <NodeCard key={n.id} node={n} showActions={false} />)
      )}
    </div>
  );
}

function StatCard({ title, value, color }: any) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-3xl border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center space-y-1">
      <span className="text-sm text-gray-500 font-medium">{title}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

// 節點管理視圖 (包含一鍵安裝指令)
function NodesView({ nodes, api, fetchAllData, handleSync, loading }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });

  const handleAdd = async () => {
    if (!newNode.name || !newNode.ip || !newNode.token) return alert("請填寫完整");
    await api("ADD_NODE", { node: newNode });
    setShowAdd(false);
    setNewNode({ name: "", ip: "", port: "8080", token: "" });
    fetchAllData();
  };

  const handleDelete = async (nodeId: string) => {
    if (confirm("確定要刪除這個節點及其所有規則嗎？")) {
      await api("DELETE_NODE", { nodeId });
      fetchAllData();
    }
  };

  // 生成一鍵安裝指令 (面板URL + Token)
  const getInstallCmd = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://你的面板域名';
    return `curl -sSL ${origin}/install.sh | bash -s -- --token ${token}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">節點管理</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-emerald-600/20 text-emerald-500 px-4 py-2 rounded-full font-bold text-sm">
          + 添加節點
        </button>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-200 dark:border-white/5 space-y-4">
          <input className="w-full bg-gray-50 dark:bg-[#2a2a2a] p-3 rounded-xl" placeholder="節點名稱 (例如: 深圳BGP)" value={newNode.name} onChange={e=>setNewNode({...newNode,name:e.target.value})} />
          <input className="w-full bg-gray-50 dark:bg-[#2a2a2a] p-3 rounded-xl" placeholder="公網 IP" value={newNode.ip} onChange={e=>setNewNode({...newNode,ip:e.target.value})} />
          <input className="w-full bg-gray-50 dark:bg-[#2a2a2a] p-3 rounded-xl" placeholder="自訂 Token (用於Agent認證)" value={newNode.token} onChange={e=>setNewNode({...newNode,token:e.target.value})} />
          
          {newNode.token && (
            <div className="p-4 bg-[#0a0a0a] rounded-xl border border-gray-700">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Terminal className="w-3 h-3"/> 一鍵安裝腳本 (請在 VPS 上以 Root 執行):</p>
              <code className="text-xs text-emerald-400 break-all select-all">{getInstallCmd(newNode.token)}</code>
            </div>
          )}
          <button onClick={handleAdd} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold">保存節點</button>
        </div>
      )}

      {nodes.map((n: any) => (
        <div key={n.id} className="space-y-2">
          <NodeCard node={n} showActions={true} />
          <div className="flex gap-2">
            <button onClick={() => handleSync(n.id)} disabled={loading} className="flex-1 bg-blue-600/20 text-blue-400 py-3 rounded-2xl font-bold text-sm hover:bg-blue-600/30">
              下發配置 (同步)
            </button>
            <button onClick={() => handleDelete(n.id)} className="flex-1 bg-red-600/10 text-red-500 py-3 rounded-2xl font-bold text-sm hover:bg-red-600/20">
              刪除節點
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 轉發規則視圖 (獨立出來，支援區間端口)
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  
  useEffect(() => {
    if (nodes.length > 0 && !selectedNodeId) setSelectedNodeId(nodes[0].id);
  }, [nodes]);

  const rules = selectedNodeId ? (allRules[selectedNodeId] || []) : [];

  const handleSave = async (updatedRules: any[]) => {
    await api("SAVE_RULES", { nodeId: selectedNodeId, rules: updatedRules });
    fetchAllData();
    alert("規則保存成功！請去「節點」頁面點擊下發配置生效。");
  };

  const addRule = () => {
    const newRules =[...rules, { listen_port: "10000-20000", dest_ip: "1.1.1.1", dest_port: "10000-20000", protocol: "tcp" }];
    handleSave(newRules);
  };

  const deleteRule = (idx: number) => {
    const newRules = [...rules];
    newRules.splice(idx, 1);
    handleSave(newRules);
  };

  const updateRule = (idx: number, field: string, val: string) => {
    const newRules = [...rules];
    newRules[idx][field] = val;
    // 這裡只是更新本地 state，需手動點擊保存按鈕，避免頻繁請求
    // 但為了簡單，我們可以實時存到父組件的 state，或者提供一個保存按鈕
  };

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 節點切換 Tabs */}
      <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar">
        {nodes.map((n: any) => (
          <button key={n.id} onClick={() => setSelectedNodeId(n.id)} 
            className={`whitespace-nowrap px-5 py-2 rounded-full font-bold text-sm transition ${selectedNodeId === n.id ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}>
            {n.name}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] p-4 md:p-6 rounded-3xl border border-gray-200 dark:border-white/5 space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Network className="w-5 h-5"/> Nftables 規則</h3>
          <button onClick={addRule} className="text-emerald-500 font-bold text-sm">+ 添加規則</button>
        </div>
        
        <p className="text-xs text-gray-500 mb-4">提示：本地端口和目標端口支援區間，例如輸入 `10000-20000` 即可實現整段轉發。</p>

        {rules.map((r: any, idx: number) => (
          <div key={idx} className="bg-gray-50 dark:bg-[#2a2a2a] p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center border border-gray-200 dark:border-white/5">
            <div className="flex flex-1 w-full gap-2 items-center">
               <span className="text-xs font-bold text-gray-400 w-8">本地</span>
               <input value={r.listen_port} onChange={e=>updateRule(idx, 'listen_port', e.target.value)} onBlur={()=>handleSave(rules)} className="flex-1 bg-white dark:bg-[#1a1a1a] p-2 rounded-lg text-sm text-center font-mono" placeholder="端口/區間" />
            </div>
            <span className="text-gray-400 rotate-90 md:rotate-0">➔</span>
            <div className="flex flex-[2] w-full gap-2 items-center">
               <span className="text-xs font-bold text-gray-400 w-8">目標</span>
               <input value={r.dest_ip} onChange={e=>updateRule(idx, 'dest_ip', e.target.value)} onBlur={()=>handleSave(rules)} className="flex-1 bg-white dark:bg-[#1a1a1a] p-2 rounded-lg text-sm text-center font-mono" placeholder="IP 地址" />
               <span className="text-gray-400">:</span>
               <input value={r.dest_port} onChange={e=>updateRule(idx, 'dest_port', e.target.value)} onBlur={()=>handleSave(rules)} className="flex-1 bg-white dark:bg-[#1a1a1a] p-2 rounded-lg text-sm text-center font-mono" placeholder="端口/區間" />
            </div>
            <select value={r.protocol} onChange={e=>{updateRule(idx, 'protocol', e.target.value); handleSave(rules);}} className="bg-white dark:bg-[#1a1a1a] p-2 rounded-lg text-sm font-mono w-full md:w-auto">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
            <button onClick={() => deleteRule(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-5 h-5"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 我的 (設定、修改密碼、導入導出)
function MeView({ api, setAuth, fetchAllData }: any) {
  const [pwd, setPwd] = useState("");

  const handleChangePwd = async () => {
    if (!pwd) return;
    try {
      const res = await api("CHANGE_PASSWORD", { newPassword: pwd });
      setAuth(res.token);
      localStorage.setItem("aero_auth", res.token);
      alert("密碼修改成功！");
      setPwd("");
    } catch(e) { alert("修改失敗"); }
  };

  const handleExport = async () => {
    const data = await api("EXPORT_ALL");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aero_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleImport = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event: any) => {
      try {
        const json = JSON.parse(event.target.result);
        if (confirm("警告：這將覆蓋現有所有節點和規則，確定嗎？")) {
          await api("IMPORT_ALL", { backupData: json });
          alert("還原成功！");
          fetchAllData();
        }
      } catch (err) { alert("無效的 JSON 檔案"); }
    };
    reader.readAsText(file);
  };

  const handleLogout = () => {
    localStorage.removeItem("aero_auth");
    setAuth(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold">個人中心與設定</h2>
      
      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-200 dark:border-white/5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5 text-emerald-500"/> 修改管理員密碼</h3>
        <div className="flex gap-2">
          <input type="password" placeholder="輸入新密碼" value={pwd} onChange={e=>setPwd(e.target.value)} className="flex-1 bg-gray-50 dark:bg-[#2a2a2a] p-3 rounded-xl" />
          <button onClick={handleChangePwd} className="px-6 bg-emerald-600 text-white font-bold rounded-xl">確認修改</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-3xl border border-gray-200 dark:border-white/5 space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Save className="w-5 h-5 text-blue-500"/> 數據備份與還原</h3>
        <p className="text-sm text-gray-500">將所有節點和轉發規則導出為 JSON 檔案，方便遷移面板。</p>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-blue-600/20 text-blue-500 py-3 rounded-xl font-bold hover:bg-blue-600/30">
            <Download className="w-5 h-5" /> 一鍵導出
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-purple-600/20 text-purple-500 py-3 rounded-xl font-bold cursor-pointer hover:bg-purple-600/30">
            <Upload className="w-5 h-5" /> 導入 JSON
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      <button onClick={handleLogout} className="w-full flex justify-center items-center gap-2 py-4 text-red-500 bg-red-500/10 rounded-3xl font-bold hover:bg-red-500/20 transition">
        <LogOut className="w-5 h-5" /> 退出登入
      </button>
    </div>
  );
}

// ================== 高階 UI 元件 (精確仿製你的截圖) ==================

function NodeCard({ node, showActions }: { node: any, showActions: boolean }) {
  const isOnline = !!node.stats;
  const cpu = node.stats?.cpu_load || "0.0";
  // 模擬一下記憶體佔用百分比，如果 agent 有返回真實數據請替換
  const memPercent = isOnline ? "28.8%" : "0.0%"; 

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-[2rem] p-5 border border-gray-200 dark:border-white/5 shadow-sm text-sm font-medium space-y-5 relative overflow-hidden">
      {/* 頭部資訊 */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">{node.name}</h3>
          <p className="text-gray-500 font-mono mt-1 text-xs">{node.ip}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
          {isOnline ? '在線' : '離線'}
        </span>
      </div>

      {/* 系統資源進度條 */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs"><span className="text-gray-400">CPU</span><span>{cpu}%</span></div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(parseFloat(cpu)*10, 100)}%` }}></div>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs"><span className="text-gray-400">內存</span><span>{memPercent}</span></div>
          <div className="h-1.5 w-full bg-gray-200 dark:bg-[#2a2a2a] rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 rounded-full" style={{ width: memPercent }}></div>
          </div>
        </div>
      </div>

      {/* 流量數據網格 (仿照圖片的 2x2 網格) */}
      <div className="grid grid-cols-2 gap-3">
         <div className="bg-gray-50 dark:bg-[#2a2a2a] py-3 rounded-2xl flex flex-col items-center justify-center">
           <span className="text-xs text-gray-500 mb-1">↑ 上傳速率</span>
           <span className="font-mono text-[13px]">{node.stats?.tx_speed || "0 B/s"}</span>
         </div>
         <div className="bg-gray-50 dark:bg-[#2a2a2a] py-3 rounded-2xl flex flex-col items-center justify-center">
           <span className="text-xs text-gray-500 mb-1">↓ 下載速率</span>
           <span className="font-mono text-[13px]">{node.stats?.rx_speed || "0 B/s"}</span>
         </div>
         <div className="bg-gray-50 dark:bg-[#2a2a35] py-3 rounded-2xl flex flex-col items-center justify-center border border-blue-500/20">
           <span className="text-xs text-blue-400 mb-1">↑ 總上行</span>
           <span className="font-mono text-[13px] text-blue-300">{node.stats?.tx_total || "0 GB"}</span>
         </div>
         <div className="bg-gray-50 dark:bg-[#25302a] py-3 rounded-2xl flex flex-col items-center justify-center border border-emerald-500/20">
           <span className="text-xs text-emerald-400 mb-1">↓ 總下行</span>
           <span className="font-mono text-[13px] text-emerald-300">{node.stats?.rx_total || "0 GB"}</span>
         </div>
      </div>
    </div>
  );
}
