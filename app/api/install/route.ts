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

echo -e "\${BLUE}[AeroNode] 開始安裝 V3.0 (GET 穿透版)... \${NC}"

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

echo -e "目標面板: \${YELLOW}$PANEL_URL\${NC}"
echo -e "節點 ID: \${YELLOW}$NODE_ID\${NC}"

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"

# 2. 檢測網絡環境並配置 Go 源
echo -e "\${BLUE}[1/4] 檢測網絡環境...\${NC}"
export GO111MODULE=on
if curl -s --max-time 3 https://google.com > /dev/null; then
    echo -e "國際網絡連通，使用默認源。"
else
    echo -e "\${YELLOW}無法連接 Google，切換至國內源 (goproxy.cn)...\${NC}"
    export GOPROXY=https://goproxy.cn,direct
fi

# 3. 安裝 Go (如果不存在)
if ! command -v go &> /dev/null; then
    echo -e "\${BLUE}[2/4] 正在下載並安裝 Go...\${NC}"
    # 根據網絡環境選擇下載源
    if [ -n "$GOPROXY" ]; then
        wget -q https://mirrors.ustc.edu.cn/golang/go1.21.5.linux-amd64.tar.gz -O go.tar.gz
    else
        wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz -O go.tar.gz
    fi
    
    if [ ! -f "go.tar.gz" ]; then
        echo -e "\${RED}Go 下載失敗！請檢查網絡。\${NC}"
        exit 1
    fi

    rm -rf /usr/local/go && tar -C /usr/local -xzf go.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo "export PATH=\\$PATH:/usr/local/go/bin" >> /etc/profile
    rm go.tar.gz
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 4. 寫入配置與代碼
echo -e "\${BLUE}[3/4] 編譯 Agent 核心...\${NC}"

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
    load := strings.Fields(string(out))[0]
    return map[string]interface{}{ "cpu_load": load, "goroutines": runtime.NumGoroutine() }
}

func startLoop() {
    client := &http.Client{Timeout: 15 * time.Second}
    
    for {
        // 1. 準備數據
        payload := map[string]interface{}{
            "nodeId": config.NodeId,
            "token":  config.Token,
            "stats":  getStats(),
        }
        jsonBytes, _ := json.Marshal(payload)
        
        // 2. 改用 GET 請求 (Base64 URL 編碼)
        b64Data := base64.StdEncoding.EncodeToString(jsonBytes)
        // URL Encode 確保安全傳輸
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
        } else {
            fmt.Printf("Heartbeat Error: %v\n", err)
        }

        time.Sleep(time.Duration(interval) * time.Second)
    }
}

func fetchAndApplyRules(client *http.Client) {
    // 拉取配置仍使用 POST (安全性)
    payload, _ := json.Marshal(map[string]interface{}{
        "action": "FETCH_CONFIG",
        "nodeId": config.NodeId,
        "token":  config.Token,
    })
    
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
    authTag := ciphertext[len(ciphertext)-16:]
    realCipher := ciphertext[:len(ciphertext)-16]

    block, _ := aes.NewCipher(key[:])
    aesgcm, _ := cipher.NewGCM(block)
    plaintext, err := aesgcm.Open(nil, iv, append(realCipher, authTag...), nil)
    
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

    fmt.Println("AeroNode Agent Started (GET Mode)")
    startLoop()
}
GOEOF

# 初始化並編譯
go mod init agent > /dev/null 2>&1
if ! go build -ldflags="-s -w" -o aero-agent main.go; then
    echo -e "\${RED}編譯失敗！請檢查 Go 環境或錯誤日誌。\${NC}"
    exit 1
fi

# 5. 創建服務與啟動檢查
echo -e "\${BLUE}[4/4] 註冊系統服務...\${NC}"

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

# 6. 最終狀態確認 (增加詳細診斷)
sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "\n\${GREEN}✅ 安裝成功！Agent 正在運行。\${NC}"
    echo -e "請回到面板查看節點狀態 (可能需要等待 10-60 秒)。"
else
    echo -e "\n\${RED}❌ Agent 啟動失敗！\${NC}"
    echo -e "以下是錯誤日誌 (Journalctl):"
    echo "-----------------------------------"
    journalctl -u $SERVICE_NAME -n 10 --no-pager
    echo "-----------------------------------"
    echo -e "請截圖以上日誌進行反饋。"
fi
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}