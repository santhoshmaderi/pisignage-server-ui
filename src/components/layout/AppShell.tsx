import { Outlet, useNavigate } from 'react-router-dom'
import { SideNav } from './SideNav'
import { TopBar } from './TopBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { clearCredentials, decodeUsername, loadAuthHeader } from '@/lib/auth'

export function AppShell() {
  const navigate = useNavigate()
  const username = decodeUsername(loadAuthHeader())

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
    </div>
  )
}
