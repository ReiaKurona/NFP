"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Shield, Plus, Save, RefreshCw, Trash2, Home, Network, User, LogOut, Terminal, Palette, PauseCircle, Server } from "lucide-react";
// MD3 官方配色主題
const THEMES = {
  emerald: { primary: "#006C4C", onPrimary: "#FFFFFF", primaryContainer: "#89F8C7", onPrimaryContainer: "#002114" },
  ocean:   { primary: "#0061A4", onPrimary: "#FFFFFF", primaryContainer: "#D1E4FF", onPrimaryContainer: "#001D36" },
  lavender:{ primary: "#6750A4", onPrimary: "#FFFFFF", primaryContainer: "#EADDFF", onPrimaryContainer: "#21005D" },
  rose:    { primary: "#9C4146", onPrimary: "#FFFFFF", primaryContainer: "#FFDADA", onPrimaryContainer: "#40000A" }
};

export default function App() {
  const [auth, setAuth] = useState<string | null>(null);
  const [tab, setTab] = useState<"home" | "rules" | "nodes" | "me">("home");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [themeKey, setThemeKey] = useState<keyof typeof THEMES>("emerald");
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [allRules, setAllRules] = useState<Record<string, any[]>>({});
  
  // 節能休眠機制
  const [isActive, setIsActive] = useState(true);
  const idleTimer = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("aero_auth");
    if (token) setAuth(token);
    if (localStorage.getItem("aero_theme") === "light") setIsDarkMode(false);
    const savedColor = localStorage.getItem("aero_color") as keyof typeof THEMES;
    if (savedColor && THEMES[savedColor]) setThemeKey(savedColor);

    // 監聽用戶活動，1分鐘無操作進入休眠
    const resetIdle = () => {
      setIsActive(true);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIsActive(false), 60000);
    };
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    resetIdle();
    return () => { window.removeEventListener("mousemove", resetIdle); window.removeEventListener("touchstart", resetIdle); };
  },[]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("aero_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // 動態套用 MD3 色彩變數
  useEffect(() => {
    const root = document.documentElement;
    const t = THEMES[themeKey];
    root.style.setProperty("--md-primary", t.primary);
    root.style.setProperty("--md-on-primary", t.onPrimary);
    root.style.setProperty("--md-primary-container", t.primaryContainer);
    root.style.setProperty("--md-on-primary-container", t.onPrimaryContainer);
    localStorage.setItem("aero_color", themeKey);
  }, [themeKey]);

  useEffect(() => {
    if (auth && isActive) {
      fetchAllData();
      const interval = setInterval(() => pollStatus(), 15000); // 活躍時每 15 秒拉取一次
      return () => clearInterval(interval);
    }
  }, [auth, isActive]);

  const api = async (action: string, data: any = {}) => {
    try {
      return (await axios.post("/api", { action, auth, ...data })).data;
    } catch (err: any) {
      if (err.response?.status === 401) setAuth(null);
      throw err;
    }
  };

  const fetchAllData = async () => {
    const fetchedNodes = await api("GET_NODES");
    const nodesArray = Object.values(fetchedNodes);
    setNodes(nodesArray);
    const rulesMap: any = {};
    for (const n of nodesArray as any[]) rulesMap[n.id] = await api("GET_RULES", { nodeId: n.id });
    setAllRules(rulesMap);
  };

  const pollStatus = async () => {
    // 背景輪詢，只更新狀態不閃爍 UI
    const fetchedNodes = await api("GET_NODES");
    setNodes(Object.values(fetchedNodes));
  };

  if (!auth) return <LoginView setAuth={setAuth} />;

  return (
    <div className="min-h-screen bg-[#FBFDF8] dark:bg-[#111318] text-[#191C1A] dark:text-[#E2E2E5] pb-24 font-sans transition-colors duration-300">
      
      {/* 頂部導航 */}
      <header className="px-6 py-5 flex justify-between items-center sticky top-0 z-10 bg-[#FBFDF8]/80 dark:bg-[#111318]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AeroNode</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-[#F0F4EF] dark:bg-[#202522] active:scale-90 transition-all">
            {isDarkMode ? "🌞" : "🌙"}
          </button>
        </div>
      </header>

      {/* 休眠提示條 */}
      {!isActive && (
        <div className="mx-4 mt-4 p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 text-sm font-bold cursor-pointer" onClick={() => setIsActive(true)}>
          <PauseCircle className="w-5 h-5" /> 已暫停狀態同步以節省資源 (點擊恢復)
        </div>
      )}

      {/* 視圖切換 */}
      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {tab === "home" && <DashboardView nodes={nodes} allRules={allRules} />}
        {tab === "nodes" && <NodesView nodes={nodes} fetchAllData={fetchAllData} api={api} />}
        {tab === "rules" && <RulesView nodes={nodes} allRules={allRules} fetchAllData={fetchAllData} api={api} />}
        {tab === "me" && <MeView api={api} setAuth={setAuth} themeKey={themeKey} setThemeKey={setThemeKey} />}
      </main>

      {/* 底部導航欄 MD3 */}
      <nav className="fixed bottom-0 w-full bg-[#F4F8F4] dark:bg-[#191C1A] border-t border-gray-200/50 dark:border-white/5 px-2 py-3 flex justify-around items-center z-50">
        <NavItem icon={<Home className="w-6 h-6"/>} label="首頁" active={tab==="home"} onClick={()=>setTab("home")} />
        <NavItem icon={<Network className="w-6 h-6"/>} label="轉發" active={tab==="rules"} onClick={()=>setTab("rules")} />
        <NavItem icon={<Server className="w-6 h-6"/>} label="節點" active={tab==="nodes"} onClick={()=>setTab("nodes")} />
        <NavItem icon={<User className="w-6 h-6"/>} label="設定" active={tab==="me"} onClick={()=>setTab("me")} />
      </nav>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center flex-1 gap-1 group active:scale-95 transition-all">
      <div className={`px-5 py-1 rounded-full transition-all ${active ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'text-gray-500 hover:bg-gray-200/50 dark:hover:bg-white/5'}`}>
        {icon}
      </div>
      <span className={`text-[12px] font-medium ${active ? 'text-[var(--md-primary)] font-bold' : 'text-gray-500'}`}>{label}</span>
    </button>
  );
}

