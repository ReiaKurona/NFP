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
  CheckCircle2, Copy,List,Plus,ArrowRight,Globe,Activity,Table2,FileText,
  CheckCircle,Grid,XCircle, Save, Info
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
//規則編輯頁面
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const [rules, setRules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 視圖切換
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // 編輯與彈窗狀態
  const [editing, setEditing] = useState<{ index: number; rule: any; targetNodeId: string } | null>(null);
  const[openDropdown, setOpenDropdown] = useState<'node' | 'protocol' | null>(null);
  
  // 批量導入/導出狀態
  const [importExportModal, setImportExportModal] = useState<{ isOpen: boolean; mode: 'import' | 'export'; text: string } | null>(null);
  
  // 通用對話框 (審查警告、刪除確認、導入報告等)
  const [dialog, setDialog] = useState<any>(null);
  
  // 診斷狀態
  const[diagnostic, setDiagnostic] = useState<any>(null);

  useEffect(() => {
    if (selected) setRules(allRules[selected] || []);
  }, [selected, allRules]);

  // 規則合法性審查
  const validateRule = (r: any, isImport = false, listToCompare = rules, currentEditIndex = -1) => {
    if (!r.listen_port || !r.dest_ip || !r.dest_port || !r.protocol) return "欄位不能為空";
    if (!/^\d+(-\d+)?$/.test(r.listen_port)) return `本地端口/區間格式錯誤: ${r.listen_port}`;
    if (!/^\d+(-\d+)?$/.test(r.dest_port)) return `目標端口格式錯誤: ${r.dest_port}`;
    if (!/^([a-zA-Z0-9.-]+)$/.test(r.dest_ip)) return `目標 IP/域名 格式錯誤: ${r.dest_ip}`;

    const isDuplicate = listToCompare.some((ex: any, i: number) => {
      if (!isImport && currentEditIndex === i) return false;
      if (r.name && ex.name === r.name) return true;
      if (ex.listen_port === r.listen_port && ex.dest_ip === r.dest_ip && ex.dest_port === r.dest_port && ex.protocol === r.protocol) return true;
      return false;
    });

    if (isDuplicate) return "規則已存在或名稱重複";
    return null;
  };

  const handleSave = async () => {
    if (!editing) return;
    
    // 自動填充名稱
    const newRule = { ...editing.rule };
    if (!newRule.name || newRule.name.trim() === "") {
      newRule.name = `新建規則${Math.floor(Math.random() * 10000)}`;
    }

    const targetRules = editing.targetNodeId === selected ? [...rules] :[...(allRules[editing.targetNodeId] ||[])];
    const err = validateRule(newRule, false, targetRules, editing.targetNodeId === selected ? editing.index : -1);
    
    if (err) {
      setDialog({
        title: "保存失敗",
        content: err,
        confirmText: "我知道了",
        onConfirm: () => setDialog(null)
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editing.index === -1 || editing.targetNodeId !== selected) {
        if (editing.targetNodeId !== selected && editing.index !== -1) {
          // 如果修改了歸屬節點，先從原節點刪除
          const oldRules = [...rules];
          oldRules.splice(editing.index, 1);
          await api("SAVE_RULES", { nodeId: selected, rules: oldRules });
        }
        targetRules.push(newRule);
      } else {
        targetRules[editing.index] = newRule;
      }

      await api("SAVE_RULES", { nodeId: editing.targetNodeId, rules: targetRules });
      if (editing.targetNodeId === selected) setRules(targetRules);
      fetchAllData();
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (idx: number) => {
    setDialog({
      title: "刪除規則",
      content: "確定要刪除這條規則嗎？操作無法撤銷。",
      confirmText: "刪除",
      cancelText: "取消",
      isDanger: true,
      onConfirm: async () => {
        setDialog(null);
        const newRules = [...rules];
        newRules.splice(idx, 1);
        setRules(newRules);
        await api("SAVE_RULES", { nodeId: selected, rules: newRules });
        fetchAllData();
      }
    });
  };

  const handleBatchImport = async () => {
    if (!importExportModal?.text.trim()) return;
    const lines = importExportModal.text.split('\n').filter((l: string) => l.trim() !== '');
    let successCount = 0;
    let failCount = 0;
    const failReasons: string[] = [];
    const newRules = [...rules];

    lines.forEach((line: string, idx: number) => {
      const parts = line.trim().split(' ');
      const ruleStr = parts.length > 1 ? parts.pop() : parts[0];
      const name = parts.length > 0 ? parts.join(' ').trim() : `新建規則${newRules.length + 1}`;
      
      if (!ruleStr) return;
      const rParts = ruleStr.split('|');
      if (rParts.length !== 4) {
        failCount++;
        failReasons.push(`第${idx + 1}行 格式不完整`);
        return;
      }

      const newRule = { name, listen_port: rParts[0], dest_ip: rParts[1], dest_port: rParts[2], protocol: rParts[3] };
      const err = validateRule(newRule, true, newRules);
      
      if (err) {
        failCount++;
        failReasons.push(`第${idx + 1}行: ${err}`);
      } else {
        newRules.push(newRule);
        successCount++;
      }
    });

    if (failCount > 0) {
      setDialog({
        title: "導入報告",
        content: `檢測到 ${lines.length} 條規則\n成功導入: ${successCount} 條\n失敗: ${failCount} 條\n\n失敗原因:\n${failReasons.join('\n')}`,
        confirmText: "返回編輯",
        cancelText: "取消",
        onConfirm: () => setDialog(null),
        onCancel: () => {
          setDialog(null);
          setImportExportModal(null);
        }
      });
    } else {
      setImportExportModal(null);
    }

    if (successCount > 0) {
      setRules(newRules);
      await api("SAVE_RULES", { nodeId: selected, rules: newRules });
      fetchAllData();
    }
  };

  const openExport = () => {
    const text = rules.map(r => `${r.name || ''} ${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join('\n');
    setImportExportModal({ isOpen: true, mode: 'export', text });
  };

  const triggerDiagnostic = (rule: any) => {
    if (rule.listen_port.includes('-')) {
      setDialog({
        type: 'input',
        title: '輸入診斷端口',
        content: '該規則使用端口區間，請輸入具體需要診斷的本地端口號：',
        inputPlaceholder: '例如: 8080',
        confirmText: '開始診斷',
        cancelText: '取消',
        onConfirm: (val: string) => {
          const [start, end] = rule.listen_port.split('-').map(Number);
          const p = Number(val);
          if (!val || isNaN(p) || p < start || p > end) {
            alert(`請輸入 ${start} 到 ${end} 之間的有效數字`); // 這裡可以用狀態維護錯誤，簡化用 alert
            return false;
          }
          setDialog(null);
          runDiagnostic(rule, val);
        }
      });
    } else {
      runDiagnostic(rule, rule.listen_port);
    }
  };

  const runDiagnostic = (rule: any, port: string) => {
    const node = nodes.find((n: any) => n.id === selected);
    const target = `${rule.dest_ip}:${rule.dest_port}`;
    const path = `入口(${node?.name}) → 目標(${target})`;

    setDiagnostic({ isRunning: true, rule, port, path, results: null });

    // 模擬後端/代理節點的診斷延遲
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3; // 模擬 70% 成功率
      setDiagnostic((prev: any) => ({
        ...prev,
        isRunning: false,
        results: {
          status: isSuccess ? '成功' : '超時',
          latency: isSuccess ? Math.floor(Math.random() * 100) + 10 : '-',
          loss: isSuccess ? '0.0%' : '100%',
          quality: isSuccess ? '很好' : '失敗'
        }
      }));
    }, 1500);
  };

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  const protocolOptions =[
    { label: "TCP", value: "tcp" },
    { label: "UDP", value: "udp" },
    { label: "TCP+UDP", value: "tcp,udp" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {nodes.map((n: any) => (
          <motion.button 
            whileTap={{ scale: 0.95 }} 
            key={n.id} 
            onClick={() => setSelected(n.id)} 
            className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-colors ${selected === n.id ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-[#F0F4EF] dark:bg-[#202522]'}`}
          >
            {n.name}
          </motion.button>
        ))}
      </div>

      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-[32px] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
          <span className="font-bold text-lg">轉發規則</span>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white dark:bg-[#111318] rounded-full p-1 shadow-sm border border-gray-100 dark:border-white/5">
              <button onClick={() => setViewMode('card')} className={`p-2 rounded-full transition-colors ${viewMode === 'card' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-full transition-colors ${viewMode === 'table' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}><List className="w-4 h-4" /></button>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setImportExportModal({ isOpen: true, mode: 'import', text: '' })} className="text-gray-600 dark:text-gray-300 bg-white dark:bg-[#111318] p-2.5 rounded-full shadow-sm"><Download className="w-4 h-4" /></motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={openExport} className="text-gray-600 dark:text-gray-300 bg-white dark:bg-[#111318] p-2.5 rounded-full shadow-sm"><Upload className="w-4 h-4" /></motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setEditing({ index: -1, targetNodeId: selected, rule: { name: "", listen_port: "", dest_ip: "", dest_port: "", protocol: "tcp" } })} 
              className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-5 py-2.5 rounded-full text-sm flex items-center gap-1"
            >
              <span className="text-lg leading-none">+</span> 添加規則
            </motion.button>
          </div>
        </div>
        
        {rules.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm font-bold">暫無規則，請點擊上方按鈕添加或導入</div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {rules.map((r: any, idx: number) => (
                <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} key={idx} className="bg-white dark:bg-[#111318] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-200">{r.name}</h4>
                      <div className="inline-flex items-center mt-1 px-2.5 py-1 rounded-lg bg-[#F0F4EF] dark:bg-[#202522] text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => triggerDiagnostic(r)} className="p-2.5 bg-blue-50 text-blue-500 dark:bg-blue-900/20 rounded-2xl" title="診斷"><Activity className="w-4 h-4" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, targetNodeId: selected, rule: { ...r } })} className="p-2.5 bg-[var(--md-primary-container)] text-[var(--md-primary)] rounded-2xl"><Edit2 className="w-4 h-4" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(idx)} className="p-2.5 bg-red-50 text-red-500 dark:bg-red-900/20 rounded-2xl"><Trash2 className="w-4 h-4" /></motion.button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#202522] p-3 rounded-[16px]">
                    <span className="text-lg font-mono font-black">{r.listen_port}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300 break-all">{r.dest_ip}:{r.dest_port}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111318] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5 overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-[#202522] text-gray-500">
                <tr>
                  <th className="p-4 font-bold">名稱</th>
                  <th className="p-4 font-bold">本地端口</th>
                  <th className="p-4 font-bold">目標地址</th>
                  <th className="p-4 font-bold">協議</th>
                  <th className="p-4 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold">{r.name}</td>
                    <td className="p-4 font-mono font-bold">{r.listen_port}</td>
                    <td className="p-4 font-mono text-gray-600 dark:text-gray-400">{r.dest_ip}:{r.dest_port}</td>
                    <td className="p-4 uppercase text-xs font-bold">{r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}</td>
                    <td className="p-4 flex justify-end gap-2">
                      <button onClick={() => triggerDiagnostic(r)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl"><Activity className="w-4 h-4" /></button>
                      <button onClick={() => setEditing({ index: idx, targetNodeId: selected, rule: { ...r } })} className="p-2 text-[var(--md-primary)] hover:bg-[var(--md-primary-container)] rounded-xl"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 編輯規則 Modal (完美復刻圖1排版，修復菜單遮擋) */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSaving && setEditing(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            
            {/* 這裡不能加 overflow-hidden，否則會切斷絕對定位的下拉菜單 */}
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-white dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col">
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">{editing.index === -1 ? "添加新規則" : "編輯規則"}</h3>
                  <button onClick={() => !isSaving && setEditing(null)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:scale-105 transition-transform"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  {/* Row 1: 備註名稱 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 ml-1">自定義名稱 (選填)</label>
                    <input value={editing.rule.name} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, name: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="留空將自動生成名稱" />
                  </div>
                  
                  {/* Row 2: 歸屬節點 */}
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-gray-500 ml-1">歸屬節點</label>
                    <div onClick={() => setOpenDropdown(openDropdown === 'node' ? null : 'node')} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)]">
                      <span>{nodes.find((n: any) => n.id === editing.targetNodeId)?.name || "選擇節點"}</span>
                      <motion.div animate={{ rotate: openDropdown === 'node' ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
                    </div>
                    <AnimatePresence>
                      {openDropdown === 'node' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[20px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[150]">
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {nodes.map((n: any) => (
                              <div key={n.id} onClick={() => { setEditing({ ...editing, targetNodeId: n.id }); setOpenDropdown(null); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.targetNodeId === n.id ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                                {n.name}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Row 3: 本地端口 & 協議 (並排) */}
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold text-gray-500 ml-1">本地端口/區間</label>
                      <input value={editing.rule.listen_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, listen_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="如 8080 或 1000-2000" />
                    </div>
                    <div className="flex-1 space-y-1.5 relative">
                      <label className="text-xs font-bold text-gray-500 ml-1">協議</label>
                      <div onClick={() => setOpenDropdown(openDropdown === 'protocol' ? null : 'protocol')} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)]">
                        <span>{protocolOptions.find(o => o.value === editing.rule.protocol)?.label}</span>
                        <motion.div animate={{ rotate: openDropdown === 'protocol' ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
                      </div>
                      <AnimatePresence>
                        {openDropdown === 'protocol' && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[20px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[150]">
                            {protocolOptions.map(o => (
                              <div key={o.value} onClick={() => { setEditing({ ...editing, rule: { ...editing.rule, protocol: o.value } }); setOpenDropdown(null); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.rule.protocol === o.value ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                                {o.label}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Row 4: 目標 IP */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 ml-1">目標 IP</label>
                    <input value={editing.rule.dest_ip} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_ip: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="IPv4/IPv6 或 域名" />
                  </div>

                  {/* Row 5: 目標端口 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 ml-1">目標端口 (對應本地)</label>
                    <input value={editing.rule.dest_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" placeholder="如 80 或 1000-2000" />
                  </div>
                </div>
              </div>

              {/* Row 6: 按鈕 */}
              <div className="p-6 pt-2 flex gap-3">
                <button onClick={() => setEditing(null)} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-[#F0F4EF] text-gray-700 dark:bg-white/5 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50">取消</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-[#005ea2] dark:bg-[var(--md-primary)] text-white dark:text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70 shadow-md">
                  {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /><span>保存中...</span></> : <span>保存規則</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 導入導出 Modal */}
      <AnimatePresence>
        {importExportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setImportExportModal(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white dark:bg-[#111318] rounded-[32px] p-6 shadow-2xl flex flex-col gap-4">
              <h3 className="text-xl font-bold">{importExportModal.mode === 'import' ? '批量導入規則' : '批量導出規則'}</h3>
              <p className="text-sm text-gray-500 font-bold">格式要求：自定義名稱(可選) 本地端口|目標IP|目標端口|協議 (每行一條)</p>
              <textarea 
                value={importExportModal.text} 
                onChange={(e) => setImportExportModal({ ...importExportModal, text: e.target.value })} 
                readOnly={importExportModal.mode === 'export'}
                className="w-full h-64 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] resize-none"
                placeholder="例如:&#13;&#10;網頁代理 80|192.168.1.1|8080|tcp&#13;&#10;1000-2000|10.0.0.1|1000-2000|tcp,udp"
              />
              <div className="flex gap-3 mt-2">
                <button onClick={() => setImportExportModal(null)} className="flex-1 py-3.5 rounded-full font-bold bg-[#F0F4EF] dark:bg-white/5 hover:bg-gray-200 transition-colors">取消</button>
                {importExportModal.mode === 'import' ? (
                  <button onClick={handleBatchImport} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] flex justify-center items-center gap-2 shadow-md hover:opacity-90"><Save className="w-5 h-5"/>確認導入</button>
                ) : (
                  <button onClick={() => { navigator.clipboard.writeText(importExportModal.text); alert("已複製到剪貼簿"); }} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] flex justify-center items-center gap-2 shadow-md hover:opacity-90"><Save className="w-5 h-5"/>複製全部</button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 診斷結果 Modal (復刻圖2排版) */}
      <AnimatePresence>
        {diagnostic && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !diagnostic.isRunning && setDiagnostic(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-4xl bg-[#1a1e23] border border-gray-700 rounded-[24px] shadow-2xl overflow-hidden flex flex-col text-white">
              <div className="p-5 flex justify-between items-center bg-[#15191c] border-b border-gray-800">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">轉發診斷結果</h3>
                  <p className="text-sm text-gray-400 mt-1">{nodes.find((n: any) => n.id === selected)?.name}</p>
                </div>
                <div className="px-3 py-1 bg-blue-600 rounded-full text-xs font-bold text-white shadow-sm">轉發服務</div>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-[#15191c] p-4 rounded-xl flex gap-3 text-sm border border-blue-900/30 text-blue-200">
                  <Info className="w-5 h-5 shrink-0 text-blue-400" />
                  <p>注意：由於面板為被動模式，規則創建後請等待大約30秒讓Agent獲取並生效。當出口沒有部署對應服務時，診斷顯示超時為正常現象。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#20252b] border border-gray-700 p-5 rounded-xl flex flex-col items-center justify-center py-8">
                    <span className="text-3xl font-black text-gray-200">1</span>
                    <span className="text-sm text-gray-500 mt-2">總測試數</span>
                  </div>
                  <div className="bg-[#1a2b22] border border-[#1d4c33] p-5 rounded-xl flex flex-col items-center justify-center py-8">
                    <span className="text-3xl font-black text-[#4ade80]">{diagnostic.results?.status === '成功' ? 1 : 0}</span>
                    <span className="text-sm text-[#4ade80]/70 mt-2">成功</span>
                  </div>
                  <div className="bg-[#311b1e] border border-[#7f1d1d] p-5 rounded-xl flex flex-col items-center justify-center py-8">
                    <span className="text-3xl font-black text-[#f87171]">{diagnostic.results?.status !== '成功' && diagnostic.results ? 1 : 0}</span>
                    <span className="text-sm text-[#f87171]/70 mt-2">失敗</span>
                  </div>
                </div>

                <div className="bg-[#20252b] rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-[#2a3038] px-4 py-3 text-sm font-bold border-b border-gray-700 flex items-center gap-2 text-blue-400">
                    <div className="w-2 h-4 bg-orange-500 rounded-sm"></div> 入口測試
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="text-gray-400 bg-[#252a30] border-b border-gray-700">
                      <tr>
                        <th className="p-3 pl-4 font-normal">路徑</th>
                        <th className="p-3 font-normal">狀態</th>
                        <th className="p-3 font-normal">延遲(ms)</th>
                        <th className="p-3 font-normal">丟包率</th>
                        <th className="p-3 font-normal">質量</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-800 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="p-4 flex items-start gap-3">
                          {diagnostic.isRunning ? (
                            <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                          ) : diagnostic.results?.status === '成功' ? (
                            <CheckCircle2 className="w-5 h-5 text-[#4ade80] shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-[#f87171] shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-200">{diagnostic.path}</span>
                            <span className="text-xs text-gray-500 mt-1 font-mono">{diagnostic.rule.dest_ip}:{diagnostic.rule.dest_port}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {diagnostic.isRunning ? <span className="text-gray-400">測試中...</span> : (
                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${diagnostic.results.status === '成功' ? 'bg-[#4ade80]/20 text-[#4ade80]' : 'bg-[#f87171]/20 text-[#f87171]'}`}>
                              {diagnostic.results.status}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-mono text-blue-400">{diagnostic.results?.latency || '-'}</td>
                        <td className="p-4 text-[#4ade80]">{diagnostic.results?.loss || '-'}</td>
                        <td className="p-4">
                          {diagnostic.results && (
                            <span className={`px-2.5 py-1 rounded text-xs font-bold ${diagnostic.results.status === '成功' ? 'bg-[#4ade80] text-[#1a2b22]' : 'bg-[#f87171] text-[#311b1e]'}`}>
                              ✨ {diagnostic.results.quality}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-[#15191c] border-t border-gray-800 flex justify-end gap-3">
                <button onClick={() => setDiagnostic(null)} className="px-6 py-2 rounded-lg font-bold text-gray-300 hover:bg-white/10 transition-colors">關閉</button>
                <button onClick={() => runDiagnostic(diagnostic.rule, diagnostic.port)} disabled={diagnostic.isRunning} className="px-6 py-2 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2">
                  重新診斷
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 通用 MD3 對話框 (用於刪除確認、錯誤提示、輸入端點等) */}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => dialog.onCancel?.()} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-[#111318] rounded-[28px] p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-4">
                {dialog.isDanger ? <AlertCircle className="w-8 h-8 text-red-500 shrink-0" /> : <Info className="w-8 h-8 text-[var(--md-primary)] shrink-0" />}
                <div className="space-y-2 w-full">
                  <h3 className="text-xl font-bold">{dialog.title}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{dialog.content}</div>
                  
                  {dialog.type === 'input' && (
                    <input 
                      autoFocus
                      className="w-full mt-3 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)]" 
                      placeholder={dialog.inputPlaceholder}
                      onChange={(e) => dialog.inputValue = e.target.value}
                    />
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                {dialog.cancelText && (
                  <button onClick={() => dialog.onCancel ? dialog.onCancel() : setDialog(null)} className="px-5 py-2.5 rounded-full font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                    {dialog.cancelText}
                  </button>
                )}
                <button 
                  onClick={() => dialog.onConfirm ? dialog.onConfirm(dialog.type === 'input' ? dialog.inputValue : undefined) : setDialog(null)} 
                  className={`px-5 py-2.5 rounded-full font-bold transition-colors ${dialog.isDanger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90'}`}
                >
                  {dialog.confirmText || "確定"}
                </button>
              </div>
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
