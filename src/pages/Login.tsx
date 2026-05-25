import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { saveCredentials } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/Icon'

type LocationState = { from?: string }

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('pi')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('Username and password are required.')
      return
    }
    saveCredentials({ username, password })
    const state = location.state as LocationState | null
    navigate(state?.from ?? '/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-industrial bg-primary flex items-center justify-center">
            <Icon name="monitor" className="text-on-primary" filled size={28} />
          </div>
          <h1 className="text-headline-md text-text-vibrant font-semibold">piSignage Server</h1>
          <p className="text-body-sm text-text-muted text-center">
            Sign in to access the fleet console.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete="current-password"
          />
          {error && (
            <p className="text-body-sm text-status-offline" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full mt-2">
            Sign In
          </Button>
          <p className="text-body-sm text-text-muted text-center">
            Defaults to <span className="font-mono text-primary">pi / pi</span> on a fresh install.
          </p>
        </form>
      </Card>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-caps text-text-muted uppercase">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="bg-canvas-depth-1 border border-border-industrial rounded-industrial px-3 py-2 text-body-md text-text-vibrant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </label>
  )
}
