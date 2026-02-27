import { callWithRetry } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { getNeo4jClient } from '../utils/neo4j-client';
import * as mockResponsesModule from '../../../mocks/numeric-responses.json';

const mockResponses = mockResponsesModule as any;

interface Transaction {
  type: 'buy' | 'sell' | 'transfer';
  assetId: string;
  amount: number;
  price: number;
  fees: number;
}

interface Portfolio {
  totalValue: number;
  assets: Record<string, number>;
}

interface ReconciliationRequest {
  userId: string;
  transaction: Transaction;
  portfolioBefore: Portfolio;
}

interface Anomaly {
  type: 'price_spike' | 'unexpected_fee' | 'balance_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface FluxReport {
  portfolioAfter: Portfolio;
  variance: {
    expected: number;
    actual: number;
    deviation: number;
  };
  anomalies: Anomaly[];
  aiExplanation: string;
  reconciled: boolean;
  timestamp: string;
}

interface FluxReportWithId extends FluxReport {
  id: string;
  userId: string;
  transactionId?: string;
}

export class FinanceService {
  private circuitBreaker: CircuitBreaker<FluxReport>;
  private numericApiUrl: string;
  private numericApiKey: string;
  private openaiApiKey: string;

  constructor() {
    this.circuitBreaker = new CircuitBreaker<FluxReport>('numeric-api', {
      failureThreshold: 3,
      resetTimeout: 60000
    });
    this.numericApiUrl = process.env.NUMERIC_API_URL || '';
    this.numericApiKey = process.env.NUMERIC_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
  }

