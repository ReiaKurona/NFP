"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
// 註釋掉二維碼依賴
// import { QRCodeSVG } from "qrcode.react";
//导入全局图标
import { 
  Shield, RefreshCw, Trash2, Home, Network, Server, User, LogOut, 
  Palette, PauseCircle, Download, Upload, KeyRound, Save, Terminal,
  Edit2,X,ChevronDown,Loader2,LayoutGrid, List as ListIcon, AlertCircle, 
  CheckCircle2, Copy,List,Plus,ArrowRight,Globe,Activity,Table2
} from "lucide-react";

const THEMES = {
  emerald: { primary: "#006C4C", onPrimary: "#FFFFFF", primaryContainer: "#89F8C7", onPrimaryContainer: "#002114" },
  ocean:   { primary: "#0061A4", onPrimary: "#FFFFFF", primaryContainer: "#D1E4FF", onPrimaryContainer: "#001D36" },
  lavender:{ primary: "#6750A4", onPrimary: "#FFFFFF", primaryContainer: "#EADDFF", onPrimaryContainer: "#21005D" },
  rose:    { primary: "#9C4146", onPrimary: "#FFFFFF", primaryContainer: "#FFDADA", onPrimaryContainer: "#40000A" }
};

export default function App() {
  const [auth, setAuth] = useState<string | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [tab, setTab] = useState<"home" | "rules" | "nodes" | "me">("home");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const[themeKey, setThemeKey] = useState<keyof typeof THEMES>("emerald");
  
  const [nodes, setNodes] = useState<any[]>([]);
  const [allRules, setAllRules] = useState<Record<string, any[]>>({});
  
  const [isActive, setIsActive] = useState(true);
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
    return () => { 
      window.removeEventListener("mousemove", resetIdle); 
      window.removeEventListener("touchstart", resetIdle); 
    };
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
      const interval = setInterval(() => {
        fetchAllData();
        api("KEEP_ALIVE"); 
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [auth, isActive, isFirstLogin]);

  const api = async (action: string, data: any = {}) => {
    try {
      return (await axios.post("/api", { action, auth, ...data })).data;
    } catch (err: any) {
      if (err.response?.status === 401) {
        setAuth(null);
        localStorage.removeItem("aero_auth");
      }
      throw err;
    }
  };

  const fetchAllData = async () => {
    try {
      const fetchedNodes = await api("GET_NODES");
      const nodesArray = Object.values(fetchedNodes);
      setNodes(nodesArray);
      
      const rulesMap: any = {};
      for (const n of nodesArray as any[]) {
        rulesMap[n.id] = await api("GET_RULES", { nodeId: n.id });
      }
      setAllRules(rulesMap);
    } catch (e) { console.error(e); }
  };

  if (!auth) return <LoginView setAuth={setAuth} setIsFirstLogin={setIsFirstLogin} />;

  return (
    <div className="min-h-screen bg-[#FBFDF8] dark:bg-[#111318] text-[#191C1A] dark:text-[#E2E2E5] pb-24 font-sans transition-colors duration-300 overflow-x-hidden">
      <AnimatePresence>
        {isFirstLogin && <ForcePasswordChange api={api} setAuth={setAuth} onComplete={() => setIsFirstLogin(false)} />}
      </AnimatePresence>

      <header className="px-6 py-5 flex justify-between items-center sticky top-0 z-10 bg-[#FBFDF8]/80 dark:bg-[#111318]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5">
        <motion.div className="flex items-center gap-3" whileTap={{ scale: 0.95 }}>
          <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--md-primary-container)', color: 'var(--md-on-primary-container)' }}>
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">AeroNode</h1>
        </motion.div>
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-full bg-[#F0F4EF] dark:bg-[#202522]">
          {isDarkMode ? "🌞" : "🌙"}
        </motion.button>
      </header>

      {!isActive && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 p-3 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2 text-sm font-bold cursor-pointer" onClick={() => setIsActive(true)}>
          <PauseCircle className="w-5 h-5" /> 點擊恢復實時狀態更新
        </motion.div>
      )}

      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
            {tab === "home" && <DashboardView nodes={nodes} allRules={allRules} />}
            {tab === "nodes" && <NodesView nodes={nodes} fetchAllData={fetchAllData} api={api} />}
            {tab === "rules" && <RulesView nodes={nodes} allRules={allRules} fetchAllData={fetchAllData} api={api} />}
            {tab === "me" && <MeView api={api} setAuth={setAuth} themeKey={themeKey} setThemeKey={setThemeKey} fetchAllData={fetchAllData} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 w-full bg-[#F4F8F4] dark:bg-[#191C1A] border-t border-gray-200/50 dark:border-white/5 px-2 py-3 flex justify-around items-center z-50 safe-area-pb">
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
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} className="flex flex-col items-center flex-1 gap-1 relative outline-none">
      <motion.div layout className={`px-5 py-1 rounded-full transition-colors ${active ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'text-gray-500'}`}>
        {icon}
      </motion.div>
      <span className={`text-[12px] font-medium ${active ? 'text-[var(--md-primary)] font-bold' : 'text-gray-500'}`}>{label}</span>
    </motion.button>
  );
}

function LoginView({ setAuth, setIsFirstLogin }: any) {
  const[pwd, setPwd] = useState("");
  const handleLogin = async () => {
    try {
      const res = await axios.post("/api", { action: "LOGIN", password: pwd });
      localStorage.setItem("aero_auth", res.data.token);
      setAuth(res.data.token);
      setIsFirstLogin(res.data.isFirstLogin);
    } catch { alert("❌ 密碼錯誤"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDF8] dark:bg-[#111318] p-6 text-gray-900 dark:text-white">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] space-y-8 shadow-xl">
        <div className="text-center space-y-3">
          <Shield className="w-16 h-16 mx-auto text-[#006C4C]" />
          <h1 className="text-3xl font-bold">AeroNode</h1>
          <p className="text-xs text-gray-500">請輸入管理密碼</p>
        </div>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="••••••••" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogin} className="w-full py-4 bg-[var(--md-primary)] text-[var(--md-on-primary)] rounded-full font-bold">登錄</motion.button>
      </motion.div>
    </div>
  );
}

function ForcePasswordChange({ api, setAuth, onComplete }: any) {
  const [pwd, setPwd] = useState("");
  const handleSave = async () => {
    if(pwd.length < 6) return alert("密碼太短，請至少輸入6位");
    const res = await api("CHANGE_PASSWORD", { newPassword: pwd });
    localStorage.setItem("aero_auth", res.token);
    setAuth(res.token);
    onComplete();
  };
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] w-full max-w-sm space-y-6 border border-red-500/30">
        <h2 className="text-2xl font-bold text-red-500 flex items-center gap-2"><KeyRound className="w-6 h-6"/> 安全警告</h2>
        <p className="text-sm">您正在使用默認密碼。為確保安全，請立即設置新密碼。</p>
        <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none" placeholder="輸入新密碼" />
        <motion.button whileTap={{ scale: 0.95 }} onClick={handleSave} className="w-full py-4 bg-red-500 text-white rounded-full font-bold">確認修改</motion.button>
      </motion.div>
    </div>
  );
}

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
      
      {nodes.map((n: any) => {
        const isOnline = n.lastSeen && (Date.now() - n.lastSeen < 60000);
        const ram = n.stats?.ram_usage || "0";
        const rx = n.stats?.rx_speed || "0 B/s";
        const tx = n.stats?.tx_speed || "0 B/s";
        const cpu = n.stats?.cpu_load || "0.0";

        return (
          <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">{n.name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{n.ip}</p>
              </div>
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${isOnline ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'bg-gray-300 dark:bg-gray-800 text-gray-500'}`}>
                {isOnline ? '在線' : '離線'}
              </span>
            </div>
            
            <div className="space-y-3 mb-6">
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>CPU 負載</span>
                        <span>{Math.min(parseFloat(cpu)*10, 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(parseFloat(cpu)*10, 100)}%` }}></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>內存使用</span>
                        <span>{ram}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${ram}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center">
                 <span className="text-xs text-gray-500 mb-1">↓ 下載速率</span>
                 <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">{rx}</span>
               </div>
               <div className="bg-white dark:bg-[#111318] py-4 rounded-2xl flex flex-col items-center justify-center">
                 <span className="text-xs text-gray-500 mb-1">↑ 上傳速率</span>
                 <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">{tx}</span>
               </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
//节点管理页面
function NodesView({ nodes, api, fetchAllData }: any) {
  // 視圖切換：預設讀取 localStorage
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('nodesViewMode') as 'card' | 'table' : 'card') || 'card';
  });

  // 統一對話框狀態
  type DialogConfig = {
    isOpen: boolean;
    type: 'error' | 'confirm' | 'install';
    title: string;
    message?: string;
    targetId?: string;
    installCmd?: string;
  };
  const[dialog, setDialog] = useState<DialogConfig>({ isOpen: false, type: 'error', title: '' });

  // 編輯與新增狀態：null 表示未編輯，index: -1 表示新增
  const [editing, setEditing] = useState<{ index: number; node: any } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // 底部居中氣泡提示狀態
  const [toast, setToast] = useState({ show: false, message: '' });

  const generateToken = () => Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('nodesViewMode', mode);
  };

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  };

  // 驗證 IP 或域名格式
  const validateIPOrDomain = (str: string) => {
    const ipv4 = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
    const domain = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return ipv4.test(str) || domain.test(str);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { node } = editing;

    if (!node.name.trim()) {
      setDialog({ isOpen: true, type: 'error', title: '保存失敗', message: '請填寫節點名稱' });
      return;
    }
    if (!node.ip.trim() || !validateIPOrDomain(node.ip.trim())) {
      setDialog({ isOpen: true, type: 'error', title: '保存失敗', message: '請填寫正確格式的公網 IP 或域名' });
      return;
    }

    setIsSaving(true);
    try {
      if (editing.index === -1) {
        await api("ADD_NODE", { node });
      } else {
        await api("EDIT_NODE", { node }); // 假設後端支持編輯接口
      }
      await fetchAllData();
      setEditing(null);
      showToast(editing.index === -1 ? "✅ 節點添加成功" : "✅ 節點保存成功");
    } catch (e: any) {
      setDialog({ isOpen: true, type: 'error', title: '保存失敗', message: e.message || '發生未知錯誤' });
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async (id: string) => {
    try {
      await api("DELETE_NODE", { nodeId: id });
      await fetchAllData();
      showToast("✅ 已成功刪除節點");
    } catch (e: any) {
      setDialog({ isOpen: true, type: 'error', title: '刪除失敗', message: e.message });
    }
  };

  const handleDialogConfirm = async () => {
    if (dialog.type === 'error' || dialog.type === 'install') {
      setDialog({ ...dialog, isOpen: false });
    } else if (dialog.type === 'confirm' && dialog.targetId) {
      await executeDelete(dialog.targetId);
      setDialog({ ...dialog, isOpen: false });
    }
  };

  const openInstallDialog = (n: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const installCmd = `curl -sSL ${origin}/api/install | bash -s -- --token ${n.token} --id ${n.id} --panel ${origin}`;
    setDialog({ isOpen: true, type: 'install', title: '獲取安裝指令', installCmd });
  };

  const copyInstallCmd = () => {
    if (dialog.installCmd) {
      navigator.clipboard.writeText(dialog.installCmd);
      showToast("已複製安裝指令");
    }
  };

  // 解決 Type Error：加入 as const 強制約束類型
  const springAnim = { type: "spring" as const, stiffness: 400, damping: 30 };

  return (
    <div className="space-y-6 relative">
      <div className="bg-[#F8FAF7] dark:bg-[#1A1D1B] p-5 rounded-[32px] space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[18px] text-[#191C1A] dark:text-white">節點管理</span>
            <div className="flex bg-[#E9EFE7] dark:bg-[#202522] p-1 rounded-full shadow-inner">
              <motion.button 
                whileTap={{ scale: 0.95 }} 
                onClick={() => handleViewModeChange('card')} 
                className={`px-3 py-1.5 rounded-full text-[13px] font-bold flex items-center gap-1.5 transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-[#3A3F3B] shadow-sm text-[#191C1A] dark:text-white' : 'text-gray-500'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5"/> 卡片
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.95 }} 
                onClick={() => handleViewModeChange('table')} 
                className={`px-3 py-1.5 rounded-full text-[13px] font-bold flex items-center gap-1.5 transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-[#3A3F3B] shadow-sm text-[#191C1A] dark:text-white' : 'text-gray-500'}`}
              >
                <List className="w-3.5 h-3.5"/> 表格
              </motion.button>
            </div>
          </div>
          
          <motion.button 
            whileTap={{ scale: 0.9 }} 
            onClick={() => setEditing({ index: -1, node: { name: "", ip: "", port: "8080", token: generateToken() } })} 
            className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-5 py-2.5 rounded-full text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4"/> 添加新節點
          </motion.button>
        </div>

        {nodes.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm font-bold flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#E9EFE7] dark:bg-[#202522] flex items-center justify-center">
              <Server className="w-8 h-8 text-gray-300 dark:text-gray-600"/>
            </div>
            暫無節點，請點擊上方按鈕添加
          </div>
        ) : (
          <>
            {/* 卡片視圖 */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {nodes.map((n: any, idx: number) => {
                    // 兼容儀表板判斷在線邏輯
                    const isOnline = n.lastSeen && (Date.now() - n.lastSeen < 60000);
                    
                    return (
                      <motion.div 
                        layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springAnim}
                        key={n.id} 
                        className="bg-white dark:bg-[#111318] p-5 rounded-[24px] shadow-sm border border-[#E9EFE7] dark:border-white/5 flex flex-col gap-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {/* 狀態指示點 */}
                              <span className="relative flex h-3 w-3">
                                {isOnline ? (
                                  <><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></>
                                ) : (
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-300 dark:bg-gray-600"></span>
                                )}
                              </span>
                              <span className="text-[18px] font-bold text-[#191C1A] dark:text-white line-clamp-1">{n.name}</span>
                            </div>
                            <div className="text-[13px] font-mono font-bold text-gray-500">{n.ip}</div>
                          </div>
                          <div className="flex bg-[#F8FAF7] dark:bg-white/5 rounded-2xl p-1">
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, node: { ...n } })} className="p-2 text-gray-500 hover:text-[var(--md-primary)] transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDialog({ isOpen: true, type: 'confirm', title: '刪除節點', message: `確定要刪除節點「${n.name}」嗎？此操作無法恢復。`, targetId: n.id })} className="p-2 text-red-400 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </div>
                        
                        <motion.button 
                          whileTap={{ scale: 0.95 }} 
                          onClick={() => openInstallDialog(n)}
                          className="w-full bg-[#F0F4EF] dark:bg-[#202522] hover:bg-[#E9EFE7] dark:hover:bg-white/10 transition-colors rounded-[16px] p-3 flex items-center justify-center gap-2 text-[13px] font-bold text-[#404943] dark:text-gray-300"
                        >
                          <Terminal className="w-4 h-4" /> 獲取安裝指令
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* 表格視圖 */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto bg-white dark:bg-[#111318] rounded-[24px] shadow-sm border border-[#E9EFE7] dark:border-white/5">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#E9EFE7] dark:border-white/5 text-[12px] text-gray-400 uppercase tracking-wider">
                      <th className="py-4 px-5 font-bold">狀態</th>
                      <th className="py-4 px-5 font-bold">節點名稱</th>
                      <th className="py-4 px-5 font-bold">公網 IP / 域名</th>
                      <th className="py-4 px-5 font-bold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n: any, idx: number) => {
                      const isOnline = n.lastSeen && (Date.now() - n.lastSeen < 60000);

                      return (
                        <tr key={n.id} className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-[#F8FAF7] dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-5">
                            <span className="relative flex h-3 w-3">
                              {isOnline ? (
                                <><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></>
                              ) : (
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-300 dark:bg-gray-600"></span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 px-5 font-bold text-[#404943] dark:text-gray-300">{n.name}</td>
                          <td className="py-3 px-5 font-mono text-[#191C1A] dark:text-white font-bold">{n.ip}</td>
                          <td className="py-3 px-5 flex justify-end gap-2">
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => openInstallDialog(n)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors" title="獲取指令">
                              <Terminal className="w-4 h-4" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, node: { ...n } })} className="p-2 text-[var(--md-primary)] hover:bg-[var(--md-primary-container)] rounded-full transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDialog({ isOpen: true, type: 'confirm', title: '刪除節點', message: `確定要刪除節點「${n.name}」嗎？此操作無法恢復。`, targetId: n.id })} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 編輯/新增節點 MD3 彈窗 */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 w-screen h-[100dvh]">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => !isSaving && setEditing(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={springAnim}
              className="relative w-full max-w-md bg-[#FBFDF7] dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[22px] font-bold text-[#191C1A] dark:text-white">
                  {editing.index === -1 ? "添加新節點" : "編輯節點"}
                </h3>
                <button onClick={() => !isSaving && setEditing(null)} className="p-2 bg-[#E9EFE7] dark:bg-white/10 rounded-full hover:scale-105 transition-transform text-gray-500 dark:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">節點名稱</label>
                  <input 
                    value={editing.node.name} 
                    onChange={e => setEditing({ ...editing, node: { ...editing.node, name: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-bold text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder="例如：香港-01" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">公網 IP 或域名</label>
                  <input 
                    value={editing.node.ip} 
                    onChange={e => setEditing({ ...editing, node: { ...editing.node, ip: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder="8.8.8.8 或 node.example.com" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">節點 Token (通訊密鑰)</label>
                  <div className="relative flex items-center bg-[#F0F4EF] dark:bg-[#202522] rounded-[20px] focus-within:ring-2 ring-[var(--md-primary)] transition-shadow">
                    <input 
                      value={editing.node.token} 
                      readOnly
                      className="w-full bg-transparent p-4 font-mono text-sm text-gray-500 dark:text-gray-400 outline-none" 
                    />
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setEditing({ ...editing, node: { ...editing.node, token: generateToken() } })}
                      className="absolute right-2 px-3 py-1.5 bg-white dark:bg-[#3A3F3B] shadow-sm rounded-xl text-xs font-bold text-[var(--md-primary)] hover:opacity-80"
                    >
                      重置
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setEditing(null)} disabled={isSaving}
                  className="flex-1 py-3.5 rounded-full font-bold text-[#404943] dark:text-gray-200 bg-[#E9EFE7] dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave} disabled={isSaving}
                  className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70 shadow-md shadow-[var(--md-primary)]/20"
                >
                  {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>保存中...</span></> : <span>保存</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 統一全局的 MD3 彈窗 (錯誤提示、確認、安裝指令) */}
      <AnimatePresence>
        {dialog.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 w-screen h-[100dvh]">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => !isSaving && setDialog({ ...dialog, isOpen: false })}
              className="absolute inset-0 bg-black/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 15 }} transition={springAnim}
              className="relative w-full max-w-sm bg-[#FBFDF7] dark:bg-[#111318] rounded-[28px] shadow-2xl flex flex-col p-6"
            >
              <h3 className="text-[22px] font-bold mb-4 text-[#191C1A] dark:text-[#E2E3DF]">
                {dialog.title}
              </h3>
              
              <div className="mb-6">
                {dialog.type === 'install' ? (
                  <div className="space-y-3">
                    <p className="text-[13px] font-medium text-[#404943] dark:text-gray-400">請在目標伺服器上執行以下指令：</p>
                    <motion.div 
                      whileTap={{ scale: 0.98 }}
                      onClick={copyInstallCmd}
                      className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] text-[13px] font-mono text-[var(--md-primary)] cursor-pointer hover:opacity-80 transition-opacity leading-relaxed break-all shadow-inner"
                    >
                      {dialog.installCmd}
                    </motion.div>
                  </div>
                ) : (
                  <p className="text-[14px] leading-relaxed text-[#404943] dark:text-[#C3C8C4] font-medium">
                    {dialog.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-auto">
                {dialog.type !== 'error' && (
                  <button 
                    disabled={isSaving} onClick={() => setDialog({ ...dialog, isOpen: false })} 
                    className="px-5 py-2.5 rounded-full text-sm font-bold text-[var(--md-primary)] hover:bg-[var(--md-primary)]/10 transition-colors disabled:opacity-50"
                  >
                    {dialog.type === 'install' ? '關閉' : '取消'}
                  </button>
                )}
                {dialog.type !== 'install' && (
                  <button 
                    disabled={isSaving} onClick={handleDialogConfirm} 
                    className="px-5 py-2.5 rounded-full text-sm font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70"
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin"/> 處理中...</> : '確定'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 居中氣泡提示 (Toast) - 完全符合淺/深色邏輯與手機 MD3 樣式 */}
      <AnimatePresence>
        {toast.show && (
          <div className="fixed bottom-12 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={springAnim}
              className="bg-[#FBFDF7] dark:bg-[#2A2F2C] text-[#191C1A] dark:text-[#E2E3DF] border border-black/5 dark:border-white/5 px-6 py-3.5 rounded-full shadow-lg font-bold text-[14px] tracking-wide flex items-center gap-2"
            >
              {toast.message}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

//規則編輯頁面
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, Trash2, X, ChevronDown, Loader2, LayoutGrid, List, Upload, Download, AlertCircle } from "lucide-react";

export default function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const [rules, setRules] = useState<any[]>([]);
  const[isSaving, setIsSaving] = useState(false);
  
  // 視圖切換：'card' 或 'table'
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // 編輯視窗狀態：index為-1表示新增，sourceNodeId表示原節點(用於跨節點轉移)
  const [editing, setEditing] = useState<{ index: number; sourceNodeId: string; targetNodeId: string; rule: any } | null>(null);
  const[isSelectOpen, setIsSelectOpen] = useState(false);
  const[isNodeSelectOpen, setIsNodeSelectOpen] = useState(false);

  // MD3 對話框狀態
  const[deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);
  
  // 批量導入導出狀態
  const[importExport, setImportExport] = useState<{ type: 'import' | 'export'; text: string } | null>(null);
  const [importReport, setImportReport] = useState<{ success: number; fails: string[] } | null>(null);

  useEffect(() => {
    if (selected) setRules(allRules[selected] || []);
  }, [selected, allRules]);

  const protocolOptions =[
    { label: "TCP", value: "tcp" },
    { label: "UDP", value: "udp" },
    { label: "TCP+UDP", value: "tcp,udp" },
  ];

  // ================= 規則合法性審查 =================
  const validateRule = (rule: any, targetRules: any[], excludeIdx: number = -1) => {
    if (!rule.listen_port || !rule.dest_ip || !rule.dest_port || !rule.protocol) return "有必填欄位為空";
    
    // 端口驗證 (支持數字和'-')
    const portRegex = /^(\d+)(-\d+)?$/;
    if (!portRegex.test(rule.listen_port)) return "本地端口格式非法（僅支持數字及'-'）";
    if (!portRegex.test(rule.dest_port)) return "目標端口格式非法（僅支持數字及'-'）";

    // 簡單拆分校驗區間邏輯
    const checkPortRange = (portStr: string) => {
      const parts = portStr.split('-');
      if (parts.length === 2 && parseInt(parts[0]) > parseInt(parts[1])) return false;
      return parts.every(p => parseInt(p) >= 0 && parseInt(p) <= 65535);
    };
    if (!checkPortRange(rule.listen_port)) return "本地端口數值超出範圍或區間無效";
    if (!checkPortRange(rule.dest_port)) return "目標端口數值超出範圍或區間無效";

    // IP/網域驗證 (不允許空格和特殊字符)
    const ipRegex = /^[a-zA-Z0-9.-:]+$/;
    if (!ipRegex.test(rule.dest_ip)) return "目標IP格式非法";

    // 查重驗證 (規則內容)
    const isDuplicate = targetRules.some((r, i) => i !== excludeIdx && r.listen_port === rule.listen_port && r.dest_ip === rule.dest_ip && r.dest_port === rule.dest_port && r.protocol === rule.protocol);
    if (isDuplicate) return "當前節點已存在完全相同的轉發規則";

    // 查重驗證 (自訂名稱)
    if (rule.name) {
      const isNameDuplicate = targetRules.some((r, i) => i !== excludeIdx && r.name === rule.name);
      if (isNameDuplicate) return "當前節點已存在相同名稱的規則";
    }

    return null; // 通過
  };

  // 生成默認名稱
  const generateAutoName = (targetRules: any[]) => {
    let maxNum = 0;
    targetRules.forEach(r => {
      const match = r.name?.match(/^新建規則(\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
    });
    return `新建規則${maxNum + 1}`;
  };

  // ================= 保存單條規則 =================
  const handleSave = async () => {
    if (!editing) return;

    const targetRules = allRules[editing.targetNodeId] || [];
    const sourceRules = allRules[editing.sourceNodeId] ||[];
    
    // 自動填充名稱
    let finalName = editing.rule.name?.trim();
    if (!finalName) finalName = generateAutoName(targetRules);
    
    const ruleToSave = { ...editing.rule, name: finalName };
    const excludeIdx = editing.sourceNodeId === editing.targetNodeId ? editing.index : -1;

    // 執行合法性審查
    const errMsg = validateRule(ruleToSave, targetRules, excludeIdx);
    if (errMsg) {
      setAlert({ title: "保存失敗", message: errMsg });
      return;
    }

    setIsSaving(true);
    try {
      if (editing.sourceNodeId === editing.targetNodeId) {
        // 同節點更新或新增
        const newRules = [...targetRules];
        if (editing.index === -1) newRules.push(ruleToSave);
        else newRules[editing.index] = ruleToSave;
        
        await api("SAVE_RULES", { nodeId: editing.targetNodeId, rules: newRules });
        if (editing.targetNodeId === selected) setRules(newRules);
      } else {
        // 跨節點轉移
        if (editing.index !== -1) {
          const newSourceRules = [...sourceRules];
          newSourceRules.splice(editing.index, 1);
          await api("SAVE_RULES", { nodeId: editing.sourceNodeId, rules: newSourceRules });
          if (editing.sourceNodeId === selected) setRules(newSourceRules);
        }
        const newTargetRules = [...targetRules, ruleToSave];
        await api("SAVE_RULES", { nodeId: editing.targetNodeId, rules: newTargetRules });
        if (editing.targetNodeId === selected) setRules(newTargetRules);
      }
      fetchAllData();
      setEditing(null);
    } catch (err) {
      setAlert({ title: "錯誤", message: "保存至伺服器時發生意外錯誤" });
    } finally {
      setIsSaving(false);
    }
  };

  // ================= 刪除規則 =================
  const confirmDelete = async () => {
    if (deleteConfirm === null) return;
    const newRules = [...rules];
    newRules.splice(deleteConfirm, 1);
    setRules(newRules);
    await api("SAVE_RULES", { nodeId: selected, rules: newRules });
    fetchAllData();
    setDeleteConfirm(null);
  };

  // ================= 批量導入導出 =================
  const handleExport = () => {
    const text = rules.map(r => `${r.name ? r.name + ' ' : ''}${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join('\n');
    setImportExport({ type: 'export', text });
  };

  const handleImportSubmit = async () => {
    if (!importExport) return;
    const lines = importExport.text.split('\n').filter(l => l.trim() !== '');
    
    let successCount = 0;
    let fails: string[] =[];
    let failedLinesText: string[] = [];
    let currentRules = [...rules];

    lines.forEach((line, i) => {
      const parts = line.split('|');
      if (parts.length < 4) {
        fails.push(`第 ${i+1} 行: 格式錯誤，缺少 '|' 分隔`);
        failedLinesText.push(line);
        return;
      }
      const protocol = parts.pop()!.trim().toLowerCase();
      const dest_port = parts.pop()!.trim();
      const dest_ip = parts.pop()!.trim();
      const firstPart = parts.join('|').trim();

      let name = "";
      let listen_port = "";
      const spaceParts = firstPart.split(' ');
      if (spaceParts.length === 1) {
        listen_port = spaceParts[0];
      } else {
        listen_port = spaceParts.pop()!;
        name = spaceParts.join(' ').trim();
      }

      const parsedRule = { name, listen_port, dest_ip, dest_port, protocol };
      
      if (!parsedRule.name) parsedRule.name = generateAutoName(currentRules);

      const errMsg = validateRule(parsedRule, currentRules, -1);
      if (errMsg) {
        fails.push(`第 ${i+1} 行: ${errMsg}`);
        failedLinesText.push(line);
      } else {
        successCount++;
        currentRules.push(parsedRule);
      }
    });

    // 嘗試保存正確項目
    if (successCount > 0) {
      setRules(currentRules);
      await api("SAVE_RULES", { nodeId: selected, rules: currentRules });
      fetchAllData();
    }

    if (fails.length > 0) {
      // 替換為僅保留錯誤的行，方便用戶修改
      setImportExport({ type: 'import', text: failedLinesText.join('\n') });
      setImportReport({ success: successCount, fails });
    } else {
      setImportExport(null);
      setAlert({ title: "導入成功", message: `成功導入 ${successCount} 條規則` });
    }
  };

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  return (
    <div className="space-y-6">
      {/* 頂部控制欄：節點選擇與工具視圖切換 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex overflow-x-auto gap-2 hide-scrollbar max-w-full pb-2 sm:pb-0">
          {nodes.map((n: any) => (
            <motion.button 
              whileTap={{ scale: 0.95 }} 
              key={n.id} 
              onClick={() => setSelected(n.id)} 
              className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-colors shadow-sm ${selected === n.id ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-white dark:bg-[#202522] text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
            >
              {n.name}
            </motion.button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 bg-white dark:bg-[#202522] p-1.5 rounded-full shadow-sm">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewMode('card')} className={`p-2 rounded-full ${viewMode === 'card' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}>
            <LayoutGrid className="w-4 h-4" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewMode('table')} className={`p-2 rounded-full ${viewMode === 'table' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}>
            <List className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* 內容區塊 */}
      <div className="bg-[#F4F5F0] dark:bg-[#1A1C19] p-5 sm:p-6 rounded-[32px] space-y-6 shadow-inner relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <div className="space-y-1">
             <span className="font-black text-xl text-gray-800 dark:text-gray-100">轉發規則</span>
             <p className="text-xs font-bold text-gray-500">管理 {nodes.find((n:any)=>n.id===selected)?.name} 節點的端口轉發</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setImportExport({ type: 'import', text: '' })} className="text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-[#202522] px-4 py-2.5 rounded-full text-sm flex items-center gap-1.5 shadow-sm hover:shadow">
              <Upload className="w-4 h-4" /> 導入
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleExport} className="text-gray-600 dark:text-gray-300 font-bold bg-white dark:bg-[#202522] px-4 py-2.5 rounded-full text-sm flex items-center gap-1.5 shadow-sm hover:shadow">
              <Download className="w-4 h-4" /> 導出
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: -1, sourceNodeId: selected, targetNodeId: selected, rule: { name: "", listen_port: "", dest_ip: "", dest_port: "", protocol: "tcp" } })} className="text-[var(--md-on-primary)] font-bold bg-[var(--md-primary)] px-5 py-2.5 rounded-full text-sm flex items-center gap-1.5 shadow-md shadow-[var(--md-primary)]/20 hover:opacity-95">
              <span className="text-lg leading-none">+</span> 添加規則
            </motion.button>
          </div>
        </div>
        
        {/* 卡片視圖 */}
        {viewMode === 'card' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {rules.map((r: any, idx: number) => (
                <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} key={`${r.listen_port}-${r.dest_port}-${idx}`} className="bg-white dark:bg-[#111318] p-5 rounded-[28px] shadow-sm border border-transparent hover:border-[var(--md-primary)]/20 transition-all flex flex-col justify-between min-h-[140px]">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-full text-xs font-black text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{r.name}</span>
                      <div className="px-2.5 py-1 rounded-lg bg-[var(--md-primary-container)] text-[var(--md-primary)] text-xs font-black uppercase tracking-wider">
                        {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-800 dark:text-gray-200 break-all">
                      <span className="text-xl font-mono font-black">{r.listen_port}</span>
                      <span className="text-gray-400 font-black">→</span>
                      <div className="flex flex-col">
                         <span className="text-sm font-bold text-gray-500">{r.dest_ip}</span>
                         <span className="text-lg font-mono font-bold">:{r.dest_port}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-50 dark:border-white/5">
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => setEditing({ index: idx, sourceNodeId: selected, targetNodeId: selected, rule: { ...r } })} className="p-2.5 bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-300 rounded-full hover:bg-[var(--md-primary-container)] hover:text-[var(--md-primary)] transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => setDeleteConfirm(idx)} className="p-2.5 bg-red-50 text-red-500 dark:bg-red-900/10 dark:text-red-400 rounded-full hover:bg-red-100 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* 表格視圖 */}
        {viewMode === 'table' && rules.length > 0 && (
          <div className="bg-white dark:bg-[#111318] rounded-[28px] overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
                      <th className="p-4 font-bold text-gray-500 text-sm">自訂名稱</th>
                      <th className="p-4 font-bold text-gray-500 text-sm">本地端口</th>
                      <th className="p-4 font-bold text-gray-500 text-sm">目標 IP:端口</th>
                      <th className="p-4 font-bold text-gray-500 text-sm">協議</th>
                      <th className="p-4 font-bold text-gray-500 text-sm text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {rules.map((r: any, idx: number) => (
                        <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={`${r.listen_port}-${r.dest_port}-${idx}`} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]">
                          <td className="p-4 font-bold text-sm text-gray-700 dark:text-gray-300">{r.name}</td>
                          <td className="p-4 font-mono font-bold">{r.listen_port}</td>
                          <td className="p-4 font-mono font-bold text-sm">{r.dest_ip}:{r.dest_port}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg bg-[var(--md-primary-container)] text-[var(--md-primary)] text-xs font-black uppercase tracking-wider">
                               {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                            </span>
                          </td>
                          <td className="p-4 flex justify-end gap-2">
                             <motion.button whileTap={{ scale: 0.85 }} onClick={() => setEditing({ index: idx, sourceNodeId: selected, targetNodeId: selected, rule: { ...r } })} className="p-2 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 rounded-xl">
                               <Edit2 className="w-4 h-4" />
                             </motion.button>
                             <motion.button whileTap={{ scale: 0.85 }} onClick={() => setDeleteConfirm(idx)} className="p-2 bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400 rounded-xl">
                               <Trash2 className="w-4 h-4" />
                             </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {rules.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center justify-center opacity-50">
            <LayoutGrid className="w-16 h-16 mb-4 text-gray-400" />
            <p className="font-bold text-lg">暫無規則</p>
            <p className="text-sm mt-1">請點擊右上方按鈕添加或導入</p>
          </div>
        )}
      </div>

      {/* ================= MD3 彈出層區域 ================= */}
      <AnimatePresence>
        {/* 編輯/添加規則視窗 (移除 overflow-hidden 避免選單被裁切) */}
        {editing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSaving && setEditing(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col z-10">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black">{editing.index === -1 ? "添加轉發規則" : "編輯轉發規則"}</h3>
                  <button onClick={() => !isSaving && setEditing(null)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:scale-105 transition-transform"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  {/* 自訂名稱 */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-500 ml-1">自訂名稱 (選填)</label>
                    <input value={editing.rule.name || ""} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, name: e.target.value } })} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] font-bold text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="留空將自動分配編號" />
                  </div>
                  
                  {/* 所屬節點分配 */}
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-bold text-gray-500 ml-1">所屬節點</label>
                    <div onClick={() => setIsNodeSelectOpen(!isNodeSelectOpen)} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow">
                      <span>{nodes.find((n:any)=>n.id===editing.targetNodeId)?.name || "選擇節點"}</span>
                      <motion.div animate={{ rotate: isNodeSelectOpen ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
                    </div>
                    <AnimatePresence>
                      {isNodeSelectOpen && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[20px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[110]">
                          {nodes.map((n:any) => (
                            <div key={n.id} onClick={() => { setEditing({ ...editing, targetNodeId: n.id }); setIsNodeSelectOpen(false); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.targetNodeId === n.id ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                              {n.name}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 端口與IP */}
                  <div className="flex gap-4">
                    <div className="space-y-1.5 flex-1">
                      <label className="text-sm font-bold text-gray-500 ml-1">本地端口/區間</label>
                      <input value={editing.rule.listen_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, listen_port: e.target.value } })} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="例如 8080 或 1000-2000" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <label className="text-sm font-bold text-gray-500 ml-1">目標端口/區間</label>
                      <input value={editing.rule.dest_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_port: e.target.value } })} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="必須與本地對應" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-500 ml-1">目標 IP 或 網域</label>
                    <input value={editing.rule.dest_ip} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_ip: e.target.value } })} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="192.168.1.1" />
                  </div>

                  {/* 協議選擇 (不受 overflow 裁切) */}
                  <div className="space-y-1.5 relative">
                    <label className="text-sm font-bold text-gray-500 ml-1">轉發協議</label>
                    <div onClick={() => setIsSelectOpen(!isSelectOpen)} className="w-full bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[20px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow">
                      <span>{protocolOptions.find(o => o.value === editing.rule.protocol)?.label || "選擇協議"}</span>
                      <motion.div animate={{ rotate: isSelectOpen ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
                    </div>
                    <AnimatePresence>
                      {isSelectOpen && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-[#2a2f2c] rounded-[20px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[110]">
                          {protocolOptions.map(o => (
                            <div key={o.value} onClick={() => { setEditing({ ...editing, rule: { ...editing.rule, protocol: o.value } }); setIsSelectOpen(false); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.rule.protocol === o.value ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                              {o.label}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex gap-3">
                <button onClick={() => setEditing(null)} disabled={isSaving} className="flex-1 py-4 rounded-full font-bold bg-[#F4F5F0] text-gray-700 dark:text-gray-200 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50">取消</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70">
                  {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>保存中</span></> : <span>保存</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 刪除確認視窗 */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-[#111318] rounded-[28px] p-6 shadow-2xl z-10 text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4"><Trash2 className="w-6 h-6" /></div>
              <h3 className="text-xl font-black mb-2">確認刪除規則？</h3>
              <p className="text-gray-500 text-sm font-bold mb-6">此操作將無法撤銷，確定要繼續嗎？</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 rounded-full font-bold bg-gray-100 dark:bg-white/5">取消</button>
                <button onClick={confirmDelete} className="flex-1 py-3 rounded-full font-bold bg-red-500 text-white hover:bg-red-600">確認刪除</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 導入/導出編輯視窗 */}
        {importExport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setImportExport(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white dark:bg-[#111318] rounded-[32px] p-6 shadow-2xl z-10 flex flex-col max-h-[90vh]">
              <h3 className="text-2xl font-black mb-2">{importExport.type === 'import' ? '批量導入規則' : '批量導出規則'}</h3>
              <p className="text-xs font-bold text-gray-500 mb-4">格式: <code className="bg-gray-100 dark:bg-white/10 px-1 rounded">自訂名稱(可選) 本地端口|目標IP|目標端口|協議</code> (一行一條)</p>
              <textarea 
                value={importExport.text} 
                onChange={e => setImportExport({ ...importExport, text: e.target.value })}
                readOnly={importExport.type === 'export'}
                className="w-full flex-1 min-h-[300px] bg-[#F4F5F0] dark:bg-[#202522] p-4 rounded-[24px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] resize-none whitespace-pre overflow-auto"
                placeholder="例如:&#10;Web轉發 80|192.168.1.2|8080|tcp&#10;8080-8090|10.0.0.1|8080-8090|tcp,udp"
              />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setImportExport(null)} className="px-6 py-3 rounded-full font-bold bg-gray-100 dark:bg-white/5">關閉</button>
                {importExport.type === 'import' && (
                  <button onClick={handleImportSubmit} className="px-6 py-3 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90">解析並導入</button>
                )}
                {importExport.type === 'export' && (
                  <button onClick={() => { navigator.clipboard.writeText(importExport.text); setAlert({ title: "已複製", message: "配置已複製到剪貼板" }); }} className="px-6 py-3 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90">複製全部</button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* 導入結果報告視窗 */}
        {importReport && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white dark:bg-[#111318] rounded-[32px] p-6 shadow-2xl z-10 flex flex-col">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <AlertCircle className="w-8 h-8" />
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">導入報告</h3>
              </div>
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-4">
                檢測到 <span className="text-[var(--md-primary)]">{importReport.success + importReport.fails.length}</span> 條規則，
                成功導入並保存 <span className="text-green-500">{importReport.success}</span> 條，
                失敗 <span className="text-red-500">{importReport.fails.length}</span> 條。
              </p>
              <div className="bg-[#F4F5F0] dark:bg-[#202522] rounded-[20px] p-4 max-h-[200px] overflow-y-auto mb-6">
                <p className="text-xs font-bold text-gray-500 mb-2">失敗原因：</p>
                <ul className="space-y-1.5">
                  {importReport.fails.map((f, i) => (
                     <li key={i} className="text-xs font-mono text-red-500 dark:text-red-400 break-words">{f}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setImportReport(null); setImportExport(null); }} className="flex-1 py-3 rounded-full font-bold bg-gray-100 dark:bg-white/5">取消</button>
                <button onClick={() => setImportReport(null)} className="flex-1 py-3 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)]">返回編輯區</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 通用 Alert / 錯誤提示視窗 */}
        {alert && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-[#111318] rounded-[28px] p-6 shadow-2xl z-10 text-center">
              <h3 className="text-xl font-black mb-2">{alert.title}</h3>
              <p className="text-gray-500 text-sm font-bold mb-6">{alert.message}</p>
              <button onClick={() => setAlert(null)} className="w-full py-3 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90">確認</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
//设置页面
function MeView({ setThemeKey, themeKey, setAuth, api, fetchAllData }: any) {
  const [pwd, setPwd] = useState("");

  const handleExport = async () => {
    const data = await api("EXPORT_ALL");
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `aero_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
        <h3 className="font-bold flex items-center gap-2"><KeyRound className="w-5 h-5"/> 登錄密碼修改</h3>
        <div className="flex gap-2">
          <input type="password" placeholder="輸入新密碼" value={pwd} onChange={e=>setPwd(e.target.value)} className="flex-1 bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none" />
          <motion.button whileTap={{ scale: 0.95 }} onClick={async ()=>{if(pwd.length<6)return alert("密碼太短"); const res=await api("CHANGE_PASSWORD",{newPassword:pwd}); setAuth(res.token); localStorage.setItem("aero_auth",res.token); alert("密碼已修改"); setPwd("");}} className="px-6 bg-[var(--md-primary)] text-[var(--md-on-primary)] font-bold rounded-2xl">修改</motion.button>
        </div>
      </div>

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
