import { getNeo4jClient } from '../utils/neo4j-client';
import { PolicyCheckRequest, PolicyCheckResult } from '../types';
import crypto from 'crypto';

/**
 * GovernanceService - Policy checking and audit trail management
 * Implements governance logic for FORGE agent decisions
 */

interface Policy {
  id: string;
  userId: string;
  type: string;
  threshold: number;
  description: string;
  active: boolean;
  enforcementLevel: 'warning' | 'blocking';
}

interface TransactionPattern {
  pattern: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface DecisionData {
  id: string;
  taskId: string;
  userId: string;
  type: string;
  verdict: 'approve' | 'reject' | 'escalate';
  reasoning: string;
  toolCalls: any[];
  inputData: any;
  checkedPolicyIds: string[];
  contextIds?: string[];
  transactionId?: string;
}

interface AuditTrailQuery {
  userId?: string;
  startDate?: string;
  endDate?: string;
  decisionType?: string;
  limit?: number;
}

interface AuditTrailResult {
  user: any;
  decision: any;
  policies: any[];
  contexts?: any[];
  transaction?: any;
}

export class GovernanceService {
  private get neo4jClient() {
    return getNeo4jClient();
  }

  /**
   * Check policies for a transaction
   * Requirements: 4.1, 4.2, 4.3, 12.4
   */
  async checkPolicies(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
    try {
      // Handle policy-reject scenario - force policy violation
      if (request.scenario === 'policy-reject') {
        return {
          approved: false,
          violatedPolicies: [
            {
              policyId: 'policy-max-transaction',
              ruleName: 'max_transaction_amount',
              threshold: 50,
              actualValue: request.transaction.amount,
              severity: 'blocking',
            },
          ],
          appliedPolicies: ['policy-max-transaction', 'policy-risk-tolerance'],
          reasoning: `Transaction amount of ${request.transaction.amount} NEAR exceeds maximum allowed limit of 50 NEAR. This violates the max_transaction_amount policy. Transaction blocked for compliance.`,
        };
      }

      // Retrieve user policies from Neo4j
      const policies = await this.neo4jClient.getUserPolicies(request.userId);

      if (policies.length === 0) {
        return {
          approved: false,
          violatedPolicies: [],
          appliedPolicies: [],
          reasoning: 'No policies found for user. At least one risk threshold must exist.',
        };
      }

      const violatedPolicies: PolicyCheckResult['violatedPolicies'] = [];
      const appliedPolicies: string[] = [];

      // Check each policy rule
      for (const policy of policies) {
        appliedPolicies.push(policy.id);

        const violation = this.checkPolicyRule(policy, request);
        if (violation) {
          violatedPolicies.push(violation);
        }
      }

      // Check for transaction patterns
      const patterns = await this.detectPatterns(request.userId, request.transaction);
      for (const pattern of patterns) {
        if (pattern.severity === 'high') {
          violatedPolicies.push({
            policyId: 'pattern-detection',
            ruleName: pattern.pattern,
            threshold: 0,
            actualValue: pattern.count,
            severity: 'blocking',
          });
        }
      }

      // Determine approval based on blocking violations
      const blockingViolations = violatedPolicies.filter(
        (v) => v.severity === 'blocking'
      );
      const approved = blockingViolations.length === 0;

      // Generate reasoning
      const reasoning = this.generateReasoning(
        approved,
        violatedPolicies,
        appliedPolicies.length,
        patterns
      );

      return {
        approved,
        violatedPolicies,
        appliedPolicies,
        reasoning,
      };
    } catch (error) {
      console.error('Policy check failed:', error);
      throw new Error(`Policy check failed: ${error}`);
    }
  }

