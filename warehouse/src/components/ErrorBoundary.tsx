import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-[40vh] p-6">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-negative/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-negative" size={24} />
            </div>
            <h3 className="text-feature text-th-text mb-2">Something went wrong</h3>
            <p className="text-caption text-th-secondary mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button onClick={this.handleReset} className="btn-primary btn-sm">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
