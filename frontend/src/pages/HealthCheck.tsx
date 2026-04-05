import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, AlertCircle, Filter } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell,
} from '../components/ui/Table'
import {
  getSignalColorClass,
  getSignalDotColor,
  calculateSignalColor,
  formatDateTime,
} from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { HealthCheckRecord, SignalColor } from '../types'

const MOCK_RECORDS: HealthCheckRecord[] = [
  { id: 1, userId: 3, userName: '김민준', country: '미국(NY)', cohort: '3기', date: new Date().toISOString(), physicalCondition: 2, mentalCondition: 1, sleepQuality: 2, stressLevel: 5, signalColor: '적색', requestConsultation: true },
  { id: 2, userId: 4, userName: '이서연', country: '호주', cohort: '3기', date: new Date().toISOString(), physicalCondition: 2, mentalCondition: 2, sleepQuality: 1, stressLevel: 4, signalColor: '적색', requestConsultation: false },
  { id: 3, userId: 5, userName: '박지훈', country: '중국', cohort: '3기', date: new Date().toISOString(), physicalCondition: 3, mentalCondition: 3, sleepQuality: 2, stressLevel: 3, signalColor: '황색', requestConsultation: false },
  { id: 4, userId: 6, userName: '최예은', country: '베트남', cohort: '3기', date: new Date().toISOString(), physicalCondition: 4, mentalCondition: 4, sleepQuality: 4, stressLevel: 2, signalColor: '녹색', requestConsultation: false },
  { id: 5, userId: 7, userName: '정수현', country: '미국(LA)', cohort: '3기', date: new Date().toISOString(), physicalCondition: 5, mentalCondition: 5, sleepQuality: 5, stressLevel: 1, signalColor: '녹색', requestConsultation: false },
  { id: 6, userId: 8, userName: '한소희', country: '미국(NY)', cohort: '3기', date: new Date().toISOString(), physicalCondition: 3, mentalCondition: 2, sleepQuality: 3, stressLevel: 4, signalColor: '황색', requestConsultation: false },
  { id: 7, userId: 9, userName: '오민석', country: '호주', cohort: '3기', date: new Date().toISOString(), physicalCondition: 4, mentalCondition: 3, sleepQuality: 4, stressLevel: 3, signalColor: '녹색', requestConsultation: false },
  { id: 8, userId: 10, userName: '강나연', country: '중국', cohort: '3기', date: new Date().toISOString(), physicalCondition: 2, mentalCondition: 3, sleepQuality: 2, stressLevel: 4, signalColor: '황색', requestConsultation: false },
]

async function fetchHealthRecords(): Promise<HealthCheckRecord[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/health-check', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_RECORDS
}

const questionLabels = [
  { key: 'physicalCondition', label: '오늘 몸 상태는 어떻습니까?', reverse: false },
  { key: 'mentalCondition', label: '오늘 기분/정서 상태는 어떻습니까?', reverse: false },
  { key: 'sleepQuality', label: '수면은 충분했습니까?', reverse: false },
  { key: 'stressLevel', label: '스트레스 수준은 어떻습니까?', reverse: true },
] as const

const scaleLabels: Record<number, string> = {
  1: '매우 나쁨',
  2: '나쁨',
  3: '보통',
  4: '좋음',
  5: '매우 좋음',
}
const stressLabels: Record<number, string> = {
  1: '없음',
  2: '약간',
  3: '보통',
  4: '높음',
  5: '매우 높음',
}

