// 全ページ共通の UI 部品。Astryx（React）を CDN から読み込み、ビルドなしで動かす。
// JSX はコンパイルできないので、htm のタグ付きテンプレート（h`...`）で書く。
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import htm from 'htm';
import {
  AppShell,
  Badge,
  Heading,
  InternationalizationProvider,
  Text,
  Theme,
  TopNav,
  TopNavHeading,
  TopNavItem,
  VStack,
} from '@astryxdesign/core';
import {neutralTheme} from '@astryxdesign/theme-neutral';
// Astryx 組み込みの文言（「任意」「閉じる」など）を日本語にする
import jaJP from '@astryxdesign/core/locales/ja-JP';

export const h = htm.bind(React.createElement);
export const {useState, useRef} = React;

// 調子ごとの見た目。よくない < 普通 < 良い の順序がある尺度なので、
// 両端を寒色（青）と暖色（オレンジ）、真ん中をグレーにする（色覚多様性に配慮した配色）。
export const CONDITION_STYLES = {
  2: {badge: 'blue', color: 'var(--color-data-categorical-blue)'},
  1: {badge: 'neutral', color: 'var(--color-data-neutral)'},
  0: {badge: 'orange', color: 'var(--color-data-orange-4)'},
};

const NAV_ITEMS = [
  {key: 'index', label: '今日のタスク', href: '/'},
  {key: 'logs', label: '記録', href: '/logs'},
  {key: 'stats', label: '統計', href: '/stats'},
  {key: 'templates', label: 'テンプレート', href: '/templates'},
];

// Jinja が埋め込んだページデータ（templates/base.html の #page-data）を読み、ページを描画する
export function mount(Page) {
  const data = JSON.parse(document.getElementById('page-data').textContent);
  createRoot(document.getElementById('root')).render(h`
    <${InternationalizationProvider} locale="ja-JP" messages=${{'ja-JP': jaJP}}>
      <${Theme} theme=${neutralTheme} mode="system">
        <${Page} ...${data} />
      </${Theme}>
    </${InternationalizationProvider}>
  `);
}

// ヘッダー（ナビゲーション）とページ本文の枠
export function AppFrame({current, children}) {
  const topNav = h`
    <${TopNav}
      label="メインメニュー"
      heading=${h`<${TopNavHeading} heading="tascon" headingHref="/" />`}
      startContent=${NAV_ITEMS.map(
        (item) => h`
          <${TopNavItem}
            key=${item.key}
            label=${item.label}
            href=${item.href}
            isSelected=${item.key === current}
          />
        `,
      )}
    />
  `;
  return h`
    <${AppShell} topNav=${topNav} contentPadding=${4}>
      <div className="page">
        <${VStack} gap=${6}>${children}</${VStack}>
      </div>
    </${AppShell}>
  `;
}

// ページ見出しと説明文
export function PageHeader({title, description}) {
  return h`
    <${VStack} gap=${1}>
      <${Heading} level=${1}>${title}</${Heading}>
      ${description && h`<${Text} as="p" color="secondary">${description}</${Text}>`}
    </${VStack}>
  `;
}

// Flask のルートへ普通に POST するフォーム。fields は hidden input として送る
export function PostForm({action, fields = {}, children, formRef, onSubmit, id}) {
  return h`
    <form method="post" action=${action} ref=${formRef} onSubmit=${onSubmit} id=${id}>
      ${Object.entries(fields).map(
        ([name, value]) => h`<input key=${name} type="hidden" name=${name} value=${value} />`,
      )}
      ${children}
    </form>
  `;
}

export function ConditionBadge({condition, label}) {
  return h`<${Badge} variant=${CONDITION_STYLES[condition].badge} label=${`調子: ${label}`} />`;
}

export function formatPercent(value) {
  return `${Math.round(value)}%`;
}
