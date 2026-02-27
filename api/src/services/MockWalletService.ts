/**
 * Mock Wallet Service - Simulates NEAR blockchain transactions
 * 
 * This service demonstrates TEE-secured transaction execution:
 * - Credentials retrieved from TEE vault (never exposed)
 * - Transactions signed in secure context
 * - Balance tracking and validation
 * - Complete audit trail
 * 
 * Requirements: 6.2, 6.4, 13.1, 13.2, 13.3, 13.4, 13.5
 */

import crypto from 'crypto';
import { getTEEVaultService } from './TEEVaultService';
import { getNeo4jClient } from '../utils/neo4j-client';

interface TransactionRequest {
  operation: 'transfer' | 'nft_buy' | 'token_swap';
  recipient?: string;
  amount?: number;
  tokenId?: string;
  contractAddress?: string;
  userId: string;
}

interface TransactionResult {
  success: boolean;
  transactionHash: string;
  signedPayload: {
    nonce: number;
    blockHash: string;
    actions: string[];
  };
  gasUsed: number;
  timestamp: string;
  credentialsExposed: boolean; // Always false
  balanceAfter: number;
  error?: string;
}

interface WalletBalance {
  userId: string;
  balance: number;
  lastUpdated: Date;
}

export class MockWalletService {
  private balances: Map<string, WalletBalance> = new Map();
  private nonce: number = 0;

  constructor() {
    // Initialize demo balances
    this.balances.set('demo-user-alice', {
      userId: 'demo-user-alice',
      balance: 1000.0,
      lastUpdated: new Date(),
    });
  }

