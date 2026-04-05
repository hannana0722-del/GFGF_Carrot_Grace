import { useState, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../lib/utils'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
