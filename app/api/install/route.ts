import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
# ... (前面安裝依賴部分保持不變，為節省篇幅直接從 Python 代碼開始) ...
# 完整腳本如下：

# 定義顏色
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[0;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 開始安裝 V5.0 (雙模互補版)... \${NC}"

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

# 2. 安裝 Python 環境 (自動判斷)
echo -e "\${BLUE}[1/4] 準備 Python 環境...\${NC}"
install_packages() {
    if [ -f /etc/debian_version ]; then
        apt-get update -q && apt-get install -y -q python3 python3-pip python3-venv python3-full
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3 python3-pip
    elif [ -f /etc/alpine-release ]; then
        apk add python3 py3-pip
    fi
}
if ! command -v pip3 &> /dev/null || ! python3 -m venv --help &> /dev/null; then
    install_packages
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 3. 虛擬環境
echo -e "\${BLUE}[2/4] 構建虛擬環境...\${NC}"
rm -rf venv
python3 -m venv venv
./venv/bin/pip install --upgrade pip --index-url https://pypi.tuna.tsinghua.edu.cn/simple
./venv/bin/pip install pycryptodome requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple

# 4. 寫入 Python 雙模 Agent
echo -e "\${BLUE}[3/4] 部署雙模 Agent...\${NC}"

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL", "port": $PORT }
EOF

cat > agent.py << 'PYEOF'
import sys
import json
import time
import base64
import urllib.request
import urllib.parse
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

try:
    from Crypto.Cipher import AES
    from Crypto.Hash import SHA256
except ImportError:
    sys.exit(1)

with open("config.json", "r") as f:
    CONFIG = json.load(f)

# --- 工具類 ---
class CryptoUtils:
    @staticmethod
    def decrypt(encrypted_hex, iv_hex, token):
        try:
            key = SHA256.new(token.encode('utf-8')).digest()
            ciphertext = bytes.fromhex(encrypted_hex)
            iv = bytes.fromhex(iv_hex)
            tag = ciphertext[-16:]
            real_ciphertext = ciphertext[:-16]
            cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
            return json.loads(cipher.decrypt_and_verify(real_ciphertext, tag).decode('utf-8'))
        except:
            return None

class SystemUtils:
    @staticmethod
    def get_stats():
        try:
            with open("/proc/loadavg", "r") as f: load = f.read().split()[0]
        except: load = "0.0"
        return {"cpu_load": load, "goroutines": threading.active_count()}

    @staticmethod
    def apply_rules(rules):
        subprocess.run("nft flush chain ip nat PREROUTING", shell=True)
        subprocess.run("nft flush chain ip nat POSTROUTING", shell=True)
        for r in rules:
            p = r.get("protocol", "tcp")
            subprocess.run(f"nft add rule ip nat PREROUTING {p} dport {r['listen_port']} counter dnat to {r['dest_ip']}:{r['dest_port']}", shell=True)
            subprocess.run(f"nft add rule ip nat POSTROUTING ip daddr {r['dest_ip']} {p} dport {r['dest_port']} counter masquerade", shell=True)
        print(f"Applied {len(rules)} rules.")

    @staticmethod
    def init_nftables():
        for cmd in [
            "nft add table ip nat",
            "nft add chain ip nat PREROUTING { type nat hook prerouting priority -100; }",
            "nft add chain ip nat POSTROUTING { type nat hook postrouting priority 100; }"
        ]:
            subprocess.run(cmd, shell=True)

# --- 模式 1: 被動輪詢 (Client) ---
def heartbeat_loop():
    while True:
        try:
            payload = {
                "nodeId": CONFIG["node_id"],
                "token": CONFIG["token"],
                "stats": SystemUtils.get_stats()
            }
            b64 = base64.b64encode(json.dumps(payload).encode()).decode()
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={urllib.parse.quote(b64)}"
            
            req = urllib.request.Request(url, headers={'User-Agent': 'AeroAgent/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    if data.get("has_cmd"): # 被動收到指令
                        fetch_config_active()
        except Exception as e:
            print(f"Heartbeat error: {e}")
        time.sleep(15) # 15秒心跳

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
        print(f"Fetch config error: {e}")

# --- 模式 2: 主動接收 (Server) ---
class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/sync':
            length = int(self.headers['Content-Length'])
            body = json.loads(self.rfile.read(length).decode())
            # 解密驗證
            decrypted = CryptoUtils.decrypt(body['payload'], body['iv'], CONFIG['token'])
            
            if decrypted and decrypted.get('action') == 'APPLY':
                SystemUtils.apply_rules(decrypted['rules'])
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode())
                return
            
        self.send_response(403)
        self.end_headers()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer): pass

def server_loop():
    server = ThreadedHTTPServer(('0.0.0.0', CONFIG['port']), RequestHandler)
    print(f"Listening on port {CONFIG['port']}")
    server.serve_forever()

# --- 入口 ---
if __name__ == "__main__":
    SystemUtils.init_nftables()
    # 啟動雙線程
    threading.Thread(target=server_loop, daemon=True).start()
    heartbeat_loop()
PYEOF

# 5. 啟動服務
VENV_PYTHON="$INSTALL_DIR/venv/bin/python"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Dual Agent
After=network.target
[Service]
ExecStart=$VENV_PYTHON -u $INSTALL_DIR/agent.py
WorkingDirectory=$INSTALL_DIR
Restart=always
Environment=PYTHONUNBUFFERED=1
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME
echo -e "\n\${GREEN}✅ 安裝成功！雙模 Agent 已啟動。\${NC}"
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}