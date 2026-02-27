# Checkpoint 11: Integration Testing Checklist

## Overview
This checkpoint verifies that all sponsor integrations are working correctly before proceeding to IronClaw agent orchestration.

## Prerequisites
- [ ] Docker is running
- [ ] Neo4j is running (`docker-compose up -d`)
- [ ] API server is running (`cd api && npm start`)
- [ ] Dashboard is running (`cd dashboard && npm run dev`)
- [ ] All environment variables are set in `.env`

## Test Execution

### Automated Testing

Run the automated test suite:
```bash
# Run the Node.js test script (works on all platforms)
node tests/manual-checkpoint-11.js

# Or run the bash script (Linux/macOS)
bash tests/manual-checkpoint-11.sh
```

### Manual Testing Checklist

#### 1. Modulate Voice Interface ✓
- [ ] Voice service endpoint responds: `POST /api/voice`
- [ ] Returns transcript, intent, emotion, fraudScore
- [ ] Fraud score is between 0.0 and 1.0
- [ ] Commands with fraudScore > 0.7 are rejected
- [ ] Falls back to mock responses when API unavailable
- [ ] Mock responses loaded from `mocks/modulate-responses.json`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/voice \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "audioData": "mock-audio"}'
```

**Expected Response:**
```json
{
  "transcript": "Scout NEAR NFTs under 50 NEAR",
  "intent": {
    "action": "scout",
    "assetType": "nft",
    "priceLimit": 50,
    "riskPreference": "medium"
  },
  "emotion": {
    "confidence": 0.85,
    "urgency": 0.6
  },
  "fraudScore": 0.15,
  "approved": true,
  "timestamp": "2026-02-25T..."
}
```

#### 2. Tavily Scout Engine ✓
- [ ] Scout service endpoint responds: `POST /api/scout`
- [ ] Returns at least 3 deal candidates
- [ ] Each deal has: asset_id, price, collection, listing_url
- [ ] Results are cached (5-minute TTL)
- [ ] Falls back to mock responses when API unavailable
- [ ] Mock responses loaded from `mocks/tavily-responses.json`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/scout \
  -H "Content-Type: application/json" \
  -d '{"query": "NEAR NFT listings under 50 NEAR", "maxResults": 3}'
```

**Expected Response:**
```json
{
  "results": [
    {
      "asset_id": "near-punk-1234",
      "price": 30.0,
      "collection": "NEAR Punks",
      "listing_url": "https://paras.id/token/1234",
      "timestamp": "2026-02-25T..."
    }
  ],
  "query": "NEAR NFT listings under 50 NEAR",
  "responseTime": 245
}
```

#### 3. Yutori Scout Creation ✓
- [ ] Scout creation endpoint works
- [ ] Returns scoutId and status
- [ ] Falls back to periodic Tavily calls when unavailable
- [ ] Mock responses loaded from `mocks/yutori-responses.json`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/scout/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Scout",
    "description": "Testing Yutori integration",
    "targetUrls": ["https://paras.id"],
    "monitoringFrequency": "hourly"
  }'
```

#### 4. Senso Context Verification ✓
- [ ] Verification service endpoint responds: `POST /api/verify`
- [ ] Returns verified, confidenceScore, checks, groundTruth, sources, riskLevel
- [ ] Confidence score is between 0.0 and 1.0
- [ ] Price deviation > 15% flags as high-risk
- [ ] Falls back to hardcoded floor prices when API unavailable
- [ ] Mock responses loaded from `mocks/senso-responses.json`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "dealData": {
      "assetId": "near-punk-1234",
      "collection": "NEAR Punks",
      "price": 30.0,
      "seller": "test-seller.near",
      "listingUrl": "https://paras.id/token/1234"
    },
    "verificationType": "all"
  }'
```

