import { VoiceCommand, VoiceAnalysisResult } from '../types';
import { callWithRetry } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { getNeo4jClient } from '../utils/neo4j-client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * VoiceService handles voice command processing via Modulate Velma API
 * with fraud detection, intent analysis, and fallback to mock responses.
 */
export class VoiceService {
  private circuitBreaker: CircuitBreaker<VoiceAnalysisResult>;
  private mockResponses: any[] = [];
  private readonly FRAUD_THRESHOLD = 0.7;
  private readonly MODULATE_API_URL = process.env.MODULATE_API_URL || 'https://api.modulate.ai/velma/analyze';
  private readonly MODULATE_API_KEY = process.env.MODULATE_API_KEY;

  constructor() {
    this.circuitBreaker = new CircuitBreaker<VoiceAnalysisResult>('modulate');
    this.loadMockResponses();
  }

  /**
   * Load mock voice responses from JSON file for fallback
   */
  private loadMockResponses(): void {
    try {
      const mockPath = path.join(process.cwd(), '..', 'mocks', 'modulate-responses.json');
      if (fs.existsSync(mockPath)) {
        const data = fs.readFileSync(mockPath, 'utf-8');
        this.mockResponses = JSON.parse(data);
      } else {
        // Default mock responses if file doesn't exist
        this.mockResponses = this.getDefaultMockResponses();
      }
    } catch (error) {
      console.warn('Failed to load mock responses, using defaults:', error);
      this.mockResponses = this.getDefaultMockResponses();
    }
  }

