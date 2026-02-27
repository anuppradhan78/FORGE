import { Router, Request, Response } from 'express';
import { validateScoutRequest } from '../middleware/validation';
import { ScoutRequest, ScoutResult } from '../types';
import { ScoutService } from '../services/ScoutService';

const router = Router();
const scoutService = new ScoutService();

// POST /api/scout - Default to search (for convenience)
router.post('/', validateScoutRequest, async (req: Request, res: Response) => {
  try {
    const { query, assetType, priceLimit, maxResults = 3, searchDepth = 'basic' } = req.body as ScoutRequest;
    
    // Build search query with filters
    let searchQuery = query || `${assetType || 'NFT'} listings`;
    if (priceLimit) {
      searchQuery += ` under ${priceLimit} NEAR`;
    }
    
    // Search for deals using ScoutService
    const deals = await scoutService.searchDeals({
      query: searchQuery,
      searchDepth: searchDepth as 'basic' | 'advanced',
      maxResults
    });
    
    // Filter by price limit if specified
    const filteredDeals = priceLimit 
      ? deals.filter(deal => deal.price <= priceLimit)
      : deals;
    
    // Handle empty result sets
    if (filteredDeals.length === 0) {
      return res.json({
        results: [],
        scoutId: undefined,
        message: `No deals found matching criteria: ${searchQuery}`,
        explanation: priceLimit 
          ? `No listings found under ${priceLimit} NEAR for ${assetType || 'NFT'}`
          : 'No listings found matching your search query'
      });
    }
    
    const result: ScoutResult = {
      results: filteredDeals,
      scoutId: undefined,
      message: `Found ${filteredDeals.length} deal candidates`
    };
    
    res.json(result);
  } catch (error) {
    console.error('Scout search error:', error);
    res.status(500).json({
      error: 'Scout Search Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/scout/search - Search for deals using Tavily
router.post('/search', validateScoutRequest, async (req: Request, res: Response) => {
  try {
    const { query, assetType, priceLimit, maxResults = 3, searchDepth = 'basic' } = req.body as ScoutRequest;
    
    // Build search query with filters
    let searchQuery = query || `${assetType || 'NFT'} listings`;
    if (priceLimit) {
      searchQuery += ` under ${priceLimit} NEAR`;
    }
    
    // Search for deals using ScoutService
    const deals = await scoutService.searchDeals({
      query: searchQuery,
      searchDepth: searchDepth as 'basic' | 'advanced',
      maxResults
    });
    
    // Filter by price limit if specified
    const filteredDeals = priceLimit 
      ? deals.filter(deal => deal.price <= priceLimit)
      : deals;
    
    // Handle empty result sets
    if (filteredDeals.length === 0) {
      return res.json({
        results: [],
        scoutId: undefined,
        message: `No deals found matching criteria: ${searchQuery}`,
        explanation: priceLimit 
          ? `No listings found under ${priceLimit} NEAR for ${assetType || 'NFT'}`
          : 'No listings found matching your search query'
      });
    }
    
    const result: ScoutResult = {
      results: filteredDeals,
      scoutId: undefined,
      message: `Found ${filteredDeals.length} deal candidates`
    };
    
    res.json(result);
  } catch (error) {
    console.error('Scout search error:', error);
    res.status(500).json({
      error: 'Scout Search Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/scout/create - Create Yutori scout for monitoring
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      targetUrls, 
      monitoringFrequency = 'hourly',
      alertConditions 
    } = req.body;
    
    // Create Yutori scout for ongoing monitoring
    const scoutResult = await scoutService.createScout({
      name: name || `NEAR NFT Scout ${Date.now()}`,
      description: description || 'Monitoring NEAR NFT listings',
      targetUrls: targetUrls || ['https://paras.id'],
      monitoringFrequency,
      alertConditions: alertConditions || {}
    });
    
    res.json({
      scoutId: scoutResult.scoutId,
      status: scoutResult.status,
      message: 'Scout created successfully',
      findings: scoutResult.findings
    });
  } catch (error) {
    console.error('Scout creation error:', error);
    res.status(500).json({
      error: 'Scout Creation Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/scout/:scoutId - Get scout findings
router.get('/:scoutId', async (req: Request, res: Response) => {
  try {
    const { scoutId } = req.params;
    
    const findings = await scoutService.getScoutFindings(scoutId);
    
    res.json(findings);
  } catch (error) {
    console.error('Scout findings error:', error);
    res.status(500).json({
      error: 'Failed to Retrieve Scout Findings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
