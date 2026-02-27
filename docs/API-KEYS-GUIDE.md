# API Keys Guide for FORGE

## TL;DR - What You Actually Need 🎯

**Minimum Required for Demo:**
- ✅ OpenAI API Key (you have this!)
- ✅ Neo4j running locally (already set up)

**Everything else has mock fallbacks and will work without API keys!**

---

## Detailed Service Breakdown

### 1. OpenAI ✅ REQUIRED
**What it does:** Powers the AI agent's reasoning and decision-making
**Why you need it:** Core LLM for the agent
**How to get it:** https://platform.openai.com/api-keys
**Status:** ✅ You already have this

**In .env:**
```bash
OPENAI_API_KEY=sk-proj-...your-key...
OPENAI_MODEL=gpt-4o
```

---

### 2. IronClaw 🔧 LOCAL RUNTIME
**What it does:** Provides TEE (Trusted Execution Environment) for secure credential storage
**Why it's special:** Runs locally, not a cloud API
**How to set up:** 
```bash
# Install IronClaw CLI
brew install ironclaw  # or cargo install ironclaw

# Initialize
ironclaw onboard
ironclaw init forge-agent
```
**Status:** ✅ Running locally, no API key needed

---

### 3. Tavily 🔍 OPTIONAL (Has Mock Fallback)
**What it does:** Web search for NEAR NFT market data and listings
**Mock fallback:** Returns pre-configured NFT listings from `mocks/tavily-responses.json`
**How to get it:** https://tavily.com (free tier available)
**Demo impact:** Low - mock data works great for demos

**Mock data includes:**
- NEAR Punks listings
- ASAC (Antisocial Ape Club) listings  
- Paras Gems listings

**In .env:**
```bash
# Leave as placeholder to use mocks
TAVILY_API_KEY=your_tavily_api_key_here
USE_MOCK_TAVILY=true  # Set to true to force mocks
```

---

### 4. Yutori 👀 OPTIONAL (Has Mock Fallback)
**What it does:** Creates persistent "scouts" that monitor markets for deals
**Mock fallback:** Uses periodic Tavily calls or returns mock scout data
**How to get it:** https://yutori.io
**Demo impact:** Very Low - Tavily provides equivalent functionality

**In .env:**
```bash
# Leave as placeholder to use mocks
YUTORI_API_KEY=your_yutori_api_key_here
USE_MOCK_YUTORI=true
```

---

### 5. Senso 🔐 OPTIONAL (Has Mock Fallback)
**What it does:** Verifies NFT collection legitimacy and floor prices against trusted sources
**Mock fallback:** Returns hardcoded floor prices for demo collections
**How to get it:** https://senso.ai (Context Hub)
**Demo impact:** Low - mock floor prices are realistic

**Mock floor prices:**
- NEAR Punks: 25.5 NEAR
- ASAC: 42.0 NEAR
- Paras Gems: 15.0 NEAR

**In .env:**
```bash
# Leave as placeholder to use mocks
SENSO_API_KEY=your_senso_api_key_here
USE_MOCK_SENSO=true
```

---

### 6. Modulate 🎤 OPTIONAL (Has Mock Fallback)
**What it does:** Voice transcription, intent analysis, emotion detection, fraud scoring
**Mock fallback:** Uses OpenAI Whisper for transcription + mock fraud scores
**How to get it:** https://modulate.ai (Velma API)
**Demo impact:** Low - OpenAI Whisper works well for transcription

**Mock fallback provides:**
- Voice transcription (via OpenAI Whisper)
- Intent extraction (via GPT-4)
- Mock fraud scores (0.0-1.0)
- Mock emotion analysis

**In .env:**
```bash
# Leave as placeholder to use mocks
MODULATE_API_KEY=your_modulate_api_key_here
USE_MOCK_MODULATE=true
```

---

### 7. Numeric 💰 OPTIONAL (Has Mock Fallback)
**What it does:** Generates "Flux Reports" explaining portfolio variance and anomalies
**Mock fallback:** Local calculation + OpenAI-generated explanations
**How to get it:** https://numeric.io
**Demo impact:** Very Low - local calculation is accurate, OpenAI provides good explanations

**Mock fallback provides:**
- Portfolio value calculations
- Variance analysis
- Anomaly detection
- AI-generated explanations (via OpenAI)

