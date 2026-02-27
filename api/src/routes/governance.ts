import express, { Request, Response } from 'express';
import GovernanceService from '../services/GovernanceService';

const router = express.Router();
const governanceService = new GovernanceService();

/**
 * GET /api/governance/audit
 * Query audit trail with filters and pagination
 * Requirements: 7.4, 12.3
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      startDate,
      endDate,
      decisionType,
      limit = '10',
      page = '1',
    } = req.query;

    // Parse pagination parameters
    const limitNum = parseInt(limit as string, 10);
    const pageNum = parseInt(page as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query filters
    const filters: any = {
      limit: limitNum + 1, // Fetch one extra to check if there are more
    };

    if (userId) filters.userId = userId as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (decisionType) filters.decisionType = decisionType as string;

    // Query audit trail
    const allEntries = await governanceService.queryAuditTrail(filters);

    // Apply pagination
    const entries = allEntries.slice(skip, skip + limitNum);
    const hasMore = allEntries.length > skip + limitNum;
    const total = allEntries.length;

    res.json({
      success: true,
      entries,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore,
    });
  } catch (error) {
    console.error('[Governance API] Audit trail query failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to query audit trail',
      entries: [],
    });
  }
});

/**
 * POST /api/governance/provenance
 * Get full decision provenance (complete relationship graph)
 * Requirements: 7.4, 10.4
 */
router.post('/provenance', async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.body;

    if (!decisionId) {
      return res.status(400).json({
        success: false,
        error: 'decisionId is required',
      });
    }

    // Get decision provenance
    const provenance = await governanceService.getDecisionProvenance(decisionId);

    if (!provenance) {
      return res.status(404).json({
        success: false,
        error: `Decision not found: ${decisionId}`,
      });
    }

    res.json({
      success: true,
      provenance,
    });
  } catch (error) {
    console.error('[Governance API] Provenance query failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get decision provenance',
    });
  }
});

/**
 * POST /api/governance/query
 * Execute custom Cypher query
 * Requirements: 12.3
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, params = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'query is required',
      });
    }

    // Execute custom Cypher query
    const results = await governanceService.executeCypherQuery(query, params);

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('[Governance API] Custom query failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute query',
      results: [],
    });
  }
});

export default router;
