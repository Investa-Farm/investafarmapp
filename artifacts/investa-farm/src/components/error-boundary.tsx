import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retrying: boolean;
}

function getRoleHome(): string {
  try {
    const raw = sessionStorage.getItem("investa_user");
    if (!raw) return "/";
    const user = JSON.parse(raw) as { role?: string };
    if (user.role === "farmer") return "/farmer/dashboard";
    if (user.role === "cooperative") return "/cooperative/dashboard";
    if (user.role === "agribusiness") return "/agribusiness";
    if (user.role === "investor") return "/market";
  } catch { /* ignore */ }
  return "/";
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retrying: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught error:", error.message, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, retrying: false });
  };

  handleGoHome = () => {
    window.location.href = getRoleHome();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const homeLabel = (() => {
        try {
          const raw = sessionStorage.getItem("investa_user");
          if (!raw) return "Go to Landing Page";
          const user = JSON.parse(raw) as { role?: string };
          if (user.role === "farmer") return "Go to Farmer Dashboard";
          if (user.role === "cooperative") return "Go to Cooperative Dashboard";
          if (user.role === "agribusiness") return "Go to Agribusiness Dashboard";
          if (user.role === "investor") return "Go to Market";
        } catch { /* ignore */ }
        return "Go to Home";
      })();

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="text-5xl mb-4">🌾</div>
          <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-1 max-w-xs leading-relaxed">
            We hit an unexpected error. Our team has been notified and is working on a fix.
            Your investments and data are safe.
          </p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground/60 font-mono bg-muted rounded-lg px-3 py-2 mt-2 mb-2 max-w-xs break-all">
              {this.state.error.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground/50 mb-6 max-w-xs">
            Try refreshing the page — if the problem continues, contact support.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <button
              onClick={this.handleRetry}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
            >
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              className="bg-muted text-muted-foreground px-6 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform border border-border"
            >
              {homeLabel}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
