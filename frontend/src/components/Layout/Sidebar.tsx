import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Megaphone,
  Heart,
  FileText,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { path: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { path: '/announcements', label: '공지사항', icon: Megaphone },
  { path: '/health-check', label: '건강/심리 체크', icon: Heart },
  { path: '/assignments', label: '과제 관리', icon: FileText },
  { path: '/attendance', label: '출결 관리', icon: UserCheck },
  { path: '/daily-report', label: '일일 보고', icon: ClipboardList },
  { path: '/risk-management', label: '리스크 관리', icon: AlertTriangle },
]

const roleLabels = {
  admin: '관리자',
  manager: '매니저',
  participant: '참가자',
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-700/50 flex flex-col transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">G</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-slate-100 leading-tight whitespace-nowrap">GFGF</p>
            <p className="text-xs text-slate-400 whitespace-nowrap">2026 경기 청년 사다리 프로그램</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path
            return (
              <li key={path}>
                <NavLink
                  to={path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group',
                    isActive
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="whitespace-nowrap">{label}</span>}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="border-t border-slate-700/50 p-3">
        {!collapsed && user && (
          <div className="mb-3 px-2 py-2 rounded-lg bg-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user.fullName.charAt(0)}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-slate-100 truncate">{user.fullName}</p>
                <p className="text-xs text-slate-400">{roleLabels[user.role]}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm',
            collapsed && 'justify-center'
          )}
          title={collapsed ? '로그아웃' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>로그아웃</span>}
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-600 transition-all shadow-lg"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
