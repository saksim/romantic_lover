export function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatChineseDate(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  )
}

export function daysSince(value?: string) {
  if (!value) return null
  const start = new Date(`${value}T12:00:00`)
  const now = new Date()
  if (Number.isNaN(start.getTime())) return null
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1)
}

export function daysUntil(value: string) {
  const target = new Date(`${value}T23:59:59`)
  const now = new Date()
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}

