import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nftables Panel',
  description: 'Serverless Forwarding Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{__html: `tailwind.config = { darkMode: 'class', theme: { extend: { colors: { primary: '#3b82f6' } } } }`}} />
        
        {/* 👇 1. 关键修复：引入 Material Symbols Rounded 字体库 */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        
        {/* 👇 2. 引入 MD3 组件逻辑库 */}
        <script type="module" src="https://esm.run/@material/web/all.js"></script>

        {/* 👇 3. 强制样式修正：告诉 md-icon 组件一定要用刚才下载的字体，且默认为实心风格 */}
        <style>{`
          :root {
            /* 定义一些全局 MD3 变量，防止组件报错 */
            --md-sys-typescale-body-large-font: system-ui, sans-serif;
            --md-ref-typeface-plain: system-ui, sans-serif;
          }
          
          /* 核心修复：强制 md-icon 使用 Material Symbols Rounded 字体 */
          md-icon {
            font-family: 'Material Symbols Rounded';
            font-weight: normal;
            font-style: normal;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-smoothing: antialiased;
            /* 开启实心图标 (FILL 1)，如果喜欢空心改为 0 */
            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          }
        `}</style>
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  )
}
