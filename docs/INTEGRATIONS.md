# FORGE Sponsor Integrations Documentation

## Table of Contents

1. [Overview](#overview)
2. [IronClaw - TEE-Secured Agent Runtime](#1-ironclaw---tee-secured-agent-runtime)
3. [OpenAI - LLM Reasoning Engine](#2-openai---llm-reasoning-engine)
4. [Tavily - Market Search](#3-tavily---market-search)
5. [Yutori - Deal Monitoring](#4-yutori---deal-monitoring)
6. [Senso - Context Verification](#5-senso---context-verification)
7. [Neo4j - Graph Database](#6-neo4j---graph-database)
8. [Modulate - Voice Processing](#7-modulate---voice-processing)
9. [Numeric - Financial Reconciliation](#8-numeric---financial-reconciliation)
10. [Airbyte - Data Synchronization](#9-airbyte---data-synchronization)
11. [Fallback Strategies](#fallback-strategies)
12. [Mock Data Structure](#mock-data-structure)

## Overview

FORGE integrates 9 sponsor technologies to create a complete agentic commerce platform. Each integration is designed with:

- **Primary Implementation**: Real API integration
- **Fallback Strategy**: Mock responses when API unavailable
- **Error Handling**: Circuit breaker pattern with retry logic
- **Monitoring**: Status tracking in dashboard

### Integration Status

| Sponsor | Status | Fallback Available | Required for Demo |
|---------|--------|-------------------|-------------------|
| IronClaw | Core | No | Yes |
| OpenAI | Core | No | Yes |
| Tavily | Optional | Yes | No |
| Yutori | Optional | Yes | No |
| Senso | Optional | Yes | No |
| Neo4j | Core | No | Yes |
| Modulate | Optional | Yes | No |
| Numeric | Optional | Yes | No |
| Airbyte | Optional | Yes | No |

**Minimum Required**: OpenAI + Neo4j + IronClaw (local)

---

## 1. IronClaw - TEE-Secured Agent Runtime

### Purpose

Provides Trusted Execution Environment (TEE) for secure credential storage and agent orchestration.

### Integration Type

**Core System Dependency** - Runs locally, no cloud API

### Setup

```bash
# Install IronClaw CLI
brew install ironclaw  # macOS
# or
cargo install ironclaw-cli  # All platforms

# Onboard with NEAR AI
ironclaw onboard

# Initialize agent workspace
ironclaw init forge-agent

# Configure LLM backend
ironclaw config set llm.provider openai
ironclaw config set llm.model gpt-4o
```

### API Endpoints

**Local Runtime**:
- Base URL: `http://localhost:8080`
- Agent Query: `POST /agent/query`
- Tool Registry: `GET /tools`
- Vault Access: Internal (not exposed)

### Authentication

No API key required - runs locally with NEAR AI authentication.

### Code Example

```typescript
// Initialize IronClaw client
import { IronClawClient } from './lib/ironclaw';

const client = new IronClawClient({
  baseUrl: process.env.IRONCLAW_API_URL || 'http://localhost:8080',
  agentId: 'forge-agent'
});

// Query agent
const response = await client.query({
  userId: 'demo-user-1',
  message: 'Scout NEAR NFTs under 50 NEAR',
  context: {}
});

// Response includes tool calls and decisions
console.log(response.decision);
```

### TEE Vault Usage

```rust
// WASM tool accessing TEE vault
use ironclaw_sdk::{Tool, ToolResult, SecretVault};

pub struct MockWallet {
    vault: SecretVault,
}

impl Tool for MockWallet {
    fn execute(&self, params: Value) -> ToolResult {
        // Retrieve credentials from TEE (never logged)
        let private_key = self.vault.get_secret("NEAR_PRIVATE_KEY")?;
        
        // Use key for signing
        let signature = sign_transaction(&private_key, &params);
        
        // Log access without exposing key
        log::info!("TEE: Credentials accessed for transaction");
        
        ToolResult::success(json!({
            "transactionHash": generate_hash(&signature),
            "credentialsExposed": false
        }))
    }
}
```

### Fallback Strategy

**None** - IronClaw is a core system dependency. The demo requires IronClaw to be running.

### Monitoring

```bash
# View agent logs
ironclaw logs --follow

# Check vault access logs
ironclaw vault logs forge-credentials

# View tool execution logs
ironclaw logs --tool mock_wallet
```

---

## 2. OpenAI - LLM Reasoning Engine

### Purpose

Powers the AI agent's reasoning, decision-making, and natural language understanding.

### Integration Type

**Core System Dependency** - REST API

### Setup

```bash
# Get API key from https://platform.openai.com/api-keys
# Add to .env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
```

### API Endpoints

**Base URL**: `https://api.openai.com/v1`

**Chat Completions**: `POST /chat/completions`

### Authentication

```typescript
headers: {
  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json'
}
```

### Code Example

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Agent reasoning with tool calling
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: 'You are FORGE, an AI agent for secure crypto commerce...'
    },
    {
      role: 'user',
      content: 'Scout NEAR NFTs under 50 NEAR'
    }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'tavily_search',
        description: 'Search for NEAR NFT listings',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            maxResults: { type: 'number' }
          }
        }
      }
    }
  ],
  tool_choice: 'auto',
  temperature: 0.7
});

// Handle tool calls
if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    const result = await executeTool(toolCall.function.name, toolCall.function.arguments);
    // Continue conversation with tool results
  }
}
```

### Fallback Strategy

**None** - OpenAI is required for agent reasoning. No viable fallback.

### Rate Limits

- GPT-4o: 10,000 requests/day (free tier)
- 500 requests/minute
- Monitor usage in OpenAI dashboard

### Error Handling

```typescript
try {
  const response = await openai.chat.completions.create({...});
} catch (error) {
  if (error.status === 429) {
    // Rate limit exceeded - wait and retry
    await sleep(60000);
    return retry();
  } else if (error.status === 500) {
    // OpenAI server error - retry with backoff
    return retryWithBackoff();
  }
  throw error;
}
```

---

## 3. Tavily - Market Search

### Purpose

Real-time web search for NEAR NFT market data and listings.

### Integration Type

**Optional** - REST API with mock fallback

### Setup

```bash
# Get API key from https://tavily.com
# Add to .env
TAVILY_API_KEY=tvly-...
USE_MOCK_TAVILY=false  # Set to true to force mocks
```

### API Endpoints

**Base URL**: `https://api.tavily.com/v1`

**Search**: `POST /search`

### Authentication

```typescript
headers: {
  'Content-Type': 'application/json'
},
body: {
  api_key: process.env.TAVILY_API_KEY,
  query: '...',
  ...
}
```

### Code Example

```typescript
import axios from 'axios';

async function tavilySearch(query: string, maxResults: number = 3) {
  try {
    const response = await axios.post('https://api.tavily.com/v1/search', {
      api_key: process.env.TAVILY_API_KEY,
      query: query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_domains: ['paras.id', 'mintbase.xyz', 'near.org']
    });
    
    return {
      results: response.data.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        publishedDate: r.published_date
      })),
      query: query,
      responseTime: response.data.response_time
    };
  } catch (error) {
    console.warn('Tavily unavailable, using mock');
    return getMockTavilyResponse(query);
  }
}
```

### Request Format

```json
{
  "api_key": "tvly-...",
  "query": "NEAR NFT listings under 50 NEAR",
  "search_depth": "advanced",
  "max_results": 3,
  "include_domains": ["paras.id", "mintbase.xyz"]
}
```

### Response Format

```json
{
  "results": [
    {
      "title": "NEAR Punk #1234 - Listed for 28 NEAR",
      "url": "https://paras.id/token/nearpunks.near::1234",
      "content": "Rare NEAR Punk with laser eyes. Floor price: 25.5 NEAR",
      "score": 0.95,
      "published_date": "2026-02-27"
    }
  ],
  "query": "NEAR NFT listings under 50 NEAR",
  "response_time": 1.2
}
```

### Fallback Strategy

**Mock JSON Responses** from `mocks/tavily-responses.json`

```typescript
function getMockTavilyResponse(query: string) {
  const mockData = require('../mocks/tavily-responses.json');
  return mockData.default_response;
}
```

### Rate Limits

- Free tier: 1000 searches/month
- 10 requests/minute
- Monitor usage in Tavily dashboard

---

## 4. Yutori - Deal Monitoring

### Purpose

Create persistent "scouts" that monitor markets for deals and price changes.

### Integration Type

**Optional** - REST API with mock fallback

### Setup

```bash
# Get API key from https://yutori.io
# Add to .env
YUTORI_API_KEY=yutori-...
USE_MOCK_YUTORI=false
```

### API Endpoints

**Base URL**: `https://api.yutori.io/v1`

**Create Scout**: `POST /scouts`
**Get Scout Results**: `GET /scouts/{scoutId}/findings`

### Authentication

```typescript
headers: {
  'Authorization': `Bearer ${process.env.YUTORI_API_KEY}`,
  'Content-Type': 'application/json'
}
```

### Code Example

```typescript
async function createYutoriScout(params: {
  name: string;
  targetUrls: string[];
  alertConditions: any;
}) {
  try {
    const response = await axios.post('https://api.yutori.io/v1/scouts', {
      name: params.name,
      description: `Monitor ${params.name} for deals`,
      target_urls: params.targetUrls,
      monitoring_frequency: 'hourly',
      alert_conditions: params.alertConditions
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.YUTORI_API_KEY}`
      }
    });
    
    return {
      scoutId: response.data.scout_id,
      status: response.data.status,
      findings: response.data.initial_findings
    };
  } catch (error) {
    console.warn('Yutori unavailable, using mock');
    return getMockYutoriResponse(params);
  }
}
```

### Request Format

```json
{
  "name": "NEAR NFT Scout",
  "description": "Monitor NEAR NFT markets for deals under 50 NEAR",
  "target_urls": [
    "https://paras.id/search?collection=nearpunks.near",
    "https://mintbase.xyz/contract/nearpunks.near"
  ],
  "monitoring_frequency": "hourly",
  "alert_conditions": {
    "price_below": 50,
    "keywords": ["rare", "legendary"]
  }
}
```

### Response Format

```json
{
  "scout_id": "scout-abc123",
  "status": "active",
  "initial_findings": [
    {
      "timestamp": "2026-02-27T10:00:00Z",
      "url": "https://paras.id/token/nearpunks.near::1234",
      "data": {
        "price": 28,
        "collection": "NEAR Punks",
        "tokenId": "1234"
      },
      "alert_triggered": true
    }
  ]
}
```

### Fallback Strategy

**Periodic Tavily Calls** or mock scout data

```typescript
function getMockYutoriResponse(params: any) {
  return {
    scoutId: `mock-scout-${Date.now()}`,
    status: 'active',
    findings: require('../mocks/yutori-responses.json').findings
  };
}
```

---

## 5. Senso - Context Verification

### Purpose

Verify NFT collection legitimacy and floor prices against trusted sources.

### Integration Type

**Optional** - REST API with mock fallback

### Setup

```bash
# Get API key from https://senso.ai
# Add to .env
SENSO_API_KEY=senso-...
USE_MOCK_SENSO=false
```

### API Endpoints

**Base URL**: `https://api.senso.ai/v1`

