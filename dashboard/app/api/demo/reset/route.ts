import { NextRequest, NextResponse } from 'next/server';

/**
 * Demo Reset API Route
 * Clears demo data from Neo4j to reset state
 * Requirements: 10.1
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    console.log('[Demo Reset API] Resetting demo state...');

    // Call backend API to reset demo state
    const response = await fetch(`${API_URL}/api/demo/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Demo Reset API] Backend error:', errorData);
      
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[Demo Reset API] Demo state reset successfully');

    return NextResponse.json({
      success: true,
      message: data.message || 'Demo state reset successfully',
    });
  } catch (error) {
    console.error('[Demo Reset API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset demo state',
      },
      { status: 500 }
    );
  }
}
