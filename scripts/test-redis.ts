import 'dotenv/config';
import Redis from 'ioredis';

async function testRedisConnection() {
  console.log('Testing Redis connection...');
  console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
  
  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL is not set in environment variables');
    process.exit(1);
  }
  
  const redis = new Redis(process.env.REDIS_URL, {
    connectTimeout: 10000,
    maxRetriesPerRequest: 3,
  });
  
  try {
    // Test basic connection
    const pong = await redis.ping();
    console.log('✅ Redis PING response:', pong);
    
    // Test set/get
    await redis.set('test:key', 'Hello from CCL-3!');
    const value = await redis.get('test:key');
    console.log('✅ Redis SET/GET test:', value);
    
    // Test key expiration
    await redis.setex('test:expiring', 5, 'This will expire in 5 seconds');
    const ttl = await redis.ttl('test:expiring');
    console.log('✅ Redis TTL test:', ttl, 'seconds');
    
    // Cleanup
    await redis.del('test:key');
    
    // Get Redis info
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    console.log('✅ Redis version:', version);
    
    console.log('\n✅ All Redis tests passed! Your Redis connection is working correctly.');
    
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis connection error:', error);
    process.exit(1);
  }
}

testRedisConnection();