**Verify Context**: `POST /verify`

### Authentication

```typescript
headers: {
  'X-API-Key': process.env.SENSO_API_KEY,
  'Content-Type': 'application/json'
}
```

### Code Example

```typescript
async function sensoVerify(dealData: {
  assetId: string;
  collection: string;
  price: number;
  seller: string;
}) {
  try {
    const response = await axios.post('https://api.senso.ai/v1/verify', {
      deal_data: dealData,
      verification_type: 'all',
      include_sources: true
    }, {
      headers: {
        'X-API-Key': process.env.SENSO_API_KEY
      }
    });
    
    return {
      verified: response.data.verified,
      confidenceScore: response.data.confidence_score,
      checks: response.data.checks,
      groundTruth: response.data.ground_truth,
      sources: response.data.sources,
      riskLevel: response.data.risk_level
    };
  } catch (error) {
    console.warn('Senso unavailable, using mock');
    return getMockSensoResponse(dealData);
  }
}
```

### Request Format

```json
{
  "deal_data": {
    "asset_id": "nearpunks.near::1234",
    "collection": "NEAR Punks",
    "price": 28,
    "seller": "alice.near",
    "listing_url": "https://paras.id/token/nearpunks.near::1234"
  },
  "verification_type": "all",
  "include_sources": true
}
```

