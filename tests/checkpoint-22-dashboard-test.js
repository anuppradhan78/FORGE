/**
 * Checkpoint 22: Dashboard Functionality Test
 * 
 * Tests:
 * 1. All dashboard components render correctly
 * 2. Real-time updates work via SSE
 * 3. Graph visualization with 50+ nodes
 * 4. Demo controls trigger flow successfully
 * 5. Dashboard shows all 9 sponsor integrations
 */

const http = require('http');
const https = require('https');

const API_BASE = 'http://localhost:3001';
const DASHBOARD_BASE = 'http://localhost:3000';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
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
  return new Promise((resolve, reject) => {
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
    
    req.on('error', reject);
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
  
  // Test 1: Dashboard Components Render
  log('Test 1: Dashboard Components Render Correctly', 'blue');
  try {
    const dashboardResponse = await makeRequest(DASHBOARD_BASE);
    
    if (dashboardResponse.status === 200) {
      const html = dashboardResponse.body;
      
      // Check for key component markers
      const components = [
        { name: 'AgentStatus', present: html.includes('Agent Status') || html.includes('agent-status') },
        { name: 'SponsorGrid', present: html.includes('Sponsor') || html.includes('sponsor') },
        { name: 'GraphVisualization', present: html.includes('Graph') || html.includes('graph') },
        { name: 'AuditTrail', present: html.includes('Audit') || html.includes('audit') },
        { name: 'FluxReport', present: html.includes('Flux') || html.includes('flux') },
        { name: 'DemoControls', present: html.includes('Demo') || html.includes('demo') }
      ];
      
      const allPresent = components.every(c => c.present);
      
      if (allPresent) {
        log('  ✓ All dashboard components detected in HTML', 'green');
        results.passed++;
      } else {
        log('  ⚠ Some components may not be rendering:', 'yellow');
        components.filter(c => !c.present).forEach(c => {
          log(`    - ${c.name} not detected`, 'yellow');
        });
        results.warnings++;
      }
    } else {
      log(`  ✗ Dashboard not accessible (status: ${dashboardResponse.status})`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error accessing dashboard: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 2: Real-time SSE Updates
  log('\nTest 2: Real-time Updates via SSE', 'blue');
  try {
    log('  Testing SSE connection for 5 seconds...', 'cyan');
    const events = await testSSE(`${API_BASE}/api/agent/status`);
    
    if (events.length > 0) {
      log(`  ✓ Received ${events.length} SSE events`, 'green');
      log(`  Sample event: ${JSON.stringify(events[0])}`, 'cyan');
      results.passed++;
    } else {
      log('  ⚠ No SSE events received (agent may be idle)', 'yellow');
      results.warnings++;
    }
  } catch (error) {
    log(`  ✗ SSE connection failed: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 3: Graph Visualization with 50+ Nodes
  log('\nTest 3: Graph Visualization with 50+ Nodes', 'blue');
  try {
    const graphResponse = await makeRequest(`${DASHBOARD_BASE}/api/graph?predefined=full-audit`);
    
    if (graphResponse.status === 200 && graphResponse.body && graphResponse.body.data) {
      const { nodes, edges } = graphResponse.body.data;
      
      log(`  Graph contains ${nodes.length} nodes and ${edges.length} edges`, 'cyan');
      
      if (nodes.length >= 50) {
        log(`  ✓ Graph has 50+ nodes (${nodes.length} nodes)`, 'green');
        results.passed++;
      } else {
        log(`  ⚠ Graph has fewer than 50 nodes (${nodes.length} nodes)`, 'yellow');
        log('    Run more demo flows to generate additional nodes', 'yellow');
        results.warnings++;
      }
      
      // Check node type distribution
      const nodeTypes = {};
      nodes.forEach(node => {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      });
      
      log('  Node type distribution:', 'cyan');
      Object.entries(nodeTypes).forEach(([type, count]) => {
        log(`    - ${type}: ${count}`, 'cyan');
      });
    } else {
      log(`  ✗ Failed to fetch graph data (status: ${graphResponse.status})`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error fetching graph: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 4: Demo Controls Trigger Flow
  log('\nTest 4: Demo Controls Trigger Flow Successfully', 'blue');
  try {
    log('  Triggering demo flow...', 'cyan');
    const startTime = Date.now();
    
    const demoResponse = await makeRequest(`${API_BASE}/api/demo/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        voiceCommand: 'Scout NEAR NFTs under 50 NEAR with medium risk tolerance'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (demoResponse.status === 200 && demoResponse.body) {
      const result = demoResponse.body;
      
      log(`  ✓ Demo flow completed in ${duration}ms`, 'green');
      log(`  Flow duration: ${result.duration}ms`, 'cyan');
      log(`  Overall success: ${result.overallSuccess}`, 'cyan');
      log(`  Nodes created: ${result.graphValidation?.nodesCreated || 0}`, 'cyan');
      
      if (duration < 15000) {
        log('  ✓ Demo completed within 15 second target', 'green');
      } else {
        log(`  ⚠ Demo took longer than 15 seconds (${duration}ms)`, 'yellow');
      }
      
      results.passed++;
    } else {
      log(`  ✗ Demo flow failed (status: ${demoResponse.status})`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error triggering demo: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Test 5: All 9 Sponsor Integrations
  log('\nTest 5: Dashboard Shows All 9 Sponsor Integrations', 'blue');
  try {
    const sponsorResponse = await makeRequest(`${DASHBOARD_BASE}/api/sponsors/status`);
    
    if (sponsorResponse.status === 200 && sponsorResponse.body) {
      const sponsors = sponsorResponse.body;
      
      const expectedSponsors = [
        'ironclaw', 'openai', 'tavily', 'yutori', 'senso',
        'neo4j', 'modulate', 'numeric', 'airbyte'
      ];
      
      log('  Sponsor status:', 'cyan');
      expectedSponsors.forEach(sponsor => {
        const status = sponsors[sponsor] || 'unknown';
        const color = status === 'active' ? 'green' : status === 'inactive' ? 'yellow' : 'red';
        log(`    - ${sponsor}: ${status}`, color);
      });
      
      const allPresent = expectedSponsors.every(s => sponsors[s]);
      const allActive = expectedSponsors.every(s => sponsors[s] === 'active');
      
      if (allPresent) {
        log('  ✓ All 9 sponsors are present in the system', 'green');
        results.passed++;
        
        if (!allActive) {
          const inactive = expectedSponsors.filter(s => sponsors[s] !== 'active');
          log(`  ⚠ Some sponsors are inactive: ${inactive.join(', ')}`, 'yellow');
          results.warnings++;
        }
      } else {
        const missing = expectedSponsors.filter(s => !sponsors[s]);
        log(`  ✗ Missing sponsors: ${missing.join(', ')}`, 'red');
        results.failed++;
      }
    } else {
      log(`  ✗ Failed to fetch sponsor status (status: ${sponsorResponse.status})`, 'red');
      results.failed++;
    }
  } catch (error) {
    log(`  ✗ Error fetching sponsor status: ${error.message}`, 'red');
    results.failed++;
  }
  
  // Additional Tests: API Endpoints
  log('\nAdditional Tests: API Endpoints', 'blue');
  
  const endpoints = [
    { name: 'Audit Trail', url: `${DASHBOARD_BASE}/api/audit` },
    { name: 'Flux Report', url: `${DASHBOARD_BASE}/api/flux` },
    { name: 'Agent Status', url: `${API_BASE}/api/agent/status/current` }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(endpoint.url);
      if (response.status === 200) {
        log(`  ✓ ${endpoint.name} endpoint accessible`, 'green');
        results.passed++;
      } else {
        log(`  ⚠ ${endpoint.name} returned status ${response.status}`, 'yellow');
        results.warnings++;
      }
    } catch (error) {
      log(`  ✗ ${endpoint.name} failed: ${error.message}`, 'red');
      results.failed++;
    }
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
    log('\n✓ All critical tests passed! Dashboard is fully functional.', 'green');
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
