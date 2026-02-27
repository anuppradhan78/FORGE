/*!
 * Mock NEAR Wallet - WASM Tool for IronClaw TEE
 * 
 * This tool simulates NEAR blockchain transactions in a secure TEE environment.
 * Credentials are never exposed to the LLM - all operations happen in the WASM sandbox.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.1, 13.2, 13.3, 13.4, 13.5
 */

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ============================================================================
// Data Structures
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionRequest {
    pub operation: String,  // "transfer", "nft_buy", "token_swap"
    pub recipient: Option<String>,
    pub amount: Option<f64>,
    pub token_id: Option<String>,
    pub contract_address: Option<String>,
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionResult {
    pub success: bool,
    pub transaction_hash: String,
    pub signed_payload: SignedPayload,
    pub gas_used: u64,
    pub timestamp: String,
    pub credentials_exposed: bool,  // Always false - enforced by TEE
    pub balance_after: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SignedPayload {
    pub nonce: u64,
    pub block_hash: String,
    pub actions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultCredentials {
    pub private_key: String,  // Never logged or exposed
    pub account_id: String,
}

// ============================================================================
// Mock Wallet State (In-Memory)
// ============================================================================

thread_local! {
    static BALANCES: std::cell::RefCell<HashMap<String, f64>> = 
        std::cell::RefCell::new(HashMap::new());
}

// ============================================================================
// Core Wallet Functions
// ============================================================================

/// Initialize wallet with starting balance
#[wasm_bindgen]
pub fn init_wallet(user_id: &str, initial_balance: f64) {
    BALANCES.with(|balances| {
        balances.borrow_mut().insert(user_id.to_string(), initial_balance);
    });
}

/// Get current balance for user
#[wasm_bindgen]
pub fn get_balance(user_id: &str) -> f64 {
    BALANCES.with(|balances| {
        *balances.borrow().get(user_id).unwrap_or(&1000.0)
    })
}

/// Execute a mock NEAR transaction
/// This is the main entry point called by IronClaw agent
#[wasm_bindgen]
pub fn execute_transaction(request_json: &str) -> String {
    // Parse request
    let request: TransactionRequest = match serde_json::from_str(request_json) {
        Ok(req) => req,
        Err(e) => {
            return serde_json::to_string(&TransactionResult {
                success: false,
                transaction_hash: String::new(),
                signed_payload: SignedPayload {
                    nonce: 0,
                    block_hash: String::new(),
                    actions: vec![],
                },
                gas_used: 0,
                timestamp: get_timestamp(),
                credentials_exposed: false,
                balance_after: 0.0,
            }).unwrap();
        }
    };

    // Retrieve credentials from TEE vault (simulated)
    let credentials = retrieve_credentials_from_tee(&request.user_id);
    
    // Log TEE access (without exposing credentials)
    log_tee_access(&request.user_id);

    // Check balance
    let current_balance = get_balance(&request.user_id);
    let amount = request.amount.unwrap_or(0.0);
    
    if amount > current_balance {
        return serde_json::to_string(&TransactionResult {
            success: false,
            transaction_hash: String::new(),
            signed_payload: SignedPayload {
                nonce: 0,
                block_hash: String::new(),
                actions: vec![format!("Insufficient balance: {} > {}", amount, current_balance)],
            },
            gas_used: 0,
            timestamp: get_timestamp(),
            credentials_exposed: false,
            balance_after: current_balance,
        }).unwrap();
    }

    // Generate transaction hash (SHA-256 of transaction data)
    let tx_hash = generate_transaction_hash(&request, &credentials);

    // Create signed payload
    let signed_payload = create_signed_payload(&request, &credentials);

    // Update balance
    let new_balance = current_balance - amount - 0.1; // 0.1 NEAR gas fee
    BALANCES.with(|balances| {
        balances.borrow_mut().insert(request.user_id.clone(), new_balance);
    });

    // Simulate realistic response time (200-500ms would happen naturally)
    
    // Return transaction result
    let result = TransactionResult {
        success: true,
        transaction_hash: tx_hash,
        signed_payload,
        gas_used: 100000, // Mock gas amount
        timestamp: get_timestamp(),
        credentials_exposed: false, // CRITICAL: Always false
        balance_after: new_balance,
    };

    serde_json::to_string(&result).unwrap()
}

// ============================================================================
// TEE Security Functions
// ============================================================================

/// Retrieve credentials from TEE vault
/// In real implementation, this would access IronClaw's encrypted vault
/// Credentials are NEVER logged or exposed outside this function
fn retrieve_credentials_from_tee(user_id: &str) -> VaultCredentials {
    // Simulated credential retrieval
    // In production, this would call: SecretVault::get_secret("near_private_key")
    VaultCredentials {
        private_key: format!("ed25519:MOCK_KEY_{}", user_id), // Never exposed
        account_id: format!("{}.near", user_id),
    }
}

/// Log TEE credential access without exposing values
fn log_tee_access(user_id: &str) {
    // This would write to audit trail in Neo4j
    // Format: "TEE: Credentials accessed for user {user_id}"
    // NEVER log the actual credentials
}

// ============================================================================
// Transaction Helpers
// ============================================================================

/// Generate transaction hash using SHA-256
fn generate_transaction_hash(request: &TransactionRequest, credentials: &VaultCredentials) -> String {
    let mut hasher = Sha256::new();
    
    // Hash transaction data
    hasher.update(request.operation.as_bytes());
    hasher.update(request.user_id.as_bytes());
    hasher.update(credentials.account_id.as_bytes());
    hasher.update(get_timestamp().as_bytes());
    
    if let Some(amount) = request.amount {
        hasher.update(amount.to_string().as_bytes());
    }
    
    let result = hasher.finalize();
    hex::encode(result)
}

/// Create signed transaction payload
fn create_signed_payload(request: &TransactionRequest, credentials: &VaultCredentials) -> SignedPayload {
    SignedPayload {
        nonce: get_nonce(),
        block_hash: generate_mock_block_hash(),
        actions: vec![
            format!("Action: {}", request.operation),
            format!("From: {}", credentials.account_id),
            format!("Amount: {} NEAR", request.amount.unwrap_or(0.0)),
        ],
    }
}

/// Generate mock block hash
fn generate_mock_block_hash() -> String {
    let mut hasher = Sha256::new();
    hasher.update(get_timestamp().as_bytes());
    hasher.update(b"mock_block");
    hex::encode(hasher.finalize())
}

/// Get current nonce (incremental counter)
fn get_nonce() -> u64 {
    // In production, this would query the blockchain
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Get current timestamp in ISO 8601 format
fn get_timestamp() -> String {
    // For WASM, we'd use js_sys::Date
    // For now, return a mock timestamp
    "2026-02-27T10:00:00Z".to_string()
}

// ============================================================================
// WASM Exports
// ============================================================================

#[wasm_bindgen]
pub fn get_tool_info() -> String {
    serde_json::to_string(&serde_json::json!({
        "name": "mock_wallet",
        "version": "0.1.0",
        "description": "Mock NEAR wallet with TEE-secured credential management",
        "operations": ["transfer", "nft_buy", "token_swap"],
        "security": "TEE-secured, credentials never exposed"
    })).unwrap()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_hash_generation() {
        let request = TransactionRequest {
            operation: "transfer".to_string(),
            recipient: Some("alice.near".to_string()),
            amount: Some(10.0),
            token_id: None,
            contract_address: None,
            user_id: "test-user".to_string(),
        };
        
        let credentials = VaultCredentials {
            private_key: "mock_key".to_string(),
            account_id: "test.near".to_string(),
        };
        
        let hash = generate_transaction_hash(&request, &credentials);
        assert_eq!(hash.len(), 64); // SHA-256 produces 64 hex characters
    }

    #[test]
    fn test_balance_tracking() {
        init_wallet("test-user", 1000.0);
        assert_eq!(get_balance("test-user"), 1000.0);
    }

    #[test]
    fn test_insufficient_balance() {
        init_wallet("poor-user", 10.0);
        
        let request = TransactionRequest {
            operation: "transfer".to_string(),
            recipient: Some("alice.near".to_string()),
            amount: Some(100.0),
            token_id: None,
            contract_address: None,
            user_id: "poor-user".to_string(),
        };
        
        let result_json = execute_transaction(&serde_json::to_string(&request).unwrap());
        let result: TransactionResult = serde_json::from_str(&result_json).unwrap();
        
        assert_eq!(result.success, false);
        assert_eq!(result.credentials_exposed, false);
    }
}
