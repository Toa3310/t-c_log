// タスクテンプレート: 調子ごとに提案するタスクの追加・名前変更・削除
import {
  AlertDialog,
  Banner,
  Button,
  Card,
  Grid,
  HStack,
  Heading,
  Selector,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core'
import { type FormEvent, useState } from 'react'

import { type Condition, type TemplateGroup, type TemplateTask, api, errorMessage } from '../api.ts'
import { ConditionSwatch } from '../components/ConditionBadge.tsx'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { useApi } from '../hooks/useApi.ts'

// サーバー側（domain::parse_task_name）と同じ規則。送信前に気づけるようにする
function validateName(name: string, maxLength: number): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'タスク名を入力してください'
  if ([...trimmed].length > maxLength) return `タスク名は${maxLength}文字以内で入力してください`
  return null
}

function AddForm({ groups, nameMaxLength, onAdded }: { groups: TemplateGroup[]; nameMaxLength: number; onAdded: () => void }) {
  const [condition, setCondition] = useState('1')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const message = validateName(name, nameMaxLength)
    if (message) {
      setError(message)
      return
    }
    setIsSaving(true)
    try {
      await api.addTemplate(Number(condition) as Condition, name)
      setName('')
      onAdded()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <VStack gap={4}>
          <Heading level={2}>タスクを追加</Heading>
          <Grid columns={{ minWidth: 200, repeat: 'fit' }} gap={3}>
            <Selector
              label="調子"
              options={groups.map((g) => ({ value: String(g.condition), label: g.label }))}
              value={condition}
              onChange={setCondition}
              width="100%"
            />
            <TextInput
              label="タスク名"
              value={name}
              onChange={(value) => {
                setName(value)
                setError(null)
              }}
              placeholder="例: 過去問10問"
              status={error ? { type: 'error', message: error } : undefined}
              width="100%"
            />
          </Grid>
          <HStack justify="end">
            <Button type="submit" variant="primary" label="追加" isLoading={isSaving} />
          </HStack>
        </VStack>
      </form>
    </Card>
  )
}

function TemplateRow({
  task,
  nameMaxLength,
  onRenamed,
  onDelete,
}: {
  task: TemplateTask
  nameMaxLength: number
  onRenamed: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(task.name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isChanged = name.trim() !== task.name

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const message = validateName(name, nameMaxLength)
    if (message) {
      setError(message)
      return
    }
    setIsSaving(true)
    try {
      const updated = await api.renameTemplate(task.id, name)
      setName(updated.name)
      onRenamed()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <HStack gap={2} align="start">
        <div className="row-input">
          <TextInput
            label={`「${task.name}」のタスク名`}
            isLabelHidden
            value={name}
            onChange={(value) => {
              setName(value)
              setError(null)
            }}
            status={error ? { type: 'error', message: error } : undefined}
            width="100%"
          />
        </div>
        <Button type="submit" label={`「${task.name}」の名前を更新`} isDisabled={!isChanged} isLoading={isSaving}>
          更新
        </Button>
        <Button variant="ghost" label={`「${task.name}」を削除`} onClick={onDelete}>
          削除
        </Button>
      </HStack>
    </form>
  )
}

export function TemplatesPage() {
  const { state, reload } = useApi(api.templates)
  const [target, setTarget] = useState<TemplateTask | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const header = <PageHeader title="タスクテンプレート" description="調子ごとに提案するタスクを編集できます。" />
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
  const { groups, nameMaxLength } = state.data

  const confirmDelete = async () => {
    if (!target) return
    setIsDeleting(true)
    try {
      await api.deleteTemplate(target.id)
      setError(null)
      reload()
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
      <AddForm groups={groups} nameMaxLength={nameMaxLength} onAdded={reload} />
      {groups.map((g) => (
        <Card key={g.condition}>
          <VStack gap={3}>
            <HStack gap={2} align="center">
              <ConditionSwatch condition={g.condition} />
              <Heading level={2}>調子が「{g.label}」の日</Heading>
            </HStack>
            {g.tasks.length === 0 ? (
              <Text type="supporting">まだタスクがありません。上のフォームから追加できます。</Text>
            ) : (
              g.tasks.map((task) => (
                <TemplateRow
                  key={task.id}
                  task={task}
                  nameMaxLength={nameMaxLength}
                  onRenamed={reload}
                  onDelete={() => setTarget(task)}
                />
              ))
            )}
          </VStack>
        </Card>
      ))}
      <AlertDialog
        isOpen={target !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setTarget(null)
        }}
        title="このタスクを削除しますか？"
        description={target ? `「${target.name}」をテンプレートから削除します。これまでの記録は残ります。` : ''}
        actionLabel="削除する"
        cancelLabel="キャンセル"
        isActionLoading={isDeleting}
        onAction={confirmDelete}
      />
    </>
  )
}
