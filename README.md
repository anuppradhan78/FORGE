# FORGE - Forged On-chain Regulated Governance Engine

> **Secure Agentic Commerce with TEE-Secured Credential Management**

A proof-of-concept autonomous AI agent platform for agentic crypto commerce, built for hackathon demonstration. FORGE integrates **9 sponsor technologies** into a secure, governed AI agent that scouts deals, verifies context, checks compliance policies, and executes mock cryptocurrency transactions—all running on IronClaw's TEE-secured runtime.

## 🎯 What is FORGE?

FORGE demonstrates the future of autonomous AI agents in crypto commerce by solving three critical challenges:

1. **Security**: Private keys never exposed to LLMs (TEE-secured via IronClaw)
2. **Governance**: Graph-based policy enforcement with complete audit trails (Neo4j)
3. **Verifiability**: Ground-truth verification prevents hallucinations (Senso)

### Demo Flow (Under 15 Seconds!)

```
Voice Command → Scout Deals → Verify Context → Check Policies → Execute Transaction → Display Audit Trail
```

**Watch the agent:**
- 🎤 Process voice commands with fraud detection
- 🔍 Scout NEAR NFT markets in real-time
- ✅ Verify floor prices against trusted sources
- 📊 Check compliance with user-defined policies
- 🔐 Execute transactions in TEE-secured environment
- 📈 Generate financial reconciliation reports
- 🔗 Create immutable audit trail in graph database

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  Voice Input (Modulate) │ Live Dashboard (Render + Next.js)    │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              IronClaw Runtime - TEE Secured                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  FORGE Agent (OpenAI GPT-4o)                             │  │
│  │  • Reasoning & Decision Making                           │  │
│  │  • Tool Orchestration                                    │  │
│  │  • Workflow Management                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Encrypted TEE Enclave                                   │  │
│  │  • Private Key Storage                                   │  │
│  │  • Credential Management                                 │  │
│  │  • Secure Transaction Signing                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
        ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
        │   Discovery   │ │  Governance  │ │   Finance    │
        │               │ │              │ │              │
        │ • Tavily      │ │ • Neo4j      │ │ • Numeric    │
        │ • Yutori      │ │ • Policies   │ │ • Flux       │
        │ • Senso       │ │ • Audit      │ │   Reports    │
        └───────────────┘ └──────────────┘ └──────────────┘
```

### 9 Sponsor Integrations

| Sponsor | Purpose | Status |
|---------|---------|--------|
| **IronClaw** | TEE-secured agent runtime | ✅ Core |
| **OpenAI** | GPT-4o reasoning engine | ✅ Core |
| **Tavily** | Market search & discovery | ✅ Integrated |
| **Yutori** | Deal monitoring scouts | ✅ Integrated |
| **Senso** | Context verification | ✅ Integrated |
| **Neo4j** | Graph database for governance | ✅ Core |
| **Modulate** | Voice command processing | ✅ Integrated |
| **Numeric** | Financial reconciliation | ✅ Integrated |
| **Airbyte** | Data synchronization | ✅ Integrated |

**Deployment**: Render (Dashboard hosting)

## 🚀 Quick Start (10 Minutes)

### Prerequisites

- **Docker & Docker Compose** - For Neo4j and Airbyte
- **Node.js 18+** and npm - For API and dashboard
- **Git** - For cloning repository

**Optional (for full TEE features):**
- **Rust toolchain** - For building IronClaw WASM tools
- **IronClaw CLI** - Runs natively on host (NOT in Docker)

> **Important**: IronClaw runs as a native process on your host machine, not in Docker, because it requires direct access to hardware TEE (Trusted Execution Environment) features. The demo works without IronClaw installed using mock agent functionality.

### Step 1: Clone and Configure

```bash
# Clone repository
git clone <repository-url>
cd forge

# Copy environment template
cp .env.example .env

# Edit .env - Minimum required:
# - OPENAI_API_KEY=sk-proj-...
# - Everything else has mock fallbacks!
```

**Important**: You only need an OpenAI API key to run the demo! All other services have intelligent mock fallbacks. See [`docs/API-KEYS-GUIDE.md`](docs/API-KEYS-GUIDE.md) for details.

### Step 2: Start Infrastructure

```bash
# Start Neo4j, Airbyte, and PostgreSQL
docker-compose up -d

# Wait for services to be ready (~30 seconds)
docker-compose ps

# Verify Neo4j is running
curl http://localhost:7474
```

### Step 3: Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### Step 4: Seed Database

```bash
# Load initial data into Neo4j (demo users, policies, collections)
npm run seed

