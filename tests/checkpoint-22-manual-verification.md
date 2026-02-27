# Checkpoint 22: Dashboard Functionality - Manual Verification Guide

## Overview
This guide provides step-by-step instructions to manually verify all dashboard functionality.

## Prerequisites
- Dashboard running on http://localhost:3000
- API running on http://localhost:3001
- Neo4j running on bolt://localhost:7687

## Test 1: Dashboard Components Render Correctly

### Steps:
1. Open browser to http://localhost:3000
2. Verify the following components are visible:
   - [ ] Agent Status component (shows current agent state)
   - [ ] Sponsor Grid (shows 9 sponsor logos with status indicators)
   - [ ] Graph Visualization (interactive graph view)
   - [ ] Audit Trail (list of recent decisions)
   - [ ] Flux Report (financial reconciliation data)
   - [ ] Demo Controls (Run Demo and Reset buttons)

### Expected Result:
All 6 components should render without errors. Page should load within 3 seconds.

### Actual Result:
- Components visible: ___________
- Load time: ___________
- Issues: ___________

---

## Test 2: Real-time Updates via SSE

### Steps:
1. Open browser to http://localhost:3000
2. Open browser DevTools (F12) → Network tab
3. Filter for "EventSource" or "status"
4. Click "Run Demo Flow" button
5. Watch the Agent Status component

### Expected Result:
- Agent Status should update in real-time showing: idle → scouting → verifying → deciding → executing → idle
- Network tab should show SSE connection to `/api/agent/status`
- Status updates should appear within 2 seconds of state changes

### Actual Result:
- Status transitions observed: ___________
- SSE connection established: Yes / No
- Update latency: ___________
- Issues: ___________

---

## Test 3: Graph Visualization with 50+ Nodes

### Steps:
1. Open browser to http://localhost:3000
2. Navigate to the Graph View (if separate page) or scroll to graph component
3. Count the number of nodes visible
4. Try interacting with the graph:
   - [ ] Zoom in/out
   - [ ] Pan around
   - [ ] Click on a node to see details
   - [ ] Hover over nodes to see tooltips

### Expected Result:
- Graph should contain 50+ nodes (run multiple demo flows if needed)
- Graph should be interactive and responsive
- Different node types should have different colors
- Edges should show relationship types

### Actual Result:
- Node count: ___________
- Interaction works: Yes / No
- Performance: Smooth / Laggy
- Issues: ___________

---

## Test 4: Demo Controls Trigger Flow Successfully

### Steps:
1. Open browser to http://localhost:3000
2. Click "Run Demo Flow" button
3. Watch the progress indicators
4. Wait for completion message

### Expected Result:
- Demo flow should complete in under 15 seconds
- Progress should show each step: voice → scout → verify → govern → execute
- Success message should appear
- Graph should grow by 5+ nodes
- Audit trail should show new decision

### Actual Result:
- Completion time: ___________
- All steps executed: Yes / No
- Nodes added: ___________
- Issues: ___________

---

## Test 5: Dashboard Shows All 9 Sponsor Integrations

### Steps:
1. Open browser to http://localhost:3000
2. Locate the Sponsor Grid component
3. Verify all 9 sponsors are displayed:
   - [ ] IronClaw
   - [ ] OpenAI
   - [ ] Tavily
   - [ ] Yutori
   - [ ] Senso
   - [ ] Neo4j
   - [ ] Modulate
   - [ ] Numeric
   - [ ] Airbyte

### Expected Result:
- All 9 sponsor logos should be visible
- Each should have a status indicator (active/inactive/error)
- Most should show "active" status after running a demo flow

### Actual Result:
- Sponsors visible: ___________
- Active sponsors: ___________
- Issues: ___________

---

## Test 6: Audit Trail Display

### Steps:
1. Open browser to http://localhost:3000
2. Locate the Audit Trail component
3. Verify recent decisions are listed
4. Click on a decision to expand details
5. Click on a provenance link

### Expected Result:
- Decisions should be listed in reverse chronological order
- Each decision should show: timestamp, type, verdict, reasoning
- Clicking a decision should expand to show full details
- Provenance links should navigate to graph view with highlighted path

### Actual Result:
- Decisions visible: ___________
- Expand/collapse works: Yes / No
- Provenance links work: Yes / No
- Issues: ___________

---

## Test 7: Flux Report Display

### Steps:
1. Open browser to http://localhost:3000
2. Run a demo flow (if not already done)
3. Locate the Flux Report component
4. Verify the following information is displayed:
   - [ ] Portfolio value before transaction
   - [ ] Portfolio value after transaction
   - [ ] Variance calculation
   - [ ] Anomaly alerts (if any)
   - [ ] AI-generated explanation

### Expected Result:
- Latest flux report should be displayed
- All financial data should be accurate
- Anomalies should be highlighted if variance > 5%
- AI explanation should be readable and relevant

### Actual Result:
- Flux report visible: Yes / No
- Data accuracy: Correct / Incorrect
- Anomalies highlighted: Yes / No / N/A
- Issues: ___________

---

## Test 8: Consecutive Demo Runs

### Steps:
1. Open browser to http://localhost:3000
2. Click "Run Demo Flow" button
3. Wait for completion
4. Click "Run Demo Flow" button again
5. Wait for completion
6. Click "Run Demo Flow" button a third time
7. Wait for completion

### Expected Result:
- All 3 demo runs should complete successfully
- No errors should appear in browser console
- Graph should continue to grow
- System should remain responsive

### Actual Result:
- Run 1: Success / Failure
- Run 2: Success / Failure
- Run 3: Success / Failure
- Issues: ___________

---

## Test 9: Browser Console Check

### Steps:
1. Open browser to http://localhost:3000
2. Open DevTools (F12) → Console tab
3. Look for any errors or warnings

### Expected Result:
- No critical errors (red messages)
- Minor warnings acceptable (yellow messages)
- No network failures (404, 500 errors)

### Actual Result:
- Errors found: ___________
- Warnings found: ___________
- Issues: ___________

---

## Test 10: Responsive Design

### Steps:
1. Open browser to http://localhost:3000
2. Resize browser window to different sizes:
   - [ ] Full screen (1920x1080)
   - [ ] Laptop (1366x768)
   - [ ] Tablet (768x1024)

### Expected Result:
- Layout should adapt to different screen sizes
- All components should remain accessible
- No horizontal scrolling required
- Text should remain readable

### Actual Result:
- Responsive: Yes / No
- Issues at specific sizes: ___________

---

## Summary

### Overall Assessment:
- [ ] All critical tests passed
- [ ] Minor issues found (list below)
- [ ] Major issues found (list below)

### Issues Found:
1. ___________
2. ___________
3. ___________

### Recommendations:
1. ___________
2. ___________
3. ___________

### Sign-off:
- Tester: ___________
- Date: ___________
- Status: PASS / FAIL / PASS WITH ISSUES
