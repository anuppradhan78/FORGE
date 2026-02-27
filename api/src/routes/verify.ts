import { Router, Request, Response } from 'express';
import { validateVerificationRequest } from '../middleware/validation';
import { VerificationRequest, VerificationResult } from '../types';
import { VerificationService } from '../services/VerificationService';
import { getNeo4jClient } from '../utils/neo4j-client';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const verificationService = new VerificationService();

/**
 * POST /api/verify
 * Default route - Verify deal context
 */
router.post('/', validateVerificationRequest, async (req: Request, res: Response) => {
  try {
    const { dealData, verificationType = 'all' } = req.body as VerificationRequest;
    
    // Call VerificationService to verify context
    const result: VerificationResult = await verificationService.verifyContext(dealData);
    
    // Log verification to Neo4j as Context node
    try {
      await logVerificationToNeo4j(dealData, result);
    } catch (neo4jError) {
      console.error('Failed to log verification to Neo4j:', neo4jError);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      error: 'Verification Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/verify/context
 * Verify deal context using Senso Context Hub
 * Requirements: 3.1, 7.2
 */
router.post('/context', validateVerificationRequest, async (req: Request, res: Response) => {
  try {
    const { dealData, verificationType = 'all' } = req.body as VerificationRequest;
    
    // Call VerificationService to verify context
    const result: VerificationResult = await verificationService.verifyContext(dealData);
    
    // Log verification to Neo4j as Context node (Requirement 7.2)
    try {
      await logVerificationToNeo4j(dealData, result);
    } catch (neo4jError) {
      console.error('Failed to log verification to Neo4j:', neo4jError);
      // Continue even if Neo4j logging fails (non-blocking)
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      error: 'Verification Failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/verify/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'verify',
    sensoConfigured: !!process.env.SENSO_API_KEY,
    useMock: process.env.USE_MOCK_SENSO === 'true',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Helper function to log verification to Neo4j
 * Requirements: 7.2
 */
async function logVerificationToNeo4j(
  dealData: VerificationRequest['dealData'],
  result: VerificationResult
): Promise<void> {
  const client = getNeo4jClient();
  const contextId = uuidv4();
  
  const query = `
    CREATE (c:Context {
      id: $contextId,
      dealData: $dealData,
      verificationResult: $verificationResult,
      confidenceScore: $confidenceScore,
      sources: $sources,
      timestamp: datetime()
    })
    RETURN c
  `;
  
  const params = {
    contextId,
    dealData: JSON.stringify(dealData),
    verificationResult: JSON.stringify(result),
    confidenceScore: result.confidenceScore,
    sources: JSON.stringify(result.sources),
  };
  
  await client.executeQuery(query, params);
}

export default router;
