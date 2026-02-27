import { NextRequest, NextResponse } from 'next/server';

/**
 * Flux Report API Route
 * Queries Neo4j for FluxReport nodes with reconciliation data
 * Requirements: 9.3
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * GET /api/flux
 * Get the most recent flux report, optionally filtered by userId or transactionId
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const userId = searchParams.get('userId');
    const transactionId = searchParams.get('transactionId');
    const limit = searchParams.get('limit') || '1';

    // Build Cypher query based on filters
    let cypherQuery: string;
    const params: Record<string, any> = {};

    if (transactionId) {
      // Query for specific transaction's flux report
      cypherQuery = `
        MATCH (t:Transaction {id: $transactionId})-[:RECONCILED_BY]->(f:FluxReport)
        RETURN f
        ORDER BY f.timestamp DESC
        LIMIT 1
      `;
      params.transactionId = transactionId;
    } else if (userId) {
      // Query for user's most recent flux report
      // Try the full path first, but fall back to simpler query
      cypherQuery = `
        MATCH (u:User {id: $userId})-[:HAS_FLUX_REPORT]->(f:FluxReport)
        RETURN f
        ORDER BY f.timestamp DESC
        LIMIT $limit
      `;
      params.userId = userId;
      params.limit = Math.floor(parseInt(limit, 10)); // Ensure integer
    } else {
      // Query for most recent flux report across all users
      cypherQuery = `
        MATCH (f:FluxReport)
        RETURN f
        ORDER BY f.timestamp DESC
        LIMIT $limit
      `;
      params.limit = Math.floor(parseInt(limit, 10)); // Ensure integer
    }

    // Call backend API to execute Cypher query
    const response = await fetch(`${API_URL}/api/governance/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cypherQuery,
        params,
      }),
      cache: 'no-store', // Disable caching for real-time data
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
          report: null,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract flux report from results
    if (!data.success || !data.results || data.results.length === 0) {
      return NextResponse.json({
        success: true,
        report: null,
        message: 'No flux reports found',
      });
    }

    // Parse the first result
    const fluxReportNode = data.results[0].f;
    
    if (!fluxReportNode) {
      return NextResponse.json({
        success: true,
        report: null,
        message: 'No flux report data available',
      });
    }

    // Transform Neo4j node properties to FluxReport format
    // Properties might be nested under 'properties' or directly on the node
    const properties = fluxReportNode.properties || fluxReportNode;
    
    // Parse JSON fields
    let anomalies = [];
    if (properties.anomalies) {
      try {
        anomalies = typeof properties.anomalies === 'string' 
          ? JSON.parse(properties.anomalies) 
          : properties.anomalies;
      } catch (e) {
        console.error('[Flux API] Failed to parse anomalies:', e);
      }
    }

    // Calculate variance percentage
    const variancePercent = properties.portfolioValueBefore > 0
      ? ((properties.variance || 0) / properties.portfolioValueBefore) * 100
      : 0;

    // Convert Neo4j datetime to ISO string
    let timestamp = new Date().toISOString();
    if (properties.timestamp) {
      if (typeof properties.timestamp === 'string') {
        timestamp = properties.timestamp;
      } else if (properties.timestamp.year) {
        // Neo4j datetime object
        const dt = properties.timestamp;
        timestamp = new Date(
          dt.year.low,
          dt.month.low - 1,
          dt.day.low,
          dt.hour.low,
          dt.minute.low,
          dt.second.low,
          Math.floor(dt.nanosecond.low / 1000000)
        ).toISOString();
      }
    }

    const fluxReport = {
      id: properties.id,
      transactionId: properties.transactionId,
      portfolioValueBefore: properties.portfolioValueBefore || 0,
      portfolioValueAfter: properties.portfolioValueAfter || 0,
      variance: properties.variance || 0,
      variancePercent,
      anomalies,
      aiExplanation: properties.aiExplanation || 'No explanation available',
      reconciled: properties.reconciled !== false, // Default to true if not specified
      timestamp,
    };

    return NextResponse.json({
      success: true,
      report: fluxReport,
    });
  } catch (error) {
    console.error('[Flux API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch flux report',
        report: null,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/flux/history
 * Get historical flux reports with pagination
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, startDate, endDate, limit = 10, page = 1 } = body;

    // Build Cypher query for historical reports
    const conditions: string[] = [];
    const params: Record<string, any> = {
      limit: Math.floor(parseInt(limit as string, 10)),
      skip: (Math.floor(parseInt(page as string, 10)) - 1) * Math.floor(parseInt(limit as string, 10)),
    };

    let matchClause = 'MATCH (f:FluxReport)';
    
    if (userId) {
      matchClause = `
        MATCH (u:User {id: $userId})-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)-[:RECONCILED_BY]->(f:FluxReport)
      `;
      params.userId = userId;
    }

    if (startDate) {
      conditions.push('f.timestamp >= datetime($startDate)');
      params.startDate = startDate;
    }

    if (endDate) {
      conditions.push('f.timestamp <= datetime($endDate)');
      params.endDate = endDate;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const cypherQuery = `
      ${matchClause}
      ${whereClause}
      RETURN f
      ORDER BY f.timestamp DESC
      SKIP $skip
      LIMIT $limit
    `;

    // Call backend API to execute Cypher query
    const response = await fetch(`${API_URL}/api/governance/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cypherQuery,
        params,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
          reports: [],
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform results
    const reports = (data.results || []).map((result: any) => {
      const properties = result.f?.properties || {};
      
      let anomalies = [];
      if (properties.anomalies) {
        try {
          anomalies = typeof properties.anomalies === 'string' 
            ? JSON.parse(properties.anomalies) 
            : properties.anomalies;
        } catch (e) {
          console.error('[Flux API] Failed to parse anomalies:', e);
        }
      }

      const variancePercent = properties.portfolioValueBefore > 0
        ? ((properties.variance || 0) / properties.portfolioValueBefore) * 100
        : 0;

      return {
        id: properties.id,
        transactionId: properties.transactionId,
        portfolioValueBefore: properties.portfolioValueBefore || 0,
        portfolioValueAfter: properties.portfolioValueAfter || 0,
        variance: properties.variance || 0,
        variancePercent,
        anomalies,
        aiExplanation: properties.aiExplanation || 'No explanation available',
        reconciled: properties.reconciled !== false,
        timestamp: properties.timestamp || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      reports,
      count: reports.length,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('[Flux API] History error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch flux report history',
        reports: [],
      },
      { status: 500 }
    );
  }
}
