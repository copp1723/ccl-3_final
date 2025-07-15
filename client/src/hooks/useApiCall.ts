import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
}

export function useApiCall() {
  const { token, refreshToken, logout } = useAuth();

  const apiCall = useCallback(async (url: string, options: ApiCallOptions = {}) => {
    const {
      method = 'GET',
      headers = {},
      body,
      skipAuth = false
    } = options;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    };

    // Add auth token if available and not skipped
    if (!skipAuth && token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      // Handle 401 - try to refresh token
      if (response.status === 401 && !skipAuth) {
        const refreshed = await refreshToken();
        
        if (refreshed) {
          // Retry the request with new token
          requestHeaders.Authorization = `Bearer ${token}`;
          const retryResponse = await fetch(url, {
            ...requestOptions,
            headers: requestHeaders
          });
          
          if (!retryResponse.ok) {
            throw new Error(`HTTP error! status: ${retryResponse.status}`);
          }
          
          return retryResponse;
        } else {
          // Refresh failed, logout user
          logout();
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [token, refreshToken, logout]);

  const get = useCallback((url: string, headers?: Record<string, string>) => 
    apiCall(url, { method: 'GET', headers }), [apiCall]);

  const post = useCallback((url: string, body?: any, headers?: Record<string, string>) =>
    apiCall(url, { method: 'POST', body, headers }), [apiCall]);

  const put = useCallback((url: string, body?: any, headers?: Record<string, string>) =>
    apiCall(url, { method: 'PUT', body, headers }), [apiCall]);

  const del = useCallback((url: string, headers?: Record<string, string>) =>
    apiCall(url, { method: 'DELETE', headers }), [apiCall]);

  const patch = useCallback((url: string, body?: any, headers?: Record<string, string>) =>
    apiCall(url, { method: 'PATCH', body, headers }), [apiCall]);

  return {
    apiCall,
    get,
    post,
    put,
    delete: del,
    patch
  };
} 