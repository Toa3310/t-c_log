import type { Condition } from './api.ts'

/**
 * 調子ごとの見た目。よくない < 普通 < 良い の順序がある尺度なので、
 * 両端を寒色（青）と暖色（オレンジ）、真ん中をグレーにする（赤と緑の組み合わせは色覚多様性の点で避けた）。
 * 色は Astryx のデータ可視化トークンで、ライト／ダークの両方で十分なコントラストがある。
 */
export const CONDITION_STYLES: Record<Condition, { badge: 'blue' | 'neutral' | 'orange'; color: string; hint: string }> = {
  2: { badge: 'blue', color: 'var(--color-data-categorical-blue)', hint: '集中できそう。しっかり進めたい日' },
  1: { badge: 'neutral', color: 'var(--color-data-neutral)', hint: 'いつも通りのペースで' },
  0: { badge: 'orange', color: 'var(--color-data-orange-4)', hint: '疲れ気味。軽めのタスクで' },
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

const dateFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** created_at（例: 2026-11-10T21:28:12.123456）を「2026年11月10日(火) 21:28」にする */
export function formatCreatedAt(createdAt: string): string {
  // マイクロ秒までは Date が確実に読めないので、秒までを使う
  return dateFormat.format(new Date(createdAt.slice(0, 19)))
}
