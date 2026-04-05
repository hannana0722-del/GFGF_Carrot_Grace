import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { QrCode, Plus, Edit2, Check } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '../components/ui/Table'
import { getAttendanceStatusClass, formatDate, formatTime } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { AttendanceRecord, AttendanceStatus } from '../types'

const MOCK_RECORDS: AttendanceRecord[] = [
  { id: 1, userId: 3, userName: '김민준', country: '미국(NY)', date: new Date().toISOString(), checkIn: new Date(Date.now() - 7 * 3600000).toISOString(), checkOut: null, status: '출석', cohort: '3기' },
  { id: 2, userId: 4, userName: '이서연', country: '호주', date: new Date().toISOString(), checkIn: null, checkOut: null, status: '결석', reason: '건강 문제', cohort: '3기' },
  { id: 3, userId: 5, userName: '박지훈', country: '중국', date: new Date().toISOString(), checkIn: new Date(Date.now() - 6 * 3600000).toISOString(), checkOut: null, status: '지각', cohort: '3기' },
  { id: 4, userId: 6, userName: '최예은', country: '베트남', date: new Date().toISOString(), checkIn: new Date(Date.now() - 7 * 3600000).toISOString(), checkOut: new Date(Date.now() - 3 * 3600000).toISOString(), status: '조퇴', reason: '병원 방문', cohort: '3기' },
  { id: 5, userId: 7, userName: '정수현', country: '미국(LA)', date: new Date().toISOString(), checkIn: new Date(Date.now() - 7 * 3600000).toISOString(), checkOut: null, status: '출석', cohort: '3기' },
  { id: 6, userId: 8, userName: '한소희', country: '미국(NY)', date: new Date().toISOString(), checkIn: new Date(Date.now() - 7 * 3600000).toISOString(), checkOut: null, status: '출석', cohort: '3기' },
  { id: 7, userId: 9, userName: '오민석', country: '호주', date: new Date().toISOString(), checkIn: new Date(Date.now() - 7 * 3600000).toISOString(), checkOut: null, status: '출석', cohort: '3기' },
  { id: 8, userId: 10, userName: '강나연', country: '중국', date: new Date().toISOString(), checkIn: null, checkOut: null, status: '결석', cohort: '3기' },
]

const CHART_DATA = [
  { name: '김민준', rate: 95 },
  { name: '이서연', rate: 70 },
  { name: '박지훈', rate: 80 },
  { name: '최예은', rate: 88 },
  { name: '정수현', rate: 100 },
  { name: '한소희', rate: 92 },
]

async function fetchAttendance(): Promise<AttendanceRecord[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/attendance', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_RECORDS
}

const STATUS_OPTIONS: AttendanceStatus[] = ['출석', '지각', '결석', '조퇴']

