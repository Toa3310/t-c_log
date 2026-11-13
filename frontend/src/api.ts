// バックエンド（Rust）の JSON API を呼ぶ関数と、やり取りするデータの型

export type Condition = 0 | 1 | 2

export interface TemplateTask {
  id: number
  condition: Condition
  name: string
}

export interface TemplateGroup {
  condition: Condition
  label: string
  tasks: TemplateTask[]
}

export interface TemplatesResponse {
  groups: TemplateGroup[]
  nameMaxLength: number
}

export interface SessionTask {
  name: string
  done: boolean
}

/** 進行中のタスク（まだ記録していない状態） */
export interface ActiveSession {
  condition: Condition
  conditionLabel: string
  tasks: SessionTask[]
  /** 進捗率（0〜100） */
  rate: number
  isComplete: boolean
  memoMaxLength: number
}

/** 記録1回分 */
export interface LogSession {
  createdAt: string
  condition: Condition
  conditionLabel: string
  memo: string | null
  tasks: SessionTask[]
}

export interface StatsResponse {
  /** 全体の達成率。記録が無ければ null */
  rate: number | null
  totalTasks: number
  doneTasks: number
  conditionRates: { condition: Condition; label: string; rate: number | null }[]
  composition: { condition: Condition; label: string; count: number; ratio: number }[]
  recentTotal: number
  recentDays: number
}

/** API がエラーを返したとき。message はサーバーが返した日本語のメッセージ */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'サーバーに接続できませんでした')
  }
  if (!res.ok) {
    let message = `通信に失敗しました（${res.status}）`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // JSON でないエラー（プロキシのエラーページなど）はそのまま
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  templates: () => request<TemplatesResponse>('GET', '/templates'),
  addTemplate: (condition: Condition, name: string) =>
    request<TemplateTask>('POST', '/templates', { condition, name }),
  renameTemplate: (id: number, name: string) => request<TemplateTask>('PATCH', `/templates/${id}`, { name }),
  deleteTemplate: (id: number) => request<void>('DELETE', `/templates/${id}`),

  currentSession: () => request<{ session: ActiveSession | null }>('GET', '/session'),
  startSession: (condition: Condition, templateIds: number[]) =>
    request<ActiveSession>('POST', '/session', { condition, templateIds }),
  completeTask: (index: number) => request<ActiveSession>('POST', `/session/tasks/${index}/complete`, {}),
  saveSession: (memo: string) => request<{ createdAt: string }>('POST', '/session/save', { memo }),

  logs: () => request<{ sessions: LogSession[] }>('GET', '/logs'),
  deleteLog: (createdAt: string) => request<void>('DELETE', `/logs/${encodeURIComponent(createdAt)}`),

  stats: () => request<StatsResponse>('GET', '/stats'),
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '予期しないエラーが発生しました'
}
