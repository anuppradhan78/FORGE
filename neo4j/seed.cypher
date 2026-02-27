// FORGE Neo4j Seed Script
// Creates demo user, policies, and NFT collections for hackathon POC

// ============================================
// 1. Create Indexes for Performance
// ============================================

CREATE INDEX user_id_index IF NOT EXISTS FOR (u:User) ON (u.id);
CREATE INDEX policy_user_id_index IF NOT EXISTS FOR (p:Policy) ON (p.userId);
CREATE INDEX decision_timestamp_index IF NOT EXISTS FOR (d:Decision) ON (d.timestamp);
CREATE INDEX collection_id_index IF NOT EXISTS FOR (c:Collection) ON (c.id);

// ============================================
// 2. Create Demo User "Alice"
// ============================================

CREATE (alice:User {
  id: 'demo-user-alice',
  name: 'Alice',
  portfolioValue: 1000.0,
  riskTolerance: 'medium',
  createdAt: datetime()
});

// ============================================
// 3. Create Policies for Alice
// ============================================

// Policy 1: Max 10% of portfolio per transaction
CREATE (p1:Policy {
  id: 'policy-max-transaction-percent',
  userId: 'demo-user-alice',
  type: 'max_transaction_percent',
  threshold: 0.10,
  description: 'Maximum 10% of portfolio value per single transaction',
  active: true,
  enforcementLevel: 'blocking',
  createdAt: datetime()
});

// Policy 2: Max 5 transactions per day
CREATE (p2:Policy {
  id: 'policy-max-daily-transactions',
  userId: 'demo-user-alice',
  type: 'max_daily_transactions',
  threshold: 5,
  description: 'Maximum 5 transactions allowed per day',
  active: true,
  enforcementLevel: 'blocking',
  createdAt: datetime()
});

// Policy 3: Minimum confidence score of 0.7
CREATE (p3:Policy {
  id: 'policy-min-confidence-score',
  userId: 'demo-user-alice',
  type: 'min_confidence_score',
  threshold: 0.7,
  description: 'Minimum verification confidence score of 0.7 required',
  active: true,
  enforcementLevel: 'blocking',
  createdAt: datetime()
});

// ============================================
// 4. Link Policies to User
// ============================================

MATCH (u:User {id: 'demo-user-alice'})
MATCH (p1:Policy {id: 'policy-max-transaction-percent'})
MATCH (p2:Policy {id: 'policy-max-daily-transactions'})
MATCH (p3:Policy {id: 'policy-min-confidence-score'})
CREATE (u)-[:HAS_POLICY]->(p1)
CREATE (u)-[:HAS_POLICY]->(p2)
CREATE (u)-[:HAS_POLICY]->(p3);

// ============================================
// 5. Create NFT Collections
// ============================================

// Collection 1: NEAR Punks
CREATE (c1:Collection {
  id: 'near-punks',
  name: 'NEAR Punks',
  floorPrice: 25.5,
  verified: true,
  contractAddress: 'nearpunks.near',
  description: 'Original NEAR NFT collection',
  createdAt: datetime()
});

// Collection 2: Antisocial Ape Club (ASAC)
CREATE (c2:Collection {
  id: 'asac',
  name: 'Antisocial Ape Club',
  floorPrice: 42.0,
  verified: true,
  contractAddress: 'asac.near',
  description: 'Premium NEAR ape NFT collection',
  createdAt: datetime()
});

// Collection 3: Paras Gems
CREATE (c3:Collection {
  id: 'paras-gems',
  name: 'Paras Gems',
  floorPrice: 15.0,
  verified: true,
  contractAddress: 'parasgems.near',
  description: 'Curated digital art collection on Paras',
  createdAt: datetime()
});

// ============================================
// 6. Verification Query
// ============================================

// Return summary of seeded data
MATCH (u:User)
OPTIONAL MATCH (u)-[:HAS_POLICY]->(p:Policy)
WITH u, count(p) as policyCount
MATCH (c:Collection)
RETURN 
  'Seed Complete' as status,
  u.name as userName,
  u.portfolioValue as portfolio,
  policyCount as policies,
  count(c) as collections;
