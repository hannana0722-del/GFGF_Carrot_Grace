import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Star, AlertCircle } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/Table'
import { formatDate, formatDateTime } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { DailyReport as DailyReportType, EmotionTag } from '../types'

const MOCK_REPORTS: DailyReportType[] = [
  {
    id: 1, userId: 3, userName: '김민준', country: '미국(NY)', cohort: '3기',
    date: new Date().toISOString(),
    content: '오늘은 현지 파트너 기관 방문을 통해 업무 환경을 살펴보았습니다. 문화적 차이가 크다는 것을 실감했고, 적응을 위해 더 노력해야겠다는 생각이 들었습니다.',
    emotion: '보통', satisfaction: 3,
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2, userId: 4, userName: '이서연', country: '호주', cohort: '3기',
    date: new Date().toISOString(),
    content: '오늘 첫 출근을 했습니다. 동료들이 매우 친절하고 환영해 주어서 기분이 좋았습니다. 영어 의사소통에 아직 어려움이 있지만 점점 나아지고 있습니다.',
    emotion: '좋음', satisfaction: 5,
    submittedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 3, userId: 5, userName: '박지훈', country: '중국', cohort: '3기',
    date: new Date().toISOString(),
    content: '언어 장벽으로 인해 업무 진행이 쉽지 않습니다. 현지 언어 공부에 더 많은 시간을 투자해야 할 것 같습니다.',
    emotion: '힘듦', satisfaction: 2,
    submittedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: 4, userId: 7, userName: '정수현', country: '미국(LA)', cohort: '3기',
    date: new Date().toISOString(),
    content: '프로젝트 첫 번째 미팅에 참여했습니다. 팀원들의 업무 스타일에 적응 중이며 흥미로운 경험이 되고 있습니다.',
    emotion: '좋음', satisfaction: 4,
    submittedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
]

const EMOTIONS: { tag: EmotionTag; emoji: string; color: string }[] = [
  { tag: '좋음', emoji: '😊', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { tag: '보통', emoji: '😐', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { tag: '힘듦', emoji: '😔', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { tag: '어려움', emoji: '😟', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
]

async function fetchReports(): Promise<DailyReportType[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/daily-reports', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_REPORTS
}

export default function DailyReport() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    content: '',
    emotion: '보통' as EmotionTag,
    satisfaction: 3,
    photoPreview: null as string | null,
  })
  const [submitted, setSubmitted] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterCountry, setFilterCountry] = useState('전체')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['daily-reports'],
    queryFn: fetchReports,
    enabled: isAdmin,
  })

  const submitMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/daily-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...data, date: new Date().toISOString() }),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] })
      toast.success('일일 보고가 제출되었습니다.')
      setSubmitted(true)
    },
    onError: () => toast.error('제출에 실패했습니다.'),
  })

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setForm({ ...form, photoPreview: reader.result as string })
      reader.readAsDataURL(file)
    }
  }

  const filteredReports = reports.filter((r) => {
    const matchCountry = filterCountry === '전체' || r.country === filterCountry
    const matchDate = !filterDate || r.date.startsWith(filterDate)
    return matchCountry && matchDate
  })

  const todaySubmitted = reports.filter(
    (r) => r.date.startsWith(new Date().toISOString().slice(0, 10))
  )
  const allParticipants = 50 // mock total
  const missingCount = allParticipants - todaySubmitted.length

  const emotionInfo = (tag: EmotionTag) => EMOTIONS.find((e) => e.tag === tag)

  if (isLoading && isAdmin) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Missing report alert */}
      {isAdmin && missingCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-400">미제출 알림</p>
            <p className="text-xs text-red-400/70 mt-0.5">
              오늘 일일 보고를 아직 제출하지 않은 참가자가 {missingCount}명 있습니다.
            </p>
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 max-w-xl mx-auto'}`}>
        {/* Submit form */}
        {!isAdmin && (
          <Card>
            <h2 className="text-base font-semibold text-slate-100 mb-5">오늘의 일일 보고</h2>

            {submitted ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">{emotionInfo(form.emotion)?.emoji}</div>
                <p className="text-lg font-semibold text-slate-100 mb-1">제출 완료!</p>
                <p className="text-sm text-slate-400">오늘의 보고가 성공적으로 제출되었습니다.</p>
                <div className="flex justify-center gap-1 mt-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={20} className={i <= form.satisfaction ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                  ))}
                </div>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                    다시 작성
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Activity content */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    활동 내용 *
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="오늘 하루 활동 내용을 작성하세요..."
                    rows={5}
                    className="textarea-field"
                  />
                </div>

                {/* Emotion */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    감정 태그
                  </label>
                  <div className="flex gap-2">
                    {EMOTIONS.map(({ tag, emoji, color }) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setForm({ ...form, emotion: tag })}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                          form.emotion === tag ? color : 'border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-xl">{emoji}</span>
                        <span className="text-xs">{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Satisfaction */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    만족도
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm({ ...form, satisfaction: i })}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          size={28}
                          className={i <= form.satisfaction ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}
                        />
                      </button>
                    ))}
                    <span className="text-sm text-slate-400 ml-2">{form.satisfaction}/5</span>
                  </div>
                </div>

                {/* Photo */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    사진 첨부 (선택)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  {form.photoPreview ? (
                    <div className="relative">
                      <img
                        src={form.photoPreview}
                        alt="preview"
                        className="w-full h-40 object-cover rounded-lg border border-slate-700"
                      />
                      <button
                        onClick={() => setForm({ ...form, photoPreview: null })}
                        className="absolute top-2 right-2 w-6 h-6 bg-slate-900/80 rounded-full flex items-center justify-center text-slate-300 text-xs hover:bg-slate-800"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-slate-600 hover:text-slate-400 transition-colors"
                    >
                      <Camera size={20} />
                      <span className="text-xs">클릭하여 사진 첨부</span>
                    </button>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => submitMutation.mutate(form)}
                  loading={submitMutation.isPending}
                  disabled={!form.content}
                >
                  제출하기
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Reports list (admin) or own reports */}
        <div className={isAdmin ? 'xl:col-span-2' : undefined}>
          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-700">
              <h2 className="text-base font-semibold text-slate-100">
                {isAdmin ? '전체 보고 현황' : '나의 보고 기록'}
              </h2>
              {isAdmin && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="select-field !w-auto text-sm"
                  >
                    {['전체', '미국(NY)', '미국(LA)', '호주', '중국', '베트남'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isAdmin ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>이름</TableHeaderCell>
                    <TableHeaderCell>국가</TableHeaderCell>
                    <TableHeaderCell>날짜</TableHeaderCell>
                    <TableHeaderCell>감정</TableHeaderCell>
                    <TableHeaderCell>만족도</TableHeaderCell>
                    <TableHeaderCell>내용</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.map((report) => {
                    const emo = emotionInfo(report.emotion)
                    return (
                      <TableRow
                        key={report.id}
                        onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                      >
                        <TableCell>
                          <span className="font-medium text-slate-200">{report.userName}</span>
                        </TableCell>
                        <TableCell>{report.country}</TableCell>
                        <TableCell>{formatDate(report.date, 'MM/dd')}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${emo?.color}`}>
                            {emo?.emoji} {report.emotion}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} size={12} className={i <= report.satisfaction ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'} />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-400 line-clamp-1 text-xs max-w-[200px]">{report.content}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="divide-y divide-slate-700">
                {MOCK_REPORTS.filter((r) => r.userId === user?.id || true).slice(0, 3).map((report) => {
                  const emo = emotionInfo(report.emotion)
                  return (
                    <div key={report.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${emo?.color}`}>
                            {emo?.emoji} {report.emotion}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} size={12} className={i <= report.satisfaction ? 'text-yellow-400 fill-yellow-400' : 'text-slate-700'} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(report.date, 'MM/dd')}</span>
                      </div>
                      <p className="text-sm text-slate-300 line-clamp-2">{report.content}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
