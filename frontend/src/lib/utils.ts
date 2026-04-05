import { format, parseISO, isValid } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { SignalColor, RiskStatus, RiskPriority, AttendanceStatus } from '../types'

export function formatDate(dateStr: string, fmt = 'yyyy년 MM월 dd일'): string {
  try {
    const date = parseISO(dateStr)
    if (!isValid(date)) return dateStr
    return format(date, fmt, { locale: ko })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  return formatDate(dateStr, 'yyyy.MM.dd HH:mm')
}

export function formatTime(dateStr: string): string {
  return formatDate(dateStr, 'HH:mm')
}

export function getSignalColorClass(color: SignalColor): string {
  switch (color) {
    case '녹색':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case '황색':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case '적색':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function getSignalDotColor(color: SignalColor): string {
  switch (color) {
    case '녹색': return 'bg-green-400'
    case '황색': return 'bg-yellow-400'
    case '적색': return 'bg-red-400'
    default: return 'bg-slate-400'
  }
}

export function getRiskStatusClass(status: RiskStatus): string {
  switch (status) {
    case '위험': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case '주의': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case '안전': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case '해결됨': return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function getRiskPriorityClass(priority: RiskPriority): string {
  switch (priority) {
    case '높음': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case '중간': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case '낮음': return 'bg-green-500/20 text-green-400 border-green-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function getAttendanceStatusClass(status: AttendanceStatus): string {
  switch (status) {
    case '출석': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case '지각': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case '결석': return 'bg-red-500/20 text-red-400 border-red-500/30'
    case '조퇴': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  }
}

export function calculateSignalColor(
  physical: number,
  mental: number,
  sleep: number,
  stress: number
): SignalColor {
  const avg = (physical + mental + sleep + (6 - stress)) / 4
  if (avg >= 3.5) return '녹색'
  if (avg >= 2.5) return '황색'
  return '적색'
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export const COUNTRIES = ['미국(NY)', '미국(LA)', '호주', '중국', '베트남']
export const COHORTS = ['1기', '2기', '3기', '4기', '5기']