### Response Format

```json
{
  "verified": true,
  "confidence_score": 0.92,
  "checks": {
    "collection_legitimate": true,
    "floor_price_accurate": true,
    "seller_reputable": true
  },
  "ground_truth": {
    "actual_floor_price": 25.5,
    "price_deviation": 9.8,
    "collection_verified_url": "https://nearpunks.com"
  },
  "sources": [
    {
      "url": "https://paras.id/collection/nearpunks.near",
      "authority": "Paras Marketplace",
      "timestamp": "2026-02-27T10:00:00Z"
    }
  ],
  "risk_level": "low"
}
```

### Fallback Strategy

**Hardcoded Floor Prices** for demo collections

```typescript
function getMockSensoResponse(dealData: any) {
  const floorPrices = {
    'NEAR Punks': 25.5,
    'Antisocial Ape Club': 42.0,
    'Paras Gems': 15.0
  };
  
  const floorPrice = floorPrices[dealData.collection] || 20.0;
  const deviation = ((dealData.price - floorPrice) / floorPrice) * 100;
  
  return {
    verified: true,
    confidenceScore: 0.92,
    checks: {
      collectionLegitimate: true,
      floorPriceAccurate: Math.abs(deviation) < 15,
      sellerReputable: true
    },
    groundTruth: {
      actualFloorPrice: floorPrice,
      priceDeviation: deviation
    },
    sources: [
      {
        url: 'https://paras.id/collection/' + dealData.collection,
        authority: 'Paras Marketplace',
        timestamp: new Date().toISOString()
      }
    ],
    riskLevel: Math.abs(deviation) > 15 ? 'high' : 'low'
  };
}
```

