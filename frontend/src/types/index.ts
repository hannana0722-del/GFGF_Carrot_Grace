// Auth
export interface User {
  id: number
  username: string
  email: string
  fullName: string
  role: 'admin' | 'manager' | 'participant'
  cohort?: string
  country?: string
  team?: string
  avatarUrl?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

// Cohort / Filters
export interface Cohort {
  id: number
  name: string
  startDate: string
  endDate: string
  countries: string[]
}

// Attendance
export type AttendanceStatus = '출석' | '지각' | '결석' | '조퇴'

export interface AttendanceRecord {
  id: number
  userId: number
  userName: string
  country: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: AttendanceStatus
  reason?: string
  cohort: string
}

export interface AttendanceSummary {
  total: number
  present: number
  late: number
  absent: number
  earlyLeave: number
  rate: number
}

// Health Check
export type SignalColor = '녹색' | '황색' | '적색'

export interface HealthCheckForm {
  physicalCondition: number // 1-5
  mentalCondition: number   // 1-5
  sleepQuality: number      // 1-5
  stressLevel: number       // 1-5
  notes?: string
  requestConsultation: boolean
}

export interface HealthCheckRecord {
  id: number
  userId: number
  userName: string
  country: string
  cohort: string
  date: string
  physicalCondition: number
  mentalCondition: number
  sleepQuality: number
  stressLevel: number
  signalColor: SignalColor
  notes?: string
  requestConsultation: boolean
}

export interface HealthStats {
  green: number
  yellow: number
  red: number
}

// Assignments
export type AssignmentStatus = '진행중' | '마감됨'
export type SubmissionStatus = '제출완료' | '미제출' | '지각제출'

export interface Assignment {
  id: number
  title: string
  description: string
  dueDate: string
  cohort: string
  targetCountries: string[]
  status: AssignmentStatus
  totalParticipants: number
  submittedCount: number
  createdAt: string
  createdBy: string
}

export interface Submission {
  id: number
  assignmentId: number
  userId: number
  userName: string
  country: string
  submittedAt: string | null
  status: SubmissionStatus
  fileUrl?: string
  link?: string
  score?: number
  feedback?: string
}

// Announcements
export type AnnouncementTarget = '전체' | '기수별' | '팀별' | '국가별'

export interface Announcement {
  id: number
  title: string
  content: string
  targetType: AnnouncementTarget
  targetValue?: string
  scheduledAt?: string
  sentAt?: string
  createdAt: string
  createdBy: string
  readCount: number
  totalRecipients: number
  isRead?: boolean
}

// Daily Report
export type EmotionTag = '좋음' | '보통' | '힘듦' | '어려움'

export interface DailyReport {
  id: number
  userId: number
  userName: string
  country: string
  cohort: string
  date: string
  content: string
  emotion: EmotionTag
  satisfaction: number // 1-5
  photoUrl?: string
  submittedAt: string
}

// Risk Management
export type RiskStatus = '위험' | '주의' | '안전' | '해결됨'
export type RiskPriority = '높음' | '중간' | '낮음'
export type RiskType = '건강' | '심리' | '학업' | '생활' | '기타'

export interface RiskAction {
  id: number
  riskId: number
  note: string
  actionBy: string
  actionAt: string
}

export interface Risk {
  id: number
  userId: number
  userName: string
  country: string
  cohort: string
  issueType: RiskType
  description: string
  priority: RiskPriority
  status: RiskStatus
  assignedTo?: string
  lastUpdated: string
  createdAt: string
  actions: RiskAction[]
}

// Dashboard
export interface CountryStats {
  country: string
  attendanceRate: number
  assignmentRate: number
}

export interface Notification {
  id: number
  type: '건강' | '출결' | '과제' | '일반'
  message: string
  createdAt: string
  isRead: boolean
  severity: 'high' | 'medium' | 'low'
}

export interface DashboardStats {
  todayAttendanceRate: number
  riskCount: number
  assignmentSubmitted: number
  assignmentTotal: number
  countryStats: CountryStats[]
  notifications: Notification[]
}

// API Response wrapper
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
