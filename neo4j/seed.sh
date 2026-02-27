#!/bin/bash

# FORGE Neo4j Seed Script Runner
# Executes seed.cypher to populate initial data

set -e

echo "🌱 FORGE Neo4j Seed Script"
echo "=========================="
echo ""

# Check if Neo4j container is running
if ! docker ps | grep -q forge-neo4j; then
    echo "❌ Neo4j container 'forge-neo4j' is not running"
    echo "   Please start it with: docker-compose up -d"
    exit 1
fi

echo "✅ Neo4j container is running"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SEED_FILE="$SCRIPT_DIR/seed.cypher"

# Check if seed file exists
if [ ! -f "$SEED_FILE" ]; then
    echo "❌ Seed file not found: $SEED_FILE"
    exit 1
fi

echo "📄 Seed file: $SEED_FILE"
echo ""

# Copy seed file to container
echo "📋 Copying seed.cypher to Neo4j container..."
docker cp "$SEED_FILE" forge-neo4j:/tmp/seed.cypher

if [ $? -eq 0 ]; then
    echo "✅ File copied successfully"
else
    echo "❌ Failed to copy file"
    exit 1
fi

echo ""

# Execute seed script
echo "🔧 Executing seed script in Neo4j..."
echo ""

docker exec forge-neo4j cypher-shell \
    -u "${NEO4J_USERNAME:-neo4j}" \
    -p "${NEO4J_PASSWORD:-password}" \
    -f /tmp/seed.cypher

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Seed script executed successfully"
else
    echo ""
    echo "❌ Seed script execution failed"
    exit 1
fi

echo ""
echo "🔍 Verifying seeded data..."
echo ""

# Verify data with a simple query
docker exec forge-neo4j cypher-shell \
    -u "${NEO4J_USERNAME:-neo4j}" \
    -p "${NEO4J_PASSWORD:-password}" \
    --format plain \
    "MATCH (u:User) RETURN u.name as User, u.portfolioValue as Portfolio; MATCH (p:Policy) RETURN count(p) as Policies; MATCH (c:Collection) RETURN count(c) as Collections;"

echo ""
echo "🎉 Seed process completed!"
echo ""
echo "You can now access Neo4j Browser at: http://localhost:7474"
echo "Username: ${NEO4J_USERNAME:-neo4j}"
echo "Password: ${NEO4J_PASSWORD:-password}"
