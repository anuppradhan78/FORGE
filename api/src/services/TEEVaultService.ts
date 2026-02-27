/**
 * TEE Vault Service - Simulates IronClaw's encrypted credential vault
 * 
 * In production, this would be replaced by actual IronClaw TEE vault.
 * For the POC, we simulate the security model:
 * - Credentials stored encrypted
 * - Never logged or exposed to LLM
 * - Access audited to Neo4j
 * 
 * Requirements: 6.1, 6.3, 6.5
 */

import crypto from 'crypto';
import { getNeo4jClient } from '../utils/neo4j-client';

interface VaultCredential {
  key: string;
  value: string;
  encrypted: boolean;
  createdAt: Date;
  lastAccessed?: Date;
}

interface TEEAccessLog {
  userId: string;
  credentialKey: string;
  timestamp: Date;
  operation: 'read' | 'write';
  exposed: boolean; // Always false
}

export class TEEVaultService {
  private vault: Map<string, VaultCredential> = new Map();
  private encryptionKey: Buffer;

  constructor() {
    // In production, this would be a hardware-backed key in TEE
    this.encryptionKey = crypto.scryptSync(
      process.env.TEE_VAULT_ENCRYPTION || 'forge-tee-key',
      'salt',
      32
    );
  }

  /**
   * Store a credential in the encrypted vault
   * Requirements: 6.1
   */
  async storeCredential(key: string, value: string, userId: string): Promise<void> {
    const encrypted = this.encrypt(value);
    
    this.vault.set(key, {
      key,
      value: encrypted,
      encrypted: true,
      createdAt: new Date(),
    });

    // Log to audit trail (without exposing value)
    await this.logTEEAccess({
      userId,
      credentialKey: key,
      timestamp: new Date(),
      operation: 'write',
      exposed: false,
    });

    console.log(`TEE: Credential stored for key: ${key} (encrypted)`);
  }

  /**
   * Retrieve a credential from the vault
   * CRITICAL: Value is never logged or exposed outside this function
   * Requirements: 6.3, 6.5
   */
  async getCredential(key: string, userId: string): Promise<string | null> {
    const credential = this.vault.get(key);
    
    if (!credential) {
      console.log(`TEE: Credential not found for key: ${key}`);
      return null;
    }

    // Update last accessed time
    credential.lastAccessed = new Date();

    // Decrypt the value
    const decrypted = this.decrypt(credential.value);

    // Log access to audit trail (WITHOUT exposing the credential)
    await this.logTEEAccess({
      userId,
      credentialKey: key,
      timestamp: new Date(),
      operation: 'read',
      exposed: false, // CRITICAL: Always false
    });

    console.log(`TEE: Credentials accessed for user ${userId}`);
    // NEVER log the actual credential value

    return decrypted;
  }

  /**
   * Check if a credential exists
   */
  hasCredential(key: string): boolean {
    return this.vault.has(key);
  }

  /**
   * Delete a credential from the vault
   */
  async deleteCredential(key: string, userId: string): Promise<boolean> {
    const deleted = this.vault.delete(key);
    
    if (deleted) {
      await this.logTEEAccess({
        userId,
        credentialKey: key,
        timestamp: new Date(),
        operation: 'write',
        exposed: false,
      });
      
      console.log(`TEE: Credential deleted for key: ${key}`);
    }
    
    return deleted;
  }

  /**
   * Initialize vault with demo credentials
   * Requirements: 6.1
   */
  async initializeDemoCredentials(): Promise<void> {
    // Store mock NEAR private key
    await this.storeCredential(
      'near_private_key',
      'ed25519:MOCK_PRIVATE_KEY_DEMO_ONLY',
      'demo-user-alice'
    );

    // Store mock account ID
    await this.storeCredential(
      'near_account_id',
      'forge-demo.testnet',
      'demo-user-alice'
    );

    console.log('✅ TEE Vault initialized with demo credentials');
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv + authTag + encrypted (all hex encoded)
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(ciphertext: string): string {
    // Extract iv, authTag, and encrypted data
    const iv = Buffer.from(ciphertext.slice(0, 32), 'hex');
    const authTag = Buffer.from(ciphertext.slice(32, 64), 'hex');
    const encrypted = ciphertext.slice(64);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Log TEE access to Neo4j audit trail
   * Requirements: 6.5, 7.1
   */
  private async logTEEAccess(log: TEEAccessLog): Promise<void> {
    try {
      const neo4jClient = getNeo4jClient();
      
      await neo4jClient.executeWrite(`
        CREATE (log:TEEAccessLog {
          userId: $userId,
          credentialKey: $credentialKey,
          timestamp: datetime($timestamp),
          operation: $operation,
          exposed: $exposed
        })
        WITH log
        MATCH (u:User {id: $userId})
        CREATE (u)-[:ACCESSED_TEE]->(log)
      `, {
        userId: log.userId,
        credentialKey: log.credentialKey,
        timestamp: log.timestamp.toISOString(),
        operation: log.operation,
        exposed: log.exposed,
      });
    } catch (error) {
      console.error('Failed to log TEE access to Neo4j:', error);
      // Don't throw - logging failure shouldn't break the flow
    }
  }

  /**
   * Get TEE access logs for audit
   */
  async getAccessLogs(userId: string): Promise<TEEAccessLog[]> {
    try {
      const neo4jClient = getNeo4jClient();
      
      const result = await neo4jClient.executeQuery(`
        MATCH (u:User {id: $userId})-[:ACCESSED_TEE]->(log:TEEAccessLog)
        RETURN log
        ORDER BY log.timestamp DESC
        LIMIT 100
      `, { userId });

      return result.records.map(record => {
        const log = record.get('log').properties;
        return {
          userId: log.userId,
          credentialKey: log.credentialKey,
          timestamp: new Date(log.timestamp),
          operation: log.operation,
          exposed: log.exposed,
        };
      });
    } catch (error) {
      console.error('Failed to retrieve TEE access logs:', error);
      return [];
    }
  }
}

// Singleton instance
let teeVaultService: TEEVaultService | null = null;

export function getTEEVaultService(): TEEVaultService {
  if (!teeVaultService) {
    teeVaultService = new TEEVaultService();
  }
  return teeVaultService;
}

export async function initializeTEEVault(): Promise<void> {
  const vault = getTEEVaultService();
  await vault.initializeDemoCredentials();
}
