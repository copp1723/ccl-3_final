import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface ErrorState {
  hasError: boolean;
  message: string;
  code?: string;
  details?: any;
}

export interface UseErrorHandlerReturn {
  error: ErrorState | null;
  clearError: () => void;
  handleError: (error: any, customMessage?: string) => void;
  withErrorHandling: <T>(asyncFn: () => Promise<T>) => Promise<T | null>;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorState | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleError = useCallback((error: any, customMessage?: string) => {
    console.error('Error handled:', error);

    let errorState: ErrorState;

    if (error?.response?.data) {
      // API error response
      const apiError = error.response.data;
      errorState = {
        hasError: true,
        message: customMessage || apiError.message || 'An error occurred',
        code: apiError.code || `HTTP_${error.response.status}`,
        details: apiError
      };
    } else if (error?.message) {
      // Standard error object
      errorState = {
        hasError: true,
        message: customMessage || error.message,
        code: error.code || 'UNKNOWN_ERROR',
        details: error
      };
    } else if (typeof error === 'string') {
      // String error
      errorState = {
        hasError: true,
        message: customMessage || error,
        code: 'STRING_ERROR'
      };
    } else {
      // Unknown error type
      errorState = {
        hasError: true,
        message: customMessage || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        details: error
      };
    }

    setError(errorState);

    // Show toast notification for user feedback
    if (errorState.code?.includes('NETWORK') || errorState.code?.includes('TIMEOUT')) {
      toast.error('Connection Issue', {
        description: 'Please check your internet connection and try again.',
        duration: 5000
      });
    } else if (errorState.code?.includes('AUTH')) {
      toast.error('Authentication Error', {
        description: 'Please log in again to continue.',
        duration: 5000
      });
    } else if (errorState.code?.includes('VALIDATION')) {
      toast.error('Validation Error', {
        description: errorState.message,
        duration: 4000
      });
    } else if (errorState.code?.startsWith('HTTP_5')) {
      toast.error('Server Error', {
        description: 'Something went wrong on our end. Our team has been notified.',
        duration: 6000
      });
    } else {
      toast.error('Error', {
        description: errorState.message,
        duration: 4000
      });
    }
  }, []);

  const withErrorHandling = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      clearError();
      return await asyncFn();
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [clearError, handleError]);

  return {
    error,
    clearError,
    handleError,
    withErrorHandling
  };
}

// Utility hook for API calls with consistent error handling
export function useApiCall() {
  const { withErrorHandling, error, clearError } = useErrorHandler();

  const apiCall = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorMessage?: string;
      showSuccessToast?: boolean;
    }
  ): Promise<T | null> => {
    const result = await withErrorHandling(asyncFn);
    
    if (result && options?.showSuccessToast && options?.successMessage) {
      toast.success('Success', {
        description: options.successMessage,
        duration: 3000
      });
    }
    
    return result;
  }, [withErrorHandling]);

  return {
    apiCall,
    error,
    clearError,
    isError: !!error
  };
}