  /**
   * Analyze voice command using Modulate Velma API
   * Requirements: 1.1, 1.2, 1.4
   */
  async analyzeVoiceCommand(command: VoiceCommand): Promise<VoiceAnalysisResult> {
    const startTime = Date.now();

    try {
      // Try real API call with circuit breaker
      const result = await this.circuitBreaker.execute(
        () => this.callModulateAPI(command),
        () => this.getMockResponse(command)
      );

      // Enforce fraud score threshold (Requirement 1.3)
      if (result.fraudScore > this.FRAUD_THRESHOLD) {
        await this.logGovernanceAlert(command.userId, result);
        result.approved = false;
      }

      const duration = Date.now() - startTime;
      console.log(`Voice analysis completed in ${duration}ms (approved: ${result.approved})`);

      return result;
    } catch (error) {
      console.error('Voice analysis failed:', error);
      throw new Error(`Voice analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call Modulate Velma API with audio file upload
   * Requirements: 1.1, 1.2, 1.4
   */
  private async callModulateAPI(command: VoiceCommand): Promise<VoiceAnalysisResult> {
    if (!this.MODULATE_API_KEY) {
      throw new Error('MODULATE_API_KEY not configured');
    }

    // Prepare form data for audio upload
    const formData = new FormData();
    
    if (Buffer.isBuffer(command.audio)) {
      const blob = new Blob([command.audio], { type: 'audio/wav' });
      formData.append('audio', blob, 'voice-command.wav');
    } else {
      // If audio is a file path string
      const audioBuffer = fs.readFileSync(command.audio);
      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('audio', blob, 'voice-command.wav');
    }
    
    formData.append('userId', command.userId);
    formData.append('analysisType', 'full'); // Request transcript, intent, emotion, fraud

    const response = await callWithRetry(async () => {
      const res = await fetch(this.MODULATE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.MODULATE_API_KEY}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Modulate API error: ${res.status} ${res.statusText}`);
      }

      return res.json();
    }, { maxRetries: 2, baseDelay: 1000 });

    // Parse Modulate response and extract structured parameters
    return this.parseModulateResponse(response);
  }

  /**
   * Parse Modulate API response into VoiceAnalysisResult
   * Extract structured parameters: action, assetType, priceLimit, riskPreference
   * Requirements: 1.2, 1.4
   */
  private parseModulateResponse(response: any): VoiceAnalysisResult {
    const transcript = response.transcript || '';
    const fraudScore = response.fraud_score || 0.0;

    // Extract intent from transcript using pattern matching
    const intent = this.extractIntent(transcript);

    // Extract emotion metrics
    const emotion = {
      confidence: response.emotion?.confidence || 0.5,
      urgency: response.emotion?.urgency || 0.5,
    };

    return {
      transcript,
      intent,
      emotion,
      fraudScore,
      approved: fraudScore <= this.FRAUD_THRESHOLD,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract structured intent from transcript
   * Requirements: 1.4
   */
  private extractIntent(transcript: string): VoiceAnalysisResult['intent'] {
    const lower = transcript.toLowerCase();

    // Determine action
    let action: 'scout' | 'buy' | 'sell' | 'query' = 'query';
    if (lower.includes('scout') || lower.includes('search') || lower.includes('find')) {
      action = 'scout';
    } else if (lower.includes('buy') || lower.includes('purchase')) {
      action = 'buy';
    } else if (lower.includes('sell')) {
      action = 'sell';
    }

    // Determine asset type
    let assetType: 'nft' | 'token' | 'any' = 'any';
    if (lower.includes('nft')) {
      assetType = 'nft';
    } else if (lower.includes('token')) {
      assetType = 'token';
    }

    // Extract price limit
    let priceLimit: number | undefined;
    const priceMatch = lower.match(/(?:under|below|less than|max)\s+(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      priceLimit = parseFloat(priceMatch[1]);
    }

    // Determine risk preference
    let riskPreference: 'low' | 'medium' | 'high' = 'medium';
    if (lower.includes('low risk') || lower.includes('safe') || lower.includes('conservative')) {
      riskPreference = 'low';
    } else if (lower.includes('high risk') || lower.includes('aggressive')) {
      riskPreference = 'high';
    }

    return {
      action,
      assetType,
      priceLimit,
      riskPreference,
    };
  }

  /**
   * Log governance alert to Neo4j when fraud detected
   * Requirements: 1.3
   */
  private async logGovernanceAlert(userId: string, result: VoiceAnalysisResult): Promise<void> {
    try {
      const neo4j = getNeo4jClient();
      const session = neo4j.getSession();

      await session.run(
        `
        CREATE (a:GovernanceAlert {
          id: randomUUID(),
          userId: $userId,
          type: 'fraud_detection',
          fraudScore: $fraudScore,
          transcript: $transcript,
          timestamp: datetime(),
          severity: 'blocking'
        })
        WITH a
        MATCH (u:User {id: $userId})
        CREATE (u)-[:TRIGGERED_ALERT]->(a)
        RETURN a.id as alertId
        `,
        {
          userId,
          fraudScore: result.fraudScore,
          transcript: result.transcript,
        }
      );

      await session.close();
      console.log(`Governance alert logged for user ${userId} (fraud score: ${result.fraudScore})`);
    } catch (error) {
      console.error('Failed to log governance alert:', error);
      // Don't throw - alert logging failure shouldn't block the response
    }
  }

  /**
   * Get mock response for fallback
   * Requirements: 14.5
   */
  private getMockResponse(command: VoiceCommand): VoiceAnalysisResult {
    // Select a random mock response or use the first one
    const mockIndex = Math.floor(Math.random() * this.mockResponses.length);
    const mock = this.mockResponses[mockIndex];

    console.log(`Using mock voice response (fallback mode)`);

    return {
      ...mock,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Default mock responses when file not available
   */
  private getDefaultMockResponses(): VoiceAnalysisResult[] {
    return [
      {
        transcript: 'Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low',
        intent: {
          action: 'scout',
          assetType: 'nft',
          priceLimit: 50,
          riskPreference: 'low',
        },
        emotion: {
          confidence: 0.85,
          urgency: 0.6,
        },
        fraudScore: 0.15,
        approved: true,
        timestamp: new Date().toISOString(),
      },
      {
        transcript: 'Find me some NEAR tokens to buy quickly',
        intent: {
          action: 'scout',
          assetType: 'token',
          priceLimit: undefined,
          riskPreference: 'medium',
        },
        emotion: {
          confidence: 0.75,
          urgency: 0.8,
        },
        fraudScore: 0.25,
        approved: true,
        timestamp: new Date().toISOString(),
      },
      {
        transcript: 'Buy this NFT now for 100 NEAR urgent',
        intent: {
          action: 'buy',
          assetType: 'nft',
          priceLimit: 100,
          riskPreference: 'high',
        },
        emotion: {
          confidence: 0.9,
          urgency: 0.95,
        },
        fraudScore: 0.85,
        approved: false,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}