**Expected Response:**
```json
{
  "verified": true,
  "confidenceScore": 0.92,
  "checks": {
    "collectionLegitimate": true,
    "floorPriceAccurate": true,
    "sellerReputable": true
  },
  "groundTruth": {
    "actualFloorPrice": 25.5,
    "priceDeviation": 17.6,
    "collectionVerifiedUrl": "https://paras.id/collection/near-punks"
  },
  "sources": [
    {
      "url": "https://paras.id",
      "authority": "Paras Marketplace",
      "timestamp": "2026-02-25T..."
    }
  ],
  "riskLevel": "high"
}
```

#### 5. Neo4j Governance ✓
- [ ] Policy check endpoint responds: `POST /api/govern`
- [ ] Retrieves user policies from Neo4j
- [ ] Checks transaction against all applicable policies
- [ ] Returns approved/rejected with reasoning
- [ ] Detects policy violations correctly
- [ ] Creates Decision nodes with policy links
- [ ] Audit trail query works: `GET /api/audit`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/govern \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user-1",
    "transaction": {
      "assetType": "nft",
      "amount": 50.0,
      "seller": "test-seller.near"
    },
    "context": {
      "currentPortfolioValue": 1000.0,
      "recentTransactionCount": 0
    }
  }'
```

**Expected Response:**
```json
{
  "approved": true,
  "violatedPolicies": [],
  "appliedPolicies": ["policy-1", "policy-2"],
  "reasoning": "Transaction approved. Amount (50.0 NEAR) is 5% of portfolio, within 10% limit. Daily transaction count (0) is within limit of 5."
}
```

**Verify in Neo4j Browser (http://localhost:7474):**
```cypher
MATCH (u:User {id: 'demo-user-1'})-[:HAS_POLICY]->(p:Policy)
RETURN u, p
```

#### 6. Numeric Finance Reconciliation ✓
- [ ] Finance service endpoint responds: `POST /api/finance`
- [ ] Generates Flux Report with portfolioAfter, variance, anomalies, aiExplanation
- [ ] Flags anomalies when variance > 5%
- [ ] Falls back to local calculation + GPT explanation when API unavailable
- [ ] Persists FluxReport to Neo4j
- [ ] Mock responses loaded from `mocks/numeric-responses.json`

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/finance \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user-1",
    "transaction": {
      "type": "buy",
      "assetId": "near-punk-1234",
      "amount": 1,
      "price": 30.0,
      "fees": 0.5
    },
    "portfolioBefore": {
      "totalValue": 1000.0,
      "assets": {"NEAR": 1000.0}
    }
  }'
```

**Expected Response:**
```json
{
  "portfolioAfter": {
    "totalValue": 969.5,
    "assets": {
      "NEAR": 969.5,
      "near-punk-1234": 1
    }
  },
  "variance": {
    "expected": 30.5,
    "actual": 30.5,
    "deviation": 0.0
  },
  "anomalies": [],
  "aiExplanation": "Portfolio updated successfully. Purchased near-punk-1234 for 30.0 NEAR. Total fees: 0.5 NEAR. New portfolio value: 969.5 NEAR.",
  "reconciled": true,
  "timestamp": "2026-02-25T..."
}
```

#### 7. Circuit Breaker Pattern ✓
- [ ] Circuit breaker opens after 3 consecutive failures
- [ ] Falls back to mock responses when circuit is open
- [ ] Transitions to half-open state after timeout (60 seconds)
- [ ] Closes circuit after successful request in half-open state
- [ ] Logs state transitions

**Test Procedure:**
1. Disable one sponsor API (e.g., set invalid API key)
2. Make 3 consecutive requests to that service
3. Verify circuit opens (check logs)
4. Make 4th request - should immediately use fallback
5. Wait 60 seconds
6. Make 5th request - should attempt API call (half-open)

**Check Logs:**
```bash
# Look for circuit breaker messages in API logs
grep -i "circuit" api/logs/*.log
```

#### 8. Data Persistence in Neo4j ✓
- [ ] Seeded data exists (users, policies, collections)
- [ ] Indexes created on key fields (User.id, Policy.userId, Decision.timestamp)
- [ ] Decision nodes created with relationships
- [ ] FluxReport nodes linked to transactions
- [ ] Audit trail is queryable

