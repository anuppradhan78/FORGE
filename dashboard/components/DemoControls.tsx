'use client';

import { useState } from 'react';

interface DemoStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  error?: string;
}

interface DemoFlowProgress {
  currentStep: string;
  steps: DemoStep[];
  totalDuration: number;
  isRunning: boolean;
}

export default function DemoControls() {
  const [isRunning, setIsRunning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [progress, setProgress] = useState<DemoFlowProgress>({
    currentStep: '',
    steps: [
      { name: 'voice', status: 'pending' },
      { name: 'scout', status: 'pending' },
      { name: 'verify', status: 'pending' },
      { name: 'govern', status: 'pending' },
      { name: 'execute', status: 'pending' }
    ],
    totalDuration: 0,
    isRunning: false
  });

  const runDemoFlow = async (scenario: 'buy-nft' | 'policy-reject' | 'risk-reject' = 'buy-nft') => {
    setIsRunning(true);
    setCurrentScenario(scenario);
    setError(null);
    setResult(null);
    
    // Reset progress
    setProgress({
      currentStep: 'voice',
      steps: [
        { name: 'voice', status: 'running' },
        { name: 'scout', status: 'pending' },
        { name: 'verify', status: 'pending' },
        { name: 'govern', status: 'pending' },
        { name: 'execute', status: 'pending' }
      ],
      totalDuration: 0,
      isRunning: true
    });

    const startTime = Date.now();

    // Scenario-specific voice commands
    const voiceCommands = {
      'buy-nft': 'Scout NEAR NFTs under 50 NEAR and buy the best one if risk is low',
      'policy-reject': 'Buy an NFT for 150 NEAR immediately',
      'risk-reject': 'Buy this NFT from suspicious-seller.near for 5 NEAR'
    };

    try {
      const response = await fetch('/api/demo/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voiceCommand: voiceCommands[scenario],
          userId: 'demo-user-alice',
          scenario
        })
      });

      if (!response.ok) {
        throw new Error(`Demo flow failed: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Update progress based on tool calls
      const updatedSteps = updateStepsFromToolCalls(data.toolCalls);
      
      setProgress({
        currentStep: 'complete',
        steps: updatedSteps,
        totalDuration: duration,
        isRunning: false
      });

      setResult(data);
    } catch (err) {
      const duration = Date.now() - startTime;
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      setProgress(prev => ({
        ...prev,
        steps: prev.steps.map(step => 
          step.status === 'running' ? { ...step, status: 'error' as const } : step
        ),
        totalDuration: duration,
        isRunning: false
      }));
    } finally {
      setIsRunning(false);
      setCurrentScenario(null);
    }
  };

  const resetDemoState = async () => {
    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch('/api/demo/reset', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Reset failed: ${response.statusText}`);
      }

      // Clear local state
      setResult(null);
      setProgress({
        currentStep: '',
        steps: [
          { name: 'voice', status: 'pending' },
          { name: 'scout', status: 'pending' },
          { name: 'verify', status: 'pending' },
          { name: 'govern', status: 'pending' },
          { name: 'execute', status: 'pending' }
        ],
        totalDuration: 0,
        isRunning: false
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsResetting(false);
    }
  };

  const updateStepsFromToolCalls = (toolCalls: any[]): DemoStep[] => {
    const stepMap: Record<string, DemoStep> = {
      voice: { name: 'voice', status: 'success' },
      scout: { name: 'scout', status: 'pending' },
      verify: { name: 'verify', status: 'pending' },
      govern: { name: 'govern', status: 'pending' },
      execute: { name: 'execute', status: 'pending' }
    };

    // Map tool calls to steps
    for (const toolCall of toolCalls) {
      if (toolCall.toolName.includes('voice') || toolCall.toolName.includes('modulate')) {
        stepMap.voice = {
          name: 'voice',
          status: toolCall.success ? 'success' : 'error',
          duration: toolCall.duration,
          error: toolCall.error
        };
      } else if (toolCall.toolName.includes('tavily') || toolCall.toolName.includes('yutori') || toolCall.toolName.includes('scout')) {
        stepMap.scout = {
          name: 'scout',
          status: toolCall.success ? 'success' : 'error',
          duration: toolCall.duration,
          error: toolCall.error
        };
      } else if (toolCall.toolName.includes('senso') || toolCall.toolName.includes('verify')) {
        stepMap.verify = {
          name: 'verify',
          status: toolCall.success ? 'success' : 'error',
          duration: toolCall.duration,
          error: toolCall.error
        };
      } else if (toolCall.toolName.includes('neo4j') || toolCall.toolName.includes('policy') || toolCall.toolName.includes('govern')) {
        stepMap.govern = {
          name: 'govern',
          status: toolCall.success ? 'success' : 'error',
          duration: toolCall.duration,
          error: toolCall.error
        };
      } else if (toolCall.toolName.includes('wallet') || toolCall.toolName.includes('execute')) {
        stepMap.execute = {
          name: 'execute',
          status: toolCall.success ? 'success' : 'error',
          duration: toolCall.duration,
          error: toolCall.error
        };
      }
    }

    return Object.values(stepMap);
  };

  const getStepIcon = (status: DemoStep['status']) => {
    switch (status) {
      case 'pending':
        return '⏸️';
      case 'running':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
    }
  };

  const getStepColor = (status: DemoStep['status']) => {
    switch (status) {
      case 'pending':
        return 'text-slate-500';
      case 'running':
        return 'text-forge-accent animate-pulse';
      case 'success':
        return 'text-forge-success';
      case 'error':
        return 'text-forge-error';
    }
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-xl p-4 sm:p-6 border border-slate-700 card-hover">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 text-forge-light">Demo Controls</h2>
      <div className="mb-4 p-3 bg-slate-700/30 rounded-lg border border-slate-600/50">
        <p className="text-xs text-slate-400">
          <span className="text-forge-accent font-semibold">Note:</span> The backend supports real voice command processing via Modulate API. 
          These demos simulate voice input by providing pre-defined text commands.
        </p>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Demo Scenario Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => runDemoFlow('buy-nft')}
            disabled={isRunning || isResetting}
            className={`px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
              isRunning || isResetting
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-forge-primary text-white hover:bg-forge-primary/90 shadow-lg hover:shadow-xl'
            }`}
          >
            {isRunning && currentScenario === 'buy-nft' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🎨</span>
                <span>Buy NFT</span>
              </span>
            )}
          </button>

          <button
            onClick={() => runDemoFlow('policy-reject')}
            disabled={isRunning || isResetting}
            className={`px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
              isRunning || isResetting
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {isRunning && currentScenario === 'policy-reject' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🚫</span>
                <span>Policy Reject</span>
              </span>
            )}
          </button>

          <button
            onClick={() => runDemoFlow('risk-reject')}
            disabled={isRunning || isResetting}
            className={`px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
              isRunning || isResetting
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-yellow-600 text-white hover:bg-yellow-700 shadow-lg hover:shadow-xl'
            }`}
          >
            {isRunning && currentScenario === 'risk-reject' ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>⚠️</span>
                <span>Risk Reject</span>
              </span>
            )}
          </button>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetDemoState}
          disabled={isRunning || isResetting}
          className={`px-4 py-3 rounded-lg font-semibold transition-all text-sm ${
            isRunning || isResetting
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-forge-error text-white hover:bg-forge-error/90 shadow-lg hover:shadow-xl'
          }`}
        >
          {isResetting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Resetting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🔄</span>
              <span>Reset State</span>
            </span>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-forge-error/10 border border-forge-error/30 rounded-lg">
          <p className="text-forge-error font-semibold text-sm sm:text-base">Error:</p>
          <p className="text-forge-error/90 text-xs sm:text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Progress Display */}
      <div className="mb-6">
        <h3 className="text-base sm:text-lg font-semibold mb-3 text-forge-accent">Demo Progress</h3>
        
        <div className="space-y-3">
          {progress.steps.map((step) => (
            <div key={step.name} className="flex items-center gap-3">
              <span className={`text-xl sm:text-2xl ${getStepColor(step.status)}`}>
                {getStepIcon(step.status)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium capitalize text-sm sm:text-base ${getStepColor(step.status)} truncate`}>
                    {step.name}
                  </span>
                  {step.duration !== undefined && (
                    <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                      {formatDuration(step.duration)}
                    </span>
                  )}
                </div>
                {step.error && (
                  <p className="text-xs sm:text-sm text-forge-error mt-1">{step.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Total Duration */}
        {progress.totalDuration > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="font-semibold text-slate-300 text-sm sm:text-base">Total Duration:</span>
              <span className={`font-bold text-base sm:text-lg ${
                progress.totalDuration < 15000 ? 'text-forge-success' : 'text-forge-warning'
              }`}>
                {formatDuration(progress.totalDuration)}
                {progress.totalDuration < 15000 && ' ✓ Under 15s target'}
                {progress.totalDuration >= 15000 && ' ⚠️ Exceeds 15s target'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Result Display */}
      {result && (
        <div className="mt-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
          <h3 className="text-base sm:text-lg font-semibold mb-3 text-forge-accent">Demo Result</h3>
          
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-400">Status:</span>
              <span className={result.success ? 'text-forge-success font-semibold' : 'text-forge-error font-semibold'}>
                {result.success ? '✓ SUCCESS' : '✗ FAILED'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-400">Decision:</span>
              <span className="capitalize text-slate-300">{result.decision?.verdict}</span>
            </div>

            {result.sponsorValidation && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-400">All Sponsors Invoked:</span>
                <span className={result.sponsorValidation.allSponsorsInvoked ? 'text-forge-success' : 'text-forge-warning'}>
                  {result.sponsorValidation.allSponsorsInvoked ? 'Yes ✓' : 'No'}
                </span>
              </div>
            )}

            {result.graphValidation && (
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-400">Nodes Created:</span>
                <span className={result.graphValidation.minimumMet ? 'text-forge-success' : 'text-forge-warning'}>
                  {result.graphValidation.nodesCreated} {result.graphValidation.minimumMet ? '✓' : '(< 5 required)'}
                </span>
              </div>
            )}

            {result.decision?.reasoning && (
              <div className="mt-3 pt-3 border-t border-slate-600">
                <p className="font-medium mb-1 text-slate-400">Reasoning:</p>
                <p className="text-slate-300 text-xs sm:text-sm">{result.decision.reasoning}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
