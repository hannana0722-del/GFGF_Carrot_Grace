import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

const MOCK_USERS: User[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@gsdf.org',
    fullName: '김관리자',
    role: 'admin',
    cohort: '전체',
  },
  {
    id: 2,
    username: 'manager',
    email: 'manager@gsdf.org',
    fullName: '이매니저',
    role: 'manager',
    cohort: '3기',
    country: '미국(NY)',
  },
  {
    id: 3,
    username: 'user',
    email: 'user@gsdf.org',
    fullName: '박청년',
    role: 'participant',
    cohort: '3기',
    country: '미국(NY)',
    team: 'A팀',
  },
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('gsdf_token')
    const savedUser = localStorage.getItem('gsdf_user')
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('gsdf_token')
        localStorage.removeItem('gsdf_user')
      }
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    // Try real API first, fall back to mock
    try {
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (response.ok) {
        const data = await response.json()
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem('gsdf_token', data.token)
        localStorage.setItem('gsdf_user', JSON.stringify(data.user))
        return
      }
    } catch {
      // API not available, use mock
    }

    // Mock login
    const mockUser = MOCK_USERS.find((u) => u.username === username)
    if (mockUser && password === 'password') {
      const mockToken = `mock_token_${Date.now()}`
      setToken(mockToken)
      setUser(mockUser)
      localStorage.setItem('gsdf_token', mockToken)
      localStorage.setItem('gsdf_user', JSON.stringify(mockUser))
      return
    }
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('gsdf_token')
    localStorage.removeItem('gsdf_user')
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}
