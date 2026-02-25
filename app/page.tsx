"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Shield, Save, RefreshCw, Trash2, Home, Network, User, LogOut, Terminal, Palette, PauseCircle, Server, Download, Upload, KeyRound, Smartphone } from "lucide-react";

const THEMES = {
  emerald: { primary: "#006C4C", onPrimary: "#FFFFFF", primaryContainer: "#89F8C7", onPrimaryContainer: "#002114" },
  ocean:   { primary: "#0061A4", onPrimary: "#FFFFFF", primaryContainer: "#D1E4FF", onPrimaryContainer: "#001D36" },
  lavender:{ primary: "#6750A4", onPrimary: "#FFFFFF", primaryContainer: "#EADDFF", onPrimaryContainer: "#21005D" },
  rose:    { primary: "#9C4146", onPrimary: "#FFFFFF", primaryContainer: "#FFDADA", onPrimaryContainer: "#40000A" }
};

export default function App() {
  const[auth, setAuth] = useState<string | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [tab, setTab] = useState<"home" | "rules" | "nodes" | "me">("home");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [themeKey, setThemeKey] = useState<keyof typeof THEMES>("emerald");
  
  const [nodes, setNodes] = useState<any[]>([]);
  const[allRules, setAllRules] = useState<Record<string, any[]>>({});
  
  const[isActive, setIsActive] = useState(true);
  const idleTimer = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("aero_auth");
    if (token) setAuth(token);
    if (localStorage.getItem("aero_theme") === "light") setIsDarkMode(false);
    const savedColor = localStorage.getItem("aero_color") as keyof typeof THEMES;
    if (savedColor && THEMES[savedColor]) setThemeKey(savedColor);

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
  },[isDarkMode]);

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
    if (auth && isActive && !isFirstLogin) {
      fetchAllData();
      const interval = setInterval(() => pollStatus(), 15000);
      return () => clearInterval(interval);
    }
  }, [auth, isActive, isFirstLogin]);

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
    for (const n of nodes) await api("POLL_STATUS", { nodeId: n.id }).catch(()=>{});
    const fetchedNodes = await api("GET_NODES");
    setNodes(Object.values(fetchedNodes));
  };

  if (!auth) return <LoginView setAuth={setAuth} setIsFirstLogin={setIsFirstLogin} />;

  return (
    <div className="min-h-screen bg-[#FBFDF8] dark:bg-[#111318] text-[#191C1A] dark:text-[#E2E2E5] pb-24 font-sans transition-colors duration-300 overflow-x-hidden">
      
      {/* 首次登錄強制修改密碼彈窗 */}
      <AnimatePresence>
        {isFirstLogin && <ForcePasswordChange api={api} setAuth={setAuth} onComplete={() => setIsFirstLogin(false)} />}
      </AnimatePresence>

      {/* 頂部導航 */}
      <header className="px-6 py-5 flex justify-between items-center sticky top-0 z-10 bg-[#FBFDF8]/80 dark:bg-[#111318]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5">
        <motion.div className="flex items-center gap-3" whileTap={{ scale: 0.95 }}>
          <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AeroNode</h1>
        </motion.div>
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.8 }} onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-[#F0F4EF] dark:bg-[#202522]">
            {isDarkMode ? "🌞" : "🌙"}
          </motion.button>
        </div>
      </header>

      {!isActive && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 text-sm font-bold cursor-pointer" onClick={() => setIsActive(true)}>
          <PauseCircle className="w-5 h-5" /> 點擊恢復實時狀態更新
        </motion.div>
      )}

      {/* MD3 頁面切換動畫 */}
      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            {tab === "home" && <DashboardView nodes={nodes} allRules={allRules} />}
            {tab === "nodes" && <NodesView nodes={nodes} fetchAllData={fetchAllData} api={api} />}
            {tab === "rules" && <RulesView nodes={nodes} allRules={allRules} fetchAllData={fetchAllData} api={api} />}
            {tab === "me" && <MeView api={api} setAuth={setAuth} themeKey={themeKey} setThemeKey={setThemeKey} fetchAllData={fetchAllData} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 底部導航欄 */}
      <nav className="fixed bottom-0 w-full bg-[#F4F8F4] dark:bg-[#191C1A] border-t border-gray-200/50 dark:border-white/5 px-2 py-3 flex justify-around items-center z-50">
        <NavItem icon={<Home className="w-6 h-6"/>} label="首頁" active={tab==="home"} onClick={()=>setTab("home")} />
        <NavItem icon={<Network className="w-6 h-6"/>} label="轉發" active={tab==="rules"} onClick={()=>setTab("rules")} />
        <NavItem icon={<Server className="w-6 h-6"/>} label="節點" active={tab==="nodes"} onClick={()=>setTab("nodes")} />
        <NavItem icon={<User className="w-6 h-6"/>} label="設定" active={tab==="me"} onClick={()=>setTab("me")} />
      </nav>
    </div>
  );
}

