import { Router, Request, Response } from 'express';
import { FinanceService } from '../services/FinanceService';

const router = Router();
const financeService = new FinanceService();

/**
 * POST /api/finance
 * Default route - Generate Flux Report for a transaction
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, transaction, portfolioBefore } = req.body;

    // Validate required fields
    if (!userId || !transaction || !portfolioBefore) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'transaction', 'portfolioBefore']
      });
    }

    // Generate Flux Report
    const fluxReport = await financeService.generateFluxReport({
      userId,
      transaction,
      portfolioBefore
    });

    res.json(fluxReport);
  } catch (error) {
    console.error('Finance reconciliation error:', error);
    res.status(500).json({
      error: 'Failed to generate Flux Report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/finance/reconcile
 * Generate Flux Report for a transaction
 * Requirements: 5.1, 5.4
 */
router.post('/reconcile', async (req: Request, res: Response) => {
  try {
    const { userId, transaction, portfolioBefore } = req.body;

    // Validate required fields
    if (!userId || !transaction || !portfolioBefore) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['userId', 'transaction', 'portfolioBefore']
      });
    }

    // Validate transaction structure
    if (!transaction.type || !transaction.assetId || transaction.price === undefined || transaction.fees === undefined) {
      return res.status(400).json({
        error: 'Invalid transaction structure',
        required: ['type', 'assetId', 'price', 'fees']
      });
    }

    // Validate portfolio structure
    if (portfolioBefore.totalValue === undefined || !portfolioBefore.assets) {
      return res.status(400).json({
        error: 'Invalid portfolio structure',
        required: ['totalValue', 'assets']
      });
    }

    // Generate Flux Report
    const fluxReport = await financeService.generateFluxReport({
      userId,
      transaction,
      portfolioBefore
    });

    res.json({
      success: true,
      fluxReport
    });
  } catch (error) {
    console.error('Finance reconciliation error:', error);
    res.status(500).json({
      error: 'Failed to generate Flux Report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/finance/reports/:userId
 * Get recent flux reports for a user
 */
router.get('/reports/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const reports = await financeService.getRecentFluxReports(userId, limit);

    res.json({
      success: true,
      reports,
      count: reports.length
    });
  } catch (error) {
    console.error('Failed to fetch flux reports:', error);
    res.status(500).json({
      error: 'Failed to fetch flux reports',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/finance/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'finance',
    timestamp: new Date().toISOString()
  });
});

export default router;