  /**
   * Check a single policy rule against transaction
   */
  private checkPolicyRule(
    policy: Policy,
    request: PolicyCheckRequest
  ): PolicyCheckResult['violatedPolicies'][0] | null {
    const { transaction, context } = request;

    switch (policy.type) {
      case 'max_transaction_percent': {
        // Check if transaction amount exceeds percentage of portfolio
        const transactionPercent = transaction.amount / context.currentPortfolioValue;
        if (transactionPercent > policy.threshold) {
          return {
            policyId: policy.id,
            ruleName: policy.description,
            threshold: policy.threshold,
            actualValue: transactionPercent,
            severity: policy.enforcementLevel,
          };
        }
        break;
      }

      case 'max_daily_transactions': {
        // Check if daily transaction count exceeds limit
        if (context.recentTransactionCount >= policy.threshold) {
          return {
            policyId: policy.id,
            ruleName: policy.description,
            threshold: policy.threshold,
            actualValue: context.recentTransactionCount,
            severity: policy.enforcementLevel,
          };
        }
        break;
      }

      case 'blacklist_seller': {
        // Check if seller is blacklisted (threshold stores blacklisted seller count)
        if (transaction.seller && policy.threshold > 0) {
          // In a real implementation, we'd check against a blacklist
          // For POC, we assume threshold > 0 means seller restrictions exist
          return {
            policyId: policy.id,
            ruleName: policy.description,
            threshold: policy.threshold,
            actualValue: 1,
            severity: policy.enforcementLevel,
          };
        }
        break;
      }

      case 'min_confidence_score': {
        // This would be checked with verification context
        // Placeholder for integration with VerificationService
        break;
      }

      default:
        console.warn(`Unknown policy type: ${policy.type}`);
    }

    return null;
  }

  /**
   * Detect patterns in transaction history
   * Requirement: 4.4
   */
  async detectPatterns(
    userId: string,
    transaction: PolicyCheckRequest['transaction']
  ): Promise<TransactionPattern[]> {
    try {
      const patterns: TransactionPattern[] = [];

      // Query recent transactions (last 24 hours)
      const query = `
        MATCH (u:User {id: $userId})-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)
        WHERE d.timestamp > datetime() - duration('PT24H')
        RETURN t, d
        ORDER BY d.timestamp DESC
      `;

      const result = await this.neo4jClient.executeRead(query, { userId });
      const recentTransactions = result.records.map((record) => ({
        transaction: record.get('t').properties,
        decision: record.get('d').properties,
      }));

      // Pattern 1: Multiple purchases from same seller
      if (transaction.seller) {
        const sameSeller = recentTransactions.filter(
          (rt) => rt.transaction.seller === transaction.seller
        );

        if (sameSeller.length >= 3) {
          patterns.push({
            pattern: 'multiple_purchases_same_seller',
            count: sameSeller.length,
            severity: 'high',
            description: `${sameSeller.length} purchases from seller ${transaction.seller} in last 24 hours`,
          });
        } else if (sameSeller.length >= 2) {
          patterns.push({
            pattern: 'multiple_purchases_same_seller',
            count: sameSeller.length,
            severity: 'medium',
            description: `${sameSeller.length} purchases from seller ${transaction.seller} in last 24 hours`,
          });
        }
      }

      // Pattern 2: Rapid transaction frequency
      if (recentTransactions.length >= 5) {
        patterns.push({
          pattern: 'high_frequency_trading',
          count: recentTransactions.length,
          severity: 'medium',
          description: `${recentTransactions.length} transactions in last 24 hours`,
        });
      }

      // Pattern 3: Same asset type concentration
      const sameAssetType = recentTransactions.filter(
        (rt) => rt.transaction.assetType === transaction.assetType
      );

      if (sameAssetType.length >= 4) {
        patterns.push({
          pattern: 'asset_type_concentration',
          count: sameAssetType.length,
          severity: 'low',
          description: `${sameAssetType.length} ${transaction.assetType} transactions in last 24 hours`,
        });
      }

      return patterns;
    } catch (error) {
      console.error('Pattern detection failed:', error);
      // Return empty patterns on error to not block transaction
      return [];
    }
  }

