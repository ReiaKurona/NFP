import sys, json, time, base64, urllib.request, urllib.parse, subprocess, threading, os
import socket
from datetime import datetime

# 定義日誌文件路徑
LOG_FILE = "/var/log/aero-agent.log"

# 簡單的日誌記錄函數，寫入文件的同時輸出到終端
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_FILE, "a") as f: f.write(f"[{ts}] {msg}\n")
    except: pass
    print(msg)

# 讀取本地配置文件 config.json，包含面板地址、節點ID、通訊密鑰等
try:
    with open("config.json", "r") as f: CONFIG = json.load(f)
except: sys.exit(1) # 讀取失敗直接退出

# 拼接用於獲取轉發規則的 API URL
CONFIG_URL = f"{CONFIG['panel_url']}/agent?action=DOWNLOAD_CONFIG&node_id={CONFIG['node_id']}&token={CONFIG['token']}"

# --- 系統資源與流量監控模塊 ---
class Monitor:
    def __init__(self):
        self.last_net = self.read_net() # 記錄初始網絡流量
        self.last_time = time.time()    # 記錄初始時間

    # 讀取 /proc/net/dev 獲取網卡總流量
    def read_net(self):
        rx, tx = 0, 0
        try:
            with open("/proc/net/dev", "r") as f:
                lines = f.readlines()[2:] # 跳過前兩行表頭
                for line in lines:
                    parts = line.split(":")
                    if len(parts) < 2 or "lo" in parts[0]: continue # 跳過本地環回網卡(lo)
                    data = parts[1].split()
                    rx += int(data[0]) # 累加接收字節數 (Receive)
                    tx += int(data[8]) # 累加發送字節數 (Transmit)
        except: pass
        return (rx, tx)

    # 獲取系統當前狀態（CPU、內存、網速）
    def get_stats(self):
        try:
            # 讀取 CPU 1分鐘平均負載
            with open("/proc/loadavg", "r") as f: cpu_load = f.read().split()[0]
            
            # 讀取內存信息計算使用率
            mem_total, mem_avail = 0, 0
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if "MemTotal" in line: mem_total = int(line.split()[1])
                    if "MemAvailable" in line: mem_avail = int(line.split()[1])
            mem_usage = int(((mem_total - mem_avail) / mem_total * 100)) if mem_total > 0 else 0
            
            # 計算實時網速
            curr_net = self.read_net()
            curr_time = time.time()
            diff = curr_time - self.last_time # 時間差
            rx_spd, tx_spd = 0, 0
            if diff > 0:
                rx_spd = int((curr_net[0] - self.last_net[0]) / diff) # B/s
                tx_spd = int((curr_net[1] - self.last_net[1]) / diff)
            self.last_net = curr_net
            self.last_time = curr_time

            # 網速單位格式化函數
            def fmt(b):
                if b < 1024: return f"{b} B/s"
                elif b < 1048576: return f"{b/1024:.1f} KB/s"
                else: return f"{b/1048576:.1f} MB/s"

            # 返回給面板的數據字典
            return {
                "cpu_load": cpu_load, "ram_usage": str(mem_usage),
                "rx_speed": fmt(rx_spd), "tx_speed": fmt(tx_spd),
                "rx_total": f"{curr_net[0]/1073741824:.2f} GB", "tx_total": f"{curr_net[1]/1073741824:.2f} GB",
                "goroutines": threading.active_count() # 這裡變量名叫 goroutines，但實際是 Python 的線程數，可能是為了兼容 Go 語言寫的面板
            }
        except: return {}

monitor = Monitor()

# --- 核心路由轉發模塊 (nftables) ---
class SystemUtils:
    @staticmethod
    def apply_rules(rules):
        log(f"Syncing {len(rules)} rules...")
        
        # 動態拼接 nftables 腳本內容
        nft = "table ip aeronode { }\n"         # 聲明一個名為 aeronode 的 IPv4 表
        nft += "flush table ip aeronode\n\n"    # 清空舊規則，防止規則疊加

        nft += "table ip aeronode {\n"
        # 1. PREROUTING 鏈 (DNAT：目標地址轉換，用於將外部請求端口映射到目標服務器)
        nft += "    chain prerouting {\n"
        # [修改] 優先級調整為 -110，確保在 Docker (-100) 之前執行，避免規則被覆蓋
        nft += "        type nat hook prerouting priority -110;\n"
        
        for r in rules:
            p = r.get("protocol", "tcp") # 協議，默認 TCP
            sport = r["listen_port"]     # 節點監聽端口
            dip = r["dest_ip"]           # 落地機(目標) IP
            dport = r["dest_port"]       # 落地機(目標) 端口
            
            # 寫入 DNAT 規則
            if p == "tcp,udp" or p == "tcp+udp":
                nft += f"        tcp dport {sport} dnat to {dip}:{dport}\n"
                nft += f"        udp dport {sport} dnat to {dip}:{dport}\n"
            else:
                nft += f"        {p} dport {sport} dnat to {dip}:{dport}\n"
                
        nft += "    }\n\n"
        
        # 2. POSTROUTING 鏈 (SNAT/Masquerade：源地址轉換/偽裝，讓目標服務器把回包發給中轉機)
        nft += "    chain postrouting {\n"
        nft += "        type nat hook postrouting priority 100;\n"
        
        target_ips = set(r["dest_ip"] for r in rules) # 獲取所有去重的落地機 IP
        for dip in target_ips:
            # 對發往落地機的流量進行源 IP 偽裝 (替換為本機 IP)
            nft += f"        ip daddr {dip} masquerade\n" 
            
        nft += "    }\n"
        nft += "}\n"

        # [新增] 針對 Docker 環境的修復：在 filter 表的 DOCKER-USER 鏈中放行轉發流量
        # 防止因 FORWARD 鏈默認 DROP 策略導致轉發失敗
        nft += "\n# Fix for Docker DROP policy in FORWARD chain\n"
        nft += "table ip filter {\n"
        nft += "    chain DOCKER-USER {\n"
        for r in rules:
            p = r.get("protocol", "tcp")
            dip = r["dest_ip"]
            dport = r["dest_port"]
            
            # 注意：此處匹配的是 DNAT 之後的目標 IP (落地機 IP)
            if p == "tcp,udp" or p == "tcp+udp":
                nft += f"        ip daddr {dip} tcp dport {dport} accept\n"
                nft += f"        ip daddr {dip} udp dport {dport} accept\n"
            else:
                nft += f"        ip daddr {dip} {p} dport {dport} accept\n"
        nft += "    }\n"
        nft += "}\n"
        
        # 將生成的規則寫入文件並執行
        try:
            with open("rules.nft", "w") as f: f.write(nft)
            # 執行 nft -f rules.nft 應用規則
            res = subprocess.run([CONFIG.get("nft_bin", "nft"), "-f", "rules.nft"], capture_output=True, text=True)
            if res.returncode != 0:
                log(f"Nftables Error: {res.stderr}")
            else:
                log("Rules applied successfully.")
        except Exception as e:
            log(f"Apply Error: {e}")

