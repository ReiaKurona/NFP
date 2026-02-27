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
//規則編輯頁面
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const[selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const [rules, setRules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 視圖切換：預設讀取 localStorage
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem('rulesViewMode') as 'card' | 'table') || 'card';
  });

  // 統一對話框狀態（包含錯誤、刪除確認、導入、導出）
  type DialogConfig = {
    isOpen: boolean;
    type: 'error' | 'confirm' | 'import' | 'export';
    title: string;
    message?: string;
    textValue?: string;
    targetIdx?: number;
  };
  const [dialog, setDialog] = useState<DialogConfig>({ isOpen: false, type: 'error', title: '' });

  // 記錄當前正在編輯的規則。null 表示未編輯，index: -1 表示新增
  const [editing, setEditing] = useState<{ index: number; rule: any } | null>(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  useEffect(() => {
    if (selected) setRules(allRules[selected] || []);
  },[selected, allRules]);

  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('rulesViewMode', mode);
  };

  // 規則合法性審查函數
  const validateRule = (rule: any, index: number, currentRules: any[]) => {
    const portRegex = /^[\d-]+$/; // 僅限數字和區間符號
    if (!rule.listen_port || !portRegex.test(rule.listen_port)) return "本地端口格式不合法（僅限數字或區間符號 '-'，例如 8080 或 1000-2000）";
    if (!rule.dest_ip) return "目標 IP 不能為空";
    if (!rule.dest_port || !portRegex.test(rule.dest_port)) return "目標端口格式不合法（僅限數字或區間 '-'）";
    if (!['tcp', 'udp', 'tcp,udp'].includes(rule.protocol)) return "協議不合法（僅限 tcp, udp, tcp,udp）";
    
    // 檢查自訂名稱是否重複
    if (rule.name && rule.name.trim() !== "") {
      const duplicate = currentRules.find((r, i) => i !== index && r.name === rule.name);
      if (duplicate) return `自訂名稱 "${rule.name}" 已存在於當前節點中`;
    }
    return null;
  };

  const handleSave = async () => {
    if (!editing) return;
    
    // 執行數據審查
    const err = validateRule(editing.rule, editing.index, rules);
    if (err) {
      setDialog({ isOpen: true, type: 'error', title: '保存失敗', message: err });
      return;
    }

    setIsSaving(true);
    const newRules = [...rules];
    if (editing.index === -1) {
      newRules.push(editing.rule);
    } else {
      newRules[editing.index] = editing.rule;
    }

    try {
      await api("SAVE_RULES", { nodeId: selected, rules: newRules });
      setRules(newRules);
      fetchAllData();
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async (idx: number) => {
    const newRules = [...rules];
    newRules.splice(idx, 1);
    setRules(newRules);
    await api("SAVE_RULES", { nodeId: selected, rules: newRules });
    fetchAllData();
  };

  // 處理所有彈窗的確認按鈕
  const handleDialogConfirm = async () => {
    if (dialog.type === 'error') {
      setDialog({ ...dialog, isOpen: false });
    } else if (dialog.type === 'confirm' && dialog.targetIdx !== undefined) {
      await executeDelete(dialog.targetIdx);
      setDialog({ ...dialog, isOpen: false });
    } else if (dialog.type === 'import') {
      // 批量導入解析
      const lines = (dialog.textValue || '').split('\n').map(l => l.trim()).filter(l => l);
      const parsedRules: any[] =[];
      
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split('|');
        let rule: any = {};
        
        if (parts.length === 5) {
          rule = { name: parts[0].trim(), listen_port: parts[1].trim(), dest_ip: parts[2].trim(), dest_port: parts[3].trim(), protocol: parts[4].trim().toLowerCase() };
        } else if (parts.length === 4) {
          rule = { name: "", listen_port: parts[0].trim(), dest_ip: parts[1].trim(), dest_port: parts[2].trim(), protocol: parts[3].trim().toLowerCase() };
        } else {
          setDialog({ ...dialog, type: 'error', title: '導入失敗', message: `第 ${i + 1} 行格式錯誤，需包含 4 或 5 個以 '|' 分隔的欄位。` });
          return;
        }
        
        const err = validateRule(rule, -1,[...rules, ...parsedRules]);
        if (err) {
          setDialog({ ...dialog, type: 'error', title: '導入失敗', message: `第 ${i + 1} 行數據無效: ${err}` });
          return;
        }
        parsedRules.push(rule);
      }
      
      const newRules = [...rules, ...parsedRules];
      setIsSaving(true);
      try {
        await api("SAVE_RULES", { nodeId: selected, rules: newRules });
        setRules(newRules);
        fetchAllData();
        setDialog({ ...dialog, isOpen: false });
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (nodes.length === 0) return <div className="text-center py-10">請先添加節點</div>;

  const protocolOptions =[
    { label: "TCP", value: "tcp" },
    { label: "UDP", value: "udp" },
    { label: "TCP+UDP", value: "tcp,udp" },
  ];

  return (
    <div className="space-y-6 relative">
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {nodes.map((n: any) => (
          <motion.button 
            whileTap={{ scale: 0.95 }} 
            key={n.id} 
            onClick={() => setSelected(n.id)} 
            className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-colors ${selected === n.id ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-[#F0F4EF] dark:bg-[#202522] text-[#404943] dark:text-gray-300'}`}
          >
            {n.name}
          </motion.button>
        ))}
      </div>

      <div className="bg-[#F8FAF7] dark:bg-[#1A1D1B] p-5 rounded-[32px] space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[18px] text-[#191C1A] dark:text-white">轉發規則</span>
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
          
          <div className="flex items-center gap-2 flex-wrap">
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setDialog({ isOpen: true, type: 'import', title: '批量導入規則', textValue: '' })} 
              className="text-[#404943] dark:text-gray-300 bg-[#E9EFE7] dark:bg-white/10 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5"
            >
              <Download className="w-4 h-4"/> 導入
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setDialog({ isOpen: true, type: 'export', title: '批量導出規則', textValue: rules.map(r => `${r.name || ''}|${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join('\n') })} 
              className="text-[#404943] dark:text-gray-300 bg-[#E9EFE7] dark:bg-white/10 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4"/> 導出
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.9 }} 
              onClick={() => setEditing({ index: -1, rule: { name: "", listen_port: "", dest_ip: "", dest_port: "", protocol: "tcp" } })} 
              className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-5 py-2 rounded-full text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4"/> 添加規則
            </motion.button>
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm font-bold flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-[#E9EFE7] dark:bg-[#202522] flex items-center justify-center">
              <LayoutGrid className="w-8 h-8 text-gray-300 dark:text-gray-600"/>
            </div>
            暫無規則，請點擊上方按鈕添加或導入
          </div>
        ) : (
          <>
           // {/* 卡片視圖 */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {rules.map((r: any, idx: number) => (
                    <motion.div 
                      layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} 
                      key={idx} 
                      className="bg-white dark:bg-[#111318] p-5 rounded-[24px] shadow-sm border border-[#E9EFE7] dark:border-white/5 flex flex-col gap-4"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="text-[13px] font-bold text-gray-500 line-clamp-1">{r.name || `新建規則 ${idx + 1}`}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[22px] font-mono font-black text-[#191C1A] dark:text-white">{r.listen_port}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F0F4EF] dark:bg-[#202522] text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                              {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                            </span>
                          </div>
                        </div>
                        <div className="flex bg-[#F8FAF7] dark:bg-white/5 rounded-2xl p-1">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, rule: { ...r } })} className="p-2 text-gray-500 hover:text-[var(--md-primary)] transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDialog({ isOpen: true, type: 'confirm', title: '刪除規則', message: '確定要刪除這條規則嗎？此操作無法恢復。', targetIdx: idx })} className="p-2 text-red-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>
                      
                      <div className="bg-[#F8FAF7] dark:bg-[#202522] rounded-[16px] p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white dark:bg-[#111318] flex items-center justify-center shadow-sm">
                          <ArrowRight className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-[11px] font-bold text-gray-400">轉發至</div>
                          <div className="text-[13px] font-mono font-bold text-[#404943] dark:text-gray-300 truncate">{r.dest_ip}:{r.dest_port}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

           {/* 表格視圖 */}
            {viewMode === 'table' && (
              <div className="overflow-x-auto bg-white dark:bg-[#111318] rounded-[24px] shadow-sm border border-[#E9EFE7] dark:border-white/5">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#E9EFE7] dark:border-white/5 text-[12px] text-gray-400 uppercase tracking-wider">
                      <th className="py-4 px-5 font-bold">自訂名稱</th>
                      <th className="py-4 px-5 font-bold">本地端口</th>
                      <th className="py-4 px-5 font-bold">目標 IP:端口</th>
                      <th className="py-4 px-5 font-bold">協議</th>
                      <th className="py-4 px-5 font-bold text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-50 dark:border-white/5 last:border-0 hover:bg-[#F8FAF7] dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-5 font-bold text-[#404943] dark:text-gray-300">{r.name || `新建規則 ${idx + 1}`}</td>
                        <td className="py-3 px-5 font-mono text-[#191C1A] dark:text-white font-bold">{r.listen_port}</td>
                        <td className="py-3 px-5 font-mono text-gray-600 dark:text-gray-400">{r.dest_ip}:{r.dest_port}</td>
                        <td className="py-3 px-5">
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-[#F0F4EF] dark:bg-[#202522] text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase">
                            {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                          </span>
                        </td>
                        <td className="py-3 px-5 flex justify-end gap-2">
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, rule: { ...r } })} className="p-2 text-[var(--md-primary)] hover:bg-[var(--md-primary-container)] rounded-full transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDialog({ isOpen: true, type: 'confirm', title: '刪除規則', message: '確定要刪除這條規則嗎？此操作無法恢復。', targetIdx: idx })} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 編輯/新增規則彈出視窗 */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !isSaving && setEditing(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            
             {/* 彈窗內容：不使用 overflow-hidden 解決菜單被擋住問題 */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="relative w-full max-w-md bg-[#FBFDF7] dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[22px] font-bold text-[#191C1A] dark:text-white">
                  {editing.index === -1 ? "添加規則" : "編輯規則"}
                </h3>
                <button 
                  onClick={() => !isSaving && setEditing(null)} 
                  className="p-2 bg-[#E9EFE7] dark:bg-white/10 rounded-full hover:scale-105 transition-transform text-gray-500 dark:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">自訂名稱 (選填)</label>
                  <input 
                    value={editing.rule.name || ""} 
                    onChange={e => setEditing({ ...editing, rule: { ...editing.rule, name: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-bold text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder={`如不填，將顯示 "新建規則 ${editing.index === -1 ? rules.length + 1 : editing.index + 1}"`} 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">本地端口 (如 8080 或 1000-2000)</label>
                  <input 
                    value={editing.rule.listen_port} 
                    onChange={e => setEditing({ ...editing, rule: { ...editing.rule, listen_port: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder="Port 或 Range" 
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">目標 IP</label>
                  <input 
                    value={editing.rule.dest_ip} 
                    onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_ip: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder="192.168.1.1" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">目標端口 (對應本地)</label>
                  <input 
                    value={editing.rule.dest_port} 
                    onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_port: e.target.value } })} 
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm text-[#191C1A] dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow" 
                    placeholder="Port 或 Range" 
                  />
                </div>

                {/* 自定義 MD3 選擇菜單 */}
                <div className="space-y-1.5 relative">
                  <label className="text-[13px] font-bold text-gray-500 ml-1">協議</label>
                  <div 
                    onClick={() => setIsSelectOpen(!isSelectOpen)}
                    className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow text-[#191C1A] dark:text-white"
                  >
                    <span>{protocolOptions.find(o => o.value === editing.rule.protocol)?.label || "選擇協議"}</span>
                    <motion.div animate={{ rotate: isSelectOpen ? 180 : 0 }}>
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    </motion.div>
                  </div>
                  
                  <AnimatePresence>
                    {isSelectOpen && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }} 
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2A2F2C] rounded-[20px] shadow-xl border border-gray-100 dark:border-white/5 flex flex-col overflow-hidden z-[60]"
                      >
                        {protocolOptions.map(o => (
                          <div 
                            key={o.value} 
                            onClick={() => {
                              setEditing({ ...editing, rule: { ...editing.rule, protocol: o.value } });
                              setIsSelectOpen(false);
                            }} 
                            className={`p-4 hover:bg-[#F0F4EF] dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.rule.protocol === o.value ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : 'text-gray-700 dark:text-gray-200'}`}
                          >
                            {o.label}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setEditing(null)} 
                  disabled={isSaving}
                  className="flex-1 py-3.5 rounded-full font-bold text-[#404943] dark:text-gray-200 bg-[#E9EFE7] dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70 shadow-md shadow-[var(--md-primary)]/20"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <span>保存</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

     {/* 統一全局的 MD3 彈窗 (錯誤提示、確認、導入、導出) */}
      <AnimatePresence>
        {dialog.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => !isSaving && setDialog({ ...dialog, isOpen: false })}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="relative w-full max-w-sm bg-[#FBFDF7] dark:bg-[#111318] rounded-[28px] shadow-2xl flex flex-col p-6"
            >
              <h3 className="text-[22px] font-bold mb-4 text-[#191C1A] dark:text-[#E2E3DF]">
                {dialog.title}
              </h3>
              
              <div className="mb-6 max-h-[60vh] overflow-y-auto hide-scrollbar">
                {dialog.type === 'import' || dialog.type === 'export' ? (
                  <textarea
                    value={dialog.textValue || ''}
                    onChange={(e) => setDialog({ ...dialog, textValue: e.target.value })}
                    readOnly={dialog.type === 'export'}
                    className={`w-full h-48 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] text-[13px] font-mono outline-none focus:ring-2 ring-[var(--md-primary)] whitespace-pre resize-none ${dialog.type === 'export' ? 'select-all text-[#191C1A] dark:text-white' : 'text-[#404943] dark:text-[#C3C8C4]'}`}
                    placeholder="格式：自訂名稱(可選)|本地端口|目標IP|目標端口|協議&#10;例如：&#10;Web伺服器|80|192.168.1.1|80|tcp&#10;|8080|10.0.0.1|8080|tcp,udp"
                  />
                ) : (
                  <p className="text-[14px] leading-relaxed text-[#404943] dark:text-[#C3C8C4] font-medium">
                    {dialog.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-auto">
                {dialog.type !== 'error' && (
                  <button 
                    disabled={isSaving}
                    onClick={() => setDialog({ ...dialog, isOpen: false })} 
                    className="px-5 py-2.5 rounded-full text-sm font-bold text-[var(--md-primary)] hover:bg-[var(--md-primary)]/10 transition-colors disabled:opacity-50"
                  >
                    {dialog.type === 'export' ? '關閉' : '取消'}
                  </button>
                )}
                {dialog.type !== 'export' && (
                  <button 
                    disabled={isSaving}
                    onClick={handleDialogConfirm} 
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
