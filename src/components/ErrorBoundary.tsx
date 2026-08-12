import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { log } from '@/lib/log';

/**
 * Catches render-time exceptions so one broken component does not white-screen
 * the whole application.
 *
 * Without a boundary anywhere in the tree, React unmounts everything on an
 * uncaught render error and the user is left with a blank page, no message and
 * no way back other than manually editing the URL.
 */
interface Props {
  children: ReactNode;
  /** Shown instead of the default panel, if supplied. */
  fallback?: ReactNode;
  /** Label used in the error report, e.g. the route name. */
  context?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep this: it is the only record of a crash that reaches a developer.
    log.error(
      `Unhandled render error${this.props.context ? ` in ${this.props.context}` : ''}`,
      error,
      info.componentStack
    );
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mb-1 text-sm text-muted-foreground">
            This page hit an unexpected error. Your data has not been lost.
          </p>
          {/* The message helps support diagnose without needing a screen share. */}
          <p className="mb-6 break-words font-mono text-xs text-muted-foreground/80">
            {error.message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={this.reset} variant="default" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/dashboard';
              }}
              variant="outline"
              size="sm"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
