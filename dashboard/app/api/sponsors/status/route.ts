import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function GET() {
  try {
    // Fetch real-time status from backend
    const response = await fetch(`${API_URL}/api/agent/status/current`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch agent status');
    }

    const data = await response.json();
    
    // Map of all sponsors
    const allSponsors = [
      'IronClaw',
      'OpenAI',
      'Tavily',
      'Yutori',
      'Neo4j',
      'Modulate',
      'Senso',
      'Numeric',
      'Airbyte'
    ];

    // Determine status for each sponsor
    const sponsors = allSponsors.map(name => {
      let status: 'active' | 'used' | 'inactive' = 'inactive';
      
      // Check if this is the currently active sponsor
      if (data.activeSponsor === name) {
        status = 'active';
      }
      // Check if this sponsor was used in the demo
      else if (data.recentSponsors && data.recentSponsors.includes(name)) {
        status = 'used';
      }
      // OpenAI is always used when agent is not idle
      else if (name === 'OpenAI' && data.status !== 'idle') {
        status = 'used';
      }

      return {
        name,
        status,
        logo: `/logos/${name.toLowerCase()}.svg`
      };
    });

    return NextResponse.json({ 
      sponsors,
      agentStatus: data.status,
      activeSponsor: data.activeSponsor
    });
  } catch (error) {
    console.error('[Sponsor Status] Error:', error);
    
    // Fallback to all inactive
    const sponsors = [
      'IronClaw',
      'OpenAI',
      'Tavily',
      'Yutori',
      'Neo4j',
      'Modulate',
      'Senso',
      'Numeric',
      'Airbyte'
    ].map(name => ({
      name,
      status: 'inactive' as const,
      logo: `/logos/${name.toLowerCase()}.svg`
    }));

    return NextResponse.json({ sponsors });
  }
}
