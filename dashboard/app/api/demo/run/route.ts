import { NextRequest, NextResponse } from 'next/server';

/**
 * Demo Run API Route
 * Triggers the complete demo flow via DemoService
 * Requirements: 10.1
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voiceCommand, userId } = body;

    // Use default values if not provided
    const command = voiceCommand || 'Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low';
    const user = userId || 'demo-user-alice';

    console.log('[Demo Run API] Starting demo flow...');
    console.log('[Demo Run API] Voice command:', command);
    console.log('[Demo Run API] User ID:', user);

    // Call backend API to run demo flow
    const response = await fetch(`${API_URL}/api/demo/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceCommand: command,
        userId: user,
      }),
      cache: 'no-store', // Disable caching for real-time execution
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[Demo Run API] Backend error:', errorData);
      
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `Backend API error: ${response.statusText}`,
          duration: 0,
          taskId: '',
          decision: {
            verdict: 'reject',
            reasoning: 'Demo flow failed to execute',
            outcome: null,
          },
          toolCalls: [],
          sponsorValidation: {
            allSponsorsInvoked: false,
            sponsorStatus: {},
            missingSponsor: [],
          },
          graphValidation: {
            nodesCreated: 0,
            minimumMet: false,
            nodesBefore: 0,
            nodesAfter: 0,
          },
          auditTrail: {
            decisionId: '',
            timestamp: new Date().toISOString(),
            provenance: null,
          },
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[Demo Run API] Demo flow completed');
    console.log('[Demo Run API] Success:', data.success);
    console.log('[Demo Run API] Duration:', data.duration, 'ms');

    return NextResponse.json({
      success: data.success,
      duration: data.duration,
      taskId: data.taskId,
      decision: data.decision,
      toolCalls: data.toolCalls || [],
      sponsorValidation: data.sponsorValidation,
      graphValidation: data.graphValidation,
      auditTrail: data.auditTrail,
    });
  } catch (error) {
    console.error('[Demo Run API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run demo flow',
        duration: 0,
        taskId: '',
        decision: {
          verdict: 'reject',
          reasoning: 'Demo flow encountered an error',
          outcome: null,
        },
        toolCalls: [],
        sponsorValidation: {
          allSponsorsInvoked: false,
          sponsorStatus: {},
          missingSponsor: [],
        },
        graphValidation: {
          nodesCreated: 0,
          minimumMet: false,
          nodesBefore: 0,
          nodesAfter: 0,
        },
        auditTrail: {
          decisionId: '',
          timestamp: new Date().toISOString(),
          provenance: null,
        },
      },
      { status: 500 }
    );
  }
}
