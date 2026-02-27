# Neo4j Aura Setup Guide for FORGE

This guide walks you through setting up a Neo4j Aura cloud instance for production deployment.

## Step 1: Create Neo4j Aura Account

1. Go to https://neo4j.com/cloud/aura/
2. Click "Start Free" or "Sign Up"
3. Create account with email or Google/GitHub
4. Verify your email address

## Step 2: Create AuraDB Free Instance

1. Log in to https://console.neo4j.io/
2. Click "New Instance" button
3. Select "AuraDB Free" tier
   - 200k nodes + 400k relationships
   - 50 concurrent connections
   - 1GB storage
   - Perfect for demo/POC

4. Configure instance:
   - **Name**: `forge-production` (or your preferred name)
   - **Region**: Choose closest to your Render deployment region
     - US: `us-east-1` (Virginia) or `us-west-2` (Oregon)
     - EU: `eu-west-1` (Ireland)
   - **Version**: Latest stable (5.x)

5. Set database password:
   - Use a strong password
   - **IMPORTANT**: Save this password securely - you cannot recover it
   - Store in password manager or .env file

6. Click "Create" button

7. Wait 2-3 minutes for instance to provision

## Step 3: Get Connection Details

Once your instance is ready:

1. Click on your instance name in the console
2. You'll see the connection details:

```
Connection URI: neo4j+s://xxxxx.databases.neo4j.io
Username: neo4j
Password: [the password you set]
```

3. Copy these details - you'll need them for:
   - Render environment variables
   - Local testing
   - Seed script

## Step 4: Test Connection Locally

Before deploying, test the connection from your local machine:

```bash
# Update .env with Aura credentials
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here

# Test connection
node test-neo4j-connection.js
```

Expected output:
```
✅ Connected to Neo4j successfully
✅ Database is ready
```

## Step 5: Seed Production Database

### Option A: Using Neo4j Browser (Recommended for first time)

1. In Aura console, click "Open" button next to your instance
2. This opens Neo4j Browser in a new tab
3. Login with your credentials
4. Copy the contents of `neo4j/seed.cypher`
5. Paste into the query editor
6. Click the "Play" button to execute
7. Verify data was created:

```cypher
// Check users
MATCH (u:User) RETURN u

// Check policies
MATCH (p:Policy) RETURN p

// Check collections
MATCH (c:Collection) RETURN c

// Count all nodes
MATCH (n) RETURN count(n) as totalNodes
```

Expected: ~10-15 nodes created

### Option B: Using Seed Runner Script

```bash
# Make sure .env has Aura credentials
node neo4j/seed-runner.ts
```

Expected output:
```
🌱 Seeding Neo4j database...
✅ Created 3 users
✅ Created 9 policies
✅ Created 3 collections
✅ Created indexes
✅ Seeding complete!
```

## Step 6: Verify Data

Run verification queries in Neo4j Browser:

```cypher
// 1. Check demo user exists
MATCH (u:User {id: 'demo-user-1'})
RETURN u.name, u.portfolioValue, u.riskTolerance

// 2. Check user has policies
MATCH (u:User {id: 'demo-user-1'})-[:HAS_POLICY]->(p:Policy)
RETURN p.type, p.threshold, p.description

// 3. Check NFT collections
MATCH (c:Collection)
RETURN c.name, c.floorPrice, c.verified
ORDER BY c.floorPrice

// 4. Verify indexes exist
SHOW INDEXES
```

Expected results:
- User "Alice" with 1000 NEAR portfolio
- 3 policies (max_transaction_percent, max_daily_transactions, min_confidence_score)
- 3 collections (NEAR Punks, ASAC, Paras Gems)
- 4 indexes created

## Step 7: Configure Render Environment Variables

Now that your Aura instance is ready, add these to Render:

### For `forge-api` service:

```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
```

### For `forge-dashboard` service:

```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-aura-password
```

## Step 8: Test from Deployed API

After deploying to Render, test the connection:

```bash
# Check API health (should show neo4j: connected)
curl https://forge-api.onrender.com/health

# Query audit trail
curl https://forge-api.onrender.com/api/governance/audit

# Run demo flow
curl -X POST https://forge-api.onrender.com/api/demo/run \
  -H "Content-Type: application/json" \
  -d '{"userId": "demo-user-1"}'
```

