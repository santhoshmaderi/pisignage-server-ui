import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/Icon'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surfaces in the dev server log via Vite's [Unhandled error] capture.
    console.error('ErrorBoundary caught', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="p-8">
        <Card className="p-6 border-status-offline/40 bg-status-offline/5 flex flex-col gap-4">
          <header className="flex items-start gap-3">
            <Icon name="error" className="text-status-offline" size={32} />
            <div className="flex-1 min-w-0">
              <h2 className="text-headline-md text-text-vibrant">Something blew up</h2>
              <p className="text-body-sm text-text-muted mt-1">
                The UI caught an error before it could blank the screen. The most common cause
                is a backend response in an unexpected shape.
              </p>
            </div>
            <Button variant="outline" onClick={this.reset}>
              <Icon name="refresh" size={16} />
              Retry
            </Button>
          </header>
          <pre className="font-mono text-data-mono text-status-offline bg-canvas-depth-1 border border-border-industrial rounded-industrial p-3 overflow-x-auto whitespace-pre-wrap">
            {error.name}: {error.message}
          </pre>
          {error.stack && (
            <details className="text-body-sm text-text-muted">
              <summary className="cursor-pointer hover:text-text-vibrant">Stack trace</summary>
              <pre className="font-mono text-[11px] mt-2 overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}
        </Card>
      </div>
    )
  }
}
