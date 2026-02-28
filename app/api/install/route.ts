import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
# AeroNode V8.0 - 免依賴訂閱版 (最穩定架構)

RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}[AeroNode] 開始安裝 V8.0 (免加密依賴版)... \${NC}"

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

if [ -z "$TOKEN" ] ||[ -z "$NODE_ID" ]; then
    echo -e "\${RED}錯誤: 參數缺失。\${NC}"
    exit 1
fi

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"
LOG_FILE="/var/log/aero-agent.log"

# 1. 系統組件檢查
echo -e "\${BLUE}[1/3] 準備系統環境...\${NC}"

# 檢查與安裝 python3
if ! command -v python3 &> /dev/null; then
    echo -e "\${BLUE}正在安裝 Python3...\${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get update -q && apt-get install -y -q python3
    elif [ -f /etc/redhat-release ]; then
        yum install -y python3
    elif [ -f /etc/alpine-release ]; then
        apk add python3
    fi
fi

# 檢查與安裝 nftables
if ! command -v nft &> /dev/null; then
    echo -e "\${BLUE}正在安裝 nftables...\${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get update -q && apt-get install -y -q nftables
    elif [ -f /etc/redhat-release ]; then
        yum install -y nftables
    elif [ -f /etc/alpine-release ]; then
        apk add nftables
    fi
fi

# 檢查下載工具 (curl 或 wget)，以便後續下載 agent.py
if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    echo -e "\${BLUE}正在安裝下載工具 (curl)...\${NC}"
    if [ -f /etc/debian_version ]; then
        apt-get update -q && apt-get install -y -q curl
    elif [ -f /etc/redhat-release ]; then
        yum install -y curl
    elif [ -f /etc/alpine-release ]; then
        apk add curl
    fi
fi

# 移除舊的 venv (現在不需要了，直接用系統 python3)
rm -rf $INSTALL_DIR/venv

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

NFT_BIN=$(command -v nft)
if [ -z "$NFT_BIN" ]; then NFT_BIN="/usr/sbin/nft"; fi

# 2. 部署代碼
echo -e "\${BLUE}[2/3] 寫入配置與下載 Agent 核心代碼...\${NC}"

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL", "nft_bin": "$NFT_BIN" }
EOF

AGENT_URL="https://raw.githubusercontent.com/ReiaKurona/NFP/refs/heads/main/app/agent/agent.py"

echo -e "\${BLUE}正在從遠端下載 agent.py...\${NC}"
if command -v curl &> /dev/null; then
    curl -sSL "$AGENT_URL" -o agent.py
else
    wget -qO agent.py "$AGENT_URL"
fi

if [ ! -s agent.py ]; then
    echo -e "\${RED}錯誤: 下載 agent.py 失敗！請檢查網絡連接或 GitHub 存取狀態。\${NC}"
    exit 1
fi

# 3. 創建系統服務
echo -e "\${BLUE}[3/3] 註冊服務...\${NC}"

PY_BIN=$(command -v python3)

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent V8
After=network.target
[Service]
User=root
Group=root
ExecStart=$PY_BIN -u $INSTALL_DIR/agent.py
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
    echo -e "\\n\${GREEN}✅ 安裝成功！Agent 正在運行。\${NC}"
else
    echo -e "\\n\${RED}❌ 啟動失敗！請查看日誌：\${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
fi
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
