/**
 * Agent Error Handler - Graceful error handling and workflow halting
 */

import { getNeo4jClient } from '../utils/neo4j-client';

export interface AgentError {
  code: string;
  message: string;
  component: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  timestamp: string;
  stackTrace?: string;
  context?: any;
}

export interface ErrorRecoveryStrategy {
  action: 'retry' | 'fallback' | 'skip' | 'halt';
  maxRetries?: number;
  fallbackData?: any;
  reason: string;
}

/**
 * Agent Error Handler
 */
export class AgentErrorHandler {
  private errorLog: AgentError[] = [];

  /**
   * Handle tool execution error
   */
  async handleToolError(
    toolName: string,
    error: Error,
    context: any
  ): Promise<ErrorRecoveryStrategy> {
    const agentError: AgentError = {
      code: this.getErrorCode(toolName, error),
      message: error.message,
      component: toolName,
      severity: this.getErrorSeverity(toolName, error),
      recoverable: this.isRecoverable(toolName, error),
      timestamp: new Date().toISOString(),
      stackTrace: error.stack,
      context
    };

    this.errorLog.push(agentError);

    // Log to Neo4j
    await this.logErrorToNeo4j(agentError);

    // Determine recovery strategy
    return this.getRecoveryStrategy(agentError);
  }

  /**
   * Handle workflow halt
   */
  async haltWorkflow(
    reason: string,
    userId: string,
    taskId: string
  ): Promise<void> {
    console.error(`[ErrorHandler] Halting workflow: ${reason}`);

    const haltError: AgentError = {
      code: 'WORKFLOW_HALTED',
      message: reason,
      component: 'workflow',
      severity: 'critical',
      recoverable: false,
      timestamp: new Date().toISOString()
    };

    this.errorLog.push(haltError);

    // Log halt to Neo4j
    await this.logWorkflowHalt(userId, taskId, reason);
  }

  /**
   * Get structured error response
   */
  getStructuredErrorResponse(error: AgentError): {
    error_code: string;
    message: string;
    timestamp: string;
    recovery_action: string;
    severity: string;
  } {
    const strategy = this.getRecoveryStrategy(error);

    return {
      error_code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      recovery_action: this.getRecoveryActionMessage(strategy),
      severity: error.severity
    };
  }

  /**
   * Get error code based on tool and error type
   */
  private getErrorCode(toolName: string, error: Error): string {
    const errorType = error.name || 'Error';
    return `${toolName.toUpperCase()}_${errorType.toUpperCase()}`;
  }

  /**
   * Determine error severity
   */
  private getErrorSeverity(toolName: string, error: Error): 'low' | 'medium' | 'high' | 'critical' {
    // Critical tools
    if (['neo4j_policy', 'mock_wallet_execute'].includes(toolName)) {
      return 'critical';
    }

    // High severity for verification failures
    if (toolName === 'senso_verify' && error.message.includes('high risk')) {
      return 'high';
    }

    // Medium severity for search failures
    if (['tavily_search', 'yutori_scout'].includes(toolName)) {
      return 'medium';
    }

    // Low severity for reconciliation issues
    if (toolName === 'numeric_reconcile') {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(toolName: string, error: Error): boolean {
    // Network errors are recoverable
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      return true;
    }

    // API rate limits are recoverable
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return true;
    }

    // Critical tool failures are not recoverable
    if (['neo4j_policy', 'mock_wallet_execute'].includes(toolName)) {
      return false;
    }

    // Most other errors are recoverable with fallback
    return true;
  }

  /**
   * Get recovery strategy for error
   */
  private getRecoveryStrategy(error: AgentError): ErrorRecoveryStrategy {
    // Critical errors - halt immediately
    if (error.severity === 'critical') {
      return {
        action: 'halt',
        reason: 'Critical component failure - cannot continue safely'
      };
    }

    // Network/timeout errors - retry
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      return {
        action: 'retry',
        maxRetries: 2,
        reason: 'Network error - retrying with exponential backoff'
      };
    }

