*本項目含有AI創作的內容
# 🛡️ AeroNode (AeroPanel)-A Nftables Forward Panel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![nftables](https://img.shields.io/badge/Powered_by-nftables-orange)](#)

[English Version](#english) | [中文說明](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

AeroNode is a modern, high-performance, and 100% Serverless port-forwarding management panel based on Linux `nftables`. Designed with Google's Material You (MD3) aesthetics, it allows you to manage port forwarding across multiple Linux servers with zero hosting costs.

### ✨ Key Features

*   ⚡ **Kernel-Level Performance:** Utilizes `nftables` directly in the Linux kernel. No userspace overhead (unlike `gost` or `socat`), making it extremely fast and lightweight.
*   ☁️ **100% Serverless:** The control panel is built with Next.js and fully hosted on Vercel + Vercel KV. **Zero server cost, zero maintenance.**
*   🔒 **Passive Agent Architecture:** The agent on your VPS runs in "Pull Mode" (Polling). It actively fetches configurations from Vercel via standard HTTPS GET requests. **No open ports required on your VPS, completely bypassing inbound firewall restrictions.**
*   🎨 **Material You UI:** Fluid animations (Framer Motion), automatic Dark/Light mode switching, and dynamic theme colors.
*   📊 **Real-time Monitoring:** Live tracking of Node CPU, RAM, RX/TX network speeds, and total traffic.
*   🔄 **Port Ranges & Dual Stack:** Natively supports forwarding port ranges (e.g., `10000-20000`) and TCP/UDP simultaneously.
*   📦 **One-Click Backup:** Export all nodes and forwarding rules as a JSON file and restore them anytime.

### 🏗️ Architecture

1.  **Panel (Master):** Next.js App Router -> Deployed on Vercel -> Uses Vercel KV (Redis) for data storage.
2.  **Agent (Node):** A lightweight Python 3 daemon running on the target VPS. It sends heartbeats and pulls the latest `nftables` configurations periodically.

### 🚀 Deployment Guide

#### Step 1: Deploy the Panel (Vercel)
1. Fork or upload this repository to your GitHub.
2. Log in to [Vercel](https://vercel.com/) and click **Add New -> Project**, then select this repository.
3. Once the initial deployment is complete, go to your Vercel Project Dashboard.
4. Navigate to **Storage** -> Click **Create Database** -> Select **KV (Redis)**.
5. Link the created KV database to your AeroNode project. Vercel will automatically inject the required environment variables.
6. Go back to **Deployments** and click **Redeploy** to apply the database changes.

#### Step 2: Login
*   Visit your Vercel assigned domain.
*   Default Password: `admin123` *(You will be forced to change this upon first login).*

#### Step 3: Install the Agent on your VPS
1. Go to the **Nodes** tab in the panel and click **+ Add Node**.
2. Enter a Name and the Public IP of your VPS. A random Token will be generated automatically. Click Save.
3. Copy the generated **One-click Installation Command** (e.g., `curl -sSL https://your-panel.vercel.app/api/install | bash...`).
4. Log in to your Linux VPS as `root` and paste the command.
5. The agent will automatically configure Python, setup `nftables`, and start reporting to your panel!

---

<a name="chinese"></a>
## 🇨🇳 中文說明

AeroNode 是一款基於 Linux `nftables` 的現代化、高性能、無服務器（Serverless）端口轉發管理面板。採用 Google Material You (MD3) 設計語言，讓你以**零主控成本**輕鬆管理多台 Linux 伺服器的流量轉發規則。

### ✨ 核心亮點

*   ⚡ **內核級極致性能**：底層直接操作 `nftables`，拋棄傳統 `iptables` 或是 `gost`/`socat` 等用戶態轉發工具，內存與 CPU 開銷極低，轉發延遲幾乎為零。
*   ☁️ **純 Serverless 架構**：主控面板基於 Next.js 開發，完美託管於 Vercel 與 Vercel KV (Redis) 數據庫。**無需購買主控伺服器，永久免費免維護。**
*   🔒 **被動式 Agent (高穿透)**：伺服器節點端採用純客戶端輪詢模式（HTTPS GET）。Agent 主動向面板拉取配置與匯報心跳，**VPS 無需開放任何公網 API 端口，無懼防火牆阻斷與主動探測。**
*   🎨 **Material You 視覺美學**：引入 Framer Motion 物理彈動動畫，支援系統級深色/淺色模式無縫切換，內置多套 MD3 動態主題色。
*   📊 **實時儀表盤**：精準監控節點 CPU、內存佔用，以及上下行實時網速與總流量消耗。
*   🔄 **端口段與雙棧支援**：原生支持端口區間轉發（如 `10000-20000`），支持單獨 TCP/UDP 或雙棧同時轉發。
*   📦 **全局 JSON 備份**：全站節點與轉發規則支援一鍵導出為 JSON 文件，支援隨時上傳還原覆蓋。

### 🏗️ 系統架構

1.  **面板端 (Panel)：** Next.js App Router -> 部署於 Vercel 雲函數 -> 數據持久化存儲於 Vercel KV。
2.  **節點端 (Agent)：** 運行於目標 VPS 上的極簡 Python 3 守護進程。週期性向面板發送心跳，並在配置變更時自動原子化加載 `.nft` 規則。

### 🚀 部署指南

#### 第一步：部署主控面板 (Vercel)
1. 將本項目 Fork 或上傳至你的 GitHub 倉庫。
2. 登入 [Vercel](https://vercel.com/)，點擊 **Add New -> Project**，導入你的倉庫。
3. 等待首次部署完成後，進入 Vercel 該項目的控制台。
4. 點擊頂部導航欄的 **Storage** -> **Create Database** -> 選擇 **連接
upstash redis KV (Redis)** 並創建。
5. 將創建好的 KV 數據庫連接 (Connect) 到你的 AeroNode 項目中，Vercel 會自動注入環境變量。
6. 回到 **Deployments** 頁面，點擊最近的一次部署，選擇 **Redeploy** 讓數據庫環境變量生效。

#### 第二步：登錄面板
*   訪問 Vercel 為你分配的域名。
*   預設管理員密碼：`admin123` *(首次登錄會強制要求修改為強密碼)*。

#### 第三步：在 VPS 安裝 Agent 代理
1. 在面板的 **節點** 頁面，點擊 **+ 添加新節點**。
2. 填寫節點名稱與公網 IP，系統會自動生成安全 Token，點擊保存。
3. 複製卡片下方生成的 **一鍵安裝指令** (以 `curl -sSL https://...` 開頭)。
4. SSH 登入你的 Linux VPS (需 `root` 權限)，粘貼並執行該指令。
5. 腳本會自動配置 Python 虛擬環境、依賴與 `nftables`，安裝完成後，面板首頁即可看到該節點上線！

---

### 🛠️ Tech Stack / 技術棧

*   **Frontend:** Next.js 14, React, TailwindCSS, Framer Motion, Lucide Icons
*   **Backend:** Vercel Serverless API, Vercel KV (@vercel/kv)
*   **Agent Node:** Python 3 (venv), Systemd, Linux Nftables

### ⚠️ Disclaimer / 免責聲明

This project is for educational and learning purposes only. Users must comply with local laws and regulations. The developer is not responsible for any misuse of this tool. / 本項目僅供學習與交流網絡技術使用，使用者請務必遵守當地法律法規。開發者對使用本工具產生的任何濫用行為不承擔任何責任。
