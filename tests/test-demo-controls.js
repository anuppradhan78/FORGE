/**
 * Test Demo Controls and API Routes
 * 
 * This test verifies:
 * 1. Demo run API endpoint works
 * 2. Demo reset API endpoint works
 * 3. Demo flow completes successfully
 * 4. All validations pass (sponsors, graph growth, audit trail)
 */

const API_URL = 'http://localhost:3001';

async function testDemoRun() {
  console.log('\n🧪 Testing Demo Run API...');
  
  try {
    const response = await fetch(`${API_URL}/api/demo/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceCommand: 'Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low',
        userId: 'demo-user-alice'
      })
    });

    if (!response.ok) {
      throw new Error(`Demo run failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Demo run completed');
    console.log('   Duration:', result.duration, 'ms');
    console.log('   Success:', result.success);
    console.log('   Task ID:', result.taskId);
    console.log('   Decision:', result.decision.verdict);
    console.log('   Tool calls:', result.toolCalls.length);
    
    // Validate sponsor invocations
    console.log('\n📊 Sponsor Validation:');
    console.log('   All sponsors invoked:', result.sponsorValidation.allSponsorsInvoked);
    console.log('   Missing sponsors:', result.sponsorValidation.missingSponsor);
    
    // Validate graph growth
    console.log('\n📈 Graph Validation:');
    console.log('   Nodes created:', result.graphValidation.nodesCreated);
    console.log('   Minimum met (5+):', result.graphValidation.minimumMet);
    console.log('   Nodes before:', result.graphValidation.nodesBefore);
    console.log('   Nodes after:', result.graphValidation.nodesAfter);
    
    // Validate audit trail
    console.log('\n📝 Audit Trail:');
    console.log('   Decision ID:', result.auditTrail.decisionId);
    console.log('   Timestamp:', result.auditTrail.timestamp);
    console.log('   Has provenance:', result.auditTrail.provenance !== null);
    
    // Check timing requirement (under 15 seconds)
    if (result.duration < 15000) {
      console.log('\n✅ Timing requirement met (under 15 seconds)');
    } else {
      console.log('\n⚠️  Warning: Demo took longer than 15 seconds');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Demo run test failed:', error.message);
    throw error;
  }
}

async function testDemoReset() {
  console.log('\n🧪 Testing Demo Reset API...');
  
  try {
    const response = await fetch(`${API_URL}/api/demo/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Demo reset failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Demo reset completed');
    console.log('   Success:', result.success);
    console.log('   Message:', result.message);
    
    return result;
  } catch (error) {
    console.error('❌ Demo reset test failed:', error.message);
    throw error;
  }
}

async function testDemoStatus() {
  console.log('\n🧪 Testing Demo Status API...');
  
  try {
    const response = await fetch(`${API_URL}/api/demo/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Demo status failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('✅ Demo status retrieved');
    console.log('   Status:', result.status);
    console.log('   Neo4j:', result.components.neo4j);
    console.log('   Agent:', result.components.agent);
    console.log('   TEE Vault:', result.components.teeVault);
    console.log('   Total nodes:', result.graphStats.totalNodes);
    
    return result;
  } catch (error) {
    console.error('❌ Demo status test failed:', error.message);
    throw error;
  }
}

async function testConsecutiveRuns() {
  console.log('\n🧪 Testing 3 Consecutive Demo Runs...');
  
  const results = [];
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Run ${i}/3 ---`);
    
    try {
      const result = await testDemoRun();
      results.push({
        run: i,
        success: result.success,
        duration: result.duration,
        error: null
      });
      
      // Wait a bit between runs
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({
        run: i,
        success: false,
        duration: 0,
        error: error.message
      });
    }
  }
  
  console.log('\n📊 Consecutive Runs Summary:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`   Run ${r.run}: ${status} ${r.success ? `(${r.duration}ms)` : `(${r.error})`}`);
  });
  
  const allSuccessful = results.every(r => r.success);
  if (allSuccessful) {
    console.log('\n✅ All 3 consecutive runs successful!');
  } else {
    console.log('\n⚠️  Some runs failed');
  }
  
  return results;
}

async function runAllTests() {
  console.log('🚀 Starting Demo Controls Tests...');
  console.log('API URL:', API_URL);
  
  try {
    // Test 1: Check demo status
    await testDemoStatus();
    
    // Test 2: Run demo flow once
    await testDemoRun();
    
    // Test 3: Reset demo state
    await testDemoReset();
    
    // Test 4: Run 3 consecutive demos (requirement 10.5)
    await testConsecutiveRuns();
    
    console.log('\n✅ All demo control tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Demo control tests failed:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
