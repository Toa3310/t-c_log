// トップ: 調子を選ぶ → その調子のタスクから今日やるものを選ぶ
import {
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
} from '@astryxdesign/core';
import {
  AppFrame,
  CONDITION_STYLES,
  ConditionBadge,
  PageHeader,
  PostForm,
  h,
  mount,
  useRef,
  useState,
} from '../ui.js';

const CONDITION_HINTS = {
  2: '集中できそう。しっかり進めたい日',
  1: 'いつも通りのペースで',
  0: '疲れ気味。軽めのタスクで',
};

// 調子のカードを選ぶと POST /tasks に送信し、サーバーがタスク一覧付きで再描画する
function ConditionPicker({conditions, current}) {
  const formRef = useRef(null);
  const [value, setValue] = useState(current);

  const choose = (next) => {
    setValue(next);
    formRef.current.elements.condition.value = next;
    formRef.current.requestSubmit();
  };

  return h`
    <${PostForm} action="/tasks" formRef=${formRef}>
      <input type="hidden" name="condition" defaultValue=${current ?? ''} />
      <${Grid} columns=${{minWidth: 200, repeat: 'fit'}} gap=${3}>
        ${conditions.map(
          (c) => h`
            <${SelectableCard}
              key=${c.value}
              label=${`調子: ${c.label}`}
              isSelected=${c.value === value}
              onChange=${() => choose(c.value)}
            >
              <${VStack} gap=${1}>
                <${HStack} gap=${2} align="center">
                  <span className="swatch" style=${{background: CONDITION_STYLES[c.value].color}} />
                  <${Text} weight="semibold">${c.label}</${Text}>
                </${HStack}>
                <${Text} type="supporting">${CONDITION_HINTS[c.value]}</${Text}>
              </${VStack}>
            </${SelectableCard}>
          `,
        )}
      </${Grid}>
    </${PostForm}>
  `;
}

function TaskPicker({condition, label, tasks, message}) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(message);
  const allIds = tasks.map((t) => String(t.id));
  const isAllSelected = tasks.length > 0 && selected.length === allIds.length;

  // サーバー側でも検証しているが、送信前に気づけるようにここでも確認する
  const onSubmit = (e) => {
    if (selected.length === 0) {
      e.preventDefault();
      setError('タスクを1つ以上選択してください');
    }
  };

  const onChange = (values) => {
    setSelected(values);
    setError(null);
  };

  return h`
    <${Card}>
      <${VStack} gap=${4}>
        <${HStack} gap=${2} align="center" justify="between" wrap="wrap">
          <${Heading} level=${2}>今日やるタスク</${Heading}>
          <${ConditionBadge} condition=${condition} label=${label} />
        </${HStack}>
        ${
          tasks.length === 0
            ? h`
              <${EmptyState}
                title="この調子のタスクがまだありません"
                description="テンプレートにタスクを追加すると、ここで選べるようになります。"
                actions=${h`<${Button} href="/templates" label="テンプレートを編集する" />`}
              />
            `
            : h`
              <${PostForm} action="/start" fields=${{condition}} onSubmit=${onSubmit}>
                <${VStack} gap=${4}>
                  <${CheckboxList}
                    label="やるタスクを選んでください"
                    description="途中で終えても、そこまでの記録を残せます"
                    value=${selected}
                    onChange=${onChange}
                    hasDividers
                    status=${error ? {type: 'error', message: error} : undefined}
                  >
                    ${tasks.map(
                      (t) => h`<${CheckboxListItem} key=${t.id} value=${String(t.id)} label=${t.name} />`,
                    )}
                  </${CheckboxList}>
                  ${selected.map((id) => h`<input key=${id} type="hidden" name="selected_tasks" value=${id} />`)}
                  <${HStack} gap=${2} justify="end" wrap="wrap">
                    <${Button}
                      variant="ghost"
                      label=${isAllSelected ? '選択をすべて解除' : 'すべて選択'}
                      onClick=${() => onChange(isAllSelected ? [] : allIds)}
                    />
                    <${Button}
                      type="submit"
                      variant="primary"
                      label=${selected.length > 0 ? `${selected.length}件のタスクで始める` : 'このタスクで始める'}
                    />
                  </${HStack}>
                </${VStack}>
              </${PostForm}>
            `
        }
      </${VStack}>
    </${Card}>
  `;
}

function IndexPage({conditions, condition, tasks, message}) {
  const current = conditions.find((c) => c.value === condition);
  return h`
    <${AppFrame} current="index">
      <${PageHeader}
        title="今日の調子は？"
        description="今の集中度や気分に近いものを選ぶと、その調子に合ったタスクを提案します。"
      />
      <${ConditionPicker} conditions=${conditions} current=${condition} />
      ${
        current &&
        h`<${TaskPicker}
          key=${condition}
          condition=${condition}
          label=${current.label}
          tasks=${tasks}
          message=${message}
        />`
      }
    </${AppFrame}>
  `;
}

mount(IndexPage);
