export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  
  return trimmed;
}

export function sanitizeJsonData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      
      if (typeof value === 'string') {
        // Remove any potential script tags or SQL injection attempts
        sanitized[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/[';]/g, '')
          .trim();
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeJsonData(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}