# FORGE - Minimal Cost GCP Deployment (POC)

This guide deploys FORGE to GCP with absolute minimum cost for proof-of-concept demos.

## Target Cost: $5-15/month (or FREE with credits)

**Strategy:**
- Use smallest possible instances
- Leverage free tiers aggressively
- Single VM for everything (no Cloud Run)
- Neo4j Aura free tier
- No Cloud SQL (use SQLite or skip Airbyte)

---

## Prerequisites

- Google Cloud account: anuppradhan78@gmail.com
- `gcloud` CLI installed
- $300 free trial credits (new accounts)

---

## Architecture (Minimal)

```
┌─────────────────────────────────────────┐
│   Single e2-micro VM (FREE TIER)        │
│   ┌─────────────────────────────────┐   │
│   │  Docker Compose:                │   │
│   │  - API (port 3001)              │   │
│   │  - Dashboard (port 3002)        │   │
│   │  - PostgreSQL (port 5432)       │   │
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│   Neo4j Aura (FREE TIER)                │
│   - 200k nodes, 400k relationships      │
│   - 50MB storage                        │
└─────────────────────────────────────────┘
```

**Cost Breakdown:**
- Compute Engine e2-micro: **$0** (free tier: 1 instance/month)
- Neo4j Aura: **$0** (free tier)
- Networking: **$0-5** (1GB egress free/month)
- **Total: $0-5/month**

---

## Step 1: Create GCP Project

```bash
# Set variables
export PROJECT_NAME="forge-poc"
export PROJECT_ID="forge-poc-$(date +%s)"
export REGION="us-central1"
export ZONE="us-central1-a"

# Create project
gcloud projects create $PROJECT_ID \
  --name="$PROJECT_NAME" \
  --set-as-default

# Link billing (required even for free tier)
gcloud billing projects link $PROJECT_ID \
  --billing-account=YOUR_BILLING_ACCOUNT_ID

# Enable Compute Engine API
gcloud services enable compute.googleapis.com --project=$PROJECT_ID

# Set defaults
gcloud config set project $PROJECT_ID
gcloud config set compute/zone $ZONE
```

---

## Step 2: Set Up Neo4j Aura (FREE)

1. Go to https://neo4j.com/cloud/aura/
2. Sign up with anuppradhan78@gmail.com
3. Click "Create Free Instance"
4. Select "AuraDB Free"
5. Name: `forge-poc`
6. Region: Choose closest to `us-central1`
7. Click "Create"

**Save these credentials:**
```
URI: neo4j+s://xxxxx.databases.neo4j.io
Username: neo4j
Password: [generated password]
```

---

## Step 3: Create Minimal VM

```bash
# Create smallest possible VM (FREE TIER)
gcloud compute instances create forge-vm \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server \
  --metadata=startup-script='#!/bin/bash
    apt-get update
    apt-get install -y docker.io docker-compose git
    systemctl start docker
    systemctl enable docker
    usermod -aG docker $USER'

# Allow HTTP/HTTPS traffic
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443,tcp:3001,tcp:3002 \
  --target-tags=http-server,https-server \
  --description="Allow web traffic"

# Get external IP
EXTERNAL_IP=$(gcloud compute instances describe forge-vm \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo "VM External IP: $EXTERNAL_IP"
echo "API will be at: http://$EXTERNAL_IP:3001"
echo "Dashboard will be at: http://$EXTERNAL_IP:3002"
```

---

## Step 4: Deploy Application to VM

