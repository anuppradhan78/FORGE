# Dockerfile for building Rust WASM tools in isolated container
# This keeps Rust toolchain off your PC - everything runs in Docker

FROM rust:1.82-slim

# Install WASM target for cross-compilation
RUN rustup target add wasm32-unknown-unknown

# Install wasm-bindgen-cli for WASM optimization (optional but recommended)
RUN cargo install wasm-bindgen-cli --version 0.2.92

# Set working directory
WORKDIR /workspace

# Copy Cargo workspace files
COPY Cargo.toml ./

# Pre-download dependencies (caching layer)
RUN mkdir -p tools/mock_wallet/src && \
    echo "fn main() {}" > tools/mock_wallet/src/lib.rs

# Set default command
CMD ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"]
