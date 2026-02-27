import neo4j, { Driver, Session, Result, QueryResult, Integer } from 'neo4j-driver';

/**
 * Neo4j Client Utility for FORGE
 * Provides connection pooling, retry logic, and helper functions for Cypher queries
 */

interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  maxConnectionPoolSize?: number;
  connectionTimeout?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
}

class Neo4jClient {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
  };

  constructor(config: Neo4jConfig) {
    this.config = {
      maxConnectionPoolSize: 50,
      connectionTimeout: 10000,
      ...config,
    };
  }

  /**
   * Initialize the Neo4j driver with connection pooling
   */
  async connect(): Promise<void> {
    if (this.driver) {
      console.log('Neo4j driver already connected');
      return;
    }

    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionTimeout: this.config.connectionTimeout,
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      console.log('Neo4j driver connected successfully');
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      throw new Error(`Neo4j connection failed: ${error}`);
    }
  }

  /**
   * Get a new session from the driver
   */
  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session();
  }

  /**
   * Execute a Cypher query with retry logic and exponential backoff
   */
  async executeQuery<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<QueryResult<T>> {
    return this.withRetry(async () => {
      const session = this.getSession();
      try {
        // Convert numeric parameters to Neo4j integers
        const neo4jParams = this.convertParamsToNeo4jTypes(params);
        const result = await session.run(query, neo4jParams);
        return result;
      } finally {
        await session.close();
      }
    });
  }

  /**
   * Execute a write transaction with retry logic
   */
  async executeWrite<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<QueryResult<T>> {
    return this.withRetry(async () => {
      const session = this.getSession();
      try {
        const neo4jParams = this.convertParamsToNeo4jTypes(params);
        const result = await session.executeWrite((tx) =>
          tx.run(query, neo4jParams)
        );
        return result;
      } finally {
        await session.close();
      }
    });
  }

  /**
   * Execute a read transaction with retry logic
   */
  async executeRead<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<QueryResult<T>> {
    return this.withRetry(async () => {
      const session = this.getSession();
      try {
        const neo4jParams = this.convertParamsToNeo4jTypes(params);
        const result = await session.executeRead((tx) =>
          tx.run(query, neo4jParams)
        );
        return result;
      } finally {
        await session.close();
      }
    });
  }

  /**
   * Convert JavaScript parameters to Neo4j types
   * This is critical for numeric values to avoid float/int issues
   */
  private convertParamsToNeo4jTypes(params: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number' && Number.isInteger(value)) {
        // Convert integers to Neo4j Integer type
        converted[key] = neo4j.int(value);
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retryCount >= this.retryConfig.maxRetries) {
        console.error(
          `Max retries (${this.retryConfig.maxRetries}) exceeded:`,
          error
        );
        throw error;
      }

      const delay = this.retryConfig.baseDelay * Math.pow(2, retryCount);
      console.warn(
        `Query failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${
          this.retryConfig.maxRetries
        })`
      );

      await this.sleep(delay);
      return this.withRetry(fn, retryCount + 1);
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Get user by ID
   */
  async getUserById(userId: string): Promise<any | null> {
    const result = await this.executeRead(
      'MATCH (u:User {id: $userId}) RETURN u',
      { userId }
    );

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get('u').properties;
  }

  /**
   * Helper: Get user policies
   */
  async getUserPolicies(userId: string): Promise<any[]> {
    const result = await this.executeRead(
      `MATCH (u:User {id: $userId})-[:HAS_POLICY]->(p:Policy)
       WHERE p.active = true
       RETURN p
       ORDER BY p.createdAt DESC`,
      { userId }
    );

    return result.records.map((record) => record.get('p').properties);
  }

  /**
   * Helper: Create decision node with relationships
   */
  async createDecision(decision: {
    id: string;
    taskId: string;
    userId: string;
    type: string;
    verdict: string;
    reasoning: string;
    toolCallsJson: string;
    inputDataHash: string;
    checkedPolicyIds: string[];
  }): Promise<void> {
    await this.executeWrite(
      `CREATE (d:Decision {
         id: $id,
         taskId: $taskId,
         timestamp: datetime(),
         type: $type,
         verdict: $verdict,
         reasoning: $reasoning,
         toolCallsJson: $toolCallsJson,
         inputDataHash: $inputDataHash
       })
       WITH d
       MATCH (u:User {id: $userId})
       CREATE (u)-[:MADE_DECISION]->(d)
       WITH d
       UNWIND $checkedPolicyIds AS policyId
       MATCH (p:Policy {id: policyId})
       CREATE (d)-[:CHECKED_POLICY]->(p)`,
      decision
    );
  }

  /**
   * Helper: Query audit trail with filters
   */
  async queryAuditTrail(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    decisionType?: string;
    limit?: number;
  }): Promise<any[]> {
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (filters.userId) {
      conditions.push('u.id = $userId');
      params.userId = filters.userId;
    }

    if (filters.startDate) {
      conditions.push('d.timestamp >= datetime($startDate)');
      params.startDate = filters.startDate;
    }

    if (filters.endDate) {
      conditions.push('d.timestamp <= datetime($endDate)');
      params.endDate = filters.endDate;
    }

    if (filters.decisionType) {
      conditions.push('d.type = $decisionType');
      params.decisionType = filters.decisionType;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Ensure limit is an integer (Neo4j requires integers for LIMIT)
    const limitValue = filters.limit ? Math.floor(Number(filters.limit)) : null;
    const limitClause = limitValue ? `LIMIT ${limitValue}` : '';

    const query = `
      MATCH (u:User)-[:MADE_DECISION]->(d:Decision)
      OPTIONAL MATCH (d)-[:CHECKED_POLICY]->(p:Policy)
      ${whereClause}
      RETURN u, d, collect(p) as policies
      ORDER BY d.timestamp DESC
      ${limitClause}
    `;

    const result = await this.executeRead(query, params);

    return result.records.map((record) => ({
      user: record.get('u').properties,
      decision: record.get('d').properties,
      policies: record.get('policies').map((p: any) => p.properties),
    }));
  }

  /**
   * Helper: Get collection by ID
   */
  async getCollectionById(collectionId: string): Promise<any | null> {
    const result = await this.executeRead(
      'MATCH (c:Collection {id: $collectionId}) RETURN c',
      { collectionId }
    );

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get('c').properties;
  }

  /**
   * Helper: Get all collections
   */
  async getAllCollections(): Promise<any[]> {
    const result = await this.executeRead(
      'MATCH (c:Collection) RETURN c ORDER BY c.name'
    );

    return result.records.map((record) => record.get('c').properties);
  }

  /**
   * Close the driver and release all connections
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      console.log('Neo4j driver closed');
    }
  }

  /**
   * Check if driver is connected
   */
  isConnected(): boolean {
    return this.driver !== null;
  }
}

// Singleton instance
let neo4jClient: Neo4jClient | null = null;

/**
 * Get or create the Neo4j client singleton
 */
export function getNeo4jClient(): Neo4jClient {
  if (!neo4jClient) {
    const config: Neo4jConfig = {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USER || process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    };

    console.log('Neo4j config:', {
      uri: config.uri,
      username: config.username,
      password: config.password ? '***' : 'NOT SET'
    });

    neo4jClient = new Neo4jClient(config);
  }

  return neo4jClient;
}

/**
 * Initialize the Neo4j connection
 */
export async function initNeo4j(): Promise<void> {
  // Reset singleton only if not already connected
  if (neo4jClient && neo4jClient.isConnected()) {
    console.log('Neo4j already initialized');
    return;
  }
  
  // Reset singleton to pick up environment variables
  neo4jClient = null;
  const client = getNeo4jClient();
  await client.connect();
}

/**
 * Close the Neo4j connection
 */
export async function closeNeo4j(): Promise<void> {
  if (neo4jClient) {
    await neo4jClient.close();
    neo4jClient = null;
  }
}

export default Neo4jClient;