```bash
# SSH into VM
gcloud compute ssh forge-vm --zone=$ZONE

# Clone your repository (or upload files)
git clone https://github.com/YOUR_USERNAME/FORGE.git
cd FORGE

# Create minimal .env file
cat > .env << 'EOF'
# Neo4j Aura (from Step 2)
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_generated_password

# OpenAI
OPENAI_API_KEY=your_openai_key

# Optional API keys (will use mocks if not provided)
# TAVILY_API_KEY=
# MODULATE_API_KEY=
# SENSO_API_KEY=
# NUMERIC_API_KEY=
# YUTORI_API_KEY=

# CORS
CORS_ORIGIN=http://$EXTERNAL_IP:3002

# Ports
API_PORT=3001
DASHBOARD_PORT=3002
EOF

# Create minimal docker-compose.yml (no Airbyte, no rust-builder)
cat > docker-compose.minimal.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: forge-postgres
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=forge
      - POSTGRES_PASSWORD=forgepassword
      - POSTGRES_DB=forge
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.minimal
    container_name: forge-api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env
    depends_on:
      - postgres
    restart: unless-stopped

  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile.minimal
    container_name: forge-dashboard
    ports:
      - "3002:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://$EXTERNAL_IP:3001
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Create minimal API Dockerfile
cat > api/Dockerfile.minimal << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
EOF

# Create minimal Dashboard Dockerfile
cat > dashboard/Dockerfile.minimal << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Production
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
EOF

# Build and start services
docker-compose -f docker-compose.minimal.yml up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Check status
docker-compose -f docker-compose.minimal.yml ps

# View logs
docker-compose -f docker-compose.minimal.yml logs --tail=50
```

---

## Step 5: Seed Neo4j Aura

```bash
# Still in SSH session
# Install Neo4j cypher-shell
wget https://dist.neo4j.org/cypher-shell/cypher-shell_5.15.0_all.deb
sudo dpkg -i cypher-shell_5.15.0_all.deb

# Run seed script
cypher-shell -a $NEO4J_URI -u neo4j -p $NEO4J_PASSWORD \
  -f neo4j/seed.cypher

# Or use Neo4j Aura browser interface
echo "Neo4j Browser: https://console.neo4j.io"
```

---

## Step 6: Test Deployment

```bash
# Exit SSH
exit

# Test API health
curl http://$EXTERNAL_IP:3001/health

# Open dashboard in browser
echo "Dashboard: http://$EXTERNAL_IP:3002"
```

---

## Cost Optimization Tips

### 1. Stop VM When Not Demoing

```bash
# Stop VM (keeps disk, no compute charges)
gcloud compute instances stop forge-vm --zone=$ZONE

# Start when needed
gcloud compute instances start forge-vm --zone=$ZONE

# Savings: $0/month when stopped
```

### 2. Use Preemptible VM (Even Cheaper)

```bash
# Create preemptible instance (up to 80% cheaper)
gcloud compute instances create forge-vm-preemptible \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --preemptible \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB

# Note: VM may be terminated after 24 hours
# Good for short demos, not production
```

### 3. Schedule Auto-Shutdown

```bash
# Add to VM metadata (auto-shutdown at 6 PM)
gcloud compute instances add-metadata forge-vm \
  --zone=$ZONE \
  --metadata=shutdown-script='#!/bin/bash
    HOUR=$(date +%H)
    if [ $HOUR -ge 18 ]; then
      sudo shutdown -h now
    fi'
```

### 4. Use Spot Instances

```bash
# Even cheaper than preemptible
gcloud compute instances create forge-vm-spot \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --provisioning-model=SPOT \
  --instance-termination-action=STOP \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud
```

---

## Monitoring (Free)

```bash
# View VM metrics in console
echo "Metrics: https://console.cloud.google.com/compute/instances?project=$PROJECT_ID"

# SSH and check Docker
gcloud compute ssh forge-vm --zone=$ZONE
docker stats
docker-compose -f docker-compose.minimal.yml logs --tail=100
```

---

## Maintenance Commands

### View Logs

```bash
gcloud compute ssh forge-vm --zone=$ZONE
cd FORGE
docker-compose -f docker-compose.minimal.yml logs -f api
docker-compose -f docker-compose.minimal.yml logs -f dashboard
```

### Restart Services

```bash
gcloud compute ssh forge-vm --zone=$ZONE
cd FORGE
docker-compose -f docker-compose.minimal.yml restart
```

### Update Code

```bash
gcloud compute ssh forge-vm --zone=$ZONE
cd FORGE
git pull
docker-compose -f docker-compose.minimal.yml up -d --build
```

### Check Disk Usage

```bash
gcloud compute ssh forge-vm --zone=$ZONE
df -h
docker system df
docker system prune -a  # Clean up unused images
```

