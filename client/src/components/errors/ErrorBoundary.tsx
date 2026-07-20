import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.hash = "#/";
    this.handleReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="w-16 h-16 bg-[#e91429]/10 rounded-[8px] flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-[#e91429]" aria-hidden="true" />
          </div>
          <h2 className="text-[28px] font-bold text-th-text mb-2">Something went wrong</h2>
          <p className="text-[20px] text-th-secondary mb-2 max-w-md">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          {import.meta.env.DEV && this.state.error?.stack && (
            <pre className="text-[16px] text-th-secondary/60 max-w-lg mb-6 overflow-auto text-left whitespace-pre-wrap bg-th-hover/50 p-3 rounded-lg">
              {this.state.error.stack}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 bg-[#1ed760] hover:bg-[#1ed760]/90 text-black font-semibold px-6 py-2.5 rounded-lg uppercase tracking-wider text-[18px] transition-all duration-200 active:scale-[0.95]"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Try Again
            </button>
            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 bg-th-hover hover:bg-th-active text-th-text font-semibold px-6 py-2.5 rounded-lg uppercase tracking-wider text-[18px] transition-all duration-200 active:scale-[0.95]"
            >
              <Home size={16} aria-hidden="true" />
              Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
