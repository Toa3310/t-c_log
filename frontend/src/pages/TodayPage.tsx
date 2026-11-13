// トップ: 調子を選ぶ → その調子のタスクから今日やるものを選んで始める
import {
  Banner,
  Button,
  Card,
  CheckboxList,
  CheckboxListItem,
  EmptyState,
  Grid,
  HStack,
  Heading,
  SelectableCard,
  Text,
  VStack,
} from '@astryxdesign/core'
import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { type Condition, type TemplateGroup, api, errorMessage } from '../api.ts'
import { ConditionBadge, ConditionSwatch } from '../components/ConditionBadge.tsx'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { CONDITION_STYLES } from '../conditions.ts'
import { useApi } from '../hooks/useApi.ts'

function parseCondition(value: string | null): Condition | null {
  return value === '0' || value === '1' || value === '2' ? (Number(value) as Condition) : null
}

function ConditionPicker({
  groups,
  value,
  onChange,
}: {
  groups: TemplateGroup[]
  value: Condition | null
  onChange: (condition: Condition) => void
}) {
  return (
    <Grid columns={{ minWidth: 200, repeat: 'fit' }} gap={3}>
      {groups.map((g) => (
        <SelectableCard
          key={g.condition}
          label={`調子: ${g.label}`}
          isSelected={g.condition === value}
          onChange={() => onChange(g.condition)}
        >
          <VStack gap={1}>
            <HStack gap={2} align="center">
              <ConditionSwatch condition={g.condition} />
              <Text weight="semibold">{g.label}</Text>
            </HStack>
            <Text type="supporting">{CONDITION_STYLES[g.condition].hint}</Text>
          </VStack>
        </SelectableCard>
      ))}
    </Grid>
  )
}

function TaskPicker({ group, onStarted }: { group: TemplateGroup; onStarted: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const allIds = group.tasks.map((t) => String(t.id))
  const isAllSelected = allIds.length > 0 && selected.length === allIds.length

  const onChange = (values: string[]) => {
    setSelected(values)
    setError(null)
  }

  const start = async (e: FormEvent) => {
    e.preventDefault()
    // サーバー側でも検証しているが、送信前に気づけるようにここでも確認する
    if (selected.length === 0) {
      setError('タスクを1つ以上選択してください')
      return
    }
    setIsSubmitting(true)
    try {
      await api.startSession(group.condition, selected.map(Number))
      onStarted()
    } catch (err) {
      setError(errorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <VStack gap={4}>
        <HStack gap={2} align="center" justify="between" wrap="wrap">
          <Heading level={2}>今日やるタスク</Heading>
          <ConditionBadge condition={group.condition} label={group.label} />
        </HStack>
        {group.tasks.length === 0 ? (
          <EmptyState
            title="この調子のタスクがまだありません"
            description="テンプレートにタスクを追加すると、ここで選べるようになります。"
            actions={<Button href="/templates" label="テンプレートを編集する" />}
          />
        ) : (
          <form onSubmit={start}>
            <VStack gap={4}>
              <CheckboxList
                label="やるタスクを選んでください"
                description="途中で終えても、そこまでの記録を残せます"
                value={selected}
                onChange={onChange}
                hasDividers
                status={error ? { type: 'error', message: error } : undefined}
              >
                {group.tasks.map((t) => (
                  <CheckboxListItem key={t.id} value={String(t.id)} label={t.name} />
                ))}
              </CheckboxList>
              <HStack gap={2} justify="end" wrap="wrap">
                <Button
                  variant="ghost"
                  label={isAllSelected ? '選択をすべて解除' : 'すべて選択'}
                  onClick={() => onChange(isAllSelected ? [] : allIds)}
                />
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  label={selected.length > 0 ? `${selected.length}件のタスクで始める` : 'このタスクで始める'}
                />
              </HStack>
            </VStack>
          </form>
        )}
      </VStack>
    </Card>
  )
}

export function TodayPage() {
  const navigate = useNavigate()
  // 選んだ調子は URL（?condition=1）に持たせる。再読み込みや「戻る」でも選択が残る
  const [searchParams, setSearchParams] = useSearchParams()
  const condition = parseCondition(searchParams.get('condition'))
  const templates = useApi(api.templates)
  const current = useApi(api.currentSession)

  const header = (
    <PageHeader
      title="今日の調子は？"
      description="今の集中度や気分に近いものを選ぶと、その調子に合ったタスクを提案します。"
    />
  )
  if (templates.state.status === 'loading' || current.state.status === 'loading') {
    return (
      <>
        {header}
        <Loading />
      </>
    )
  }
  if (templates.state.status === 'error' || current.state.status === 'error') {
    const failed = templates.state.status === 'error' ? templates.state : current.state
    const message = failed.status === 'error' ? failed.message : ''
    return (
      <>
        {header}
        <LoadError
          message={message}
          onRetry={() => {
            templates.reload()
            current.reload()
          }}
        />
      </>
    )
  }

  const { groups } = templates.state.data
  const active = current.state.data.session
  const group = groups.find((g) => g.condition === condition)

  return (
    <>
      {header}
      {active && (
        <Banner
          status="info"
          title="進行中のタスクがあります"
          description={`調子「${active.conditionLabel}」で${active.tasks.length}件のタスクに取り組み中です。新しく始めると、進行中の内容は記録されずに置き換わります。`}
          endContent={<Button href="/session" size="sm" label="続きから再開" />}
        />
      )}
      <ConditionPicker
        groups={groups}
        value={condition}
        onChange={(c) => setSearchParams({ condition: String(c) })}
      />
      {group && <TaskPicker key={group.condition} group={group} onStarted={() => navigate('/session')} />}
    </>
  )
}