**Verify in Neo4j Browser:**
```cypher
// Check seeded data
MATCH (u:User)
OPTIONAL MATCH (u)-[:HAS_POLICY]->(p:Policy)
OPTIONAL MATCH (c:Collection)
RETURN count(DISTINCT u) as users,
       count(DISTINCT p) as policies,
       count(DISTINCT c) as collections

// Check indexes
SHOW INDEXES

// Check recent decisions
MATCH (d:Decision)
RETURN d
ORDER BY d.timestamp DESC
LIMIT 10

// Check audit trail
MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:CHECKED_POLICY]->(p:Policy)
RETURN u.name, d.verdict, p.type, d.timestamp
ORDER BY d.timestamp DESC
LIMIT 5
```

**Expected Results:**
- At least 1 user (demo-user-1)
- At least 3 policies per user
- At least 3 NFT collections
- Indexes on User.id, Policy.userId, Decision.timestamp, Collection.id

## Integration Status Report

After running all tests, fill out this report:

| Integration | Status | Fallback Works | Notes |
|-------------|--------|----------------|-------|
| Modulate Voice | ⬜ Pass / ⬜ Fail | ⬜ Yes / ⬜ No | |
| Tavily Search | ⬜ Pass / ⬜ Fail | ⬜ Yes / ⬜ No | |
| Yutori Scouts | ⬜ Pass / ⬜ Fail | ⬜ Yes / ⬜ No | |
| Senso Verify | ⬜ Pass / ⬜ Fail | ⬜ Yes / ⬜ No | |
| Neo4j Governance | ⬜ Pass / ⬜ Fail | N/A | |
| Numeric Finance | ⬜ Pass / ⬜ Fail | ⬜ Yes / ⬜ No | |
| Circuit Breaker | ⬜ Pass / ⬜ Fail | N/A | |
| Data Persistence | ⬜ Pass / ⬜ Fail | N/A | |

## Common Issues and Solutions

### Issue: API server not responding
**Solution:** 
```bash
cd api
npm install
npm start
```

### Issue: Neo4j not accessible
**Solution:**
```bash
docker-compose up -d
# Wait 30 seconds for Neo4j to start
curl http://localhost:7474
```

### Issue: Mock responses not loading
**Solution:**
- Verify mock files exist in `mocks/` directory
- Check file permissions
- Verify JSON syntax is valid

### Issue: Circuit breaker not opening
**Solution:**
- Check that CircuitBreaker class is properly instantiated
- Verify failure threshold is set to 3
- Check logs for error messages

### Issue: Neo4j queries failing
**Solution:**
- Verify Neo4j connection string in `.env`
- Check Neo4j credentials (default: neo4j/password)
- Run seed script: `npm run seed`

## Success Criteria

All checkboxes must be checked before proceeding to Hour 5-7 (IronClaw Agent Orchestration):

- [ ] All 8 integrations tested successfully
- [ ] Fallback mechanisms work for external APIs
- [ ] Circuit breaker opens after 3 failures
- [ ] Neo4j contains seeded data with proper relationships
- [ ] Audit trail is queryable and complete
- [ ] No critical errors in API logs
- [ ] Dashboard displays all 9 sponsor logos with status indicators

## Next Steps

Once all tests pass:
1. Mark task 11 as complete in tasks.md
2. Proceed to task 12: IronClaw TEE vault and credential management
3. Document any issues or workarounds in project notes
4. Commit all changes to Git

## Questions for User

If any of the following occur, ask the user:

1. **Multiple integration failures**: Should we proceed with mock-only mode or fix API integrations first?
2. **Neo4j connection issues**: Should we use Neo4j Aura cloud instance instead of local Docker?
3. **Performance issues**: Should we optimize queries or increase timeout values?
4. **Missing mock data**: Should we generate additional mock responses for edge cases?

---

**Checkpoint 11 Status:** ⬜ Not Started / ⬜ In Progress / ⬜ Complete

**Tested By:** _________________

**Date:** _________________

**Notes:**
