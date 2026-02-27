/**
 * Agent Audit Logger - Comprehensive audit trail logging for all agent decisions
 */

import { getNeo4jClient } from '../utils/neo4j-client';
import crypto from 'crypto';
import neo4j from 'neo4j-driver';

export interface AuditLogEntry {
  decisionId: string;
  taskId: string;
  userId: string;
  timestamp: string;
  decisionType: 'agent_workflow' | 'policy_check' | 'transaction' | 'verification';
  verdict: 'approve' | 'reject' | 'escalate';
  reasoning: string;
  inputDataHash: string;
  outputAction: string;
  governanceVerdict?: string;
  toolCalls: ToolCallLog[];
  contextNodes: string[];
  policyNodes: string[];
}

export interface ToolCallLog {
  toolName: string;
  inputHash: string;
  outputHash: string;
  duration: number;
  success: boolean;
  timestamp: string;
  error?: string;
}

/**
 * Agent Audit Logger
 */
export class AgentAuditLogger {
  /**
   * Log agent decision to Neo4j audit trail
   */
  async logDecision(entry: AuditLogEntry): Promise<void> {
    try {
      console.log(`[AuditLogger] Logging decision: ${entry.decisionId}`);

      // Create Decision node
      await this.createDecisionNode(entry);

      // Link to User
      await this.linkToUser(entry.decisionId, entry.userId);

      // Link to Policy nodes
      for (const policyId of entry.policyNodes) {
        await this.linkToPolicy(entry.decisionId, policyId);
      }

      // Link to Context nodes
      for (const contextId of entry.contextNodes) {
        await this.linkToContext(entry.decisionId, contextId);
      }

      // Log tool calls
      for (const toolCall of entry.toolCalls) {
        await this.logToolCall(entry.decisionId, toolCall);
      }

      console.log(`[AuditLogger] Decision logged successfully: ${entry.decisionId}`);
    } catch (error) {
      console.error('[AuditLogger] Failed to log decision:', error);
      // Don't throw - logging failure shouldn't break workflow
    }
  }

  /**
   * Create Decision node in Neo4j
   */
  private async createDecisionNode(entry: AuditLogEntry): Promise<void> {
    const query = `
      CREATE (d:Decision {
        id: $decisionId,
        taskId: $taskId,
        timestamp: datetime($timestamp),
        type: $decisionType,
        verdict: $verdict,
        reasoning: $reasoning,
        inputDataHash: $inputDataHash,
        outputAction: $outputAction,
        governanceVerdict: $governanceVerdict,
        toolCallsJson: $toolCallsJson
      })
      RETURN d
    `;

    const client = getNeo4jClient();
    await client.executeQuery(query, {
      decisionId: entry.decisionId,
      taskId: entry.taskId,
      timestamp: entry.timestamp,
      decisionType: entry.decisionType,
      verdict: entry.verdict,
      reasoning: entry.reasoning,
      inputDataHash: entry.inputDataHash,
      outputAction: entry.outputAction,
      governanceVerdict: entry.governanceVerdict || '',
      toolCallsJson: JSON.stringify(entry.toolCalls)
    });
  }

  /**
   * Link Decision to User
   */
  private async linkToUser(decisionId: string, userId: string): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      MATCH (u:User {id: $userId})
      CREATE (u)-[:MADE_DECISION]->(d)
    `;

    const client = getNeo4jClient();
    await client.executeQuery(query, { decisionId, userId });
  }

  /**
   * Link Decision to Policy
   */
  private async linkToPolicy(decisionId: string, policyId: string): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      MATCH (p:Policy {id: $policyId})
      CREATE (d)-[:CHECKED_POLICY]->(p)
    `;

