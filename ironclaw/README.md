# IronClaw Mock Wallet - Dockerized Rust WASM Build

This directory contains the mock NEAR wallet implementation built as a Rust WASM module. The Rust toolchain runs entirely in Docker, keeping your PC clean.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Rust Toolchain (1.75)                                 │ │
│  │  - rustc compiler                                      │ │
│  │  - cargo build system                                  │ │
│  │  - wasm32-unknown-unknown target                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Build Process                                         │ │
│  │  cargo build --target wasm32-unknown-unknown --release│ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Output: mock_wallet.wasm                              │ │
│  │  Location: target/wasm32-unknown-unknown/release/      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
              Mounted to your project folder
              (No Rust installed on your PC!)
```

## Quick Start

### Build the WASM Module

**Windows (PowerShell):**
```powershell
cd ironclaw
.\build-wasm.ps1
```

**Linux/macOS:**
```bash
cd ironclaw
chmod +x build-wasm.sh
./build-wasm.sh
```

**Manual Docker Build:**
```bash
# Build Docker image
docker-compose build rust-builder

# Run build
docker-compose run --rm rust-builder

# Check output
ls -lh target/wasm32-unknown-unknown/release/mock_wallet.wasm
```

## Project Structure

```
ironclaw/
├── Dockerfile              # Rust build environment
├── Cargo.toml             # Workspace configuration
├── build-wasm.sh          # Build script (Linux/macOS)
├── build-wasm.ps1         # Build script (Windows)
├── README.md              # This file
└── tools/
    └── mock_wallet/       # Mock NEAR wallet WASM tool
        ├── Cargo.toml     # Package configuration
        └── src/
            └── lib.rs     # Wallet implementation
```

## Features

### TEE Security Model
- ✅ Credentials stored in encrypted vault
- ✅ Private keys never exposed to LLM
- ✅ All access logged to audit trail
- ✅ WASM sandbox isolation

### Mock Wallet Capabilities
- ✅ NEAR transaction simulation
- ✅ Balance tracking
- ✅ Transaction signing
- ✅ Gas fee calculation
- ✅ Insufficient balance detection

### Operations Supported
- `transfer` - Send NEAR tokens
- `nft_buy` - Purchase NFT
- `token_swap` - Swap tokens

## API Integration

The WASM module is integrated with the TypeScript API via two services:

### 1. TEEVaultService (`api/src/services/TEEVaultService.ts`)
- Encrypted credential storage
- AES-256-GCM encryption
- Audit trail logging
- Never exposes credentials

### 2. MockWalletService (`api/src/services/MockWalletService.ts`)
- Transaction execution
- Balance management
- Neo4j logging
- Uses TEE vault for credentials

## Testing

### Test the Wallet API

```bash
# Get balance
curl http://localhost:3001/api/wallet/balance/demo-user-alice

# Execute transaction
curl -X POST http://localhost:3001/api/wallet/execute \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "nft_buy",
    "userId": "demo-user-alice",
    "amount": 30.0,
    "tokenId": "near-punk-1234"
  }'

# Get transaction history
curl http://localhost:3001/api/wallet/history/demo-user-alice
```

### Verify TEE Security

```bash
# Check that credentials are never exposed
curl http://localhost:3001/api/wallet/execute \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "transfer",
    "userId": "demo-user-alice",
    "amount": 10.0,
    "recipient": "bob.near"
  }' | jq '.credentialsExposed'

# Should always return: false
```

## Build Output

After successful build, you'll find:

```
target/
└── wasm32-unknown-unknown/
    └── release/
        ├── mock_wallet.wasm          # Compiled WASM module (~50-100 KB)
        └── mock_wallet.d              # Debug symbols
```

## Troubleshooting

### Build fails with "Docker not found"
**Solution:** Ensure Docker Desktop is running

### Build fails with "permission denied"
**Solution (Linux/macOS):** 
```bash
chmod +x build-wasm.sh
```

### WASM file not generated
**Solution:** Check Docker logs:
```bash
docker-compose logs rust-builder
```

### Want to rebuild from scratch
**Solution:**
```bash
# Remove build artifacts
rm -rf target/

# Rebuild
./build-wasm.sh
```

## Production Deployment

For production use with real IronClaw:

1. Replace mock implementations with actual IronClaw SDK
2. Use real TEE hardware (Intel SGX, AMD SEV, ARM TrustZone)
3. Store credentials in hardware-backed vault
4. Enable remote attestation
5. Use production NEAR network

## Security Notes

⚠️ **This is a POC implementation for hackathon demo**

- Mock wallet simulates TEE behavior
- Credentials are encrypted but not in hardware TEE
- Transactions are simulated (no real blockchain calls)
- For production, use actual IronClaw with hardware TEE

✅ **Security model is correct:**
- Credentials never logged
- Access audited to Neo4j
- `credentialsExposed` always false
- WASM sandbox isolation

## Requirements Satisfied

- ✅ 6.1: TEE vault for credential storage
- ✅ 6.2: WASM sandbox execution
- ✅ 6.3: Credentials never exposed
- ✅ 6.4: Transaction signing and execution
- ✅ 6.5: Audit trail logging
- ✅ 13.1: Mock NEAR transaction generation
- ✅ 13.2: Signed payload creation
- ✅ 13.3: Balance tracking
- ✅ 13.4: Transaction logging
- ✅ 13.5: Insufficient balance validation

## Next Steps

1. ✅ Build WASM module
2. ✅ Test wallet API endpoints
3. ➡️ Integrate with agent orchestration (Task 13)
4. ➡️ Test end-to-end demo flow (Task 14)

---

**Built with Docker** 🐳 **No Rust installation required on your PC!** 🦀
