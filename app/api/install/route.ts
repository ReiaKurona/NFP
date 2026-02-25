import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
# AeroNode V5.1 - 穩定性增強版 (修復 nftables 下發 / 增加網速內存監控)

RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 安裝 V5.1 增強版 Agent... \${NC}"

# 1. 參數解析
TOKEN=""
NODE_ID=""
PANEL_URL="${panelUrl}"
PORT="8080"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        --id) NODE_ID="$2"; shift ;;
        --panel) PANEL_URL="$2"; shift ;;
        --port) PORT="$2"; shift ;;
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

# 2. 環境檢查
install_packages() {
    if [ -f /etc/debian_version ]; then
        apt-get update -q && apt-get install -y -q python3 python3-pip python3-venv python3-full nftables
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3 python3-pip nftables
    fi
}
if ! command -v pip3 &> /dev/null || ! command -v nft &> /dev/null; then
    echo -e "正在安裝必要組件..."
    install_packages
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 3. 虛擬環境
rm -rf venv
python3 -m venv venv
./venv/bin/pip install --upgrade pip --index-url https://pypi.tuna.tsinghua.edu.cn/simple
./venv/bin/pip install pycryptodome requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 4. 寫入 Python Agent
cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL", "port": $PORT }
EOF

cat > agent.py << 'PYEOF'
import sys, json, time, base64, urllib.request, urllib.parse, subprocess, threading, os
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

# 依賴檢查
try:
    from Crypto.Cipher import AES
    from Crypto.Hash import SHA256
except ImportError:
    print("Error: PyCryptodome not installed")
    sys.exit(1)

# 加載配置
with open("config.json", "r") as f: CONFIG = json.load(f)

# --- 監控模組 (新增：網速/內存) ---
class Monitor:
    def __init__(self):
        self.last_net = self.read_net()
        self.last_time = time.time()

    def read_net(self):
        # 讀取所有網卡的流量總和 (排除 lo)
        rx_total, tx_total = 0, 0
        try:
            with open("/proc/net/dev", "r") as f:
                lines = f.readlines()[2:]
                for line in lines:
                    parts = line.split(":")
                    if len(parts) < 2: continue
                    if "lo" in parts[0]: continue # 跳過 Loopback
                    data = parts[1].split()
                    rx_total += int(data[0])
                    tx_total += int(data[8])
        except: pass
        return (rx_total, tx_total)

    def get_stats(self):
        # CPU
        try:
            with open("/proc/loadavg", "r") as f: cpu_load = f.read().split()[0]
        except: cpu_load = "0.0"

        # RAM
        mem_total, mem_avail = 0, 0
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if "MemTotal" in line: mem_total = int(line.split()[1])
                    if "MemAvailable" in line: mem_avail = int(line.split()[1])
        except: pass
        mem_usage = int(((mem_total - mem_avail) / mem_total * 100)) if mem_total > 0 else 0

        # Network Speed
        curr_net = self.read_net()
        curr_time = time.time()
        diff_time = curr_time - self.last_time
        
        rx_speed = 0
        tx_speed = 0
        
        if diff_time > 0:
            rx_speed = int((curr_net[0] - self.last_net[0]) / diff_time)
            tx_speed = int((curr_net[1] - self.last_net[1]) / diff_time)
        
        self.last_net = curr_net
        self.last_time = curr_time

        # 格式化單位
        def fmt_bytes(b):
            if b < 1024: return f"{b} B/s"
            elif b < 1048576: return f"{b/1024:.1f} KB/s"
            else: return f"{b/1048576:.1f} MB/s"

        return {
            "cpu_load": cpu_load,
            "ram_usage": f"{mem_usage}",
            "rx_speed": fmt_bytes(rx_speed),
            "tx_speed": fmt_bytes(tx_speed),
            "rx_total": f"{curr_net[0]/1073741824:.2f} GB",
            "tx_total": f"{curr_net[1]/1073741824:.2f} GB",
            "goroutines": threading.active_count()
        }

