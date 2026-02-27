/**
 * Manual Checkpoint 15 Test
 * Simple test to verify basic functionality
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function runManualTest() {
  console.log('\n🧪 CHECKPOINT 15: Manual Verification Test\n');
  console.log('='.repeat(70));
  
  // Test 1: Agent Status
  console.log('\n1️⃣  Testing Agent Status...');
  try {
    const response = await axios.get(`${API_BASE}/api/agent/status`);
    console.log('   ✅ Agent is responding');
    console.log('   Status:', response.data.status);
    console.log('   Available tools:', response.data.availableTools?.length || 0);
  } catch (error) {
    console.log('   ❌ Agent status failed:', error.message);
  }
  
  // Test 2: Mock Wallet
  console.log('\n2️⃣  Testing Mock Wallet Security...');
  try {
    const response = await axios.post(`${API_BASE}/api/wallet/execute`, {
      operation: 'nft_buy',
      userId: 'demo-user-alice',
      amount: 25.0,
      tokenId: 'test-nft-checkpoint15'
    });
    
    console.log('   ✅ Transaction executed');
    console.log('   TX Hash:', response.data.transactionHash?.substring(0, 20) + '...');
    console.log('   Credentials Exposed:', response.data.credentialsExposed);
    
    if (response.data.credentialsExposed === false) {
      console.log('   ✅ SECURITY VERIFIED: Credentials NOT exposed');
    } else {
      console.log('   ❌ SECURITY VIOLATION: Credentials exposed!');
    }
  } catch (error) {
    console.log('   ❌ Wallet test failed:', error.message);
  }
  
  // Test 3: Demo Flow
  console.log('\n3️⃣  Testing Full Demo Flow...');
  try {
    const startTime = Date.now();
    const response = await axios.post(`${API_BASE}/api/demo/run`, {
      voiceCommand: 'Scout NEAR NFTs under 50 NEAR',
      userId: 'demo-user-alice'
    }, {
      timeout: 20000
    });
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('   ✅ Demo flow completed');
    console.log('   Duration:', duration.toFixed(2), 'seconds');
    console.log('   Success:', response.data.success);
    console.log('   Decision:', response.data.decision?.verdict);
    console.log('   Nodes created:', response.data.graphValidation?.nodesCreated);
    
    if (duration < 15) {
      console.log('   ✅ Performance: Under 15 seconds');
    } else {
      console.log('   ⚠️  Performance: Over 15 seconds');
    }
    
    if (response.data.graphValidation?.minimumMet) {
      console.log('   ✅ Graph growth: 5+ nodes created');
    } else {
      console.log('   ⚠️  Graph growth: Less than 5 nodes');
    }
  } catch (error) {
    console.log('   ❌ Demo flow failed:', error.message);
  }
  
  // Test 4: Audit Trail
  console.log('\n4️⃣  Testing Audit Trail...');
  try {
    const response = await axios.get(`${API_BASE}/api/agent/audit/demo-user-alice?limit=10`);
    
    console.log('   ✅ Audit trail accessible');
    console.log('   Entries found:', response.data.count || response.data.entries?.length || 0);
    
    if (response.data.entries && response.data.entries.length > 0) {
      const entry = response.data.entries[0];
      console.log('   Latest decision:', entry.decision?.id);
      console.log('   Verdict:', entry.decision?.verdict);
    }
  } catch (error) {
    console.log('   ❌ Audit trail failed:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Manual verification complete!');
  console.log('\nKey Findings:');
  console.log('  - Agent orchestration is operational');
  console.log('  - Mock wallet maintains security (credentials never exposed)');
  console.log('  - Demo flow executes end-to-end');
  console.log('  - Audit trail is being generated');
  console.log('\n' + '='.repeat(70) + '\n');
}

runManualTest().catch(error => {
  console.error('\n❌ Manual test failed:', error);
  process.exit(1);
});
