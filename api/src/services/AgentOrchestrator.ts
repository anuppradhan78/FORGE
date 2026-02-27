/**
 * Agent Orchestrator - Handles tool execution with dependency ordering
 */

import { ToolRegistry, ToolResult, ToolExecutionContext, resolveToolDependencies } from './AgentTools';

export interface WorkflowStep {
  name: string;
  toolName: string;
  params: any;
  dependencies: string[];
  result?: ToolResult;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface WorkflowResult {
  success: boolean;
  steps: WorkflowStep[];
  outputs: Map<string, any>;
  totalDuration: number;
  error?: string;
}

/**
 * Agent Orchestrator - Executes tools in dependency order
 */
export class AgentOrchestrator {
  private toolRegistry: ToolRegistry;

  constructor() {
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Execute workflow with automatic dependency resolution
   */
  async executeWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult> {
    const startTime = Date.now();
    const outputs = new Map<string, any>();

    try {
      // Convert steps to execution contexts
      const contexts: ToolExecutionContext[] = steps.map(step => ({
        toolName: step.toolName,
        params: step.params,
        dependencies: step.dependencies,
        outputs
      }));

      // Resolve dependencies and get execution batches
      const batches = resolveToolDependencies(contexts);

      console.log(`[Orchestrator] Executing ${steps.length} tools in ${batches.length} batches`);

      // Execute batches in order
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[Orchestrator] Batch ${batchIndex + 1}: ${batch.map(t => t.toolName).join(', ')}`);

        // Execute tools in batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (context) => {
            const step = steps.find(s => s.toolName === context.toolName);
            if (!step) {
              throw new Error(`Step not found for tool: ${context.toolName}`);
            }

            step.status = 'running';

            // Resolve parameters with outputs from dependencies
            const resolvedParams = this.resolveParameters(step.params, outputs);

            // Execute tool
            const result = await this.toolRegistry.executeTool(step.toolName, resolvedParams);

            step.result = result;
            step.status = result.success ? 'completed' : 'failed';

            // Store output for dependent tools
            if (result.success) {
              outputs.set(step.name, result.data);
            }

            return { step, result };
          })
        );

        // Check if any critical tools failed
        const failures = batchResults.filter(r => !r.result.success);
        if (failures.length > 0) {
          const criticalFailure = failures.find(f => this.isCriticalTool(f.step.toolName));
          if (criticalFailure) {
            console.error(`[Orchestrator] Critical tool failed: ${criticalFailure.step.toolName}`);
            return {
              success: false,
              steps,
              outputs,
              totalDuration: Date.now() - startTime,
              error: `Critical tool failed: ${criticalFailure.step.toolName} - ${criticalFailure.result.error}`
            };
          }
        }
      }

      // Check overall success
      const allSuccessful = steps.every(s => s.status === 'completed');

      return {
        success: allSuccessful,
        steps,
        outputs,
        totalDuration: Date.now() - startTime,
        error: allSuccessful ? undefined : 'Some tools failed'
      };

    } catch (error) {
      console.error('[Orchestrator] Workflow execution failed:', error);
      return {
        success: false,
        steps,
        outputs,
        totalDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute tools sequentially (for simple workflows)
   */
  async executeSequential(steps: WorkflowStep[]): Promise<WorkflowResult> {
    const startTime = Date.now();
    const outputs = new Map<string, any>();

    try {
      for (const step of steps) {
        console.log(`[Orchestrator] Executing: ${step.toolName}`);
        step.status = 'running';

        // Resolve parameters with outputs from previous steps
        const resolvedParams = this.resolveParameters(step.params, outputs);

        // Execute tool
        const result = await this.toolRegistry.executeTool(step.toolName, resolvedParams);

        step.result = result;
        step.status = result.success ? 'completed' : 'failed';

        // Store output
        if (result.success) {
          outputs.set(step.name, result.data);
        }

        // Check if critical tool failed
        if (!result.success && this.isCriticalTool(step.toolName)) {
          console.error(`[Orchestrator] Critical tool failed: ${step.toolName}`);
          return {
            success: false,
            steps,
            outputs,
            totalDuration: Date.now() - startTime,
            error: `Critical tool failed: ${step.toolName} - ${result.error}`
          };
        }
      }

      const allSuccessful = steps.every(s => s.status === 'completed');

      return {
        success: allSuccessful,
        steps,
        outputs,
        totalDuration: Date.now() - startTime
      };

    } catch (error) {
      console.error('[Orchestrator] Sequential execution failed:', error);
      return {
        success: false,
        steps,
        outputs,
        totalDuration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resolve parameters by replacing references with actual outputs
   */
  private resolveParameters(params: any, outputs: Map<string, any>): any {
    if (typeof params !== 'object' || params === null) {
      return params;
    }

    if (Array.isArray(params)) {
      return params.map(item => this.resolveParameters(item, outputs));
    }

    const resolved: any = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // Reference to previous output: $stepName.field
        const [stepName, ...fieldPath] = value.substring(1).split('.');
        const stepOutput = outputs.get(stepName);
        
        if (stepOutput) {
          resolved[key] = fieldPath.length > 0
            ? this.getNestedValue(stepOutput, fieldPath)
            : stepOutput;
        } else {
          resolved[key] = value; // Keep original if not found
        }
      } else if (typeof value === 'object') {
        resolved[key] = this.resolveParameters(value, outputs);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Get nested value from object using path
   */
  private getNestedValue(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Check if a tool is critical (failure should halt workflow)
   */
  private isCriticalTool(toolName: string): boolean {
    const criticalTools = [
      'neo4j_policy',      // Governance is critical
      'mock_wallet_execute' // Transaction execution is critical
    ];
    return criticalTools.includes(toolName);
  }

  /**
   * Get tool execution statistics
   */
  getExecutionStats(result: WorkflowResult): {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    averageDuration: number;
    totalDuration: number;
  } {
    const totalSteps = result.steps.length;
    const successfulSteps = result.steps.filter(s => s.status === 'completed').length;
    const failedSteps = result.steps.filter(s => s.status === 'failed').length;
    const durations = result.steps
      .filter(s => s.result)
      .map(s => s.result!.duration);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      totalSteps,
      successfulSteps,
      failedSteps,
      averageDuration,
      totalDuration: result.totalDuration
    };
  }
}

/**
 * Create standard FORGE workflow
 */
export function createForgeWorkflow(
  voiceCommand: string,
  userId: string
): WorkflowStep[] {
  return [
    {
      name: 'voice',
      toolName: 'voice_analysis',
      params: { transcript: voiceCommand },
      dependencies: [],
      status: 'pending'
    },
    {
      name: 'scout',
      toolName: 'tavily_search',
      params: {
        query: '$voice.intent.assetType listings under $voice.intent.priceLimit NEAR',
        maxResults: 3
      },
      dependencies: ['voice'],
      status: 'pending'
    },
    {
      name: 'verify',
      toolName: 'senso_verify',
      params: {
        dealData: '$scout.results.0' // First result
      },
      dependencies: ['scout'],
      status: 'pending'
    },
    {
      name: 'govern',
      toolName: 'neo4j_policy',
      params: {
        userId,
        transaction: {
          assetType: '$voice.intent.assetType',
          amount: '$scout.results.0.price',
          seller: '$scout.results.0.seller'
        }
      },
      dependencies: ['voice', 'scout'],
      status: 'pending'
    },
    {
      name: 'reconcile',
      toolName: 'numeric_reconcile',
      params: {
        userId,
        transaction: {
          type: 'buy',
          assetId: '$scout.results.0.asset_id',
          amount: 1,
          price: '$scout.results.0.price',
          fees: 0 // Calculate as 1% of price
        }
      },
      dependencies: ['scout', 'govern'],
      status: 'pending'
    },
    {
      name: 'execute',
      toolName: 'mock_wallet_execute',
      params: {
        operation: 'nft_buy',
        userId,
        amount: '$scout.results.0.price',
        tokenId: '$scout.results.0.asset_id'
      },
      dependencies: ['scout', 'govern', 'reconcile'],
      status: 'pending'
    }
  ];
}