  /**
   * Generate reasoning explanation for verdict
   */
  private generateReasoning(
    approved: boolean,
    violations: PolicyCheckResult['violatedPolicies'],
    policiesChecked: number,
    patterns: TransactionPattern[]
  ): string {
    if (approved) {
      let reasoning = `Transaction approved. Checked ${policiesChecked} policies with no blocking violations.`;

      if (violations.length > 0) {
        const warnings = violations.filter((v) => v.severity === 'warning');
        if (warnings.length > 0) {
          reasoning += ` ${warnings.length} warning(s) detected: ${warnings
            .map((w) => w.ruleName)
            .join(', ')}.`;
        }
      }

      if (patterns.length > 0) {
        const lowPatterns = patterns.filter((p) => p.severity === 'low' || p.severity === 'medium');
        if (lowPatterns.length > 0) {
          reasoning += ` Detected patterns: ${lowPatterns
            .map((p) => p.description)
            .join('; ')}.`;
        }
      }

      return reasoning;
    } else {
      const blockingViolations = violations.filter((v) => v.severity === 'blocking');
      const reasons = blockingViolations.map(
        (v) =>
          `${v.ruleName} (threshold: ${v.threshold}, actual: ${v.actualValue.toFixed(4)})`
      );

      return `Transaction rejected due to ${blockingViolations.length} policy violation(s): ${reasons.join('; ')}.`;
    }
  }

  /**
   * Create Decision node with policy links
   * Requirements: 4.5, 7.1, 7.2
   */
  async createDecision(data: DecisionData): Promise<void> {
    try {
      // Generate input data hash for audit trail
      const inputDataHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(data.inputData))
        .digest('hex');

      // Create decision node with relationships
      await this.neo4jClient.createDecision({
        id: data.id,
        taskId: data.taskId,
        userId: data.userId,
        type: data.type,
        verdict: data.verdict,
        reasoning: data.reasoning,
        toolCallsJson: JSON.stringify(data.toolCalls),
        inputDataHash,
        checkedPolicyIds: data.checkedPolicyIds,
      });

      // Link to context nodes if provided
      if (data.contextIds && data.contextIds.length > 0) {
        await this.linkContextNodes(data.id, data.contextIds);
      }

      // Link to transaction node if provided
      if (data.transactionId) {
        await this.linkTransactionNode(data.id, data.transactionId);
      }

      console.log(`Decision node created: ${data.id}`);
    } catch (error) {
      console.error('Failed to create decision node:', error);
      throw new Error(`Decision creation failed: ${error}`);
    }
  }

  /**
   * Link decision to context nodes
   */
  private async linkContextNodes(decisionId: string, contextIds: string[]): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      UNWIND $contextIds AS contextId
      MATCH (c:Context {id: contextId})
      CREATE (d)-[:USED_CONTEXT]->(c)
    `;

    await this.neo4jClient.executeWrite(query, { decisionId, contextIds });
  }

  /**
   * Link decision to transaction node
   */
  private async linkTransactionNode(decisionId: string, transactionId: string): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      MATCH (t:Transaction {id: $transactionId})
      CREATE (d)-[:TRIGGERED_TX]->(t)
    `;

