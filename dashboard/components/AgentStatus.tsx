'use client';

import { useEffect, useState } from 'react';

// Agent status types
export type AgentState = 'idle' | 'scouting' | 'verifying' | 'deciding' | 'executing';

export interface TaskDetails {
  taskId: string;
  command: string;
  progress: number; // 0-100
  currentStep: string;
}

export interface AgentStatusData {
  status: AgentState;
  currentTask: TaskDetails | null;
  timestamp: string;
}

// Color mapping for status badges
const STATUS_COLORS: Record<AgentState, string> = {
  idle: 'bg-gray-500',
  scouting: 'bg-blue-500',
  verifying: 'bg-yellow-500',
  deciding: 'bg-purple-500',
  executing: 'bg-green-500'
};

const STATUS_LABELS: Record<AgentState, string> = {
  idle: 'Idle',
  scouting: 'Scouting Deals',
  verifying: 'Verifying Context',
  deciding: 'Checking Policies',
  executing: 'Executing Transaction'
};

export default function AgentStatus() {
  const [agentStatus, setAgentStatus] = useState<AgentStatusData>({
    status: 'idle',
    currentTask: null,
    timestamp: new Date().toISOString()
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        // Connect to SSE endpoint
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        eventSource = new EventSource(`${apiUrl}/api/agent/status`);

        eventSource.onopen = () => {
          console.log('[AgentStatus] SSE connection opened');
          setIsConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data: AgentStatusData = JSON.parse(event.data);
            console.log('[AgentStatus] Received update:', data);
            setAgentStatus(data);
          } catch (err) {
            console.error('[AgentStatus] Failed to parse SSE data:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('[AgentStatus] SSE error:', err);
          setIsConnected(false);
          setError('Connection lost. Reconnecting...');
          
          // Close and reconnect after 5 seconds
          eventSource?.close();
          reconnectTimeout = setTimeout(() => {
            console.log('[AgentStatus] Attempting to reconnect...');
            connect();
          }, 5000);
        };
      } catch (err) {
        console.error('[AgentStatus] Failed to connect:', err);
        setError('Failed to connect to agent status stream');
        setIsConnected(false);
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const statusColor = STATUS_COLORS[agentStatus.status];
  const statusLabel = STATUS_LABELS[agentStatus.status];

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-forge-light">Agent Status</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-forge-success' : 'bg-forge-error'} animate-pulse`} />
          <span className="text-xs sm:text-sm text-slate-400 hidden sm:inline">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-forge-error/10 border border-forge-error/30 rounded-md">
          <p className="text-xs sm:text-sm text-forge-error">{error}</p>
        </div>
      )}

      {/* Status Badge */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
          <div className={`${statusColor} text-white px-3 sm:px-4 py-2 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg`}>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {statusLabel}
          </div>
          <span className="text-xs text-slate-500">
            {new Date(agentStatus.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Current Task Details */}
      {agentStatus.currentTask ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Task ID</label>
            <p className="text-xs sm:text-sm text-slate-300 font-mono break-all">{agentStatus.currentTask.taskId}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Command</label>
            <p className="text-xs sm:text-sm text-slate-300">{agentStatus.currentTask.command}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Current Step</label>
            <p className="text-xs sm:text-sm text-slate-300">{agentStatus.currentTask.currentStep}</p>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-500 uppercase">Progress</label>
              <span className="text-xs sm:text-sm font-semibold text-forge-accent">
                {agentStatus.currentTask.progress}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`${statusColor} h-2.5 rounded-full transition-all duration-500 shadow-lg`}
                style={{ width: `${agentStatus.currentTask.progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">💤</div>
          <p className="text-slate-400 text-sm">No active task</p>
          <p className="text-slate-500 text-xs mt-1">Agent is waiting for commands</p>
        </div>
      )}
    </div>
  );
}