---

## 6. Neo4j - Graph Database

### Purpose

Store policies, relationships, audit trails; enforce compliance rules.

### Integration Type

**Core System Dependency** - Bolt protocol driver

### Setup

```bash
# Local development (docker-compose)
docker-compose up -d neo4j

# Production (Neo4j Aura)
# Create instance at https://console.neo4j.io/

# Add to .env
NEO4J_URI=bolt://localhost:7687  # or neo4j+s://...aura...
NEO4J_USER=neo4j
NEO4J_PASSWORD=forgepassword
```

### API Endpoints

**Bolt Protocol**: `bolt://localhost:7687`
**Browser UI**: `http://localhost:7474`

### Authentication

```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USER,
    process.env.NEO4J_PASSWORD
  )
);
```

### Code Example

```typescript
// Check user policies
async function checkPolicies(userId: string, transaction: any) {
  const session = driver.session();
  
  try {
    // Retrieve policies
    const result = await session.run(
      `MATCH (u:User {id: $userId})-[:HAS_POLICY]->(p:Policy)
       WHERE p.active = true
       RETURN p`,
      { userId }
    );
    
    const policies = result.records.map(r => r.get('p').properties);
    
    // Check each policy
    const violations = [];
    for (const policy of policies) {
      if (violatesPolicy(policy, transaction)) {
        violations.push({
          policyId: policy.id,
          threshold: policy.threshold,
          actualValue: transaction.amount
        });
      }
    }
    
    // Log decision
    await session.run(
      `CREATE (d:Decision {
         id: $decisionId,
         timestamp: datetime(),
         verdict: $verdict,
         reasoning: $reasoning
       })
       WITH d
       MATCH (u:User {id: $userId})
       CREATE (u)-[:MADE_DECISION]->(d)`,
      {
        decisionId: generateId(),
        verdict: violations.length === 0 ? 'approve' : 'reject',
        reasoning: violations.length === 0 
          ? 'All policies passed' 
          : `Violated ${violations.length} policies`,
        userId
      }
    );
    
    return {
      approved: violations.length === 0,
      violatedPolicies: violations
    };
  } finally {
    await session.close();
  }
}
```

