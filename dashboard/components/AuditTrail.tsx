'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Decision types
export interface Decision {
  id: string;
  taskId: string;
  timestamp: string;
  type: string;
  verdict: 'approve' | 'reject' | 'escalate';
  reasoning: string;
  toolCallsJson?: string;
  inputDataHash?: string;
}

export interface AuditEntry {
  user: {
    id: string;
    name: string;
    portfolioValue?: number;
  };
  decision: Decision;
  policies: Array<{
    id: string;
    type: string;
    description: string;
    threshold: number;
  }>;
  contexts?: Array<{
    id: string;
    confidenceScore: number;
    verificationResult?: string;
  }>;
  transaction?: {
    id: string;
    hash: string;
    type: string;
    amount: number;
    status: string;
  };
}

interface AuditTrailProps {
  userId?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// Verdict color mapping
const VERDICT_COLORS: Record<string, string> = {
  approve: 'bg-forge-success/20 text-forge-success border-forge-success/30',
  reject: 'bg-forge-error/20 text-forge-error border-forge-error/30',
  escalate: 'bg-forge-warning/20 text-forge-warning border-forge-warning/30',
};

const VERDICT_LABELS: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  escalate: 'Escalated',
};

export default function AuditTrail({
  userId,
  limit = 10,
  autoRefresh = false,
  refreshInterval = 5000,
}: AuditTrailProps) {
  const router = useRouter();
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditTrail = async () => {
    try {
      const params = new URLSearchParams();
      
      if (userId) params.append('userId', userId);
      if (limit) params.append('limit', limit.toString());

      const response = await fetch(`/api/audit?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audit trail: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAuditEntries(data.entries || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch audit trail');
      }
    } catch (err) {
      console.error('[AuditTrail] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditTrail();

    if (autoRefresh) {
      const interval = setInterval(fetchAuditTrail, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [userId, limit, autoRefresh, refreshInterval]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const navigateToGraph = (nodeId: string, nodeType: string) => {
    // Navigate to graph view with highlighted node
    router.push(`/graph?highlight=${nodeId}&type=${nodeType}`);
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

  const parseToolCalls = (toolCallsJson?: string): any[] => {
    if (!toolCallsJson) return [];
    try {
      return JSON.parse(toolCallsJson);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light mb-4">Audit Trail</h2>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forge-accent" />
          <span className="ml-3 text-slate-400 text-sm">Loading audit trail...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light mb-4">Audit Trail</h2>
        <div className="p-4 bg-forge-error/10 border border-forge-error/30 rounded-md">
          <p className="text-xs sm:text-sm text-forge-error">{error}</p>
          <button
            onClick={fetchAuditTrail}
            className="mt-2 text-xs sm:text-sm text-forge-error underline hover:text-forge-error/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light">Audit Trail</h2>
        <button
          onClick={fetchAuditTrail}
          className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 flex items-center gap-1 transition-all hover:scale-105"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {auditEntries.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">📋</div>
          <p className="text-slate-400 text-sm">No audit entries found</p>
          <p className="text-slate-500 text-xs mt-1">
            Decisions will appear here as the agent processes tasks
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditEntries.map((entry) => {
            const isExpanded = expandedIds.has(entry.decision.id);
            const verdictColor = VERDICT_COLORS[entry.decision.verdict] || 'bg-slate-700 text-slate-300';
            const verdictLabel = VERDICT_LABELS[entry.decision.verdict] || entry.decision.verdict;
            const toolCalls = parseToolCalls(entry.decision.toolCallsJson);

            return (
              <div
                key={entry.decision.id}
                className="border border-slate-600 rounded-lg overflow-hidden hover:border-slate-500 transition-colors"
              >
                {/* Collapsed View */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-700/50"
                  onClick={() => toggleExpanded(entry.decision.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${verdictColor}`}>
                          {verdictLabel}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-slate-300">
                          {entry.decision.type}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTimestamp(entry.decision.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">
                        {entry.decision.reasoning}
                      </p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <svg
                        className={`w-5 h-5 text-slate-500 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded View */}
                {isExpanded && (
                  <div className="border-t border-slate-600 bg-slate-700/30 p-4 space-y-4">
                    {/* User Info */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">User</label>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToGraph(entry.user.id, 'User');
                          }}
                          className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 hover:underline"
                        >
                          {entry.user.name} ({entry.user.id})
                        </button>
                        {entry.user.portfolioValue && (
                          <span className="text-xs text-slate-500">
                            Portfolio: {entry.user.portfolioValue.toFixed(2)} NEAR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Task ID */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Task ID</label>
                      <p className="text-xs sm:text-sm text-slate-300 font-mono mt-1 break-all">{entry.decision.taskId}</p>
                    </div>

                    {/* Full Reasoning */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Reasoning</label>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1">{entry.decision.reasoning}</p>
                    </div>

                    {/* Policies Checked */}
                    {entry.policies.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Policies Checked ({entry.policies.length})
                        </label>
                        <div className="mt-2 space-y-2">
                          {entry.policies.map((policy) => (
                            <div
                              key={policy.id}
                              className="flex items-center justify-between p-2 bg-slate-700 rounded border border-slate-600"
                            >
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigateToGraph(policy.id, 'Policy');
                                  }}
                                  className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 hover:underline break-words"
                                >
                                  {policy.description}
                                </button>
                                <p className="text-xs text-slate-500 mt-1">
                                  Type: {policy.type} | Threshold: {policy.threshold}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Context Verification */}
                    {entry.contexts && entry.contexts.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Context Verification
                        </label>
                        <div className="mt-2 space-y-2">
                          {entry.contexts.map((context) => (
                            <div
                              key={context.id}
                              className="p-2 bg-slate-700 rounded border border-slate-600"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigateToGraph(context.id, 'Context');
                                }}
                                className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 hover:underline"
                              >
                                Context {context.id.slice(0, 8)}...
                              </button>
                              <p className="text-xs text-slate-500 mt-1">
                                Confidence: {(context.confidenceScore * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transaction */}
                    {entry.transaction && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Transaction</label>
                        <div className="mt-2 p-2 bg-slate-700 rounded border border-slate-600">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToGraph(entry.transaction!.id, 'Transaction');
                            }}
                            className="text-xs sm:text-sm text-forge-accent hover:text-forge-accent/80 hover:underline"
                          >
                            {entry.transaction.type.toUpperCase()} - {entry.transaction.amount} NEAR
                          </button>
                          <p className="text-xs text-slate-500 mt-1 break-all">
                            Hash: {entry.transaction.hash.slice(0, 16)}... | Status: {entry.transaction.status}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tool Calls */}
                    {toolCalls.length > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Tool Calls ({toolCalls.length})
                        </label>
                        <div className="mt-2 space-y-1">
                          {toolCalls.map((tool, idx) => (
                            <div key={idx} className="text-xs text-slate-400 font-mono">
                              {idx + 1}. {tool.name || tool.tool || 'unknown'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Input Data Hash */}
                    {entry.decision.inputDataHash && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">
                          Input Data Hash
                        </label>
                        <p className="text-xs text-slate-400 font-mono mt-1 break-all">
                          {entry.decision.inputDataHash}
                        </p>
                      </div>
                    )}

                    {/* View in Graph Button */}
                    <div className="pt-2 border-t border-slate-600">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToGraph(entry.decision.id, 'Decision');
                        }}
                        className="w-full py-2 px-4 bg-forge-primary text-white text-xs sm:text-sm font-medium rounded hover:bg-forge-primary/90 transition-colors"
                      >
                        View Full Provenance in Graph
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
