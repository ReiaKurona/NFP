import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash

# 定義顏色
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[0;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 開始安裝 V4.1 (Python 虛擬環境版)... \${NC}"

# 1. 參數解析
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
    echo -e "\${RED}錯誤: 參數缺失。請從面板複製完整指令。\${NC}"
    exit 1
fi

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"

# 2. 強制安裝 Python3 和 venv 模組
echo -e "\${BLUE}[1/4] 準備 Python 環境...\${NC}"

install_packages() {
    if [ -f /etc/debian_version ]; then
        apt-get update -q
        # 同時安裝 python3-full 以確保有 venv
        apt-get install -y -q python3 python3-pip python3-venv python3-full
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3 python3-pip
    elif [ -f /etc/alpine-release ]; then
        apk add python3 py3-pip
    fi
}

# 即使有 python3 也要確保有 pip 和 venv
if ! command -v pip3 &> /dev/null || ! python3 -m venv --help &> /dev/null; then
    echo -e "\${YELLOW}正在補全 Python 組件 (pip/venv)...\${NC}"
    install_packages
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 3. 創建虛擬環境並安裝依賴 (關鍵修復)
echo -e "\${BLUE}[2/4] 構建虛擬環境 (解決依賴衝突)...\${NC}"

# 刪除舊環境以防萬一
rm -rf venv

# 創建 venv
python3 -m venv venv

# 激活 venv 並安裝依賴
# 使用 venv 裡的 pip，無需 root 權限，也不受系統限制
./venv/bin/pip install --upgrade pip --index-url https://pypi.tuna.tsinghua.edu.cn/simple
if ! ./venv/bin/pip install pycryptodome requests --index-url https://pypi.tuna.tsinghua.edu.cn/simple; then
    echo -e "\${RED}依賴安裝失敗！\${NC}"
    exit 1
fi

# 4. 寫入 Python Agent 代碼
echo -e "\${BLUE}[3/4] 部署 Agent 代碼...\${NC}"

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL" }
EOF

cat > agent.py << 'PYEOF'
import sys
import json
import time
import base64
import urllib.request
import urllib.parse
import subprocess
import os

# 嘗試導入加密庫
try:
    from Crypto.Cipher import AES
    from Crypto.Hash import SHA256
except ImportError:
    print("CRITICAL: PyCryptodome not installed correctly.")
    sys.exit(1)

try:
    with open("config.json", "r") as f:
        CONFIG = json.load(f)
except:
    print("Config file not found")
    sys.exit(1)

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
            plaintext = cipher.decrypt_and_verify(real_ciphertext, tag)
            return json.loads(plaintext.decode('utf-8'))
        except Exception as e:
            print(f"Decryption failed: {e}")
            return None

class SystemUtils:
    @staticmethod
    def get_stats():
        try:
            with open("/proc/loadavg", "r") as f:
                load = f.read().split()[0]
        except:
            load = "0.0"
        return {"cpu_load": load, "goroutines": 1}

    @staticmethod
    def run_nft_cmd(cmd):
        subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    @staticmethod
    def apply_rules(rules):
        SystemUtils.run_nft_cmd("nft flush chain ip nat PREROUTING")
        SystemUtils.run_nft_cmd("nft flush chain ip nat POSTROUTING")
        for r in rules:
            p = r.get("protocol", "tcp")
            sport = r["listen_port"]
            dip = r["dest_ip"]
            dport = r["dest_port"]
            
            dnat = f"nft add rule ip nat PREROUTING {p} dport {sport} counter dnat to {dip}:{dport}"
            SystemUtils.run_nft_cmd(dnat)
            
            snat = f"nft add rule ip nat POSTROUTING ip daddr {dip} {p} dport {dport} counter masquerade"
            SystemUtils.run_nft_cmd(snat)

    @staticmethod
    def init_nftables():
        SystemUtils.run_nft_cmd("nft add table ip nat")
        SystemUtils.run_nft_cmd("nft add chain ip nat PREROUTING { type nat hook prerouting priority -100; }")
        SystemUtils.run_nft_cmd("nft add chain ip nat POSTROUTING { type nat hook postrouting priority 100; }")

class NetworkClient:
    @staticmethod
    def heartbeat():
        try:
            payload = {
                "nodeId": CONFIG["node_id"],
                "token": CONFIG["token"],
                "stats": SystemUtils.get_stats()
            }
            json_bytes = json.dumps(payload).encode('utf-8')
            b64_data = base64.b64encode(json_bytes).decode('utf-8')
            safe_data = urllib.parse.quote(b64_data)
            
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={safe_data}"
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'AeroNode-Agent/4.1')
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode('utf-8'))
                    return data
        except Exception as e:
            print(f"Heartbeat Error: {e}")
        return None

    @staticmethod
    def fetch_config():
        try:
            url = f"{CONFIG['panel_url']}/api"
            data = json.dumps({
                "action": "FETCH_CONFIG",
                "nodeId": CONFIG["node_id"],
                "token": CONFIG["token"]
            }).encode('utf-8')
            
            req = urllib.request.Request(url, data=data, method="POST")
            req.add_header('Content-Type', 'application/json')
            req.add_header('User-Agent', 'AeroNode-Agent/4.1')
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = json.loads(resp.read().decode('utf-8'))
                decrypted = CryptoUtils.decrypt(raw['payload'], raw['iv'], CONFIG['token'])
                if decrypted and 'rules' in decrypted:
                    SystemUtils.apply_rules(decrypted['rules'])
                    print("Rules updated")
        except Exception as e:
            print(f"Fetch Config Error: {e}")

def main():
    print("AeroNode Python Agent Started")
    SystemUtils.init_nftables()
    while True:
        resp = NetworkClient.heartbeat()
        interval = 60
        if resp:
            if resp.get("success"):
                interval = resp.get("interval", 60)
                if resp.get("has_cmd"):
                    NetworkClient.fetch_config()
        time.sleep(interval)

if __name__ == "__main__":
    main()
PYEOF

# 5. 創建服務 (使用 venv 中的 python)
echo -e "\${BLUE}[4/4] 啟動服務...\${NC}"

# 使用虛擬環境中的 Python 解釋器
VENV_PYTHON="$INSTALL_DIR/venv/bin/python"

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Python Agent
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

sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "\n\${GREEN}✅ 安裝成功！Agent 正在運行。\${NC}"
else
    echo -e "\n\${RED}❌ 啟動失敗，請檢查日誌：\${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    # 手動診斷
    echo -e "\n嘗試手動運行診斷:"
    $VENV_PYTHON $INSTALL_DIR/agent.py
fi
`;

  return new NextResponse(script, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}