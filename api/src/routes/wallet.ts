/**
 * Wallet API Routes
 * Handles mock NEAR wallet operations with TEE security
 */

import express, { Request, Response } from 'express';
import { getMockWalletService } from '../services/MockWalletService';

const router = express.Router();

/**
 * POST /api/wallet/execute
 * Execute a mock NEAR transaction
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { operation, recipient, amount, tokenId, contractAddress, userId } = req.body;

    if (!operation || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['operation', 'userId'],
      });
    }

    const walletService = getMockWalletService();
    const result = await walletService.executeTransaction({
      operation,
      recipient,
      amount,
      tokenId,
      contractAddress,
      userId,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Wallet execution error:', error);
    res.status(500).json({
      error: 'Wallet execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/wallet/balance/:userId
 * Get current balance for user
 */
router.get('/balance/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const walletService = getMockWalletService();
    const balance = walletService.getBalance(userId);

    res.json({
      userId,
      balance,
      currency: 'NEAR',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Balance query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve balance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/wallet/history/:userId
 * Get transaction history for user
 */
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const walletService = getMockWalletService();
    const history = await walletService.getTransactionHistory(userId, limit);

    res.json({
      userId,
      transactions: history,
      count: history.length,
    });
  } catch (error) {
    console.error('History query error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transaction history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
