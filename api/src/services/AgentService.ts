import { VoiceService } from './VoiceService';
import { ScoutService } from './ScoutService';
import { VerificationService } from './VerificationService';
import { GovernanceService } from './GovernanceService';
import { FinanceService } from './FinanceService';
import { MockWalletService } from './MockWalletService';
import { getNeo4jClient } from '../utils/neo4j-client';
import { globalStatusTracker } from './AgentStatusTracker';
import crypto from 'crypto';

// Agent configuration
interface AgentConfig {
  llm: {
    provider: 'openai';
    model: string;
    temperature: number;
  };
  userId: string;
  taskId: string;
  scenario?: string;
}

// Agent decision result
interface AgentDecision {
  taskId: string;
  decision: 'approve' | 'reject' | 'escalate';
  reasoning: string;
  toolCalls: ToolCall[];
  governanceChecks: any[];
  outcome: any | null;
  timestamp: string;
}

interface ToolCall {
  toolName: string;
  input: any;
  output: any;
  duration: number;
  success: boolean;
  error?: string;
}

// System prompt defining agent behavior
const SYSTEM_PROMPT = `You are FORGE Agent, an autonomous AI agent for secure crypto commerce.

Your role is to help users scout deals, verify information, check compliance policies, and execute transactions safely.

WORKFLOW:
1. Voice Analysis: Understand user intent and extract parameters
2. Scout: Search for deals using Tavily and Yutori
3. Verify: Validate deal information with Senso Context Hub
4. Govern: Check compliance policies in Neo4j
5. Reconcile: Calculate portfolio impact with Numeric
6. Execute: Perform transaction via TEE-secured wallet

AVAILABLE TOOLS:
- tavily_search: Search for NFT listings and market data
- yutori_scout: Create ongoing monitoring scouts
- senso_verify: Verify deal legitimacy and floor prices
- neo4j_policy: Check user policies and risk thresholds
- numeric_reconcile: Calculate financial impact and generate flux reports
- mock_wallet_execute: Execute transactions securely

SECURITY RULES:
- Never expose credentials or private keys
- Always check policies before executing transactions
- Log all decisions to audit trail
- Reject transactions that violate policies
- Provide clear reasoning for all decisions

ERROR HANDLING:
- If a tool fails, log the error and continue with available data
- If critical tools fail (policy check, wallet), halt workflow
- Always return structured responses with clear error messages

Your responses should be concise, professional, and focused on the task at hand.`;

/**
 * Agent Service - Orchestrates the full FORGE workflow
 */
export class AgentService {
  private config: AgentConfig;
  private voiceService: VoiceService;
  private scoutService: ScoutService;
  private verificationService: VerificationService;
  private governanceService: GovernanceService;
  private financeService: FinanceService;
  private walletService: MockWalletService;

  constructor(config: AgentConfig) {
    this.config = config;
    this.voiceService = new VoiceService();
    this.scoutService = new ScoutService();
    this.verificationService = new VerificationService();
    this.governanceService = new GovernanceService();
    this.financeService = new FinanceService();
    this.walletService = new MockWalletService();
  }

