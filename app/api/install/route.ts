import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
# AeroNode V7.0 - Config Pull Mode (配置託管版)

RED='\\033[0;31m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 安裝 V7.0 (配置鏈接版)... \${NC}"

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

# 1. 依賴
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

# 2. 虛擬環境
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR
rm -rf venv
python3 -m venv venv
./venv/bin/pip install --upgrade pip --index-url https://pypi.tuna.tsinghua.edu.cn/simple
./venv/bin/pip install pycryptodome requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 3. 部署代碼
NFT_BIN=$(command -v nft)
if [ -z "$NFT_BIN" ]; then NFT_BIN="/usr/sbin/nft"; fi

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL", "nft_bin": "$NFT_BIN" }
EOF

cat > agent.py << 'PYEOF'
import sys, json, time, base64, urllib.request, urllib.parse, subprocess, threading, os
from datetime import datetime

LOG_FILE = "/var/log/aero-agent.log"
def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with open(LOG_FILE, "a") as f: f.write(f"[{ts}] {msg}\\n")
    except: pass
    print(msg)

try:
    from Crypto.Cipher import AES
    from Crypto.Hash import SHA256
except ImportError:
    log("CRITICAL: PyCryptodome import failed")
    sys.exit(1)

try:
    with open("config.json", "r") as f: CONFIG = json.load(f)
except: sys.exit(1)

# 構建專屬配置下載鏈接
CONFIG_URL = f"{CONFIG['panel_url']}/api?action=DOWNLOAD_CONFIG&node_id={CONFIG['node_id']}&token={CONFIG['token']}"

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
        except: pass
        return (rx, tx)

    def get_stats(self):
        try:
            with open("/proc/loadavg", "r") as f: cpu_load = f.read().split()[0]
            mem_total, mem_avail = 0, 0
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if "MemTotal" in line: mem_total = int(line.split()[1])
                    if "MemAvailable" in line: mem_avail = int(line.split()[1])
            mem_usage = int(((mem_total - mem_avail) / mem_total * 100)) if mem_total > 0 else 0
            
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
        except: return {}

monitor = Monitor()

class SystemUtils:
    @staticmethod
    def apply_rules(rules):
        # 簡單比較 Hash 或長度，這裡為了穩定，每次都刷新
        log(f"Syncing {len(rules)} rules...")
        nft = "flush ruleset\\n"
        nft += "table ip nat {\\n"
        nft += "  chain PREROUTING { type nat hook prerouting priority -100; }\\n"
        nft += "  chain POSTROUTING { type nat hook postrouting priority 100; }\\n"
        for r in rules:
            p = r.get("protocol", "tcp")
            sport = r["listen_port"]
            dip = r["dest_ip"]
            dport = r["dest_port"]
            nft += f"  add rule nat PREROUTING {p} dport {sport} counter dnat to {dip}:{dport}\\n"
            nft += f"  add rule nat POSTROUTING ip daddr {dip} {p} dport {dport} counter masquerade\\n"
        nft += "}\\n"
        
        try:
            with open("rules.nft", "w") as f: f.write(nft)
            subprocess.run([CONFIG.get("nft_bin", "nft"), "-f", "rules.nft"], check=True)
            log("Rules updated successfully.")
        except Exception as e:
            log(f"Nftables Error: {e}")

class CryptoUtils:
    @staticmethod
    def decrypt(raw_json, token):
        try:
            obj = json.loads(raw_json)
            key = SHA256.new(token.encode('utf-8')).digest()
            ciphertext = bytes.fromhex(obj['payload'])
            iv = bytes.fromhex(obj['iv'])
            cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
            return json.loads(cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:]).decode('utf-8'))
        except Exception as e:
            log(f"Decrypt Error: {e}")
            return None

def download_and_apply_config():
    try:
        req = urllib.request.Request(CONFIG_URL, headers={'User-Agent': 'AeroAgent/7.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                raw = resp.read().decode()
                data = CryptoUtils.decrypt(raw, CONFIG['token'])
                if data and 'rules' in data:
                    SystemUtils.apply_rules(data['rules'])
    except Exception as e:
        log(f"Config download failed: {e}")

def loop():
    log("Agent started.")
    # 啟動時先拉取一次配置
    download_and_apply_config()
    
    last_sync = time.time()
    
    while True:
        interval = 30
        try:
            # 1. 發送心跳
            payload = { "nodeId": CONFIG["node_id"], "token": CONFIG["token"], "stats": monitor.get_stats() }
            b64 = base64.b64encode(json.dumps(payload).encode()).decode()
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={urllib.parse.quote(b64)}"
            req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/7.0'})
            
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("interval"): interval = data["interval"]
                    # 2. 如果面板通知有更新，或者距離上次更新超過 60 秒，則拉取配置
                    if data.get("has_cmd") or (time.time() - last_sync > 60):
                        download_and_apply_config()
                        last_sync = time.time()
                        
        except Exception as e:
            log(f"Heartbeat Error: {e}")
        
        time.sleep(interval)

if __name__ == "__main__":
    try:
        with open("/proc/sys/net/ipv4/ip_forward", "w") as f: f.write("1")
    except: pass
    loop()
PYEOF

# 4. 服務
VENV_PYTHON="$INSTALL_DIR/venv/bin/python"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent
After=network.target
[Service]
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
echo -e "\\n\${GREEN}✅ Agent V7.0 安裝成功！日誌: $LOG_FILE \${NC}"
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}