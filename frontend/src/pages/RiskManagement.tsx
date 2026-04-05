import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronUp, MessageSquare, Filter } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import {
  getRiskStatusClass, getRiskPriorityClass, formatDateTime, cn,
} from '../lib/utils'
import toast from 'react-hot-toast'
import type { Risk, RiskStatus, RiskPriority, RiskType } from '../types'

const MOCK_RISKS: Risk[] = [
  {
    id: 1, userId: 3, userName: '김민준', country: '미국(NY)', cohort: '3기',
    issueType: '심리', description: '지속적인 스트레스 호소 및 수면 장애 증상. 건강 체크 3일 연속 적신호.',
    priority: '높음', status: '위험', assignedTo: '이매니저',
    lastUpdated: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    actions: [
      { id: 1, riskId: 1, note: '전화 상담 진행. 현지 심리 상담 기관 연결 예정.', actionBy: '이매니저', actionAt: new Date(Date.now() - 2 * 3600000).toISOString() },
      { id: 2, riskId: 1, note: '가족과 연락 취함. 현재 안정 중.', actionBy: '김관리자', actionAt: new Date(Date.now() - 5 * 3600000).toISOString() },
    ],
  },
  {
    id: 2, userId: 4, userName: '이서연', country: '호주', cohort: '3기',
    issueType: '건강', description: '신체 컨디션 저하 및 수면 부족 지속. 병원 방문 필요.',
    priority: '높음', status: '위험', assignedTo: '이매니저',
    lastUpdated: new Date(Date.now() - 2 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    actions: [
      { id: 3, riskId: 2, note: '현지 병원 예약 완료. 내일 방문 예정.', actionBy: '이매니저', actionAt: new Date(Date.now() - 3600000).toISOString() },
    ],
  },
  {
    id: 3, userId: 8, userName: '한소희', country: '미국(NY)', cohort: '3기',
    issueType: '학업', description: '과제 미제출 2회, 지각 제출 1회. 참여 의지 저하 관찰.',
    priority: '중간', status: '주의', assignedTo: '이매니저',
    lastUpdated: new Date(Date.now() - 5 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    actions: [
      { id: 4, riskId: 3, note: '개별 면담 실시. 학업 지원 방안 논의.', actionBy: '이매니저', actionAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    ],
  },
  {
    id: 4, userId: 10, userName: '강나연', country: '중국', cohort: '3기',
    issueType: '생활', description: '기숙사 생활 불편 호소. 룸메이트와 갈등.',
    priority: '중간', status: '주의', assignedTo: '이매니저',
    lastUpdated: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    actions: [],
  },
  {
    id: 5, userId: 5, userName: '박지훈', country: '중국', cohort: '3기',
    issueType: '학업', description: '언어 장벽으로 인한 업무 어려움. 현지어 학습 지원 필요.',
    priority: '낮음', status: '안전',
    lastUpdated: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    actions: [
      { id: 5, riskId: 5, note: '언어 수업 연결 완료. 진행 모니터링 중.', actionBy: '김관리자', actionAt: new Date(Date.now() - 86400000).toISOString() },
    ],
  },
]

async function fetchRisks(): Promise<Risk[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/risks', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_RISKS
}

const RISK_STATUSES: RiskStatus[] = ['위험', '주의', '안전', '해결됨']
const RISK_PRIORITIES: RiskPriority[] = ['높음', '중간', '낮음']
const RISK_TYPES: RiskType[] = ['건강', '심리', '학업', '생활', '기타']

const rowBgColors: Record<RiskStatus, string> = {
  '위험': 'bg-red-500/5 hover:bg-red-500/10',
  '주의': 'bg-yellow-500/5 hover:bg-yellow-500/10',
  '안전': 'bg-green-500/5 hover:bg-green-500/10',
  '해결됨': 'hover:bg-slate-700/20',
}

export default function RiskManagement() {
  const queryClient = useQueryClient()

  const [filterStatus, setFilterStatus] = useState<RiskStatus | '전체'>('전체')
  const [filterPriority, setFilterPriority] = useState<RiskPriority | '전체'>('전체')
  const [filterType, setFilterType] = useState<RiskType | '전체'>('전체')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false)
  const [isAddActionOpen, setIsAddActionOpen] = useState(false)
  const [selectedRiskId, setSelectedRiskId] = useState<number | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [statusChanges, setStatusChanges] = useState<Record<number, RiskStatus>>({})

  const [newRiskForm, setNewRiskForm] = useState({
    userName: '',
    country: '',
    issueType: '기타' as RiskType,
    description: '',
    priority: '중간' as RiskPriority,
    status: '주의' as RiskStatus,
  })

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risks'],
    queryFn: fetchRisks,
  })

  const addRiskMutation = useMutation({
    mutationFn: async (data: typeof newRiskForm) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/risks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      toast.success('리스크가 등록되었습니다.')
      setIsAddRiskOpen(false)
    },
  })

  const addActionMutation = useMutation({
    mutationFn: async ({ riskId, note }: { riskId: number; note: string }) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch(`http://localhost:8000/api/risks/${riskId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ note }),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      toast.success('조치 내용이 등록되었습니다.')
      setIsAddActionOpen(false)
      setActionNote('')
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ riskId, status }: { riskId: number; status: RiskStatus }) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch(`http://localhost:8000/api/risks/${riskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status }),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      toast.success('상태가 변경되었습니다.')
    },
  })

  const filtered = risks.filter((r) => {
    const matchStatus = filterStatus === '전체' || r.status === filterStatus
    const matchPriority = filterPriority === '전체' || r.priority === filterPriority
    const matchType = filterType === '전체' || r.issueType === filterType
    return matchStatus && matchPriority && matchType
  })

  const stats = {
    danger: risks.filter((r) => r.status === '위험').length,
    warning: risks.filter((r) => r.status === '주의').length,
    safe: risks.filter((r) => r.status === '안전').length,
    resolved: risks.filter((r) => r.status === '해결됨').length,
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4 text-center border-l-4 border-l-red-500">
          <p className="text-3xl font-bold text-red-400">{stats.danger}</p>
          <p className="text-xs text-slate-400 mt-1">위험 🔴</p>
        </Card>
        <Card className="!p-4 text-center border-l-4 border-l-yellow-500">
          <p className="text-3xl font-bold text-yellow-400">{stats.warning}</p>
          <p className="text-xs text-slate-400 mt-1">주의 🟡</p>
        </Card>
        <Card className="!p-4 text-center border-l-4 border-l-green-500">
          <p className="text-3xl font-bold text-green-400">{stats.safe}</p>
          <p className="text-xs text-slate-400 mt-1">안전 🟢</p>
        </Card>
        <Card className="!p-4 text-center border-l-4 border-l-slate-500">
          <p className="text-3xl font-bold text-slate-400">{stats.resolved}</p>
          <p className="text-xs text-slate-400 mt-1">해결됨</p>
        </Card>
      </div>

      {/* Filters + Add button */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <Filter size={14} className="text-slate-400" />
          <div className="flex gap-1">
            {(['전체', ...RISK_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex gap-1">
            {(['전체', ...RISK_PRIORITIES] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterPriority === p ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex gap-1">
            {(['전체', ...RISK_TYPES] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterType === t ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => setIsAddRiskOpen(true)} icon={<Plus size={16} />}>
          리스크 등록
        </Button>
      </div>

      {/* Risk list */}
      <div className="space-y-2">
        {filtered.map((risk) => {
          const isExpanded = expandedId === risk.id
          const currentStatus = statusChanges[risk.id] ?? risk.status

          return (
            <Card key={risk.id} className={cn('!p-0 overflow-hidden', rowBgColors[currentStatus])}>
              {/* Main row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : risk.id)}
              >
                {/* Status indicator */}
                <div className={`w-1.5 h-12 rounded-full flex-shrink-0 ${
                  currentStatus === '위험' ? 'bg-red-500' :
                  currentStatus === '주의' ? 'bg-yellow-500' :
                  currentStatus === '안전' ? 'bg-green-500' : 'bg-slate-500'
                }`} />

                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div>
                    <p className="font-semibold text-slate-100">{risk.userName}</p>
                    <p className="text-xs text-slate-400">{risk.country}</p>
                  </div>
                  <div>
                    <Badge variant="neutral">{risk.issueType}</Badge>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRiskPriorityClass(risk.priority)}`}>
                      {risk.priority}
                    </span>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <select
                      value={currentStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as RiskStatus
                        setStatusChanges({ ...statusChanges, [risk.id]: newStatus })
                        updateStatusMutation.mutate({ riskId: risk.id, status: newStatus })
                      }}
                      className={`text-xs px-2 py-1 rounded-lg border bg-transparent cursor-pointer ${getRiskStatusClass(currentStatus)}`}
                    >
                      {RISK_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-slate-800 text-slate-300">{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(risk.lastUpdated)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedRiskId(risk.id)
                      setIsAddActionOpen(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
                  >
                    <MessageSquare size={12} />
                    조치 추가
                  </button>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Expanded: details + action history */}
              {isExpanded && (
                <div className="border-t border-slate-700/50 p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">이슈 설명</p>
                    <p className="text-sm text-slate-300 bg-slate-900/40 p-3 rounded-lg">{risk.description}</p>
                  </div>

                  {risk.assignedTo && (
                    <p className="text-xs text-slate-400">담당: <span className="text-slate-300">{risk.assignedTo}</span></p>
                  )}

                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">조치 이력 ({risk.actions.length})</p>
                    {risk.actions.length === 0 ? (
                      <p className="text-xs text-slate-500">등록된 조치 이력이 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {risk.actions.map((action) => (
                          <div key={action.id} className="flex gap-3 p-3 bg-slate-900/40 rounded-lg">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-slate-300">{action.note}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {action.actionBy} · {formatDateTime(action.actionAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Add risk modal */}
      <Modal
        isOpen={isAddRiskOpen}
        onClose={() => setIsAddRiskOpen(false)}
        title="리스크 등록"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddRiskOpen(false)}>취소</Button>
            <Button
              onClick={() => addRiskMutation.mutate(newRiskForm)}
              loading={addRiskMutation.isPending}
              disabled={!newRiskForm.userName || !newRiskForm.description}
            >
              등록
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">참가자 이름</label>
              <input
                type="text"
                value={newRiskForm.userName}
                onChange={(e) => setNewRiskForm({ ...newRiskForm, userName: e.target.value })}
                className="input-field"
                placeholder="이름"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">국가</label>
              <select
                value={newRiskForm.country}
                onChange={(e) => setNewRiskForm({ ...newRiskForm, country: e.target.value })}
                className="select-field"
              >
                <option value="">선택</option>
                {['미국(NY)', '미국(LA)', '호주', '중국', '베트남'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">이슈 유형</label>
              <select
                value={newRiskForm.issueType}
                onChange={(e) => setNewRiskForm({ ...newRiskForm, issueType: e.target.value as RiskType })}
                className="select-field"
              >
                {RISK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">우선순위</label>
              <select
                value={newRiskForm.priority}
                onChange={(e) => setNewRiskForm({ ...newRiskForm, priority: e.target.value as RiskPriority })}
                className="select-field"
              >
                {RISK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">초기 상태</label>
              <select
                value={newRiskForm.status}
                onChange={(e) => setNewRiskForm({ ...newRiskForm, status: e.target.value as RiskStatus })}
                className="select-field"
              >
                {RISK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">이슈 설명</label>
            <textarea
              value={newRiskForm.description}
              onChange={(e) => setNewRiskForm({ ...newRiskForm, description: e.target.value })}
              placeholder="이슈에 대한 자세한 내용을 입력하세요"
              rows={4}
              className="textarea-field"
            />
          </div>
        </div>
      </Modal>

      {/* Add action modal */}
      <Modal
        isOpen={isAddActionOpen}
        onClose={() => { setIsAddActionOpen(false); setActionNote('') }}
        title="조치 내용 추가"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setIsAddActionOpen(false); setActionNote('') }}>취소</Button>
            <Button
              onClick={() => {
                if (selectedRiskId) {
                  addActionMutation.mutate({ riskId: selectedRiskId, note: actionNote })
                }
              }}
              loading={addActionMutation.isPending}
              disabled={!actionNote}
            >
              저장
            </Button>
          </>
        }
      >
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">조치 내용</label>
          <textarea
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="취한 조치 또는 진행 상황을 입력하세요"
            rows={4}
            className="textarea-field"
          />
        </div>
      </Modal>
    </div>
  )
}
