import { Router, Request, Response } from 'express';
import { GovernanceService } from '../services/GovernanceService';
import { PolicyCheckRequest } from '../types';

/**
 * Governance Route Handler
 * Endpoints for policy checking and audit trail queries
 * Requirements: 4.1, 4.3
 */

const router = Router();
const governanceService = new GovernanceService();

/**
 * POST /api/govern
 * Default route - Check transaction against user policies
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const request: PolicyCheckRequest = req.body;

    // Validate request
    if (!request.userId || !request.transaction || !request.context) {
      return res.status(400).json({
        error: 'Missing required fields: userId, transaction, context',
      });
    }

    // Check policies
    const result = await governanceService.checkPolicies(request);

    res.json(result);
  } catch (error) {
    console.error('Policy check error:', error);
    res.status(500).json({
      error: 'Policy check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/govern/check
 * Check transaction against user policies
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const request: PolicyCheckRequest = req.body;

    // Validate request
    if (!request.userId) {
      return res.status(400).json({
        error: 'Missing required field: userId',
      });
    }

    if (!request.transaction) {
      return res.status(400).json({
        error: 'Missing required field: transaction',
      });
    }

    if (!request.transaction.assetType || request.transaction.amount === undefined) {
      return res.status(400).json({
        error: 'Transaction must include assetType and amount',
      });
    }

    if (!request.context) {
      return res.status(400).json({
        error: 'Missing required field: context',
      });
    }

    // Check policies
    const result = await governanceService.checkPolicies(request);

    // Return result with appropriate status code
    const statusCode = result.approved ? 200 : 403;

    res.status(statusCode).json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Policy check error:', error);
    res.status(500).json({
      error: 'Policy check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/govern/decision
 * Create a decision node with audit trail
 */
router.post('/decision', async (req: Request, res: Response) => {
  try {
    const {
      id,
      taskId,
      userId,
      type,
      verdict,
      reasoning,
      toolCalls,
      inputData,
      checkedPolicyIds,
      contextIds,
      transactionId,
    } = req.body;

    // Validate required fields
    if (!id || !taskId || !userId || !type || !verdict || !reasoning) {
      return res.status(400).json({
        error: 'Missing required fields: id, taskId, userId, type, verdict, reasoning',
      });
    }

    // Create decision node
    await governanceService.createDecision({
      id,
      taskId,
      userId,
      type,
      verdict,
      reasoning,
      toolCalls: toolCalls || [],
      inputData: inputData || {},
      checkedPolicyIds: checkedPolicyIds || [],
      contextIds,
      transactionId,
    });

    res.status(201).json({
      success: true,
      decisionId: id,
      message: 'Decision node created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Decision creation error:', error);
    res.status(500).json({
      error: 'Decision creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/govern/audit
 * Query audit trail with filters
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      decisionType: req.query.decisionType as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    };

    const results = await governanceService.queryAuditTrail(filters);

    res.json({
      success: true,
      count: results.length,
      results,
      filters,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Audit trail query error:', error);
    res.status(500).json({
      error: 'Audit trail query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/govern/provenance/:decisionId
 * Get full provenance for a decision
 */
router.get('/provenance/:decisionId', async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;

    const provenance = await governanceService.getDecisionProvenance(decisionId);

    if (!provenance) {
      return res.status(404).json({
        error: 'Decision not found',
        decisionId,
      });
    }

    res.json({
      success: true,
      provenance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Provenance query error:', error);
    res.status(500).json({
      error: 'Provenance query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/govern/query
 * Execute custom Cypher query
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, params } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query',
      });
    }

    // Security: Only allow read queries (MATCH, RETURN, WITH, WHERE, etc.)
    const upperQuery = query.trim().toUpperCase();
    const writeKeywords = ['CREATE', 'DELETE', 'REMOVE', 'SET', 'MERGE', 'DROP'];
    
    for (const keyword of writeKeywords) {
      if (upperQuery.includes(keyword)) {
        return res.status(403).json({
          error: 'Write operations not allowed via query endpoint',
          hint: 'Use specific endpoints for creating/updating data',
        });
      }
    }

    const results = await governanceService.executeCypherQuery(query, params || {});

    res.json({
      success: true,
      count: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cypher query error:', error);
    res.status(500).json({
      error: 'Query execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/govern/patterns/:userId
 * Get detected patterns for a user
 */
router.get('/patterns/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { assetType, amount, seller } = req.query;

    // Create a mock transaction for pattern detection
    const transaction = {
      assetType: (assetType as string) || 'nft',
      amount: amount ? parseFloat(amount as string) : 0,
      seller: seller as string | undefined,
    };

    const patterns = await governanceService.detectPatterns(userId, transaction);

    res.json({
      success: true,
      userId,
      patterns,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Pattern detection error:', error);
    res.status(500).json({
      error: 'Pattern detection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