### Common Queries

```cypher
// Get user policies
MATCH (u:User {id: $userId})-[:HAS_POLICY]->(p:Policy)
WHERE p.active = true
RETURN p

// Query audit trail
MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:CHECKED_POLICY]->(p:Policy)
WHERE d.timestamp > datetime($startDate)
RETURN u, d, p
ORDER BY d.timestamp DESC

// Find policy violations
MATCH (d:Decision)-[:VIOLATED_POLICY]->(p:Policy)
RETURN d, p

// Analyze transaction patterns
MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)
WHERE d.timestamp > datetime() - duration('P1D')
RETURN u.name, count(t) as tx_count, sum(t.amount) as total_amount
```

### Fallback Strategy

**None** - Neo4j is required for governance and audit trail. No viable fallback.

### Monitoring

```bash
# Check connection
curl http://localhost:7474

# View logs
docker-compose logs neo4j

# Open browser
open http://localhost:7474
```

---

## 7. Modulate - Voice Processing

### Purpose

Voice transcription, intent analysis, emotion detection, fraud scoring.

### Integration Type

**Optional** - REST API with mock fallback

### Setup

```bash
# Get API key from https://modulate.ai
# Add to .env
MODULATE_API_KEY=mod-...
USE_MOCK_MODULATE=false
```

### API Endpoints

**Base URL**: `https://api.modulate.ai/v1`

**Analyze Voice**: `POST /analyze`

### Authentication

```typescript
headers: {
  'Authorization': `Bearer ${process.env.MODULATE_API_KEY}`,
  'Content-Type': 'multipart/form-data'
}
```

### Code Example

```typescript
import FormData from 'form-data';
import fs from 'fs';

async function modulateAnalyze(audioFile: string, userId: string) {
  try {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFile));
    formData.append('user_id', userId);
    formData.append('analysis_type', 'full');
    
    const response = await axios.post(
      'https://api.modulate.ai/v1/analyze',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.MODULATE_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );
    
    return {
      transcript: response.data.transcript,
      intent: response.data.intent,
      emotion: response.data.emotion,
      fraudScore: response.data.fraud_score,
      approved: response.data.fraud_score < 0.7,
      timestamp: response.data.timestamp
    };
  } catch (error) {
    console.warn('Modulate unavailable, using fallback');
    return getMockModulateResponse(audioFile);
  }
}
```

### Request Format

```
POST /analyze
Content-Type: multipart/form-data

audio: <binary audio file>
user_id: demo-user-1
analysis_type: full
```

### Response Format

```json
{
  "transcript": "Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low",
  "intent": {
    "action": "scout",
    "asset_type": "nft",
    "price_limit": 50,
    "risk_preference": "low"
  },
  "emotion": {
    "confidence": 0.85,
    "urgency": 0.3
  },
  "fraud_score": 0.12,
  "approved": true,
  "timestamp": "2026-02-27T10:00:00Z"
}
```

