import React, { Component, ReactNode } from 'react';
import { errorLogger } from '../../services/errorLogger';
import { logger } from '../../utils/logger';
import ErrorRecoveryScreen from './ErrorRecoveryScreen';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches React component errors
 * and provides a fallback UI with recovery options.
 *
 * Usage:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to our error logging service
    logger.error('[ErrorBoundary] Caught error:', error);
    logger.error('[ErrorBoundary] Error info:', errorInfo);

    // Persist error for debugging
    errorLogger.log(
      'general',
      'React component error caught by ErrorBoundary',
      error,
      {
        componentStack: errorInfo.componentStack,
      }
    ).catch(e => {
      logger.error('[ErrorBoundary] Failed to log error:', e);
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback - ErrorRecoveryScreen
      return <ErrorRecoveryScreen error={this.state.error} onReset={this.resetError} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
