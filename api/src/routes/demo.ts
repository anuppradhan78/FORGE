import { Router, Request, Response } from 'express';
import { globalDemoService } from '../services/DemoService';

const router = Router();

/**
 * POST /api/demo/run - Execute full demo flow with comprehensive validation
 * 
 * This endpoint orchestrates the complete FORGE demo flow:
 * 1. Voice command analysis
 * 2. Deal scouting (Tavily + Yutori)
 * 3. Context verification (Senso)
 * 4. Policy checking (Neo4j)
 * 5. Financial reconciliation (Numeric)
 * 6. Transaction execution (IronClaw TEE + Mock Wallet)
 * 
 * Validates:
 * - All 9 sponsors are invoked
 * - At least 5 new nodes created in Neo4j
 * - Complete audit trail is generated
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { 
      voiceCommand = 'Scout NEAR NFTs under 50 NEAR and buy the best one', 
      userId = 'demo-user-alice',
      scenario = 'buy-nft'
    } = req.body;
    
    console.log('[Demo] Starting full demo flow...');
    console.log('[Demo] Scenario:', scenario);
    console.log('[Demo] Voice command:', voiceCommand);
    console.log('[Demo] User ID:', userId);
    
    // Execute demo flow with validation
    const result = await globalDemoService.runDemoFlow(voiceCommand, userId, scenario);
    
    console.log('[Demo] Demo flow completed in', result.duration, 'ms');
    console.log('[Demo] Overall success:', result.success);
    console.log('[Demo] Sponsors invoked:', result.sponsorValidation.allSponsorsInvoked);
    console.log('[Demo] Nodes created:', result.graphValidation.nodesCreated);
    
    // Return comprehensive result
    res.json({
      success: result.success,
      duration: result.duration,
      taskId: result.taskId,
      
      // Decision details
      decision: result.decision,
      
      // Tool execution details
      toolCalls: result.toolCalls,
      
      // Sponsor validation
      sponsorValidation: {
        allSponsorsInvoked: result.sponsorValidation.allSponsorsInvoked,
        sponsorStatus: result.sponsorValidation.sponsorStatus,
        missingSponsor: result.sponsorValidation.missingSponsor
      },
      
      // Graph growth validation
      graphValidation: {
        nodesCreated: result.graphValidation.nodesCreated,
        minimumMet: result.graphValidation.minimumMet,
        nodesBefore: result.graphValidation.nodesBefore,
        nodesAfter: result.graphValidation.nodesAfter
      },
      
      // Audit trail
      auditTrail: result.auditTrail,
      
      // Validation summary
      validations: {
        sponsorsValid: result.sponsorValidation.allSponsorsInvoked,
        graphGrowthValid: result.graphValidation.minimumMet,
        decisionValid: result.decision.verdict === 'approve',
        allValid: result.success
      }
    });
  } catch (error) {
    console.error('[Demo] Demo flow error:', error);
    res.status(500).json({
      error: 'Demo Flow Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/demo/reset - Reset demo state
 * 
 * Clears all demo decisions from Neo4j to prepare for a fresh demo run.
 * This is useful for running multiple consecutive demos.
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    console.log('[Demo] Resetting demo state...');
    
    await globalDemoService.resetDemoState();
    
    console.log('[Demo] Demo state reset successfully');
    
    res.json({
      success: true,
      message: 'Demo state reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Demo] Demo reset error:', error);
    res.status(500).json({
      error: 'Demo Reset Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/demo/status - Get demo system status
 * 
 * Returns the current status of all demo components and sponsors.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { getNeo4jClient } = await import('../utils/neo4j-client');
    
    // Check Neo4j connection
    let neo4jStatus = 'active';
    let nodeCount = 0;
    try {
      const client = getNeo4jClient();
      const result = await client.executeQuery('MATCH (n) RETURN count(n) as count', {});
      nodeCount = result.records[0].get('count').toNumber();
    } catch (error) {
      neo4jStatus = 'error';
    }
    
    res.json({
      status: 'ready',
      components: {
        neo4j: neo4jStatus,
        agent: 'active',
        teeVault: 'active'
      },
      graphStats: {
        totalNodes: nodeCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Demo] Status check error:', error);
    res.status(500).json({
      error: 'Status Check Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
