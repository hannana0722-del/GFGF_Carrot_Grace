import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronUp, Upload, Star } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatDate, formatDateTime } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { Assignment, Submission, SubmissionStatus } from '../types'

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 1,
    title: '1주차: 현지 문화 탐방 보고서',
    description: '파견 국가의 문화적 특성과 업무 환경에 대해 분석하는 보고서를 작성하세요. A4 3-5페이지 분량.',
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    cohort: '3기',
    targetCountries: ['미국(NY)', '미국(LA)', '호주', '중국', '베트남'],
    status: '진행중',
    totalParticipants: 50,
    submittedCount: 42,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdBy: '이매니저',
  },
  {
    id: 2,
    title: '2주차: 현지 기관 인터뷰 정리',
    description: '현지 관련 기관 담당자 인터뷰를 진행하고 주요 내용을 정리하여 제출하세요.',
    dueDate: new Date(Date.now() + 9 * 86400000).toISOString(),
    cohort: '3기',
    targetCountries: ['미국(NY)', '미국(LA)', '호주', '중국', '베트남'],
    status: '진행중',
    totalParticipants: 50,
    submittedCount: 5,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: '이매니저',
  },
  {
    id: 3,
    title: '오리엔테이션 소감문',
    description: '첫 주 오리엔테이션을 마치고 느낀 점, 목표, 각오를 작성하세요.',
    dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    cohort: '3기',
    targetCountries: ['미국(NY)', '미국(LA)', '호주', '중국', '베트남'],
    status: '마감됨',
    totalParticipants: 50,
    submittedCount: 48,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    createdBy: '김관리자',
  },
]

const MOCK_SUBMISSIONS: Submission[] = [
  { id: 1, assignmentId: 1, userId: 3, userName: '김민준', country: '미국(NY)', submittedAt: new Date(Date.now() - 86400000).toISOString(), status: '제출완료', score: 90, feedback: '잘 작성하였습니다.' },
  { id: 2, assignmentId: 1, userId: 4, userName: '이서연', country: '호주', submittedAt: null, status: '미제출' },
  { id: 3, assignmentId: 1, userId: 5, userName: '박지훈', country: '중국', submittedAt: new Date(Date.now() - 7 * 86400000).toISOString(), status: '지각제출', score: 75 },
  { id: 4, assignmentId: 1, userId: 6, userName: '최예은', country: '베트남', submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: '제출완료', score: 88 },
  { id: 5, assignmentId: 1, userId: 7, userName: '정수현', country: '미국(LA)', submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(), status: '제출완료' },
]

const submissionStatusVariant: Record<SubmissionStatus, 'success' | 'danger' | 'warning'> = {
  '제출완료': 'success',
  '미제출': 'danger',
  '지각제출': 'warning',
}

async function fetchAssignments(): Promise<Assignment[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/assignments', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_ASSIGNMENTS
}

