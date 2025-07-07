// server/utils/redis-simple.ts
// Simple Redis wrapper - single connection, no pools
import { createClient } from 'redis';

let redisClient: any = null;

export async function getRedis() {
  if (!redisClient && process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err: any) => console.error('Redis error:', err));
    await redisClient.connect();
  }
  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
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
