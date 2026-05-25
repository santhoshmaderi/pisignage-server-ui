import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Assets } from '@/pages/Assets'
import { Dashboard } from '@/pages/Dashboard'
import { Groups } from '@/pages/Groups'
import { Login } from '@/pages/Login'
import { Players } from '@/pages/Players'
import { PlaylistEditor } from '@/pages/PlaylistEditor'
import { Playlists } from '@/pages/Playlists'
import { Settings } from '@/pages/Settings'
import { loadAuthHeader } from '@/lib/auth'
import { registerUnauthorizedHandler } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
  },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [authed, setAuthed] = useState(() => loadAuthHeader() !== null)

  useEffect(() => {
    registerUnauthorizedHandler(() => setAuthed(false))
  }, [])

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="players" element={<Players />} />
            <Route path="groups" element={<Groups />} />
            <Route path="assets" element={<Assets />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="playlists/:name" element={<PlaylistEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
