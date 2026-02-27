const neo4j = require('neo4j-driver');
require('dotenv').config();

async function testConnection() {
  console.log('Testing Neo4j connection...');
  console.log('URI:', process.env.NEO4J_URI);
  console.log('User:', process.env.NEO4J_USER);
  console.log('Password:', process.env.NEO4J_PASSWORD ? '***' : 'NOT SET');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password'
    )
  );
  
  try {
    await driver.verifyConnectivity();
    console.log('✅ Connection successful!');
    
    const session = driver.session();
    const result = await session.run('RETURN "Hello Neo4j" as message');
    console.log('Query result:', result.records[0].get('message'));
    await session.close();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await driver.close();
  }
}

testConnection();
