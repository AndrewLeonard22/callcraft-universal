import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "@/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChunkLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if it's a chunk loading error
    const isChunkLoadError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Loading chunk") ||
      error.message.includes("ChunkLoadError");

    if (isChunkLoadError) {
      logger.log("Chunk load error detected, reloading page...");
      // Reload the page to get fresh chunks
      window.location.reload();
    } else {
      logger.error("Error boundary caught error:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Show loading state while reloading
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Refreshing application...</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
