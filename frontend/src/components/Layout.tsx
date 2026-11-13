import { AppShell, LinkProvider, TopNav, TopNavHeading, TopNavItem, VStack } from '@astryxdesign/core'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

import { RouterLink } from './RouterLink.tsx'

const NAV_ITEMS = [
  { label: '今日のタスク', href: '/', isCurrent: (path: string) => path === '/' || path.startsWith('/session') },
  { label: '記録', href: '/logs', isCurrent: (path: string) => path.startsWith('/logs') },
  { label: '統計', href: '/stats', isCurrent: (path: string) => path.startsWith('/stats') },
  { label: 'テンプレート', href: '/templates', isCurrent: (path: string) => path.startsWith('/templates') },
]

/** 全ページ共通の枠（上部ナビゲーション＋本文） */
export function Layout() {
  const { pathname } = useLocation()

  // ページを移動したら先頭から表示する
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    // Astryx のリンクやボタンの href を、ページを読み直さない React Router の遷移にする
    <LinkProvider component={RouterLink}>
      <AppShell
        height="auto"
        variant="section"
        contentPadding={4}
        topNav={
          <TopNav
            label="メインメニュー"
            heading={<TopNavHeading heading="tascon" headingHref="/" />}
            startContent={NAV_ITEMS.map((item) => (
              <TopNavItem key={item.href} label={item.label} href={item.href} isSelected={item.isCurrent(pathname)} />
            ))}
          />
        }
      >
        <div className="page">
          <VStack gap={6}>
            <Outlet />
          </VStack>
        </div>
      </AppShell>
    </LinkProvider>
  )
}
