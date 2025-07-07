import { Response } from 'express';

export function handleApiError(res: Response, error: any) {
  console.error('API Error:', error);
  
  // Check if it's already a formatted error response
  if (error.code && error.message && error.category) {
    return res.status(500).json({
      success: false,
      error: error,
      timestamp: new Date().toISOString()
    });
  }
  
  // Generic error response
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred',
      category: 'system'
    },
    timestamp: new Date().toISOString()
  });
}