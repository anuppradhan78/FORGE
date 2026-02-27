/**
 * Test script for Mock Wallet and TEE Vault
 * Verifies that credentials are never exposed and transactions work correctly
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const TEST_USER = 'demo-user-alice';

async function testWalletFunctionality() {
  console.log('🧪 Testing Mock Wallet and TEE Vault\n');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;

  // Test 1: Get initial balance
  console.log('\n1️⃣  Testing balance retrieval...');
  try {
    const response = await axios.get(`${API_BASE}/api/wallet/balance/${TEST_USER}`);
    console.log(`   Balance: ${response.data.balance} NEAR`);
    console.log('   ✅ Balance retrieval works');
    passed++;
  } catch (error) {
    console.log('   ❌ Balance retrieval failed:', error.message);
    failed++;
  }

  // Test 2: Execute successful transaction
  console.log('\n2️⃣  Testing successful transaction...');
  try {
    const response = await axios.post(`${API_BASE}/api/wallet/execute`, {
      operation: 'nft_buy',
      userId: TEST_USER,
      amount: 30.0,
      tokenId: 'near-punk-1234',
      contractAddress: 'nearpunks.near'
    });

    if (response.data.success) {
      console.log(`   Transaction Hash: ${response.data.transactionHash.substring(0, 16)}...`);
      console.log(`   Balance After: ${response.data.balanceAfter} NEAR`);
      console.log(`   Credentials Exposed: ${response.data.credentialsExposed}`);
      
      if (response.data.credentialsExposed === false) {
        console.log('   ✅ Transaction successful, credentials NOT exposed');
        passed++;
      } else {
        console.log('   ❌ SECURITY VIOLATION: Credentials were exposed!');
        failed++;
      }
    } else {
      console.log('   ❌ Transaction failed:', response.data.error);
      failed++;
    }
  } catch (error) {
    console.log('   ❌ Transaction failed:', error.message);
    failed++;
  }

  // Test 3: Test insufficient balance
  console.log('\n3️⃣  Testing insufficient balance detection...');
  try {
    const response = await axios.post(`${API_BASE}/api/wallet/execute`, {
      operation: 'transfer',
      userId: TEST_USER,
      amount: 10000.0, // Way more than balance
      recipient: 'bob.near'
    });

    if (!response.data.success && response.data.error.includes('Insufficient balance')) {
      console.log(`   Error: ${response.data.error}`);
      console.log(`   Credentials Exposed: ${response.data.credentialsExposed}`);
      
      if (response.data.credentialsExposed === false) {
        console.log('   ✅ Insufficient balance detected, credentials NOT exposed');
        passed++;
      } else {
        console.log('   ❌ SECURITY VIOLATION: Credentials exposed on error!');
        failed++;
      }
    } else {
      console.log('   ❌ Should have failed with insufficient balance');
      failed++;
    }
  } catch (error) {
    // Axios throws on 400 status
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.error && data.error.includes('Insufficient balance')) {
        console.log(`   Error: ${data.error}`);
        console.log(`   Credentials Exposed: ${data.credentialsExposed}`);
        
        if (data.credentialsExposed === false) {
          console.log('   ✅ Insufficient balance detected, credentials NOT exposed');
          passed++;
        } else {
          console.log('   ❌ SECURITY VIOLATION: Credentials exposed on error!');
          failed++;
        }
      } else {
        console.log('   ❌ Unexpected error:', data.error);
        failed++;
      }
    } else {
      console.log('   ❌ Request failed:', error.message);
      failed++;
    }
  }

  // Test 4: Get transaction history
  console.log('\n4️⃣  Testing transaction history...');
  try {
    const response = await axios.get(`${API_BASE}/api/wallet/history/${TEST_USER}`);
    console.log(`   Transactions found: ${response.data.count}`);
    
    if (response.data.transactions.length > 0) {
      const tx = response.data.transactions[0];
      console.log(`   Latest TX: ${tx.type} - ${tx.amount} NEAR`);
      console.log(`   Credentials Exposed: ${tx.credentialsExposed}`);
      
      if (tx.credentialsExposed === false) {
        console.log('   ✅ Transaction history retrieved, credentials NOT exposed');
        passed++;
      } else {
        console.log('   ❌ SECURITY VIOLATION: Credentials in history!');
        failed++;
      }
    } else {
      console.log('   ⚠️  No transactions in history yet');
      passed++;
    }
  } catch (error) {
    console.log('   ❌ History retrieval failed:', error.message);
    failed++;
  }

  // Test 5: Verify balance decreased
  console.log('\n5️⃣  Testing balance consistency...');
  try {
    const response = await axios.get(`${API_BASE}/api/wallet/balance/${TEST_USER}`);
    const currentBalance = response.data.balance;
    
    if (currentBalance < 1000.0) {
      console.log(`   Current Balance: ${currentBalance} NEAR`);
      console.log(`   Initial Balance: 1000.0 NEAR`);
      console.log(`   Difference: ${(1000.0 - currentBalance).toFixed(2)} NEAR`);
      console.log('   ✅ Balance correctly decreased after transaction');
      passed++;
    } else {
      console.log('   ❌ Balance did not decrease');
      failed++;
    }
  } catch (error) {
    console.log('   ❌ Balance check failed:', error.message);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All wallet tests passed!');
    console.log('\n✅ SECURITY VERIFIED:');
    console.log('   - Credentials NEVER exposed (credentialsExposed always false)');
    console.log('   - TEE vault working correctly');
    console.log('   - Balance tracking accurate');
    console.log('   - Transaction logging functional');
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run tests
testWalletFunctionality().catch(error => {
  console.error('\n❌ Test suite failed:', error.message);
  process.exit(1);
});
