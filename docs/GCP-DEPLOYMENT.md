# FORGE - Google Cloud Platform Deployment Guide

This guide walks you through deploying FORGE to your Google Cloud Platform account.

## Prerequisites

- Google Cloud account: anuppradhan78@gmail.com
- `gcloud` CLI installed and configured
- Docker installed locally
- Project billing enabled

## Overview

We'll deploy FORGE using these GCP services:

1. **Cloud Run** - Containerized API and Dashboard
2. **Cloud SQL** - PostgreSQL database (replacing local Docker)
3. **Compute Engine** - Neo4j instance (or Neo4j Aura)
4. **Secret Manager** - API keys and credentials
5. **Cloud Build** - Automated container builds
6. **Cloud Storage** - Static assets and backups

**Estimated Monthly Cost:** $50-100 (with free tier credits)

---

## Step 1: Initial GCP Setup

### 1.1 Create New Project

```bash
# Set your project name
export PROJECT_NAME="forge-ai-agent"
export PROJECT_ID="forge-ai-agent-$(date +%s)"
export REGION="us-central1"

# Create project
gcloud projects create $PROJECT_ID \
  --name="$PROJECT_NAME" \
  --set-as-default

# Link billing account (required)
gcloud billing projects link $PROJECT_ID \
  --billing-account=YOUR_BILLING_ACCOUNT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  compute.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  --project=$PROJECT_ID
```

### 1.2 Set Default Region

```bash
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION
gcloud config set compute/region $REGION
```

---

## Step 2: Set Up Databases

### 2.1 Deploy Neo4j on Compute Engine

**Option A: Use Neo4j Aura (Recommended - Managed Service)**

1. Go to https://neo4j.com/cloud/aura/
2. Sign up with anuppradhan78@gmail.com
3. Create a free instance
4. Note the connection URI, username, and password
5. Skip to Step 2.2

**Option B: Self-Hosted on Compute Engine**

```bash
# Create VM for Neo4j
gcloud compute instances create forge-neo4j \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --tags=neo4j-server

# Create firewall rule
gcloud compute firewall-rules create allow-neo4j \
  --allow=tcp:7474,tcp:7687 \
  --target-tags=neo4j-server \
  --description="Allow Neo4j HTTP and Bolt"

# SSH into the instance
gcloud compute ssh forge-neo4j --zone=us-central1-a

# Install Docker on the VM
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# Run Neo4j container
sudo docker run -d \
  --name neo4j \
  --restart=always \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/forgepassword \
  -e NEO4J_PLUGINS='["apoc"]' \
  -v neo4j_data:/data \
  neo4j:5.15-community

# Exit SSH
exit

# Get the external IP
gcloud compute instances describe forge-neo4j \
  --zone=us-central1-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

### 2.2 Create Cloud SQL PostgreSQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create forge-postgres \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --root-password=forgepassword \
  --storage-size=10GB \
  --storage-type=SSD

# Create database
gcloud sql databases create airbyte \
  --instance=forge-postgres

# Get connection name
gcloud sql instances describe forge-postgres \
  --format='get(connectionName)'
# Save this - you'll need it: PROJECT_ID:REGION:forge-postgres
```

---

## Step 3: Store Secrets

```bash
# Create secrets for sensitive data
echo -n "forgepassword" | gcloud secrets create neo4j-password --data-file=-
echo -n "neo4j" | gcloud secrets create neo4j-user --data-file=-
echo -n "bolt://NEO4J_IP:7687" | gcloud secrets create neo4j-uri --data-file=-

# OpenAI API Key
echo -n "YOUR_OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=-

# Add other API keys as needed
echo -n "YOUR_TAVILY_KEY" | gcloud secrets create tavily-api-key --data-file=-
echo -n "YOUR_MODULATE_KEY" | gcloud secrets create modulate-api-key --data-file=-

# Grant Cloud Run access to secrets
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding neo4j-password \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for all secrets
```

---

## Step 4: Build and Deploy API

### 4.1 Create Dockerfile for API (if not exists)