## Troubleshooting

### Connection Refused

**Problem**: `Failed to connect to Neo4j`

**Solutions**:
- Verify URI format: `neo4j+s://` (with +s for secure connection)
- Check username is exactly `neo4j` (lowercase)
- Verify password is correct (no extra spaces)
- Ensure Aura instance is running (not paused)

### Authentication Failed

**Problem**: `Authentication failed`

**Solutions**:
- Double-check password (case-sensitive)
- Try resetting password in Aura console
- Ensure no special characters causing issues in .env file
- Use quotes around password if it contains special chars

### Timeout Errors

**Problem**: `Connection timeout`

**Solutions**:
- Check your internet connection
- Verify Aura instance region is accessible
- Try different region if persistent issues
- Check Render service can reach external databases

### Seed Script Fails

**Problem**: `Error creating nodes`

**Solutions**:
- Check if data already exists (run `MATCH (n) RETURN count(n)`)
- Clear database first: `MATCH (n) DETACH DELETE n`
- Run seed queries one at a time in Neo4j Browser
- Check for syntax errors in seed.cypher

### Performance Issues

**Problem**: Queries are slow

**Solutions**:
- Verify indexes were created: `SHOW INDEXES`
- Recreate indexes if missing
- Check free tier limits (200k nodes)
- Optimize Cypher queries with EXPLAIN

## Monitoring and Maintenance

### Check Database Size

```cypher
// Count nodes by type
MATCH (n)
RETURN labels(n) as type, count(n) as count
ORDER BY count DESC

// Count relationships
MATCH ()-[r]->()
RETURN type(r) as relType, count(r) as count
ORDER BY count DESC
```

### Clear Demo Data

To reset between demo runs:

```cypher
// Delete all decisions and transactions (keep users and policies)
MATCH (d:Decision)
DETACH DELETE d

MATCH (t:Transaction)
DETACH DELETE t

MATCH (f:FluxReport)
DETACH DELETE f

MATCH (c:Context)
DETACH DELETE c
```

### Backup Data

Aura Free tier doesn't support automated backups, but you can export:

1. In Neo4j Browser, run:
```cypher
// Export all data
CALL apoc.export.cypher.all("backup.cypher", {})
```

2. Or use Neo4j Desktop to connect and export

### Monitor Usage

1. Go to Aura console
2. Click on your instance
3. View metrics:
   - Storage used
   - Query performance
   - Connection count

## Free Tier Limits

- **Nodes**: 200,000 maximum
- **Relationships**: 400,000 maximum
- **Storage**: 1GB
- **Connections**: 50 concurrent
- **Queries**: No rate limit
- **Uptime**: 99.9% SLA

For FORGE demo, typical usage:
- ~50-100 nodes per demo run
- ~100-200 relationships per demo run
- Can run 1000+ demos before hitting limits

## Upgrade Path

If you need more capacity:

1. **AuraDB Professional** ($65/month)
   - 2M nodes
   - 4M relationships
   - 8GB storage
   - 100 connections

2. **AuraDB Enterprise** (custom pricing)
   - Unlimited nodes
   - Dedicated resources
   - Advanced security
   - 24/7 support

## Security Best Practices

1. **Never commit credentials**
   - Use .env files (in .gitignore)
   - Use Render environment variables
   - Rotate passwords regularly

2. **Limit access**
   - Only give credentials to necessary services
   - Use read-only users for dashboard if possible
   - Monitor connection logs

3. **Regular backups**
   - Export data periodically
   - Test restore process
   - Keep backups secure

## Support Resources

- Aura Documentation: https://neo4j.com/docs/aura/
- Neo4j Community Forum: https://community.neo4j.com/
- Cypher Manual: https://neo4j.com/docs/cypher-manual/
- APOC Documentation: https://neo4j.com/docs/apoc/

## Next Steps

After setting up Aura:

1. ✅ Test connection locally
2. ✅ Seed production database
3. ✅ Configure Render environment variables
4. ✅ Deploy services to Render
5. ✅ Run verification tests
6. ✅ Test full demo flow

See [Render Deployment Guide](../docs/RENDER-DEPLOYMENT.md) for complete deployment instructions.
