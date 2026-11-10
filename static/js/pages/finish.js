// 全完了（complete.html）と途中終了（cancel.html）の共通画面: 結果を確認し、一言メモを付けて記録する
import {Badge, Button, Card, HStack, List, ListItem, ProgressBar, TextArea, VStack} from '@astryxdesign/core';
import {AppFrame, PageHeader, PostForm, formatPercent, h, mount, useState} from '../ui.js';

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
};

function FinishPage({variant, tasks, rate, memoMaxLength}) {
  const [memo, setMemo] = useState('');
  const copy = COPY[variant];

  return h`
    <${AppFrame} current="index">
      <${PageHeader} title=${copy.title} description=${copy.description} />
      <${Card}>
        <${VStack} gap=${3}>
          <${ProgressBar}
            label="進捗"
            value=${rate}
            variant=${variant === 'complete' ? 'success' : 'accent'}
            hasValueLabel
            formatValueLabel=${(value) => formatPercent(value)}
          />
          <${List} hasDividers>
            ${tasks.map(
              (t, i) => h`
                <${ListItem}
                  key=${i}
                  label=${t.name}
                  endContent=${
                    t.done
                      ? h`<${Badge} variant="success" label="完了" />`
                      : h`<${Badge} variant="neutral" label="未完了" />`
                  }
                />
              `,
            )}
          </${List}>
        </${VStack}>
      </${Card}>
      <${Card}>
        <${PostForm} action="/save">
          <${VStack} gap=${4}>
            <${TextArea}
              label="今日の振り返り（一言メモ）"
              htmlName="memo"
              value=${memo}
              onChange=${setMemo}
              placeholder=${copy.placeholder}
              rows=${3}
              maxLength=${memoMaxLength}
              isOptional
            />
            <${HStack} justify="end">
              <${Button} type="submit" variant="primary" label="記録する" />
            </${HStack}>
          </${VStack}>
        </${PostForm}>
      </${Card}>
    </${AppFrame}>
  `;
}

mount(FinishPage);
