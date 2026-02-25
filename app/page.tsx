"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { Activity, Server, Shield, Plus, Save, RefreshCw, Trash2, Home, Network, User, LogOut, Download, Upload, KeyRound, Terminal } from "lucide-react";

export default function App() {
  const [auth, setAuth] = useState<string | null>(null);
  const [tab, setTab] = useState<"home" | "rules" | "nodes" | "me">("home");
  
  // 狀態初始化 (解決 SSR 與暗黑模式不同步問題)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const[mounted, setMounted] = useState(false);

  const [nodes, setNodes] = useState<any[]>([]);
  const [allRules, setAllRules] = useState<Record<string, any[]>>({});
  const[loading, setLoading] = useState(false);

  // 初始化檢測
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem("aero_auth");
    if (token) setAuth(token);
    
    // 讀取本地主題偏好
    const savedTheme = localStorage.getItem("aero_theme");
    if (savedTheme === "light") setIsDarkMode(false);
  },[]);

  // 嚴格控制 HTML 節點的 dark class，修復顯示 Bug
  useEffect(() => {
    if (!mounted) return;
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("aero_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("aero_theme", "light");
    }
  }, [isDarkMode, mounted]);

  useEffect(() => {
    if (auth) fetchAllData();
  }, [auth, tab]);

  const api = async (action: string, data: any = {}) => {
    try {
      const res = await axios.post("/api", { action, auth, ...data });
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("aero_auth");
        setAuth(null);
      }
      throw err;
    }
  };

  const fetchAllData = async () => {
    const fetchedNodes = await api("GET_NODES");
    const nodesArray = Object.values(fetchedNodes);
    setNodes(nodesArray);
    
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
      alert("下發失敗: 節點離線或未安裝 Agent");
    }
    setLoading(false);
  };

  if (!mounted) return <div className="min-h-screen bg-[#111318]" />; // 避免閃爍

  if (!auth) {
    return <LoginView setAuth={(token: string) => { localStorage.setItem("aero_auth", token); setAuth(token); }} />;
  }

  const totalNodes = nodes.length;
  const onlineNodes = nodes.filter(n => n.stats).length;
  const totalRules = Object.values(allRules).reduce((acc, curr) => acc + curr.length, 0);

  return (
    <div className="min-h-screen bg-[#FBFDF8] dark:bg-[#111318] text-[#191C1A] dark:text-[#E2E2E5] transition-colors duration-500 pb-24 font-sans">
      {/* 頂部導航 */}
      <header className="px-6 py-5 flex justify-between items-center sticky top-0 z-10 bg-[#FBFDF8]/80 dark:bg-[#111318]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-full">
            <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Aero<span className="text-emerald-600 dark:text-emerald-400">Node</span></h1>
        </div>
        <div className="flex items-center gap-3">
          {/* 加入 active:scale-90 按鈕互動動畫 */}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-[#F0F4EF] dark:bg-[#202522] active:scale-90 transition-all duration-300 text-gray-700 dark:text-gray-300">
            {isDarkMode ? "🌞" : "🌙"}
          </button>
          <button onClick={fetchAllData} className="p-2.5 rounded-full bg-[#F0F4EF] dark:bg-[#202522] active:scale-90 transition-all duration-300 text-gray-700 dark:text-gray-300">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 視圖切換 */}
      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {tab === "home" && <DashboardView nodes={nodes} totalNodes={totalNodes} onlineNodes={onlineNodes} totalRules={totalRules} />}
        {tab === "nodes" && <NodesView nodes={nodes} fetchAllData={fetchAllData} api={api} handleSync={handleSync} loading={loading} />}
        {tab === "rules" && <RulesView nodes={nodes} allRules={allRules} fetchAllData={fetchAllData} api={api} />}
        {tab === "me" && <MeView api={api} setAuth={setAuth} fetchAllData={fetchAllData} />}
      </main>

      {/* 底部導航欄 (Material You MD3 風格) */}
      <nav className="fixed bottom-0 w-full bg-[#F4F8F4] dark:bg-[#191C1A] border-t border-gray-200/50 dark:border-white/5 px-2 py-3 flex justify-around items-center pb-safe z-50">
        <NavItem icon={<Home className="w-6 h-6" />} label="首頁" active={tab === "home"} onClick={() => setTab("home")} />
        <NavItem icon={<Network className="w-6 h-6" />} label="轉發" active={tab === "rules"} onClick={() => setTab("rules")} />
        <NavItem icon={<Server className="w-6 h-6" />} label="節點" active={tab === "nodes"} onClick={() => setTab("nodes")} />
        <NavItem icon={<User className="w-6 h-6" />} label="我的" active={tab === "me"} onClick={() => setTab("me")} />
      </nav>
    </div>
  );
}