# Verify data loaded successfully
npm run verify-db

# Expected output:
# ✓ Connected to Neo4j
# ✓ Found 1 demo user
# ✓ Found 3 policies
# ✓ Found 3 NFT collections
```

### Step 5: Start Services

```bash
# Option A: Start all services with one command
npm run dev

# Option B: Start services individually
# Terminal 1: API server
cd api && npm run dev

# Terminal 2: Dashboard
cd dashboard && npm run dev
```

**Note on IronClaw**: The demo works without IronClaw installed. The API server includes mock agent functionality that simulates IronClaw's behavior. If you want to use the real IronClaw runtime with hardware TEE features:

```bash
# Terminal 3: IronClaw agent (optional - runs natively, NOT in Docker)
ironclaw agent start

# IronClaw runs on your host machine at localhost:8080
# It requires direct hardware access for TEE features
```

See [`docs/IRONCLAW_SETUP.md`](docs/IRONCLAW_SETUP.md) for full IronClaw installation instructions.

### Step 6: Run Demo

1. Open browser to **http://localhost:3000**
2. You should see the FORGE dashboard with 9 sponsor logos
3. Click **"Run Demo Flow"** button
4. Watch the agent:
   - Scout NEAR NFT deals
   - Verify floor prices
   - Check compliance policies
   - Execute mock transaction
   - Generate audit trail
5. Complete flow should finish in **under 15 seconds**!

### Verify Installation

```bash
# Check all services are running
npm run health-check

# Expected output:
# ✓ API server: http://localhost:3001
# ✓ Dashboard: http://localhost:3000
# ✓ Neo4j: bolt://localhost:7687
# ✓ OpenAI: Connected
```

## 📸 Screenshots

### Dashboard Overview
![FORGE Dashboard](docs/screenshots/dashboard-overview.png)
*Live agent status, sponsor integrations, and graph visualization*

### Demo Flow in Action
![Demo Flow](docs/screenshots/demo-flow.png)
*Complete workflow from voice command to transaction execution*

### Graph Visualization
![Graph Visualization](docs/screenshots/graph-view.png)
*Interactive Neo4j governance graph showing policies, decisions, and audit trail*

### Audit Trail
![Audit Trail](docs/screenshots/audit-trail.png)
*Complete provenance of agent decisions with policy enforcement*

### Flux Report
![Flux Report](docs/screenshots/flux-report.png)
*Financial reconciliation with AI-generated variance explanations*

> **Note**: Screenshots show the system with all 9 sponsor integrations active. Your demo will work identically with mock fallbacks if you don't have all API keys.

## 📦 Project Structure

```
forge/
├── api/                    # Express API backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   └── utils/         # Helpers
│   └── package.json
├── dashboard/             # Next.js frontend
│   ├── src/
│   │   ├── app/          # App router pages
│   │   └── components/   # React components
│   └── package.json
├── ironclaw/             # IronClaw agent & tools
│   ├── agent/           # Agent runtime
│   └── tools/           # WASM tools
├── neo4j/               # Database scripts
│   └── seed.cypher      # Initial data
├── mocks/               # Mock API responses
│   ├── tavily-responses.json
│   ├── senso-responses.json
│   └── ...
├── tests/               # Property-based tests
├── docs/                # Documentation
├── docker-compose.yml   # Infrastructure
└── .env.example         # Configuration template
```

## 🔧 Technology Stack

### 9 Sponsor Integrations

1. **IronClaw** - TEE-secured agent runtime (runs natively on host, not in Docker)
2. **OpenAI** - GPT-4o reasoning engine
3. **Tavily** - Market search and discovery
4. **Yutori** - Deal monitoring scouts
5. **Senso** - Context verification
6. **Neo4j** - Graph database for governance
7. **Modulate** - Voice command processing
8. **Numeric** - Financial reconciliation
9. **Airbyte** - Data synchronization

### Additional Technologies

- **Render** - Dashboard deployment
- **PostgreSQL** - Airbyte backend
- **TypeScript** - API and dashboard
- **Rust** - IronClaw WASM tools
- **Next.js 14** - Frontend framework
- **Express** - API server

### Important: IronClaw Deployment Model

**IronClaw runs as a native process on your host machine, NOT in Docker.**

**Why?** IronClaw requires direct access to hardware TEE (Trusted Execution Environment) features like Intel SGX or ARM TrustZone. These hardware security features cannot be easily virtualized in Docker containers.

**What's in Docker?**
- ✅ Neo4j (database)
- ✅ PostgreSQL (Airbyte backend)
- ✅ Airbyte (data sync)
- ✅ `rust-builder` (builds WASM tools only, doesn't run IronClaw)

**What runs natively?**
- ✅ IronClaw agent runtime (optional - listens on localhost:8080)
- ✅ API server (Node.js/Express)
- ✅ Dashboard (Next.js)

**Demo without IronClaw**: The system includes mock agent functionality in the API server, so the demo works perfectly without IronClaw installed. The mock implementation simulates TEE-secured credential management and agent orchestration.

## 📝 Complete Documentation

- **[README.md](README.md)** - This file: Quick start and overview
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and component interactions
- **[INTEGRATIONS.md](docs/INTEGRATIONS.md)** - Detailed sponsor integration documentation
- **[API.md](docs/API.md)** - Complete API endpoint reference
- **[DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** - 5-minute demo walkthrough guide
- **[API-KEYS-GUIDE.md](docs/API-KEYS-GUIDE.md)** - How to get and configure API keys
- **[IRONCLAW_SETUP.md](docs/IRONCLAW_SETUP.md)** - IronClaw installation and configuration
- **[RENDER-DEPLOYMENT.md](docs/RENDER-DEPLOYMENT.md)** - Production deployment guide

## 🎮 Usage Examples

### Running the Demo Flow

```bash
# Via Dashboard UI
# 1. Open http://localhost:3000
# 2. Click "Run Demo Flow" button
# 3. Watch real-time status updates