async function fetchSubmissions(assignmentId: number): Promise<Submission[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch(`http://localhost:8000/api/assignments/${assignmentId}/submissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_SUBMISSIONS.filter((s) => s.assignmentId === assignmentId)
}

type FilterType = '전체' | '제출완료' | '미제출' | '지각제출'

export default function Assignments() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterType>('전체')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [submissionFilter, setSubmissionFilter] = useState<FilterType>('전체')
  const [feedbackMap, setFeedbackMap] = useState<Record<number, string>>({})
  const [scoreMap, setScoreMap] = useState<Record<number, number>>({})

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    targetCountries: [] as string[],
  })

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
  })

  const { data: submissions = [] } = useQuery({
    queryKey: ['submissions', expandedId],
    queryFn: () => fetchSubmissions(expandedId!),
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success('과제가 생성되었습니다.')
      setIsCreateOpen(false)
      setForm({ title: '', description: '', dueDate: '', targetCountries: [] })
    },
  })

  const filtered = assignments.filter((a) => {
    if (filterStatus === '전체') return true
    const rate = a.submittedCount / a.totalParticipants
    if (filterStatus === '제출완료') return rate === 1
    if (filterStatus === '미제출') return rate < 0.5
    return true
  })

  const filteredSubmissions = submissions.filter(
    (s) => submissionFilter === '전체' || s.status === submissionFilter
  )

  if (isLoading) return <PageLoader />

  const getDaysLeft = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now()
    const days = Math.ceil(diff / 86400000)
    if (days < 0) return { text: `${Math.abs(days)}일 초과`, color: 'text-red-400' }
    if (days === 0) return { text: '오늘 마감', color: 'text-red-400' }
    if (days <= 3) return { text: `${days}일 남음`, color: 'text-yellow-400' }
    return { text: `${days}일 남음`, color: 'text-slate-400' }
  }

  const countries = ['미국(NY)', '미국(LA)', '호주', '중국', '베트남']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          {(['전체', '제출완료', '미제출', '지각제출'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filterStatus === f
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateOpen(true)} icon={<Plus size={16} />}>
            과제 생성
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-slate-100">{assignments.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 과제</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{assignments.filter((a) => a.status === '진행중').length}</p>
          <p className="text-xs text-slate-400 mt-1">진행 중</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">{assignments.filter((a) => a.status === '마감됨').length}</p>
          <p className="text-xs text-slate-400 mt-1">마감됨</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">
            {assignments.reduce((acc, a) => acc + a.submittedCount, 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">총 제출 수</p>
        </Card>
      </div>

      {/* Assignment list */}
      <div className="space-y-3">
        {filtered.map((assignment) => {
          const isExpanded = expandedId === assignment.id
          const progress = Math.round((assignment.submittedCount / assignment.totalParticipants) * 100)
          const daysLeft = getDaysLeft(assignment.dueDate)

          return (
            <Card key={assignment.id}>
              {/* Header */}
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-100">{assignment.title}</h3>
                    <Badge variant={assignment.status === '진행중' ? 'info' : 'neutral'}>
                      {assignment.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-1">{assignment.description}</p>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <span className="text-xs text-slate-500">
                      마감: {formatDate(assignment.dueDate, 'MM월 dd일')}
                      <span className={`ml-1 font-medium ${daysLeft.color}`}>({daysLeft.text})</span>
                    </span>
                    <span className="text-xs text-slate-500">작성: {assignment.createdBy}</span>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress === 100 ? 'bg-green-400' :
                            progress >= 70 ? 'bg-cyan-400' :
                            progress >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">
                        {assignment.submittedCount}/{assignment.totalParticipants} ({progress}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-3 flex-shrink-0 text-slate-400">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Expanded: submissions */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-300">제출 현황</p>
                    <div className="flex gap-1">
                      {(['전체', '제출완료', '미제출', '지각제출'] as FilterType[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setSubmissionFilter(f)}
                          className={`px-2 py-1 rounded text-xs transition-all ${
                            submissionFilter === f
                              ? 'bg-slate-600 text-slate-100'
                              : 'text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                      <p className="text-sm font-medium text-slate-300 mb-3">과제 제출</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">파일 업로드</label>
                          <input type="file" className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:bg-slate-700 file:text-slate-300 file:border-0 file:text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">링크 (선택)</label>
                          <input type="url" placeholder="https://" className="input-field text-sm" />
                        </div>
                        <Button size="sm" icon={<Upload size={14} />}>제출하기</Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {filteredSubmissions.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-200">{sub.userName}</span>
                            <span className="text-xs text-slate-500">{sub.country}</span>
                            <Badge variant={submissionStatusVariant[sub.status]}>{sub.status}</Badge>
                          </div>
                          {sub.submittedAt && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              제출: {formatDateTime(sub.submittedAt)}
                            </p>
                          )}
                          {sub.feedback && (
                            <p className="text-xs text-cyan-400 mt-1">피드백: {sub.feedback}</p>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            {sub.score !== undefined && (
                              <div className="flex items-center gap-1">
                                <Star size={12} className="text-yellow-400" />
                                <span className="text-sm text-yellow-400 font-medium">{sub.score}</span>
                              </div>
                            )}
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="점수"
                              value={scoreMap[sub.id] ?? ''}
                              onChange={(e) => setScoreMap({ ...scoreMap, [sub.id]: Number(e.target.value) })}
                              className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
                            />
                            <input
                              type="text"
                              placeholder="피드백"
                              value={feedbackMap[sub.id] ?? ''}
                              onChange={(e) => setFeedbackMap({ ...feedbackMap, [sub.id]: e.target.value })}
                              className="w-32 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                toast.success(`${sub.userName} 피드백이 저장되었습니다.`)
                              }}
                            >
                              저장
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Create modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="과제 생성"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>취소</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              loading={createMutation.isPending}
              disabled={!form.title || !form.dueDate}
            >
              생성
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">과제 제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="과제 제목을 입력하세요"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">과제 설명</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="과제에 대한 자세한 설명을 입력하세요"
              rows={4}
              className="textarea-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">마감일 *</label>
            <input
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">대상 국가</label>
            <div className="flex flex-wrap gap-2">
              {countries.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    const next = form.targetCountries.includes(c)
                      ? form.targetCountries.filter((x) => x !== c)
                      : [...form.targetCountries, c]
                    setForm({ ...form, targetCountries: next })
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    form.targetCountries.includes(c)
                      ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