    // Rate limit errors - retry with delay
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return {
        action: 'retry',
        maxRetries: 1,
        reason: 'Rate limit exceeded - waiting before retry'
      };
    }

    // Search failures - use fallback data
    if (['tavily_search', 'yutori_scout'].includes(error.component)) {
      return {
        action: 'fallback',
        fallbackData: 'mock',
        reason: 'Search API unavailable - using mock data'
      };
    }

    // Verification failures - use hardcoded floor prices
    if (error.component === 'senso_verify') {
      return {
        action: 'fallback',
        fallbackData: 'hardcoded',
        reason: 'Verification API unavailable - using hardcoded floor prices'
      };
    }

    // Reconciliation failures - use local calculation
    if (error.component === 'numeric_reconcile') {
      return {
        action: 'fallback',
        fallbackData: 'local',
        reason: 'Reconciliation API unavailable - using local calculation'
      };
    }

    // Default - skip non-critical step
    return {
      action: 'skip',
      reason: 'Non-critical step failed - continuing workflow'
    };
  }

  /**
   * Get recovery action message for user
   */
  private getRecoveryActionMessage(strategy: ErrorRecoveryStrategy): string {
    switch (strategy.action) {
      case 'retry':
        return `Retrying operation (max ${strategy.maxRetries} attempts)`;
      case 'fallback':
        return `Using fallback data: ${strategy.fallbackData}`;
      case 'skip':
        return 'Skipping non-critical step and continuing';
      case 'halt':
        return 'Workflow halted - manual intervention required';
      default:
        return 'Unknown recovery action';
    }
  }

  /**
   * Log error to Neo4j
   */
  private async logErrorToNeo4j(error: AgentError): Promise<void> {
    try {
      const query = `
        CREATE (e:Error {
          code: $code,
          message: $message,
          component: $component,
          severity: $severity,
          recoverable: $recoverable,
          timestamp: datetime($timestamp),
          stackTrace: $stackTrace,
          contextJson: $contextJson
        })
        RETURN e
      `;

      const client = getNeo4jClient();
      await client.executeQuery(query, {
        code: error.code,
        message: error.message,
        component: error.component,
        severity: error.severity,
        recoverable: error.recoverable,
        timestamp: error.timestamp,
        stackTrace: error.stackTrace || '',
        contextJson: JSON.stringify(error.context || {})
      });

      console.log(`[ErrorHandler] Error logged to Neo4j: ${error.code}`);
    } catch (logError) {
      console.error('[ErrorHandler] Failed to log error to Neo4j:', logError);
      // Don't throw - logging failure shouldn't break error handling
    }
  }

  /**
   * Log workflow halt to Neo4j
   */
  private async logWorkflowHalt(
    userId: string,
    taskId: string,
    reason: string
  ): Promise<void> {
    try {
      const query = `
        CREATE (h:WorkflowHalt {
          taskId: $taskId,
          userId: $userId,
          reason: $reason,
          timestamp: datetime($timestamp)
        })
        WITH h
        MATCH (u:User {id: $userId})
        CREATE (u)-[:HALTED_WORKFLOW]->(h)
        RETURN h
      `;

      const client = getNeo4jClient();
      await client.executeQuery(query, {
        taskId,
        userId,
        reason,
        timestamp: new Date().toISOString()
      });

      console.log(`[ErrorHandler] Workflow halt logged to Neo4j`);
    } catch (logError) {
      console.error('[ErrorHandler] Failed to log workflow halt to Neo4j:', logError);
    }
  }

  /**
   * Get error log
   */
  getErrorLog(): AgentError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byComponent: Record<string, number>;
    recoverable: number;
    unrecoverable: number;
  } {
    const stats = {
      total: this.errorLog.length,
      bySeverity: {} as Record<string, number>,
      byComponent: {} as Record<string, number>,
      recoverable: 0,
      unrecoverable: 0
    };

    for (const error of this.errorLog) {
      // Count by severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;

      // Count by component
      stats.byComponent[error.component] = (stats.byComponent[error.component] || 0) + 1;

      // Count recoverable vs unrecoverable
      if (error.recoverable) {
        stats.recoverable++;
      } else {
        stats.unrecoverable++;
      }
    }

    return stats;
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new AgentErrorHandler();

/**
 * Handle uncaught errors in agent workflow
 */
export async function handleUncaughtError(
  error: Error,
  userId: string,
  taskId: string
): Promise<void> {
  console.error('[ErrorHandler] Uncaught error in agent workflow:', error);

  const agentError: AgentError = {
    code: 'UNCAUGHT_ERROR',
    message: error.message,
    component: 'workflow',
    severity: 'critical',
    recoverable: false,
    timestamp: new Date().toISOString(),
    stackTrace: error.stack
  };

  await globalErrorHandler.handleToolError('workflow', error, { userId, taskId });
  await globalErrorHandler.haltWorkflow('Uncaught error in workflow', userId, taskId);
}

/**
 * Create error response for API
 */
export function createErrorResponse(error: AgentError): {
  error: string;
  message: string;
  code: string;
  severity: string;
  timestamp: string;
  recoverable: boolean;
} {
  return {
    error: error.component,
    message: error.message,
    code: error.code,
    severity: error.severity,
    timestamp: error.timestamp,
    recoverable: error.recoverable
  };
}