# Via API
curl -X POST http://localhost:3001/api/demo/run \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user-1"}'
```

### Voice Command Processing

```bash
# Upload voice command
curl -X POST http://localhost:3001/api/voice \
  -F "audio=@command.wav" \
  -F "userId=demo-user-1"

# Example voice command:
# "Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low"
```

### Querying the Audit Trail

```bash
# Get recent decisions
curl "http://localhost:3001/api/audit?userId=demo-user-1&limit=10"

# Get decisions by type
curl "http://localhost:3001/api/audit?type=transaction&limit=5"

# Get full provenance for a decision
curl "http://localhost:3001/api/audit/decision-123/provenance"
```

### Custom Neo4j Queries

```bash
# Via API
curl -X POST http://localhost:3001/api/graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MATCH (u:User)-[:MADE_DECISION]->(d:Decision) RETURN u, d LIMIT 10"
  }'

# Via Neo4j Browser (http://localhost:7474)
MATCH (u:User)-[:HAS_POLICY]->(p:Policy)
WHERE p.active = true
RETURN u.name, p.description, p.threshold
```

### Adding Custom Policies

```cypher
// Via Neo4j Browser (http://localhost:7474)
CREATE (p:Policy {
  id: 'policy-custom-1',
  userId: 'demo-user-1',
  type: 'max_transaction_percent',
  threshold: 0.15,
  description: 'Max 15% of portfolio per trade',
  active: true,
  enforcementLevel: 'blocking',
  createdAt: datetime()
})
WITH p
MATCH (u:User {id: 'demo-user-1'})
CREATE (u)-[:HAS_POLICY]->(p)
```

### Checking Sponsor Status

```bash
# Get status of all integrations
curl http://localhost:3001/api/demo/status

# Response shows which sponsors are active vs using mocks
{
  "sponsors": {
    "openai": "active",
    "ironclaw": "active",
    "tavily": "mock",
    "senso": "mock",
    ...
  }
}
```

## 🧪 Testing

FORGE uses a dual testing approach combining unit tests and property-based tests:

### Unit Tests

Test specific examples, edge cases, and integration points:

```bash
# Run all unit tests
npm run test:unit

# Test specific component
npm test -- tests/unit/voice/voice-parser.test.ts

# Test with coverage
npm test -- --coverage
```

**Coverage includes:**
- Voice command parsing
- Mock wallet operations
- Neo4j graph queries
- Dashboard rendering
- Error handling scenarios

### Property-Based Tests

Verify universal properties across randomized inputs using **fast-check**:

```bash
# Run all property tests
npm run test:properties

# Run with more iterations
npm run test:properties -- --numRuns=1000

# Test specific property
npm test -- tests/property/governance-properties.test.ts
```

**Properties tested:**
- Round-trip preservation (parse → format → parse)
- Idempotence (same input → same output)
- Invariants (portfolio conservation)
- Metamorphic properties (audit trail growth)
- Error conditions (graceful degradation)

### Integration Tests

Test end-to-end workflows:

```bash
# Run integration tests
npm run test:integration

