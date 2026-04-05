import { Bell, Search } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/dashboard': '통합 관리자 대시보드',
  '/announcements': '공지사항',
  '/health-check': '건강/심리 체크',
  '/assignments': '과제 관리',
  '/attendance': '출결 관리',
  '/daily-report': '일일 보고',
  '/risk-management': '리스크 관리',
}

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'GFGF'

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        <p className="text-xs text-slate-500">GFGF - 2026 경기 청년 사다리 프로그램 관리 시스템</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="검색..."
            className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-48"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{user.fullName.charAt(0)}</span>
            </div>
            <span className="text-sm text-slate-300 hidden md:block">{user.fullName}</span>
          </div>
        )}
      </div>
    </header>
  )
}
