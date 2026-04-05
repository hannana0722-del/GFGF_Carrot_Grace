import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Search, Filter, Eye, Users } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { formatDateTime } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { Announcement, AnnouncementTarget } from '../types'

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: '[중요] 3기 오리엔테이션 일정 안내',
    content: '안녕하세요. 경기 사다리 청년 재단입니다. 3기 오리엔테이션이 다음 주 월요일에 진행됩니다. 모든 참가자분들께서는 오전 9시까지 온라인 접속해 주시기 바랍니다.',
    targetType: '기수별',
    targetValue: '3기',
    sentAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: '김관리자',
    readCount: 48,
    totalRecipients: 50,
    isRead: true,
  },
  {
    id: 2,
    title: '1주차 과제 제출 마감 안내',
    content: '1주차 과제 제출 마감일은 이번 주 금요일 오후 6시입니다. 미제출 시 지각 처리되오니 반드시 기한 내에 제출하시기 바랍니다.',
    targetType: '전체',
    sentAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    createdBy: '이매니저',
    readCount: 35,
    totalRecipients: 50,
    isRead: false,
  },
  {
    id: 3,
    title: '[미국(NY)] 현지 긴급 연락처 업데이트',
    content: '미국 뉴욕 지역 긴급 연락처가 변경되었습니다. 업데이트된 연락처를 확인해 주시기 바랍니다.',
    targetType: '국가별',
    targetValue: '미국(NY)',
    sentAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: '김관리자',
    readCount: 12,
    totalRecipients: 12,
    isRead: true,
  },
  {
    id: 4,
    title: '건강 검진 일정 안내 (호주)',
    content: '호주 참가자를 대상으로 건강 검진이 예정되어 있습니다. 일정을 확인하시고 반드시 참석해 주시기 바랍니다.',
    targetType: '국가별',
    targetValue: '호주',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    createdBy: '이매니저',
    readCount: 0,
    totalRecipients: 10,
    isRead: false,
  },
  {
    id: 5,
    title: '월간 화상 미팅 안내 - 4월',
    content: '4월 월간 화상 미팅이 다음 주 수요일 오후 2시에 진행됩니다. 모든 참가자분들은 Zoom 링크를 통해 접속해 주세요.',
    targetType: '전체',
    sentAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdBy: '김관리자',
    readCount: 47,
    totalRecipients: 50,
    isRead: true,
  },
]

