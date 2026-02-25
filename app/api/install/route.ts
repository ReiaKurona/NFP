// app/api/install/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const script = `#!/bin/bash
echo -e "\\033[34m[AeroNode] 開始安裝輕量級被動 Agent...\\033[0m"

TOKEN=""
PORT="8080"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token) TOKEN="$2"; shift ;;
        --port) PORT="$2"; shift ;;
        *) echo "未知參數: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TOKEN" ]; then
    echo -e "\\033[31m錯誤: 必須提供 --token 參數。\\033[0m"
    exit 1
fi

INSTALL_DIR="/opt/aero-agent"
SERVICE_NAME="aero-agent"

# 安裝 Go 環境
if ! command -v go &> /dev/null; then
    echo "未檢測到 Go，正在安裝..."
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo "export PATH=\\$PATH:/usr/local/go/bin" >> /etc/profile
    rm go1.21.5.linux-amd64.tar.gz
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# 寫入配置與原始碼
cat > config.json <<EOF
{ "token": "$TOKEN", "port": $PORT }
EOF

cat > main.go << 'GOEOF'
package main

import (
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
	Token string \`json:"token"\`
	Port  int    \`json:"port"\`
}

type EncryptedPayload struct {
	Payload string \`json:"payload"\`
	IV      string \`json:"iv"\`
}

type Command struct {
	Action string \`json:"action"\`
	Rules  []Rule \`json:"rules"\`
}

type Rule struct {
	ListenPort string \`json:"listen_port"\`
	DestIP     string \`json:"dest_ip"\`
	DestPort   string \`json:"dest_port"\`
	Protocol   string \`json:"protocol"\`
}

var config Config

func main() {
	cfgData, _ := ioutil.ReadFile("config.json")
	json.Unmarshal(cfgData, &config)

	exec.Command("nft", "add", "table", "ip", "nat").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "PREROUTING", "{ type nat hook prerouting priority -100; }").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "POSTROUTING", "{ type nat hook postrouting priority 100; }").Run()

	http.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" { http.Error(w, "Method not allowed", 405); return }
		body, _ := ioutil.ReadAll(r.Body)
		var ep EncryptedPayload
		json.Unmarshal(body, &ep)

		key := sha256.Sum256([]byte(config.Token))
		ciphertext, _ := hex.DecodeString(ep.Payload)
		iv, _ := hex.DecodeString(ep.IV)

		block, _ := aes.NewCipher(key[:])
		aesgcm, _ := cipher.NewGCM(block)
		decryptedData, err := aesgcm.Open(nil, iv, ciphertext, nil)
		
		if err != nil { http.Error(w, "Auth Failed", 403); return }

		var cmd Command
		json.Unmarshal(decryptedData, &cmd)

		if cmd.Action == "APPLY" {
			exec.Command("nft", "flush", "chain", "ip", "nat", "PREROUTING").Run()
			exec.Command("nft", "flush", "chain", "ip", "nat", "POSTROUTING").Run()
			for _, rule := range cmd.Rules {
				proto := rule.Protocol
				if proto == "" { proto = "tcp" }
				exec.Command("sh", "-c", fmt.Sprintf("nft add rule ip nat PREROUTING %s dport %s counter dnat to %s:%s", proto, rule.ListenPort, rule.DestIP, rule.DestPort)).Run()
				exec.Command("sh", "-c", fmt.Sprintf("nft add rule ip nat POSTROUTING ip daddr %s %s dport %s counter masquerade", rule.DestIP, proto, rule.DestPort)).Run()
			}
		}

		out, _ := exec.Command("cat", "/proc/loadavg").Output()
		load := strings.Fields(string(out))[0]
		stats := map[string]interface{}{ "cpu_load": load, "goroutines": runtime.NumGoroutine(), "time": time.Now().Unix() }
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	})

	addr := fmt.Sprintf(":%d", config.Port)
	fmt.Printf("Agent running on %s\\n", addr)
	http.ListenAndServe(addr, nil)
}
GOEOF

# 編譯與啟動服務
go mod init agent > /dev/null 2>&1
go build -ldflags="-s -w" -o aero-agent main.go

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF[Unit]
Description=AeroNode Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/aero-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

echo -e "\\n\\033[32m[安裝完成]\\033[0m 代理已在背景運行 (Port: $PORT)"
`;

  return new NextResponse(script, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
