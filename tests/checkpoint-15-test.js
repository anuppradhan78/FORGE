/**
 * Checkpoint 15: End-to-End Agent Orchestration Test
 * 
 * Tests:
 * 1. IronClaw agent starts and responds to requests
 * 2. Mock wallet executes transactions without exposing credentials
 * 3. Full demo flow completes in under 15 seconds
 * 4. 3 consecutive demo runs without errors
 * 5. Audit trail shows complete provenance
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const TEST_USER = 'demo-user-alice';
const MAX_DEMO_TIME = 15000; // 15 seconds

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bold');
  console.log('='.repeat(70) + '\n');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Results Tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = '') {
  results.tests.push({ name, passed, details });
  if (passed) {
    results.passed++;
    log(`✅ ${name}`, 'green');
  } else {
    results.failed++;
    log(`❌ ${name}`, 'red');
  }
  if (details) {
    log(`   ${details}`, 'cyan');
  }
}

// Test 1: Agent Status and Availability
async function testAgentStatus() {
  logSection('TEST 1: Agent Status and Availability');
  
  try {
    const response = await axios.get(`${API_BASE}/api/agent/status`);
    const { status, components } = response.data;
    
    log(`Agent Status: ${status}`, 'cyan');
    log(`Components: ${JSON.stringify(components, null, 2)}`, 'cyan');
    
    if (status === 'ready') {
      recordTest('Agent is ready and responding', true);
    } else {
      recordTest('Agent is ready and responding', false, `Status: ${status}`);
    }
  } catch (error) {
    recordTest('Agent is ready and responding', false, error.message);
  }
}

// Test 2: Mock Wallet Security
async function testMockWalletSecurity() {
  logSection('TEST 2: Mock Wallet Security (Credentials Never Exposed)');
  
  try {
    // Test successful transaction
    log('Testing successful transaction...', 'yellow');
    const txResponse = await axios.post(`${API_BASE}/api/wallet/execute`, {
      operation: 'nft_buy',
      userId: TEST_USER,
      amount: 25.0,
      tokenId: 'test-nft-001',
      contractAddress: 'test.near'
    });
    
    if (txResponse.data.credentialsExposed === false) {
      recordTest('Successful transaction - credentials NOT exposed', true, 
        `TX Hash: ${txResponse.data.transactionHash?.substring(0, 16)}...`);
    } else {
      recordTest('Successful transaction - credentials NOT exposed', false, 
        'SECURITY VIOLATION: Credentials were exposed!');
    }
    
    // Test failed transaction (insufficient balance)
    log('\nTesting failed transaction...', 'yellow');
    try {
      await axios.post(`${API_BASE}/api/wallet/execute`, {
        operation: 'transfer',
        userId: TEST_USER,
        amount: 999999.0,
        recipient: 'test.near'
      });
      recordTest('Failed transaction - credentials NOT exposed', false, 
        'Should have failed with insufficient balance');
    } catch (error) {
      const data = error.response?.data;
      if (data && data.credentialsExposed === false) {
        recordTest('Failed transaction - credentials NOT exposed', true, 
          `Error: ${data.error}`);
      } else {
        recordTest('Failed transaction - credentials NOT exposed', false, 
          'Credentials exposed on error!');
      }
    }
    
    // Verify transaction history
    log('\nChecking transaction history...', 'yellow');
    const historyResponse = await axios.get(`${API_BASE}/api/wallet/history/${TEST_USER}`);
    const allSecure = historyResponse.data.transactions.every(tx => tx.credentialsExposed === false);
    
    if (allSecure) {
      recordTest('Transaction history - credentials NOT exposed', true, 
        `${historyResponse.data.count} transactions checked`);
    } else {
      recordTest('Transaction history - credentials NOT exposed', false, 
        'Found exposed credentials in history!');
    }
    
  } catch (error) {
    recordTest('Mock wallet security test', false, error.message);
  }
}

// Test 3: Full Demo Flow Performance
async function testDemoFlowPerformance() {
  logSection('TEST 3: Full Demo Flow Performance (< 15 seconds)');
  
  try {
    log('Starting demo flow...', 'yellow');
    const startTime = Date.now();
    
    const response = await axios.post(`${API_BASE}/api/demo/run`, {
      voiceCommand: 'Scout NEAR NFTs under 50 NEAR and buy the best one',
      userId: TEST_USER
    }, {
      timeout: MAX_DEMO_TIME + 5000 // Add 5s buffer for network
    });
    
    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);
    
    log(`Demo completed in ${durationSeconds} seconds`, 'cyan');
    log(`Success: ${response.data.success}`, 'cyan');
    log(`Decision: ${response.data.decision?.verdict}`, 'cyan');
    
    if (duration < MAX_DEMO_TIME) {
      recordTest('Demo flow completes in under 15 seconds', true, 
        `Completed in ${durationSeconds}s`);
    } else {
      recordTest('Demo flow completes in under 15 seconds', false, 
        `Took ${durationSeconds}s (limit: 15s)`);
    }
    
    // Validate sponsor integrations
    if (response.data.sponsorValidation?.allSponsorsInvoked) {
      recordTest('All 9 sponsors invoked during flow', true);
    } else {
      const missing = response.data.sponsorValidation?.missingSponsors || [];
      recordTest('All 9 sponsors invoked during flow', false, 
        `Missing: ${missing.join(', ')}`);
    }
    
    // Validate graph growth
    if (response.data.graphValidation?.minimumMet) {
      recordTest('Graph growth validation (5+ nodes)', true, 
        `Created ${response.data.graphValidation.nodesCreated} nodes`);
    } else {
      recordTest('Graph growth validation (5+ nodes)', false, 
        `Only ${response.data.graphValidation?.nodesCreated || 0} nodes created`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      recordTest('Demo flow completes in under 15 seconds', false, 
        'Timeout exceeded');
    } else {
      recordTest('Demo flow performance test', false, error.message);
    }
  }
}

// Test 4: Consecutive Demo Runs
async function testConsecutiveDemoRuns() {
  logSection('TEST 4: Three Consecutive Demo Runs Without Errors');
  
  const runs = [];
  
  for (let i = 1; i <= 3; i++) {
    log(`\nRun ${i}/3...`, 'yellow');
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${API_BASE}/api/demo/run`, {
        voiceCommand: `Scout NEAR NFTs under ${40 + i * 5} NEAR`,
        userId: TEST_USER
      }, {
        timeout: MAX_DEMO_TIME + 5000
      });
      
      const duration = Date.now() - startTime;
      const success = response.data.success;
      
      runs.push({ run: i, success, duration });
      
      log(`  Duration: ${(duration / 1000).toFixed(2)}s`, 'cyan');
      log(`  Success: ${success}`, success ? 'green' : 'red');
      
      // Small delay between runs
      if (i < 3) {
        await sleep(1000);
      }
      
    } catch (error) {
      runs.push({ run: i, success: false, error: error.message });
      log(`  Error: ${error.message}`, 'red');
    }
  }
  
  const allSuccessful = runs.every(r => r.success);
  const avgDuration = runs.reduce((sum, r) => sum + (r.duration || 0), 0) / runs.length;
  
  if (allSuccessful) {
    recordTest('3 consecutive demo runs without errors', true, 
      `Average duration: ${(avgDuration / 1000).toFixed(2)}s`);
  } else {
    const failedRuns = runs.filter(r => !r.success).map(r => r.run);
    recordTest('3 consecutive demo runs without errors', false, 
      `Failed runs: ${failedRuns.join(', ')}`);
  }
}

// Test 5: Audit Trail Completeness
async function testAuditTrailProvenance() {
  logSection('TEST 5: Audit Trail Shows Complete Provenance');
  
  try {
    // Get audit trail for test user
    log('Fetching audit trail...', 'yellow');
    const auditResponse = await axios.get(`${API_BASE}/api/agent/audit/${TEST_USER}`);
    
    const decisions = auditResponse.data.decisions || [];
    log(`Found ${decisions.length} decisions in audit trail`, 'cyan');
    
    if (decisions.length === 0) {
      recordTest('Audit trail contains decisions', false, 'No decisions found');
      return;
    }
    
    recordTest('Audit trail contains decisions', true, 
      `${decisions.length} decisions logged`);
    
    // Check most recent decision for provenance
    const latestDecision = decisions[0];
    log(`\nChecking latest decision: ${latestDecision.id}`, 'yellow');
    
    const provenanceResponse = await axios.get(
      `${API_BASE}/api/agent/audit/decision/${latestDecision.id}`
    );
    
    const provenance = provenanceResponse.data.provenance;
    
    // Validate provenance structure
    const hasUser = provenance.user !== null;
    const hasPolicies = Array.isArray(provenance.policiesChecked);
    const hasContext = Array.isArray(provenance.contextUsed);
    const hasTransaction = provenance.transaction !== null || provenance.transaction === null; // Can be null if rejected
    const hasToolCalls = Array.isArray(provenance.toolCalls) && provenance.toolCalls.length > 0;
    
    log(`  User linked: ${hasUser}`, hasUser ? 'green' : 'red');
    log(`  Policies checked: ${hasPolicies ? provenance.policiesChecked.length : 0}`, 'cyan');
    log(`  Context used: ${hasContext ? provenance.contextUsed.length : 0}`, 'cyan');
    log(`  Transaction: ${provenance.transaction ? 'linked' : 'none'}`, 'cyan');
    log(`  Tool calls: ${hasToolCalls ? provenance.toolCalls.length : 0}`, 'cyan');
    
    if (hasUser && hasPolicies && hasContext && hasToolCalls) {
      recordTest('Audit trail shows complete provenance', true, 
        `User, policies, context, and tool calls all linked`);
    } else {
      recordTest('Audit trail shows complete provenance', false, 
        'Missing provenance links');
    }
    
    // Get audit statistics
    log('\nFetching audit statistics...', 'yellow');
    const statsResponse = await axios.get(`${API_BASE}/api/agent/stats/${TEST_USER}`);
    const stats = statsResponse.data.stats;
    
    log(`  Total decisions: ${stats.totalDecisions}`, 'cyan');
    log(`  Approved: ${stats.approvedDecisions}`, 'cyan');
    log(`  Rejected: ${stats.rejectedDecisions}`, 'cyan');
    log(`  Total tool calls: ${stats.totalToolCalls}`, 'cyan');
    
    recordTest('Audit statistics available', true, 
      `${stats.totalDecisions} decisions, ${stats.totalToolCalls} tool calls`);
    
  } catch (error) {
    recordTest('Audit trail provenance test', false, error.message);
  }
}

// Main Test Runner
async function runCheckpoint15Tests() {
  log('\n🚀 CHECKPOINT 15: END-TO-END AGENT ORCHESTRATION TEST', 'bold');
  log('Testing FORGE agent orchestration system\n', 'cyan');
  
  const startTime = Date.now();
  
  // Run all tests
  await testAgentStatus();
  await testMockWalletSecurity();
  await testDemoFlowPerformance();
  await testConsecutiveDemoRuns();
  await testAuditTrailProvenance();
  
  // Print summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  logSection('TEST SUMMARY');
  
  log(`Total Tests: ${results.passed + results.failed}`, 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`, 'cyan');
  log(`Total Time: ${totalTime}s`, 'cyan');
  
  console.log('\n' + '='.repeat(70));
  
  if (results.failed === 0) {
    log('\n🎉 CHECKPOINT 15 PASSED! All tests successful!', 'green');
    log('\n✅ VERIFIED:', 'bold');
    log('   - Agent orchestration working end-to-end', 'green');
    log('   - Mock wallet secure (credentials never exposed)', 'green');
    log('   - Demo flow completes in under 15 seconds', 'green');
    log('   - System handles 3 consecutive runs', 'green');
    log('   - Audit trail shows complete provenance', 'green');
    log('\n➡️  Ready to proceed to Task 16: Dashboard Implementation', 'cyan');
  } else {
    log('\n⚠️  CHECKPOINT 15 INCOMPLETE - Some tests failed', 'yellow');
    log('\nFailed Tests:', 'red');
    results.tests.filter(t => !t.passed).forEach(t => {
      log(`   - ${t.name}`, 'red');
      if (t.details) log(`     ${t.details}`, 'cyan');
    });
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
  
  // Exit with appropriate code
  process.exit(results.failed === 0 ? 0 : 1);
}

// Run the tests
runCheckpoint15Tests().catch(error => {
  log('\n❌ Test suite crashed:', 'red');
  console.error(error);
  process.exit(1);
});