    await this.neo4jClient.executeWrite(query, { decisionId, transactionId });
  }

  /**
   * Query audit trail with filters
   * Requirements: 7.4, 12.3
   */
  async queryAuditTrail(filters: AuditTrailQuery): Promise<AuditTrailResult[]> {
    try {
      // Use the helper function from neo4j-client
      const results = await this.neo4jClient.queryAuditTrail(filters);

      // Enhance with additional relationships if needed
      const enhancedResults: AuditTrailResult[] = [];

      for (const result of results) {
        const enhanced: AuditTrailResult = {
          user: result.user,
          decision: result.decision,
          policies: result.policies,
        };

        // Fetch context nodes for this decision
        const contexts = await this.getDecisionContexts(result.decision.id);
        if (contexts.length > 0) {
          enhanced.contexts = contexts;
        }

        // Fetch transaction for this decision
        const transaction = await this.getDecisionTransaction(result.decision.id);
        if (transaction) {
          enhanced.transaction = transaction;
        }

        enhancedResults.push(enhanced);
      }

      return enhancedResults;
    } catch (error) {
      console.error('Audit trail query failed:', error);
      throw new Error(`Audit trail query failed: ${error}`);
    }
  }

  /**
   * Get context nodes linked to a decision
   */
  private async getDecisionContexts(decisionId: string): Promise<any[]> {
    const query = `
      MATCH (d:Decision {id: $decisionId})-[:USED_CONTEXT]->(c:Context)
      RETURN c
    `;

    const result = await this.neo4jClient.executeRead(query, { decisionId });
    return result.records.map((record) => record.get('c').properties);
  }

  /**
   * Get transaction linked to a decision
   */
  private async getDecisionTransaction(decisionId: string): Promise<any | null> {
    const query = `
      MATCH (d:Decision {id: $decisionId})-[:TRIGGERED_TX]->(t:Transaction)
      RETURN t
    `;

    const result = await this.neo4jClient.executeRead(query, { decisionId });

    if (result.records.length === 0) {
      return null;
    }

    return result.records[0].get('t').properties;
  }

  /**
   * Execute custom Cypher query
   * Requirement: 12.3
   */
  async executeCypherQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
    try {
      // Log incoming parameters for debugging
      console.log('[GovernanceService] Executing Cypher query with params:', JSON.stringify(params));
      
      // Convert any numeric parameters that might be used in LIMIT clauses to integers
      const sanitizedParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'number') {
          // Ensure all numeric parameters are integers (especially for LIMIT)
          sanitizedParams[key] = Math.floor(value);
          console.log(`[GovernanceService] Converted ${key}: ${value} -> ${sanitizedParams[key]}`);
        } else {
          sanitizedParams[key] = value;
        }
      }

      console.log('[GovernanceService] Sanitized params:', JSON.stringify(sanitizedParams));

      const result = await this.neo4jClient.executeRead(query, sanitizedParams);

      // Convert records to plain objects
      return result.records.map((record) => {
        const obj: Record<string, any> = {};
        for (const key of record.keys) {
          const keyStr = String(key);
          const value = record.get(key);
          // Handle Neo4j node/relationship objects
          if (value && typeof value === 'object' && 'properties' in value) {
            obj[keyStr] = value.properties;
          } else {
            obj[keyStr] = value;
          }
        }
        return obj;
      });
    } catch (error) {
      console.error('Cypher query execution failed:', error);
      throw new Error(`Cypher query failed: ${error}`);
    }
  }

  /**
   * Get decision provenance (full relationship graph)
   */
  async getDecisionProvenance(decisionId: string): Promise<any> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      OPTIONAL MATCH (u:User)-[:MADE_DECISION]->(d)
      OPTIONAL MATCH (d)-[:CHECKED_POLICY]->(p:Policy)
      OPTIONAL MATCH (d)-[:USED_CONTEXT]->(c:Context)
      OPTIONAL MATCH (d)-[:TRIGGERED_TX]->(t:Transaction)
      RETURN u, d, collect(DISTINCT p) as policies, collect(DISTINCT c) as contexts, t
    `;

    const result = await this.neo4jClient.executeRead(query, { decisionId });

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      user: record.get('u')?.properties || null,
      decision: record.get('d').properties,
      policies: record.get('policies').map((p: any) => p.properties).filter(Boolean),
      contexts: record.get('contexts').map((c: any) => c.properties).filter(Boolean),
      transaction: record.get('t')?.properties || null,
    };
  }
}

export default GovernanceService;