const targetTypeColors: Record<AnnouncementTarget, 'info' | 'success' | 'warning' | 'neutral'> = {
  '전체': 'info',
  '기수별': 'success',
  '팀별': 'warning',
  '국가별': 'neutral',
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  try {
    const token = localStorage.getItem('gsdf_token')
    const res = await fetch('http://localhost:8000/api/announcements', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
  } catch { /* fallthrough */ }
  return MOCK_ANNOUNCEMENTS
}

interface AnnouncementFormData {
  title: string
  content: string
  targetType: AnnouncementTarget
  targetValue: string
  scheduledAt: string
}

export default function Announcements() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null)
  const [filterTarget, setFilterTarget] = useState<AnnouncementTarget | '전체 보기'>('전체 보기')
  const [searchText, setSearchText] = useState('')
  const [form, setForm] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    targetType: '전체',
    targetValue: '',
    scheduledAt: '',
  })

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
  })

  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      const token = localStorage.getItem('gsdf_token')
      try {
        const res = await fetch('http://localhost:8000/api/announcements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        })
        if (res.ok) return res.json()
      } catch { /* fallthrough */ }
      // Mock
      const newAnn: Announcement = {
        id: Date.now(),
        ...data,
        sentAt: data.scheduledAt ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: user?.fullName ?? '관리자',
        readCount: 0,
        totalRecipients: 50,
      }
      return newAnn
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success('공지사항이 등록되었습니다.')
      setIsCreateOpen(false)
      setForm({ title: '', content: '', targetType: '전체', targetValue: '', scheduledAt: '' })
    },
    onError: () => toast.error('공지사항 등록에 실패했습니다.'),
  })

  const filtered = announcements.filter((a) => {
    const matchTarget = filterTarget === '전체 보기' || a.targetType === filterTarget
    const matchSearch = a.title.includes(searchText) || a.content.includes(searchText)
    return matchTarget && matchSearch
  })

  const canCreate = user?.role === 'admin' || user?.role === 'manager'

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="공지사항 검색..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-56"
            />
          </div>
          {/* Filter */}
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            {(['전체 보기', '전체', '기수별', '팀별', '국가별'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterTarget(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterTarget === type
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreateOpen(true)} icon={<Plus size={16} />}>
            공지사항 작성
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-slate-100">{announcements.length}</p>
          <p className="text-xs text-slate-400 mt-1">전체 공지</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {announcements.filter((a) => a.isRead).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">읽음</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">
            {announcements.filter((a) => !a.isRead).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">읽지 않음</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {announcements.filter((a) => a.scheduledAt && !a.sentAt).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">예약 발송</p>
        </Card>
      </div>

      {/* Announcement list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-slate-400">공지사항이 없습니다.</p>
          </Card>
        ) : (
          filtered.map((ann) => (
            <Card
              key={ann.id}
              className={`cursor-pointer hover:border-slate-600 transition-all ${!ann.isRead ? 'border-l-2 border-l-cyan-500' : ''}`}
              onClick={() => setSelectedAnn(ann)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Read indicator */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${ann.isRead ? 'bg-slate-600' : 'bg-cyan-400'}`}
                      title={ann.isRead ? '읽음' : '읽지 않음'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`font-medium truncate ${ann.isRead ? 'text-slate-300' : 'text-slate-100'}`}>
                        {ann.title}
                      </h3>
                      <Badge variant={targetTypeColors[ann.targetType]}>
                        {ann.targetType}{ann.targetValue ? ` - ${ann.targetValue}` : ''}
                      </Badge>
                      {ann.scheduledAt && !ann.sentAt && (
                        <Badge variant="warning">예약 발송</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">{ann.content}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{ann.createdBy}</span>
                      <span>·</span>
                      <span>{formatDateTime(ann.sentAt ?? ann.createdAt)}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {ann.readCount}/{ann.totalRecipients}명 읽음
                      </span>
                    </div>
                  </div>
                </div>
                {canCreate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toast.success('재발송 요청이 완료되었습니다.')
                    }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition-colors"
                  >
                    <Send size={12} />
                    재발송
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail modal */}
      {selectedAnn && (
        <Modal
          isOpen={!!selectedAnn}
          onClose={() => setSelectedAnn(null)}
          title={selectedAnn.title}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedAnn(null)}>
              닫기
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={targetTypeColors[selectedAnn.targetType]}>
                {selectedAnn.targetType}{selectedAnn.targetValue ? ` - ${selectedAnn.targetValue}` : ''}
              </Badge>
              {selectedAnn.scheduledAt && !selectedAnn.sentAt && (
                <Badge variant="warning">예약 발송: {formatDateTime(selectedAnn.scheduledAt)}</Badge>
              )}
            </div>
            <div className="text-sm text-slate-400 flex gap-4">
              <span>작성자: {selectedAnn.createdBy}</span>
              <span>발송: {formatDateTime(selectedAnn.sentAt ?? selectedAnn.createdAt)}</span>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedAnn.content}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400 pt-2">
              <Users size={14} />
              <span>{selectedAnn.readCount}/{selectedAnn.totalRecipients}명 읽음</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Create modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="공지사항 작성"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              loading={createMutation.isPending}
              disabled={!form.title || !form.content}
            >
              등록
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="공지사항 제목을 입력하세요"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="공지사항 내용을 입력하세요"
              rows={5}
              className="textarea-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">대상 유형</label>
              <select
                value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value as AnnouncementTarget })}
                className="select-field"
              >
                {['전체', '기수별', '팀별', '국가별'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {form.targetType !== '전체' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">대상 값</label>
                <input
                  type="text"
                  value={form.targetValue}
                  onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                  placeholder={
                    form.targetType === '기수별' ? '예: 3기' :
                    form.targetType === '팀별' ? '예: A팀' :
                    '예: 미국(NY)'
                  }
                  className="input-field"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">예약 발송 (선택)</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="input-field"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
