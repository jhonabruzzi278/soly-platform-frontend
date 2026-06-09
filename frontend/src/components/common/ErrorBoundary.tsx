import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="grid min-h-screen place-items-center p-8 text-center">
          <div>
            <h1 className="text-xl font-semibold mb-2">Algo salio mal</h1>
            <p className="text-sm text-gray-600 mb-4">Ha ocurrido un error inesperado.</p>
            <button
              className="px-4 py-2 bg-black text-white rounded text-sm"
              onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
