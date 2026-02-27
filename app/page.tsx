"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
// 註釋掉二維碼依賴
// import { QRCodeSVG } from "qrcode.react";
import { 
  Shield, RefreshCw, Trash2, Home, Network, Server, User, LogOut, 
  Palette, PauseCircle, Download, Upload, KeyRound, Save, Terminal,Edit2,X,ChevronDown,Loader2,LayoutGrid, List as ListIcon, AlertCircle, CheckCircle2, Copy
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

function NodesView({ nodes, api, fetchAllData }: any) {
  const [showAdd, setShowAdd] = useState(false);
  const generateToken = () => Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const [newNode, setNewNode] = useState({ name: "", ip: "", port: "8080", token: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if(showAdd) setNewNode(prev => ({...prev, token: generateToken()})); }, [showAdd]);

  const handleSave = async () => {
    if (!newNode.name) return alert("請填寫節點名稱");
    if (!newNode.ip) return alert("請填寫公網 IP");
    
    setIsSaving(true);
    try {
      await api("ADD_NODE", { node: newNode });
      setShowAdd(false);
      setNewNode({ name: "", ip: "", port: "8080", token: "" });
      await fetchAllData();
      alert("✅ 添加成功！請複製下方指令安裝 Agent。");
    } catch(e: any) { alert("❌ 保存失敗: " + e.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6">
      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAdd(!showAdd)} className="w-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] py-4 rounded-full font-bold">
        + 添加新節點
      </motion.button>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4 overflow-hidden">
            <h3 className="font-bold text-lg px-2">填寫節點資訊</h3>
            <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none focus:border-[var(--md-primary)] border border-transparent" placeholder="節點名稱" value={newNode.name} onChange={e=>setNewNode({...newNode,name:e.target.value})} />
            <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none focus:border-[var(--md-primary)] border border-transparent" placeholder="公網 IP" value={newNode.ip} onChange={e=>setNewNode({...newNode,ip:e.target.value})} />
            <div className="relative">
              <input className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl outline-none text-gray-500" value={newNode.token} readOnly />
              <button onClick={()=>setNewNode({...newNode, token: generateToken()})} className="absolute right-4 top-4 text-xs font-bold text-[var(--md-primary)]">重置</button>
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }} 
              onClick={handleSave} 
              disabled={isSaving}
              className={`w-full py-4 rounded-full font-bold transition-all ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'}`}
            >
              {isSaving ? "正在保存..." : "保存 (下一步獲取指令)"}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {nodes.map((n: any) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const installCmd = `curl -sSL ${origin}/api/install | bash -s -- --token ${n.token} --id ${n.id} --panel ${origin}`;
        
        return (
          <motion.div layout key={n.id} className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[32px] space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">{n.name}</h3>
                <div className="flex gap-2">
                   <motion.button whileTap={{ scale: 0.9 }} onClick={()=>{if(confirm("確定刪除？")) api("DELETE_NODE",{nodeId:n.id}).then(fetchAllData)}} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-2xl"><Trash2 className="w-5 h-5"/></motion.button>
                </div>
             </div>
             <div className="bg-white dark:bg-[#111318] p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2"><Terminal className="w-4 h-4"/> 安裝指令 (點擊複製)</p>
                <code onClick={()=>{navigator.clipboard.writeText(installCmd);alert("已複製")}} className="block text-xs text-[var(--md-primary)] break-all cursor-pointer hover:opacity-80 transition-opacity leading-relaxed">
                  {installCmd}
                </code>
             </div>
          </motion.div>
        );
      })}
    </div>
  );
}
// 輔助組件：MD3 風格彈窗
const Dialog = ({ open, onClose, title, children, footer, zIndex = 50 }: any) => {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 flex items-center justify-center p-4 z-[${zIndex}]`}>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2">
          <h3 className="text-2xl font-bold">{title}</h3>
        </div>
        <div className="p-6 py-4 overflow-y-auto custom-scrollbar">
          {children}
        </div>
        {footer && <div className="p-6 pt-2">{footer}</div>}
      </motion.div>
    </div>
  );
};

//規則編輯頁面
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const [selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const [rules, setRules] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  
  // 編輯狀態
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<{ index: number; rule: any } | null>(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  
  // 導入導出狀態
  const [showImportExport, setShowImportExport] = useState(false);
  const [importText, setImportText] = useState("");
  const [ioTab, setIoTab] = useState<'import' | 'export'>('export');
  
  // 錯誤提示狀態
  const [errorModal, setErrorModal] = useState<{ show: boolean; msg: string }>({ show: false, msg: "" });

  useEffect(() => {
    if (selected) setRules(allRules[selected] || []);
  }, [selected, allRules]);

  // 生成顯示名稱 (不寫入數據庫)
  const getDisplayName = (rule: any, idx: number) => {
    return rule.remark && rule.remark.trim() !== "" 
      ? rule.remark 
      : `新建規則 ${idx + 1}`;
  };

  // 驗證邏輯
  const validateRule = (rule: any, currentIndex: number) => {
    // 1. 端口/區間檢查 (允許數字和連字符)
    const portRegex = /^(\d+)(-\d+)?$/;
    if (!portRegex.test(rule.listen_port)) return "本地端口格式錯誤 (僅允許數字或 1000-2000)";
    if (!portRegex.test(rule.dest_port)) return "目標端口格式錯誤 (僅允許數字或 1000-2000)";
    
    // 2. IP 簡單檢查 (非空即可，詳細正則過於嚴格可能誤殺域名)
    if (!rule.dest_ip || rule.dest_ip.trim() === "") return "目標 IP 不能為空";

    // 3. 自定義名稱重複檢查 (僅檢查有填寫名稱的情況)
    if (rule.remark && rule.remark.trim() !== "") {
      const isDuplicate = rules.some((r, idx) => 
        idx !== currentIndex && r.remark === rule.remark
      );
      if (isDuplicate) return `規則名稱 "${rule.remark}" 已存在，請使用其他名稱`;
    }

    return null; // 通過
  };

  const handleSave = async () => {
    if (!editing) return;
    
    // 執行驗證
    const errorMsg = validateRule(editing.rule, editing.index);
    if (errorMsg) {
      setErrorModal({ show: true, msg: errorMsg });
      return;
    }

    setIsSaving(true);
    const newRules = [...rules];
    
    // 清理 remark 如果是用戶未輸入狀態 (雖然前端已處理，再次確保不存垃圾數據)
    const ruleToSave = { ...editing.rule, remark: editing.rule.remark?.trim() || "" };

    if (editing.index === -1) {
      newRules.push(ruleToSave);
    } else {
      newRules[editing.index] = ruleToSave;
    }

    try {
      await api("SAVE_RULES", { nodeId: selected, rules: newRules });
      setRules(newRules);
      fetchAllData();
      setEditing(null);
    } catch (e) {
      setErrorModal({ show: true, msg: "保存失敗，請檢查網絡或後端日誌" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (idx: number) => {
    if(!confirm("確定刪除此規則？")) return;
    const newRules = [...rules];
    newRules.splice(idx, 1);
    setRules(newRules);
    await api("SAVE_RULES", { nodeId: selected, rules: newRules });
    fetchAllData();
  };

  // 批量導入導出邏輯
  const handleBatchProcess = async () => {
    if (ioTab === 'export') return; // 導出只是顯示，不需要處理

    const lines = importText.split('\n').filter(l => l.trim());
    const importedRules: any[] = [];
    const errors: string[] = [];

    lines.forEach((line, i) => {
      // 格式: 原端口|目標IP|目標端口|協議
      const parts = line.split('|');
      if (parts.length < 4) {
        errors.push(`第 ${i+1} 行格式錯誤: 缺少分隔符 '|'`);
        return;
      }
      const [src, ip, dest, proto] = parts.map(s => s.trim());
      
      // 簡單驗證
      if (!/^(\d+)(-\d+)?$/.test(src)) { errors.push(`第 ${i+1} 行源端口錯誤`); return; }
      
      importedRules.push({
        listen_port: src,
        dest_ip: ip,
        dest_port: dest,
        protocol: proto.toLowerCase(),
        remark: "" // 導入默認為空
      });
    });

    if (errors.length > 0) {
      setErrorModal({ show: true, msg: "導入部分失敗:\n" + errors.slice(0, 5).join('\n') + (errors.length > 5 ? "\n..." : "") });
      return;
    }

    // 合併規則 (追加模式)
    const finalRules = [...rules, ...importedRules];
    setRules(finalRules);
    await api("SAVE_RULES", { nodeId: selected, rules: finalRules });
    fetchAllData();
    setShowImportExport(false);
    setImportText("");
  };

  const openImportExport = () => {
    if (ioTab === 'export') {
      // 生成導出文本
      const text = rules.map(r => `${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join('\n');
      setImportText(text);
    } else {
      setImportText("");
    }
    setShowImportExport(true);
  };

  // 當切換 tab 時更新導出文本
  useEffect(() => {
    if (showImportExport && ioTab === 'export') {
      const text = rules.map(r => `${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join('\n');
      setImportText(text);
    }
  }, [ioTab, showImportExport, rules]);

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  const protocolOptions = [
    { label: "TCP", value: "tcp" },
    { label: "UDP", value: "udp" },
    { label: "TCP+UDP", value: "tcp,udp" },
  ];

  return (
    <div className="space-y-6">
      {/* 頂部節點選擇 */}
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

      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-5 rounded-[32px] space-y-4 relative min-h-[400px]">
        {/* 工具欄 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2">
          <span className="font-bold text-lg">轉發規則 ({rules.length})</span>
          
          <div className="flex items-center gap-2 bg-white dark:bg-[#111318] p-1.5 rounded-full shadow-sm">
            {/* 視圖切換 */}
            <div className="flex bg-gray-100 dark:bg-white/5 rounded-full p-1 relative">
               <motion.div 
                 className="absolute inset-y-1 bg-white dark:bg-[#2a2f2c] rounded-full shadow-sm z-0"
                 initial={false}
                 animate={{ 
                   left: viewMode === 'card' ? '4px' : '50%', 
                   width: 'calc(50% - 4px)' 
                 }}
                 transition={{ type: "spring", stiffness: 300, damping: 30 }}
               />
               <button onClick={() => setViewMode('card')} className="relative z-10 px-3 py-1.5 rounded-full"><LayoutGrid className={`w-4 h-4 ${viewMode==='card'?'text-[var(--md-primary)]':''}`}/></button>
               <button onClick={() => setViewMode('table')} className="relative z-10 px-3 py-1.5 rounded-full"><ListIcon className={`w-4 h-4 ${viewMode==='table'?'text-[var(--md-primary)]':''}`}/></button>
            </div>

            <div className="w-[1px] h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

            {/* 功能按鈕 */}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setIoTab('import'); openImportExport(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full" title="批量操作">
               <Upload className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </motion.button>
            
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setEditing({ index: -1, rule: { listen_port: "", dest_ip: "", dest_port: "", protocol: "tcp", remark: "" } })} 
              className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-5 py-2 rounded-full text-sm flex items-center gap-1"
            >
              <span className="text-lg leading-none">+</span> 添加規則
            </motion.button>
          </div>
        </div>
        
        {/* 內容區域 */}
        <div className="min-h-[200px]">
          <AnimatePresence mode='wait'>
            {rules.length === 0 ? (
               <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-center py-20 text-gray-400 font-bold">
                 暫無規則，請添加或導入
               </motion.div>
            ) : viewMode === 'card' ? (
              // --- 卡片視圖 ---
              <motion.div key="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-3">
                {rules.map((r: any, idx: number) => (
                  <motion.div 
                    layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                    key={idx} 
                    className="bg-white dark:bg-[#111318] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-[var(--md-primary)] bg-[var(--md-primary-container)]/30 px-2 py-0.5 rounded-md">
                           {getDisplayName(r, idx)}
                         </span>
                         <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                           {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol.toUpperCase()}
                         </span>
                       </div>
                       <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl font-mono font-black">{r.listen_port}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-lg font-mono font-bold text-gray-700 dark:text-gray-300">{r.dest_ip}:{r.dest_port}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, rule: { ...r } })} className="p-3 bg-gray-100 hover:bg-[var(--md-primary-container)] hover:text-[var(--md-primary)] dark:bg-white/5 dark:hover:bg-white/10 rounded-2xl transition-colors"><Edit2 className="w-5 h-5" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDelete(idx)} className="p-3 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded-2xl transition-colors"><Trash2 className="w-5 h-5" /></motion.button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              // --- 表格視圖 ---
              <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="overflow-x-auto bg-white dark:bg-[#111318] rounded-[24px] border border-gray-100 dark:border-white/5">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-white/5 text-gray-500">
                    <tr>
                      <th className="p-4 rounded-tl-[24px]">名稱</th>
                      <th className="p-4">協議</th>
                      <th className="p-4">本地端口</th>
                      <th className="p-4">目標地址</th>
                      <th className="p-4 text-right rounded-tr-[24px]">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {rules.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="p-4 font-bold text-[var(--md-primary)]">{getDisplayName(r, idx)}</td>
                        <td className="p-4 font-mono uppercase text-xs">{r.protocol === 'tcp,udp' ? 'TCP+UDP' : r.protocol}</td>
                        <td className="p-4 font-mono font-bold">{r.listen_port}</td>
                        <td className="p-4 font-mono text-gray-600 dark:text-gray-300">{r.dest_ip}:{r.dest_port}</td>
                        <td className="p-4 text-right space-x-2">
                           <button onClick={() => setEditing({ index: idx, rule: { ...r } })} className="text-[var(--md-primary)] font-bold hover:underline">編輯</button>
                           <button onClick={() => handleDelete(idx)} className="text-red-500 font-bold hover:underline">刪除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 編輯規則 Modal */}
      <AnimatePresence>
        {editing && (
          <Dialog 
            open={!!editing} 
            onClose={() => !isSaving && setEditing(null)}
            title={editing.index === -1 ? "添加規則" : "編輯規則"}
            footer={
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 transition-colors disabled:opacity-50">取消</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70">
                  {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> 保存中</> : "保存"}
                </button>
              </div>
            }
          >
            <div className="space-y-5">
              {/* 名稱輸入 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 ml-1">規則備註 (可選)</label>
                <input 
                  value={editing.rule.remark || ""} 
                  onChange={e => setEditing({ ...editing, rule: { ...editing.rule, remark: e.target.value } })}
                  className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-3.5 rounded-[16px] text-sm font-bold outline-none focus:ring-2 ring-[var(--md-primary)]" 
                  placeholder={`未命名將顯示: 新建規則 ${editing.index === -1 ? rules.length + 1 : editing.index + 1}`} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5 col-span-2">
                   <label className="text-xs font-bold text-gray-500 ml-1">本地端口 (如 8080 或 1000-2000)</label>
                   <input value={editing.rule.listen_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, listen_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-3.5 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="Port" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-gray-500 ml-1">目標 IP</label>
                   <input value={editing.rule.dest_ip} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_ip: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-3.5 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="IP" />
                 </div>
                 <div className="space-y-1.5">
                   <label className="text-xs font-bold text-gray-500 ml-1">目標端口</label>
                   <input value={editing.rule.dest_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-3.5 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="Port" />
                 </div>
              </div>

              {/* 協議選擇 - 解決遮擋問題 */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-gray-500 ml-1">協議</label>
                <div onClick={() => setIsSelectOpen(!isSelectOpen)} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-3.5 rounded-[16px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)]">
                  <span>{protocolOptions.find(o => o.value === editing.rule.protocol)?.label || "選擇協議"}</span>
                  <motion.div animate={{ rotate: isSelectOpen ? 180 : 0 }}><ChevronDown className="w-5 h-5 text-gray-500" /></motion.div>
                </div>
                
                {/* 使用 Fixed 定位或高 z-index 確保不被遮擋 */}
                <AnimatePresence>
                  {isSelectOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} 
                      className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[16px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-[100]"
                    >
                      {protocolOptions.map(o => (
                        <div key={o.value} onClick={() => { setEditing({ ...editing, rule: { ...editing.rule, protocol: o.value } }); setIsSelectOpen(false); }} className={`p-3.5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm ${editing.rule.protocol === o.value ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                          {o.label}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="h-4"></div> {/* 底部墊高防止過於擁擠 */}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* 批量導入/導出 Modal */}
      <AnimatePresence>
        {showImportExport && (
          <Dialog 
            open={showImportExport} 
            onClose={() => setShowImportExport(false)} 
            title="批量操作規則"
            footer={
              ioTab === 'import' ? (
                <button onClick={handleBatchProcess} className="w-full py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)]">確認導入</button>
              ) : (
                <button onClick={() => { navigator.clipboard.writeText(importText); alert("已複製到剪貼板"); }} className="w-full py-3.5 rounded-full font-bold bg-[#F0F4EF] dark:bg-[#202522] flex justify-center gap-2"><Copy className="w-4 h-4"/> 複製內容</button>
              )
            }
          >
            <div className="space-y-4">
               <div className="flex bg-[#F0F4EF] dark:bg-[#202522] rounded-full p-1">
                 {['export', 'import'].map((t: any) => (
                   <button key={t} onClick={() => { setIoTab(t); }} className={`flex-1 py-2 rounded-full font-bold text-sm transition-all ${ioTab === t ? 'bg-white dark:bg-[#111318] shadow-sm text-[var(--md-primary)]' : 'text-gray-500'}`}>
                     {t === 'export' ? '導出規則' : '導入規則'}
                   </button>
                 ))}
               </div>
               
               {ioTab === 'import' ? (
                 <div className="space-y-2">
                    <p className="text-xs text-gray-500 px-2">格式：<code className="bg-gray-100 dark:bg-white/10 px-1 rounded">原端口|目標IP|目標端口|協議</code> (一行一條)</p>
                    <textarea 
                      value={importText} 
                      onChange={e => setImportText(e.target.value)}
                      className="w-full h-48 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none resize-none focus:ring-2 ring-[var(--md-primary)]"
                      placeholder={`8080|1.1.1.1|80|tcp\n1000-2000|192.168.1.1|1000-2000|tcp,udp`}
                    />
                 </div>
               ) : (
                 <div className="relative">
                    <textarea readOnly value={importText} className="w-full h-48 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none resize-none" />
                 </div>
               )}
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* 錯誤提示 Modal */}
      <AnimatePresence>
        {errorModal.show && (
          <Dialog
            open={errorModal.show}
            onClose={() => setErrorModal({ ...errorModal, show: false })}
            title="無法保存"
            zIndex={60} // 確保比編輯框更高
            footer={
              <button onClick={() => setErrorModal({ ...errorModal, show: false })} className="w-full py-3 rounded-full font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                知道了
              </button>
            }
          >
            <div className="flex flex-col items-center text-center space-y-3 py-2">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-bold whitespace-pre-line">{errorModal.msg}</p>
            </div>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

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
