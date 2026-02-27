# IronClaw Runtime Setup Guide

This guide walks you through installing and configuring the IronClaw runtime for the FORGE project.

## ⚠️ Important: IronClaw Deployment Model

**IronClaw runs as a native process on your host machine, NOT in Docker.**

### Why IronClaw Doesn't Run in Docker

IronClaw requires direct access to hardware TEE (Trusted Execution Environment) features:
- **Intel SGX** (Software Guard Extensions) on Intel processors
- **ARM TrustZone** on ARM processors

These hardware security features provide:
- Encrypted memory enclaves
- Secure credential storage
- Isolated execution environments

**Docker containers cannot easily access these hardware features** because:
1. TEE requires direct CPU instruction access
2. Hardware enclaves need kernel-level integration
3. Virtualization layers break TEE security guarantees

### What This Means for FORGE

**You have two options:**

#### Option 1: Run Without IronClaw (Recommended for Demo)
- ✅ Demo works perfectly with mock agent functionality
- ✅ No IronClaw installation required
- ✅ Simulated TEE security for demonstration
- ✅ All features functional
- ⚠️ No real hardware TEE protection

#### Option 2: Run With IronClaw (Full TEE Features)
- ✅ Real hardware TEE security
- ✅ Actual encrypted credential storage
- ✅ Production-grade security guarantees
- ⚠️ Requires IronClaw CLI installation on host
- ⚠️ Requires compatible hardware (Intel SGX or ARM TrustZone)

### What's in Docker vs What Runs Natively

**Docker Containers** (via `docker-compose.yml`):
```
✅ Neo4j          - Graph database (port 7687, 7474)
✅ PostgreSQL     - Airbyte backend (port 5432)
✅ Airbyte        - Data sync (port 8000, 8001)
✅ rust-builder   - Builds WASM tools (doesn't run IronClaw)
```

**Native Processes** (run on your host):
```
✅ IronClaw agent - TEE runtime (localhost:8080) - OPTIONAL
✅ API server     - Express backend (localhost:3001)
✅ Dashboard      - Next.js frontend (localhost:3000)
```

## Prerequisites

- macOS, Linux, or Windows with WSL2
- Rust toolchain (for cargo install method)
- NEAR AI account

## Installation Methods

### Method 1: Homebrew (macOS/Linux - Recommended)

```bash
# Add IronClaw tap (if available)
brew tap near-ai/ironclaw

# Install IronClaw CLI
brew install ironclaw

# Verify installation
ironclaw --version
```

### Method 2: Cargo Install (All Platforms)

```bash
# Install from crates.io
cargo install ironclaw-cli

# Verify installation
ironclaw --version
```

### Method 3: Download Binary