# --- 網絡請求與主循環模塊 ---

# 從面板下載轉發規則並應用
def download_and_apply_config():
    try:
        req = urllib.request.Request(CONFIG_URL, headers={'User-Agent': 'AeroAgent/8.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get("success") and "rules" in data:
                    SystemUtils.apply_rules(data["rules"]) # 應用規則
            else:
                log(f"Download failed: HTTP {resp.status}")
    except Exception as e:
        log(f"Download Exception: {e}")


# --- 新增：診斷模塊 (TCP Ping) ---
def tcp_ping(ip, port, count=3):
    latencies =[]
    success = 0
    for _ in range(count):
        start = time.time()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2.0) # 設置 2 秒超時
            s.connect((ip, int(port)))
            s.close()
            # 記錄延遲(毫秒)
            latencies.append((time.time() - start) * 1000)
            success += 1
        except Exception as e:
            pass # 失敗則不記錄到 latencies
        time.sleep(0.2)
    
    if success > 0:
        avg_lat = sum(latencies) / len(latencies)
        loss = ((count - success) / count) * 100
        quality = "很好" if avg_lat < 100 else "一般" if avg_lat < 250 else "較差"
        return {
            "status": "成功",
            "latency": int(avg_lat),
            "loss": f"{loss:.1f}%",
            "quality": quality,
            "success": success,
            "fail": count - success,
            "total": count
        }
    else:
        return {
            "status": "超時",
            "latency": "-",
            "loss": "100%",
            "quality": "不可達",
            "success": 0,
            "fail": count,
            "total": count
        }

def run_diagnose_task(task_data):
    try:
        task_id = task_data.get("taskId")
        ip = task_data.get("dest_ip")
        port = task_data.get("dest_port")
        log(f"Running diagnose task {task_id} for {ip}:{port}")
        
        # 執行 TCP Ping 測試
        result = tcp_ping(ip, port)
        
        # 構造彙報請求
        payload = {
            "nodeId": CONFIG["node_id"],
            "token": CONFIG["token"],
            "taskId": task_id,
            "result": result
        }
        b64 = base64.b64encode(json.dumps(payload).encode()).decode()
        url = f"{CONFIG['panel_url']}/agent?action=REPORT_DIAGNOSE&data={urllib.parse.quote(b64)}"
        
        req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/8.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                log(f"Diagnose result for {task_id} reported successfully.")
            else:
                log(f"Failed to report diagnose: HTTP {resp.status}")
    except Exception as e:
        log(f"Diagnose task error: {e}")

# 程序主循環
def loop():
    log(f"Agent started. Config URL: {CONFIG_URL}")
    download_and_apply_config() # 啟動時先同步一次規則
    last_sync = time.time()
    
    while True:
        interval = 15 # 默認心跳間隔 75 秒
        try:
            # 構建心跳數據包（包含節點認證和系統狀態）
            payload = { "nodeId": CONFIG["node_id"], "token": CONFIG["token"], "stats": monitor.get_stats() }
            # 轉為 JSON 後進行 Base64 編碼，再進行 URL 編碼
            b64 = base64.b64encode(json.dumps(payload).encode()).decode()
            url = f"{CONFIG['panel_url']}/agent?action=HEARTBEAT&data={urllib.parse.quote(b64)}"
            req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/8.0'})
            
            # 發送心跳請求
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("interval"): interval = data["interval"] # 允許面板動態調整心跳間隔
                    
                    # 檢查是否有測試任務
                    if "diag_task" in data and data["diag_task"]:
                        # 開啟新線程執行測試任務，避免阻塞心跳和主循環
                        threading.Thread(target=run_diagnose_task, args=(data["diag_task"],)).start()

                    # 如果面板下發了更新指令 (has_cmd)，或者距離上次同步超過 180 秒，則重新拉取規則
                    if data.get("has_cmd") or (time.time() - last_sync > 180):
                        download_and_apply_config()
                        last_sync = time.time()
        except Exception as e:
            log(f"Heartbeat Error: {e}")
        
        time.sleep(interval) # 休眠等待下一次心跳

if __name__ == "__main__":
    try:
        # 核心：開啟 Linux 內核的 IPv4 轉發功能，否則 nftables 的轉發無效
        with open("/proc/sys/net/ipv4/ip_forward", "w") as f: f.write("1")
    except: pass
    loop()
