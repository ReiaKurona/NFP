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

echo -e "\${BLUE}[AeroNode] 開始安裝 V3.1 (強健網絡版)... \${NC}"

# 清理舊的安裝殘留
rm -rf /opt/aero-agent/go.tar.gz

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

# 2. 檢測網絡並安裝 Go
echo -e "\${BLUE}[1/4] 檢查 Go 環境...\${NC}"

# 判斷是否需要下載 Go
NEED_INSTALL=true
if command -v go &> /dev/null; then
    GO_VERSION=$(go version | awk '{print $3}')
    echo -e "檢測到現有 Go 版本: $GO_VERSION"
    NEED_INSTALL=false
fi

if [ "$NEED_INSTALL" = true ]; then
    echo -e "\${YELLOW}未檢測到 Go，準備下載...\${NC}"
    
    # 智能選擇下載源
    DOWNLOAD_URL="https://go.dev/dl/go1.21.5.linux-amd64.tar.gz"
    if ! curl -s --max-time 3 https://google.com > /dev/null; then
        echo -e "無法連接國際網絡，切換至 \${GREEN}阿里雲鏡像 (Aliyun)\${NC}..."
        DOWNLOAD_URL="https://mirrors.aliyun.com/golang/go1.21.5.linux-amd64.tar.gz"
        export GOPROXY=https://goproxy.cn,direct
    fi

    # 下載並檢查狀態
    echo -e "正在下載: $DOWNLOAD_URL"
    wget --no-check-certificate -q $DOWNLOAD_URL -O go.tar.gz
    
    # 檢查文件是否下載成功 (大於 1MB)
    FILE_SIZE=$(du -k go.tar.gz | cut -f1)
    if [ ! -f "go.tar.gz" ] || [ "$FILE_SIZE" -lt 1000 ]; then
        echo -e "\${RED}錯誤: Go 安裝包下載失敗或文件損壞！\${NC}"
        echo -e "請嘗試手動安裝 Go 後再運行此腳本。"
        rm -f go.tar.gz
        exit 1
    fi

    echo -e "下載成功，正在解壓..."
    rm -rf /usr/local/go
    if ! tar -C /usr/local -xzf go.tar.gz; then
         echo -e "\${RED}錯誤: 解壓失敗！文件可能已損壞。\${NC}"
         exit 1
    fi
    
    # 立即更新環境變量
    export PATH=$PATH:/usr/local/go/bin
    echo "export PATH=\\$PATH:/usr/local/go/bin" >> /etc/profile
    rm -f go.tar.gz
fi

# 再次驗證 Go 是否可用
if ! /usr/local/go/bin/go version &> /dev/null && ! command -v go &> /dev/null; then
    echo -e "\${RED}錯誤: Go 安裝後無法執行。請檢查系統架構 (必須是 x86_64/amd64)。\${NC}"
    exit 1
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 3. 寫入配置與代碼
echo -e "\${BLUE}[2/4] 生成 Agent 配置...\${NC}"

cat > config.json <<EOF
{ "token": "$TOKEN", "node_id": "$NODE_ID", "panel_url": "$PANEL_URL" }
EOF