  /**
   * Execute the full agent workflow
   */
  async executeWorkflow(voiceCommand: string): Promise<AgentDecision> {
    const startTime = Date.now();
    const toolCalls: ToolCall[] = [];
    const governanceChecks: any[] = [];

    try {
      // Start task tracking
      globalStatusTracker.startTask(this.config.taskId, voiceCommand);

      // Step 1: Voice Analysis
      console.log('[Agent] Step 1: Analyzing voice command...');
      globalStatusTracker.updateProgress(10, 'Analyzing voice command');
      
      const voiceResult = await this.executeTool('voice_analysis', { 
        audio: voiceCommand,
        userId: this.config.userId
      }, async (input) => {
        return await this.voiceService.analyzeVoiceCommand(input);
      });
      toolCalls.push(voiceResult);

      if (!voiceResult.success || !voiceResult.output.approved) {
        globalStatusTracker.completeTask();
        return this.createDecision('reject', 'Voice command rejected due to fraud risk', toolCalls, governanceChecks, null);
      }

      const intent = voiceResult.output.intent;

      // Step 2: Scout for deals
      console.log('[Agent] Step 2: Scouting for deals...');
      globalStatusTracker.updateStatus('scouting', {
        taskId: this.config.taskId,
        command: voiceCommand,
        progress: 25,
        currentStep: 'Searching for deals'
      });
      
      const scoutResult = await this.executeTool('tavily_search', {
        query: `${intent.assetType} listings under ${intent.priceLimit} NEAR`,
        searchDepth: 'basic',
        maxResults: 3
      }, async (input) => {
        return await this.scoutService.searchDeals(input);
      });
      toolCalls.push(scoutResult);

      if (!scoutResult.success || scoutResult.output.length === 0) {
        globalStatusTracker.completeTask();
        return this.createDecision('reject', 'No suitable deals found', toolCalls, governanceChecks, null);
      }

      const bestDeal = scoutResult.output[0];

      // Step 3: Verify context
      console.log('[Agent] Step 3: Verifying deal context...');
      globalStatusTracker.updateStatus('verifying', {
        taskId: this.config.taskId,
        command: voiceCommand,
        progress: 45,
        currentStep: 'Verifying deal legitimacy'
      });
      
      const verifyResult = await this.executeTool('senso_verify', {
        dealData: bestDeal,
        scenario: this.config.scenario
      }, async (input) => {
        return await this.verificationService.verifyContext(input.dealData, input.scenario);
      });
      toolCalls.push(verifyResult);

      if (!verifyResult.success || verifyResult.output.riskLevel === 'high') {
        globalStatusTracker.completeTask();
        return this.createDecision('reject', verifyResult.output.reasoning || 'Deal verification failed or high risk detected', toolCalls, governanceChecks, null);
      }

      // Step 4: Check governance policies
      console.log('[Agent] Step 4: Checking governance policies...');
      globalStatusTracker.updateStatus('deciding', {
        taskId: this.config.taskId,
        command: voiceCommand,
        progress: 60,
        currentStep: 'Checking compliance policies'
      });
      
      const policyResult = await this.executeTool('neo4j_policy', {
        userId: this.config.userId,
        transaction: {
          assetType: intent.assetType,
          amount: bestDeal.price,
          seller: bestDeal.seller
        },
        context: {
          currentPortfolioValue: 1000, // Mock portfolio value
          recentTransactionCount: 0
        },
        scenario: this.config.scenario
      }, async (input) => {
        return await this.governanceService.checkPolicies(input);
      });
      toolCalls.push(policyResult);
      governanceChecks.push(policyResult.output);

      if (!policyResult.success || !policyResult.output.approved) {
        globalStatusTracker.completeTask();
        return this.createDecision('reject', policyResult.output.reasoning || 'Policy violation detected', toolCalls, governanceChecks, null);
      }

      // Step 5: Calculate financial impact
      console.log('[Agent] Step 5: Calculating financial impact...');
      globalStatusTracker.updateProgress(75, 'Calculating financial impact');
      
      const reconcileResult = await this.executeTool('numeric_reconcile', {
        userId: this.config.userId,
        transaction: {
          type: 'buy',
          assetId: bestDeal.asset_id,
          amount: 1,
          price: bestDeal.price,
          fees: bestDeal.price * 0.01
        },
        portfolioBefore: {
          totalValue: 1000, // Mock portfolio value
          assets: {}
        }
      }, async (input) => {
        return await this.financeService.generateFluxReport(input);
      });
      toolCalls.push(reconcileResult);

      if (!reconcileResult.success || !reconcileResult.output.reconciled) {
        globalStatusTracker.completeTask();
        return this.createDecision('escalate', 'Financial reconciliation anomaly detected', toolCalls, governanceChecks, null);
      }

      // Step 6: Execute transaction
      console.log('[Agent] Step 6: Executing transaction...');
      globalStatusTracker.updateStatus('executing', {
        taskId: this.config.taskId,
        command: voiceCommand,
        progress: 90,
        currentStep: 'Executing transaction'
      });
      
      const executeResult = await this.executeTool('mock_wallet_execute', {
        operation: 'nft_buy',
        userId: this.config.userId,
        amount: bestDeal.price,
        tokenId: bestDeal.asset_id
      }, async (input) => {
        return await this.walletService.executeTransaction(input);
      });
      toolCalls.push(executeResult);

      if (!executeResult.success) {
        globalStatusTracker.completeTask();
        return this.createDecision('reject', 'Transaction execution failed', toolCalls, governanceChecks, null);
      }

      // Link FluxReport to Transaction in Neo4j
      if (reconcileResult.output && reconcileResult.output.id && executeResult.output.transactionHash) {
        try {
          await this.linkFluxReportToTransaction(
            reconcileResult.output.id,
            executeResult.output.transactionHash
          );
          console.log('[Agent] FluxReport linked to transaction');
        } catch (error) {
          console.error('[Agent] Failed to link FluxReport to transaction:', error);
          // Don't fail the workflow if linking fails
        }
      }

      // Success! Log to audit trail
      globalStatusTracker.updateProgress(100, 'Transaction completed');
      
      const decision = this.createDecision('approve', 'Transaction completed successfully', toolCalls, governanceChecks, executeResult.output);
      await this.logDecisionToNeo4j(decision);

      // Complete task after a brief delay to show 100% progress
      setTimeout(() => {
        globalStatusTracker.completeTask();
      }, 1000);

      return decision;

    } catch (error) {
      console.error('[Agent] Workflow error:', error);
      globalStatusTracker.completeTask();
      return this.createDecision('reject', `Workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`, toolCalls, governanceChecks, null);
    }
  }