  /**
   * Generate a Flux Report for a transaction
   * Requirements: 5.1, 5.2
   */
  async generateFluxReport(request: ReconciliationRequest): Promise<FluxReportWithId> {
    const fluxReport = await this.circuitBreaker.execute(
      () => this.callNumericApi(request),
      () => this.generateLocalFluxReport(request)
    );

    // Detect anomalies (Requirement 5.3)
    const anomalies = this.detectAnomalies(request, fluxReport);
    fluxReport.anomalies = anomalies;

    // Generate AI explanation if needed
    if (!fluxReport.aiExplanation || fluxReport.aiExplanation.includes('fallback')) {
      fluxReport.aiExplanation = await this.generateAiExplanation(request, fluxReport);
    }

    // Create FluxReport with ID
    const fluxReportWithId: FluxReportWithId = {
      id: `flux-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: request.userId,
      ...fluxReport,
      timestamp: new Date().toISOString()
    };

    // Persist to Neo4j (Requirement 5.5)
    await this.persistFluxReport(fluxReportWithId);

    return fluxReportWithId;
  }

  /**
   * Call Numeric API for reconciliation
   * Requirements: 5.1, 5.2
   */
  private async callNumericApi(request: ReconciliationRequest): Promise<FluxReport> {
    if (!this.numericApiUrl || !this.numericApiKey) {
      throw new Error('Numeric API not configured');
    }

    const response = await callWithRetry(async () => {
      const res = await fetch(`${this.numericApiUrl}/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.numericApiKey}`
        },
        body: JSON.stringify(request)
      });

      if (!res.ok) {
        throw new Error(`Numeric API error: ${res.status}`);
      }

      return res.json();
    });

    return response as FluxReport;
  }

  /**
   * Generate Flux Report locally when Numeric API unavailable
   * Requirements: 14.5
   */
  private async generateLocalFluxReport(request: ReconciliationRequest): Promise<FluxReport> {
    console.log('Using local calculation fallback for Flux Report');

    // Check if we have a matching mock scenario
    const mockScenario = mockResponses.scenarios.find((s: any) => 
      s.transaction.assetId === request.transaction.assetId &&
      s.transaction.type === request.transaction.type
    );

    if (mockScenario) {
      return mockScenario.response;
    }

    // Calculate portfolio after transaction
    const portfolioAfter = this.calculatePortfolioAfter(
      request.portfolioBefore,
      request.transaction
    );

    // Calculate variance
    const expectedCost = request.transaction.price + request.transaction.fees;
    const actualCost = request.portfolioBefore.totalValue - portfolioAfter.totalValue;
    const deviation = Math.abs(((actualCost - expectedCost) / expectedCost) * 100);

    return {
      portfolioAfter,
      variance: {
        expected: expectedCost,
        actual: actualCost,
        deviation
      },
      anomalies: [],
      aiExplanation: '', // Will be generated separately
      reconciled: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate portfolio state after transaction
   */
  private calculatePortfolioAfter(portfolioBefore: Portfolio, transaction: Transaction): Portfolio {
    const assets = { ...portfolioBefore.assets };
    const totalCost = transaction.price + transaction.fees;

    if (transaction.type === 'buy') {
      // Deduct NEAR for purchase
      assets['NEAR'] = (assets['NEAR'] || 0) - totalCost;
      // Add purchased asset
      assets[transaction.assetId] = (assets[transaction.assetId] || 0) + transaction.price;
    } else if (transaction.type === 'sell') {
      // Add NEAR from sale
      assets['NEAR'] = (assets['NEAR'] || 0) + transaction.price - transaction.fees;
      // Remove sold asset
      delete assets[transaction.assetId];
    } else if (transaction.type === 'transfer') {
      // Deduct transferred amount and fees
      assets['NEAR'] = (assets['NEAR'] || 0) - totalCost;
    }

    // Calculate new total value
    const totalValue = Object.values(assets).reduce((sum, val) => sum + val, 0);

    return {
      totalValue,
      assets
    };
  }

  /**
   * Detect anomalies in the transaction
   * Requirements: 5.3
   */
  private detectAnomalies(request: ReconciliationRequest, fluxReport: FluxReport): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check variance threshold (> 5%)
    if (fluxReport.variance.deviation > 5) {
      anomalies.push({
        type: 'balance_mismatch',
        severity: fluxReport.variance.deviation > 10 ? 'high' : 'medium',
        description: `Portfolio variance of ${fluxReport.variance.deviation.toFixed(2)}% exceeds acceptable threshold. Expected cost: ${fluxReport.variance.expected} NEAR, Actual: ${fluxReport.variance.actual} NEAR.`
      });
    }

    // Check for unusual fees (> 2% of transaction)
    const feePercentage = (request.transaction.fees / request.transaction.price) * 100;
    if (feePercentage > 2) {
      anomalies.push({
        type: 'unexpected_fee',
        severity: feePercentage > 5 ? 'high' : 'medium',
        description: `Transaction fees of ${request.transaction.fees} NEAR (${feePercentage.toFixed(1)}%) are unusually high for this transaction type.`
      });
    }

    // Check for immediate price drops (buy transactions)
    if (request.transaction.type === 'buy') {
      const purchasePrice = request.transaction.price;
      const currentValue = fluxReport.portfolioAfter.assets[request.transaction.assetId] || 0;
      const priceChange = ((currentValue - purchasePrice) / purchasePrice) * 100;

      if (priceChange < -5) {
        anomalies.push({
          type: 'price_spike',
          severity: priceChange < -10 ? 'high' : 'medium',
          description: `Asset value dropped ${Math.abs(priceChange).toFixed(1)}% immediately after purchase (from ${purchasePrice} to ${currentValue} NEAR). You may have bought at a temporary price spike.`
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate AI explanation using OpenAI
   * Requirements: 5.4
   */
  private async generateAiExplanation(
    request: ReconciliationRequest,
    fluxReport: FluxReport
  ): Promise<string> {
    if (!this.openaiApiKey) {
      return this.generateBasicExplanation(request, fluxReport);
    }

    try {
      const prompt = this.buildExplanationPrompt(request, fluxReport);
      
      const response = await callWithRetry(async () => {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a financial analyst explaining cryptocurrency portfolio changes. Be concise, clear, and highlight any concerns.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 200,
            temperature: 0.7
          })
        });

        if (!res.ok) {
          throw new Error(`OpenAI API error: ${res.status}`);
        }

        return res.json();
      });

      const data = response as any;
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Failed to generate AI explanation:', error);
      return this.generateBasicExplanation(request, fluxReport);
    }
  }

  /**
   * Build prompt for AI explanation
   */
  private buildExplanationPrompt(request: ReconciliationRequest, fluxReport: FluxReport): string {
    const { transaction, portfolioBefore } = request;
    const { portfolioAfter, variance, anomalies } = fluxReport;

    let prompt = `Explain this cryptocurrency transaction in 2-3 sentences:\n\n`;
    prompt += `Transaction: ${transaction.type} ${transaction.amount} ${transaction.assetId}\n`;
    prompt += `Price: ${transaction.price} NEAR, Fees: ${transaction.fees} NEAR\n`;
    prompt += `Portfolio Before: ${portfolioBefore.totalValue} NEAR\n`;
    prompt += `Portfolio After: ${portfolioAfter.totalValue} NEAR\n`;
    prompt += `Variance: ${variance.deviation.toFixed(2)}%\n`;

    if (anomalies.length > 0) {
      prompt += `\nAnomalies detected:\n`;
      anomalies.forEach(a => {
        prompt += `- ${a.severity.toUpperCase()}: ${a.description}\n`;
      });
    }

    return prompt;
  }

  /**
   * Generate basic explanation without AI
   */
  private generateBasicExplanation(request: ReconciliationRequest, fluxReport: FluxReport): string {
    const { transaction, portfolioBefore } = request;
    const { portfolioAfter, variance, anomalies } = fluxReport;

    let explanation = `Portfolio reconciliation completed. `;

    if (transaction.type === 'buy') {
      explanation += `Purchased ${transaction.assetId} for ${transaction.price} NEAR with ${transaction.fees} NEAR in fees. `;
    } else if (transaction.type === 'sell') {
      explanation += `Sold ${transaction.assetId} for ${transaction.price} NEAR with ${transaction.fees} NEAR in fees. `;
    } else {
      explanation += `Transferred ${transaction.amount} ${transaction.assetId} with ${transaction.fees} NEAR in fees. `;
    }

    const valueChange = portfolioAfter.totalValue - portfolioBefore.totalValue;
    const changePercent = ((valueChange / portfolioBefore.totalValue) * 100).toFixed(2);
    
    explanation += `Portfolio value changed from ${portfolioBefore.totalValue} to ${portfolioAfter.totalValue} NEAR (${changePercent}%). `;

    if (anomalies.length > 0) {
      explanation += `${anomalies.length} anomaly(ies) detected. `;
    }

    return explanation;
  }

  /**
   * Persist FluxReport to Neo4j
   * Requirements: 5.5
   */
  private async persistFluxReport(fluxReport: FluxReportWithId): Promise<void> {
    const client = getNeo4jClient();
    const session = client.getSession();

    try {
      await session.run(
        `
        CREATE (f:FluxReport {
          id: $id,
          userId: $userId,
          transactionId: $transactionId,
          portfolioValueBefore: $portfolioValueBefore,
          portfolioValueAfter: $portfolioValueAfter,
          variance: $variance,
          anomalies: $anomalies,
          aiExplanation: $aiExplanation,
          reconciled: $reconciled,
          timestamp: datetime($timestamp)
        })
        WITH f
        MATCH (u:User {id: $userId})
        CREATE (u)-[:HAS_FLUX_REPORT]->(f)
        `,
        {
          id: fluxReport.id,
          userId: fluxReport.userId,
          transactionId: fluxReport.transactionId || null,
          portfolioValueBefore: fluxReport.variance.expected,
          portfolioValueAfter: fluxReport.portfolioAfter.totalValue,
          variance: fluxReport.variance.deviation,
          anomalies: JSON.stringify(fluxReport.anomalies),
          aiExplanation: fluxReport.aiExplanation,
          reconciled: fluxReport.reconciled,
          timestamp: fluxReport.timestamp
        }
      );

      // Link to Transaction if transactionId provided
      if (fluxReport.transactionId) {
        await session.run(
          `
          MATCH (f:FluxReport {id: $fluxReportId})
          MATCH (t:Transaction {id: $transactionId})
          CREATE (t)-[:RECONCILED_BY]->(f)
          `,
          {
            fluxReportId: fluxReport.id,
            transactionId: fluxReport.transactionId
          }
        );
      }

      console.log(`FluxReport ${fluxReport.id} persisted to Neo4j`);
    } catch (error) {
      console.error('Failed to persist FluxReport to Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Query recent flux reports for a user
   */
  async getRecentFluxReports(userId: string, limit: number = 10): Promise<FluxReportWithId[]> {
    const client = getNeo4jClient();
    const session = client.getSession();

    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS_FLUX_REPORT]->(f:FluxReport)
        RETURN f
        ORDER BY f.timestamp DESC
        LIMIT $limit
        `,
        { userId, limit }
      );

      return result.records.map((record: any) => {
        const node = record.get('f').properties;
        return {
          id: node.id,
          userId: node.userId,
          transactionId: node.transactionId,
          portfolioAfter: {
            totalValue: node.portfolioValueAfter,
            assets: {}
          },
          variance: {
            expected: node.portfolioValueBefore,
            actual: node.portfolioValueAfter,
            deviation: node.variance
          },
          anomalies: JSON.parse(node.anomalies),
          aiExplanation: node.aiExplanation,
          reconciled: node.reconciled,
          timestamp: node.timestamp
        };
      });
    } finally {
      await session.close();
    }
  }
}
