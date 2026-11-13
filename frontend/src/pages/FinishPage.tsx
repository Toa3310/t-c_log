// 全部完了したとき・途中で終えるときの画面: 結果を確認し、一言メモを付けて記録する
import { Badge, Button, Card, HStack, List, ListItem, ProgressBar, TextArea, VStack } from '@astryxdesign/core'
import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { api, errorMessage } from '../api.ts'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { formatPercent } from '../conditions.ts'
import { useApi } from '../hooks/useApi.ts'

const COPY = {
  complete: {
    title: '今日のタスクは全て完了しました！',
    description: 'お疲れさまでした。最後に一言振り返って記録しましょう。',
    placeholder: '例: 順調だった',
  },
  cancel: {
    title: '今回はここまでにしました',
    description: 'ここまでの進み具合を記録しておきましょう。',
    placeholder: '例: 寝不足だった',
  },
}

export function FinishPage() {
  const navigate = useNavigate()
  const { state, reload } = useApi(api.currentSession)
  const [memo, setMemo] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <LoadError message={state.message} onRetry={reload} />
  const session = state.data.session
  if (!session) return <Navigate to="/" replace />

  const copy = session.isComplete ? COPY.complete : COPY.cancel

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await api.saveSession(memo)
      navigate('/logs')
    } catch (err) {
      setError(errorMessage(err))
      setIsSaving(false)
    }
  }

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />
      <Card>
        <VStack gap={3}>
          <ProgressBar
            label="進捗"
            value={session.rate}
            variant={session.isComplete ? 'success' : 'accent'}
            hasValueLabel
            formatValueLabel={(v) => formatPercent(v)}
          />
          <List hasDividers>
            {session.tasks.map((t, i) => (
              <ListItem
                key={i}
                label={t.name}
                endContent={
                  t.done ? <Badge variant="success" label="完了" /> : <Badge variant="neutral" label="未完了" />
                }
              />
            ))}
          </List>
        </VStack>
      </Card>
      <Card>
        <form onSubmit={save}>
          <VStack gap={4}>
            <TextArea
              label="今日の振り返り（一言メモ）"
              value={memo}
              onChange={setMemo}
              placeholder={copy.placeholder}
              rows={3}
              maxLength={session.memoMaxLength}
              isOptional
              status={error ? { type: 'error', message: error } : undefined}
            />
            <HStack gap={2} justify="end" wrap="wrap">
              {!session.isComplete && <Button href="/session" variant="ghost" label="タスクに戻る" />}
              <Button type="submit" variant="primary" label="記録する" isLoading={isSaving} />
            </HStack>
          </VStack>
        </form>
      </Card>
    </>
  )
}
