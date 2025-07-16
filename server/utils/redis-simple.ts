// server/utils/redis-simple.ts
// Simple Redis wrapper - single connection, no pools
// import { createClient } from 'redis';

let redisClient: any = null;

export async function getRedis() {
  // Redis disabled for minimal build
  return null;
}

export async function closeRedis() {
  // Redis disabled for minimal build
}

// Simple rate limiter without redis-rate-limit
export function createRateLimiter(windowMs: number, max: number) {
  const requests = new Map<string, number[]>();
  
  return (req: any, res: any, next: any) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get requests for this IP
    let timestamps = requests.get(key) || [];
    
    // Filter out old requests
    timestamps = timestamps.filter(t => t > windowStart);
    
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    // Add current request
    timestamps.push(now);
    requests.set(key, timestamps);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [k, v] of requests.entries()) {
        if (v.length === 0 || v[v.length - 1] < windowStart) {
          requests.delete(k);
        }
      }
    }
    
    next();
  };
}