function LoginView({ setAuth }: any) {
  const [pwd, setPwd] = useState("");
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDF8] dark:bg-[#111318] p-6 text-gray-900 dark:text-white">
      <div className="w-full max-w-sm bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] space-y-8 animate-in fade-in zoom-in-95">
        <div className="text-center space-y-3">
          <Shield className="w-16 h-16 mx-auto text-[#006C4C]" />
          <h1 className="text-3xl font-bold">AeroNode</h1>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') axios.post("/api",{action:"LOGIN",password:pwd}).then(r=>{localStorage.setItem("aero_auth",r.data.token);setAuth(r.data.token)}).catch(()=>alert("密碼錯誤"))}} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none" placeholder="輸入管理密碼" />
      </div>
    </div>
  );
}

function DashboardView({ nodes, allRules }: any) {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[28px] text-center">
          <div className="text-sm text-gray-500">總節點</div>
          <div className="text-3xl font-bold text-[var(--md-primary)]">{nodes.length}</div>
        </div>
        <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[28px] text-center">
          <div className="text-sm text-gray-500">運行規則</div>
          <div className="text-3xl font-bold text-[var(--md-primary)]">{Object.values(allRules).flat().length}</div>
        </div>
      </div>
      {nodes.map((n: any) => (
        <div key={n.id} className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 relative">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold">{n.name}</h3>
              <p className="text-xs text-gray-500 font-mono">{n.ip}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${n.stats ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
              {n.stats ? '在線' : '離線'}
            </span>
          </div>
          {n.stats && <div className="text-sm text-gray-500">CPU 負載: {n.stats.cpu_load}%</div>}
        </div>
      ))}
    </div>
  );
}

