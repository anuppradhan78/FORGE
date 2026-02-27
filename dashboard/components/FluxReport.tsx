'use client';

import { useEffect, useState } from 'react';

/**
 * FluxReport Component
 * Displays financial reconciliation data from Numeric
 * Shows portfolio changes, variance, and anomalies
 * Requirements: 9.3, 5.4
 */

export interface Anomaly {
  type: 'price_spike' | 'unexpected_fee' | 'balance_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface FluxReport {
  id: string;
  transactionId: string;
  portfolioValueBefore: number;
  portfolioValueAfter: number;
  variance: number;
  variancePercent: number;
  anomalies: Anomaly[];
  aiExplanation: string;
  reconciled: boolean;
  timestamp: string;
}

interface FluxReportProps {
  userId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Severity color mapping
const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  low: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    icon: '⚠️',
  },
  medium: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    border: 'border-orange-300',
    icon: '⚠️',
  },
  high: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-300',
    icon: '🚨',
  },
};

export default function FluxReport({
  userId,
  autoRefresh = false,
  refreshInterval = 5000,
}: FluxReportProps) {
  const [fluxReport, setFluxReport] = useState<FluxReport | null>(null);
  const [expandedAnomalies, setExpandedAnomalies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFluxReport = async () => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/flux?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch flux report: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setFluxReport(data.report);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch flux report');
      }
    } catch (err) {
      console.error('[FluxReport] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load flux report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFluxReport();

    if (autoRefresh) {
      const interval = setInterval(fetchFluxReport, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [userId, autoRefresh, refreshInterval]);

  const formatCurrency = (value: number) => {
    return value.toFixed(2);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-forge-success';
    if (variance < 0) return 'text-forge-error';
    return 'text-slate-400';
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return '↑';
    if (variance < 0) return '↓';
    return '→';
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light mb-4">Flux Report</h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-accent" />
          <span className="ml-3 text-slate-400 text-sm">Loading flux report...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light mb-4">Flux Report</h2>
        <div className="p-4 bg-forge-error/10 border border-forge-error/30 rounded-md">
          <p className="text-xs sm:text-sm text-forge-error">{error}</p>
          <button
            onClick={fetchFluxReport}
            className="mt-2 text-xs sm:text-sm text-forge-error underline hover:text-forge-error/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!fluxReport) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light mb-4">Flux Report</h2>
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-slate-400 text-sm">No flux report available</p>
          <p className="text-slate-500 text-xs mt-1">
            Reports will appear here after transactions are completed
          </p>
        </div>
      </div>
    );
  }

  const hasHighSeverityAnomalies = fluxReport.anomalies.some(a => a.severity === 'high');

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-forge-light">Flux Report</h2>
          {hasHighSeverityAnomalies && (
            <span className="px-2 py-1 bg-forge-error/20 text-forge-error text-xs font-semibold rounded-full flex items-center gap-1 border border-forge-error/30 animate-pulse">
              🚨 Alert
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {formatTimestamp(fluxReport.timestamp)}
          </span>
          <button
            onClick={fetchFluxReport}
            className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Portfolio Values */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <label className="text-xs font-semibold text-slate-400 uppercase">Before Transaction</label>
          <p className="text-xl sm:text-2xl font-bold text-forge-light mt-1">
            {formatCurrency(fluxReport.portfolioValueBefore)} NEAR
          </p>
        </div>
        <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <label className="text-xs font-semibold text-slate-400 uppercase">After Transaction</label>
          <p className="text-xl sm:text-2xl font-bold text-forge-light mt-1">
            {formatCurrency(fluxReport.portfolioValueAfter)} NEAR
          </p>
        </div>
      </div>

      {/* Variance */}
      <div className="p-4 bg-gradient-to-r from-forge-primary/10 to-forge-secondary/10 rounded-lg border border-forge-primary/30 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-400 uppercase">Variance</label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`text-xl sm:text-2xl font-bold ${getVarianceColor(fluxReport.variance)}`}>
                {getVarianceIcon(fluxReport.variance)} {formatCurrency(Math.abs(fluxReport.variance))} NEAR
              </span>
              <span className={`text-base sm:text-lg font-semibold ${getVarianceColor(fluxReport.variance)}`}>
                ({fluxReport.variancePercent > 0 ? '+' : ''}{fluxReport.variancePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fluxReport.reconciled ? (
              <span className="px-3 py-1 bg-forge-success/20 text-forge-success text-xs font-semibold rounded-full border border-forge-success/30">
                ✓ Reconciled
              </span>
            ) : (
              <span className="px-3 py-1 bg-forge-warning/20 text-forge-warning text-xs font-semibold rounded-full border border-forge-warning/30">
                ⚠ Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">
          AI Analysis
        </label>
        <div className="p-4 bg-forge-accent/10 rounded-lg border border-forge-accent/30">
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {fluxReport.aiExplanation}
          </p>
        </div>
      </div>

      {/* Anomalies */}
      {fluxReport.anomalies.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-400 uppercase">
              Anomalies Detected ({fluxReport.anomalies.length})
            </label>
            <button
              onClick={() => setExpandedAnomalies(!expandedAnomalies)}
              className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 flex items-center gap-1"
            >
              {expandedAnomalies ? 'Collapse' : 'Expand'}
              <svg
                className={`w-4 h-4 transition-transform ${expandedAnomalies ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Anomaly Summary (always visible) */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['high', 'medium', 'low'].map((severity) => {
              const count = fluxReport.anomalies.filter(a => a.severity === severity).length;
              if (count === 0) return null;
              const colors = SEVERITY_COLORS[severity];
              return (
                <span
                  key={severity}
                  className={`px-3 py-1 ${colors.bg} ${colors.text} text-xs font-semibold rounded-full border ${colors.border}`}
                >
                  {colors.icon} {count} {severity}
                </span>
              );
            })}
          </div>

          {/* Anomaly Details (expandable) */}
          {expandedAnomalies && (
            <div className="space-y-2">
              {fluxReport.anomalies.map((anomaly, idx) => {
                const colors = SEVERITY_COLORS[anomaly.severity];
                return (
                  <div
                    key={idx}
                    className={`p-3 ${colors.bg} rounded-lg border ${colors.border}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{colors.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${colors.text} uppercase`}>
                            {anomaly.severity} Severity
                          </span>
                          <span className="text-xs text-gray-600">
                            {anomaly.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className={`text-xs sm:text-sm ${colors.text}`}>
                          {anomaly.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Transaction Link */}
      {fluxReport.transactionId && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={() => {
              // Navigate to transaction details or graph view
              window.location.href = `/graph?highlight=${fluxReport.transactionId}&type=Transaction`;
            }}
            className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 hover:underline flex items-center gap-1"
          >
            View Transaction Details
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
