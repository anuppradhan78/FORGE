'use client';

import { useEffect, useState } from 'react';

interface SponsorStatus {
  name: string;
  status: 'active' | 'used' | 'inactive' | 'error';
  logo: string;
}

export default function SponsorGrid() {
  const [sponsors, setSponsors] = useState<SponsorStatus[]>([
    { name: 'IronClaw', status: 'inactive', logo: '/logos/ironclaw.svg' },
    { name: 'OpenAI', status: 'inactive', logo: '/logos/openai.svg' },
    { name: 'Tavily', status: 'inactive', logo: '/logos/tavily.svg' },
    { name: 'Yutori', status: 'inactive', logo: '/logos/yutori.svg' },
    { name: 'Neo4j', status: 'inactive', logo: '/logos/neo4j.svg' },
    { name: 'Modulate', status: 'inactive', logo: '/logos/modulate.svg' },
    { name: 'Senso', status: 'inactive', logo: '/logos/senso.svg' },
    { name: 'Numeric', status: 'inactive', logo: '/logos/numeric.svg' },
    { name: 'Airbyte', status: 'inactive', logo: '/logos/airbyte.svg' },
  ]);

  useEffect(() => {
    // Fetch sponsor status from API
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/sponsors/status');
        if (response.ok) {
          const data = await response.json();
          setSponsors(data.sponsors || sponsors);
        }
      } catch (error) {
        console.error('Failed to fetch sponsor status:', error);
      }
    };

    fetchStatus();
    // Poll more frequently (every 500ms) for real-time updates
    const interval = setInterval(fetchStatus, 500);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-forge-success shadow-lg shadow-forge-success/50';
      case 'used':
        return 'bg-forge-success';
      case 'error':
        return 'bg-forge-error';
      default:
        return 'bg-slate-600';
    }
  };

  const getStatusAnimation = (status: string) => {
    switch (status) {
      case 'active':
        return 'animate-pulse';
      case 'used':
        return '';
      default:
        return '';
    }
  };

  return (
    <section className="bg-slate-800 rounded-lg p-4 sm:p-6 shadow-xl border border-slate-700 card-hover">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-forge-accent">Sponsor Integrations</h2>
        
        {/* Legend */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-forge-success animate-pulse shadow-sm shadow-forge-success/50" />
            <span className="text-slate-400">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-forge-success" />
            <span className="text-slate-400">Used</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-slate-400">Idle</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {sponsors.map((sponsor) => (
          <div
            key={sponsor.name}
            className="relative bg-slate-700 rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center hover:bg-slate-600 transition-all duration-200 min-h-[100px] sm:min-h-[120px] card-hover"
          >
            {/* Status Indicator */}
            <div className="absolute top-2 right-2">
              <div
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${getStatusColor(sponsor.status)} ${getStatusAnimation(sponsor.status)} transition-all duration-300`}
                title={sponsor.status}
              />
            </div>

            {/* Logo Placeholder */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-3 flex items-center justify-center bg-slate-600 rounded-lg transition-transform duration-200 hover:scale-110">
              <span className="text-xl sm:text-2xl font-bold text-slate-400">
                {sponsor.name.charAt(0)}
              </span>
            </div>

            {/* Sponsor Name */}
            <p className="text-xs sm:text-sm font-medium text-slate-300 text-center break-words w-full px-1">
              {sponsor.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
