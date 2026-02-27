/**
 * Agent Tools - Tool wrappers and registry for FORGE Agent
 */

import { VoiceService } from './VoiceService';
import { ScoutService } from './ScoutService';
import { VerificationService } from './VerificationService';
import { GovernanceService } from './GovernanceService';
import { FinanceService } from './FinanceService';
import { MockWalletService } from './MockWalletService';

// Tool execution result
export interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  duration: number;
  timestamp: string;
}

// Tool executor function type
export type ToolExecutor = (params: any) => Promise<ToolResult>;

/**
 * Tool Registry - Maps tool names to executor functions
 */
export class ToolRegistry {
  private tools: Map<string, ToolExecutor>;
  private voiceService: VoiceService;
  private scoutService: ScoutService;
  private verificationService: VerificationService;
  private governanceService: GovernanceService;
  private financeService: FinanceService;
  private walletService: MockWalletService;

  constructor() {
    this.tools = new Map();
    this.voiceService = new VoiceService();
    this.scoutService = new ScoutService();
    this.verificationService = new VerificationService();
    this.governanceService = new GovernanceService();
    this.financeService = new FinanceService();
    this.walletService = new MockWalletService();

    this.registerTools();
  }

  /**
   * Register all available tools
   */
  private registerTools(): void {
    this.tools.set('tavily_search', this.tavilySearchTool.bind(this));
    this.tools.set('yutori_scout', this.yutoriScoutTool.bind(this));
    this.tools.set('senso_verify', this.sensoVerifyTool.bind(this));
    this.tools.set('neo4j_policy', this.neo4jPolicyTool.bind(this));
    this.tools.set('numeric_reconcile', this.numericReconcileTool.bind(this));
    this.tools.set('mock_wallet_execute', this.mockWalletExecuteTool.bind(this));
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, params: any): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const executor = this.tools.get(toolName);
      if (!executor) {
        return {
          success: false,
          data: null,
          error: `Tool not found: ${toolName}`,
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      console.log(`[ToolRegistry] Executing tool: ${toolName}`);
      const result = await executor(params);
      console.log(`[ToolRegistry] Tool ${toolName} completed in ${result.duration}ms`);
      
      return result;
    } catch (error) {
      console.error(`[ToolRegistry] Tool ${toolName} failed:`, error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get list of available tools
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // ============================================================================
  // Tool Implementations
  // ============================================================================

  /**
   * Tavily Search Tool - Search for deals and market data
   */
  private async tavilySearchTool(params: {
    query: string;
    maxResults?: number;
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { query, maxResults = 3 } = params;
      
      const results = await this.scoutService.searchDeals(query, maxResults);
      
      return {
        success: true,
        data: results,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Tavily search failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Yutori Scout Tool - Create monitoring scout
   */
  private async yutoriScoutTool(params: {
    name: string;
    assetType: string;
    priceThreshold?: number;
    monitoringFrequency?: 'realtime' | 'hourly' | 'daily';
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { name, assetType, priceThreshold, monitoringFrequency = 'hourly' } = params;
      
      const scout = await this.scoutService.createScout({
        name,
        description: `Monitor ${assetType} deals`,
        targetUrls: [`https://paras.id/search?q=${assetType}`],
        monitoringFrequency,
        alertConditions: priceThreshold ? { priceBelow: priceThreshold } : {}
      });
      
      return {
        success: true,
        data: scout,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Yutori scout creation failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Senso Verify Tool - Verify deal context
   */
  private async sensoVerifyTool(params: {
    dealData: {
      assetId: string;
      collection: string;
      price: number;
      seller?: string;
      listingUrl?: string;
    };
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { dealData } = params;
      
      const verification = await this.verificationService.verifyContext(dealData);
      
      return {
        success: true,
        data: verification,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Senso verification failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Neo4j Policy Tool - Check governance policies
   */
  private async neo4jPolicyTool(params: {
    userId: string;
    transaction: {
      assetType: string;
      amount: number;
      seller?: string;
    };
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { userId, transaction } = params;
      
      const policyCheck = await this.governanceService.checkPolicies(userId, transaction);
      
      return {
        success: true,
        data: policyCheck,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Policy check failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Numeric Reconcile Tool - Calculate financial impact
   */
  private async numericReconcileTool(params: {
    userId: string;
    transaction: {
      type: 'buy' | 'sell' | 'transfer';
      assetId: string;
      amount: number;
      price: number;
      fees?: number;
    };
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { userId, transaction } = params;
      
      const fluxReport = await this.financeService.reconcileTransaction(userId, transaction);
      
      return {
        success: true,
        data: fluxReport,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Financial reconciliation failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Mock Wallet Execute Tool - Execute transaction securely
   */
  private async mockWalletExecuteTool(params: {
    operation: 'transfer' | 'nft_buy' | 'token_swap';
    userId: string;
    amount: number;
    tokenId?: string;
    recipient?: string;
  }): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      const { operation, userId, amount, tokenId, recipient } = params;
      
      const txResult = await this.walletService.executeTransaction({
        operation,
        userId,
        amount,
        tokenId,
        recipient
      });
      
      return {
        success: true,
        data: txResult,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Transaction execution failed',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Parse tool results and handle errors
 */
export function parseToolResult(result: ToolResult): {
  success: boolean;
  data: any;
  error?: string;
} {
  if (!result.success) {
    return {
      success: false,
      data: null,
      error: result.error || 'Tool execution failed'
    };
  }

  return {
    success: true,
    data: result.data
  };
}

/**
 * Create tool execution context with dependency tracking
 */
export interface ToolExecutionContext {
  toolName: string;
  params: any;
  dependencies: string[]; // Tools that must execute before this one
  outputs: Map<string, any>; // Outputs from previous tools
}

/**
 * Resolve tool dependencies and determine execution order
 */
export function resolveToolDependencies(
  toolCalls: ToolExecutionContext[]
): ToolExecutionContext[][] {
  const batches: ToolExecutionContext[][] = [];
  const executed = new Set<string>();
  const remaining = [...toolCalls];

  while (remaining.length > 0) {
    const batch: ToolExecutionContext[] = [];

    // Find tools whose dependencies are satisfied
    for (let i = remaining.length - 1; i >= 0; i--) {
      const tool = remaining[i];
      const dependenciesSatisfied = tool.dependencies.every(dep => executed.has(dep));

      if (dependenciesSatisfied) {
        batch.push(tool);
        remaining.splice(i, 1);
        executed.add(tool.toolName);
      }
    }

    if (batch.length === 0 && remaining.length > 0) {
      // Circular dependency or missing dependency
      throw new Error(`Cannot resolve tool dependencies: ${remaining.map(t => t.toolName).join(', ')}`);
    }

    if (batch.length > 0) {
      batches.push(batch);
    }
  }

  return batches;
}
