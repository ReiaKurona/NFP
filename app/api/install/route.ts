import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
# AeroNode V6.0 - Root 終極穩定版

RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 安裝 V6.0 (Root 權限版)... \${NC}"

TOKEN=""
NODE_ID=""
PANEL_URL="${panelUrl}"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        --id) NODE_ID="$2"; shift ;;
        --panel) PANEL_URL="$2"; shift ;;
        *) ;;
    esac
    shift
done

if [ -z "$TOKEN" ] || [ -z "$NODE_ID" ]; then
    echo -e "\${RED}錯誤: 參數缺失。\${NC}"
    exit 1
fi

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"
LOG_FILE="/var/log/aero-agent.log"

# 1. 環境準備
echo -e "\${BLUE}[1/4] 準備依賴環境...\${NC}"
install_packages() {
    if [ -f /etc/debian_version ]; then
        apt-get update -q
        apt-get install -y -q python3 python3-pip python3-venv python3-full nftables
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3 python3-pip nftables
    elif [ -f /etc/alpine-release ]; then
        apk add python3 py3-pip nftables
    fi
}

if ! command -v pip3 &> /dev/null || ! command -v nft &> /dev/null; then
    install_packages
fi

# 2. 虛擬環境 (解決 pip 依賴問題)
echo -e "\${BLUE}[2/4] 構建 Python 虛擬環境...\${NC}"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR
rm -rf venv
python3 -m venv venv
./venv/bin/pip install --upgrade pip --index-url https://pypi.tuna.tsinghua.edu.cn/simple
./venv/bin/pip install pycryptodome requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 3. 部署 Agent 代碼
echo -e "\${BLUE}[3/4] 寫入 Agent 核心代碼...\${NC}"

# 尋找 nft 絕對路徑
NFT_BIN=$(command -v nft)
if [ -z "$NFT_BIN" ]; then NFT_BIN="/usr/sbin/nft"; fi

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL", "nft_bin": "$NFT_BIN" }
EOF

cat > agent.py << 'PYEOF'
import sys, json, time, base64, urllib.request, urllib.parse, subprocess, threading, os
from datetime import datetime

# 日誌設置
LOG_FILE = "/var/log/aero-agent.log"
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{ts}] {msg}\n")
    print(msg) # 同時輸出到 stdout 供 systemd 捕獲

try:
    from Crypto.Cipher import AES
    from Crypto.Hash import SHA256
except ImportError:
    log("CRITICAL: PyCryptodome import failed")
    sys.exit(1)

# 加載配置
try:
    with open("config.json", "r") as f: CONFIG = json.load(f)
except Exception as e:
    log(f"CRITICAL: Config load error: {e}")
    sys.exit(1)

class Monitor:
    def __init__(self):
        self.last_net = self.read_net()
        self.last_time = time.time()

    def read_net(self):
        rx, tx = 0, 0
        try:
            with open("/proc/net/dev", "r") as f:
                lines = f.readlines()[2:]
                for line in lines:
                    parts = line.split(":")
                    if len(parts) < 2 or "lo" in parts[0]: continue
                    data = parts[1].split()
                    rx += int(data[0])
                    tx += int(data[8])
        except Exception as e:
            log(f"Net read error: {e}")
        return (rx, tx)

    def get_stats(self):
        try:
            # CPU
            with open("/proc/loadavg", "r") as f: cpu_load = f.read().split()[0]
            
            # RAM
            mem_total, mem_avail = 0, 0
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if "MemTotal" in line: mem_total = int(line.split()[1])
                    if "MemAvailable" in line: mem_avail = int(line.split()[1])
            mem_usage = int(((mem_total - mem_avail) / mem_total * 100)) if mem_total > 0 else 0

            # NET
            curr_net = self.read_net()
            curr_time = time.time()
            diff = curr_time - self.last_time
            rx_spd, tx_spd = 0, 0
            if diff > 0:
                rx_spd = int((curr_net[0] - self.last_net[0]) / diff)
                tx_spd = int((curr_net[1] - self.last_net[1]) / diff)
            self.last_net = curr_net
            self.last_time = curr_time

            def fmt(b):
                if b < 1024: return f"{b} B/s"
                elif b < 1048576: return f"{b/1024:.1f} KB/s"
                else: return f"{b/1048576:.1f} MB/s"

            return {
                "cpu_load": cpu_load,
                "ram_usage": str(mem_usage),
                "rx_speed": fmt(rx_spd),
                "tx_speed": fmt(tx_spd),
                "rx_total": f"{curr_net[0]/1073741824:.2f} GB",
                "tx_total": f"{curr_net[1]/1073741824:.2f} GB",
                "goroutines": threading.active_count()
            }
        except Exception as e:
            log(f"Stats error: {e}")
            return {}