# Test full demo flow
npm test -- tests/integration/end-to-end-flow.test.ts
```

### Test Organization

```
tests/
├── unit/
│   ├── voice/              # Voice processing tests
│   ├── scout/              # Market scouting tests
│   ├── governance/         # Policy checking tests
│   ├── wallet/             # Mock wallet tests
│   └── dashboard/          # UI component tests
├── property/
│   ├── voice-properties.test.ts
│   ├── governance-properties.test.ts
│   ├── security-properties.test.ts
│   └── invariants.test.ts
└── integration/
    └── end-to-end-flow.test.ts
```

### Success Criteria

Tests pass when:
- ✅ All 50 property-based tests pass with 100+ iterations each
- ✅ All unit tests pass
- ✅ End-to-end integration test completes the full demo flow
- ✅ Code coverage exceeds 80% for core components
- ✅ No credentials appear in any test logs or outputs

## 📊 Dashboard Features

- **Live Agent Status** - Real-time workflow progress
- **Graph Visualization** - Interactive Neo4j governance graph
- **Audit Trail** - Complete decision provenance
- **Flux Reports** - Financial reconciliation with AI explanations
- **Sponsor Status** - Integration health monitoring

## 🔒 Security

- **TEE Enclave** - Credentials stored in IronClaw encrypted vault
- **No Credential Exposure** - Private keys never passed to LLM
- **Audit Trail** - Immutable log of all agent decisions
- **Policy Enforcement** - Graph-based compliance checking

## 🚧 Development

### Project Structure

```
forge/
├── api/                    # Express API backend
│   ├── src/
│   │   ├── routes/        # API endpoints (voice, scout, verify, govern, etc.)
│   │   ├── services/      # Business logic (AgentService, GovernanceService, etc.)
│   │   ├── utils/         # Helpers (circuit-breaker, retry, neo4j-client)
│   │   └── types/         # TypeScript type definitions
│   └── package.json
├── dashboard/             # Next.js 14 frontend
│   ├── app/              # App router pages
│   ├── components/       # React components (AgentStatus, GraphViz, etc.)
│   ├── lib/              # Client libraries (ironclaw, sponsors)
│   └── types/            # Frontend types
├── ironclaw/             # IronClaw agent & WASM tools
│   ├── agent/           # Rust agent runtime
│   └── tools/           # WASM tools (mock_wallet, etc.)
├── neo4j/               # Database scripts
│   ├── seed.cypher      # Initial data (users, policies, collections)
│   └── queries.cypher   # Common queries
├── mocks/               # Mock API responses for fallbacks
│   ├── tavily-responses.json
│   ├── senso-responses.json
│   ├── numeric-responses.json
│   └── ...
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   ├── property/       # Property-based tests
│   └── integration/    # Integration tests
├── docs/                # Documentation
│   ├── ARCHITECTURE.md
│   ├── INTEGRATIONS.md
│   ├── API.md
│   └── ...
├── docker-compose.yml   # Infrastructure (Neo4j, Airbyte, PostgreSQL)
├── render.yaml          # Render deployment configuration
└── .env.example         # Configuration template
```

### Mock Fallback System

FORGE uses a **circuit breaker pattern** with automatic fallback to mocks when sponsor APIs are unavailable:

```typescript
// Automatic fallback example
async function callSponsorAPI(apiName: string) {
  try {
    // Try real API first
    return await realAPI.call();
  } catch (error) {
    // Log the failure
    console.warn(`${apiName} unavailable, using mock`);
    
    // Automatically fall back to mock
    return mockData[apiName];
  }
}
```

**Enable/Disable Mocks** in `.env`:
```bash
USE_MOCK_TAVILY=true    # Use mock market data
USE_MOCK_SENSO=true     # Use mock verification
USE_MOCK_NUMERIC=true   # Use mock reconciliation
USE_MOCK_MODULATE=true  # Use mock voice processing
USE_MOCK_YUTORI=true    # Use mock scouts
```

**Benefits:**
- Demo works even if APIs are down
- No need to get all API keys upfront
- Can add real APIs incrementally
- System remains stable during development

### Adding New Policies

```cypher
// Via Neo4j Browser (http://localhost:7474)
CREATE (p:Policy {
  id: 'policy-new',
  userId: 'demo-user-1',
  type: 'max_transaction_percent',
  threshold: 0.15,
  description: 'Max 15% of portfolio per trade',
  active: true,
  enforcementLevel: 'blocking',
  createdAt: datetime()
})
WITH p
MATCH (u:User {id: 'demo-user-1'})
CREATE (u)-[:HAS_POLICY]->(p)
```

### Custom Cypher Queries

The dashboard supports custom Cypher queries for advanced analysis:

```cypher
// Find all rejected decisions
MATCH (d:Decision {verdict: 'reject'})
RETURN d
ORDER BY d.timestamp DESC
LIMIT 10