export default function Attendance() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | '전체'>('전체')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isQROpen, setIsQROpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)

  const [addForm, setAddForm] = useState({
    userName: '',
    country: '',
    status: '출석' as AttendanceStatus,
    checkIn: '',
    checkOut: '',
    reason: '',
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: fetchAttendance,
  })

  const addMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.success('출결이 등록되었습니다.')
      setIsAddOpen(false)
    },
  })

  const editMutation = useMutation({
    mutationFn: async (data: Partial<AttendanceRecord>) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch(`http://localhost:8000/api/attendance/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
      toast.success('출결이 수정되었습니다.')
      setIsEditOpen(false)
      setSelectedRecord(null)
    },
  })

  const filtered = records.filter(
    (r) => filterStatus === '전체' || r.status === filterStatus
  )

  const summary = {
    total: records.length,
    present: records.filter((r) => r.status === '출석').length,
    late: records.filter((r) => r.status === '지각').length,
    absent: records.filter((r) => r.status === '결석').length,
    earlyLeave: records.filter((r) => r.status === '조퇴').length,
  }
  const attendanceRate = summary.total > 0
    ? Math.round(((summary.present + summary.late) / summary.total) * 100)
    : 0

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="!p-4 text-center border-l-4 border-l-cyan-500">
          <p className="text-2xl font-bold text-cyan-400">{attendanceRate}%</p>
          <p className="text-xs text-slate-400 mt-1">출석률</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{summary.present}</p>
          <p className="text-xs text-slate-400 mt-1">출석</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{summary.late}</p>
          <p className="text-xs text-slate-400 mt-1">지각</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{summary.absent}</p>
          <p className="text-xs text-slate-400 mt-1">결석</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{summary.earlyLeave}</p>
          <p className="text-xs text-slate-400 mt-1">조퇴</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Table */}
        <div className="xl:col-span-2">
          <Card padding="none">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-100">오늘 출결 현황</h2>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(new Date().toISOString())}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {(['전체', ...STATUS_OPTIONS] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        filterStatus === s
                          ? 'bg-slate-600 text-slate-100'
                          : 'text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={<QrCode size={14} />} onClick={() => setIsQROpen(true)}>
                      QR
                    </Button>
                    <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsAddOpen(true)}>
                      추가
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>이름</TableHeaderCell>
                  <TableHeaderCell>국가</TableHeaderCell>
                  <TableHeaderCell>출석 시간</TableHeaderCell>
                  <TableHeaderCell>퇴실 시간</TableHeaderCell>
                  <TableHeaderCell>상태</TableHeaderCell>
                  <TableHeaderCell>사유</TableHeaderCell>
                  {isAdmin && <TableHeaderCell>수정</TableHeaderCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="font-medium text-slate-200">{record.userName}</span>
                    </TableCell>
                    <TableCell>{record.country}</TableCell>
                    <TableCell>{record.checkIn ? formatTime(record.checkIn) : '-'}</TableCell>
                    <TableCell>{record.checkOut ? formatTime(record.checkOut) : '-'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAttendanceStatusClass(record.status)}`}>
                        {record.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-400">{record.reason ?? '-'}</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <button
                          onClick={() => {
                            setSelectedRecord(record)
                            setIsEditOpen(true)
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Attendance rate chart */}
        <div>
          <Card>
            <h2 className="text-base font-semibold text-slate-100 mb-4">참가자별 출석률</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={CHART_DATA} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v) => [`${v}%`, '출석률']}
                />
                <Bar
                  dataKey="rate"
                  fill="#06b6d4"
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v}%` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* Add modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="출결 수동 입력"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>취소</Button>
            <Button onClick={() => addMutation.mutate(addForm)} loading={addMutation.isPending}>
              저장
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">이름</label>
              <input
                type="text"
                value={addForm.userName}
                onChange={(e) => setAddForm({ ...addForm, userName: e.target.value })}
                className="input-field"
                placeholder="이름"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">국가</label>
              <select
                value={addForm.country}
                onChange={(e) => setAddForm({ ...addForm, country: e.target.value })}
                className="select-field"
              >
                <option value="">선택</option>
                {['미국(NY)', '미국(LA)', '호주', '중국', '베트남'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">출결 상태</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAddForm({ ...addForm, status: s })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                    addForm.status === s
                      ? getAttendanceStatusClass(s)
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">출석 시간</label>
              <input type="time" value={addForm.checkIn} onChange={(e) => setAddForm({ ...addForm, checkIn: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">퇴실 시간</label>
              <input type="time" value={addForm.checkOut} onChange={(e) => setAddForm({ ...addForm, checkOut: e.target.value })} className="input-field" />
            </div>
          </div>
          {(addForm.status === '결석' || addForm.status === '조퇴') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">사유</label>
              <input
                type="text"
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                className="input-field"
                placeholder="사유를 입력하세요"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Edit modal */}
      {selectedRecord && (
        <Modal
          isOpen={isEditOpen}
          onClose={() => { setIsEditOpen(false); setSelectedRecord(null) }}
          title={`${selectedRecord.userName} 출결 수정`}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setIsEditOpen(false); setSelectedRecord(null) }}>취소</Button>
              <Button
                onClick={() => editMutation.mutate(selectedRecord)}
                loading={editMutation.isPending}
              >
                저장
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">출결 상태</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedRecord({ ...selectedRecord, status: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                      selectedRecord.status === s
                        ? getAttendanceStatusClass(s)
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">사유</label>
              <input
                type="text"
                value={selectedRecord.reason ?? ''}
                onChange={(e) => setSelectedRecord({ ...selectedRecord, reason: e.target.value })}
                className="input-field"
                placeholder="사유를 입력하세요"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* QR modal */}
      <Modal
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
        title="QR 코드 출석 체크"
        footer={
          <Button variant="secondary" onClick={() => setIsQROpen(false)}>닫기</Button>
        }
      >
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-48 h-48 bg-white rounded-xl mb-4 relative">
            {/* Simulated QR code */}
            <div className="grid grid-cols-7 gap-0.5 p-3">
              {Array.from({ length: 49 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm ${
                    [0,1,2,3,4,5,6,7,13,14,21,27,28,29,30,31,32,33,34,41,42,43,44,45,46,47,48,8,15,22,36].includes(i)
                      ? 'bg-slate-900'
                      : 'bg-white'
                  }`}
                />
              ))}
            </div>
            <div className="absolute inset-3 border-2 border-slate-900 rounded pointer-events-none opacity-20" />
          </div>
          <p className="text-sm font-medium text-slate-300 mb-1">QR 코드를 스캔하여 출석 체크</p>
          <p className="text-xs text-slate-500 mb-4">코드는 5분 후 만료됩니다</p>
          <div className="flex items-center justify-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check size={16} className="text-green-400" />
            <p className="text-sm text-green-400">오늘 출석 체크: {summary.present + summary.late}명</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