Create `api/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### 4.2 Build and Push Container

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create forge-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="FORGE containers"

# Configure Docker auth
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push API
cd api
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/api:latest \
  --timeout=20m

cd ..
```

### 4.3 Deploy API to Cloud Run

```bash
# Deploy with secrets
gcloud run deploy forge-api \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/api:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=3001 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --set-env-vars="NODE_ENV=production,PORT=3001" \
  --set-secrets="NEO4J_URI=neo4j-uri:latest,NEO4J_USER=neo4j-user:latest,NEO4J_PASSWORD=neo4j-password:latest,OPENAI_API_KEY=openai-api-key:latest" \
  --add-cloudsql-instances=$PROJECT_ID:$REGION:forge-postgres

# Get API URL
API_URL=$(gcloud run services describe forge-api --region=$REGION --format='value(status.url)')
echo "API URL: $API_URL"
```

---

## Step 5: Build and Deploy Dashboard

### 5.1 Create Dockerfile for Dashboard

Create `dashboard/Dockerfile.prod`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

### 5.2 Build and Deploy Dashboard

```bash
# Build with API URL
cd dashboard
gcloud builds submit \
  --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/dashboard:latest \
  --timeout=20m \
  --substitutions=_API_URL=$API_URL

cd ..

# Deploy to Cloud Run
gcloud run deploy forge-dashboard \
  --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/dashboard:latest \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="NEXT_PUBLIC_API_URL=$API_URL"

# Get Dashboard URL
DASHBOARD_URL=$(gcloud run services describe forge-dashboard --region=$REGION --format='value(status.url)')
echo "Dashboard URL: $DASHBOARD_URL"
```

---

## Step 6: Configure CORS

Update API to allow Dashboard domain:

```bash
# Update API with CORS origin
gcloud run services update forge-api \
  --region=$REGION \
  --update-env-vars="CORS_ORIGIN=$DASHBOARD_URL"
```

---

## Step 7: Seed Neo4j Database

```bash
# SSH into Neo4j VM (if self-hosted)
gcloud compute ssh forge-neo4j --zone=us-central1-a

# Run seed script
sudo docker exec -i neo4j cypher-shell -u neo4j -p forgepassword < /path/to/seed.cypher

# Or use Neo4j Browser at http://NEO4J_IP:7474
```

For Neo4j Aura, use the browser interface to run the seed script from `neo4j/seed.cypher`.

---

## Step 8: Set Up Custom Domain (Optional)

```bash
# Map custom domain to Cloud Run services
gcloud run domain-mappings create \
  --service=forge-dashboard \
  --domain=forge.yourdomain.com \
  --region=$REGION

gcloud run domain-mappings create \
  --service=forge-api \
  --domain=api.forge.yourdomain.com \
  --region=$REGION

# Follow DNS instructions provided by the command
```

---

## Step 9: Set Up Monitoring

```bash
# Enable Cloud Monitoring
gcloud services enable monitoring.googleapis.com

# Create uptime check for API
gcloud monitoring uptime create forge-api-uptime \
  --resource-type=uptime-url \
  --host=$API_URL \
  --path=/health

# Create uptime check for Dashboard
gcloud monitoring uptime create forge-dashboard-uptime \
  --resource-type=uptime-url \
  --host=$DASHBOARD_URL
```

---

## Step 10: Set Up CI/CD (Optional)

Create `.github/workflows/deploy-gcp.yml`:

```yaml
name: Deploy to GCP

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Authenticate to GCP
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
      
      - name: Build and Deploy API
        run: |
          gcloud builds submit api/ \
            --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/api:latest
          gcloud run deploy forge-api \
            --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/api:latest \
            --region=$REGION
      
      - name: Build and Deploy Dashboard
        run: |
          gcloud builds submit dashboard/ \
            --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/dashboard:latest
          gcloud run deploy forge-dashboard \
            --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/forge-repo/dashboard:latest \
            --region=$REGION
```

---

## Cost Breakdown

**Monthly Estimates:**

