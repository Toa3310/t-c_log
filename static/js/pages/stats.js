// 統計: 全体の達成率（大きな数字＋メーター）、調子ごとの達成率（メーターの一覧）、
// 直近の調子の割合（細いセグメントバー＋回数と割合の一覧）
import {Button, Card, EmptyState, Heading, List, ListItem, ProgressBar, Text, VStack} from '@astryxdesign/core';
import {AppFrame, CONDITION_STYLES, PageHeader, formatPercent, h, mount} from '../ui.js';

function OverallCard({rate, totalTasks, doneTasks}) {
  return h`
    <${Card}>
      <${VStack} gap=${3}>
        <${Heading} level=${2}>全体の達成率</${Heading}>
        <div className="hero-figure">${formatPercent(rate)}</div>
        <${ProgressBar} label="全体の達成率" isLabelHidden value=${rate} />
        <${Text} type="supporting">
          これまでに記録した${totalTasks}件のタスクのうち、${doneTasks}件を完了
        </${Text}>
      </${VStack}>
    </${Card}>
  `;
}

function ConditionRatesCard({conditionRates}) {
  return h`
    <${Card}>
      <${VStack} gap=${4}>
        <${VStack} gap=${1}>
          <${Heading} level=${2}>調子ごとの達成率</${Heading}>
          <${Text} type="supporting">これまでの全記録から計算しています</${Text}>
        </${VStack}>
        ${conditionRates.map((item) =>
          item.rate === null
            ? h`
              <div key=${item.condition} className="meter-empty">
                <${Text}>${item.label}</${Text}>
                <${Text} type="supporting">データなし</${Text}>
              </div>
            `
            : h`
              <${ProgressBar}
                key=${item.condition}
                label=${item.label}
                value=${item.rate}
                hasValueLabel
                formatValueLabel=${(value) => formatPercent(value)}
              />
            `,
        )}
      </${VStack}>
    </${Card}>
  `;
}

function CompositionCard({composition, recentTotal, recentDays}) {
  const describe = (c) => `${c.label} ${c.count}回（${formatPercent(c.ratio)}）`;
  return h`
    <${Card}>
      <${VStack} gap=${4}>
        <${VStack} gap=${1}>
          <${Heading} level=${2}>直近${recentDays}日の調子</${Heading}>
          <${Text} type="supporting">
            ${recentTotal > 0 ? `記録した${recentTotal}回のうち、それぞれの調子だった割合` : `直近${recentDays}日の記録がありません`}
          </${Text}>
        </${VStack}>
        ${
          recentTotal > 0 &&
          h`
            <div className="segment-bar" role="img" aria-label=${composition.map(describe).join('、')}>
              ${composition
                .filter((c) => c.count > 0)
                .map(
                  (c) => h`
                    <span
                      key=${c.condition}
                      title=${describe(c)}
                      style=${{flexGrow: c.count, background: CONDITION_STYLES[c.condition].color}}
                    />
                  `,
                )}
            </div>
            <${List} density="compact">
              ${composition.map(
                (c) => h`
                  <${ListItem}
                    key=${c.condition}
                    startContent=${h`<span className="swatch" style=${{background: CONDITION_STYLES[c.condition].color}} />`}
                    label=${c.label}
                    endContent=${h`<${Text} hasTabularNumbers>${c.count}回・${formatPercent(c.ratio)}</${Text}>`}
                  />
                `,
              )}
            </${List}>
          `
        }
      </${VStack}>
    </${Card}>
  `;
}

function StatsPage({rate, totalTasks, doneTasks, conditionRates, composition, recentTotal, recentDays}) {
  return h`
    <${AppFrame} current="stats">
      <${PageHeader} title="統計" description="記録から、達成率と調子の傾向を振り返ります。" />
      ${
        rate === null
          ? h`
            <${Card}>
              <${EmptyState}
                title="まだ記録がありません"
                description="タスクを記録すると、達成率や調子の傾向がここに表示されます。"
                actions=${h`<${Button} href="/" variant="primary" label="今日のタスクを始める" />`}
              />
            </${Card}>
          `
          : h`
            <${OverallCard} rate=${rate} totalTasks=${totalTasks} doneTasks=${doneTasks} />
            <${ConditionRatesCard} conditionRates=${conditionRates} />
            <${CompositionCard} composition=${composition} recentTotal=${recentTotal} recentDays=${recentDays} />
          `
      }
    </${AppFrame}>
  `;
}

mount(StatsPage);
