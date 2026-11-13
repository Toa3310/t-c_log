// 統計: 全体の達成率（大きな数字＋メーター）、調子ごとの達成率（メーターの一覧）、
// 直近の調子の割合（細いセグメントバー＋回数と割合の一覧）
import { Button, Card, EmptyState, Heading, List, ListItem, ProgressBar, Text, VStack } from '@astryxdesign/core'

import { type StatsResponse, api } from '../api.ts'
import { ConditionSwatch } from '../components/ConditionBadge.tsx'
import { LoadError, Loading } from '../components/LoadState.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { CONDITION_STYLES, formatPercent } from '../conditions.ts'
import { useApi } from '../hooks/useApi.ts'

function OverallCard({ rate, totalTasks, doneTasks }: { rate: number; totalTasks: number; doneTasks: number }) {
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={2}>全体の達成率</Heading>
        <div className="hero-figure">{formatPercent(rate)}</div>
        <ProgressBar label="全体の達成率" isLabelHidden value={rate} />
        <Text type="supporting">
          これまでに記録した{totalTasks}件のタスクのうち、{doneTasks}件を完了
        </Text>
      </VStack>
    </Card>
  )
}

function ConditionRatesCard({ conditionRates }: { conditionRates: StatsResponse['conditionRates'] }) {
  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>調子ごとの達成率</Heading>
          <Text type="supporting">これまでの全記録から計算しています</Text>
        </VStack>
        {conditionRates.map((item) =>
          item.rate === null ? (
            <div key={item.condition} className="meter-empty">
              <Text>{item.label}</Text>
              <Text type="supporting">データなし</Text>
            </div>
          ) : (
            <ProgressBar
              key={item.condition}
              label={item.label}
              value={item.rate}
              hasValueLabel
              formatValueLabel={(v) => formatPercent(v)}
            />
          ),
        )}
      </VStack>
    </Card>
  )
}

function CompositionCard({ composition, recentTotal, recentDays }: Pick<StatsResponse, 'composition' | 'recentTotal' | 'recentDays'>) {
  const describe = (c: StatsResponse['composition'][number]) => `${c.label} ${c.count}回（${formatPercent(c.ratio)}）`
  return (
    <Card>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>直近{recentDays}日の調子</Heading>
          <Text type="supporting">
            {recentTotal > 0
              ? `記録した${recentTotal}回のうち、それぞれの調子だった割合`
              : `直近${recentDays}日の記録がありません`}
          </Text>
        </VStack>
        {recentTotal > 0 && (
          <>
            <div className="segment-bar" role="img" aria-label={composition.map(describe).join('、')}>
              {composition
                .filter((c) => c.count > 0)
                .map((c) => (
                  <span
                    key={c.condition}
                    title={describe(c)}
                    style={{ flexGrow: c.count, background: CONDITION_STYLES[c.condition].color }}
                  />
                ))}
            </div>
            <List density="compact">
              {composition.map((c) => (
                <ListItem
                  key={c.condition}
                  startContent={<ConditionSwatch condition={c.condition} />}
                  label={c.label}
                  endContent={
                    <Text hasTabularNumbers>
                      {c.count}回・{formatPercent(c.ratio)}
                    </Text>
                  }
                />
              ))}
            </List>
          </>
        )}
      </VStack>
    </Card>
  )
}

export function StatsPage() {
  const { state, reload } = useApi(api.stats)
  const header = <PageHeader title="統計" description="記録から、達成率と調子の傾向を振り返ります。" />

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
  const stats = state.data

  return (
    <>
      {header}
      {stats.rate === null ? (
        <Card>
          <EmptyState
            title="まだ記録がありません"
            description="タスクを記録すると、達成率や調子の傾向がここに表示されます。"
            actions={<Button href="/" variant="primary" label="今日のタスクを始める" />}
          />
        </Card>
      ) : (
        <>
          <OverallCard rate={stats.rate} totalTasks={stats.totalTasks} doneTasks={stats.doneTasks} />
          <ConditionRatesCard conditionRates={stats.conditionRates} />
          <CompositionCard composition={stats.composition} recentTotal={stats.recentTotal} recentDays={stats.recentDays} />
        </>
      )}
    </>
  )
}
