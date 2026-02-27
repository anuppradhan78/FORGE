import { Router, Request, Response } from 'express';
import { executeAgentWorkflow } from '../services/AgentService';
import { globalAuditLogger } from '../services/AgentAuditLogger';
import { globalErrorHandler } from '../services/AgentErrorHandler';
import { globalStatusTracker } from '../services/AgentStatusTracker';

const router = Router();

// POST /api/agent/execute - Execute agent workflow
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { voiceCommand, userId = 'demo-user-alice' } = req.body;

    if (!voiceCommand) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'voiceCommand is required'
      });
    }

    console.log('[Agent] Executing workflow for user:', userId);
    console.log('[Agent] Voice command:', voiceCommand);

    const decision = await executeAgentWorkflow(voiceCommand, userId);

    res.json({
      success: decision.decision === 'approve',
      decision: decision.decision,
      reasoning: decision.reasoning,
      taskId: decision.taskId,
      toolCalls: decision.toolCalls,
      governanceChecks: decision.governanceChecks,
      outcome: decision.outcome,
      timestamp: decision.timestamp
    });
  } catch (error) {
    console.error('[Agent] Workflow execution failed:', error);
    res.status(500).json({
      error: 'Agent Execution Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/agent/audit/:userId - Get audit trail for user
router.get('/audit/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '50', startDate, endDate, verdict } = req.query;

    const auditTrail = await globalAuditLogger.queryAuditTrail({
      userId,
      limit: parseInt(limit as string),
      startDate: startDate as string,
      endDate: endDate as string,
      verdict: verdict as string
    });

    res.json({
      userId,
      entries: auditTrail,
      count: auditTrail.length
    });
  } catch (error) {
    console.error('[Agent] Audit trail query failed:', error);
    res.status(500).json({
      error: 'Audit Trail Query Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/agent/audit/decision/:decisionId - Get decision provenance
router.get('/audit/decision/:decisionId', async (req: Request, res: Response) => {
  try {
    const { decisionId } = req.params;

    const provenance = await globalAuditLogger.getDecisionProvenance(decisionId);

    if (!provenance) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Decision not found: ${decisionId}`
      });
    }

    res.json(provenance);
  } catch (error) {
    console.error('[Agent] Provenance query failed:', error);
    res.status(500).json({
      error: 'Provenance Query Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/agent/stats/:userId? - Get audit statistics
router.get('/stats/:userId?', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await globalAuditLogger.getAuditStats(userId);

    res.json({
      userId: userId || 'all',
      stats
    });
  } catch (error) {
    console.error('[Agent] Stats query failed:', error);
    res.status(500).json({
      error: 'Stats Query Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/agent/errors - Get error log
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const errorLog = globalErrorHandler.getErrorLog();
    const errorStats = globalErrorHandler.getErrorStats();

    res.json({
      errors: errorLog,
      stats: errorStats
    });
  } catch (error) {
    console.error('[Agent] Error log query failed:', error);
    res.status(500).json({
      error: 'Error Log Query Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/agent/errors/clear - Clear error log
router.post('/errors/clear', async (req: Request, res: Response) => {
  try {
    globalErrorHandler.clearErrorLog();

    res.json({
      success: true,
      message: 'Error log cleared'
    });
  } catch (error) {
    console.error('[Agent] Error log clear failed:', error);
    res.status(500).json({
      error: 'Error Log Clear Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/agent/status - Server-Sent Events stream for real-time status updates
router.get('/status', (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Disable response buffering
  res.flushHeaders();

  console.log('[Agent] SSE client connected');

  // Register client with status tracker
  globalStatusTracker.addClient(res);

  // Keep connection alive with heartbeat
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('[Agent] SSE client disconnected');
  });
});

// GET /api/agent/status/current - Get current status (non-streaming)
router.get('/status/current', async (req: Request, res: Response) => {
  try {
    const status = globalStatusTracker.getCurrentStatus();
    res.json(status);
  } catch (error) {
    console.error('[Agent] Status query failed:', error);
    res.status(500).json({
      error: 'Status Query Failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