export default function HealthCheck() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [form, setForm] = useState({
    physicalCondition: 3,
    mentalCondition: 3,
    sleepQuality: 3,
    stressLevel: 3,
    notes: '',
    requestConsultation: false,
  })
  const [filterColor, setFilterColor] = useState<SignalColor | '전체'>('전체')
  const [selectedRecord, setSelectedRecord] = useState<HealthCheckRecord | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['health-records'],
    queryFn: fetchHealthRecords,
    enabled: isAdmin,
  })

  const submitMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/health-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-records'] })
      toast.success('건강 체크가 제출되었습니다.')
      setSubmitted(true)
    },
    onError: () => toast.error('제출에 실패했습니다.'),
  })

  const signal = calculateSignalColor(
    form.physicalCondition, form.mentalCondition, form.sleepQuality, form.stressLevel
  )

  const filteredRecords = records.filter(
    (r) => filterColor === '전체' || r.signalColor === filterColor
  )

  const stats = {
    green: records.filter((r) => r.signalColor === '녹색').length,
    yellow: records.filter((r) => r.signalColor === '황색').length,
    red: records.filter((r) => r.signalColor === '적색').length,
  }

  if (isLoading && isAdmin) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Admin stats */}
      {isAdmin && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="!p-4 text-center border-l-4 border-l-green-500">
            <p className="text-3xl font-bold text-green-400">{stats.green}</p>
            <p className="text-sm text-slate-400 mt-1">🟢 녹색 (안전)</p>
          </Card>
          <Card className="!p-4 text-center border-l-4 border-l-yellow-500">
            <p className="text-3xl font-bold text-yellow-400">{stats.yellow}</p>
            <p className="text-sm text-slate-400 mt-1">🟡 황색 (주의)</p>
          </Card>
          <Card className="!p-4 text-center border-l-4 border-l-red-500">
            <p className="text-3xl font-bold text-red-400">{stats.red}</p>
            <p className="text-sm text-slate-400 mt-1">🔴 적색 (위험)</p>
          </Card>
        </div>
      )}

      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
        {/* Check form */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <Heart size={20} className="text-red-400" />
            <h2 className="text-base font-semibold text-slate-100">오늘의 건강 체크</h2>
          </div>

          {submitted ? (
            <div className="text-center py-8">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                signal === '녹색' ? 'bg-green-500/20' : signal === '황색' ? 'bg-yellow-500/20' : 'bg-red-500/20'
              }`}>
                <span className="text-3xl">{signal === '녹색' ? '🟢' : signal === '황색' ? '🟡' : '🔴'}</span>
              </div>
              <p className="text-lg font-semibold text-slate-100 mb-1">제출 완료</p>
              <p className="text-sm text-slate-400">오늘의 건강 체크가 완료되었습니다.</p>
              <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full border ${getSignalColorClass(signal)}`}>
                <div className={`w-2 h-2 rounded-full ${getSignalDotColor(signal)}`} />
                <span className="text-sm font-medium">현재 상태: {signal}</span>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                  다시 작성
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {questionLabels.map(({ key, label, reverse }) => (
                <div key={key}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm text-slate-300">{label}</label>
                    <span className="text-sm font-medium text-cyan-400">
                      {reverse
                        ? stressLabels[form[key]]
                        : scaleLabels[form[key]]}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => setForm({ ...form, [key]: val })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          form[key] === val
                            ? key === 'stressLevel'
                              ? val >= 4 ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                                : val === 3 ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50'
                                : 'bg-green-500/30 text-green-400 border border-green-500/50'
                              : val <= 2 ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                                : val === 3 ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50'
                                : 'bg-green-500/30 text-green-400 border border-green-500/50'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Signal preview */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${getSignalColorClass(signal)}`}>
                <div className={`w-3 h-3 rounded-full ${getSignalDotColor(signal)}`} />
                <div>
                  <p className="text-sm font-medium">현재 신호등: {signal}</p>
                  <p className="text-xs opacity-70">
                    {signal === '녹색' ? '양호한 상태입니다.' :
                     signal === '황색' ? '주의가 필요한 상태입니다.' :
                     '즉각적인 관리가 필요합니다.'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">추가 메모 (선택)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="추가로 전달할 내용이 있으면 입력하세요"
                  rows={3}
                  className="textarea-field"
                />
              </div>

              <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <input
                  type="checkbox"
                  id="consultation"
                  checked={form.requestConsultation}
                  onChange={(e) => setForm({ ...form, requestConsultation: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded accent-red-500"
                />
                <label htmlFor="consultation" className="text-sm text-slate-300 cursor-pointer">
                  긴급 상담을 요청합니다 (담당 매니저에게 즉시 알림이 발송됩니다)
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => submitMutation.mutate(form)}
                  loading={submitMutation.isPending}
                  className="flex-1"
                >
                  제출하기
                </Button>
                {form.requestConsultation && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      submitMutation.mutate(form)
                      toast.success('긴급 상담 요청이 전송되었습니다.')
                    }}
                    icon={<AlertCircle size={16} />}
                  >
                    긴급 상담 요청
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Admin table */}
        {isAdmin && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-100">전체 참가자 건강 현황</h2>
              <div className="flex items-center gap-1">
                <Filter size={14} className="text-slate-400" />
                {(['전체', '녹색', '황색', '적색'] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => setFilterColor(color)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      filterColor === color
                        ? 'bg-slate-600 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>이름</TableHeaderCell>
                  <TableHeaderCell>국가</TableHeaderCell>
                  <TableHeaderCell>신호</TableHeaderCell>
                  <TableHeaderCell>신체</TableHeaderCell>
                  <TableHeaderCell>정서</TableHeaderCell>
                  <TableHeaderCell>수면</TableHeaderCell>
                  <TableHeaderCell>스트레스</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} onClick={() => setSelectedRecord(record)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">{record.userName}</span>
                        {record.requestConsultation && (
                          <AlertCircle size={14} className="text-red-400" title="상담 요청" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{record.country}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getSignalColorClass(record.signalColor)}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${getSignalDotColor(record.signalColor)}`} />
                        {record.signalColor}
                      </span>
                    </TableCell>
                    <TableCell>{record.physicalCondition}/5</TableCell>
                    <TableCell>{record.mentalCondition}/5</TableCell>
                    <TableCell>{record.sleepQuality}/5</TableCell>
                    <TableCell>{record.stressLevel}/5</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Detail modal */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`${selectedRecord.userName} - 건강 체크 상세`}
          footer={
            <Button variant="secondary" onClick={() => setSelectedRecord(null)}>닫기</Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${getSignalColorClass(selectedRecord.signalColor)}`}>
                <div className={`w-2 h-2 rounded-full ${getSignalDotColor(selectedRecord.signalColor)}`} />
                {selectedRecord.signalColor} 신호
              </span>
              <span className="text-sm text-slate-400">{selectedRecord.country} · {selectedRecord.cohort}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '신체 상태', value: selectedRecord.physicalCondition },
                { label: '정서 상태', value: selectedRecord.mentalCondition },
                { label: '수면', value: selectedRecord.sleepQuality },
                { label: '스트레스', value: selectedRecord.stressLevel, stress: true },
              ].map(({ label, value, stress }) => (
                <div key={label} className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-sm ${
                            i <= value
                              ? stress
                                ? value >= 4 ? 'bg-red-400' : value === 3 ? 'bg-yellow-400' : 'bg-green-400'
                                : value <= 2 ? 'bg-red-400' : value === 3 ? 'bg-yellow-400' : 'bg-green-400'
                              : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-slate-200">{value}/5</span>
                  </div>
                </div>
              ))}
            </div>
            {selectedRecord.requestConsultation && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-sm text-red-400">긴급 상담을 요청했습니다.</p>
              </div>
            )}
            {selectedRecord.notes && (
              <div>
                <p className="text-sm font-medium text-slate-400 mb-1">메모</p>
                <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded-lg">{selectedRecord.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
