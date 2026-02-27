# Neo4j Database Setup for FORGE

This directory contains the Neo4j seed data and utilities for the FORGE hackathon POC.

## Files

- `seed.cypher` - Cypher script that creates demo user, policies, and NFT collections
- `seed.sh` - Bash script to execute seed via docker exec
- `seed-runner.ts` - TypeScript utility to execute seed via Neo4j driver

## Quick Start

### Option 1: Using Bash Script (Recommended)

```bash
# Make script executable
chmod +x neo4j/seed.sh

# Run the seed script
./neo4j/seed.sh
```

### Option 2: Using Docker Exec Directly

```bash
# Copy seed file to container
docker cp neo4j/seed.cypher forge-neo4j:/tmp/seed.cypher

# Execute seed script
docker exec forge-neo4j cypher-shell \
  -u neo4j \
  -p password \
  -f /tmp/seed.cypher
```

### Option 3: Using TypeScript Runner

```bash
# Install dependencies first
cd api && npm install

# Run the seed runner
npx ts-node ../neo4j/seed-runner.ts

# Or use docker mode
npx ts-node ../neo4j/seed-runner.ts --docker
```

### Option 4: Using Neo4j Browser

1. Open http://localhost:7474
2. Login with username: `neo4j`, password: `password`
3. Copy the contents of `seed.cypher`
4. Paste into the query editor
5. Execute the script

## Seeded Data

### User
- **Alice** (demo-user-alice)
  - Portfolio: 1000 NEAR
  - Risk Tolerance: Medium

### Policies
1. **Max Transaction Percent**: 10% of portfolio per transaction
2. **Max Daily Transactions**: 5 transactions per day
3. **Min Confidence Score**: 0.7 verification confidence required

### NFT Collections
1. **NEAR Punks** - Floor: 25.5 NEAR
2. **Antisocial Ape Club (ASAC)** - Floor: 42.0 NEAR
3. **Paras Gems** - Floor: 15.0 NEAR

## Verification

After seeding, verify the data was loaded:

```cypher
// Check user
MATCH (u:User) RETURN u;

// Check policies
MATCH (u:User)-[:HAS_POLICY]->(p:Policy) RETURN u.name, p.type, p.threshold;

// Check collections
MATCH (c:Collection) RETURN c.name, c.floorPrice;

// Check indexes
CALL db.indexes();
```

## Troubleshooting

### Container Not Running
```bash
docker-compose up -d
```

### Connection Refused
Wait 10-15 seconds for Neo4j to fully start, then retry.

### Permission Denied on seed.sh
```bash
chmod +x neo4j/seed.sh
```

### Clear All Data (Reset)
```cypher
MATCH (n) DETACH DELETE n;
```

Then re-run the seed script.

## Environment Variables

The seed scripts use these environment variables (with defaults):

- `NEO4J_URI` - Default: `bolt://localhost:7687`
- `NEO4J_USERNAME` - Default: `neo4j`
- `NEO4J_PASSWORD` - Default: `password`

Set these in your `.env` file or export them before running the seed scripts.
