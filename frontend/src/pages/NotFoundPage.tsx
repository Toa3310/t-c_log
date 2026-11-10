import { Button, Card, EmptyState } from '@astryxdesign/core'

import { PageHeader } from '../components/PageHeader.tsx'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="ページが見つかりません" />
      <Card>
        <EmptyState
          title="このページはありません"
          description="URL が正しいか確認してください。"
          actions={<Button href="/" variant="primary" label="トップに戻る" />}
        />
      </Card>
    </>
  )
}
