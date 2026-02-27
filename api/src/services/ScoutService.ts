import { callWithRetry } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';
import fs from 'fs';
import path from 'path';

interface TavilySearchRequest {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeDomains?: string[];
}

interface TavilySearchResult {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    publishedDate?: string;
  }>;
  query: string;
  responseTime: number;
}

interface DealCandidate {
  asset_id: string;
  price: number;
  collection: string;
  listing_url: string;
  title: string;
  description: string;
  score: number;
  timestamp: string;
}

interface CacheEntry {
  data: DealCandidate[];
  timestamp: number;
}

interface YutoriScoutRequest {
  name: string;
  description: string;
  targetUrls: string[];
  monitoringFrequency: 'realtime' | 'hourly' | 'daily';
  alertConditions: {
    priceBelow?: number;
    volumeAbove?: number;
    keywords?: string[];
  };
}

interface YutoriScoutResult {
  scoutId: string;
  status: 'active' | 'paused';
  findings: Array<{
    timestamp: string;
    url: string;
    data: Record<string, any>;
    alertTriggered: boolean;
  }>;
}

export class ScoutService {
  private tavilyApiKey: string;
  private yutoriApiKey: string;
  private tavilyCircuitBreaker: CircuitBreaker<DealCandidate[]>;
  private yutoriCircuitBreaker: CircuitBreaker<YutoriScoutResult>;
  private cache: Map<string, CacheEntry>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    this.yutoriApiKey = process.env.YUTORI_API_KEY || '';
    this.tavilyCircuitBreaker = new CircuitBreaker<DealCandidate[]>('tavily');
    this.yutoriCircuitBreaker = new CircuitBreaker<YutoriScoutResult>('yutori');
    this.cache = new Map();
  }

  /**
   * Generate cache key from query parameters
   */
  private generateCacheKey(query: string, maxResults: number): string {
    return `${query}:${maxResults}`;
  }

  /**
   * Get cached results if available and not expired
   */
  private getCached(cacheKey: string): DealCandidate[] | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  /**
   * Store results in cache
   */
  private setCache(cacheKey: string, data: DealCandidate[]): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Load mock Tavily responses from JSON file
   */
  private loadMockTavilyResponses(): TavilySearchResult {
    try {
      const mockPath = path.join(process.cwd(), '..', 'mocks', 'tavily-responses.json');
      const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
      return mockData;
    } catch (error) {
      console.error('Failed to load mock Tavily responses:', error);
      return {
        results: [],
        query: '',
        responseTime: 0
      };
    }
  }

  /**
   * Transform Tavily results into structured deal data
   */
  private transformToDealCandidates(tavilyResults: TavilySearchResult): DealCandidate[] {
    return tavilyResults.results.map((result, index) => {
      // Extract price from content (simple regex pattern)
      const priceMatch = result.content.match(/(\d+(?:\.\d+)?)\s*NEAR/i);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

      // Extract collection name from title or content
      const collectionMatch = result.title.match(/(NEAR Punks|Antisocial Ape Club|ASAC|Paras Gems)/i);
      const collection = collectionMatch ? collectionMatch[1] : 'Unknown Collection';

      // Generate asset ID from URL or index
      const assetId = `asset-${Date.now()}-${index}`;

      return {
        asset_id: assetId,
        price,
        collection,
        listing_url: result.url,
        title: result.title,
        description: result.content.substring(0, 200),
        score: result.score,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Search for deals using Tavily API
   */
  async searchDeals(request: TavilySearchRequest): Promise<DealCandidate[]> {
    const { query, searchDepth = 'basic', maxResults = 3 } = request;

    // Check cache first
    const cacheKey = this.generateCacheKey(query, maxResults);
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log('Returning cached results for:', query);
      return cached;
    }

    // Execute search with circuit breaker
    const deals = await this.tavilyCircuitBreaker.execute(
      async () => {
        // Call Tavily API with retry logic
        return await callWithRetry(async () => {
          if (!this.tavilyApiKey) {
            throw new Error('Tavily API key not configured');
          }

          const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.tavilyApiKey}`
            },
            body: JSON.stringify({
              query,
              search_depth: searchDepth,
              max_results: maxResults,
              include_domains: request.includeDomains
            })
          });

          if (!response.ok) {
            throw new Error(`Tavily API error: ${response.status}`);
          }

          const data = await response.json() as TavilySearchResult;
          return this.transformToDealCandidates(data);
        }, { maxRetries: 3, baseDelay: 1000 });
      },
      () => {
        // Fallback to mock responses
        console.log('Falling back to mock Tavily responses');
        const mockData = this.loadMockTavilyResponses();
        return this.transformToDealCandidates(mockData);
      }
    );

    // Cache the results
    this.setCache(cacheKey, deals);

    return deals;
  }

  /**
   * Load mock Yutori responses from JSON file
   */
  private loadMockYutoriResponses(): YutoriScoutResult {
    try {
      const mockPath = path.join(process.cwd(), '..', 'mocks', 'yutori-responses.json');
      const mockData = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
      return mockData;
    } catch (error) {
      console.error('Failed to load mock Yutori responses:', error);
      return {
        scoutId: `mock-scout-${Date.now()}`,
        status: 'active',
        findings: []
      };
    }
  }

  /**
   * Create a Yutori Scout for ongoing monitoring
   */
  async createScout(request: YutoriScoutRequest): Promise<YutoriScoutResult> {
    return await this.yutoriCircuitBreaker.execute(
      async () => {
        // Call Yutori API with retry logic
        return await callWithRetry(async () => {
          if (!this.yutoriApiKey) {
            throw new Error('Yutori API key not configured');
          }

          const response = await fetch('https://api.yutori.io/scouts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.yutoriApiKey}`
            },
            body: JSON.stringify(request)
          });

          if (!response.ok) {
            throw new Error(`Yutori API error: ${response.status}`);
          }

          const data = await response.json() as YutoriScoutResult;
          return data;
        }, { maxRetries: 3, baseDelay: 1000 });
      },
      () => {
        // Fallback to mock responses or periodic Tavily calls
        console.log('Falling back to mock Yutori responses');
        return this.loadMockYutoriResponses();
      }
    );
  }

  /**
   * Get scout findings by ID
   */
  async getScoutFindings(scoutId: string): Promise<YutoriScoutResult> {
    return await this.yutoriCircuitBreaker.execute(
      async () => {
        return await callWithRetry(async () => {
          if (!this.yutoriApiKey) {
            throw new Error('Yutori API key not configured');
          }

          const response = await fetch(`https://api.yutori.io/scouts/${scoutId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.yutoriApiKey}`
            }
          });

          if (!response.ok) {
            throw new Error(`Yutori API error: ${response.status}`);
          }

          return await response.json() as YutoriScoutResult;
        }, { maxRetries: 3, baseDelay: 1000 });
      },
      () => {
        console.log('Falling back to mock Yutori scout findings');
        return this.loadMockYutoriResponses();
      }
    );
  }
}
