import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, stack?: string) => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    this.props.onError?.(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div className="min-h-screen bg-concord-bg-primary text-concord-text-primary p-6">
          <h1 className="text-xl font-bold text-red-400 mb-4">
            Something went wrong
          </h1>
          <pre className="p-4 rounded-lg bg-red-500/20 text-red-300 text-sm font-mono whitespace-pre-wrap break-words">
            {err.message}
            {err.stack && `\n\n${err.stack}`}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
