import { STATUS_STYLES } from '../lib/utils'

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.cls}`}>
      {style.label}
    </span>
  )
}
