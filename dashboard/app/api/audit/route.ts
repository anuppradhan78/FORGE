import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Audit Trail API Route
 * Queries Neo4j for recent decisions with full provenance data
 * Requirements: 7.4
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Extract query parameters
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const decisionType = searchParams.get('decisionType');
    const limit = searchParams.get('limit') || '10';
    const page = searchParams.get('page') || '1';

    // Build query parameters for backend API
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (decisionType) params.append('decisionType', decisionType);
    params.append('limit', limit);
    params.append('page', page);

    // Call backend API
    const response = await fetch(`${API_URL}/api/governance/audit?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for real-time data
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
          entries: [],
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      entries: data.entries || [],
      total: data.total || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: data.hasMore || false,
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
        entries: [],
      },
      { status: 500 }
    );
  }
}

/**
 * Get decision provenance (full relationship graph for a specific decision)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { decisionId } = body;

    if (!decisionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'decisionId is required',
        },
        { status: 400 }
      );
    }

    // Call backend API to get full provenance
    const response = await fetch(`${API_URL}/api/governance/provenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ decisionId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      provenance: data.provenance || null,
    });
  } catch (error) {
    console.error('[Audit API] Provenance error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch decision provenance',
      },
      { status: 500 }
    );
  }
}
