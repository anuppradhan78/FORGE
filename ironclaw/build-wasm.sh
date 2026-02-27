#!/bin/bash
# Build script for WASM tools using Docker
# This keeps Rust toolchain isolated in Docker container

set -e

echo "🦀 Building Rust WASM tools in Docker container..."
echo ""

# Build the Docker image if it doesn't exist
echo "📦 Building Docker image..."
docker-compose build rust-builder

# Run the build
echo "🔨 Compiling Rust to WASM..."
docker-compose run --rm rust-builder

# Check if build succeeded
if [ -f "target/wasm32-unknown-unknown/release/mock_wallet.wasm" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📄 WASM file: ironclaw/target/wasm32-unknown-unknown/release/mock_wallet.wasm"
    echo ""
    
    # Show file size
    SIZE=$(du -h target/wasm32-unknown-unknown/release/mock_wallet.wasm | cut -f1)
    echo "📊 File size: $SIZE"
else
    echo ""
    echo "❌ Build failed - WASM file not found"
    exit 1
fi
