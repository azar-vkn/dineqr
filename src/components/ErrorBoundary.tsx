import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

// ─── Global Error Boundary ───────────────────────────────────
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Something went wrong</h1>
            <p className="text-stone-500">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-stone-50 p-3 rounded-lg overflow-auto max-h-32 text-red-700 border border-stone-200">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-stone-800 text-white font-medium rounded-xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Route-level Error Boundary ──────────────────────────────
// Shows a retry button that resets state without a full page reload.

interface RouteErrorBoundaryProps {
  children: ReactNode;
  routeName?: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Route error [${this.props.routeName || "unknown"}]:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 max-w-sm w-full space-y-5">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-stone-900">
              {this.props.routeName ? `${this.props.routeName} failed to load` : "Page Error"}
            </h2>
            <p className="text-stone-500 text-sm">
              Something went wrong loading this section. You can try again or go back.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left bg-stone-50 p-3 rounded-lg overflow-auto max-h-24 text-red-700 border border-stone-200">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-2.5 bg-emerald-800 text-white font-medium rounded-xl hover:bg-emerald-900 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 py-2.5 bg-stone-100 text-stone-700 font-medium rounded-xl hover:bg-stone-200 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
