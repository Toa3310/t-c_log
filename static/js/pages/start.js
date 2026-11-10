// 進行中: 選んだタスクを1つずつ完了にしていく
import {Badge, Button, Card, HStack, Icon, List, ListItem, ProgressBar, Text, VStack} from '@astryxdesign/core';
import {AppFrame, PageHeader, PostForm, formatPercent, h, mount} from '../ui.js';

function StartPage({tasks, rate}) {
  const doneCount = tasks.filter((t) => t.done).length;

  return h`
    <${AppFrame} current="index">
      <${PageHeader}
        title="今日のタスク"
        description="終わったタスクから「完了」を押していきましょう。"
      />
      <${Card}>
        <${VStack} gap=${2}>
          <${ProgressBar}
            label="進捗"
            value=${rate}
            hasValueLabel
            formatValueLabel=${(value) => formatPercent(value)}
          />
          <${Text} type="supporting">${tasks.length}件中 ${doneCount}件 完了</${Text}>
        </${VStack}>
      </${Card}>
      <${Card} padding=${2}>
        <${List} hasDividers>
          ${tasks.map(
            (t, i) => h`
              <${ListItem}
                key=${i}
                label=${t.name}
                endContent=${
                  t.done
                    ? h`<${Badge} variant="success" icon=${h`<${Icon} icon="check" />`} label="完了" />`
                    : h`
                      <${PostForm} action="/complete" fields=${{task_index: i}}>
                        <${Button} type="submit" size="sm" label=${`「${t.name}」を完了にする`}>完了</${Button}>
                      </${PostForm}>
                    `
                }
              />
            `,
          )}
        </${List}>
      </${Card}>
      <${HStack} justify="end">
        <${PostForm} action="/cancel">
          <${Button} type="submit" variant="ghost" label="今日はここまでにする" />
        </${PostForm}>
      </${HStack}>
    </${AppFrame}>
  `;
}

mount(StartPage);