    const client = getNeo4jClient();
    await client.executeQuery(query, { decisionId, policyId });
  }

  /**
   * Link Decision to Context
   */
  private async linkToContext(decisionId: string, contextId: string): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      MATCH (c:Context {id: $contextId})
      CREATE (d)-[:USED_CONTEXT]->(c)
    `;

    const client = getNeo4jClient();
    await client.executeQuery(query, { decisionId, contextId });
  }

  /**
   * Log tool call as part of decision
   */
  private async logToolCall(decisionId: string, toolCall: ToolCallLog): Promise<void> {
    const query = `
      MATCH (d:Decision {id: $decisionId})
      CREATE (t:ToolCall {
        id: $toolCallId,
        toolName: $toolName,
        inputHash: $inputHash,
        outputHash: $outputHash,
        duration: $duration,
        success: $success,
        timestamp: datetime($timestamp),
        error: $error
      })
      CREATE (d)-[:CALLED_TOOL]->(t)
    `;

    const client = getNeo4jClient();
    await client.executeQuery(query, {
      decisionId,
      toolCallId: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      toolName: toolCall.toolName,
      inputHash: toolCall.inputHash,
      outputHash: toolCall.outputHash,
      duration: toolCall.duration,
      success: toolCall.success,
      timestamp: toolCall.timestamp,
      error: toolCall.error || ''
    });
  }

  /**
   * Query audit trail
   */
  async queryAuditTrail(filters: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    decisionType?: string;
    verdict?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = `
      MATCH (u:User)-[:MADE_DECISION]->(d:Decision)
    `;

    const params: any = {};
    const conditions: string[] = [];

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

    if (filters.verdict) {
      conditions.push('d.verdict = $verdict');
      params.verdict = filters.verdict;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      OPTIONAL MATCH (d)-[:CHECKED_POLICY]->(p:Policy)
      OPTIONAL MATCH (d)-[:USED_CONTEXT]->(c:Context)
      OPTIONAL MATCH (d)-[:CALLED_TOOL]->(t:ToolCall)
      RETURN d, u, collect(DISTINCT p) as policies, collect(DISTINCT c) as contexts, collect(DISTINCT t) as toolCalls
      ORDER BY d.timestamp DESC
      LIMIT $limit
    `;

    params.limit = neo4j.int(Math.floor(filters.limit || 50));

    const client = getNeo4jClient();
    const result = await client.executeQuery(query, params);
    return result.records.map(record => ({
      decision: record.get('d').properties,
      user: record.get('u').properties,
      policies: record.get('policies').map((p: any) => p.properties),
      contexts: record.get('contexts').map((c: any) => c.properties),
      toolCalls: record.get('toolCalls').map((t: any) => t.properties)
    }));
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
      OPTIONAL MATCH (d)-[:TRIGGERED_TX]->(tx:Transaction)
      OPTIONAL MATCH (d)-[:CALLED_TOOL]->(t:ToolCall)
      RETURN d, u, collect(DISTINCT p) as policies, collect(DISTINCT c) as contexts, tx, collect(DISTINCT t) as toolCalls
    `;

    const client = getNeo4jClient();
    const result = await client.executeQuery(query, { decisionId });
    
    if (result.records.length === 0) {
      return null;
    }
    
    const record = result.records[0];
    return {
      decision: record.get('d').properties,
      user: record.get('u')?.properties,
      policies: record.get('policies').map((p: any) => p.properties),
      contexts: record.get('contexts').map((c: any) => c.properties),
      transaction: record.get('tx')?.properties,
      toolCalls: record.get('toolCalls').map((t: any) => t.properties)
    };
  }

  /**
   * Create audit log entry from workflow result
   */
  createAuditEntry(
    taskId: string,
    userId: string,
    verdict: 'approve' | 'reject' | 'escalate',
    reasoning: string,
    toolCalls: any[],
    policyNodes: string[] = [],
    contextNodes: string[] = []
  ): AuditLogEntry {
    const decisionId = `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Hash input data
    const inputDataHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(toolCalls.map(tc => tc.input)))
      .digest('hex');

    // Determine output action
    const outputAction = verdict === 'approve' ? 'transaction_executed' : 'transaction_rejected';

    // Convert tool calls to log format
    const toolCallLogs: ToolCallLog[] = toolCalls.map(tc => ({
      toolName: tc.toolName,
      inputHash: crypto.createHash('sha256').update(JSON.stringify(tc.input)).digest('hex'),
      outputHash: crypto.createHash('sha256').update(JSON.stringify(tc.output)).digest('hex'),
      duration: tc.duration,
      success: tc.success,
      timestamp: tc.timestamp || timestamp,
      error: tc.error
    }));

    return {
      decisionId,
      taskId,
      userId,
      timestamp,
      decisionType: 'agent_workflow',
      verdict,
      reasoning,
      inputDataHash,
      outputAction,
      governanceVerdict: verdict,
      toolCalls: toolCallLogs,
      contextNodes,
      policyNodes
    };
  }

  /**
   * Get audit trail statistics
   */
  async getAuditStats(userId?: string): Promise<{
    totalDecisions: number;
    approvedDecisions: number;
    rejectedDecisions: number;
    escalatedDecisions: number;
    averageToolCalls: number;
    mostUsedTools: Array<{ tool: string; count: number }>;
  }> {
    const query = `
      MATCH (d:Decision)
      ${userId ? 'MATCH (u:User {id: $userId})-[:MADE_DECISION]->(d)' : ''}
      OPTIONAL MATCH (d)-[:CALLED_TOOL]->(t:ToolCall)
      RETURN 
        count(DISTINCT d) as totalDecisions,
        sum(CASE WHEN d.verdict = 'approve' THEN 1 ELSE 0 END) as approvedDecisions,
        sum(CASE WHEN d.verdict = 'reject' THEN 1 ELSE 0 END) as rejectedDecisions,
        sum(CASE WHEN d.verdict = 'escalate' THEN 1 ELSE 0 END) as escalatedDecisions,
        avg(size(collect(DISTINCT t))) as averageToolCalls,
        collect(t.toolName) as allTools
    `;

    const params = userId ? { userId } : {};
    const client = getNeo4jClient();
    const result = await client.executeQuery(query, params);

    if (result.records.length === 0) {
      return {
        totalDecisions: 0,
        approvedDecisions: 0,
        rejectedDecisions: 0,
        escalatedDecisions: 0,
        averageToolCalls: 0,
        mostUsedTools: []
      };
    }

    const record = result.records[0];
    const stats = {
      totalDecisions: record.get('totalDecisions').toNumber(),
      approvedDecisions: record.get('approvedDecisions').toNumber(),
      rejectedDecisions: record.get('rejectedDecisions').toNumber(),
      escalatedDecisions: record.get('escalatedDecisions').toNumber(),
      averageToolCalls: record.get('averageToolCalls') || 0,
      allTools: record.get('allTools')
    };

    // Count tool usage
    const toolCounts = new Map<string, number>();
    for (const tool of stats.allTools || []) {
      if (tool) {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      }
    }

    const mostUsedTools = Array.from(toolCounts.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalDecisions: stats.totalDecisions,
      approvedDecisions: stats.approvedDecisions,
      rejectedDecisions: stats.rejectedDecisions,
      escalatedDecisions: stats.escalatedDecisions,
      averageToolCalls: stats.averageToolCalls,
      mostUsedTools
    };
  }
}

/**
 * Global audit logger instance
 */
export const globalAuditLogger = new AgentAuditLogger();
