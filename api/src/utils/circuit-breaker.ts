/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by tracking API call failures and automatically
 * falling back to mock responses when a service becomes unavailable.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, all requests use fallback
 * - HALF_OPEN: Testing if service recovered, limited requests pass through
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold?: number;  // Number of failures before opening circuit (default: 3)
  resetTimeout?: number;      // Time in ms before attempting half-open (default: 60000)
  successThreshold?: number;  // Successes needed in half-open to close (default: 2)
}

export class CircuitBreaker<T> {
  private state: CircuitState = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.successThreshold = options.successThreshold ?? 2;
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn - The function to execute
   * @param fallback - Fallback function to call when circuit is open
   * @returns Result from fn or fallback
   */
  async execute(
    fn: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    // Check if we should attempt to close the circuit
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        console.log(`[CircuitBreaker:${this.name}] Attempting half-open state`);
        this.state = 'half-open';
        this.successes = 0;
      } else {
        console.log(`[CircuitBreaker:${this.name}] Circuit open, using fallback`);
        return await fallback();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      console.error(`[CircuitBreaker:${this.name}] Call failed:`, error instanceof Error ? error.message : error);
      return await fallback();
    }
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === 'half-open') {
      this.successes++;
      console.log(`[CircuitBreaker:${this.name}] Success in half-open (${this.successes}/${this.successThreshold})`);
      
      if (this.successes >= this.successThreshold) {
        console.log(`[CircuitBreaker:${this.name}] Closing circuit`);
        this.state = 'closed';
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      console.log(`[CircuitBreaker:${this.name}] Failure in half-open, reopening circuit`);
      this.state = 'open';
      this.successes = 0;
      return;
    }

    if (this.failures >= this.failureThreshold) {
      console.log(`[CircuitBreaker:${this.name}] Failure threshold reached (${this.failures}), opening circuit`);
      this.state = 'open';
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailures(): number {
    return this.failures;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    console.log(`[CircuitBreaker:${this.name}] Manual reset`);
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : null
    };
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker<any>>();

  getOrCreate<T>(
    name: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker<T> {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker<T>(name, options));
    }
    return this.breakers.get(name)!;
  }

  get<T>(name: string): CircuitBreaker<T> | undefined {
    return this.breakers.get(name);
  }

  reset(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  getAllStats() {
    const stats: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();