Visit [IronClaw Releases](https://github.com/near-ai/ironclaw/releases) and download the appropriate binary for your platform.

```bash
# Make executable (Linux/macOS)
chmod +x ironclaw

# Move to PATH
sudo mv ironclaw /usr/local/bin/

# Verify installation
ironclaw --version
```

## Initial Configuration

### Step 1: Onboard with NEAR AI

```bash
# Authenticate with NEAR AI
ironclaw onboard

# Follow the prompts to:
# 1. Connect your NEAR wallet
# 2. Authorize IronClaw access
# 3. Set up your developer profile
```

### Step 2: Create Agent Workspace

```bash
# Navigate to project root
cd /path/to/forge

# Initialize IronClaw agent workspace
ironclaw init forge-agent

# This creates:
# - ironclaw/ directory
# - agent configuration files
# - tool registry
```

### Step 3: Configure LLM Backend

```bash
# Set OpenAI as the LLM provider
ironclaw config set llm.provider openai
ironclaw config set llm.model gpt-4o
ironclaw config set llm.temperature 0.7

# Set your OpenAI API key
ironclaw config set llm.api_key $OPENAI_API_KEY
```

### Step 4: Create TEE Vault for Credentials

```bash
# Create encrypted vault for sensitive credentials
ironclaw vault create forge-credentials

# Add NEAR private key to vault
ironclaw vault add forge-credentials NEAR_PRIVATE_KEY

# When prompted, paste your NEAR testnet private key
# The key will be encrypted and stored in the TEE enclave
```

### Step 5: Verify Configuration

```bash
# Check agent configuration
ironclaw config list

# Test vault access
ironclaw vault list forge-credentials

# Start agent runtime (test mode)
ironclaw agent start --test

# You should see:
# ✓ Agent runtime started on localhost:8080
# ✓ TEE enclave initialized
# ✓ Tool registry loaded
```

## Configuration Files

After initialization, you should have:

```
ironclaw/
├── agent/
│   ├── main.rs          # Agent entry point
│   ├── prompts.rs       # System prompts
│   └── config.toml      # Agent configuration
├── tools/
│   └── mock_wallet/     # WASM wallet tool
└── Cargo.toml           # Rust dependencies
```

## Environment Variables

Add to your `.env` file:

```bash
IRONCLAW_API_KEY=your_ironclaw_api_key
IRONCLAW_AGENT_ID=forge-agent
IRONCLAW_VAULT_NAME=forge-credentials
IRONCLAW_RUNTIME_PORT=8080
IRONCLAW_RUNTIME_HOST=localhost
```

## Testing the Setup

### Test 1: Verify IronClaw is Running

```bash
# Start the agent runtime (runs natively on host, NOT in Docker)
ironclaw agent start

# You should see:
# ✓ Agent runtime started on localhost:8080
# ✓ TEE enclave initialized
# ✓ Tool registry loaded

# In another terminal, test with a simple query
curl -X POST http://localhost:8080/agent/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What tools do you have available?",
    "userId": "demo-user-1"
  }'

# Expected response should list available tools
```

### Test 2: Verify IronClaw is NOT in Docker

```bash
# Check Docker containers - you should NOT see IronClaw
docker ps

# You should see:
# - forge-neo4j
# - forge-postgres
# - forge-airbyte-server
# - forge-airbyte-webapp
# - forge-rust-builder (may be stopped after building)

# IronClaw will NOT appear here because it runs natively on your host
```

### Test 3: Check IronClaw Process

```bash
# On Linux/macOS - verify IronClaw is running as a native process
ps aux | grep ironclaw

# You should see the ironclaw process running on your host
```

## Troubleshooting

### Issue: "I don't see IronClaw in Docker Desktop"

**This is expected!** IronClaw runs as a native process on your host machine, not in Docker.

**Why?** IronClaw needs direct access to hardware TEE (Trusted Execution Environment) features that can't be virtualized in containers.

**To verify IronClaw is running:**
```bash
# Check native process (not Docker)
ps aux | grep ironclaw

# Or check if port 8080 is listening
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

**If you don't have IronClaw installed:** The demo still works! The API server includes mock agent functionality that simulates IronClaw's behavior.

### Issue: "ironclaw: command not found"

**Solution**: Ensure IronClaw is in your PATH. Try:
```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

### Issue: "Failed to connect to NEAR AI"

**Solution**: Check your internet connection and verify NEAR AI service status. Try re-running:
```bash
ironclaw onboard --force
```

### Issue: "Vault access denied"

**Solution**: Verify vault permissions:
```bash
ironclaw vault permissions forge-credentials
ironclaw vault grant forge-credentials --user $(whoami)
```

### Issue: "TEE enclave initialization failed"

**Solution**: Ensure your system supports TEE (Intel SGX or ARM TrustZone). For development, you can use simulation mode:
```bash
ironclaw config set tee.mode simulation
```

## Next Steps

Once IronClaw is configured:

1. Build the mock wallet WASM tool (see `docs/MOCK_WALLET_BUILD.md`)
2. Register tools with the agent runtime
3. Start the full FORGE system with `docker-compose up`

## Additional Resources

- [IronClaw Documentation](https://docs.ironclaw.near.ai)
- [NEAR AI Platform](https://near.ai)
- [TEE Security Guide](https://docs.ironclaw.near.ai/security/tee)
