// 記録一覧: 1回分（同じ created_at）ごとにカードで表示し、確認ダイアログを挟んで削除できる
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  EmptyState,
  HStack,
  Heading,
  List,
  ListItem,
  Text,
  VStack,
} from '@astryxdesign/core';
import {AppFrame, ConditionBadge, PageHeader, PostForm, formatPercent, h, mount, useRef, useState} from '../ui.js';

const dateFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// created_at は Python の isoformat()（マイクロ秒付き）。JS が確実に読める秒までを使う
function formatCreatedAt(createdAt) {
  return dateFormat.format(new Date(createdAt.slice(0, 19)));
}

function SessionCard({session, onDelete}) {
  const doneCount = session.tasks.filter((t) => t.done).length;
  const rate = (doneCount / session.tasks.length) * 100;

  return h`
    <${Card}>
      <${VStack} gap=${3}>
        <${HStack} gap=${2} justify="between" align="start">
          <${VStack} gap=${1}>
            <${Heading} level=${2}>${formatCreatedAt(session.created_at)}</${Heading}>
            <${HStack} gap=${2} align="center" wrap="wrap">
              <${ConditionBadge} condition=${session.condition} label=${session.condition_label} />
              <${Text} type="supporting">
                ${session.tasks.length}件中 ${doneCount}件 完了（${formatPercent(rate)}）
              </${Text}>
            </${HStack}>
          </${VStack}>
          <${Button}
            variant="ghost"
            size="sm"
            label=${`${formatCreatedAt(session.created_at)}の記録を削除`}
            onClick=${() => onDelete(session)}
          >削除</${Button}>
        </${HStack}>
        <${List} density="compact">
          ${session.tasks.map(
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
        ${session.memo && h`<${Text} as="p" color="secondary">メモ: ${session.memo}</${Text}>`}
      </${VStack}>
    </${Card}>
  `;
}

function LogsPage({sessions}) {
  const [target, setTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const formRef = useRef(null);

  const confirmDelete = () => {
    setIsDeleting(true);
    formRef.current.requestSubmit();
  };

  return h`
    <${AppFrame} current="logs">
      <${PageHeader} title="これまでの記録" description="新しい記録から順に表示しています。" />
      ${
        sessions.length === 0
          ? h`
            <${Card}>
              <${EmptyState}
                title="まだ記録がありません"
                description="タスクを終えて記録すると、ここに表示されます。"
                actions=${h`<${Button} href="/" variant="primary" label="今日のタスクを始める" />`}
              />
            </${Card}>
          `
          : sessions.map(
              (s) => h`<${SessionCard} key=${s.created_at} session=${s} onDelete=${setTarget} />`,
            )
      }
      <${PostForm} action="/logs/delete" formRef=${formRef} fields=${{created_at: target ? target.created_at : ''}} />
      <${AlertDialog}
        isOpen=${target !== null}
        onOpenChange=${(isOpen) => {
          if (!isOpen) setTarget(null);
        }}
        title="この記録を削除しますか？"
        description=${target ? `${formatCreatedAt(target.created_at)}の記録を削除します。元には戻せません。` : ''}
        actionLabel="削除する"
        cancelLabel="キャンセル"
        isActionLoading=${isDeleting}
        onAction=${confirmDelete}
      />
    </${AppFrame}>
  `;
}

mount(LogsPage);