// Find policy violations
MATCH (d:Decision)-[:VIOLATED_POLICY]->(p:Policy)
RETURN d, p

// Analyze transaction patterns
MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)
WHERE d.timestamp > datetime() - duration('P1D')
RETURN u.name, count(t) as tx_count, sum(t.amount) as total_amount
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run property-based tests
npm run test:properties

# Run integration tests
npm run test:integration

# Run specific test file
npm test -- tests/unit/voice/voice-parser.test.ts

# Run with coverage
npm test -- --coverage
```

### Development Workflow

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Start API in watch mode
cd api && npm run dev

# 3. Start dashboard in watch mode
cd dashboard && npm run dev

# 4. Make changes - hot reload is enabled

# 5. Run tests
npm test

# 6. Check types
npm run type-check

# 7. Lint code
npm run lint
```

## 📝 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Documentation](docs/API.md)
- [Integrations Guide](docs/INTEGRATIONS.md)
- [Demo Script](docs/DEMO_SCRIPT.md)
- [IronClaw Setup Guide](docs/IRONCLAW_SETUP.md)
- [API Keys Guide](docs/API-KEYS-GUIDE.md)
- [Render Deployment Guide](docs/RENDER-DEPLOYMENT.md)

## 🌐 Deployment to Render

### Quick Deploy

See detailed instructions in **[RENDER-DEPLOYMENT.md](docs/RENDER-DEPLOYMENT.md)**

**Summary:**

1. **Create Neo4j Aura instance** (free tier)
   - Go to https://console.neo4j.io/
   - Create new AuraDB Free instance
   - Save connection URI and password

2. **Deploy to Render**
   - Push code to GitHub
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create services

3. **Configure Environment Variables**
   - Add all sponsor API keys to both services
   - Add Neo4j Aura connection details
   - Update CORS_ORIGIN to match dashboard URL

4. **Verify Deployment**
   ```bash
   # Test deployed services
   node tests/verify-deployment.js \
     https://forge-api.onrender.com \
     https://forge-dashboard.onrender.com
   ```

### Production Checklist

- [ ] Neo4j Aura instance created and seeded
- [ ] All sponsor API keys added to Render
- [ ] CORS_ORIGIN matches dashboard URL
- [ ] API health check returns 200 OK
- [ ] Dashboard loads without errors
- [ ] Demo flow completes successfully
- [ ] Audit trail shows all decisions
- [ ] Graph visualization renders correctly
- [ ] All 9 sponsor logos show "active" status
- [ ] 3 consecutive demo runs work without errors

### Free Tier Limitations

**Render Free Tier:**
- Services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds
- 750 hours/month of runtime per service
- Automatic deploys on git push

**Neo4j Aura Free Tier:**
- 200k nodes + 400k relationships limit
- 50 concurrent connections
- 1GB storage
- Sufficient for demo purposes

## 🎯 Success Criteria

- ✅ Voice → Execute flow completes in < 15 seconds
- ✅ All 9 sponsor integrations functional
- ✅ Live governance visualization
- ✅ Audit trail proves no credential exposure
- ✅ 3 consecutive demo runs without errors

## 🐛 Troubleshooting

### Neo4j Connection Failed

```bash
# Check Neo4j is running
docker-compose ps neo4j

# View logs
docker-compose logs neo4j

# Restart service
docker-compose restart neo4j
```

### IronClaw Agent Not Starting

See [IronClaw Setup Guide](docs/IRONCLAW_SETUP.md) troubleshooting section.

### API Timeout Errors

```bash
# Increase timeout in .env
API_TIMEOUT_MS=10000

# Enable mock fallbacks
USE_MOCK_TAVILY=true
```

## 📄 License

MIT License - Built for hackathon demonstration

## 🙏 Acknowledgments

Built with support from:
- IronClaw / NEAR AI
- OpenAI
- Tavily
- Yutori
- Senso
- Neo4j
- Modulate
- Numeric
- Airbyte
- Render

---

**Note**: This is a proof-of-concept for hackathon demonstration. All blockchain transactions are mocked. Not for production use.