  /**
   * Execute a tool and track its performance
   */
  private async executeTool(
    toolName: string,
    input: any,
    executor: (input: any) => Promise<any>
  ): Promise<ToolCall> {
    const startTime = Date.now();
    
    // Map tool names to sponsors
    const toolToSponsor: Record<string, string> = {
      'voice_analysis': 'Modulate',
      'tavily_search': 'Tavily',
      'yutori_scout': 'Yutori',
      'senso_verify': 'Senso',
      'neo4j_policy': 'Neo4j',
      'numeric_reconcile': 'Numeric',
      'mock_wallet_execute': 'IronClaw'
    };

    // Set active sponsor
    const sponsor = toolToSponsor[toolName];
    if (sponsor) {
      globalStatusTracker.setActiveSponsor(sponsor);
    }

    try {
      const output = await executor(input);
      
      // Clear active sponsor after execution
      if (sponsor) {
        globalStatusTracker.clearActiveSponsor();
      }

      return {
        toolName,
        input,
        output,
        duration: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      // Clear active sponsor on error
      if (sponsor) {
        globalStatusTracker.clearActiveSponsor();
      }

      return {
        toolName,
        input,
        output: null,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create agent decision object
   */
  private createDecision(
    decision: 'approve' | 'reject' | 'escalate',
    reasoning: string,
    toolCalls: ToolCall[],
    governanceChecks: any[],
    outcome: any | null
  ): AgentDecision {
    return {
      taskId: this.config.taskId,
      decision,
      reasoning,
      toolCalls,
      governanceChecks,
      outcome,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Link FluxReport to Transaction in Neo4j
   */
  private async linkFluxReportToTransaction(fluxReportId: string, transactionHash: string): Promise<void> {
    try {
      const query = `
        MATCH (f:FluxReport {id: $fluxReportId})
        MATCH (t:Transaction {hash: $transactionHash})
        MERGE (t)-[:RECONCILED_BY]->(f)
        RETURN f, t
      `;

      const client = getNeo4jClient();
      await client.executeQuery(query, {
        fluxReportId,
        transactionHash
      });

      console.log(`[Agent] Linked FluxReport ${fluxReportId} to Transaction ${transactionHash}`);
    } catch (error) {
      console.error('[Agent] Failed to link FluxReport to Transaction:', error);
      throw error;
    }
  }

  /**
   * Log decision to Neo4j audit trail
   */
  private async logDecisionToNeo4j(decision: AgentDecision): Promise<void> {
    try {
      const inputDataHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(decision.toolCalls.map(tc => tc.input)))
        .digest('hex');

      const decisionId = `decision-${Date.now()}`;

      const query = `
        CREATE (d:Decision {
          id: $decisionId,
          taskId: $taskId,
          timestamp: datetime($timestamp),
          type: 'agent_workflow',
          verdict: $verdict,
          reasoning: $reasoning,
          toolCallsJson: $toolCallsJson,
          inputDataHash: $inputDataHash
        })
        WITH d
        MATCH (u:User {id: $userId})
        CREATE (u)-[:MADE_DECISION]->(d)
        RETURN d
      `;

      const client = getNeo4jClient();
      await client.executeQuery(query, {
        decisionId,
        taskId: decision.taskId,
        timestamp: decision.timestamp,
        verdict: decision.decision,
        reasoning: decision.reasoning,
        toolCallsJson: JSON.stringify(decision.toolCalls),
        inputDataHash,
        userId: this.config.userId
      });

      // Link Decision to Transaction if one was executed
      if (decision.outcome && decision.outcome.transactionHash) {
        try {
          const linkQuery = `
            MATCH (d:Decision {id: $decisionId})
            MATCH (t:Transaction {hash: $transactionHash})
            MERGE (d)-[:TRIGGERED_TX]->(t)
            RETURN d, t
          `;
          
          await client.executeQuery(linkQuery, {
            decisionId,
            transactionHash: decision.outcome.transactionHash
          });

          console.log('[Agent] Decision linked to Transaction');
        } catch (error) {
          console.error('[Agent] Failed to link Decision to Transaction:', error);
          // Don't throw - linking failure shouldn't break the workflow
        }
      }

      console.log('[Agent] Decision logged to Neo4j audit trail');
    } catch (error) {
      console.error('[Agent] Failed to log decision to Neo4j:', error);
      // Don't throw - logging failure shouldn't break the workflow
    }
  }
}

/**
 * Create and execute agent workflow
 */
export async function executeAgentWorkflow(
  voiceCommand: string,
  userId: string = 'demo-user-alice',
  scenario: string = 'buy-nft'
): Promise<AgentDecision> {
  const config: AgentConfig = {
    llm: {
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.7
    },
    userId,
    taskId: `task-${Date.now()}`,
    scenario
  };

  const agent = new AgentService(config);
  return await agent.executeWorkflow(voiceCommand);
}
