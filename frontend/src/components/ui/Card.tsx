import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'bg-slate-800 rounded-xl border border-slate-700',
        paddingClasses[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  borderColor?: string
  valueColor?: string
  icon?: ReactNode
}

export function KPICard({ title, value, subtitle, borderColor = 'border-slate-700', valueColor = 'text-slate-100', icon }: KPICardProps) {
  return (
    <div className={cn('bg-slate-800 rounded-xl p-5 border-l-4', borderColor, 'border-t border-r border-b border-t-slate-700 border-r-slate-700 border-b-slate-700')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className={cn('text-3xl font-bold', valueColor)}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className="text-slate-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
