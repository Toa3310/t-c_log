import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '../api.ts'

export type ApiState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

/**
 * ページ表示時にデータを読み込む。reload() で読み直し、setData() で手元のデータを書き換える。
 * load は呼び出すたびに同じ処理になる関数を渡す（例: api.logs）
 */
export function useApi<T>(load: () => Promise<T>) {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(error) })
      })
    return () => {
      cancelled = true
    }
  }, [load, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const setData = useCallback((data: T) => setState({ status: 'ready', data }), [])

  return { state, reload, setData }
}
