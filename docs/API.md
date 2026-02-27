# FORGE API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Voice API](#voice-api)
5. [Scout API](#scout-api)
6. [Verification API](#verification-api)
7. [Governance API](#governance-api)
8. [Finance API](#finance-api)
9. [Wallet API](#wallet-api)
10. [Demo API](#demo-api)
11. [Agent API](#agent-api)
12. [Graph API](#graph-api)
13. [Error Responses](#error-responses)
14. [Rate Limits](#rate-limits)

## Overview

The FORGE API provides RESTful endpoints for interacting with the autonomous AI agent platform. All endpoints return JSON responses and follow standard HTTP status codes.

### API Version

Current version: `v1`

### Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

Error responses:

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

## Base URL

**Local Development**: `http://localhost:3001/api`

**Production (Render)**: `https://forge-api.onrender.com/api`

## Authentication

Currently, the API does not require authentication for demo purposes. In production, you would implement:

- API key authentication via `X-API-Key` header
- JWT tokens for user sessions
- OAuth 2.0 for third-party integrations

---

## Voice API

### POST /voice/analyze

Analyze voice command with fraud detection and intent extraction.

**Requirements**: 1.1, 1.5

**Request**:
```http
POST /api/voice/analyze
Content-Type: multipart/form-data

audio: <binary audio file (WAV or MP3)>
userId: demo-user-1
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transcript": "Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low",
    "intent": {
      "action": "scout",
      "assetType": "nft",
      "priceLimit": 50,
      "riskPreference": "low"
    },
    "emotion": {
      "confidence": 0.85,
      "urgency": 0.3
    },
    "fraudScore": 0.12,
    "approved": true,
    "timestamp": "2026-02-27T10:00:00Z"
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/voice/analyze \
  -F "audio=@command.wav" \
  -F "userId=demo-user-1"
```

**Status Codes**:
- `200 OK` - Voice analyzed successfully
- `400 Bad Request` - No audio file provided or invalid format
- `500 Internal Server Error` - Analysis failed

---

### POST /voice/analyze-text

Analyze text command (for testing without audio file).

**Requirements**: 1.1, 1.4

**Request**:
```json
{
  "text": "Scout NEAR NFTs under 50 NEAR",
  "userId": "demo-user-1"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transcript": "Scout NEAR NFTs under 50 NEAR",
    "intent": {
      "action": "scout",
      "assetType": "nft",
      "priceLimit": 50,
      "riskPreference": "medium"
    },
    "emotion": {
      "confidence": 0.8,
      "urgency": 0.5
    },
    "fraudScore": 0.1,
    "approved": true,
    "timestamp": "2026-02-27T10:00:00Z"
  },
  "note": "Text-based analysis (no audio processing)"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/voice/analyze-text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Scout NEAR NFTs under 50 NEAR",
    "userId": "demo-user-1"
  }'
```

---

### GET /voice/health

Health check for voice service.

**Response**:
```json
{
  "status": "ok",
  "service": "voice",
  "modulateConfigured": true,
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Scout API

### POST /scout/search

Search for deals using Tavily.

**Requirements**: 2.1, 2.3, 2.5

**Request**:
```json
{
  "query": "NEAR NFT listings",
  "assetType": "nft",
  "priceLimit": 50,
  "maxResults": 3,
  "searchDepth": "advanced"
}
```

**Response**:
```json
{
  "results": [
    {
      "asset_id": "nearpunks.near::1234",
      "price": 28,
      "collection": "NEAR Punks",
      "listing_url": "https://paras.id/token/nearpunks.near::1234",
      "title": "NEAR Punk #1234 - Listed for 28 NEAR",
      "content": "Rare NEAR Punk with laser eyes",
      "score": 0.95
    },
    {
      "asset_id": "asac.near::567",
      "price": 45,
      "collection": "Antisocial Ape Club",
      "listing_url": "https://paras.id/token/asac.near::567",
      "title": "ASAC #567 - 45 NEAR",
      "content": "Antisocial Ape Club member",
      "score": 0.88
    }
  ],
  "scoutId": null,
  "message": "Found 2 deal candidates"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/scout/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "NEAR NFT listings",
    "priceLimit": 50,
    "maxResults": 3
  }'
```

---

### POST /scout/create

Create Yutori scout for ongoing monitoring.

**Requirements**: 2.2

**Request**:
```json
{
  "name": "NEAR NFT Scout",
  "description": "Monitor NEAR NFT markets",
  "targetUrls": ["https://paras.id"],
  "monitoringFrequency": "hourly",
  "alertConditions": {
    "priceBelow": 50
  }
}
```

**Response**:
```json
{
  "scoutId": "scout-abc123",
  "status": "active",
  "message": "Scout created successfully",
  "findings": []
}
```

---

### GET /scout/:scoutId

Get scout findings.

**Response**:
```json
{
  "scoutId": "scout-abc123",
  "status": "active",
  "findings": [
    {
      "timestamp": "2026-02-27T10:00:00Z",
      "url": "https://paras.id/token/nearpunks.near::1234",
      "data": {
        "price": 28,
        "collection": "NEAR Punks"
      },
      "alertTriggered": true
    }
  ]
}
```

---

## Verification API

### POST /verify/context

Verify deal context using Senso Context Hub.

**Requirements**: 3.1, 3.2, 3.4, 7.2

**Request**:
```json
{
  "dealData": {
    "assetId": "nearpunks.near::1234",
    "collection": "NEAR Punks",
    "price": 28,
    "seller": "alice.near",
    "listingUrl": "https://paras.id/token/nearpunks.near::1234"
  },
  "verificationType": "all"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "confidenceScore": 0.92,
    "checks": {
      "collectionLegitimate": true,
      "floorPriceAccurate": true,
      "sellerReputable": true
    },
    "groundTruth": {
      "actualFloorPrice": 25.5,
      "priceDeviation": 9.8
    },
    "sources": [
      {
        "url": "https://paras.id/collection/nearpunks.near",
        "authority": "Paras Marketplace",
        "timestamp": "2026-02-27T10:00:00Z"
      }
    ],
    "riskLevel": "low"
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/verify/context \
  -H "Content-Type: application/json" \
  -d '{
    "dealData": {
      "assetId": "nearpunks.near::1234",
      "collection": "NEAR Punks",
      "price": 28,
      "seller": "alice.near"
    }
  }'
```

---

### GET /verify/health

Health check for verification service.

**Response**:
```json
{
  "status": "ok",
  "service": "verify",
  "sensoConfigured": true,
  "useMock": false,
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Governance API

### POST /govern/check

Check transaction against user policies.

**Requirements**: 4.1, 4.2, 4.3

**Request**:
```json
{
  "userId": "demo-user-1",
  "transaction": {
    "assetType": "nft",
    "amount": 28,
    "seller": "alice.near"
  },
  "context": {
    "currentPortfolioValue": 1000,
    "recentTransactionCount": 0
  }
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "approved": true,
    "violatedPolicies": [],
    "appliedPolicies": ["policy-1", "policy-2", "policy-3"],
    "reasoning": "All policies passed. Transaction amount (28 NEAR) is 2.8% of portfolio, within 10% limit."
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**Status Codes**:
- `200 OK` - Transaction approved
- `403 Forbidden` - Transaction rejected (policy violation)
- `500 Internal Server Error` - Policy check failed

---

### GET /govern/audit

Query audit trail with filters.

**Requirements**: 7.1, 7.4

**Query Parameters**:
- `userId` (optional) - Filter by user ID
- `startDate` (optional) - ISO 8601 date string
- `endDate` (optional) - ISO 8601 date string
- `decisionType` (optional) - Filter by decision type
- `limit` (optional) - Max results (default: 50)

**Response**:
```json
{
  "success": true,
  "count": 10,
  "results": [
    {
      "id": "decision-abc123",
      "timestamp": "2026-02-27T10:00:00Z",
      "type": "transaction",
      "verdict": "approve",
      "reasoning": "All policies passed",
      "userId": "demo-user-1"
    }
  ],
  "filters": {
    "userId": "demo-user-1",
    "limit": 50
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**cURL Example**:
```bash
curl "http://localhost:3001/api/govern/audit?userId=demo-user-1&limit=10"
```

---

### GET /govern/provenance/:decisionId

Get full provenance for a decision.

**Requirements**: 7.2, 7.5

**Response**:
```json
{
  "success": true,
  "provenance": {
    "decision": {
      "id": "decision-abc123",
      "timestamp": "2026-02-27T10:00:00Z",
      "verdict": "approve"
    },
    "user": {
      "id": "demo-user-1",
      "name": "Alice"
    },
    "policies": [
      {
        "id": "policy-1",
        "description": "Max 10% of portfolio per trade",
        "threshold": 0.10
      }
    ],
    "context": {
      "id": "context-xyz789",
      "confidenceScore": 0.92
    },
    "transaction": {
      "id": "tx-def456",
      "hash": "0x7a8f9b2c...",
      "amount": 28
    }
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

### POST /govern/query

Execute custom Cypher query (read-only).

**Requirements**: 12.3

**Request**:
```json
{
  "query": "MATCH (u:User)-[:HAS_POLICY]->(p:Policy) WHERE p.active = true RETURN u, p LIMIT 10",
  "params": {}
}
```

**Response**:
```json
{
  "success": true,
  "count": 3,
  "results": [
    {
      "u": {
        "id": "demo-user-1",
        "name": "Alice",
        "portfolioValue": 1000
      },
      "p": {
        "id": "policy-1",
        "description": "Max 10% of portfolio per trade",
        "threshold": 0.10
      }
    }
  ],
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**Security Note**: Only read queries (MATCH, RETURN, WHERE) are allowed. Write operations (CREATE, DELETE, SET) are blocked.

---

## Finance API

### POST /finance/reconcile

Calculate portfolio impact and generate Flux Report.

**Requirements**: 5.1, 5.2, 5.4

**Request**:
```json
{
  "userId": "demo-user-1",
  "transaction": {
    "type": "buy",
    "assetId": "nearpunks.near::1234",
    "amount": 28,
    "price": 28,
    "fees": 0.5
  },
  "portfolioBefore": {
    "totalValue": 1000,
    "assets": {
      "NEAR": 1000
    }
  }
}
```

**Response**:
```json
{
  "portfolioAfter": {
    "totalValue": 1000,
    "assets": {
      "NEAR": 971.5,
      "nearpunks.near::1234": 28
    }
  },
  "variance": {
    "expected": 28.5,
    "actual": 28.5,
    "deviation": 0.0
  },
  "anomalies": [],
  "aiExplanation": "Portfolio successfully updated. Purchased NEAR Punk #1234 for 28 NEAR with 0.5 NEAR in fees. Transaction completed within expected parameters.",
  "reconciled": true,
  "timestamp": "2026-02-27T10:05:00Z"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/finance/reconcile \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo-user-1",
    "transaction": {
      "type": "buy",
      "amount": 28,
      "fees": 0.5
    },
    "portfolioBefore": {
      "totalValue": 1000
    }
  }'
```

---

## Wallet API

### POST /wallet/execute

Execute mock NEAR transaction in TEE-secured environment.

**Requirements**: 6.1, 6.2, 6.3, 6.4, 6.5

**Request**:
```json
{
  "operation": "nft_buy",
  "params": {
    "recipient": "alice.near",
    "amount": 28,
    "tokenId": "nearpunks.near::1234"
  },
  "userId": "demo-user-1"
}
```

**Response**:
```json
{
  "success": true,
  "transactionHash": "0x7a8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c",
  "signedPayload": {
    "nonce": 12345,
    "blockHash": "mock_block_hash",
    "actions": [...]
  },
  "gasUsed": 5000000,
  "timestamp": "2026-02-27T10:00:00Z",
  "credentialsExposed": false
}
```

**Security Note**: The `credentialsExposed` field is always `false`, confirming that private keys were never exposed to the LLM. Check audit logs for "TEE: Credentials accessed" entries.

---

## Demo API

### POST /demo/run

Execute full demo flow with comprehensive validation.

**Requirements**: 10.1, 10.2, 10.3, 10.4, 10.5

**Request**:
```json
{
  "voiceCommand": "Scout NEAR NFTs under 50 NEAR and buy the best one",
  "userId": "demo-user-1"
}
```

**Response**:
```json
{
  "success": true,
  "duration": 12300,
  "taskId": "task-abc123",
  "decision": {
    "verdict": "approve",
    "reasoning": "All policies passed, confidence score 0.92"
  },
  "toolCalls": [
    {
      "tool": "tavily_search",
      "status": "success",
      "duration": 1200
    },
    {
      "tool": "senso_verify",
      "status": "success",
      "duration": 800
    },
    {
      "tool": "neo4j_check_policy",
      "status": "success",
      "duration": 500
    }
  ],
  "sponsorValidation": {
    "allSponsorsInvoked": true,
    "sponsorStatus": {
      "ironclaw": "active",
      "openai": "active",
      "tavily": "active",
      "yutori": "mock",
      "senso": "active",
      "neo4j": "active",
      "modulate": "mock",
      "numeric": "active",
      "airbyte": "active"
    }
  },
  "graphValidation": {
    "nodesCreated": 7,
    "minimumMet": true,
    "nodesBefore": 10,
    "nodesAfter": 17
  },
  "auditTrail": {
    "decisionId": "decision-abc123",
    "timestamp": "2026-02-27T10:00:00Z"
  },
  "validations": {
    "sponsorsValid": true,
    "graphGrowthValid": true,
    "decisionValid": true,
    "allValid": true
  }
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3001/api/demo/run \
  -H "Content-Type: application/json" \
  -d '{
    "voiceCommand": "Scout NEAR NFTs under 50 NEAR",
    "userId": "demo-user-1"
  }'
```

---

### POST /demo/reset

Reset demo state for fresh demo run.

**Response**:
```json
{
  "success": true,
  "message": "Demo state reset successfully",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

### GET /demo/status

Get demo system status.

**Response**:
```json
{
  "status": "ready",
  "components": {
    "neo4j": "active",
    "agent": "active",
    "teeVault": "active"
  },
  "graphStats": {
    "totalNodes": 25
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Agent API

### POST /agent/status

Get current agent status.

**Response**:
```json
{
  "status": "idle",
  "currentTask": null,
  "lastActivity": "2026-02-27T09:55:00Z",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**Possible Status Values**:
- `idle` - Agent is waiting for tasks
- `scouting` - Searching for deals
- `verifying` - Verifying context
- `deciding` - Checking policies
- `executing` - Executing transaction

---

### GET /agent/status/stream

Server-Sent Events (SSE) stream for real-time agent status updates.

**Usage**:
```javascript
const eventSource = new EventSource('http://localhost:3001/api/agent/status/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Agent status:', data.status);
};
```

**Event Data**:
```json
{
  "status": "scouting",
  "currentTask": {
    "taskId": "task-abc123",
    "command": "Scout NEAR NFTs",
    "progress": 45,
    "currentStep": "Searching Tavily"
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Graph API

### POST /graph/query

Execute custom Neo4j Cypher query.

**Request**:
```json
{
  "query": "MATCH (u:User)-[:MADE_DECISION]->(d:Decision) RETURN u, d LIMIT 10",
  "params": {}
}
```

**Response**:
```json
{
  "success": true,
  "count": 10,
  "results": [
    {
      "u": { "id": "demo-user-1", "name": "Alice" },
      "d": { "id": "decision-abc123", "verdict": "approve" }
    }
  ],
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

### GET /graph/visualization

Get graph data for visualization.

**Query Parameters**:
- `userId` (optional) - Filter by user
- `depth` (optional) - Graph depth (default: 2)

**Response**:
```json
{
  "nodes": [
    {
      "id": "demo-user-1",
      "label": "Alice",
      "type": "User",
      "properties": { "portfolioValue": 1000 }
    },
    {
      "id": "policy-1",
      "label": "Max 10% per trade",
      "type": "Policy",
      "properties": { "threshold": 0.10 }
    }
  ],
  "edges": [
    {
      "source": "demo-user-1",
      "target": "policy-1",
      "type": "HAS_POLICY"
    }
  ]
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Policy violation or insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | External service unavailable (using fallback) |

### Example Error Responses

**400 Bad Request**:
```json
{
  "error": "Missing required field: userId",
  "message": "The userId field is required for this operation",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**403 Forbidden (Policy Violation)**:
```json
{
  "error": "Policy Violation",
  "message": "Transaction exceeds max portfolio percentage (10%)",
  "violatedPolicies": [
    {
      "policyId": "policy-1",
      "threshold": 0.10,
      "actualValue": 0.15
    }
  ],
  "timestamp": "2026-02-27T10:00:00Z"
}
```

**503 Service Unavailable**:
```json
{
  "error": "Service unavailable",
  "message": "Tavily API unavailable, using mock fallback",
  "fallbackUsed": "mock_tavily_response",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Rate Limits

### Current Limits (Development)

No rate limits enforced in development mode.

### Production Limits (Recommended)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/voice/analyze` | 10 requests | 1 minute |
| `/scout/search` | 20 requests | 1 minute |
| `/verify/context` | 30 requests | 1 minute |
| `/govern/check` | 50 requests | 1 minute |
| `/demo/run` | 5 requests | 1 minute |
| All other endpoints | 100 requests | 1 minute |

### Rate Limit Headers

When rate limits are enforced, responses include:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1709035200
```

### Rate Limit Exceeded Response

```json
{
  "error": "Rate Limit Exceeded",
  "message": "Too many requests. Please try again in 45 seconds.",
  "retryAfter": 45,
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Webhooks (Future Feature)

### POST /webhooks/register

Register a webhook for event notifications.

**Planned Events**:
- `decision.created` - New decision made
- `transaction.executed` - Transaction completed
- `policy.violated` - Policy violation detected
- `anomaly.detected` - Financial anomaly found

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const forgeAPI = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Run demo flow
const result = await forgeAPI.post('/demo/run', {
  voiceCommand: 'Scout NEAR NFTs under 50 NEAR',
  userId: 'demo-user-1'
});

console.log('Demo completed:', result.data.success);
console.log('Duration:', result.data.duration, 'ms');
```

### Python

```python
import requests

BASE_URL = 'http://localhost:3001/api'

# Run demo flow
response = requests.post(f'{BASE_URL}/demo/run', json={
    'voiceCommand': 'Scout NEAR NFTs under 50 NEAR',
    'userId': 'demo-user-1'
})

result = response.json()
print(f"Demo completed: {result['success']}")
print(f"Duration: {result['duration']} ms")
```

### cURL

```bash
# Run demo flow
curl -X POST http://localhost:3001/api/demo/run \
  -H "Content-Type: application/json" \
  -d '{
    "voiceCommand": "Scout NEAR NFTs under 50 NEAR",
    "userId": "demo-user-1"
  }'
```

---

## Testing

### Health Check All Services

```bash
# Voice service
curl http://localhost:3001/api/voice/health

# Verification service
curl http://localhost:3001/api/verify/health

# Demo system
curl http://localhost:3001/api/demo/status
```

### Run Complete Demo Flow

```bash
curl -X POST http://localhost:3001/api/demo/run \
  -H "Content-Type: application/json" \
  -d '{
    "voiceCommand": "Scout NEAR NFTs under 50 NEAR and buy the best one",
    "userId": "demo-user-1"
  }' | jq
```

### Query Audit Trail

```bash
curl "http://localhost:3001/api/govern/audit?userId=demo-user-1&limit=10" | jq
```

---

## Changelog

### v1.0.0 (2026-02-27)

- Initial release
- All 9 sponsor integrations
- Complete demo flow
- Audit trail and governance
- TEE-secured transaction execution

---

## Support

For issues, questions, or feature requests:

- **GitHub**: [your-repo-url]/issues
- **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md), [INTEGRATIONS.md](INTEGRATIONS.md)
- **Demo Script**: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)

---

## License

MIT License - See LICENSE file for details
