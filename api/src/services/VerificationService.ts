import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface DealData {
  assetId: string;
  collection: string;
  price: number;
  seller: string;
  listingUrl: string;
}

interface VerificationChecks {
  collectionLegitimate: boolean;
  floorPriceAccurate: boolean;
  sellerReputable: boolean;
}

interface GroundTruth {
  actualFloorPrice?: number;
  priceDeviation?: number;
  collectionVerifiedUrl?: string;
}

interface VerificationSource {
  url: string;
  authority: string;
  timestamp: string;
}

export interface VerificationResult {
  verified: boolean;
  confidenceScore: number;
  checks: VerificationChecks;
  groundTruth: GroundTruth;
  sources: VerificationSource[];
  riskLevel: 'low' | 'medium' | 'high';
  reasoning?: string;
}

export class VerificationService {
  private sensoApiKey: string;
  private sensoApiUrl: string;
  private mockResponses: any;

  constructor() {
    this.sensoApiKey = process.env.SENSO_API_KEY || '';
    this.sensoApiUrl = process.env.SENSO_API_URL || 'https://api.senso.contexthub.io/v1/verify';
    
    // Load mock responses
    try {
      const mockPath = path.join(process.cwd(), '..', 'mocks', 'senso-responses.json');
      this.mockResponses = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    } catch (error) {
      console.warn('Failed to load Senso mock responses, using empty fallback');
      this.mockResponses = { collections: [] };
    }
  }

  async verifyContext(dealData: DealData, scenario?: string): Promise<VerificationResult> {
    // Handle risk-reject scenario - force high risk
    if (scenario === 'risk-reject') {
      return {
        verified: false,
        confidenceScore: 0.2,
        checks: {
          collectionLegitimate: false,
          floorPriceAccurate: false,
          sellerReputable: false,
        },
        groundTruth: {
          actualFloorPrice: 50,
          priceDeviation: -90,
        },
        sources: [
          {
            url: 'https://mock-senso.contexthub.io/suspicious',
            authority: 'Senso Context Hub (Mock)',
            timestamp: new Date().toISOString(),
          },
        ],
        riskLevel: 'high',
        reasoning: 'Suspicious seller detected. Collection not verified. Price significantly below floor price (90% deviation). High fraud risk.'
      };
    }

    try {
      // Try real Senso API first
      if (this.sensoApiKey && process.env.USE_MOCK_SENSO !== 'true') {
        return await this.callSensoApi(dealData);
      }
    } catch (error) {
      console.warn('Senso API call failed, falling back to mock:', error);
    }

    // Fallback to mock verification
    return this.getMockVerification(dealData);
  }

  private async callSensoApi(dealData: DealData): Promise<VerificationResult> {
    const response = await axios.post(
      this.sensoApiUrl,
      {
        dealData: {
          assetId: dealData.assetId,
          collection: dealData.collection,
          price: dealData.price,
          seller: dealData.seller,
          listingUrl: dealData.listingUrl,
        },
        verificationType: 'all',
      },
      {
        headers: {
          'Authorization': `Bearer ${this.sensoApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    return this.parseVerificationResult(response.data, dealData);
  }

  private parseVerificationResult(apiResponse: any, dealData: DealData): VerificationResult {
    const checks: VerificationChecks = {
      collectionLegitimate: apiResponse.checks?.collectionLegitimate ?? true,
      floorPriceAccurate: apiResponse.checks?.floorPriceAccurate ?? true,
      sellerReputable: apiResponse.checks?.sellerReputable ?? true,
    };

    const actualFloorPrice = apiResponse.groundTruth?.actualFloorPrice;
    const priceDeviation = actualFloorPrice 
      ? this.calculatePriceDeviation(dealData.price, actualFloorPrice)
      : 0;

    const riskLevel = this.determineRiskLevel(priceDeviation, checks);

    const confidenceScore = this.calculateConfidenceScore(checks, apiResponse.sources?.length || 0);

    return {
      verified: checks.collectionLegitimate && checks.floorPriceAccurate && checks.sellerReputable,
      confidenceScore,
      checks,
      groundTruth: {
        actualFloorPrice,
        priceDeviation,
        collectionVerifiedUrl: apiResponse.groundTruth?.collectionVerifiedUrl,
      },
      sources: apiResponse.sources || [],
      riskLevel,
    };
  }

  private getMockVerification(dealData: DealData): VerificationResult {
    // Find matching collection in mock data
    const collection = this.mockResponses.collections.find(
      (c: any) => c.name.toLowerCase() === dealData.collection.toLowerCase()
    );

    if (!collection) {
      // Unknown collection - return low confidence
      return {
        verified: false,
        confidenceScore: 0.3,
        checks: {
          collectionLegitimate: false,
          floorPriceAccurate: false,
          sellerReputable: true,
        },
        groundTruth: {},
        sources: [
          {
            url: 'https://mock-senso.contexthub.io/unknown',
            authority: 'Senso Context Hub (Mock)',
            timestamp: new Date().toISOString(),
          },
        ],
        riskLevel: 'high',
      };
    }

    const actualFloorPrice = collection.floorPrice;
    const priceDeviation = this.calculatePriceDeviation(dealData.price, actualFloorPrice);
    
    const checks: VerificationChecks = {
      collectionLegitimate: collection.verified,
      floorPriceAccurate: Math.abs(priceDeviation) <= 15,
      sellerReputable: true, // Mock always assumes seller is reputable
    };

    const riskLevel = this.determineRiskLevel(priceDeviation, checks);
    const confidenceScore = this.calculateConfidenceScore(checks, 2);

    return {
      verified: checks.collectionLegitimate && checks.floorPriceAccurate && checks.sellerReputable,
      confidenceScore,
      checks,
      groundTruth: {
        actualFloorPrice,
        priceDeviation,
        collectionVerifiedUrl: collection.verifiedUrl || `https://paras.id/collection/${collection.contractAddress}`,
      },
      sources: [
        {
          url: collection.verifiedUrl || `https://paras.id/collection/${collection.contractAddress}`,
          authority: 'Paras NFT Marketplace',
          timestamp: new Date().toISOString(),
        },
        {
          url: `https://nearblocks.io/address/${collection.contractAddress}`,
          authority: 'NEAR Blocks Explorer',
          timestamp: new Date().toISOString(),
        },
      ],
      riskLevel,
    };
  }

  private calculatePriceDeviation(scoutedPrice: number, actualFloorPrice: number): number {
    if (actualFloorPrice === 0) return 0;
    return ((scoutedPrice - actualFloorPrice) / actualFloorPrice) * 100;
  }

  private determineRiskLevel(
    priceDeviation: number,
    checks: VerificationChecks
  ): 'low' | 'medium' | 'high' {
    // High risk if price deviation > 15% or collection not legitimate
    if (Math.abs(priceDeviation) > 15 || !checks.collectionLegitimate) {
      return 'high';
    }

    // Medium risk if price deviation > 5% or seller not reputable
    if (Math.abs(priceDeviation) > 5 || !checks.sellerReputable) {
      return 'medium';
    }

    return 'low';
  }

  private calculateConfidenceScore(checks: VerificationChecks, sourceCount: number): number {
    let score = 0.0;

    // Base score from checks (0.6 max)
    if (checks.collectionLegitimate) score += 0.3;
    if (checks.floorPriceAccurate) score += 0.2;
    if (checks.sellerReputable) score += 0.1;

    // Bonus from source count (0.4 max)
    const sourceBonus = Math.min(sourceCount * 0.2, 0.4);
    score += sourceBonus;

    return Math.min(score, 1.0);
  }
}