monitor = Monitor()

# --- 系統操作 (修復：原子化寫入 nftables) ---
class SystemUtils:
    @staticmethod
    def apply_rules(rules):
        print(f"Applying {len(rules)} rules...")
        # 生成 nft 配置文件
        nft_content = "flush ruleset\n"
        nft_content += "table ip nat {\n"
        nft_content += "  chain PREROUTING { type nat hook prerouting priority -100; }\n"
        nft_content += "  chain POSTROUTING { type nat hook postrouting priority 100; }\n"
        
        for r in rules:
            p = r.get("protocol", "tcp")
            sport = r["listen_port"]
            dip = r["dest_ip"]
            dport = r["dest_port"]
            # 支持端口區間
            nft_content += f"  add rule nat PREROUTING {p} dport {sport} counter dnat to {dip}:{dport}\n"
            nft_content += f"  add rule nat POSTROUTING ip daddr {dip} {p} dport {dport} counter masquerade\n"
        
        nft_content += "}\n"
        
        # 寫入文件並加載
        try:
            with open("rules.nft", "w") as f: f.write(nft_content)
            result = subprocess.run(["nft", "-f", "rules.nft"], capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Nftables Error: {result.stderr}")
            else:
                print("Nftables rules updated successfully.")
        except Exception as e:
            print(f"Failed to apply rules: {e}")

# --- 加密與網絡 ---
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
            print(f"Decrypt Error: {e}")
            return None

def heartbeat_loop():
    while True:
        try:
            payload = {
                "nodeId": CONFIG["node_id"], "token": CONFIG["token"],
                "stats": monitor.get_stats() # 使用 Monitor 獲取數據
            }
            b64 = base64.b64encode(json.dumps(payload).encode()).decode()
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={urllib.parse.quote(b64)}"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/5.1'})
            # 強制 10s 超時，防止卡死
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("has_cmd"): fetch_config_active()
        except Exception as e:
            print(f"Heartbeat failed: {e}")
        time.sleep(10) # 10秒刷新一次狀態

def fetch_config_active():
    try:
        url = f"{CONFIG['panel_url']}/api"
        data = json.dumps({"action": "FETCH_CONFIG", "nodeId": CONFIG["node_id"], "token": CONFIG["token"]}).encode()
        req = urllib.request.Request(url, data=data, method="POST", headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = json.loads(resp.read().decode())
            decrypted = CryptoUtils.decrypt(raw['payload'], raw['iv'], CONFIG['token'])
            if decrypted: SystemUtils.apply_rules(decrypted['rules'])
    except Exception as e:
        print(f"Fetch config failed: {e}")

# 主動接收 Server
class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/sync':
            try:
                length = int(self.headers['Content-Length'])
                body = json.loads(self.rfile.read(length).decode())
                decrypted = CryptoUtils.decrypt(body['payload'], body['iv'], CONFIG['token'])
                if decrypted and decrypted.get('action') == 'APPLY':
                    SystemUtils.apply_rules(decrypted['rules'])
                    self.send_response(200); self.end_headers()
                    self.wfile.write(b'{"success": true}')
                    return
            except: pass
        self.send_response(403); self.end_headers()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer): pass

if __name__ == "__main__":
    # 確保開啟 IP Forwarding
    subprocess.run("sysctl -w net.ipv4.ip_forward=1 > /dev/null", shell=True)
    
    # 啟動線程
    threading.Thread(target=lambda: ThreadedHTTPServer(('0.0.0.0', int(CONFIG['port'])), RequestHandler).serve_forever(), daemon=True).start()
    heartbeat_loop()
PYEOF

# 5. 啟動服務
VENV_PYTHON="$INSTALL_DIR/venv/bin/python"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent V5.1
After=network.target
[Service]
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
echo -e "\n\${GREEN}✅ 安裝成功！(V5.1 監控增強版)\${NC}"
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}