// ================== MD3 子組件 ==================

// MD3 底部導航項 (帶有藥丸背景動畫)
function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center flex-1 gap-1 relative group outline-none active:scale-95 transition-all duration-300">
      <div className={`px-5 py-1 rounded-full transition-all duration-300 ${active ? 'bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8]' : 'text-gray-600 dark:text-gray-400 group-hover:bg-gray-200/50 dark:group-hover:bg-white/5'}`}>
        {icon}
      </div>
      <span className={`text-[12px] font-medium transition-colors ${active ? 'text-[#003825] dark:text-[#51DBA8] font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
}

function LoginView({ setAuth }: any) {
  const [pwd, setPwd] = useState("");
  const handleLogin = async () => {
    try {
      const res = await axios.post("/api", { action: "LOGIN", password: pwd });
      setAuth(res.data.token);
    } catch (e) { alert("登入失敗：密碼錯誤"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDF8] dark:bg-[#111318] p-6 text-gray-900 dark:text-white transition-colors duration-500">
      <div className="w-full max-w-sm bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] shadow-lg border border-gray-200/50 dark:border-white/5 space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
             <Shield className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AeroNode</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">請輸入面板密碼</p>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all border border-gray-200 dark:border-transparent" placeholder="••••••••" />
        <button onClick={handleLogin} className="w-full py-4 rounded-full bg-[#006C4C] dark:bg-[#51DBA8] text-white dark:text-[#003825] font-bold active:scale-95 transition-all duration-300 text-lg shadow-md">
          登入面板
        </button>
      </div>
    </div>
  );
}

function DashboardView({ nodes, totalNodes, onlineNodes, totalRules }: any) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="總節點數" value={totalNodes} />
        <StatCard title="在線節點" value={onlineNodes} color="text-[#006C4C] dark:text-[#51DBA8]" />
        <StatCard title="運行規則" value={totalRules} />
        <StatCard title="網絡狀態" value={onlineNodes > 0 ? "良好" : "離線"} color={onlineNodes > 0 ? "text-[#006C4C] dark:text-[#51DBA8]" : "text-red-500 dark:text-red-400"} />
      </div>
      <h2 className="text-xl font-bold pt-4 px-2">系統總覽</h2>
      {nodes.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px]">暫無節點，請前往「節點」頁面添加</div>
      ) : (
        nodes.map((n: any) => <NodeCard key={n.id} node={n} />)
      )}
    </div>
  );
}

// MD3 風格小卡片
function StatCard({ title, value, color }: any) {
  return (
    <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-[28px] flex flex-col items-center justify-center space-y-2 active:scale-95 transition-all duration-300">
      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</span>
      <span className={`text-3xl font-bold ${color || 'text-gray-800 dark:text-gray-100'}`}>{value}</span>
    </div>
  );
}

function NodesView({ nodes, api, fetchAllData, handleSync, loading }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const[newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });

  const handleAdd = async () => {
    if (!newNode.name || !newNode.ip || !newNode.token) return alert("請填寫完整");
    await api("ADD_NODE", { node: newNode });
    setShowAdd(false);
    setNewNode({ name: "", ip: "", port: "8080", token: "" });
    fetchAllData();
  };

  const getInstallCmd = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // 指向我們新寫的 Vercel API
    return `curl -sSL ${origin}/api/install | bash -s -- --token ${token}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold">節點管理</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8] px-5 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all duration-300">
          + 添加節點
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none focus:ring-2 ring-[#51DBA8]" placeholder="節點名稱 (例如: 深圳BGP)" value={newNode.name} onChange={e=>setNewNode({...newNode,name:e.target.value})} />
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none focus:ring-2 ring-[#51DBA8]" placeholder="公網 IP" value={newNode.ip} onChange={e=>setNewNode({...newNode,ip:e.target.value})} />
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none focus:ring-2 ring-[#51DBA8]" placeholder="自訂 Token (用於Agent認證)" value={newNode.token} onChange={e=>setNewNode({...newNode,token:e.target.value})} />
          
          {newNode.token && (
            <div className="p-5 bg-white dark:bg-[#111318] rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-sm font-bold mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-300"><Terminal className="w-4 h-4"/> 一鍵安裝指令 (Root執行):</p>
              <code className="block text-xs text-[#006C4C] dark:text-[#51DBA8] break-all select-all bg-[#F0F4EF] dark:bg-[#202522] p-3 rounded-xl">{getInstallCmd(newNode.token)}</code>
            </div>
          )}
          <button onClick={handleAdd} className="w-full py-4 bg-[#006C4C] dark:bg-[#51DBA8] text-white dark:text-[#003825] rounded-full font-bold active:scale-95 transition-all duration-300">保存節點</button>
        </div>
      )}

      {nodes.map((n: any) => (
        <div key={n.id} className="space-y-3">
          <NodeCard node={n} />
          <div className="flex gap-3 px-1">
            <button onClick={() => handleSync(n.id)} disabled={loading} className="flex-1 bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8] py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all duration-300 disabled:opacity-50">
              下發配置 (同步)
            </button>
            <button onClick={() => { if(confirm("確定刪除？")) { api("DELETE_NODE", {nodeId: n.id}).then(fetchAllData); } }} className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 py-3.5 rounded-full font-bold text-sm active:scale-95 transition-all duration-300">
              刪除節點
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const[selectedNodeId, setSelectedNodeId] = useState<string>("");
  useEffect(() => { if (nodes.length > 0 && !selectedNodeId) setSelectedNodeId(nodes[0].id); }, [nodes]);
  const rules = selectedNodeId ? (allRules[selectedNodeId] || []) :[];

  const handleSave = async (updatedRules: any[]) => {
    await api("SAVE_RULES", { nodeId: selectedNodeId, rules: updatedRules });
    fetchAllData();
  };

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex overflow-x-auto pb-2 gap-3 hide-scrollbar px-2">
        {nodes.map((n: any) => (
          <button key={n.id} onClick={() => setSelectedNodeId(n.id)} 
            className={`whitespace-nowrap px-6 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all duration-300 ${selectedNodeId === n.id ? 'bg-[#006C4C] dark:bg-[#51DBA8] text-white dark:text-[#003825]' : 'bg-[#F0F4EF] dark:bg-[#202522] text-gray-600 dark:text-gray-400'}`}>
            {n.name}
          </button>
        ))}
      </div>

      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 md:p-6 rounded-[32px] space-y-4">
        <div className="flex justify-between items-center mb-2 px-2">
          <h3 className="font-bold text-lg flex items-center gap-2"><Network className="w-5 h-5"/> 轉發規則</h3>
          <button onClick={() => handleSave([...rules, { listen_port: "10000-20000", dest_ip: "1.1.1.1", dest_port: "10000-20000", protocol: "tcp" }])} className="bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8] px-4 py-2 rounded-full font-bold text-xs active:scale-95 transition-all duration-300">
            + 添加
          </button>
        </div>

        {rules.map((r: any, idx: number) => (
          <div key={idx} className="bg-white dark:bg-[#111318] p-4 rounded-[24px] flex flex-col md:flex-row gap-3 items-center shadow-sm">
            <div className="flex flex-1 w-full gap-2 items-center">
               <span className="text-xs font-bold text-gray-400 w-8">本地</span>
               <input value={r.listen_port} onChange={e=>{const n=[...rules];n[idx].listen_port=e.target.value;handleSave(n)}} className="flex-1 bg-[#F0F4EF] dark:bg-[#202522] p-3 rounded-xl text-sm text-center font-mono outline-none focus:ring-1 ring-[#51DBA8]" />
            </div>
            <span className="text-gray-400 rotate-90 md:rotate-0">➔</span>
            <div className="flex flex-[2] w-full gap-2 items-center">
               <span className="text-xs font-bold text-gray-400 w-8">目標</span>
               <input value={r.dest_ip} onChange={e=>{const n=[...rules];n[idx].dest_ip=e.target.value;handleSave(n)}} className="flex-1 bg-[#F0F4EF] dark:bg-[#202522] p-3 rounded-xl text-sm text-center font-mono outline-none focus:ring-1 ring-[#51DBA8]" />
               <span className="text-gray-400">:</span>
               <input value={r.dest_port} onChange={e=>{const n=[...rules];n[idx].dest_port=e.target.value;handleSave(n)}} className="flex-1 bg-[#F0F4EF] dark:bg-[#202522] p-3 rounded-xl text-sm text-center font-mono outline-none focus:ring-1 ring-[#51DBA8]" />
            </div>
            <select value={r.protocol} onChange={e=>{const n=[...rules];n[idx].protocol=e.target.value;handleSave(n)}} className="bg-[#F0F4EF] dark:bg-[#202522] p-3 rounded-xl text-sm font-mono outline-none w-full md:w-auto">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
            <button onClick={()=>{const n=[...rules];n.splice(idx,1);handleSave(n)}} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl active:scale-90 transition-all"><Trash2 className="w-5 h-5"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeView({ api, setAuth, fetchAllData }: any) {
  const[pwd, setPwd] = useState("");
  const handleExport = async () => {
    const data = await api("EXPORT_ALL");
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `aero_backup.json`;
    a.click();
  };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-xl font-bold px-2">我的設定</h2>
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5"/> 修改密碼</h3>
        <div className="flex gap-2">
          <input type="password" placeholder="輸入新密碼" value={pwd} onChange={e=>setPwd(e.target.value)} className="flex-1 bg-white dark:bg-[#111318] p-4 rounded-full outline-none focus:ring-2 ring-[#51DBA8]" />
          <button onClick={async ()=>{if(!pwd)return; const res=await api("CHANGE_PASSWORD",{newPassword:pwd}); setAuth(res.token); localStorage.setItem("aero_auth",res.token); alert("成功"); setPwd("");}} className="px-6 bg-[#006C4C] dark:bg-[#51DBA8] text-white dark:text-[#003825] font-bold rounded-full active:scale-95 transition-all">修改</button>
        </div>
      </div>
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Save className="w-5 h-5"/> 備份與還原</h3>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8] py-4 rounded-full font-bold active:scale-95 transition-all">
            <Download className="w-5 h-5" /> 導出 JSON
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 py-4 rounded-full font-bold cursor-pointer active:scale-95 transition-all">
            <Upload className="w-5 h-5" /> 導入 JSON
            <input type="file" accept=".json" className="hidden" onChange={(e:any)=>{const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev:any)=>{if(confirm("將覆蓋所有資料？")) {await api("IMPORT_ALL",{backupData:JSON.parse(ev.target.result)}); alert("成功"); fetchAllData();}}; r.readAsText(f);}} />
          </label>
        </div>
      </div>
      <button onClick={() => { localStorage.removeItem("aero_auth"); setAuth(null); }} className="w-full flex justify-center items-center gap-2 py-4 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded-full font-bold active:scale-95 transition-all">
        <LogOut className="w-5 h-5" /> 退出登入
      </button>
    </div>
  );
}

function NodeCard({ node }: { node: any }) {
  const isOnline = !!node.stats;
  const cpu = node.stats?.cpu_load || "0.0";
  return (
    <div className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 text-sm font-medium space-y-6 relative overflow-hidden transition-all duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{node.name}</h3>
          <p className="text-gray-500 font-mono mt-1 text-xs">{node.ip}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${isOnline ? 'bg-[#CCE8DA] dark:bg-[#334B40] text-[#003825] dark:text-[#51DBA8]' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'}`}>
          {isOnline ? '在線' : '離線'}
        </span>
      </div>
      <div className="flex gap-5">
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs"><span className="text-gray-500">CPU</span><span className="font-mono">{cpu}%</span></div>
          <div className="h-2 w-full bg-gray-200 dark:bg-[#111318] rounded-full overflow-hidden">
             <div className="h-full bg-[#006C4C] dark:bg-[#51DBA8] rounded-full transition-all duration-1000" style={{ width: `${Math.min(parseFloat(cpu)*10, 100)}%` }}></div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex justify-between text-xs"><span className="text-gray-500">狀態</span><span>{isOnline ? 'Running' : 'Wait'}</span></div>
          <div className="h-2 w-full bg-gray-200 dark:bg-[#111318] rounded-full overflow-hidden">
             <div className={`h-full rounded-full transition-all duration-1000 ${isOnline ? 'bg-blue-500 w-[40%]' : 'bg-gray-500 w-0'}`}></div>
          </div>
        </div>
      </div>
    </div>
  );
}