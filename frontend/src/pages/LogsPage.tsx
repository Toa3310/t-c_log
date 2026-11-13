// 記録一覧: 1回分ごとにカードで表示し、確認ダイアログを挟んで削除できる
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  HStack,
  Heading,
  List,
  ListItem,
  Text,
  VStack,
} from '@astryxdesign/core'
import { useState } from 'react'

import { type LogSession, api, errorMessage } from '../api.ts'
import { ConditionBadge } from '../components/ConditionBadge.tsx'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { formatCreatedAt, formatPercent } from '../conditions.ts'
import { useApi } from '../hooks/useApi.ts'

function SessionCard({ session, onDelete }: { session: LogSession; onDelete: () => void }) {
  const doneCount = session.tasks.filter((t) => t.done).length
  const rate = (doneCount / session.tasks.length) * 100
  const when = formatCreatedAt(session.createdAt)

  return (
    <Card>
      <VStack gap={3}>
        <HStack gap={2} justify="between" align="start">
          <VStack gap={1}>
            <Heading level={2}>{when}</Heading>
            <HStack gap={2} align="center" wrap="wrap">
              <ConditionBadge condition={session.condition} label={session.conditionLabel} />
              <Text type="supporting">
                {session.tasks.length}件中 {doneCount}件 完了（{formatPercent(rate)}）
              </Text>
            </HStack>
          </VStack>
          <Button variant="ghost" size="sm" label={`${when}の記録を削除`} onClick={onDelete}>
            削除
          </Button>
        </HStack>
        <List density="compact">
          {session.tasks.map((t, i) => (
            <ListItem
              key={i}
              label={t.name}
              endContent={t.done ? <Badge variant="success" label="完了" /> : <Badge variant="neutral" label="未完了" />}
            />
          ))}
        </List>
        {session.memo && (
          <Text as="p" color="secondary">
            メモ: {session.memo}
          </Text>
        )}
      </VStack>
    </Card>
  )
}

export function LogsPage() {
  const { state, reload, setData } = useApi(api.logs)
  const [target, setTarget] = useState<LogSession | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const header = <PageHeader title="これまでの記録" description="新しい記録から順に表示しています。" />
  if (state.status === 'loading') {
    return (
      <>
        {header}
        <Loading />
      </>
    )
  }
  if (state.status === 'error') {
    return (
      <>
        {header}
        <LoadError message={state.message} onRetry={reload} />
      </>
    )
  }
  const { sessions } = state.data

  const confirmDelete = async () => {
    if (!target) return
    setIsDeleting(true)
    try {
      await api.deleteLog(target.createdAt)
      setData({ sessions: sessions.filter((s) => s.createdAt !== target.createdAt) })
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsDeleting(false)
      setTarget(null)
    }
  }

  return (
    <>
      {header}
      {error && <Banner status="error" title={error} />}
      {sessions.length === 0 ? (
        <Card>
          <EmptyState
            title="まだ記録がありません"
            description="タスクを終えて記録すると、ここに表示されます。"
            actions={<Button href="/" variant="primary" label="今日のタスクを始める" />}
          />
        </Card>
      ) : (
        sessions.map((s) => <SessionCard key={s.createdAt} session={s} onDelete={() => setTarget(s)} />)
      )}
      <AlertDialog
        isOpen={target !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setTarget(null)
        }}
        title="この記録を削除しますか？"
        description={target ? `${formatCreatedAt(target.createdAt)}の記録を削除します。元には戻せません。` : ''}
        actionLabel="削除する"
        cancelLabel="キャンセル"
        isActionLoading={isDeleting}
        onAction={confirmDelete}
      />
    </>
  )
}
