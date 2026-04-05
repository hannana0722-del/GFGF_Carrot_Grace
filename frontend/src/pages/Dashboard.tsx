import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  AlertTriangle,
  FileText,
  Megaphone,
  Heart,
  UserCheck,
  ClipboardList,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/LoadingSpinner'
import type { DashboardStats } from '../types'

const MOCK_STATS: DashboardStats = {
  todayAttendanceRate: 87,
  riskCount: 3,
  assignmentSubmitted: 42,
  assignmentTotal: 50,
  countryStats: [
    { country: '미국(NY)', attendanceRate: 92, assignmentRate: 88 },
    { country: '미국(LA)', attendanceRate: 85, assignmentRate: 80 },
    { country: '호주', attendanceRate: 90, assignmentRate: 95 },
    { country: '중국', attendanceRate: 78, assignmentRate: 72 },
    { country: '베트남', attendanceRate: 88, assignmentRate: 83 },
  ],
  notifications: [
    {
      id: 1,
      type: '건강',
      message: '김민준 (미국NY) - 적신호 발생: 스트레스 수치 위험 수준',
      createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
      isRead: false,
      severity: 'high',
    },
    {
      id: 2,
      type: '건강',
      message: '이서연 (호주) - 적신호 발생: 수면 부족 및 신체 컨디션 저하',
      createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
      isRead: false,
      severity: 'high',
    },
    {
      id: 3,
      type: '출결',
      message: '박지훈 (중국) - 무단 결석 처리 (3회 누적)',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      isRead: false,
      severity: 'medium',
    },
    {
      id: 4,
      type: '출결',
      message: '최예은 (베트남) - 지각 처리 (오전 세션)',
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      isRead: true,
      severity: 'low',
    },
    {
      id: 5,
      type: '과제',
      message: '1주차 과제 마감 임박 - 미제출 8명',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
      isRead: false,
      severity: 'medium',
    },
    {
      id: 6,
      type: '과제',
      message: '김태양 (미국LA) - 지각 제출 (2일 초과)',
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      isRead: true,
      severity: 'low',
    },
  ],
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fall through */ }
  return MOCK_STATS
}

const notificationBorderColors: Record<string, string> = {
  '건강': 'border-red-500/50 bg-red-500/5',
  '출결': 'border-yellow-500/50 bg-yellow-500/5',
  '과제': 'border-yellow-500/50 bg-yellow-500/5',
  '일반': 'border-slate-600 bg-slate-800/50',
}

const notificationTagColors: Record<string, string> = {
  '건강': 'bg-red-500/20 text-red-400',
  '출결': 'bg-yellow-500/20 text-yellow-400',
  '과제': 'bg-yellow-500/20 text-yellow-400',
  '일반': 'bg-slate-600 text-slate-300',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

const quickLinks = [
  { path: '/announcements', label: '공지사항', icon: Megaphone, color: 'hover:bg-cyan-600/20 hover:border-cyan-500/30' },
  { path: '/health-check', label: '건강/심리', icon: Heart, color: 'hover:bg-red-600/20 hover:border-red-500/30' },
  { path: '/assignments', label: '과제 관리', icon: FileText, color: 'hover:bg-blue-600/20 hover:border-blue-500/30' },
  { path: '/attendance', label: '출결 관리', icon: UserCheck, color: 'hover:bg-green-600/20 hover:border-green-500/30' },
  { path: '/daily-report', label: '일일 보고', icon: ClipboardList, color: 'hover:bg-purple-600/20 hover:border-purple-500/30' },
  { path: '/risk-management', label: '리스크 관리', icon: AlertTriangle, color: 'hover:bg-orange-600/20 hover:border-orange-500/30' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-sm font-medium text-slate-200 mb-2">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}%
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [cohort, setCohort] = useState('전체')
  const [country, setCountry] = useState('전체')
  const [period, setPeriod] = useState('이번 주')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60000,
  })

  if (isLoading) return <PageLoader />

  const data = stats ?? MOCK_STATS

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card className="!p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-slate-400" />
            <span className="text-sm text-slate-400">필터:</span>
          </div>
          <select
            value={cohort}
            onChange={(e) => setCohort(e.target.value)}
            className="select-field !w-auto text-sm"
          >
            {['전체', '1기', '2기', '3기', '4기', '5기'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="select-field !w-auto text-sm"
          >
            {['전체', '미국(NY)', '미국(LA)', '호주', '중국', '베트남'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="select-field !w-auto text-sm"
          >
            {['오늘', '이번 주', '이번 달', '전체'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-l-green-500 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">오늘 출석률</p>
              <p className="text-4xl font-bold text-green-400">{data.todayAttendanceRate}%</p>
              <p className="text-xs text-slate-500 mt-1">전일 대비 +2%</p>
            </div>
            <div className="p-2 rounded-lg bg-green-500/10">
              <UserCheck size={24} className="text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-l-red-500 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">위험(적신호) 발생</p>
              <p className="text-4xl font-bold text-red-400">{data.riskCount}</p>
              <p className="text-xs text-slate-500 mt-1">즉각적인 조치 필요</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border-l-4 border-l-cyan-500 border border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">과제 제출 완료</p>
              <p className="text-4xl font-bold text-cyan-400">
                {data.assignmentSubmitted}
                <span className="text-2xl text-slate-500">/{data.assignmentTotal}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {Math.round((data.assignmentSubmitted / data.assignmentTotal) * 100)}% 완료
              </p>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <FileText size={24} className="text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Notifications */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <div className="xl:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-100">국가별 출결 및 과제 현황</h2>
                <p className="text-xs text-slate-500 mt-0.5">기수: {cohort} · 기간: {period}</p>
              </div>
              <Badge variant="info">실시간</Badge>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.countryStats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="country"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#94a3b8' }}
                />
                <Bar dataKey="attendanceRate" name="출석률" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="assignmentRate" name="과제완료율" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Real-time notifications */}
        <div>
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-100">실시간 알림</h2>
              <span className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                라이브
              </span>
            </div>
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {data.notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3 rounded-lg border text-xs ${notificationBorderColors[notif.type] ?? 'border-slate-700'} ${!notif.isRead ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${notificationTagColors[notif.type] ?? ''}`}>
                      [{notif.type}]
                    </span>
                    {!notif.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed">{notif.message}</p>
                  <p className="text-slate-500 mt-1">{timeAgo(notif.createdAt)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick navigation */}
      <Card>
        <h2 className="text-base font-semibold text-slate-100 mb-4">빠른 이동</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map(({ path, label, icon: Icon, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-700 transition-all duration-200 group ${color}`}
            >
              <Icon size={24} className="text-slate-400 group-hover:text-current transition-colors" />
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
