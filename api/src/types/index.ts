// Voice Interface Types
export interface VoiceCommand {
  audio: Buffer | string;
  userId: string;
}

export interface VoiceAnalysisResult {
  transcript: string;
  intent: {
    action: 'scout' | 'buy' | 'sell' | 'query';
    assetType: 'nft' | 'token' | 'any';
    priceLimit?: number;
    riskPreference: 'low' | 'medium' | 'high';
  };
  emotion: {
    confidence: number;
    urgency: number;
  };
  fraudScore: number;
  approved: boolean;
  timestamp: string;
}

// Scout Engine Types
export interface ScoutRequest {
  query: string;
  assetType?: string;
  priceLimit?: number;
  maxResults?: number;
}

export interface ScoutResult {
  results: Array<{
    asset_id: string;
    price: number;
    collection: string;
    listing_url: string;
    timestamp: string;
  }>;
  scoutId?: string;
}

// Context Verification Types
export interface VerificationRequest {
  dealData: {
    assetId: string;
    collection: string;
    price: number;
    seller: string;
    listingUrl: string;
  };
  verificationType?: 'collection' | 'floor_price' | 'seller_reputation' | 'all';
}

export interface VerificationResult {
  verified: boolean;
  confidenceScore: number;
  checks: {
    collectionLegitimate: boolean;
    floorPriceAccurate: boolean;
    sellerReputable: boolean;
  };
  groundTruth: {
    actualFloorPrice?: number;
    priceDeviation?: number;
    collectionVerifiedUrl?: string;
  };
  sources: Array<{
    url: string;
    authority: string;
    timestamp: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
}

// Governance Types
export interface PolicyCheckRequest {
  userId: string;
  transaction: {
    assetType: string;
    amount: number;
    seller?: string;
  };
  context: {
    currentPortfolioValue: number;
    recentTransactionCount: number;
  };
  scenario?: string;
}

export interface PolicyCheckResult {
  approved: boolean;
  violatedPolicies: Array<{
    policyId: string;
    ruleName: string;
    threshold: number;
    actualValue: number;
    severity: 'warning' | 'blocking';
  }>;
  appliedPolicies: string[];
  reasoning: string;
}

// Finance Reconciliation Types
export interface ReconciliationRequest {
  userId: string;
  transaction: {
    type: 'buy' | 'sell';
    assetId: string;
    amount: number;
    price: number;
    fees: number;
  };
  portfolioBefore: {
    totalValue: number;
    assets: Record<string, number>;
  };
}

export interface FluxReport {
  portfolioAfter: {
    totalValue: number;
    assets: Record<string, number>;
  };
  variance: {
    expected: number;
    actual: number;
    deviation: number;
  };
  anomalies: Array<{
    type: 'price_spike' | 'unexpected_fee' | 'balance_mismatch';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  aiExplanation: string;
  reconciled: boolean;
  timestamp: string;
}

// Demo Flow Types
export interface DemoFlowRequest {
  voiceCommand?: string;
  userId?: string;
}

export interface DemoFlowResult {
  success: boolean;
  duration: number;
  steps: Array<{
    name: string;
    status: 'success' | 'failed';
    duration: number;
  }>;
  sponsorStatus: Record<string, 'active' | 'inactive' | 'error'>;
  auditTrailId: string;
  decision?: {
    verdict: 'approve' | 'reject' | 'escalate';
    reasoning: string;
    outcome: any;
  };
}