  /**
   * Execute a mock NEAR transaction
   * Requirements: 6.4, 13.1, 13.2
   */
  async executeTransaction(request: TransactionRequest): Promise<TransactionResult> {
    try {
      // 1. Retrieve credentials from TEE vault (NEVER exposed)
      const credentials = await this.getCredentialsFromTEE(request.userId);
      
      if (!credentials) {
        return this.createErrorResult('Failed to retrieve credentials from TEE vault');
      }

      // 2. Validate balance
      const currentBalance = this.getBalance(request.userId);
      const amount = request.amount || 0;
      const gasFee = 0.1; // Mock gas fee
      const totalCost = amount + gasFee;

      if (totalCost > currentBalance) {
        return this.createErrorResult(
          `Insufficient balance: ${totalCost} NEAR required, ${currentBalance} NEAR available`,
          currentBalance
        );
      }

      // 3. Generate transaction hash (SHA-256 of transaction data)
      const txHash = this.generateTransactionHash(request, credentials.accountId);

      // 4. Create signed payload (simulated signing with private key)
      const signedPayload = this.createSignedPayload(request, credentials.accountId);

      // 5. Update balance
      const newBalance = currentBalance - totalCost;
      this.updateBalance(request.userId, newBalance);

      // 6. Log transaction to Neo4j
      await this.logTransaction(request, txHash, newBalance);

      // 7. Return result (credentials NEVER exposed)
      return {
        success: true,
        transactionHash: txHash,
        signedPayload,
        gasUsed: 100000, // Mock gas amount
        timestamp: new Date().toISOString(),
        credentialsExposed: false, // CRITICAL: Always false
        balanceAfter: newBalance,
      };

    } catch (error) {
      console.error('Transaction execution failed:', error);
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get current balance for user
   * Requirements: 13.3
   */
  getBalance(userId: string): number {
    const balance = this.balances.get(userId);
    return balance ? balance.balance : 1000.0; // Default starting balance
  }

  /**
   * Update balance after transaction
   * Requirements: 13.3, 13.5
   */
  private updateBalance(userId: string, newBalance: number): void {
    this.balances.set(userId, {
      userId,
      balance: newBalance,
      lastUpdated: new Date(),
    });
  }

  /**
   * Retrieve credentials from TEE vault
   * CRITICAL: Credentials are NEVER logged or exposed
   * Requirements: 6.1, 6.3, 6.5
   */
  private async getCredentialsFromTEE(userId: string): Promise<{
    privateKey: string;
    accountId: string;
  } | null> {
    const vault = getTEEVaultService();
    
    // Retrieve from encrypted vault
    const privateKey = await vault.getCredential('near_private_key', userId);
    const accountId = await vault.getCredential('near_account_id', userId);

    if (!privateKey || !accountId) {
      return null;
    }

    // Return credentials (NEVER log these values)
    return { privateKey, accountId };
  }

  /**
   * Generate transaction hash using SHA-256
   * Requirements: 6.4, 13.2
   */
  private generateTransactionHash(request: TransactionRequest, accountId: string): string {
    const data = JSON.stringify({
      operation: request.operation,
      userId: request.userId,
      accountId,
      amount: request.amount,
      timestamp: Date.now(),
      nonce: this.nonce++,
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create signed transaction payload
   * Requirements: 6.4, 13.2
   */
  private createSignedPayload(request: TransactionRequest, accountId: string): {
    nonce: number;
    blockHash: string;
    actions: string[];
  } {
    return {
      nonce: this.nonce,
      blockHash: this.generateMockBlockHash(),
      actions: [
        `Action: ${request.operation}`,
        `From: ${accountId}`,
        `Amount: ${request.amount || 0} NEAR`,
        request.recipient ? `To: ${request.recipient}` : '',
        request.tokenId ? `Token: ${request.tokenId}` : '',
      ].filter(Boolean),
    };
  }

  /**
   * Generate mock block hash
   */
  private generateMockBlockHash(): string {
    const data = `block_${Date.now()}_${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Log transaction to Neo4j
   * Requirements: 7.1, 13.4
   */
  private async logTransaction(
    request: TransactionRequest,
    txHash: string,
    balanceAfter: number
  ): Promise<void> {
    try {
      const neo4jClient = getNeo4jClient();
      
      await neo4jClient.executeWrite(`
        CREATE (tx:Transaction {
          id: $txHash,
          hash: $txHash,
          type: $operation,
          assetId: $tokenId,
          amount: $amount,
          price: $amount,
          fees: 0.1,
          status: 'completed',
          timestamp: datetime($timestamp),
          credentialsExposed: false,
          balanceAfter: $balanceAfter
        })
        WITH tx
        MATCH (u:User {id: $userId})
        CREATE (u)-[:EXECUTED_TX]->(tx)
      `, {
        txHash,
        operation: request.operation,
        tokenId: request.tokenId || 'NEAR',
        amount: request.amount || 0,
        timestamp: new Date().toISOString(),
        userId: request.userId,
        balanceAfter,
      });

      console.log(`Transaction logged to Neo4j: ${txHash}`);
    } catch (error) {
      console.error('Failed to log transaction to Neo4j:', error);
      // Don't throw - logging failure shouldn't break the transaction
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(error: string, balance?: number): TransactionResult {
    return {
      success: false,
      transactionHash: '',
      signedPayload: {
        nonce: 0,
        blockHash: '',
        actions: [error],
      },
      gasUsed: 0,
      timestamp: new Date().toISOString(),
      credentialsExposed: false, // CRITICAL: Always false even on error
      balanceAfter: balance || 0,
      error,
    };
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const neo4jClient = getNeo4jClient();
      
      const result = await neo4jClient.executeQuery(`
        MATCH (u:User {id: $userId})-[:EXECUTED_TX]->(tx:Transaction)
        RETURN tx
        ORDER BY tx.timestamp DESC
        LIMIT $limit
      `, { userId, limit });

      return result.records.map(record => record.get('tx').properties);
    } catch (error) {
      console.error('Failed to retrieve transaction history:', error);
      return [];
    }
  }
}

// Singleton instance
let mockWalletService: MockWalletService | null = null;

export function getMockWalletService(): MockWalletService {
  if (!mockWalletService) {
    mockWalletService = new MockWalletService();
  }
  return mockWalletService;
}
