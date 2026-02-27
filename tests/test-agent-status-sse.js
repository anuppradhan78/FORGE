/**
 * Test script for Agent Status SSE endpoint
 * 
 * This script tests the real-time agent status streaming functionality.
 * 
 * Usage:
 *   node tests/test-agent-status-sse.js
 * 
 * Prerequisites:
 *   - API server running on http://localhost:3001
 *   - Neo4j database running
 */

const EventSource = require('eventsource');

const API_URL = process.env.API_URL || 'http://localhost:3001';

console.log('🧪 Testing Agent Status SSE Endpoint\n');
console.log(`API URL: ${API_URL}`);
console.log('Connecting to SSE stream...\n');

// Connect to SSE endpoint
const eventSource = new EventSource(`${API_URL}/api/agent/status`);

let messageCount = 0;
const startTime = Date.now();

eventSource.onopen = () => {
  console.log('✅ SSE connection opened');
  console.log('Listening for status updates...\n');
};

eventSource.onmessage = (event) => {
  messageCount++;
  
  try {
    const data = JSON.parse(event.data);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`[${elapsed}s] Message #${messageCount}:`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Timestamp: ${data.timestamp}`);
    
    if (data.currentTask) {
      console.log(`  Task ID: ${data.currentTask.taskId}`);
      console.log(`  Command: ${data.currentTask.command}`);
      console.log(`  Progress: ${data.currentTask.progress}%`);
      console.log(`  Current Step: ${data.currentTask.currentStep}`);
    } else {
      console.log(`  Task: None (agent idle)`);
    }
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to parse SSE data:', error);
  }
};

eventSource.onerror = (error) => {
  console.error('❌ SSE error:', error);
  console.log('\nConnection lost. Exiting...');
  eventSource.close();
  process.exit(1);
};

// Test for 30 seconds then exit
setTimeout(() => {
  console.log(`\n✅ Test completed successfully!`);
  console.log(`Received ${messageCount} status updates in 30 seconds`);
  eventSource.close();
  process.exit(0);
}, 30000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  console.log(`Received ${messageCount} status updates before interruption`);
  eventSource.close();
  process.exit(0);
});

console.log('Press Ctrl+C to stop the test\n');
console.log('To trigger status updates, run a demo workflow in another terminal:');
console.log('  curl -X POST http://localhost:3001/api/agent/execute \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"voiceCommand": "Scout NEAR NFTs under 50 NEAR"}\'\n');
