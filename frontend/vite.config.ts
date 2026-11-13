import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // リポジトリ直下の .env にある ADDR（backend で cargo run したときの待ち受けアドレス）を読む
  const env = loadEnv(mode, '..', '')
  const apiTarget = `http://${env.ADDR || '127.0.0.1:8080'}`

  return {
    plugins: [react()],
    server: {
      // 開発中は /api を Rust のサーバーに転送する
      proxy: {
        '/api': apiTarget,
      },
    },
    build: {
      // UI 部品（Astryx）を1つにまとめると約 730kB（gzip 後 約 220kB）になる。
      // ほぼすべてが Astryx 本体で、分割しても初回に読む量は大きく変わらないので、警告の基準だけ上げる
      chunkSizeWarningLimit: 1000,
    },
  }
})
