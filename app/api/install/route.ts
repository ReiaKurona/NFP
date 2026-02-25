import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = req.headers.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  const defaultPanel = host ? `${protocol}://${host}` : "";
  const panelUrl = searchParams.get("panel") || defaultPanel;

  const script = `#!/bin/bash
echo -e "\\033[34m[AeroNode] 安裝 V2.0 智能輪詢 Agent...\\033[0m"

# 參數解析
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
    echo -e "\\033[31m錯誤: 參數缺失。請從面板複製完整指令。\\033[0m"
    exit 1
fi

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"

if ! command -v go &> /dev/null; then
    echo "安裝 Go 環境..."
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo "export PATH=\\$PATH:/usr/local/go/bin" >> /etc/profile
    rm go1.21.5.linux-amd64.tar.gz
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

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
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
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

// 核心循環：發送心跳 -> 獲取指令 -> 執行 -> 休眠
func startLoop() {
    client := &http.Client{Timeout: 10 * time.Second}
    
    for {
        // 1. 準備心跳數據
        payload, _ := json.Marshal(map[string]interface{}{
            "action": "HEARTBEAT",
            "nodeId": config.NodeId,
            "token":  config.Token,
            "stats":  getStats(),
        })

        // 2. 發送心跳
        resp, err := client.Post(config.PanelUrl + "/api", "application/json", bytes.NewBuffer(payload))
        
        var interval = 60 // 默認休眠 60 秒 (失敗時)
        
        if err == nil && resp.StatusCode == 200 {
            var hbResp HeartbeatResp
            json.NewDecoder(resp.Body).Decode(&hbResp)
            resp.Body.Close()
            
            // 更新休眠時間 (面板決定)
            if hbResp.Interval > 0 { interval = hbResp.Interval }

            // 3. 如果面板有新指令，立即拉取配置
            if hbResp.HasCmd {
                fetchAndApplyRules(client)
            }
        } else {
            fmt.Println("Heartbeat failed, retrying...")
        }

        // 4. 動態休眠
        time.Sleep(time.Duration(interval) * time.Second)
    }
}

func fetchAndApplyRules(client *http.Client) {
    payload, _ := json.Marshal(map[string]interface{}{
        "action": "FETCH_CONFIG",
        "nodeId": config.NodeId,
        "token":  config.Token,
    })
    
    resp, err := client.Post(config.PanelUrl + "/api", "application/json", bytes.NewBuffer(payload))
    if err != nil { return }
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    
    // 解密
    var ep struct { Payload string; IV string }
    json.Unmarshal(body, &ep)
    
    key := sha256.Sum256([]byte(config.Token))
    ciphertext, _ := hex.DecodeString(ep.Payload)
    iv, _ := hex.DecodeString(ep.IV) // 12 bytes
    authTag := ciphertext[len(ciphertext)-16:] // Last 16 bytes are tag
    realCipher := ciphertext[:len(ciphertext)-16]

    block, _ := aes.NewCipher(key[:])
    aesgcm, _ := cipher.NewGCM(block)
    // Go 的 GCM Open 需要 ciphertext + tag 拼接
    plaintext, err := aesgcm.Open(nil, iv, append(realCipher, authTag...), nil)
    
    if err != nil { fmt.Println("Decrypt error"); return }
    
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

    // 初始化 nftables
	exec.Command("nft", "add", "table", "ip", "nat").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "PREROUTING", "{ type nat hook prerouting priority -100; }").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "POSTROUTING", "{ type nat hook postrouting priority 100; }").Run()

    fmt.Println("Agent started in Polling Mode")
    startLoop()
}
GOEOF

go mod init agent > /dev/null 2>&1
go build -ldflags="-s -w" -o aero-agent main.go

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent V2
After=network.target
[Service]
ExecStart=$INSTALL_DIR/aero-agent
Restart=always
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload && systemctl enable $SERVICE_NAME && systemctl restart $SERVICE_NAME
echo -e "\\n\\033[32m[安裝完成]\\033[0m Agent V2 (被動輪詢版) 已啟動！"
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}