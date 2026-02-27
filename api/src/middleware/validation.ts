import { Request, Response, NextFunction } from 'express';

export const validateVoiceCommand = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userId is required'
    });
  }
  
  if (!req.file && !req.body.audio) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'audio file or audio data is required'
    });
  }
  
  next();
};

export const validateScoutRequest = (req: Request, res: Response, next: NextFunction) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'query string is required'
    });
  }
  
  next();
};

export const validateVerificationRequest = (req: Request, res: Response, next: NextFunction) => {
  const { dealData } = req.body;
  
  if (!dealData || typeof dealData !== 'object') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'dealData object is required'
    });
  }
  
  const required = ['assetId', 'collection', 'price', 'seller', 'listingUrl'];
  const missing = required.filter(field => !dealData[field]);
  
  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Missing required dealData fields: ${missing.join(', ')}`
    });
  }
  
  next();
};

export const validatePolicyCheckRequest = (req: Request, res: Response, next: NextFunction) => {
  const { userId, transaction, context } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userId is required'
    });
  }
  
  if (!transaction || !transaction.assetType || transaction.amount === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'transaction with assetType and amount is required'
    });
  }
  
  if (!context || context.currentPortfolioValue === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'context with currentPortfolioValue is required'
    });
  }
  
  next();
};

export const validateReconciliationRequest = (req: Request, res: Response, next: NextFunction) => {
  const { userId, transaction, portfolioBefore } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'userId is required'
    });
  }
  
  if (!transaction || !transaction.type || !transaction.assetId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'transaction with type and assetId is required'
    });
  }
  
  if (!portfolioBefore || portfolioBefore.totalValue === undefined) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'portfolioBefore with totalValue is required'
    });
  }
  
  next();
};