cat > main.go << 'GOEOF'
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type Config struct {
	Token    string \`json:"token"\`
	NodeId   string \`json:"node_id"\`
	PanelUrl string \`json:"panel_url"\`
}

type HeartbeatResp struct {
    Success   bool \`json:"success"\`
    Interval  int  \`json:"interval"\`
    HasCmd    bool \`json:"has_cmd"\`
}

type Rule struct {
	ListenPort string \`json:"listen_port"\`
	DestIP     string \`json:"dest_ip"\`
	DestPort   string \`json:"dest_port"\`
	Protocol   string \`json:"protocol"\`
}

var config Config

func getStats() map[string]interface{} {
    out, _ := exec.Command("cat", "/proc/loadavg").Output()
    parts := strings.Fields(string(out))
    load := "0.0"
    if len(parts) > 0 { load = parts[0] }
    return map[string]interface{}{ "cpu_load": load, "goroutines": runtime.NumGoroutine() }
}

func startLoop() {
    client := &http.Client{Timeout: 15 * time.Second}
    
    for {
        payload := map[string]interface{}{
            "nodeId": config.NodeId,
            "token":  config.Token,
            "stats":  getStats(),
        }
        jsonBytes, _ := json.Marshal(payload)
        b64Data := base64.StdEncoding.EncodeToString(jsonBytes)
        safeData := url.QueryEscape(b64Data)
        targetUrl := fmt.Sprintf("%s/api?action=HEARTBEAT&data=%s", config.PanelUrl, safeData)
        
        resp, err := client.Get(targetUrl)
        var interval = 60
        if err == nil && resp.StatusCode == 200 {
            var hbResp HeartbeatResp
            json.NewDecoder(resp.Body).Decode(&hbResp)
            resp.Body.Close()
            if hbResp.Interval > 0 { interval = hbResp.Interval }
            if hbResp.HasCmd { fetchAndApplyRules(client) }
        }
        time.Sleep(time.Duration(interval) * time.Second)
    }
}

func fetchAndApplyRules(client *http.Client) {
    payload, _ := json.Marshal(map[string]interface{}{ "action": "FETCH_CONFIG", "nodeId": config.NodeId, "token": config.Token })
    resp, err := client.Post(config.PanelUrl+"/api", "application/json", bytes.NewBuffer(payload))
    if err != nil { return }
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    var ep struct { Payload string; IV string }
    json.Unmarshal(body, &ep)
    
    key := sha256.Sum256([]byte(config.Token))
    ciphertext, _ := hex.DecodeString(ep.Payload)
    iv, _ := hex.DecodeString(ep.IV)
    if len(ciphertext) < 16 { return }
    
    block, _ := aes.NewCipher(key[:])
    aesgcm, _ := cipher.NewGCM(block)
    plaintext, err := aesgcm.Open(nil, iv, ciphertext, nil)
    if err != nil { return }
    
    var data struct { Rules []Rule }
    json.Unmarshal(plaintext, &data)
    applyRules(data.Rules)
}

func applyRules(rules []Rule) {
    exec.Command("nft", "flush", "chain", "ip", "nat", "PREROUTING").Run()
    exec.Command("nft", "flush", "chain", "ip", "nat", "POSTROUTING").Run()
    for _, r := range rules {
        p := r.Protocol
        if p == "" { p = "tcp" }
        exec.Command("sh", "-c", fmt.Sprintf("nft add rule ip nat PREROUTING %s dport %s counter dnat to %s:%s", p, r.ListenPort, r.DestIP, r.DestPort)).Run()
        exec.Command("sh", "-c", fmt.Sprintf("nft add rule ip nat POSTROUTING ip daddr %s %s dport %s counter masquerade", r.DestIP, p, r.DestPort)).Run()
    }
}

func main() {
	cfgData, _ := ioutil.ReadFile("config.json")
	json.Unmarshal(cfgData, &config)
	exec.Command("nft", "add", "table", "ip", "nat").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "PREROUTING", "{ type nat hook prerouting priority -100; }").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "POSTROUTING", "{ type nat hook postrouting priority 100; }").Run()
    startLoop()
}
GOEOF

# 4. 編譯與安裝
echo -e "\${BLUE}[3/4] 編譯 Agent 核心...\${NC}"

# 強制使用絕對路徑調用 Go，確保能夠找到命令
GO_BIN="/usr/local/go/bin/go"
if ! [ -x "$GO_BIN" ]; then
    GO_BIN=$(command -v go)
fi

$GO_BIN mod init agent > /dev/null 2>&1
if ! $GO_BIN build -ldflags="-s -w" -o aero-agent main.go; then
    echo -e "\${RED}編譯失敗！可能原因：\${NC}"
    echo -e "1. VPS 內存不足 (建議至少 512MB)"
    echo -e "2. Go 國內源配置失敗"
    echo -e "3. 系統架構不是 amd64"
    exit 1
fi

echo -e "\${BLUE}[4/4] 啟動服務...\${NC}"

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent
After=network.target
[Service]
ExecStart=$INSTALL_DIR/aero-agent
Restart=always
RestartSec=5
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
    echo -e "\n\${RED}❌ 服務啟動失敗，請查看日誌：\${NC}"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
fi
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}