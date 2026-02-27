import { NextRequest, NextResponse } from 'next/server';
import neo4j from 'neo4j-driver';
import { GraphNode, GraphEdge, GraphData } from '../../../types/graph';

// Neo4j connection configuration
const getNeo4jDriver = () => {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const username = process.env.NEO4J_USER || process.env.NEO4J_USERNAME || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'password';

  return neo4j.driver(uri, neo4j.auth.basic(username, password));
};

// Predefined queries for common graph visualizations
const PREDEFINED_QUERIES: Record<string, string> = {
  'full-audit': `
    MATCH (u:User)-[r1:MADE_DECISION]->(d:Decision)
    OPTIONAL MATCH (d)-[r2:CHECKED_POLICY]->(p:Policy)
    OPTIONAL MATCH (d)-[r3:USED_CONTEXT]->(c:Context)
    OPTIONAL MATCH (d)-[r4:TRIGGERED_TX]->(t:Transaction)
    RETURN u, d, p, c, t, r1, r2, r3, r4
    LIMIT 50
  `,
  'user-policies': `
    MATCH (u:User)-[r:HAS_POLICY]->(p:Policy)
    WHERE p.active = true
    RETURN u, p, r
  `,
  'recent-decisions': `
    MATCH (u:User)-[r1:MADE_DECISION]->(d:Decision)
    OPTIONAL MATCH (d)-[r2:CHECKED_POLICY]->(p:Policy)
    WHERE d.timestamp > datetime() - duration('P7D')
    RETURN u, d, p, r1, r2
    ORDER BY d.timestamp DESC
    LIMIT 20
  `,
  'transaction-flow': `
    MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)
    OPTIONAL MATCH (t)-[:RECONCILED_BY]->(f:FluxReport)
    RETURN u, d, t, f
    LIMIT 30
  `,
  'policy-violations': `
    MATCH (u:User)-[:MADE_DECISION]->(d:Decision)-[:CHECKED_POLICY]->(p:Policy)
    WHERE d.verdict = 'reject'
    RETURN u, d, p
    LIMIT 20
  `,
};

/**
 * Transform Neo4j results to D3-compatible format
 */
function transformNeo4jToGraph(records: any[]): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  records.forEach((record) => {
    record.keys.forEach((key: string) => {
      const value = record.get(key);

      if (!value) return;

      // Handle nodes
      if (value.labels) {
        const nodeType = value.labels[0];
        const nodeId = value.properties.id || value.identity.toString();
        
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, {
            id: nodeId,
            label: value.properties.name || value.properties.id || nodeType,
            type: nodeType as GraphNode['type'],
            properties: value.properties,
          });
        }
      }

      // Handle relationships
      if (value.type && value.start && value.end) {
        const sourceId = value.start.toString();
        const targetId = value.end.toString();
        
        edges.push({
          source: sourceId,
          target: targetId,
          type: value.type,
          properties: value.properties || {},
        });
      }
    });
  });

  // Convert nodes map to array and ensure we have proper IDs
  const nodes = Array.from(nodesMap.values()).map((node, index) => {
    // If node doesn't have a proper ID, use the map key
    if (!node.id || node.id === '[object Object]') {
      const entries = Array.from(nodesMap.entries());
      node.id = entries[index][0];
    }
    return node;
  });

  // Update edge references to use the correct node IDs
  const validEdges = edges.filter((edge) => {
    const sourceExists = nodes.some((n) => n.id === edge.source);
    const targetExists = nodes.some((n) => n.id === edge.target);
    return sourceExists && targetExists;
  });

  return {
    nodes,
    edges: validEdges,
  };
}

/**
 * Execute Cypher query with retry logic
 */
async function executeQuery(query: string, params: Record<string, any> = {}): Promise<any[]> {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const result = await session.run(query, params);
    return result.records;
  } catch (error) {
    console.error('Neo4j query error:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

/**
 * GET /api/graph
 * Query parameters:
 * - query: Custom Cypher query (optional)
 * - predefined: Name of predefined query (optional)
 * - params: JSON string of query parameters (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customQuery = searchParams.get('query');
    const predefinedName = searchParams.get('predefined');
    const paramsStr = searchParams.get('params');

    let query: string;
    let params: Record<string, any> = {};

    // Parse parameters if provided
    if (paramsStr) {
      try {
        params = JSON.parse(paramsStr);
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid params JSON' },
          { status: 400 }
        );
      }
    }

    // Determine which query to use
    if (customQuery) {
      query = customQuery;
    } else if (predefinedName && PREDEFINED_QUERIES[predefinedName]) {
      query = PREDEFINED_QUERIES[predefinedName];
    } else {
      // Default query: show recent activity
      query = PREDEFINED_QUERIES['recent-decisions'];
    }

    // Execute query
    const records = await executeQuery(query, params);

    // Transform to D3 format
    const graphData = transformNeo4jToGraph(records);

    return NextResponse.json({
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
    });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch graph data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/graph
 * Body:
 * - query: Cypher query (required)
 * - params: Query parameters (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, params = {} } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Execute query
    const records = await executeQuery(query, params);

    // Transform to D3 format
    const graphData = transformNeo4jToGraph(records);

    return NextResponse.json({
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
    });
  } catch (error: any) {
    console.error('Graph API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute query',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
