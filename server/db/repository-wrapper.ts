import { dbConnectionManager } from './connection-manager';
import { logger } from '../utils/logger';

/**
 * Base repository wrapper that provides automatic fallback to mock data
 */
export class RepositoryWrapper<T> {
  constructor(
    private repositoryName: string,
    private realRepository: any,
    private mockData: {
      findAll?: () => T[];
      findById?: (id: string) => T | undefined;
      create?: (data: any) => T;
      update?: (id: string, data: any) => T | undefined;
      delete?: (id: string) => boolean;
      [key: string]: any;
    }
  ) {}

  /**
   * Wrap a repository method with fallback logic
   */
  private wrapMethod(methodName: string, method: Function, fallbackMethod?: Function) {
    return async (...args: any[]) => {
      return dbConnectionManager.executeWithFallback(
        async () => {
          logger.debug(`${this.repositoryName}.${methodName} - using database`);
          return await method.apply(this.realRepository, args);
        },
        async () => {
          logger.debug(`${this.repositoryName}.${methodName} - using fallback`);
          if (fallbackMethod) {
            return fallbackMethod(...args);
          }
          throw new Error(`No fallback defined for ${this.repositoryName}.${methodName}`);
        }
      );
    };
  }

  /**
   * Create a wrapped repository instance
   */
  wrap(): any {
    const wrapped: any = {};

    // Wrap all methods from the real repository
    for (const key in this.realRepository) {
      const value = this.realRepository[key];
      if (typeof value === 'function') {
        wrapped[key] = this.wrapMethod(key, value, this.mockData[key]);
      }
    }

    // Add any mock-only methods
    for (const key in this.mockData) {
      if (!(key in wrapped) && typeof this.mockData[key] === 'function') {
        wrapped[key] = this.wrapMethod(key, () => {
          throw new Error(`Database required for ${this.repositoryName}.${key}`);
        }, this.mockData[key]);
      }
    }

    return wrapped;
  }
}

/**
 * Helper to create a wrapped repository
 */
export function createWrappedRepository<T>(
  name: string,
  realRepository: any,
  mockData: any
): any {
  const wrapper = new RepositoryWrapper<T>(name, realRepository, mockData);
  return wrapper.wrap();
}