**In .env:**
```bash
# Leave as placeholder to use mocks
NUMERIC_API_KEY=your_numeric_api_key_here
USE_MOCK_NUMERIC=true
```

---

### 8. Neo4j 🗄️ LOCAL DATABASE
**What it does:** Graph database for policies, decisions, and audit trails
**Why you need it:** Core data storage for governance
**How to set up:** Already running in Docker!
**Status:** ✅ Running locally

**In .env:**
```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=forgepassword
```

**Check status:**
```bash
# Open Neo4j Browser
http://localhost:7474

# Or check with Docker
docker ps | grep neo4j
```

---

### 9. Airbyte 🔄 OPTIONAL
**What it does:** ETL for seeding initial data into Neo4j
**Fallback:** Direct Cypher script execution
**How to set up:** Already in docker-compose.yml
**Status:** ✅ Optional, fallback works

**Fallback method:**
```bash
# Seed data directly with Cypher
cat neo4j/seed.cypher | docker exec -i neo4j cypher-shell -u neo4j -p forgepassword
```

---

## Recommended Setup for Demo

### Minimal Setup (Works Great!)
```bash
# .env configuration
OPENAI_API_KEY=sk-proj-...your-actual-key...
OPENAI_MODEL=gpt-4o

# Use mocks for everything else
USE_MOCK_TAVILY=true
USE_MOCK_YUTORI=true
USE_MOCK_SENSO=true
USE_MOCK_MODULATE=true
USE_MOCK_NUMERIC=true

# Local services (already running)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=forgepassword
```

### Full Setup (If You Want Real APIs)
Only get these if you want to showcase real API integrations:

1. **Tavily** - For real web search results
   - Sign up: https://tavily.com
   - Free tier: 1000 searches/month
   - Set `USE_MOCK_TAVILY=false`

2. **Senso** - For real context verification
   - Sign up: https://senso.ai
   - Set `USE_MOCK_SENSO=false`

3. **Numeric** - For real financial reconciliation
   - Sign up: https://numeric.io
   - Set `USE_MOCK_NUMERIC=false`

---

## How the Fallback System Works

The system uses a **circuit breaker pattern** with automatic fallback:

```typescript
// Pseudo-code
async function callSponsorAPI(apiName) {
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

**Benefits:**
- Demo works even if APIs are down
- No need to get all API keys upfront
- Can add real APIs incrementally
- System remains stable

---

## Testing Your Setup

### Check What's Working
```bash
# Run the checkpoint test
node tests/checkpoint-22-automated-simple.js

# This will show you:
# - Which services are active
# - Which are using mocks
# - Overall system health
```

### Check Sponsor Status
```bash
# Via API
curl http://localhost:3001/api/demo/status

# Via Dashboard
# Open http://localhost:3000
# Look at the Sponsor Grid - shows active/inactive status
```

---

## Current System Status

Based on your checkpoint tests:
- ✅ OpenAI: Active
- ✅ IronClaw: Active (local)
- ✅ Neo4j: Active (local)
- ✅ Tavily: Using mocks
- ⚠️ Yutori: Inactive (expected)
- ✅ Senso: Using mocks
- ✅ Modulate: Using mocks
- ✅ Numeric: Using mocks
- ✅ Airbyte: Active (local)

**Result:** System is 100% functional for demo! 🎉

---

## FAQ

### Q: Do I need all 9 API keys for the hackathon demo?
**A:** No! You only need OpenAI. Everything else has intelligent fallbacks.

### Q: Will judges notice I'm using mocks?
**A:** The mock data is realistic and the system works identically. The dashboard shows which sponsors are active, so you can be transparent about it.

### Q: Should I get real API keys?
**A:** Only if you want to showcase real-time web search or have extra time. The mocks are sufficient for a great demo.

### Q: What if I want to add a real API key later?
**A:** Just add it to .env and set `USE_MOCK_[SERVICE]=false`. The system will automatically use the real API.

### Q: How do I know if an API key is working?
**A:** Check the Sponsor Grid in the dashboard or run `node tests/checkpoint-22-automated-simple.js`

---

## Quick Start Checklist

- [x] OpenAI API key added to .env
- [x] Neo4j running (docker-compose up)
- [x] IronClaw installed and initialized
- [ ] (Optional) Get Tavily API key for real search
- [ ] (Optional) Get other sponsor API keys

**You're ready to demo with just the checked items!** ✅

