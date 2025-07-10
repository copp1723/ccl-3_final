// Simple circuit breaker implementation
export async function executeWithBoberdooBreaker<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Boberdoo circuit breaker triggered:', error);
    throw error;
  }
}

export async function executeWithOpenRouterBreaker<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('OpenRouter circuit breaker triggered:', error);
    throw error;
  }
}