// 導航按鈕動畫
function NavItem({ icon, label, active, onClick }: any) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} className="flex flex-col items-center flex-1 gap-1 relative">
      <motion.div layout className={`px-5 py-1 rounded-full ${active ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'text-gray-500'}`}>
        {icon}
      </motion.div>
      <span className={`text-[12px] font-medium ${active ? 'text-[var(--md-primary)] font-bold' : 'text-gray-500'}`}>{label}</span>
    </motion.button>
  );
}

// 登錄視圖 (支援 2FA 或 密碼)
function LoginView({ setAuth, setIsFirstLogin }: any) {
  const [pwd, setPwd] = useState("");
  const handleLogin = async () => {
    try {
      const res = await axios.post("/api", { action: "LOGIN", password: pwd });
      localStorage.setItem("aero_auth", res.data.token);
      setAuth(res.data.token);
      setIsFirstLogin(res.data.isFirstLogin);
    } catch { alert("密碼或 2FA 驗證碼錯誤"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDF8] dark:bg-[#111318] p-6 text-gray-900 dark:text-white">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] space-y-8 shadow-xl">
        <div className="text-center space-y-3">
          <Shield className="w-16 h-16 mx-auto text-[#006C4C]" />
          <h1 className="text-3xl font-bold">AeroNode</h1>
          <p className="text-xs text-gray-500">輸入密碼 或 6位數2FA驗證碼</p>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="••••••••" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogin} className="w-full py-4 bg-[var(--md-primary)] text-[var(--md-on-primary)] rounded-full font-bold">登錄</motion.button>
      </motion.div>
    </div>
  );
}

// 首次登錄強制修改密碼
function ForcePasswordChange({ api, setAuth, onComplete }: any) {
  const [pwd, setPwd] = useState("");
  const handleSave = async () => {
    if(pwd.length < 6) return alert("密碼太短");
    const res = await api("CHANGE_PASSWORD", { newPassword: pwd });
    localStorage.setItem("aero_auth", res.token);
    setAuth(res.token);
    onComplete();
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] w-full max-w-sm space-y-6">
        <h2 className="text-2xl font-bold text-red-500">安全警告</h2>
        <p className="text-sm">您正在使用默認密碼，為保證面板安全，請立即修改密碼！</p>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none" placeholder="輸入新密碼" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} className="w-full py-4 bg-red-500 text-white rounded-full font-bold">確認修改並進入面板</motion.button>
      </motion.div>
    </div>
  );
}