### Fallback Strategy

**OpenAI Whisper + Mock Scores**

```typescript
async function getMockModulateResponse(audioFile: string) {
  // Use OpenAI Whisper for transcription
  const transcript = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFile),
    model: 'whisper-1'
  });
  
  // Use GPT-4 for intent extraction
  const intentResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Extract intent from voice command. Return JSON with action, asset_type, price_limit, risk_preference.'
      },
      {
        role: 'user',
        content: transcript.text
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  const intent = JSON.parse(intentResponse.choices[0].message.content);
  
  return {
    transcript: transcript.text,
    intent: intent,
    emotion: {
      confidence: 0.8,
      urgency: 0.3
    },
    fraudScore: 0.1, // Mock low fraud score
    approved: true,
    timestamp: new Date().toISOString()
  };
}
```

---

## 8. Numeric - Financial Reconciliation

### Purpose

Generate "Flux Reports" explaining portfolio variance and anomalies.

### Integration Type

**Optional** - REST API with mock fallback

### Setup

```bash
# Get API key from https://numeric.io
# Add to .env
NUMERIC_API_KEY=num-...
USE_MOCK_NUMERIC=false
```

### API Endpoints

**Base URL**: `https://api.numeric.io/v1`

**Reconcile**: `POST /reconcile`

### Authentication

```typescript
headers: {
  'X-API-Key': process.env.NUMERIC_API_KEY,
  'Content-Type': 'application/json'
}
```

### Code Example

```typescript
async function numericReconcile(params: {
  userId: string;
  transaction: any;
  portfolioBefore: any;
}) {
  try {
    const response = await axios.post(
      'https://api.numeric.io/v1/reconcile',
      {
        user_id: params.userId,
        transaction: params.transaction,
        portfolio_before: params.portfolioBefore,
        generate_explanation: true
      },
      {
        headers: {
          'X-API-Key': process.env.NUMERIC_API_KEY
        }
      }
    );
    
    return {
      portfolioAfter: response.data.portfolio_after,
      variance: response.data.variance,
      anomalies: response.data.anomalies,
      aiExplanation: response.data.ai_explanation,
      reconciled: response.data.reconciled,
      timestamp: response.data.timestamp
    };
  } catch (error) {
    console.warn('Numeric unavailable, using fallback');
    return getMockNumericResponse(params);
  }
}
```

### Request Format

```json
{
  "user_id": "demo-user-1",
  "transaction": {
    "type": "buy",
    "asset_id": "nearpunks.near::1234",
    "amount": 28,
    "price": 28,
    "fees": 0.5
  },
  "portfolio_before": {
    "total_value": 1000,
    "assets": {
      "NEAR": 1000
    }
  },
  "generate_explanation": true
}
```

### Response Format

```json
{
  "portfolio_after": {
    "total_value": 1000,
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
  "ai_explanation": "Portfolio successfully updated. Purchased NEAR Punk #1234 for 28 NEAR with 0.5 NEAR in fees. Transaction completed within expected parameters. New portfolio value: 971.5 NEAR (cash) + 28 NEAR (NFT) = 1000 NEAR total.",
  "reconciled": true,
  "timestamp": "2026-02-27T10:05:00Z"
}
```

### Fallback Strategy

**Local Calculation + OpenAI Explanation**