---

## Backup Strategy (Minimal)

### Backup Neo4j (Aura handles this automatically)

Neo4j Aura includes automatic backups. No action needed.

### Backup VM Disk (Optional)

```bash
# Create snapshot
gcloud compute disks snapshot forge-vm \
  --zone=$ZONE \
  --snapshot-names=forge-vm-snapshot-$(date +%Y%m%d)

# List snapshots
gcloud compute snapshots list

# Restore from snapshot (if needed)
gcloud compute disks create forge-vm-restored \
  --zone=$ZONE \
  --source-snapshot=forge-vm-snapshot-YYYYMMDD
```

---

## Troubleshooting

### VM Out of Memory

```bash
# Check memory usage
gcloud compute ssh forge-vm --zone=$ZONE
free -h
docker stats

# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Services Not Starting

```bash
gcloud compute ssh forge-vm --zone=$ZONE
cd FORGE

# Check logs
docker-compose -f docker-compose.minimal.yml logs

# Restart
docker-compose -f docker-compose.minimal.yml down
docker-compose -f docker-compose.minimal.yml up -d
```

### Can't Connect to Neo4j Aura

```bash
# Test connection
cypher-shell -a $NEO4J_URI -u neo4j -p $NEO4J_PASSWORD

# Check firewall (Aura should allow all IPs by default)
# Verify URI format: neo4j+s://xxxxx.databases.neo4j.io
```

---

## Cleanup (Delete Everything)

```bash
# Stop and delete VM
gcloud compute instances delete forge-vm --zone=$ZONE --quiet

# Delete firewall rules
gcloud compute firewall-rules delete allow-http-https --quiet

# Delete snapshots (if any)
gcloud compute snapshots delete forge-vm-snapshot-* --quiet

# Delete Neo4j Aura instance
# Go to https://console.neo4j.io and delete manually

# Delete project (nuclear option)
gcloud projects delete $PROJECT_ID --quiet
```

---

## Cost Summary

**Monthly Costs (Running 24/7):**
- e2-micro VM: **$0** (free tier: 1 instance in us-central1)
- 30GB Standard Disk: **$1.20** ($0.04/GB/month)
- Neo4j Aura: **$0** (free tier)
- Egress (1GB): **$0** (1GB free/month)
- **Total: ~$1.20/month**

**With Stop/Start Strategy (8 hours/day):**
- Compute: **$0** (free tier covers it)
- Disk: **$1.20** (charged even when stopped)
- **Total: ~$1.20/month**

**Free Trial Credits:**
- New accounts get $300 credit for 90 days
- This deployment would last **250 months** on free credits!

---

## Upgrade Path (When Needed)

### Scale Up VM

```bash
# Upgrade to e2-small (2 vCPU, 2GB RAM) - $13/month
gcloud compute instances set-machine-type forge-vm \
  --zone=$ZONE \
  --machine-type=e2-small
```

### Add Load Balancer

```bash
# When you need HTTPS and custom domain
# Cost: ~$18/month
```

### Migrate to Cloud Run

```bash
# When you need auto-scaling
# Follow full GCP-DEPLOYMENT.md guide
```

---

## Quick Start Summary

```bash
# 1. Create project
gcloud projects create forge-poc-$(date +%s) --set-as-default

# 2. Create Neo4j Aura free instance
# https://neo4j.com/cloud/aura/

# 3. Create VM
gcloud compute instances create forge-vm \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud

# 4. SSH and deploy
gcloud compute ssh forge-vm --zone=us-central1-a
# Follow Step 4 commands

# 5. Access
# Dashboard: http://EXTERNAL_IP:3002
```

**Total Setup Time:** 15-20 minutes  
**Monthly Cost:** $0-5  
**Perfect for:** POC, demos, hackathons

---

## Support

- GCP Free Tier: https://cloud.google.com/free
- Neo4j Aura Free: https://neo4j.com/cloud/aura-free/
- e2-micro specs: 2 vCPU (shared), 1GB RAM, 30GB disk

**Note:** e2-micro is part of GCP's Always Free tier (1 instance per month in us-central1, us-west1, or us-east1).
