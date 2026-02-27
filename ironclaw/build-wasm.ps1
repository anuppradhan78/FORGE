# PowerShell build script for WASM tools using Docker
# This keeps Rust toolchain isolated in Docker container

Write-Host "🦀 Building Rust WASM tools in Docker container..." -ForegroundColor Cyan
Write-Host ""

# Build the Docker image if it doesn't exist
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker-compose build rust-builder

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

# Run the build
Write-Host "🔨 Compiling Rust to WASM..." -ForegroundColor Yellow
docker-compose run --rm rust-builder

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Rust compilation failed" -ForegroundColor Red
    exit 1
}

# Check if build succeeded
$wasmFile = "target/wasm32-unknown-unknown/release/mock_wallet.wasm"
if (Test-Path $wasmFile) {
    Write-Host ""
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host "📄 WASM file: ironclaw/$wasmFile" -ForegroundColor Green
    Write-Host ""
    
    # Show file size
    $size = (Get-Item $wasmFile).Length / 1KB
    Write-Host "📊 File size: $([math]::Round($size, 2)) KB" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Build failed - WASM file not found" -ForegroundColor Red
    exit 1
}
