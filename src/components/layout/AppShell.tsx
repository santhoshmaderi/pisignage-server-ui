import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Icon } from '@/components/Icon'
import { AssistantPanel } from '@/components/AssistantPanel'
import { clearCredentials, decodeUsername, loadAuthHeader } from '@/lib/auth'

export function AppShell() {
  const navigate = useNavigate()
  const username = decodeUsername(loadAuthHeader())
  const [assistantOpen, setAssistantOpen] = useState(false)

  const handleSignOut = () => {
    clearCredentials()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-background text-on-background">
      <SideNav username={username} />
      <div className="flex-1 ml-60 flex flex-col h-screen overflow-hidden">
        <TopBar onSignOut={handleSignOut} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[1440px] mx-auto space-y-6">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Floating assistant launcher — available on every page. */}
      <button
        type="button"
        onClick={() => setAssistantOpen(true)}
        aria-label="Open piSignage assistant"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-on-primary shadow-xl hover:bg-primary-container transition-colors"
      >
        <Icon name="smart_toy" size={22} />
        <span className="text-label-caps uppercase font-bold hidden sm:inline">Assistant</span>
      </button>

      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  )
}