```typescript
async function getMockNumericResponse(params: any) {
  const { transaction, portfolioBefore } = params;
  
  // Calculate portfolio after
  const portfolioAfter = {
    totalValue: portfolioBefore.total_value,
    assets: {
      ...portfolioBefore.assets,
      NEAR: portfolioBefore.assets.NEAR - transaction.amount - transaction.fees,
      [transaction.asset_id]: transaction.amount
    }
  };
  
  // Calculate variance
  const expected = transaction.amount + transaction.fees;
  const actual = portfolioBefore.total_value - portfolioAfter.totalValue;
  const deviation = ((actual - expected) / expected) * 100;
  
  // Generate AI explanation with OpenAI
  const explanation = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Generate a concise financial reconciliation explanation.'
      },
      {
        role: 'user',
        content: `Transaction: Bought ${transaction.asset_id} for ${transaction.amount} NEAR with ${transaction.fees} NEAR fees. Portfolio before: ${portfolioBefore.total_value} NEAR. Portfolio after: ${portfolioAfter.totalValue} NEAR.`
      }
    ]
  });
  
  return {
    portfolioAfter,
    variance: {
      expected,
      actual,
      deviation
    },
    anomalies: Math.abs(deviation) > 5 ? [{
      type: 'variance_exceeded',
      severity: 'medium',
      description: `Variance of ${deviation.toFixed(2)}% exceeds 5% threshold`
    }] : [],
    aiExplanation: explanation.choices[0].message.content,
    reconciled: true,
    timestamp: new Date().toISOString()
  };
}
```

---

## 9. Airbyte - Data Synchronization

### Purpose

ETL for seeding initial data into Neo4j for demo.

### Integration Type

**Optional** - Docker with fallback to direct Cypher

### Setup

```bash
# Start with docker-compose
docker-compose up -d airbyte

# Access UI
open http://localhost:8000

# Or use direct Cypher fallback
cat neo4j/seed.cypher | docker exec -i neo4j cypher-shell -u neo4j -p forgepassword
```

### API Endpoints

**UI**: `http://localhost:8000`
**API**: `http://localhost:8001/api/v1`

### Configuration

```yaml
# Airbyte connection configuration
source:
  type: file
  location: ./neo4j/seed-data.json

destination:
  type: neo4j
  uri: bolt://neo4j:7687
  username: neo4j
  password: forgepassword

mappings:
  - source_field: users
    dest_node: User
  - source_field: policies
    dest_node: Policy
  - source_field: collections
    dest_node: Collection
```

### Fallback Strategy

**Direct Cypher Script Execution**

```bash
# Run seed script directly
npm run seed

# Or manually
cat neo4j/seed.cypher | docker exec -i neo4j cypher-shell -u neo4j -p forgepassword
```

### Seed Data Structure

See [Mock Data Structure](#mock-data-structure) section below.

---

## Fallback Strategies

### Circuit Breaker Implementation

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(
    fn: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    // If circuit is open, use fallback immediately
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > 60000) {
        this.state = 'half-open';
      } else {
        console.warn('Circuit breaker open, using fallback');
        return fallback();
      }
    }
    
    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= 3) {
        this.state = 'open';
        console.error('Circuit breaker opened after 3 failures');
      }
      
      console.warn('API call failed, using fallback');
      return fallback();
    }
  }
}

// Usage
const tavilyBreaker = new CircuitBreaker();

