import { NextResponse } from "next/server";

export async function GET() {
  const script = `#!/bin/bash
echo -e "\\033[34m[AeroNode] 開始安裝並掃描現有規則...\\033[0m"

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

if ! command -v go &> /dev/null; then
    wget -q https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
    rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo "export PATH=\\$PATH:/usr/local/go/bin" >> /etc/profile
    rm go1.21.5.linux-amd64.tar.gz
fi

mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

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
	"regexp"
	"runtime"
	"strings"
	"time"
)

type Config struct {
	Token string \`json:"token"\`
	Port  int    \`json:"port"\`
}

type Rule struct {
	ListenPort string \`json:"listen_port"\`
	DestIP     string \`json:"dest_ip"\`
	DestPort   string \`json:"dest_port"\`
	Protocol   string \`json:"protocol"\`
}

var config Config

// 智能掃描現有 nftables 規則
func parseExistingRules() []Rule {
	var rules[]Rule
	out, err := exec.Command("nft", "list", "chain", "ip", "nat", "PREROUTING").Output()
	if err != nil { return rules }
	
	// 解析類似: tcp dport 10000-20000 counter dnat to 1.1.1.1:10000-20000
	re := regexp.MustCompile(\`(tcp|udp)\\s+dport\\s+([\\d-]+).*?dnat\\s+to\\s+([\\d\\.]+):([\\d-]+)\`)
	lines := strings.Split(string(out), "\\n")
	for _, line := range lines {
		matches := re.FindStringSubmatch(line)
		if len(matches) == 5 {
			rules = append(rules, Rule{
				Protocol:   matches[1],
				ListenPort: matches[2],
				DestIP:     matches[3],
				DestPort:   matches[4],
			})
		}
	}
	return rules
}

func main() {
	cfgData, _ := ioutil.ReadFile("config.json")
	json.Unmarshal(cfgData, &config)

	exec.Command("nft", "add", "table", "ip", "nat").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "PREROUTING", "{ type nat hook prerouting priority -100; }").Run()
	exec.Command("nft", "add", "chain", "ip", "nat", "POSTROUTING", "{ type nat hook postrouting priority 100; }").Run()

	http.HandleFunc("/sync", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" { http.Error(w, "Method not allowed", 405); return }
		body, _ := ioutil.ReadAll(r.Body)
		
		var ep struct { Payload, IV string }
		json.Unmarshal(body, &ep)

		key := sha256.Sum256([]byte(config.Token))
		ciphertext, _ := hex.DecodeString(ep.Payload)
		iv, _ := hex.DecodeString(ep.IV)

		block, _ := aes.NewCipher(key[:])
		aesgcm, _ := cipher.NewGCM(block)
		decryptedData, err := aesgcm.Open(nil, iv, ciphertext, nil)
		if err != nil { http.Error(w, "Auth Failed", 403); return }

		var cmd struct { Action string; Rules []Rule }
		json.Unmarshal(decryptedData, &cmd)

		response := map[string]interface{}{}

		if cmd.Action == "PULL_EXISTING" {
			response["existing_rules"] = parseExistingRules()
		} else if cmd.Action == "APPLY" {
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
		response["stats"] = map[string]interface{}{ "cpu_load": load, "goroutines": runtime.NumGoroutine() }
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	addr := fmt.Sprintf(":%d", config.Port)
	fmt.Printf("Agent running on %s\\n", addr)
	http.ListenAndServe(addr, nil)
}
GOEOF

go mod init agent > /dev/null 2>&1
go build -ldflags="-s -w" -o aero-agent main.go

cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=AeroNode Agent
[Service]
ExecStart=$INSTALL_DIR/aero-agent
Restart=always
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload && systemctl enable $SERVICE_NAME && systemctl restart $SERVICE_NAME
echo -e "\\n\\033[32m[安裝完成]\\033[0m 代理已運行！"
`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain" } });
}