monitor = Monitor()

class SystemUtils:
    @staticmethod
    def apply_rules(rules):
        log(f"Applying {len(rules)} rules...")
        nft_content = "flush ruleset\n"
        nft_content += "table ip nat {\n"
        nft_content += "  chain PREROUTING { type nat hook prerouting priority -100; }\n"
        nft_content += "  chain POSTROUTING { type nat hook postrouting priority 100; }\n"
        
        for r in rules:
            p = r.get("protocol", "tcp")
            sport = r["listen_port"]
            dip = r["dest_ip"]
            dport = r["dest_port"]
            nft_content += f"  add rule nat PREROUTING {p} dport {sport} counter dnat to {dip}:{dport}\n"
            nft_content += f"  add rule nat POSTROUTING ip daddr {dip} {p} dport {dport} counter masquerade\n"
        nft_content += "}\n"
        
        try:
            with open("rules.nft", "w") as f: f.write(nft_content)
            # 使用配置中的 nft 路徑
            cmd = [CONFIG.get("nft_bin", "nft"), "-f", "rules.nft"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                log(f"Nftables Error: {res.stderr}")
            else:
                log("Rules applied successfully.")
        except Exception as e:
            log(f"Apply rules exception: {e}")

class CryptoUtils:
    @staticmethod
    def decrypt(encrypted_hex, iv_hex, token):
        try:
            key = SHA256.new(token.encode('utf-8')).digest()
            ciphertext = bytes.fromhex(encrypted_hex)
            iv = bytes.fromhex(iv_hex)
            cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
            return json.loads(cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:]).decode('utf-8'))
        except Exception as e:
            log(f"Decrypt failed: {e}")
            return None

def fetch_config():
    try:
        url = f"{CONFIG['panel_url']}/api"
        data = json.dumps({"action": "FETCH_CONFIG", "nodeId": CONFIG["node_id"], "token": CONFIG["token"]}).encode()
        req = urllib.request.Request(url, data=data, method="POST", headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = json.loads(resp.read().decode())
            decrypted = CryptoUtils.decrypt(raw['payload'], raw['iv'], CONFIG['token'])
            if decrypted: SystemUtils.apply_rules(decrypted['rules'])
    except Exception as e:
        log(f"Fetch config failed: {e}")

def loop():
    log("Agent loop started.")
    while True:
        interval = 30
        try:
            payload = {
                "nodeId": CONFIG["node_id"], "token": CONFIG["token"],
                "stats": monitor.get_stats()
            }
            b64 = base64.b64encode(json.dumps(payload).encode()).decode()
            # 確保 URL 編碼正確
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={urllib.parse.quote(b64)}"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/6.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("interval"): interval = data["interval"]
                    if data.get("has_cmd"): fetch_config()
        except urllib.error.HTTPError as e:
            log(f"HTTP Error {e.code}: {e.reason}")
        except urllib.error.URLError as e:
            log(f"Connection Error: {e.reason}")
        except Exception as e:
            log(f"Unexpected Error: {e}")
        
        time.sleep(interval)

if __name__ == "__main__":
    # 開啟 IP 轉發
    try:
        with open("/proc/sys/net/ipv4/ip_forward", "w") as f: f.write("1")
    except:
        log("Warning: Could not enable ip_forward")
        
    loop()
PYEOF

# 4. 創建服務 (強制 Root)
echo -e "\${BLUE}[4/4] 註冊 Root 服務...\${NC}"

VENV_PYTHON="$INSTALL_DIR/venv/bin/python"

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Root Agent
After=network.target
[Service]
# 關鍵：強制以 Root 運行
User=root
Group=root
ExecStart=$VENV_PYTHON -u $INSTALL_DIR/agent.py
WorkingDirectory=$INSTALL_DIR
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "\n\${GREEN}✅ 安裝成功！Root Agent 正在運行。\${NC}"
    echo -e "日誌文件位置: $LOG_FILE"
    echo -e "如果面板顯示離線，請執行: \${YELLOW}tail -f $LOG_FILE\${NC} 查看原因。"
else
    echo -e "\n\${RED}❌ 啟動失敗！請查看錯誤日誌：\${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
fi
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}