- **Cloud Run (API):** $5-10 (with free tier: 2M requests/month)
- **Cloud Run (Dashboard):** $5-10 (with free tier)
- **Cloud SQL (PostgreSQL):** $10-15 (db-f1-micro)
- **Compute Engine (Neo4j):** $15-25 (e2-medium) OR Neo4j Aura Free Tier: $0
- **Cloud Build:** $0 (120 build-minutes/day free)
- **Secret Manager:** $0.06 per secret/month
- **Networking:** $5-10

**Total: $40-75/month** (or $25-50 with Neo4j Aura free tier)

**Free Tier Benefits:**
- Cloud Run: 2M requests, 360k GB-seconds, 180k vCPU-seconds per month
- Cloud Build: 120 build-minutes per day
- Secret Manager: 6 active secrets free

---

## Maintenance Commands

### View Logs

```bash
# API logs
gcloud run logs read forge-api --region=$REGION --limit=50

# Dashboard logs
gcloud run logs read forge-dashboard --region=$REGION --limit=50
```

### Update Environment Variables

```bash
# Update API env vars
gcloud run services update forge-api \
  --region=$REGION \
  --update-env-vars="NEW_VAR=value"
```

### Scale Services

```bash
# Set max instances
gcloud run services update forge-api \
  --region=$REGION \
  --max-instances=10 \
  --min-instances=1
```

### Backup Neo4j

```bash
# SSH into Neo4j VM
gcloud compute ssh forge-neo4j --zone=us-central1-a

# Create backup
sudo docker exec neo4j neo4j-admin database dump neo4j \
  --to-path=/backups/neo4j-$(date +%Y%m%d).dump

# Copy to Cloud Storage
gsutil cp /backups/neo4j-*.dump gs://${PROJECT_ID}-backups/
```

---

## Troubleshooting

### API Can't Connect to Neo4j

```bash
# Check Neo4j is running
gcloud compute ssh forge-neo4j --zone=us-central1-a
sudo docker ps

# Check firewall rules
gcloud compute firewall-rules list --filter="name=allow-neo4j"

# Test connection from Cloud Run
gcloud run services update forge-api \
  --region=$REGION \
  --set-env-vars="NEO4J_URI=bolt://EXTERNAL_IP:7687"
```

### Dashboard Can't Reach API

```bash
# Check CORS settings
gcloud run services describe forge-api \
  --region=$REGION \
  --format='value(spec.template.spec.containers[0].env)'

# Update CORS
gcloud run services update forge-api \
  --region=$REGION \
  --update-env-vars="CORS_ORIGIN=$DASHBOARD_URL"
```

### Out of Memory Errors

```bash
# Increase memory
gcloud run services update forge-api \
  --region=$REGION \
  --memory=2Gi
```

---

## Cleanup (Delete Everything)

```bash
# Delete Cloud Run services
gcloud run services delete forge-api --region=$REGION --quiet
gcloud run services delete forge-dashboard --region=$REGION --quiet

# Delete Cloud SQL
gcloud sql instances delete forge-postgres --quiet

# Delete Compute Engine VM
gcloud compute instances delete forge-neo4j --zone=us-central1-a --quiet

# Delete firewall rules
gcloud compute firewall-rules delete allow-neo4j --quiet

# Delete secrets
gcloud secrets delete neo4j-password --quiet
gcloud secrets delete neo4j-user --quiet
gcloud secrets delete neo4j-uri --quiet
gcloud secrets delete openai-api-key --quiet

# Delete Artifact Registry
gcloud artifacts repositories delete forge-repo --location=$REGION --quiet

# Delete project (nuclear option)
gcloud projects delete $PROJECT_ID --quiet
```

---

## Next Steps

1. Set up custom domain
2. Configure SSL certificates (automatic with Cloud Run)
3. Set up Cloud Monitoring alerts
4. Configure backup schedules
5. Set up staging environment
6. Implement CI/CD pipeline

---

## Support

For issues:
- Check Cloud Run logs: `gcloud run logs read forge-api`
- Check Neo4j logs: `sudo docker logs neo4j`
- Review GCP Console: https://console.cloud.google.com

---

**Deployment Time:** 30-45 minutes
**Difficulty:** Intermediate
**Prerequisites:** GCP account with billing enabled, gcloud CLI installed
