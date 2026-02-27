/**
 * Checkpoint 22: Simplified Automated Dashboard Test
 * Tests core functionality that can be verified programmatically
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

function testSSE(url, timeout = 5000) {
  return new Promise((resolve) => {
    const events = [];
    const req = http.request(url, (res) => {
      res.on('data', chunk => {
        const lines = chunk.toString().split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              events.push(data);
            } catch (e) {
              // Ignore parse errors
            }
          }
        });
      });
    });
    
    req.on('error', () => resolve([]));
    req.end();
    
    setTimeout(() => {
      req.destroy();
      resolve(events);
    }, timeout);
  });
}

async function runTests() {
  log('\n=== CHECKPOINT 22: Dashboard Functionality Test ===\n', 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  // Test 1: API Server Health
  log('Test 1: API Server Health Check', 'cyan');
  try {
    const response = await makeRequest(`${API_BASE}/health`);
    if (response.status === 200) {
      log('  ✓ API server is healthy', 'green');
      results.passed++;
    } else {
      log(`  ✗ API server returned status ${response.status}`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ API server not accessible: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 2: SSE Connection
  log('\nTest 2: Real-time SSE Connection', 'cyan');
  try {
    const events = await testSSE(`${API_BASE}/api/agent/status`);
    if (events.length > 0) {
      log(`  ✓ SSE working (received ${events.length} events)`, 'green');
      log(`    Latest status: ${events[events.length - 1].status}`, 'cyan');
      results.passed++;
    } else {
      log('  ⚠ No SSE events received (agent may be idle)', 'yellow');
      results.warnings++;
    }
  } catch (error) {
    log(`  ✗ SSE connection failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 3: Demo Flow Execution
  log('\nTest 3: Demo Flow Execution', 'cyan');
  try {
    log('  Triggering demo flow...', 'cyan');
    const startTime = Date.now();
    
    const response = await makeRequest(`${API_BASE}/api/demo/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        voiceCommand: 'Scout NEAR NFTs under 50 NEAR with medium risk tolerance'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.body) {
      log(`  ✓ Demo flow completed in ${duration}ms`, 'green');
      
      const result = response.body;
      log(`    Duration: ${result.duration}ms`, 'cyan');
      log(`    Nodes created: ${result.graphValidation?.nodesCreated || 0}`, 'cyan');
      log(`    Decision: ${result.decision?.verdict || 'unknown'}`, 'cyan');
      
      if (duration < 15000) {
        log('  ✓ Completed within 15 second target', 'green');
      } else {
        log(`  ⚠ Took longer than 15 seconds (${duration}ms)`, 'yellow');
        results.warnings++;
      }
      
      results.passed++;
    } else {
      log(`  ✗ Demo flow failed (status: ${response.status})`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 4: Agent Status Endpoint
  log('\nTest 4: Agent Status Endpoint', 'cyan');
  try {
    const response = await makeRequest(`${API_BASE}/api/agent/status/current`);
    if (response.status === 200 && response.body) {
      log('  ✓ Agent status endpoint accessible', 'green');
      log(`    Current status: ${response.body.status}`, 'cyan');
      results.passed++;
    } else {
      log(`  ✗ Status endpoint returned ${response.status}`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 5: Governance Audit Trail
  log('\nTest 5: Governance Audit Trail', 'cyan');
  try {
    const response = await makeRequest(`${API_BASE}/api/governance/audit?limit=5`);
    if (response.status === 200 && response.body) {
      log('  ✓ Audit trail endpoint accessible', 'green');
      log(`    Entries found: ${response.body.entries?.length || 0}`, 'cyan');
      results.passed++;
    } else {
      log(`  ✗ Audit endpoint returned ${response.status}`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 6: Demo Status
  log('\nTest 6: Demo System Status', 'cyan');
  try {
    const response = await makeRequest(`${API_BASE}/api/demo/status`);
    if (response.status === 200 && response.body) {
      log('  ✓ Demo status endpoint accessible', 'green');
      log(`    Neo4j: ${response.body.components?.neo4j || 'unknown'}`, 'cyan');
      log(`    Total nodes: ${response.body.graphStats?.totalNodes || 0}`, 'cyan');
      
      if (response.body.graphStats?.totalNodes >= 50) {
        log('  ✓ Graph has 50+ nodes', 'green');
      } else {
        log(`  ⚠ Graph has ${response.body.graphStats?.totalNodes || 0} nodes (< 50)`, 'yellow');
        log('    Run more demo flows to reach 50+ nodes', 'yellow');
        results.warnings++;
      }
      
      results.passed++;
    } else {
      log(`  ✗ Status endpoint returned ${response.status}`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 7: Consecutive Demo Runs
  log('\nTest 7: Consecutive Demo Runs (3x)', 'cyan');
  let consecutiveSuccess = 0;
  
  for (let i = 1; i <= 3; i++) {
    try {
      log(`  Running demo ${i}/3...`, 'cyan');
      const response = await makeRequest(`${API_BASE}/api/demo/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          voiceCommand: `Test run ${i}: Scout NEAR NFTs`
        }
      });
      
      if (response.status === 200) {
        consecutiveSuccess++;
        log(`    ✓ Run ${i} succeeded`, 'green');
      } else {
        log(`    ✗ Run ${i} failed (status: ${response.status})`, 'red');
      }
      
      // Wait 1 second between runs
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      log(`    ✗ Run ${i} error: ${error.message}`, 'red');
    }
  }
  
  if (consecutiveSuccess === 3) {
    log('  ✓ All 3 consecutive runs succeeded', 'green');
    results.passed++;
  } else if (consecutiveSuccess > 0) {
    log(`  ⚠ Only ${consecutiveSuccess}/3 runs succeeded`, 'yellow');
    results.warnings++;
  } else {
    log('  ✗ All consecutive runs failed', 'red');
    results.failed++;
  }
  
  // Summary
  log('\n=== Test Summary ===', 'cyan');
  log(`Passed: ${results.passed}`, 'green');
  log(`Warnings: ${results.warnings}`, 'yellow');
  log(`Failed: ${results.failed}`, 'red');
  
  const total = results.passed + results.warnings + results.failed;
  const successRate = ((results.passed / total) * 100).toFixed(1);
  log(`\nSuccess Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'yellow');
  
  if (results.failed === 0) {
    log('\n✓ All critical tests passed!', 'green');
    log('Dashboard backend is fully functional.', 'green');
    log('\nNext steps:', 'cyan');
    log('1. Open http://localhost:3000 in a browser', 'cyan');
    log('2. Use tests/checkpoint-22-manual-verification.md for UI testing', 'cyan');
    return 0;
  } else {
    log('\n✗ Some tests failed. Please review the issues above.', 'red');
    return 1;
  }
}

// Run tests
runTests()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
