import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught error:", error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="text-5xl mb-4">🌾</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-1 max-w-xs leading-relaxed">
            An unexpected error occurred. Your investments and data are safe.
          </p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground/60 font-mono bg-muted rounded-lg px-3 py-2 mt-2 mb-6 max-w-xs break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
