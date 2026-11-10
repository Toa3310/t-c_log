// タスクテンプレート: 調子ごとに提案するタスクの追加・名前変更・削除
import {
  AlertDialog,
  Button,
  Card,
  Grid,
  HStack,
  Heading,
  Selector,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {AppFrame, CONDITION_STYLES, PageHeader, PostForm, h, mount, useRef, useState} from '../ui.js';

// サーバー側（parse_task_name）と同じ規則。送信前に気づけるようにする
function validateName(name, maxLength) {
  const trimmed = name.trim();
  if (trimmed === '') return 'タスク名を入力してください';
  if (trimmed.length > maxLength) return `${maxLength}文字以内で入力してください`;
  return null;
}

function AddForm({conditions, nameMaxLength}) {
  const [condition, setCondition] = useState('1');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = (e) => {
    const message = validateName(name, nameMaxLength);
    if (message) {
      e.preventDefault();
      setError(message);
    }
  };

  return h`
    <${Card}>
      <${PostForm} action="/templates/add" onSubmit=${onSubmit}>
        <${VStack} gap=${4}>
          <${Heading} level=${2}>タスクを追加</${Heading}>
          <${Grid} columns=${{minWidth: 200, repeat: 'fit'}} gap=${3}>
            <${Selector}
              label="調子"
              htmlName="condition"
              options=${conditions.map((c) => ({value: String(c.value), label: c.label}))}
              value=${condition}
              onChange=${setCondition}
              width="100%"
            />
            <${TextInput}
              label="タスク名"
              htmlName="name"
              value=${name}
              onChange=${(value) => {
                setName(value);
                setError(null);
              }}
              placeholder="例: 過去問10問"
              status=${error ? {type: 'error', message: error} : undefined}
              width="100%"
            />
          </${Grid}>
          <${HStack} justify="end">
            <${Button} type="submit" variant="primary" label="追加" />
          </${HStack}>
        </${VStack}>
      </${PostForm}>
    </${Card}>
  `;
}

function TemplateRow({task, nameMaxLength, onDelete}) {
  const [name, setName] = useState(task.name);
  const [error, setError] = useState(null);
  const isChanged = name.trim() !== task.name;

  const onSubmit = (e) => {
    const message = validateName(name, nameMaxLength);
    if (message) {
      e.preventDefault();
      setError(message);
    }
  };

  return h`
    <${PostForm} action="/templates/edit" fields=${{id: task.id}} onSubmit=${onSubmit}>
      <${HStack} gap=${2} align="start">
        <div className="row-input">
          <${TextInput}
            label=${`「${task.name}」のタスク名`}
            isLabelHidden
            htmlName="name"
            value=${name}
            onChange=${(value) => {
              setName(value);
              setError(null);
            }}
            status=${error ? {type: 'error', message: error} : undefined}
            width="100%"
          />
        </div>
        <${Button} type="submit" label=${`「${task.name}」の名前を更新`} isDisabled=${!isChanged}>更新</${Button}>
        <${Button}
          variant="ghost"
          label=${`「${task.name}」を削除`}
          onClick=${() => onDelete(task)}
        >削除</${Button}>
      </${HStack}>
    </${PostForm}>
  `;
}

function TemplateGroup({group, nameMaxLength, onDelete}) {
  return h`
    <${Card}>
      <${VStack} gap=${3}>
        <${HStack} gap=${2} align="center">
          <span className="swatch" style=${{background: CONDITION_STYLES[group.condition].color}} />
          <${Heading} level=${2}>調子が「${group.label}」の日</${Heading}>
        </${HStack}>
        ${
          group.tasks.length === 0
            ? h`<${Text} type="supporting">まだタスクがありません。上のフォームから追加できます。</${Text}>`
            : group.tasks.map(
                (task) => h`
                  <${TemplateRow} key=${task.id} task=${task} nameMaxLength=${nameMaxLength} onDelete=${onDelete} />
                `,
              )
        }
      </${VStack}>
    </${Card}>
  `;
}

function TemplatesPage({conditions, groups, nameMaxLength}) {
  const [target, setTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteFormRef = useRef(null);

  const confirmDelete = () => {
    setIsDeleting(true);
    deleteFormRef.current.requestSubmit();
  };

  return h`
    <${AppFrame} current="templates">
      <${PageHeader}
        title="タスクテンプレート"
        description="調子ごとに提案するタスクを編集できます。"
      />
      <${AddForm} conditions=${conditions} nameMaxLength=${nameMaxLength} />
      ${groups.map(
        (g) => h`
          <${TemplateGroup} key=${g.condition} group=${g} nameMaxLength=${nameMaxLength} onDelete=${setTarget} />
        `,
      )}
      <${PostForm} action="/templates/delete" formRef=${deleteFormRef} fields=${{id: target ? target.id : ''}} />
      <${AlertDialog}
        isOpen=${target !== null}
        onOpenChange=${(isOpen) => {
          if (!isOpen) setTarget(null);
        }}
        title="このタスクを削除しますか？"
        description=${target ? `「${target.name}」をテンプレートから削除します。これまでの記録は残ります。` : ''}
        actionLabel="削除する"
        cancelLabel="キャンセル"
        isActionLoading=${isDeleting}
        onAction=${confirmDelete}
      />
    </${AppFrame}>
  `;
}

mount(TemplatesPage);
