import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  // 這是 Bash 腳本，它會自動寫入並運行 Python Agent
  const script = `#!/bin/bash

# 定義顏色
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[0;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 開始安裝 V4.0 (Python 極速版)... \${NC}"

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

# 2. 檢查 Python 環境
echo -e "\${BLUE}[1/4] 檢查 Python 環境...\${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "\${YELLOW}未檢測到 Python3，正在安裝...\${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get update && apt-get install -y python3 python3-pip
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3 python3-pip
    elif [ -f /etc/alpine-release ]; then
        apk add python3 py3-pip
    else
        echo -e "\${RED}無法自動安裝 Python，請手動安裝 python3 和 pip。\${NC}"
        exit 1
    fi
fi

# 3. 安裝加密依賴 (PyCryptodome)
echo -e "\${BLUE}[2/4] 安裝依賴庫...\${NC}"
# 嘗試切換 pip 國內源
pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple > /dev/null 2>&1

# 兼容新版 Linux 的 pip 限制
PIP_ARGS=""
if pip3 install --help | grep -q "break-system-packages"; then
    PIP_ARGS="--break-system-packages"
fi

if ! pip3 install pycryptodome requests $PIP_ARGS; then
    echo -e "\${YELLOW}pip 安裝失敗，嘗試使用系統包管理器...\${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get install -y python3-pycryptodome
    elif [ -f /etc/alpine-release ]; then
        apk add py3-pycryptodome
    else
        echo -e "\${RED}依賴安裝失敗，請手動運行: pip3 install pycryptodome\${NC}"
        exit 1
    fi
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 4. 寫入 Python Agent 腳本
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
from Crypto.Cipher import AES
from Crypto.Hash import SHA256

# 配置加載
try:
    with open("config.json", "r") as f:
        CONFIG = json.load(f)
except:
    print("Config file not found")
    sys.exit(1)

# 加密工具類
class CryptoUtils:
    @staticmethod
    def decrypt(encrypted_hex, iv_hex, token):
        try:
            key = SHA256.new(token.encode('utf-8')).digest()
            ciphertext = bytes.fromhex(encrypted_hex)
            iv = bytes.fromhex(iv_hex)
            
            # 拆分 Tag 和 密文 (Node.js GCM 通常是 CipherText + Tag)
            tag = ciphertext[-16:]
            real_ciphertext = ciphertext[:-16]
            
            cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
            plaintext = cipher.decrypt_and_verify(real_ciphertext, tag)
            return json.loads(plaintext.decode('utf-8'))
        except Exception as e:
            print(f"Decryption failed: {e}")
            return None

# 系統操作類
class SystemUtils:
    @staticmethod
    def get_stats():
        try:
            with open("/proc/loadavg", "r") as f:
                load = f.read().split()[0]
        except:
            load = "0.0"
        return {"cpu_load": load, "goroutines": 1} # Python 單線程

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
            
            # PREROUTING (DNAT)
            dnat = f"nft add rule ip nat PREROUTING {p} dport {sport} counter dnat to {dip}:{dport}"
            SystemUtils.run_nft_cmd(dnat)
            
            # POSTROUTING (SNAT/Masquerade)
            snat = f"nft add rule ip nat POSTROUTING ip daddr {dip} {p} dport {dport} counter masquerade"
            SystemUtils.run_nft_cmd(snat)

    @staticmethod
    def init_nftables():
        SystemUtils.run_nft_cmd("nft add table ip nat")
        SystemUtils.run_nft_cmd("nft add chain ip nat PREROUTING { type nat hook prerouting priority -100; }")
        SystemUtils.run_nft_cmd("nft add chain ip nat POSTROUTING { type nat hook postrouting priority 100; }")

# 網絡請求類
class NetworkClient:
    @staticmethod
    def heartbeat():
        try:
            payload = {
                "nodeId": CONFIG["node_id"],
                "token": CONFIG["token"],
                "stats": SystemUtils.get_stats()
            }
            # Base64 URL Safe Encoding
            json_bytes = json.dumps(payload).encode('utf-8')
            b64_data = base64.b64encode(json_bytes).decode('utf-8')
            # 再次 URL Encode 確保 + 號不丟失
            safe_data = urllib.parse.quote(b64_data)
            
            url = f"{CONFIG['panel_url']}/api?action=HEARTBEAT&data={safe_data}"
            req = urllib.request.Request(url)
            # 偽裝 User-Agent 防止被 Vercel 攔截
            req.add_header('User-Agent', 'AeroNode-Agent/4.0')
            
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
            req.add_header('User-Agent', 'AeroNode-Agent/4.0')
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = json.loads(resp.read().decode('utf-8'))
                # 解密
                decrypted = CryptoUtils.decrypt(raw['payload'], raw['iv'], CONFIG['token'])
                if decrypted and 'rules' in decrypted:
                    SystemUtils.apply_rules(decrypted['rules'])
                    print("Rules updated successfully")
        except Exception as e:
            print(f"Fetch Config Error: {e}")

# 主程序
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
            else:
                print(f"Server returned error: {resp}")
        
        time.sleep(interval)

if __name__ == "__main__":
    main()
PYEOF

# 5. 創建服務
echo -e "\${BLUE}[4/4] 啟動服務...\${NC}"

# 找到 python3 的絕對路徑
PY_BIN=$(command -v python3)

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Python Agent
After=network.target
[Service]
ExecStart=$PY_BIN -u $INSTALL_DIR/agent.py
WorkingDirectory=$INSTALL_DIR
Restart=always
RestartSec=5
# 確保緩衝區立即輸出，方便看日誌
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
    echo -e "Python 路徑: $PY_BIN"
    echo -e "Agent 目錄: $INSTALL_DIR"
else
    echo -e "\n\${RED}❌ 啟動失敗，請檢查日誌：\${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    # 嘗試手動運行一次看報錯
    echo -e "\n嘗試手動運行診斷:"
    $PY_BIN $INSTALL_DIR/agent.py
fi
`;

  return new NextResponse(script, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}