// 儀表盤視圖 (完整回歸：四宮格流量統計)
function DashboardView({ nodes, allRules }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <motion.div whileHover={{ scale: 1.02 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[28px] text-center">
          <div className="text-sm text-gray-500">總節點</div>
          <div className="text-3xl font-bold text-[var(--md-primary)]">{nodes.length}</div>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[28px] text-center">
          <div className="text-sm text-gray-500">運行規則</div>
          <div className="text-3xl font-bold text-[var(--md-primary)]">{Object.values(allRules).flat().length}</div>
        </motion.div>
      </div>
      
      {nodes.map((n: any) => (
        <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold">{n.name}</h3>
              <p className="text-xs text-gray-500 font-mono mt-1">{n.ip}</p>
            </div>
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${n.stats ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'bg-gray-300 dark:bg-gray-700 text-gray-600'}`}>
              {n.stats ? '在線' : '離線'}
            </span>
          </div>
          
          {/* 回歸：流量數據網格 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 mb-1">↑ 上傳速率</span>
              <span className="font-mono text-sm font-bold">{n.stats?.tx_speed || "0 B/s"}</span>
            </div>
            <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 mb-1">↓ 下載速率</span>
              <span className="font-mono text-sm font-bold">{n.stats?.rx_speed || "0 B/s"}</span>
            </div>
            <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center border border-blue-500/20">
              <span className="text-xs text-blue-400 mb-1">↑ 總上行流量</span>
              <span className="font-mono text-sm font-bold text-blue-500">{n.stats?.tx_total || "0 GB"}</span>
            </div>
            <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center border border-emerald-500/20">
              <span className="text-xs text-emerald-400 mb-1">↓ 總下行流量</span>
              <span className="font-mono text-sm font-bold text-emerald-500">{n.stats?.rx_total || "0 GB"}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// 節點視圖
function NodesView({ nodes, api, fetchAllData }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const[newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });

  return (
    <div className="space-y-6">
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(!showAdd)} className="w-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] py-4 rounded-full font-bold">
        + 添加新節點
      </motion.button>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4 overflow-hidden">
            <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="節點名稱" value={newNode.name} onChange={e=>setNewNode({...newNode,name:e.target.value})} />
            <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="公網 IP" value={newNode.ip} onChange={e=>setNewNode({...newNode,ip:e.target.value})} />
            <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" placeholder="自訂 Token" value={newNode.token} onChange={e=>setNewNode({...newNode,token:e.target.value})} />
            {newNode.token && (
              <div className="p-4 bg-white dark:bg-[#111318] rounded-2xl">
                <span className="text-xs font-bold text-gray-500">一鍵安裝指令:</span>
                <code className="block text-xs text-[var(--md-primary)] break-all mt-1">curl -sSL {window.location.origin}/api/install | bash -s -- --token {newNode.token}</code>
              </div>
            )}
            <motion.button whileTap={{ scale: 0.95 }} onClick={async()=>{await api("ADD_NODE",{node:newNode});setShowAdd(false);fetchAllData();}} className="w-full py-4 bg-[var(--md-primary)] text-[var(--md-on-primary)] rounded-full font-bold">保存並連接</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {nodes.map((n: any) => (
         <motion.div layout key={n.id} className="flex gap-2">
            <div className="flex-1 bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-3xl font-bold flex items-center">{n.name}</div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={async()=>{await api("SYNC_AGENT",{nodeId:n.id});alert("同步成功");fetchAllData()}} className="px-5 bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] rounded-3xl font-bold"><RefreshCw className="w-5 h-5"/></motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={()=>{if(confirm("刪除？")) api("DELETE_NODE",{nodeId:n.id}).then(fetchAllData)}} className="px-5 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-3xl"><Trash2 className="w-5 h-5"/></motion.button>
         </motion.div>
      ))}
    </div>
  );
}

// 規則視圖
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const rules = selected ? (allRules[selected] || []) :[];

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {nodes.map((n:any)=><motion.button whileTap={{ scale: 0.95 }} key={n.id} onClick={()=>setSelected(n.id)} className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap ${selected===n.id?'bg-[var(--md-primary)] text-[var(--md-on-primary)]':'bg-[#F0F4EF] dark:bg-[#202522]'}`}>{n.name}</motion.button>)}
      </div>

      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-[32px] space-y-4">
        <div className="flex justify-between items-center px-2">
          <span className="font-bold">轉發規則</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={()=>{api("SAVE_RULES",{nodeId:selected,rules:[...rules,{listen_port:"1000-2000",dest_ip:"1.1.1.1",dest_port:"1000-2000",protocol:"tcp"}]}).then(fetchAllData)}} className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-4 py-1.5 rounded-full text-sm">+ 添加</motion.button>
        </div>
        
        {rules.map((r:any, idx:number) => (
          <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={idx} className="bg-white dark:bg-[#111318] p-4 rounded-[24px] flex flex-col md:flex-row gap-2 shadow-sm">
            <input value={r.listen_port} onChange={e=>{const n=[...rules];n[idx].listen_port=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-1 bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm font-mono" placeholder="本地 1000-2000" />
            <input value={r.dest_ip} onChange={e=>{const n=[...rules];n[idx].dest_ip=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-[1.5] bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm font-mono" placeholder="目標 IP" />
            <input value={r.dest_port} onChange={e=>{const n=[...rules];n[idx].dest_port=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="flex-1 bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center text-sm font-mono" placeholder="目標 1000-2000" />
            <select value={r.protocol} onChange={e=>{const n=[...rules];n[idx].protocol=e.target.value;api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-sm font-bold">
              <option value="tcp">TCP</option><option value="udp">UDP</option>
            </select>
            <motion.button whileTap={{ scale: 0.8 }} onClick={()=>{const n=[...rules];n.splice(idx,1);api("SAVE_RULES",{nodeId:selected,rules:n}).then(fetchAllData)}} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl"><Trash2 className="w-5 h-5"/></motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// 我的設定 (回歸密碼修改、JSON備份、新增2FA)
function MeView({ setThemeKey, themeKey, setAuth, api, fetchAllData }: any) {
  const [pwd, setPwd] = useState("");
  const[is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    api("CHECK_2FA_STATUS").then((res: any) => setIs2FAEnabled(res.enabled));
  },[]);

  const handleEnable2FA = async () => {
    const res = await api("GENERATE_2FA");
    setQrData(res);
  };
  const handleVerify2FA = async () => {
    try {
      await api("VERIFY_AND_ENABLE_2FA", { code: totpCode, secret: qrData.secret });
      setIs2FAEnabled(true); setQrData(null); alert("綁定成功！");
    } catch { alert("驗證碼錯誤"); }
  };

  const handleExport = async () => {
    const data = await api("EXPORT_ALL");
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `aero_backup.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* 密碼與安全 */}
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5"/> 登錄密碼與安全</h3>
        <div className="flex gap-2">
          <input type="password" placeholder="輸入新密碼" value={pwd} onChange={e=>setPwd(e.target.value)} className="flex-1 bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={async ()=>{if(pwd.length<6)return alert("密碼太短"); const res=await api("CHANGE_PASSWORD",{newPassword:pwd}); setAuth(res.token); localStorage.setItem("aero_auth",res.token); alert("密碼已修改"); setPwd("");}} className="px-6 bg-[var(--md-primary)] text-[var(--md-on-primary)] font-bold rounded-2xl">修改</motion.button>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="font-bold flex items-center gap-2"><Smartphone className="w-5 h-5"/> 雙重驗證 (2FA)</p>
              <p className="text-xs text-gray-500 mt-1">啟用後可用6位數驗證碼秒登錄。若丟失可用原密碼登錄。</p>
            </div>
            {is2FAEnabled ? (
              <motion.button whileTap={{ scale: 0.95 }} onClick={async()=>{await api("DISABLE_2FA");setIs2FAEnabled(false);alert("已停用 2FA")}} className="px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm font-bold">停用</motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleEnable2FA} className="px-4 py-2 bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] rounded-full text-sm font-bold">綁定 2FA</motion.button>
            )}
          </div>
          
          <AnimatePresence>
            {qrData && !is2FAEnabled && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex flex-col items-center bg-white dark:bg-[#111318] p-4 rounded-2xl space-y-4 overflow-hidden">
                <p className="text-sm font-bold">使用 Google Authenticator 掃描：</p>
                <div className="bg-white p-2 rounded-xl"><QRCodeSVG value={qrData.otpauth} size={150} /></div>
                <div className="flex gap-2 w-full">
                  <input value={totpCode} onChange={e=>setTotpCode(e.target.value)} placeholder="輸入 6 位驗證碼" className="flex-1 bg-gray-50 dark:bg-[#202522] p-3 rounded-xl text-center tracking-widest font-mono" />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleVerify2FA} className="px-6 bg-[var(--md-primary)] text-[var(--md-on-primary)] font-bold rounded-xl">驗證</motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 備份與還原 */}
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Save className="w-5 h-5"/> 備份與還原</h3>
        <div className="flex gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] py-4 rounded-2xl font-bold">
            <Download className="w-5 h-5" /> 導出 JSON
          </motion.button>
          <motion.label whileTap={{ scale: 0.95 }} className="flex-1 flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 py-4 rounded-2xl font-bold cursor-pointer">
            <Upload className="w-5 h-5" /> 導入 JSON
            <input type="file" accept=".json" className="hidden" onChange={(e:any)=>{const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(ev:any)=>{if(confirm("將覆蓋所有資料？")) {await api("IMPORT_ALL",{backupData:JSON.parse(ev.target.result)}); alert("成功"); fetchAllData();}}; r.readAsText(f);}} />
          </motion.label>
        </div>
      </div>

      {/* 主題配色 */}
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><Palette className="w-5 h-5"/> 面板主題配色</h3>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(THEMES).map(([key, colors]) => (
            <motion.button whileTap={{ scale: 0.8 }} key={key} onClick={() => setThemeKey(key)} className={`h-12 rounded-2xl transition-all ${themeKey === key ? 'ring-4 ring-offset-2 dark:ring-offset-[#111318]' : ''}`} style={{ backgroundColor: colors.primary, borderColor: colors.primaryContainer }} />
          ))}
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.95 }} onClick={() => { localStorage.removeItem("aero_auth"); setAuth(null); }} className="w-full flex justify-center py-4 text-red-500 bg-red-100 dark:bg-red-900/20 rounded-full font-bold">
        <LogOut className="w-5 h-5 mr-2" /> 退出登入
      </motion.button>
    </div>
  );
}