# FORGE Render Deployment Guide

## Prerequisites

1. GitHub account with FORGE repository
2. Render account (free tier: https://render.com)
3. Neo4j Aura account (free tier: https://neo4j.com/cloud/aura/)
4. All sponsor API keys (see docs/API-KEYS-GUIDE.md)

## Step 1: Set Up Neo4j Aura Cloud Instance

### Create Database

1. Go to https://console.neo4j.io/
2. Click "New Instance"
3. Select "AuraDB Free" tier
4. Choose a name: `forge-production`
5. Set a password (save this securely)
6. Click "Create"
7. Wait for instance to be ready (2-3 minutes)

### Get Connection Details

1. Click on your instance
2. Copy the connection URI (format: `neo4j+s://xxxxx.databases.neo4j.io`)
3. Username is: `neo4j`
4. Password is what you set during creation

### Seed Production Database

1. Open Neo4j Browser (click "Open" button in Aura console)
2. Login with your credentials
3. Run the seed script:

```bash
# From your local machine
node neo4j/seed-runner.ts
```

Or manually execute the Cypher queries from `neo4j/seed.cypher` in the Neo4j Browser.

## Step 2: Deploy to Render

### Connect GitHub Repository

1. Go to https://dashboard.render.com
2. Click "New +"
3. Select "Blueprint"
4. Click "Connect GitHub"
5. Authorize Render to access your repositories
6. Select your FORGE repository
7. Render will detect the `render.yaml` file

### Configure Environment Variables

Render will create two services: `forge-api` and `forge-dashboard`. You need to configure environment variables for both.

#### For `forge-api` Service:

1. Go to the `forge-api` service in Render dashboard
2. Click "Environment" tab
3. Add the following environment variables:

**Neo4j Configuration:**
```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
```

**Sponsor API Keys:**
```
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
YUTORI_API_KEY=yutori-...
SENSO_API_KEY=senso-...
MODULATE_API_KEY=mod-...
NUMERIC_API_KEY=num-...
```

**Mock Fallback Flags (set to true if you don't have API keys):**
```
USE_MOCK_TAVILY=false
USE_MOCK_YUTORI=false
USE_MOCK_SENSO=false
USE_MOCK_MODULATE=false
USE_MOCK_NUMERIC=false
```

**CORS Configuration:**
```
CORS_ORIGIN=https://forge-dashboard.onrender.com
```

4. Click "Save Changes"

#### For `forge-dashboard` Service:

1. Go to the `forge-dashboard` service in Render dashboard
2. Click "Environment" tab
3. Add the following environment variables:

**API Configuration:**
```
NEXT_PUBLIC_API_URL=https://forge-api.onrender.com
```

**Neo4j Configuration (for direct graph queries):**
```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
```

4. Click "Save Changes"

### Update CORS Origin

After deployment, you'll get actual URLs for your services. Update the CORS_ORIGIN in the API service:

1. Note the actual dashboard URL (e.g., `https://forge-dashboard-abc123.onrender.com`)
2. Go to `forge-api` service → Environment
3. Update `CORS_ORIGIN` to match your dashboard URL
4. Save changes (this will trigger a redeploy)

## Step 3: Deploy Services

1. Click "Apply" or "Create Blueprint" to start deployment
2. Render will build and deploy both services
3. Build time: 5-10 minutes per service
4. Monitor logs for any errors

### Deployment Order

Render will deploy services in parallel. Both services should be ready within 10-15 minutes.

## Step 4: Verify Deployment

### Test API Health

```bash
curl https://forge-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-27T...",
  "services": {
    "neo4j": "connected"
  }
}
```

### Test Dashboard

1. Open your dashboard URL in a browser
2. You should see the FORGE dashboard with sponsor logos
3. Check that all components load without errors

### Test Full Demo Flow

1. Click "Run Demo Flow" button in the dashboard
2. Monitor the agent status updates
3. Verify the demo completes in under 15 seconds
4. Check the audit trail shows all decisions
5. Verify the graph visualization updates

## Step 5: Test Environment Variable Access

### Verify API Can Access Secrets

```bash
# Test Neo4j connection
curl https://forge-api.onrender.com/api/graph

# Test sponsor integrations
curl -X POST https://forge-api.onrender.com/api/demo/run
```

### Check Logs for Errors

1. Go to Render dashboard
2. Select `forge-api` service
3. Click "Logs" tab
4. Look for any environment variable errors
5. Repeat for `forge-dashboard` service

## Troubleshooting

### Service Won't Start

**Problem:** Build fails or service crashes on startup

**Solutions:**
- Check logs for missing environment variables
- Verify Neo4j connection string is correct
- Ensure all required dependencies are in package.json
- Check that build commands are correct in render.yaml

### Neo4j Connection Fails

**Problem:** "Failed to connect to Neo4j" errors

**Solutions:**
- Verify NEO4J_URI format: `neo4j+s://xxxxx.databases.neo4j.io`
- Check username is `neo4j`
- Verify password is correct
- Ensure Aura instance is running (not paused)
- Check firewall rules in Aura console

### CORS Errors in Dashboard

**Problem:** Dashboard can't connect to API

**Solutions:**
- Verify CORS_ORIGIN in API matches dashboard URL exactly
- Include protocol (https://) in CORS_ORIGIN
- Check that API URL in dashboard env vars is correct
- Redeploy API after changing CORS_ORIGIN

### Mock Fallbacks Not Working

**Problem:** API calls fail even with USE_MOCK_* flags

**Solutions:**
- Verify mock response files exist in mocks/ directory
- Check that mock flags are set to "true" (string, not boolean)
- Ensure fallback logic is implemented in service files
- Check logs for specific API errors

### Slow Performance

**Problem:** Demo flow takes longer than 15 seconds

**Solutions:**
- Free tier services sleep after inactivity (first request is slow)
- Upgrade to paid tier for always-on services
- Optimize Neo4j queries with indexes
- Enable caching for Tavily results
- Reduce number of API calls in demo flow

## Free Tier Limitations

### Render Free Tier

- Services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds
- 750 hours/month of runtime per service
- Automatic deploys on git push

### Neo4j Aura Free Tier

- 200k nodes + 400k relationships limit
- 50 concurrent connections
- 1GB storage
- Sufficient for demo purposes

## Monitoring and Maintenance

### Check Service Health

```bash
# API health check
curl https://forge-api.onrender.com/health

# Dashboard health check
curl https://forge-dashboard.onrender.com/
```

### View Logs

1. Render Dashboard → Select service → Logs tab
2. Filter by error level
3. Download logs for debugging

### Update Environment Variables

1. Render Dashboard → Select service → Environment tab
2. Edit variable values
3. Click "Save Changes"
4. Service will automatically redeploy

### Redeploy Services

1. Render Dashboard → Select service
2. Click "Manual Deploy" → "Deploy latest commit"
3. Or push to GitHub to trigger auto-deploy

## Production Checklist

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

## Next Steps

1. Test the deployed system thoroughly
2. Record a demo video showing the full flow
3. Share the dashboard URL with hackathon judges
4. Monitor logs during evaluation period
5. Be ready to debug issues in real-time

## Support Resources

- Render Documentation: https://render.com/docs
- Neo4j Aura Documentation: https://neo4j.com/docs/aura/
- FORGE API Documentation: See docs/API-KEYS-GUIDE.md
- GitHub Issues: Report bugs in your repository