function NodesView({ nodes, api, fetchAllData }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });

  return (
    <div className="space-y-6 animate-in fade-in">
      <button onClick={() => setShowAdd(!showAdd)} className="w-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] py-4 rounded-full font-bold active:scale-95 transition-all">
        + 添加新節點
      </button>

      {showAdd && (
        <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
          <p className="text-xs text-gray-500 mb-2">添加成功後，Agent會自動掃描伺服器現有規則並同步到面板。</p>
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="節點名稱" value={newNode.name} onChange={e=>setNewNode({...newNode,name:e.target.value})} />
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="公網 IP" value={newNode.ip} onChange={e=>setNewNode({...newNode,ip:e.target.value})} />
          <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="自訂 Token" value={newNode.token} onChange={e=>setNewNode({...newNode,token:e.target.value})} />
          {newNode.token && (
            <div className="p-4 bg-white dark:bg-[#111318] rounded-2xl">
              <span className="text-xs font-bold text-gray-500">安裝指令:</span>
              <code className="block text-xs text-[var(--md-primary)] break-all mt-1">curl -sSL {window.location.origin}/api/install | bash -s -- --token {newNode.token}</code>
            </div>
          )}
          <button onClick={async()=>{await api("ADD_NODE",{node:newNode});setShowAdd(false);fetchAllData();}} className="w-full py-4 bg-[var(--md-primary)] text-[var(--md-on-primary)] rounded-full font-bold">保存並連接</button>
        </div>
      )}

      {nodes.map((n: any) => (
         <div key={n.id} className="flex gap-2">
            <div className="flex-1 bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-3xl font-bold">{n.name}</div>
            <button onClick={async()=>{await api("SYNC_AGENT",{nodeId:n.id});alert("同步成功");fetchAllData()}} className="px-5 bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] rounded-3xl font-bold active:scale-95">同步</button>
            <button onClick={()=>{if(confirm("刪除？")) api("DELETE_NODE",{nodeId:n.id}).then(fetchAllData)}} className="px-5 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-3xl active:scale-95"><Trash2 className="w-5 h-5"/></button>
         </div>
      ))}
    </div>
  );
}

function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const rules = selected ? (allRules[selected] || []) :[];

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex overflow-x-auto gap-2 pb-2">
        {nodes.map((n:any)=><button key={n.id} onClick={()=>setSelected(n.id)} className={`px-6 py-2 rounded-full font-bold whitespace-nowrap ${selected===n.id?'bg-[var(--md-primary)] text-[var(--md-on-primary)]':'bg-[#F0F4EF] dark:bg-[#202522]'}`}>{n.name}</button>)}
      </div>

      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-[32px] space-y-4">
        <div className="flex justify-between items-center px-2">
          <span className="font-bold">轉發規則 (支援端口區間)</span>
          <button onClick={()=>{api("SAVE_RULES",{nodeId:selected,rules:[...rules,{listen_port:"1000-2000",dest_ip:"1.1.1.1",dest_port:"1000-2000",protocol:"tcp"}]}).then(fetchAllData)}} className="text-[var(--md-primary)] font-bold">+ 添加</button>
        </div>
        <p className="text-xs text-gray-500 px-2">支援單端口 `80` 或端口區間 `10000-20000`。</p>
        
        {rules.map((r:any, idx:number) => (
          <div key={idx} className="bg-white dark:bg-[#111318] p-4 rounded-[24px] flex flex-col md:flex-row gap-2">
            <input value={r.listen_port} onChange={e=>{const n=[...rules];n[idx].listen_port=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-1 bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm" placeholder="本地 1000-2000" />
            <input value={r.dest_ip} onChange={e=>{const n=[...rules];n[idx].dest_ip=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-[1.5] bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm" placeholder="目標 IP" />
            <input value={r.dest_port} onChange={e=>{const n=[...rules];n[idx].dest_port=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-1 bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm" placeholder="目標 1000-2000" />
            <select value={r.protocol} onChange={e=>{const n=[...rules];n[idx].protocol=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="bg-gray-50 dark:bg-[#202522] p-3 rounded-xl">
              <option value="tcp">TCP</option><option value="udp">UDP</option>
            </select>
            <button onClick={()=>{const n=[...rules];n.splice(idx,1);api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="p-3 text-red-500"><Trash2 className="w-5 h-5"/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeView({ setThemeKey, themeKey, setAuth }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Palette className="w-5 h-5"/> 面板主題配色</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(THEMES).map(([key, colors]) => (
            <button key={key} onClick={() => setThemeKey(key)} className={`h-12 rounded-2xl transition-all ${themeKey === key ? 'ring-4 ring-offset-2 dark:ring-offset-[#111318]' : ''}`} style={{ backgroundColor: colors.primary, borderColor: colors.primaryContainer }} />
          ))}
        </div>
      </div>
      <button onClick={() => { localStorage.removeItem("aero_auth"); setAuth(null); }} className="w-full flex justify-center py-4 text-red-500 bg-red-100 dark:bg-red-900/20 rounded-full font-bold">
        <LogOut className="w-5 h-5 mr-2" /> 退出登入
      </button>
    </div>
  );
}
