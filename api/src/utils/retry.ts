/**
 * Retry Utility with Exponential Backoff
 * 
 * Automatically retries failed operations with increasing delays between attempts.
 * Includes jitter to prevent thundering herd problem.
 */

export interface RetryOptions {
  maxRetries?: number;        // Maximum number of retry attempts (default: 3)
  baseDelay?: number;         // Base delay in ms (default: 1000)
  maxDelay?: number;          // Maximum delay in ms (default: 30000)
  jitter?: boolean;           // Add random jitter to delays (default: true)
  onRetry?: (attempt: number, error: Error) => void;  // Callback on retry
  shouldRetry?: (error: Error) => boolean;  // Custom retry condition
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  useJitter: boolean
): number {
  // Exponential backoff: baseDelay * 2^attempt
  let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  // Add jitter: random value between 0 and delay
  if (useJitter) {
    delay = Math.random() * delay;
  }

  return Math.floor(delay);
}

/**
 * Default retry condition - retry on any error
 */
const defaultShouldRetry = (error: Error): boolean => {
  // Don't retry on validation errors (4xx status codes)
  if ('statusCode' in error) {
    const statusCode = (error as any).statusCode;
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
  }
  return true;
};

/**
 * Execute a function with retry logic and exponential backoff
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with the result or throws the last error
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
    onRetry,
    shouldRetry = defaultShouldRetry
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`[Retry] Success after ${attempt} retries (${Date.now() - startTime}ms)`);
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        console.log(`[Retry] Error not retryable: ${lastError.message}`);
        throw lastError;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`[Retry] Max retries (${maxRetries}) exceeded: ${lastError.message}`);
        throw lastError;
      }

      // Calculate delay and wait before next attempt
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitter);
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms: ${lastError.message}`);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Execute a function with retry logic and return detailed result
 * (Does not throw, returns result object instead)
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns RetryResult with success status and details
 */
export async function tryWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const result = await callWithRetry(fn, {
      ...options,
      onRetry: (attempt, error) => {
        attempts = attempt;
        if (options.onRetry) {
          options.onRetry(attempt, error);
        }
      }
    });

    return {
      success: true,
      result,
      attempts: attempts + 1,
      totalDuration: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: (options.maxRetries ?? 3) + 1,
      totalDuration: Date.now() - startTime
    };
  }
}

/**
 * Retry configuration presets for common scenarios
 */
export const RetryPresets = {
  // Quick retry for fast operations
  fast: {
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 2000,
    jitter: true
  },
  
  // Standard retry for most API calls
  standard: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true
  },
  
  // Aggressive retry for critical operations
  aggressive: {
    maxRetries: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    jitter: true
  },
  
  // No jitter for predictable timing
  noJitter: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: false
  }
} as const;

/**
 * Create a retry wrapper function with preset options
 * 
 * @param options - Retry configuration options
 * @returns Function that wraps any async function with retry logic
 */
export function createRetryWrapper(options: RetryOptions = {}) {
  return async function retry<T>(fn: () => Promise<T>): Promise<T> {
    return callWithRetry(fn, options);
  };
}
