import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Astryx のスタイル。順番に意味がある（リセット → コンポーネント → テーマ）
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/theme-neutral/theme.css'
// テーマが指定する欧文フォント（Figtree）。Google Fonts ではなく自分で配信する
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'
import './index.css'

import { App } from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
