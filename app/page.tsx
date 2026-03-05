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
  CheckCircle,Grid,XCircle, Info
} from "lucide-react";


// 如果你的项目开启了严格模式，加入这段全局声明可以防止 TypeScript 对 Web Components 报错
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'md-icon-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'md-fab': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'md-ripple': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'md-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

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

      <nav className="fixed bottom-0 w-full bg-[#F4F8F4] dark:bg-[#191C1A] border-t border-gray-200/50 dark:border-white/5 px-2 py-2 flex justify-around items-center z-50 safe-area-pb">
        <NavItem icon={<Home className="w-6 h-6"/>} label="首頁" active={tab==="home"} onClick={()=>setTab("home")} />
        <NavItem icon={<Network className="w-6 h-6"/>} label="轉發" active={tab==="rules"} onClick={()=>setTab("rules")} />
        <NavItem icon={<Server className="w-6 h-6"/>} label="節點" active={tab==="nodes"} onClick={()=>setTab("nodes")} />
        <NavItem icon={<User className="w-6 h-6"/>} label="設定" active={tab==="me"} onClick={()=>setTab("me")} />
      </nav>
    </div>
  );
}
//底部导航栏按钮动画逻辑实现
function NavItem({ icon, label, active, onClick }: any) {
  return (
    <motion.button
      layout // 启用布局动画，确保文字出现时容器平滑调整尺寸
      whileTap={{ scale: 0.95 }} // 点击时的微缩反馈
      onClick={onClick}
      className="flex flex-col items-center justify-center flex-1 gap-1 relative outline-none py-2"
    >
      {/* 图标容器：设置为 relative 以便放置绝对定位的背景 */}
      <div className="relative px-5 py-1 flex items-center justify-center">
        
        {/* 1. 激活背景 (胶囊状波纹) */}
        <AnimatePresence>
          {active && (
            <motion.div
              layoutId="nav-item-active-indicator" // 如果有多个NavItem，这能实现跨按钮的滑动效果，单个使用也能保证平滑
              initial={{ opacity: 0, scale: 0.5 }} // 初始状态：透明且缩小（模拟从中心开始）
              animate={{ opacity: 1, scale: 1 }}   // 激活状态：完全显示且填充
              exit={{ opacity: 0, scale: 0.5 }}    // 退出状态：缩小并消失
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 30 
              }} 
              className="absolute inset-0 bg-[var(--md-primary-container)] rounded-full" 
            />
          )}
        </AnimatePresence>

        {/* 2. 图标层 */}
        {/* z-10 确保图标始终位于背景之上 */}
        <span 
          className={`relative z-10 transition-colors duration-200 ${
            active 
              ? 'text-[var(--md-on-primary-container)]' // 激活时：取主容器上的对比色
              : 'text-gray-500'                          // 未激活时：灰色
          }`}
        >
          {icon}
        </span>
      </div>

      {/* 3. 文字标签 (仅在激活时出现) */}
      <AnimatePresence>
        {active && (
          <motion.span
            initial={{ opacity: 0, y: 5, height: 0 }} // 初始：隐形、向下偏移、高度为0
            animate={{ opacity: 1, y: 0, height: "auto" }} // 激活：浮现、回正
            exit={{ opacity: 0, y: 5, height: 0 }}    // 退出：下沉消失
            transition={{ duration: 0.2, delay: 0.05 }} // 稍微延迟，让背景先动
            className="text-[12px] font-bold text-[var(--md-primary)] overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// （MD3）告诉 TypeScript 这些是合法的自定义组件标签，不要报错！
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': any;
      'md-icon-button': any;
      'md-fab': any;
      'md-ripple': any;
      'md-icon': any;
    }
  }
}