const results = await tavilyBreaker.execute(
  () => tavilySearch(query),
  () => getMockTavilyResponse(query)
);
```

### Retry with Exponential Backoff

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Mock Data Structure

### Tavily Mock Response

```json
{
  "default_response": {
    "results": [
      {
        "title": "NEAR Punk #1234 - Listed for 28 NEAR",
        "url": "https://paras.id/token/nearpunks.near::1234",
        "content": "Rare NEAR Punk with laser eyes. Floor price: 25.5 NEAR",
        "score": 0.95,
        "published_date": "2026-02-27"
      },
      {
        "title": "ASAC #567 - 45 NEAR",
        "url": "https://paras.id/token/asac.near::567",
        "content": "Antisocial Ape Club member. Floor: 42 NEAR",
        "score": 0.88,
        "published_date": "2026-02-27"
      },
      {
        "title": "Paras Gem #890 - 18 NEAR",
        "url": "https://paras.id/token/paras.near::890",
        "content": "Rare gem NFT. Floor: 15 NEAR",
        "score": 0.82,
        "published_date": "2026-02-27"
      }
    ],
    "query": "NEAR NFT listings",
    "response_time": 1.2
  }
}
```

### Senso Mock Response

```json
{
  "collections": [
    {
      "name": "NEAR Punks",
      "floor_price": 25.5,
      "verified": true,
      "contract_address": "nearpunks.near"
    },
    {
      "name": "Antisocial Ape Club",
      "floor_price": 42.0,
      "verified": true,
      "contract_address": "asac.near"
    },
    {
      "name": "Paras Gems",
      "floor_price": 15.0,
      "verified": true,
      "contract_address": "paras.near"
    }
  ]
}
```

### Numeric Mock Response

```json
{
  "default_flux_report": {
    "portfolio_after": {
      "total_value": 1000,
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
    "ai_explanation": "Portfolio successfully updated. Purchased NEAR Punk #1234 for 28 NEAR with 0.5 NEAR in fees.",
    "reconciled": true
  }
}
```

### Yutori Mock Response

```json
{
  "findings": [
    {
      "timestamp": "2026-02-27T10:00:00Z",
      "url": "https://paras.id/token/nearpunks.near::1234",
      "data": {
        "price": 28,
        "collection": "NEAR Punks",
        "token_id": "1234"
      },
      "alert_triggered": true
    }
  ]
}
```

### Modulate Mock Response

```json
{
  "default_analysis": {
    "transcript": "Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low",
    "intent": {
      "action": "scout",
      "asset_type": "nft",
      "price_limit": 50,
      "risk_preference": "low"
    },
    "emotion": {
      "confidence": 0.85,
      "urgency": 0.3
    },
    "fraud_score": 0.12,
    "approved": true
  }
}
```

---

## Integration Testing

### Test All Integrations

```bash
# Run integration health check
npm run test:integrations

# Check specific sponsor
npm run test:integration -- --sponsor=tavily
```

### Monitor Integration Status

```bash
# Via API
curl http://localhost:3001/api/demo/status

# Via Dashboard
# Open http://localhost:3000
# Check Sponsor Grid for status indicators
```

### Expected Output

```json
{
  "sponsors": {
    "ironclaw": "active",
    "openai": "active",
    "tavily": "mock",
    "yutori": "inactive",
    "senso": "mock",
    "neo4j": "active",
    "modulate": "mock",
    "numeric": "mock",
    "airbyte": "active"
  },
  "timestamp": "2026-02-27T10:00:00Z"
}
```

---

## Troubleshooting

### Common Issues

**1. API Key Invalid**
```
Error: 401 Unauthorized
Solution: Verify API key in .env, check expiration
```

**2. Rate Limit Exceeded**
```
Error: 429 Too Many Requests
Solution: Enable mock fallback or wait for rate limit reset
```

**3. Connection Timeout**
```
Error: ETIMEDOUT
Solution: Check network, verify API endpoint URL
```

**4. Circuit Breaker Open**
```
Warning: Circuit breaker open, using fallback
Solution: Wait 60 seconds for circuit to reset, or restart service
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=forge:* npm run dev

# View detailed API logs
tail -f logs/api.log

# Check Neo4j query logs
docker-compose logs neo4j | grep QUERY
```

---

## Conclusion

FORGE's integration architecture provides:
- ✅ 9 sponsor technologies working together
- ✅ Graceful fallback to mocks when APIs unavailable
- ✅ Circuit breaker pattern for resilience
- ✅ Complete monitoring and observability
- ✅ Easy testing and debugging

**Minimum Required for Demo**: OpenAI + Neo4j + IronClaw (local)

**Recommended for Full Demo**: Add Tavily, Senso, and Numeric API keys

For more details, see:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [API.md](API.md) - API endpoint documentation
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) - Demo walkthrough
