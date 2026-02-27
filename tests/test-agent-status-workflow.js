/**
 * Test script for Agent Status with Workflow Execution
 * 
 * This script tests the real-time agent status updates during workflow execution.
 * It connects to the SSE stream and then triggers a demo workflow to see status changes.
 * 
 * Usage:
 *   node tests/test-agent-status-workflow.js
 * 
 * Prerequisites:
 *   - API server running on http://localhost:3001
 *   - Neo4j database running
 */

const EventSource = require('eventsource');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';

console.log('🧪 Testing Agent Status with Workflow Execution\n');
console.log(`API URL: ${API_URL}`);

// Track status updates
const statusUpdates = [];
let workflowStarted = false;
let workflowCompleted = false;

// Connect to SSE endpoint
console.log('Step 1: Connecting to SSE stream...');
const eventSource = new EventSource(`${API_URL}/api/agent/status`);

eventSource.onopen = () => {
  console.log('✅ SSE connection opened\n');
  
  // Wait 2 seconds then trigger workflow
  setTimeout(async () => {
    console.log('Step 2: Triggering agent workflow...');
    try {
      workflowStarted = true;
      const response = await axios.post(`${API_URL}/api/agent/execute`, {
        voiceCommand: 'Scout NEAR NFTs under 50 NEAR and buy the best one',
        userId: 'demo-user-alice'
      });
      
      workflowCompleted = true;
      console.log('\n✅ Workflow completed successfully!');
      console.log(`Decision: ${response.data.decision}`);
      console.log(`Reasoning: ${response.data.reasoning}\n`);
      
      // Wait 2 more seconds to capture final status updates
      setTimeout(() => {
        analyzeResults();
      }, 2000);
      
    } catch (error) {
      console.error('\n❌ Workflow execution failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      eventSource.close();
      process.exit(1);
    }
  }, 2000);
};

eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    statusUpdates.push({
      timestamp: new Date(),
      data
    });
    
    // Log status changes
    const prevStatus = statusUpdates.length > 1 
      ? statusUpdates[statusUpdates.length - 2].data.status 
      : null;
    
    if (data.status !== prevStatus) {
      console.log(`\n📊 Status changed: ${prevStatus || 'initial'} → ${data.status}`);
      if (data.currentTask) {
        console.log(`   Task: ${data.currentTask.taskId}`);
        console.log(`   Step: ${data.currentTask.currentStep}`);
        console.log(`   Progress: ${data.currentTask.progress}%`);
      }
    } else if (data.currentTask && data.currentTask.progress) {
      // Log progress updates
      process.stdout.write(`\r   Progress: ${data.currentTask.progress}% - ${data.currentTask.currentStep}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to parse SSE data:', error);
  }
};

eventSource.onerror = (error) => {
  console.error('\n❌ SSE error:', error);
  eventSource.close();
  process.exit(1);
};

function analyzeResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📈 Test Results Analysis');
  console.log('='.repeat(60) + '\n');
  
  console.log(`Total status updates received: ${statusUpdates.length}`);
  
  // Count status transitions
  const statusCounts = {};
  const statusTransitions = [];
  
  for (let i = 0; i < statusUpdates.length; i++) {
    const status = statusUpdates[i].data.status;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    if (i > 0 && statusUpdates[i].data.status !== statusUpdates[i-1].data.status) {
      statusTransitions.push({
        from: statusUpdates[i-1].data.status,
        to: statusUpdates[i].data.status,
        time: statusUpdates[i].timestamp
      });
    }
  }
  
  console.log('\nStatus distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} updates`);
  });
  
  console.log('\nStatus transitions:');
  statusTransitions.forEach((transition, i) => {
    console.log(`  ${i + 1}. ${transition.from} → ${transition.to}`);
  });
  
  // Verify expected workflow states
  console.log('\n✅ Verification:');
  const expectedStates = ['idle', 'scouting', 'verifying', 'deciding', 'executing'];
  const observedStates = new Set(statusUpdates.map(u => u.data.status));
  
  expectedStates.forEach(state => {
    if (observedStates.has(state)) {
      console.log(`  ✓ ${state} state observed`);
    } else {
      console.log(`  ✗ ${state} state NOT observed`);
    }
  });
  
  // Check timing requirement (updates within 2 seconds)
  console.log('\n⏱️  Timing Analysis:');
  if (statusTransitions.length > 0) {
    const avgDelay = statusTransitions.reduce((sum, t, i) => {
      if (i === 0) return 0;
      return sum + (t.time - statusTransitions[i-1].time);
    }, 0) / (statusTransitions.length - 1);
    
    console.log(`  Average delay between transitions: ${avgDelay.toFixed(0)}ms`);
    
    if (avgDelay < 2000) {
      console.log('  ✅ Updates within 2-second requirement');
    } else {
      console.log('  ⚠️  Updates exceed 2-second requirement');
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed successfully!');
  console.log('='.repeat(60) + '\n');
  
  eventSource.close();
  process.exit(0);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted by user');
  console.log(`Received ${statusUpdates.length} status updates before interruption`);
  eventSource.close();
  process.exit(0);
});
