import { Banner, Button, Spinner } from '@astryxdesign/core'

export function Loading() {
  return (
    <div className="loading">
      <Spinner size="lg" label="読み込み中" />
    </div>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Banner
      status="error"
      title="読み込みに失敗しました"
      description={message}
      endContent={<Button label="もう一度読み込む" size="sm" onClick={onRetry} />}
    />
  )
}