// 保持原函数名和入参完全不变
function AlertDialog({ open, title, content, type = "error", onConfirm, onCancel }: any) {
  if (!open) return null;
  
  const isError = type === "error";
  const isConfirm = !!onCancel; // 如果传入了 onCancel，说明是二次确认弹窗
  
  const bgColor = isError ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30";
  const iconColor = isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
  const mdPrimaryToken = isError ? "#dc2626" : "#16a34a"; // 动态替换 MD3 主色

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-[320px] bg-[#F0F4EF] dark:bg-[#202522] rounded-[28px] p-6 shadow-2xl flex flex-col items-center text-center space-y-4 relative"
      >
        {/* 右上角关闭按钮 */}
        {isConfirm && (
          <div className="absolute top-2 right-2 text-gray-500 dark:text-gray-400">
            <md-icon-button onClick={onCancel}>
              <md-icon>close</md-icon>
            </md-icon-button>
          </div>
        )}

        {/* 顶部 MD3 FAB 图标 */}
        <md-fab 
          lowered="true"
          class={`shadow-none ${bgColor} ${iconColor}`}
          style={{
            '--md-fab-container-color': 'transparent',
            '--md-fab-container-elevation': '0',
            'pointerEvents': 'none'
          }}
        >
          <md-icon slot="icon">{isError ? "error" : "check_circle"}</md-icon>
        </md-fab>

        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{content}</p>
        </div>
        
        <div className="flex w-full gap-3 mt-2">
          {/* 取消按钮（自带 MD3 涟漪） */}
          {isConfirm && (
            <button 
              onClick={onCancel}
              className="relative flex-1 py-3 rounded-full font-bold text-sm bg-gray-200 dark:bg-[#111318] text-gray-700 dark:text-gray-300 overflow-hidden"
            >
              <md-ripple></md-ripple>
              取消
            </button>
          )}

          {/* 确认/主按钮 */}
          <div className="flex-1 flex">
            <md-filled-button 
              onClick={onConfirm}
              style={{
                width: '100%',
                '--md-sys-color-primary': mdPrimaryToken,
                '--md-sys-color-on-primary': '#ffffff',
                '--md-filled-button-container-shape': '9999px',
                '--md-filled-button-label-text-font': 'inherit',
                '--md-filled-button-label-text-weight': 'bold',
              }}
            >
              {isConfirm ? "確認" : (isError ? "重試" : "好的")}
            </md-filled-button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// 通用 MD3 风格弹窗组件
function AlertDialog({ open, title, content, type = "error", onConfirm, onCancel }: any) {
  if (!open) return null;
  
  const isError = type === "error";
  const isConfirm = !!onCancel; // 如果传入了 onCancel，说明是二次确认弹窗
  
  // 保留原逻辑，同时映射 MD3 的 Design Tokens 标准颜色
  const bgColor = isError ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30";
  const iconColor = isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
  const mdPrimaryToken = isError ? "#dc2626" : "#16a34a"; // 动态替换 MD3 主色

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="w-full max-w-[320px] bg-[#F0F4EF] dark:bg-[#202522] rounded-[28px] p-6 shadow-2xl flex flex-col items-center text-center space-y-4 relative"
      >
        {/* 1. 引入 <md-icon-button>：右上角的标准 MD3 关闭按钮交互 */}
        {isConfirm && (
          <div className="absolute top-2 right-2 text-gray-500 dark:text-gray-400">
            <md-icon-button onClick={onCancel}>
              <md-icon>close</md-icon>
            </md-icon-button>
          </div>
        )}

        {/* 2. 引入 <md-fab>：作为顶部显眼的图标容器，自带 MD3 阴影轮廓与高斯深度 */}
        <md-fab 
          lowered
          class={`shadow-none ${bgColor} ${iconColor}`}
          style={{
            '--md-fab-container-color': 'transparent', // 借用外层 Tailwind 适配深色模式的背景色
            '--md-fab-container-elevation': '0',
            'pointerEvents': 'none'
          } as React.CSSProperties}
        >
          <md-icon slot="icon">{isError ? "error" : "check_circle"}</md-icon>
        </md-fab>

        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{content}</p>
        </div>
        
        <div className="flex w-full gap-3 mt-2">
          {/* 3. 引入 <md-ripple>：附着在自定义按钮内，提供原汁原味的丝滑波纹 */}
          {isConfirm && (
            <button 
              onClick={onCancel}
              className="relative flex-1 py-3 rounded-full font-bold text-sm bg-gray-200 dark:bg-[#111318] text-gray-700 dark:text-gray-300 overflow-hidden"
            >
              <md-ripple></md-ripple>
              取消
            </button>
          )}

          {/* 4. 引入 <md-filled-button>：标准 MD3 主行为按钮 */}
          <div className="flex-1 flex">
            <md-filled-button 
              onClick={onConfirm}
              style={{
                width: '100%',
                '--md-sys-color-primary': mdPrimaryToken, // 使用 MD3 Design Token 动态覆盖按钮颜色
                '--md-sys-color-on-primary': '#ffffff',
                '--md-filled-button-container-shape': '9999px',
                '--md-filled-button-label-text-font': 'inherit',
                '--md-filled-button-label-text-weight': 'bold',
              } as React.CSSProperties}
            >
              {isConfirm ? "確認" : (isError ? "重試" : "好的")}
            </md-filled-button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// 登录界面
function LoginView({ setAuth, setIsFirstLogin }: any) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogState, setDialogState] = useState({ open: false, title: "", content: "" });

  const handleLogin = async () => {
    if (!pwd) return;
    setLoading(true);
    try {
      const res = await axios.post("/api", { action: "LOGIN", password: pwd });
      
      // 修复逻辑：优先设置是否首次登录标志，确保父组件能及时捕获该状态
      // 防止 setAuth 导致页面立即跳转从而跳过了 ForcePasswordChange 的渲染
      if (res.data.isFirstLogin) {
        setIsFirstLogin(true);
      }
      
      localStorage.setItem("aero_auth", res.data.token);
      setAuth(res.data.token);
      
    } catch (e) {
      setDialogState({
        open: true,
        title: "登錄失敗",
        content: "密碼錯誤或網絡異常，請檢查後重試。"
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFDF8] dark:bg-[#111318] p-6 text-gray-900 dark:text-white">
      <AlertDialog 
        open={dialogState.open} 
        title={dialogState.title} 
        content={dialogState.content} 
        onConfirm={() => setDialogState({ ...dialogState, open: false })}
      />
      
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] space-y-8 shadow-xl relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-8 h-8 border-4 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        <div className="text-center space-y-3">
          <Shield className="w-16 h-16 mx-auto text-[#006C4C]" />
          <h1 className="text-3xl font-bold">AeroNode</h1>
          <p className="text-xs text-gray-500">請輸入管理密碼</p>
        </div>
        
        <input 
          type="password" 
          value={pwd} 
          disabled={loading}
          onChange={e => setPwd(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleLogin()} 
          className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 ring-[var(--md-primary)] transition-all" 
          placeholder="••••••••" 
        />
        
        <motion.button 
          whileTap={{ scale: 0.95 }} 
          onClick={handleLogin} 
          disabled={loading}
          className="w-full py-4 bg-[var(--md-primary)] text-[var(--md-on-primary)] rounded-full font-bold shadow-lg shadow-[var(--md-primary)]/20 hover:shadow-[var(--md-primary)]/40 transition-shadow"
        >
          {loading ? "驗證中..." : "登錄"}
        </motion.button>
      </motion.div>
    </div>
  );
}

// 强制改密码弹窗
function ForcePasswordChange({ api, setAuth, onComplete }: any) {
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ open: boolean, type: "error" | "success", title: string, content: string }>({ 
    open: false, type: "error", title: "", content: "" 
  });

  const handleSave = async () => {
    if (pwd.length < 6) {
      setAlert({ open: true, type: "error", title: "密碼太短", content: "為了您的安全，新密碼長度至少需要 6 位。" });
      return;
    }

    setLoading(true);
    try {
      const res = await api("CHANGE_PASSWORD", { newPassword: pwd });
      // 更新本地存储和状态
      localStorage.setItem("aero_auth", res.token);
      setAuth(res.token);
      
      // 成功提示
      setAlert({ 
        open: true, 
        type: "success", 
        title: "修改成功", 
        content: "您的密碼已更新，請使用新密碼登錄。" 
      });
    } catch (e) {
      setAlert({ open: true, type: "error", title: "修改失敗", content: "服務器拒絕了修改請求，請稍後重試。" });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <AlertDialog 
        open={alert.open} 
        type={alert.type}
        title={alert.title} 
        content={alert.content} 
        onConfirm={() => {
          setAlert({ ...alert, open: false });
          if (alert.type === "success") {
            onComplete(); // 只有在用户点击确认成功后，才关闭整个强制改密窗口
          }
        }}
      />

      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#F0F4EF] dark:bg-[#202522] p-8 rounded-[32px] w-full max-w-sm space-y-6 border-2 border-red-500/20 shadow-2xl relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-[#F0F4EF]/80 dark:bg-[#202522]/80 z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-red-500 flex items-center gap-2">
            <KeyRound className="w-6 h-6"/> 安全警告
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            您正在使用初始默認密碼。為確保系統安全，<span className="font-bold text-red-500">必須</span>設置一個新密碼才能繼續。
          </p>
        </div>

        <input 
          type="password" 
          value={pwd} 
          onChange={e => setPwd(e.target.value)} 
          className="w-full bg-white dark:bg-[#111318] p-4 rounded-2xl text-center focus:outline-none focus:ring-2 ring-red-500 transition-all text-lg" 
          placeholder="輸入新密碼 (至少6位)" 
        />
        
        <motion.button 
          whileTap={{ scale: 0.95 }} 
          onClick={handleSave} 
          disabled={loading}
          className="w-full py-4 bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
        >
          {loading ? "保存中..." : "確認並修改"}
        </motion.button>
      </motion.div>
    </div>
  );
}
//首页仪表盘
function DashboardView({ nodes, allRules }: any) {
  // 定义视图模式状态: 'new-card' | 'classic' | 'table'
  const [viewMode, setViewMode] = useState('new-card');

  // 顶部总览卡片组件
  const SummaryCard = ({ title, value }: { title: string, value: number }) => (
    <motion.div 
      whileHover={{ scale: 1.02 }} 
      className="bg-[#F0F4EF] dark:bg-[#202522] p-6 rounded-[28px] text-center flex flex-col justify-center items-center h-full relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[var(--md-primary)] opacity-[0.03] dark:opacity-[0.08]"></div>
      <div className="text-sm text-gray-500 dark:text-gray-400 z-10">{title}</div>
      <div className="text-3xl font-bold text-[var(--md-primary)] z-10 mt-2">{value}</div>
    </motion.div>
  );

  // 圆形进度条组件 (MD3风格)
  const CircleProgress = ({ percent, label, sublabel, color = "text-[var(--md-primary)]" }: any) => {
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* 背景圆环 */}
          <svg className="transform -rotate-90 w-full h-full">
            <circle
              className="text-[var(--md-surface-variant)] dark:text-gray-700"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
            {/* 进度圆环 */}
            <circle
              className={`${color} transition-all duration-1000 ease-out`}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="40"
              cy="40"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-sm font-bold ${color}`}>{percent.toFixed(0)}<span className="text-[10px]">%</span></span>
          </div>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{label}</span>
      </div>
    );
  };

  // 视图切换按钮组件
  const ViewToggle = () => (
    <div className="flex justify-end mb-4">
      <div className="bg-[#E0E4DE] dark:bg-[#2A2D2A] p-1 rounded-full flex gap-1">
        {[
          { id: 'new-card', icon: 'grid_view', label: '卡片' },
          { id: 'classic', icon: 'dashboard', label: '經典' },
          { id: 'table', icon: 'table_rows', label: '列表' }
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === mode.id
                ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)] shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            {/* 使用 Material Icons 图标字体，如环境不支持可仅显示文字 */}
            <span className="material-symbols-rounded text-sm hidden sm:block">{mode.icon}</span>
            <span>{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 顶部统计区域 */}
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard title="總節點" value={nodes.length} />
        <SummaryCard title="運行規則" value={Object.values(allRules).flat().length} />
      </div>

      {/* 视图切换器 */}
      <ViewToggle />

      {/* 内容区域 */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          {viewMode === 'table' ? (
            /* 表格视图 */
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[28px] overflow-hidden shadow-sm"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-medium">狀態</th>
                      <th className="p-4 font-medium">名稱</th>
                      <th className="p-4 font-medium">IP 地址</th>
                      <th className="p-4 font-medium">處理器</th>
                      <th className="p-4 font-medium">記憶體</th>
                      <th className="p-4 font-medium text-right">下載</th>
                      <th className="p-4 font-medium text-right">上傳</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 dark:divide-white/5">
                    {nodes.map((n: any) => {
                      const isOnline = n.lastSeen && (Date.now() - n.lastSeen < 60000);
                      const ram = parseFloat(n.stats?.ram_usage || "0");
                      const cpu = parseFloat(n.stats?.cpu_load || "0.0") * 10;
                      
                      return (
                        <tr key={n.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`}></span>
                          </td>
                          <td className="p-4 font-bold text-[var(--md-primary)]">{n.name}</td>
                          <td className="p-4 text-xs font-mono text-gray-500">{n.ip}</td>
                          <td className="p-4 text-xs">{Math.min(cpu, 100).toFixed(1)}%</td>
                          <td className="p-4 text-xs">{ram.toFixed(1)}%</td>
                          <td className="p-4 text-xs font-mono text-right text-emerald-600 dark:text-emerald-400">{n.stats?.rx_speed || "0 B/s"}</td>
                          <td className="p-4 text-xs font-mono text-right text-blue-600 dark:text-blue-400">{n.stats?.tx_speed || "0 B/s"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            /* 网格视图容器 (卡片模式) */
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`grid gap-4 ${viewMode === 'new-card' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}
            >
              {nodes.map((n: any) => {
                const isOnline = n.lastSeen && (Date.now() - n.lastSeen < 60000);
                const ramVal = parseFloat(n.stats?.ram_usage || "0");
                const cpuRaw = parseFloat(n.stats?.cpu_load || "0.0");
                const cpuVal = Math.min(cpuRaw * 10, 100);
                const rx = n.stats?.rx_speed || "0 B/s";
                const tx = n.stats?.tx_speed || "0 B/s";

                // 新版 MD3 卡片视图
                if (viewMode === 'new-card') {
                  return (
                    <motion.div 
                      key={n.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 relative overflow-hidden group"
                    >
                      {/* 背景微光效果 */}
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-[var(--md-primary)] blur-[60px] opacity-10 rounded-full pointer-events-none transition-opacity duration-500 ${isOnline ? 'opacity-20' : 'opacity-0'}`}></div>

                      <div className="flex flex-col h-full justify-between gap-6">
                        {/* 头部：名称与状态 */}
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-2xl font-bold tracking-tight text-[var(--md-on-surface)]">{n.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1 opacity-80">{n.ip}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition-colors duration-300 ${
                            isOnline 
                              ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' 
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                          }`}>
                            {isOnline ? '在線' : '離線'}
                          </div>
                        </div>

                        {/* 中部：仪表盘圆环 (CPU & RAM) */}
                        <div className="flex items-center justify-around py-2">
                           <CircleProgress 
                             percent={cpuVal} 
                             label="處理器" 
                             color={isOnline ? "text-[var(--md-primary)]" : "text-gray-400"}
                           />
                           <CircleProgress 
                             percent={ramVal} 
                             label="記憶體" 
                             color={isOnline ? "text-[var(--md-primary)]" : "text-gray-400"}
                           />
                        </div>

                        {/* 底部：网络数据 */}
                        <div className="bg-white/50 dark:bg-black/20 rounded-2xl p-4 flex justify-between items-center backdrop-blur-sm">
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">下載</span>
                            <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="text-xs">↓</span> {rx}
                            </span>
                          </div>
                          <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2"></div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">上傳</span>
                            <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              {tx} <span className="text-xs">↑</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                // 经典卡片视图
                return (
                  <motion.div key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[#F0F4EF] dark:bg-[#202522] rounded-[32px] p-6 relative overflow-hidden">
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
                                <span>處理器負載</span>
                                <span>{cpuVal.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(cpuVal, 100)}%` }}></div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>記憶體使用</span>
                                <span>{ramVal}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-200 dark:bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all duration-1000" style={{ width: `${ramVal}%` }}></div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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

// 規則編輯頁面
// 規則編輯頁面
function RulesView({ nodes, allRules, api, fetchAllData }: any) {
  const[selected, setSelected] = useState<string>(nodes[0]?.id || "");
  const[rules, setRules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 視圖模式：'card' | 'table'
  const[viewMode, setViewMode] = useState<'card'|'table'>('card');
  
  // 編輯視窗狀態
  const[editing, setEditing] = useState<{ index: number; rule: any, sourceNodeId: string } | null>(null);
  
  // 自定義下拉菜單狀態
  const [openSelect, setOpenSelect] = useState<'protocol' | 'node' | null>(null);

  // 通用對話框狀態 (用於報錯、確認)
  const[dialog, setDialog] = useState<{ isOpen: boolean, title: string, msg: React.ReactNode, type: 'error'|'info'|'confirm', onConfirm?: ()=>void } | null>(null);

  // 批量導入導出狀態
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const[batchMode, setBatchMode] = useState<'import'|'export'>('import');
  const[batchResult, setBatchResult] = useState<{total:number, success:number, fail:number, reasons:string[]}|null>(null);

  // 診斷視窗狀態
  const [diagState, setDiagState] = useState<{ isOpen: boolean, rule: any | null, step: 'input'|'testing'|'result', specificPort: string, resultData: any }>({
    isOpen: false, rule: null, step: 'input', specificPort: "", resultData: null
  });

  useEffect(() => {
    if (selected) setRules(allRules[selected] || []);
  }, [selected, allRules]);

  // 工具：獲取顯示名稱
  const getDisplayName = (rule: any, idx: number) => {
    return rule.name && rule.name.trim() !== "" ? rule.name : `新建規則 ${idx + 1}`;
  };

  // 工具：校驗 IP
  const isValidIP = (ip: string) => {
    const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;
    const ipv6Regex = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/; // 簡化版 IPv6
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || domainRegex.test(ip);
  };

  // 工具：校驗端口或區間
  const isValidPort = (portStr: string) => {
    if (!portStr) return false;
    const parts = portStr.toString().split('-');
    if (parts.length > 2) return false;
    for (let p of parts) {
      if (!/^\d+$/.test(p)) return false; // 不能有字母
      const num = parseInt(p, 10);
      if (num < 1 || num > 65535) return false;
    }
    if (parts.length === 2 && parseInt(parts[0]) >= parseInt(parts[1])) return false;
    return true;
  };

  // 審查規則合法性
  const validateRule = (rule: any, currentRules: any[], skipIndex: number = -1) => {
    if (!rule.listen_port || !rule.dest_ip || !rule.dest_port) return "存在空數據，請填寫完整";
    if (!isValidPort(rule.listen_port)) return "本地端口格式錯誤（允許數字或以 '-' 分隔的區間，1-65535）";
    if (!isValidIP(rule.dest_ip)) return "目標 IP 格式錯誤（請輸入有效的 IPv4/IPv6 或域名）";
    if (!isValidPort(rule.dest_port)) return "目標端口格式錯誤";
    
    // 檢查同名 (如果有自定義名稱)
    if (rule.name && rule.name.trim() !== "") {
      const nameExists = currentRules.some((r, idx) => idx !== skipIndex && r.name === rule.name);
      if (nameExists) return `當前節點下已存在名稱為 "${rule.name}" 的規則`;
    }

    // 檢查完全相同的規則
    const isDuplicate = currentRules.some((r, idx) => 
      idx !== skipIndex && 
      r.listen_port === rule.listen_port && 
      r.dest_ip === rule.dest_ip && 
      r.dest_port === rule.dest_port && 
      r.protocol === rule.protocol
    );
    if (isDuplicate) return "當前節點下已存在完全相同的轉發規則";

    return null; // 通過
  };

  // 保存單個規則
  const handleSave = async () => {
    if (!editing) return;
    
    // 獲取目標節點的現有規則
    const targetRules = editing.sourceNodeId === selected 
      ? [...rules] 
      : [...(allRules[editing.sourceNodeId] ||[])];

    // 執行審查
    const errorMsg = validateRule(editing.rule, targetRules, editing.sourceNodeId === selected ? editing.index : -1);
    
    if (errorMsg) {
      setDialog({ isOpen: true, title: "保存失敗", msg: errorMsg, type: "error" });
      return;
    }

    setIsSaving(true);
    
    try {
      if (editing.sourceNodeId === selected) {
        // 保存到當前節點
        if (editing.index === -1) targetRules.push(editing.rule);
        else targetRules[editing.index] = editing.rule;
        await api("SAVE_RULES", { nodeId: selected, rules: targetRules });
        setRules(targetRules);
      } else {
        // 保存到其他節點，同時從當前節點刪除（如果是編輯狀態）
        if (editing.index !== -1) {
          const currentRules =[...rules];
          currentRules.splice(editing.index, 1);
          await api("SAVE_RULES", { nodeId: selected, rules: currentRules });
        }
        targetRules.push(editing.rule);
        await api("SAVE_RULES", { nodeId: editing.sourceNodeId, rules: targetRules });
      }
      fetchAllData();
      setEditing(null);
    } catch (e:any) {
      setDialog({ isOpen: true, title: "系統錯誤", msg: "保存時發生異常", type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // 刪除規則確認
  const confirmDelete = (idx: number) => {
    setDialog({
      isOpen: true,
      title: "刪除確認",
      msg: "確定要刪除這條轉發規則嗎？此操作無法恢復。",
      type: "confirm",
      onConfirm: async () => {
        const newRules = [...rules];
        newRules.splice(idx, 1);
        setRules(newRules);
        await api("SAVE_RULES", { nodeId: selected, rules: newRules });
        fetchAllData();
        setDialog(null);
      }
    });
  };

  // 打開導出
  const handleOpenExport = () => {
    const text = rules.map(r => `${r.name || ''} ${r.listen_port}|${r.dest_ip}|${r.dest_port}|${r.protocol}`).join("\n");
    setBatchText(text);
    setBatchMode('export');
    setIsBatchOpen(true);
    setBatchResult(null);
  };

  // 處理批量導入
  const handleBatchImport = async () => {
    const lines = batchText.split("\n").map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    let reasons: string[] =[];
    let tempRules = [...rules];

    lines.forEach((line, lineIdx) => {
      try {
        // 格式: Name(可選) 端口|IP|端口|協議
        const firstSpace = line.indexOf(' ');
        let name = "";
        let configStr = line;
        
        if (firstSpace !== -1 && !line.includes('|', 0) || (line.indexOf('|') > firstSpace)) {
           name = line.substring(0, firstSpace).trim();
           configStr = line.substring(firstSpace + 1).trim();
        }

        const parts = configStr.split('|');
        if (parts.length !== 4) throw new Error("格式不正確 (需包含3個 '|')");

        const newRule = {
          name: name,
          listen_port: parts[0].trim(),
          dest_ip: parts[1].trim(),
          dest_port: parts[2].trim(),
          protocol: parts[3].trim().toLowerCase()
        };

        const error = validateRule(newRule, tempRules);
        if (error) throw new Error(error);

        tempRules.push(newRule);
        successCount++;
      } catch (err: any) {
        failCount++;
        reasons.push(`第 ${lineIdx + 1} 行: ${err.message}`);
      }
    });

    if (successCount > 0) {
      await api("SAVE_RULES", { nodeId: selected, rules: tempRules });
      setRules(tempRules);
      fetchAllData();
    }

    setBatchResult({ total: lines.length, success: successCount, fail: failCount, reasons });
  };

  // 觸發診斷
  const handleDiagnose = (rule: any) => {
    const isRange = rule.listen_port.includes('-');
    setDiagState({
      isOpen: true,
      rule,
      step: isRange ? 'input' : 'testing',
      specificPort: isRange ? "" : rule.listen_port,
      resultData: null
    });
    if (!isRange) runDiagnostic(rule, rule.listen_port);
  };

  // 執行診斷 (真實調用後端 API)
  const runDiagnostic = async (rule: any, port: string) => {
    if (!isValidPort(port) || port.includes('-')) {
      setDialog({ isOpen: true, title: "輸入錯誤", msg: "請輸入一個具體的有效端口數字", type: "error" });
      return;
    }
    setDiagState(prev => ({ ...prev, step: 'testing', specificPort: port, resultData: null }));
    
    try {
      // 1. 發送診斷請求到後端
      const reqRes = await api("DIAGNOSE_RULE", {
        nodeId: selected,
        dest_ip: rule.dest_ip,
        dest_port: port // 使用用戶輸入或默認的單端口
      });

      if (!reqRes || !reqRes.taskId) throw new Error("任務下發失敗");
      const taskId = reqRes.taskId;

      // 2. 開始輪詢查詢結果 (每 2 秒查一次，最多輪詢 15 次也就是大約 30 秒)
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const res = await api("GET_DIAGNOSE_RESULT", { taskId });
          if (res.success && res.result) {
            clearInterval(pollTimer);
            setDiagState(prev => ({
              ...prev,
              step: 'result',
              resultData: {
                total: res.result.total,
                success: res.result.success,
                fail: res.result.fail,
                path: `入口(${nodes.find((n:any)=>n.id===selected)?.name}) → 目標(${rule.dest_ip}:${port})`,
                status: res.result.status,
                latency: res.result.latency,
                loss: res.result.loss,
                quality: res.result.quality
              }
            }));
          } else if (attempts >= 15) {
            // 超時處理
            clearInterval(pollTimer);
            setDiagState(prev => ({
              ...prev,
              step: 'result',
              resultData: {
                total: 3, success: 0, fail: 3,
                path: `入口(${nodes.find((n:any)=>n.id===selected)?.name}) → 目標(${rule.dest_ip}:${port})`,
                status: "超時無響應", latency: "-", loss: "100%", quality: "節點離線或服務不通"
              }
            }));
          }
        } catch (err) {
          clearInterval(pollTimer);
          setDialog({ isOpen: true, title: "查詢失敗", msg: "輪詢結果時發生錯誤", type: "error" });
          setDiagState(p => ({...p, isOpen: false}));
        }
      }, 2000);

    } catch (error: any) {
      setDialog({ isOpen: true, title: "診斷失敗", msg: error.message || "網絡錯誤", type: "error" });
      setDiagState(p => ({...p, isOpen: false}));
    }
  };

  if (nodes.length === 0) return <div className="text-center py-10 font-bold text-gray-500">請先添加節點</div>;

  const protocolOptions =[ { label: "TCP", value: "tcp" }, { label: "UDP", value: "udp" }, { label: "TCP+UDP", value: "tcp,udp" } ];

  return (
    <div className="space-y-6">
      {/* 頂部節點選擇 */}
      <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
        {nodes.map((n: any) => (
          <motion.button 
            whileTap={{ scale: 0.95 }} key={n.id} onClick={() => setSelected(n.id)} 
            className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-colors ${selected === n.id ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)] shadow-md' : 'bg-[#F0F4EF] dark:bg-[#202522] text-gray-600 dark:text-gray-300'}`}
          >
            {n.name}
          </motion.button>
        ))}
      </div>

      {/* 主面板 */}
      <div className="bg-[#F0F4EF] dark:bg-[#202522] p-4 sm:p-6 rounded-[32px] space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
          <span className="font-bold text-xl text-gray-800 dark:text-gray-100">轉發規則</span>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white dark:bg-[#111318] rounded-full p-1 shadow-sm">
              <button onClick={() => setViewMode('card')} className={`p-2 rounded-full transition-colors ${viewMode === 'card' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-full transition-colors ${viewMode === 'table' ? 'bg-[var(--md-primary-container)] text-[var(--md-primary)]' : 'text-gray-400'}`}><List className="w-4 h-4" /></button>
            </div>
            
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setBatchText(""); setBatchMode('import'); setIsBatchOpen(true); setBatchResult(null); }} className="p-2.5 bg-white dark:bg-[#111318] text-gray-600 dark:text-gray-300 rounded-full shadow-sm"><Upload className="w-4 h-4" /></motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleOpenExport} className="p-2.5 bg-white dark:bg-[#111318] text-gray-600 dark:text-gray-300 rounded-full shadow-sm"><Download className="w-4 h-4" /></motion.button>
            
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: -1, sourceNodeId: selected, rule: { name: "", listen_port: "", dest_ip: "", dest_port: "", protocol: "tcp" } })} className="text-[var(--md-primary)] font-bold bg-[var(--md-primary-container)] px-5 py-2.5 rounded-full text-sm flex items-center gap-1 shadow-sm">
              <span className="text-lg leading-none">+</span> 添加規則
            </motion.button>
          </div>
        </div>
        
        {/* 規則展示區 */}
        <AnimatePresence mode="wait">
          {rules.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12 text-gray-400 text-sm font-bold bg-white dark:bg-[#111318] rounded-[24px]">暫無規則，請點擊上方按鈕添加或導入</motion.div>
          ) : viewMode === 'card' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {rules.map((r: any, idx: number) => (
                <div key={idx} className="bg-white dark:bg-[#111318] p-5 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-gray-800 dark:text-gray-200 text-lg truncate pr-2">{getDisplayName(r, idx)}</span>
                    <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#F0F4EF] dark:bg-[#202522] text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider shrink-0">
                      {r.protocol === "tcp,udp" ? "TCP+UDP" : r.protocol}
                    </div>
                  </div>
                  <div className="space-y-1.5 bg-gray-50 dark:bg-white/5 p-3 rounded-[16px]">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-12 text-gray-400 font-bold text-xs text-right">入站</div>
                      <span className="font-mono font-bold text-[var(--md-primary)]">{r.listen_port}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-12 text-gray-400 font-bold text-xs text-right">目標</div>
                      <span className="font-mono font-bold text-gray-700 dark:text-gray-300 truncate">{r.dest_ip}:{r.dest_port}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDiagnose(r)} className="p-2.5 text-[var(--md-primary)] bg-[var(--md-primary-container)] dark:bg-[var(--md-primary-container)] rounded-xl" title="診斷"><Activity className="w-4 h-4" /></motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, sourceNodeId: selected, rule: { ...r } })} className="p-2.5 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 rounded-xl"><Edit2 className="w-4 h-4" /></motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => confirmDelete(idx)} className="p-2.5 bg-red-50 text-red-500 dark:bg-red-900/20 rounded-xl"><Trash2 className="w-4 h-4" /></motion.button>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white dark:bg-[#111318] rounded-[24px] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#202522] text-gray-500 dark:text-gray-400 font-bold">
                    <tr>
                      <th className="p-4 whitespace-nowrap">名稱</th>
                      <th className="p-4 whitespace-nowrap">本地端口</th>
                      <th className="p-4 whitespace-nowrap">目標 IP : 端口</th>
                      <th className="p-4 whitespace-nowrap">協議</th>
                      <th className="p-4 text-right whitespace-nowrap">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono">
                    {rules.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-sans font-bold text-gray-800 dark:text-gray-200">{getDisplayName(r, idx)}</td>
                        <td className="p-4 text-[var(--md-primary)] font-bold">{r.listen_port}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">{r.dest_ip}:{r.dest_port}</td>
                        <td className="p-4"><span className="px-2 py-1 rounded-md bg-[#F0F4EF] dark:bg-[#202522] text-xs font-sans font-bold uppercase">{r.protocol}</span></td>
                        <td className="p-4 flex justify-end gap-2">
                           <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDiagnose(r)} className="p-2 text-[var(--md-primary)] bg-[var(--md-primary-container)] rounded-lg"><Activity className="w-4 h-4" /></motion.button>
                           <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditing({ index: idx, sourceNodeId: selected, rule: { ...r } })} className="p-2 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 rounded-lg"><Edit2 className="w-4 h-4" /></motion.button>
                           <motion.button whileTap={{ scale: 0.9 }} onClick={() => confirmDelete(idx)} className="p-2 bg-red-50 text-red-500 dark:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 編輯規則視窗 (嚴格符合圖2排版) */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSaving && setEditing(null)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col max-h-[90vh]">
              
              <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-white/5 shrink-0">
                <h3 className="text-xl font-bold">{editing.index === -1 ? "添加新規則" : "編輯規則"}</h3>
                <button onClick={() => !isSaving && setEditing(null)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:scale-105 transition-transform"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto hide-scrollbar relative">
                
                {/* 自定義名稱 */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-500 ml-1">自定義名稱 (選填)</label>
                  <input value={editing.rule.name || ""} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, name: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow text-gray-800 dark:text-gray-200 placeholder-gray-400" placeholder="留空將自動生成名稱" />
                </div>

                {/* 歸屬節點 (自定義下拉) */}
                <div className="space-y-1.5 relative z-30">
                  <label className="text-sm font-bold text-gray-500 ml-1">歸屬節點</label>
                  <div onClick={() => setOpenSelect(openSelect === 'node' ? null : 'node')} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)]">
                    <span className="truncate">{nodes.find((n:any) => n.id === editing.sourceNodeId)?.name || "選擇節點"}</span>
                    <motion.div animate={{ rotate: openSelect === 'node' ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-gray-500" /></motion.div>
                  </div>
                  <AnimatePresence>
                    {openSelect === 'node' && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[16px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-50">
                        {nodes.map((n:any) => (
                          <div key={n.id} onClick={() => { setEditing({ ...editing, sourceNodeId: n.id }); setOpenSelect(null); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.sourceNodeId === n.id ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                            {n.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 端口與協議並排 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-500 ml-1">本地端口/區間</label>
                    <input value={editing.rule.listen_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, listen_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow placeholder-gray-400" placeholder="如 8080 或 1000-2000" />
                  </div>
                  <div className="space-y-1.5 relative z-20">
                    <label className="text-sm font-bold text-gray-500 ml-1">協議</label>
                    <div onClick={() => setOpenSelect(openSelect === 'protocol' ? null : 'protocol')} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] text-sm font-bold flex justify-between items-center cursor-pointer outline-none focus:ring-2 ring-[var(--md-primary)]">
                      <span>{protocolOptions.find(o => o.value === editing.rule.protocol)?.label || "TCP"}</span>
                      <motion.div animate={{ rotate: openSelect === 'protocol' ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-gray-500" /></motion.div>
                    </div>
                    <AnimatePresence>
                      {openSelect === 'protocol' && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#2a2f2c] rounded-[16px] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden z-50">
                          {protocolOptions.map(o => (
                            <div key={o.value} onClick={() => { setEditing({ ...editing, rule: { ...editing.rule, protocol: o.value } }); setOpenSelect(null); }} className={`p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer font-bold text-sm transition-colors ${editing.rule.protocol === o.value ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : ''}`}>
                              {o.label}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 目標 IP */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-500 ml-1">目標 IP</label>
                  <input value={editing.rule.dest_ip} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_ip: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow placeholder-gray-400" placeholder="IPv4/IPv6 或 域名" />
                </div>

                {/* 目標端口 */}
                <div className="space-y-1.5 pb-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">目標端口 (對應本地)</label>
                  <input value={editing.rule.dest_port} onChange={e => setEditing({ ...editing, rule: { ...editing.rule, dest_port: e.target.value } })} className="w-full bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[16px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] transition-shadow placeholder-gray-400" placeholder="如 80 或 1000-2000" />
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3 shrink-0">
                <button onClick={() => setEditing(null)} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-[#F0F4EF] dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 text-gray-700 dark:text-gray-300">取消</button>
                <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity flex justify-center items-center gap-2 disabled:opacity-70">
                  {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : "保存規則"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 批量導入/導出視窗 */}
      <AnimatePresence>
        {isBatchOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBatchOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-[#111318] rounded-[32px] shadow-2xl flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold">{batchMode === 'import' ? '批量導入規則' : '批量導出規則'}</h3>
                <button onClick={() => setIsBatchOpen(false)} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {batchResult ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 dark:bg-white/5 rounded-[20px]">
                      <div className="text-center"><div className="text-2xl font-black">{batchResult.total}</div><div className="text-xs text-gray-500 font-bold">總數</div></div>
                      <div className="text-center text-green-500"><div className="text-2xl font-black">{batchResult.success}</div><div className="text-xs font-bold">成功</div></div>
                      <div className="text-center text-red-500"><div className="text-2xl font-black">{batchResult.fail}</div><div className="text-xs font-bold">失敗</div></div>
                    </div>
                    {batchResult.reasons.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-[20px] space-y-2">
                        <span className="font-bold text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> 失敗原因</span>
                        <ul className="text-sm text-red-400 space-y-1 font-mono list-disc pl-4">
                          {batchResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2 text-sm text-[var(--md-primary)] bg-[var(--md-primary-container)] p-4 rounded-[20px] font-bold">
                      <Info className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>格式：自定義名稱(可選) 原端口或區間|目標IP|目標端口|協議。<br/>每行一條，例如：<br/><span className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">MyWeb 80|192.168.1.2|8080|tcp</span></div>
                    </div>
                    <textarea value={batchText} onChange={e => setBatchText(e.target.value)} readOnly={batchMode === 'export'} className="w-full h-64 bg-[#F0F4EF] dark:bg-[#202522] p-4 rounded-[20px] font-mono text-sm outline-none focus:ring-2 ring-[var(--md-primary)] resize-none" placeholder="在此粘貼規則..." />
                  </>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-white/5 flex gap-3">
                {batchResult ? (
                  <button onClick={() => setBatchResult(null)} className="flex-1 py-3.5 rounded-full font-bold bg-[#F0F4EF] dark:bg-white/5 transition-colors">返回編輯</button>
                ) : (
                  <>
                    <button onClick={() => setIsBatchOpen(false)} className="flex-1 py-3.5 rounded-full font-bold bg-[#F0F4EF] dark:bg-white/5 transition-colors">取消</button>
                    {batchMode === 'import' ? (
                       <button onClick={handleBatchImport} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity">執行導入</button>
                    ) : (
                       <button onClick={() => { navigator.clipboard.writeText(batchText); setDialog({ isOpen: true, title: "成功", msg: "已複製到剪貼板", type: "info" }); }} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity">複製全部</button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 診斷視窗 (完美適配深/淺色模式，小螢幕全螢幕防止底欄遮擋) */}
      <AnimatePresence>
        {diagState.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDiagState(p => ({...p, isOpen: false}))} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-4xl bg-white dark:bg-[#1A1E29] text-gray-900 dark:text-gray-200 rounded-none md:rounded-[32px] shadow-2xl overflow-hidden border-0 md:border border-gray-200 dark:border-white/10 flex flex-col">
              
              <div className="p-4 md:p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#151922] shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">轉發診斷結果</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{diagState.rule?.name || diagState.rule?.listen_port}</span>
                </div>
                <div className="bg-[var(--md-primary-container)] text-[var(--md-primary)] px-4 py-1.5 rounded-full text-xs font-bold border border-[var(--md-primary)]/10">轉發服務</div>
              </div>

              {diagState.step === 'input' && (
                <div className="p-6 md:p-8 flex-1 flex flex-col items-center justify-center space-y-8 overflow-y-auto">
                  <div className="text-center space-y-3">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">輸入檢測端口</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">這是一個端口區間規則 ({diagState.rule.listen_port})，請輸入要測試的具體端口。</p>
                  </div>
                  <input type="number" value={diagState.specificPort} onChange={e => setDiagState({ ...diagState, specificPort: e.target.value })} className="w-full max-w-[280px] bg-gray-100 dark:bg-[#0F1219] border border-gray-200 dark:border-white/10 p-5 rounded-[20px] text-center font-mono text-2xl text-gray-900 dark:text-white outline-none focus:ring-2 ring-[var(--md-primary)] transition-all shadow-inner" placeholder="端口號" />
                  <div className="flex gap-4 w-full max-w-[280px]">
                    <button onClick={() => setDiagState(p => ({...p, isOpen: false}))} className="flex-1 py-3.5 rounded-full font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-300">取消</button>
                    <button onClick={() => runDiagnostic(diagState.rule, diagState.specificPort)} className="flex-1 py-3.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity">開始診斷</button>
                  </div>
                </div>
              )}

              {(diagState.step === 'testing' || diagState.step === 'result') && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6 flex-1 overflow-y-auto bg-white dark:bg-[#1A1E29]">
                  {/* 頂部三個數據卡片 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-gray-50 dark:bg-[#222736] border border-gray-100 dark:border-white/5 rounded-[24px] p-5 flex flex-col items-center justify-center gap-2">
                       <span className="text-3xl font-black text-gray-900 dark:text-white">{diagState.resultData?.total || "-"}</span>
                       <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">總測試數</span>
                    </div>
                    <div className="bg-green-50 dark:bg-[#1A3326] border border-green-200 dark:border-green-500/20 rounded-[24px] p-5 flex flex-col items-center justify-center gap-2">
                       <span className="text-3xl font-black text-green-600 dark:text-green-400">{diagState.resultData?.success || "-"}</span>
                       <span className="text-xs text-green-600/70 dark:text-green-500/70 font-bold">成功</span>
                    </div>
                    <div className="bg-red-50 dark:bg-[#3A1E22] border border-red-200 dark:border-red-500/20 rounded-[24px] p-5 flex flex-col items-center justify-center gap-2">
                       <span className="text-3xl font-black text-red-600 dark:text-red-400">{diagState.resultData?.fail || "-"}</span>
                       <span className="text-xs text-red-600/70 dark:text-red-500/70 font-bold">失敗</span>
                    </div>
                  </div>

                  {/* 提示信息 */}
                  <div className="bg-[var(--md-primary-container)]/30 dark:bg-[#222736] border border-[var(--md-primary)]/20 dark:border-white/5 rounded-[24px] p-4 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-400">
                    <Info className="w-5 h-5 shrink-0 text-[var(--md-primary)] dark:text-blue-400 mt-0.5" />
                    <span className="leading-relaxed font-medium">由於面板為被動模式，規則創建後請等大約 30 秒 agent 獲取生效。<br/>TCP ping 當出口沒有部署服務時顯示超時為正常現象。</span>
                  </div>

                  {/* 表格區域 */}
                  <div className="bg-white dark:bg-[#222736] border border-gray-200 dark:border-white/5 rounded-[24px] overflow-hidden shadow-sm">
                    <div className="bg-gray-50 dark:bg-[#293042] px-5 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-white/5">
                      <div className="w-1.5 h-4 bg-[var(--md-primary)] rounded-full"></div>
                      <span className="text-sm font-bold text-gray-800 dark:text-blue-300">入口測試</span>
                    </div>
                    <div className="overflow-x-auto hide-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-gray-500 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-white/5">
                          <tr>
                            <th className="p-4">路徑</th>
                            <th className="p-4 text-center">狀態</th>
                            <th className="p-4 text-center">延遲(ms)</th>
                            <th className="p-4 text-center">丟包率</th>
                            <th className="p-4 text-center">質量</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                          {diagState.step === 'testing' ? (
                            <tr><td colSpan={5} className="p-10 text-center text-[var(--md-primary)] dark:text-gray-500 flex justify-center items-center gap-3 font-bold"><RefreshCw className="w-5 h-5 animate-spin"/> 正在診斷中...</td></tr>
                          ) : (
                            <tr className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${diagState.resultData.status==='成功' ? 'text-green-500' : 'text-red-500'}`} />
                                  <div className="flex flex-col">
                                    <span className="text-gray-900 dark:text-gray-200 font-bold">{diagState.resultData.path}</span>
                                    <span className="text-xs text-gray-500 font-mono mt-0.5">{diagState.rule.dest_ip}:{diagState.rule.dest_port}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${diagState.resultData.status==='成功' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>{diagState.resultData.status}</span>
                              </td>
                              <td className={`p-4 text-center font-mono font-bold ${diagState.resultData.status==='成功' ? 'text-[var(--md-primary)] dark:text-blue-400' : 'text-gray-400'}`}>{diagState.resultData.latency}</td>
                              <td className={`p-4 text-center font-mono font-bold ${diagState.resultData.status==='成功' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>{diagState.resultData.loss}</td>
                              <td className="p-4 text-center">
                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center justify-center gap-1 mx-auto w-fit ${diagState.resultData.status==='成功' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{diagState.resultData.status==='成功'?'✨ ':''}{diagState.resultData.quality}</span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 md:p-6 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-[#151922] shrink-0 safe-area-pb">
                <button onClick={() => setDiagState(p => ({...p, isOpen: false}))} className="px-6 py-2.5 rounded-full font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">關閉</button>
                <button onClick={() => runDiagnostic(diagState.rule, diagState.specificPort)} disabled={diagState.step === 'testing'} className="px-6 py-2.5 rounded-full font-bold bg-[var(--md-primary)] text-[var(--md-on-primary)] hover:opacity-90 transition-opacity disabled:opacity-50">重新診斷</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 統一的 MD3 提示框 (取代 alert) */}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-sm bg-white dark:bg-[#1A1C1A] rounded-[28px] p-6 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {dialog.type === 'error' && <AlertCircle className="w-6 h-6 text-red-500" />}
                {dialog.type === 'info' && <Info className="w-6 h-6 text-[var(--md-primary)]" />}
                {dialog.type === 'confirm' && <AlertCircle className="w-6 h-6 text-orange-500" />}
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{dialog.title}</h3>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 font-bold">{dialog.msg}</div>
              <div className="flex justify-end gap-2 mt-2">
                {dialog.type === 'confirm' && (
                  <button onClick={() => setDialog(null)} className="px-4 py-2 rounded-full font-bold text-[var(--md-primary)] hover:bg-[var(--md-primary-container)] transition-colors">取消</button>
                )}
                <button onClick={() => { if(dialog.onConfirm) dialog.onConfirm(); else setDialog(null); }} className={`px-5 py-2 rounded-full font-bold text-white transition-colors ${dialog.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--md-primary)] hover:opacity-90'}`}>
                  {dialog.type === 'confirm' ? '確定' : '我知道了'}
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
