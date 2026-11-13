import { Badge } from '@astryxdesign/core'

import type { Condition } from '../api.ts'
import { CONDITION_STYLES } from '../conditions.ts'

export function ConditionBadge({ condition, label }: { condition: Condition; label: string }) {
  return <Badge variant={CONDITION_STYLES[condition].badge} label={`調子: ${label}`} />
}

/** 調子の色見本（小さな四角） */
export function ConditionSwatch({ condition }: { condition: Condition }) {
  return <span className="swatch" style={{ background: CONDITION_STYLES[condition].color }} />
}
