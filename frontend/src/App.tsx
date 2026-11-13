import { InternationalizationProvider, Theme } from '@astryxdesign/core'
// Astryx 組み込みの文言（「任意」「閉じる」など）を日本語にする
import jaJP from '@astryxdesign/core/locales/ja-JP.generated.js'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'
import { RouterProvider, createBrowserRouter } from 'react-router'

import { Layout } from './components/Layout.tsx'
import { FinishPage } from './pages/FinishPage.tsx'
import { LogsPage } from './pages/LogsPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { SessionPage } from './pages/SessionPage.tsx'
import { StatsPage } from './pages/StatsPage.tsx'
import { TemplatesPage } from './pages/TemplatesPage.tsx'
import { TodayPage } from './pages/TodayPage.tsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'session', element: <SessionPage /> },
      { path: 'session/finish', element: <FinishPage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  return (
    <InternationalizationProvider locale="ja-JP" messages={{ 'ja-JP': jaJP }}>
      <Theme theme={neutralTheme} mode="system">
        <RouterProvider router={router} />
      </Theme>
    </InternationalizationProvider>
  )
}
