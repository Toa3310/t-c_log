// 進行中: 選んだタスクを1つずつ完了にしていく
import { Badge, Banner, Button, Card, HStack, Icon, List, ListItem, ProgressBar, Text, VStack } from '@astryxdesign/core'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { api, errorMessage } from '../api.ts'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { formatPercent } from '../conditions.ts'
import { useApi } from '../hooks/useApi.ts'

export function SessionPage() {
  const navigate = useNavigate()
  const { state, reload, setData } = useApi(api.currentSession)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const header = <PageHeader title="今日のタスク" description="終わったタスクから「完了」を押していきましょう。" />
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
  const session = state.data.session
  // 進行中のタスクが無い（記録済み・Cookie が消えた等）なら最初の画面へ
  if (!session) return <Navigate to="/" replace />

  const complete = async (index: number) => {
    setPendingIndex(index)
    setError(null)
    try {
      const next = await api.completeTask(index)
      if (next.isComplete) {
        navigate('/session/finish')
      } else {
        setData({ session: next })
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPendingIndex(null)
    }
  }

  const doneCount = session.tasks.filter((t) => t.done).length

  return (
    <>
      {header}
      {error && <Banner status="error" title={error} />}
      <Card>
        <VStack gap={2}>
          <ProgressBar label="進捗" value={session.rate} hasValueLabel formatValueLabel={(v) => formatPercent(v)} />
          <Text type="supporting">
            {session.tasks.length}件中 {doneCount}件 完了
          </Text>
        </VStack>
      </Card>
      <Card padding={2}>
        <List hasDividers>
          {session.tasks.map((t, i) => (
            <ListItem
              key={i}
              label={t.name}
              endContent={
                t.done ? (
                  <Badge variant="success" icon={<Icon icon="check" />} label="完了" />
                ) : (
                  <Button
                    size="sm"
                    label={`「${t.name}」を完了にする`}
                    isLoading={pendingIndex === i}
                    isDisabled={pendingIndex !== null && pendingIndex !== i}
                    onClick={() => complete(i)}
                  >
                    完了
                  </Button>
                )
              }
            />
          ))}
        </List>
      </Card>
      <HStack justify="end">
        <Button href="/session/finish" variant="ghost" label="今日はここまでにする" />
      </HStack>
    </>
  )
}
