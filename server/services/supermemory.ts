import axios from 'axios';

interface SuperMemoryConfig {
  apiKey: string;
  baseUrl: string;
}

interface Memory {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  spaces?: string[];
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export class SuperMemoryService {
  private config: SuperMemoryConfig;
  private client: axios.AxiosInstance;

  constructor(config: SuperMemoryConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async addMemory(memory: Memory): Promise<string | null> {
    try {
      const response = await this.client.post('/memories', {
        content: memory.content,
        metadata: memory.metadata,
        spaces: memory.spaces
      });
      return response.data.id;
    } catch (error) {
      console.error('Error adding memory:', error);
      return null;
    }
  }

  async searchMemories(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      const response = await this.client.post('/search', {
        q: query,
        limit
      });
      return response.data.results || [];
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    try {
      await this.client.delete(`/memories/${memoryId}`);
      return true;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }
}

// Singleton instance
const apiKey = process.env.SUPERMEMORY_API_KEY;
if (!apiKey) {
  throw new Error('SUPERMEMORY_API_KEY is required');
}

export const superMemory = new SuperMemoryService({
  apiKey,
  baseUrl: process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai/v3'
});