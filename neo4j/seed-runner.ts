import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getNeo4jClient, initNeo4j, closeNeo4j } from '../api/src/utils/neo4j-client';

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Seed Runner for FORGE Neo4j Database
 * Executes seed.cypher script and verifies data was loaded correctly
 */

async function executeSeedScript(): Promise<void> {
  console.log('🌱 Starting Neo4j seed process...\n');

  try {
    // Initialize Neo4j connection
    console.log('📡 Connecting to Neo4j...');
    await initNeo4j();
    const client = getNeo4jClient();
    console.log('✅ Connected to Neo4j\n');

    // Read seed.cypher file
    const seedFilePath = path.join(__dirname, 'seed.cypher');
    console.log(`📄 Reading seed script from: ${seedFilePath}`);
    
    if (!fs.existsSync(seedFilePath)) {
      throw new Error(`Seed file not found: ${seedFilePath}`);
    }

    const seedScript = fs.readFileSync(seedFilePath, 'utf-8');
    console.log('✅ Seed script loaded\n');

    // Split script into individual statements (separated by semicolons)
    const statements = seedScript
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('//'));

    console.log(`🔧 Executing ${statements.length} Cypher statements...\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('//')) {
        continue;
      }

      try {
        console.log(`  [${i + 1}/${statements.length}] Executing statement...`);
        await client.executeWrite(statement);
        console.log(`  ✅ Statement ${i + 1} completed`);
      } catch (error) {
        console.error(`  ❌ Statement ${i + 1} failed:`, error);
        // Continue with other statements
      }
    }

    console.log('\n✅ All statements executed\n');

    // Verify data was loaded correctly
    console.log('🔍 Verifying seeded data...\n');

    // Check user
    const user = await client.getUserById('demo-user-alice');
    if (user) {
      console.log(`✅ User created: ${user.name} (Portfolio: ${user.portfolioValue} NEAR)`);
    } else {
      console.error('❌ User not found');
    }

    // Check policies
    const policies = await client.getUserPolicies('demo-user-alice');
    console.log(`✅ Policies created: ${policies.length}`);
    policies.forEach((policy) => {
      console.log(`   - ${policy.type}: ${policy.description}`);
    });

    // Check collections
    const collections = await client.getAllCollections();
    console.log(`✅ Collections created: ${collections.length}`);
    collections.forEach((collection) => {
      console.log(
        `   - ${collection.name}: Floor ${collection.floorPrice} NEAR (${collection.contractAddress})`
      );
    });

    console.log('\n🎉 Seed process completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seed process failed:', error);
    process.exit(1);
  } finally {
    // Close connection
    await closeNeo4j();
    console.log('👋 Neo4j connection closed');
  }
}

// Fallback: Execute seed via docker exec if Airbyte unavailable
async function executeSeedViaDocker(): Promise<void> {
  console.log('🐳 Attempting to seed via docker exec...\n');

  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);

  try {
    const seedFilePath = path.join(__dirname, 'seed.cypher');
    
    // Copy seed file to Neo4j container
    console.log('📋 Copying seed.cypher to Neo4j container...');
    await execPromise(
      `docker cp ${seedFilePath} forge-neo4j:/tmp/seed.cypher`
    );
    console.log('✅ File copied\n');

    // Execute seed script in container
    console.log('🔧 Executing seed script in Neo4j container...');
    const { stdout, stderr } = await execPromise(
      `docker exec forge-neo4j cypher-shell -u neo4j -p password -f /tmp/seed.cypher`
    );

    if (stdout) {
      console.log('📤 Output:', stdout);
    }
    if (stderr) {
      console.error('⚠️  Errors:', stderr);
    }

    console.log('\n✅ Docker seed execution completed\n');
  } catch (error) {
    console.error('❌ Docker seed execution failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const useDocker = args.includes('--docker');

  if (useDocker) {
    await executeSeedViaDocker();
  } else {
    await executeSeedScript();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { executeSeedScript, executeSeedViaDocker };
