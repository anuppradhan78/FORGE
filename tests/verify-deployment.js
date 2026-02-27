#!/usr/bin/env node

/**
 * FORGE Deployment Verification Script
 * 
 * Tests deployed services on Render to ensure everything is working correctly.
 * 
 * Usage:
 *   node tests/verify-deployment.js <api-url> <dashboard-url>
 * 
 * Example:
 *   node tests/verify-deployment.js https://forge-api.onrender.com https://forge-dashboard.onrender.com
 */

const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node tests/verify-deployment.js <api-url> <dashboard-url>');
  console.error('Example: node tests/verify-deployment.js https://forge-api.onrender.com https://forge-dashboard.onrender.com');
  process.exit(1);
}

const API_URL = args[0];
const DASHBOARD_URL = args[1];

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Test functions
async function testAPIHealth() {
  console.log('\n🔍 Testing API Health Check...');
  try {
    const response = await makeRequest(`${API_URL}/health`);
    
    if (response.statusCode === 200 || response.statusCode === 503) {
      console.log('✅ API health endpoint responding');
      console.log('   Status:', response.data.status);
      console.log('   Services:', JSON.stringify(response.data.services || {}, null, 2));
      
      if (response.data.services?.neo4j === 'connected') {
        console.log('✅ Neo4j connection verified');
        results.passed++;
      } else {
        console.log('⚠️  Neo4j not connected');
        results.failed++;
      }
      
      results.passed++;
      results.tests.push({ name: 'API Health Check', status: 'passed' });
    } else {
      console.log('❌ API health check failed with status:', response.statusCode);
      results.failed++;
      results.tests.push({ name: 'API Health Check', status: 'failed', error: `Status ${response.statusCode}` });
    }
  } catch (error) {
    console.log('❌ API health check failed:', error.message);
    results.failed++;
    results.tests.push({ name: 'API Health Check', status: 'failed', error: error.message });
  }
}

async function testDashboardAccess() {
  console.log('\n🔍 Testing Dashboard Access...');
  try {
    const response = await makeRequest(DASHBOARD_URL);
    
    if (response.statusCode === 200) {
      console.log('✅ Dashboard is accessible');
      results.passed++;
      results.tests.push({ name: 'Dashboard Access', status: 'passed' });
    } else {
      console.log('❌ Dashboard returned status:', response.statusCode);
      results.failed++;
      results.tests.push({ name: 'Dashboard Access', status: 'failed', error: `Status ${response.statusCode}` });
    }
  } catch (error) {
    console.log('❌ Dashboard access failed:', error.message);
    results.failed++;
    results.tests.push({ name: 'Dashboard Access', status: 'failed', error: error.message });
  }
}

async function testAPIEndpoints() {
  console.log('\n🔍 Testing API Endpoints...');
  
  const endpoints = [
    { path: '/api/agent/status', method: 'GET', name: 'Agent Status' },
    { path: '/api/governance/audit', method: 'GET', name: 'Audit Trail' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${API_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.statusCode === 200) {
        console.log(`✅ ${endpoint.name} endpoint working`);
        results.passed++;
        results.tests.push({ name: `API: ${endpoint.name}`, status: 'passed' });
      } else {
        console.log(`⚠️  ${endpoint.name} returned status ${response.statusCode}`);
        results.failed++;
        results.tests.push({ name: `API: ${endpoint.name}`, status: 'failed', error: `Status ${response.statusCode}` });
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name} failed:`, error.message);
      results.failed++;
      results.tests.push({ name: `API: ${endpoint.name}`, status: 'failed', error: error.message });
    }
  }
}

async function testCORS() {
  console.log('\n🔍 Testing CORS Configuration...');
  try {
    const response = await makeRequest(`${API_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': DASHBOARD_URL,
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    if (corsHeader === DASHBOARD_URL || corsHeader === '*') {
      console.log('✅ CORS configured correctly');
      console.log('   Allowed origin:', corsHeader);
      results.passed++;
      results.tests.push({ name: 'CORS Configuration', status: 'passed' });
    } else {
      console.log('⚠️  CORS may not be configured correctly');
      console.log('   Expected:', DASHBOARD_URL);
      console.log('   Got:', corsHeader);
      results.failed++;
      results.tests.push({ name: 'CORS Configuration', status: 'failed', error: 'Origin mismatch' });
    }
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
    results.failed++;
    results.tests.push({ name: 'CORS Configuration', status: 'failed', error: error.message });
  }
}

async function testDemoFlow() {
  console.log('\n🔍 Testing Demo Flow (this may take 15-30 seconds)...');
  try {
    const startTime = Date.now();
    const response = await makeRequest(`${API_URL}/api/demo/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { userId: 'test-deployment-user' }
    });
    const duration = Date.now() - startTime;
    
    if (response.statusCode === 200) {
      console.log('✅ Demo flow completed');
      console.log(`   Duration: ${duration}ms`);
      console.log('   Result:', response.data.status || 'unknown');
      
      if (duration < 15000) {
        console.log('✅ Demo flow completed within 15 seconds');
        results.passed++;
      } else {
        console.log('⚠️  Demo flow took longer than 15 seconds');
        results.failed++;
      }
      
      results.passed++;
      results.tests.push({ name: 'Demo Flow', status: 'passed', duration });
    } else {
      console.log('❌ Demo flow failed with status:', response.statusCode);
      console.log('   Response:', response.data);
      results.failed++;
      results.tests.push({ name: 'Demo Flow', status: 'failed', error: `Status ${response.statusCode}` });
    }
  } catch (error) {
    console.log('❌ Demo flow failed:', error.message);
    results.failed++;
    results.tests.push({ name: 'Demo Flow', status: 'failed', error: error.message });
  }
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         FORGE Deployment Verification Tests               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nAPI URL:', API_URL);
  console.log('Dashboard URL:', DASHBOARD_URL);
  console.log('\nStarting tests...\n');
  
  await testAPIHealth();
  await testDashboardAccess();
  await testAPIEndpoints();
  await testCORS();
  await testDemoFlow();
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Test Summary                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.passed + results.failed}\n`);
  
  if (results.failed === 0) {
    console.log('🎉 All tests passed! Deployment is successful.\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
    console.log('Failed tests:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log('');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
