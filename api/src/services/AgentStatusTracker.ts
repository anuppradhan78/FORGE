/**
 * Agent Status Tracker - Tracks real-time agent status for SSE streaming
 */

import { Response } from 'express';

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
  activeSponsor: string | null;
  recentSponsors: string[];
}

/**
 * Global agent status tracker with SSE support
 */
class AgentStatusTracker {
  private currentStatus: AgentStatusData;
  private clients: Set<Response>;
  private recentSponsors: Map<string, number>; // sponsor -> timestamp

  constructor() {
    this.currentStatus = {
      status: 'idle',
      currentTask: null,
      timestamp: new Date().toISOString(),
      activeSponsor: null,
      recentSponsors: []
    };
    this.clients = new Set();
    this.recentSponsors = new Map();
  }

  /**
   * Register a new SSE client
   */
  addClient(res: Response): void {
    this.clients.add(res);
    console.log(`[StatusTracker] Client connected. Total clients: ${this.clients.size}`);

    // Send current status immediately
    this.sendToClient(res, this.currentStatus);

    // Handle client disconnect
    res.on('close', () => {
      this.clients.delete(res);
      console.log(`[StatusTracker] Client disconnected. Total clients: ${this.clients.size}`);
    });
  }

  /**
   * Set active sponsor (currently executing)
   */
  setActiveSponsor(sponsor: string): void {
    this.currentStatus.activeSponsor = sponsor;
    // Mark sponsor as used (no expiration)
    this.recentSponsors.set(sponsor, Date.now());
    this.currentStatus.recentSponsors = Array.from(this.recentSponsors.keys());
    this.currentStatus.timestamp = new Date().toISOString();

    console.log(`[StatusTracker] Active sponsor: ${sponsor}`);

    // Broadcast to all connected clients
    this.broadcast(this.currentStatus);
  }

  /**
   * Clear active sponsor
   */
  clearActiveSponsor(): void {
    this.currentStatus.activeSponsor = null;
    // Keep the recentSponsors list intact
    this.currentStatus.recentSponsors = Array.from(this.recentSponsors.keys());
    this.currentStatus.timestamp = new Date().toISOString();

    // Broadcast to all connected clients
    this.broadcast(this.currentStatus);
  }

  /**
   * Reset all sponsors (called on explicit reset)
   */
  resetSponsors(): void {
    this.recentSponsors.clear();
    this.currentStatus.recentSponsors = [];
    this.currentStatus.activeSponsor = null;
    this.currentStatus.timestamp = new Date().toISOString();
    
    console.log('[StatusTracker] All sponsors reset');
    
    // Broadcast to all connected clients
    this.broadcast(this.currentStatus);
  }

  /**
   * Update recent sponsors list (sponsors used in last 3 seconds)
   */
  private updateRecentSponsorsList(): void {
    // Don't expire sponsors anymore - keep them until explicit reset
    this.currentStatus.recentSponsors = Array.from(this.recentSponsors.keys());
  }

  /**
   * Get recent sponsors (called in last 3 seconds)
   */
  getRecentSponsors(): string[] {
    this.updateRecentSponsorsList();
    return this.currentStatus.recentSponsors;
  }

  /**
   * Update agent status and broadcast to all clients
   */
  updateStatus(status: AgentState, currentTask: TaskDetails | null = null): void {
    this.currentStatus = {
      status,
      currentTask,
      timestamp: new Date().toISOString()
    };

    console.log(`[StatusTracker] Status updated: ${status}`, currentTask ? `Task: ${currentTask.taskId}` : '');

    // Broadcast to all connected clients
    this.broadcast(this.currentStatus);
  }

  /**
   * Update task progress
   */
  updateProgress(progress: number, currentStep: string): void {
    if (this.currentStatus.currentTask) {
      this.currentStatus.currentTask.progress = progress;
      this.currentStatus.currentTask.currentStep = currentStep;
      this.currentStatus.timestamp = new Date().toISOString();

      console.log(`[StatusTracker] Progress updated: ${progress}% - ${currentStep}`);

      // Broadcast to all connected clients
      this.broadcast(this.currentStatus);
    }
  }

  /**
   * Start a new task
   */
  startTask(taskId: string, command: string): void {
    // Clear previous demo's sponsors when starting a new demo
    this.recentSponsors.clear();
    this.currentStatus.recentSponsors = [];
    
    this.updateStatus('scouting', {
      taskId,
      command,
      progress: 0,
      currentStep: 'Initializing workflow'
    });
  }

  /**
   * Complete current task
   */
  completeTask(): void {
    this.updateStatus('idle', null);
    this.clearActiveSponsor();
    // Keep recent sponsors visible (don't clear them)
    // They will only be cleared on explicit reset
  }

  /**
   * Get current status
   */
  getCurrentStatus(): AgentStatusData {
    return { ...this.currentStatus };
  }

  /**
   * Broadcast status to all connected clients
   */
  private broadcast(data: AgentStatusData): void {
    const message = `data: ${JSON.stringify(data)}\n\n`;

    // Send to all clients and remove disconnected ones
    const disconnectedClients: Response[] = [];

    this.clients.forEach((client) => {
      try {
        client.write(message);
      } catch (error) {
        console.error('[StatusTracker] Failed to send to client:', error);
        disconnectedClients.push(client);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach((client) => {
      this.clients.delete(client);
    });
  }

  /**
   * Send status to a specific client
   */
  private sendToClient(client: Response, data: AgentStatusData): void {
    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      client.write(message);
    } catch (error) {
      console.error('[StatusTracker] Failed to send to client:', error);
      this.clients.delete(client);
    }
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Global singleton instance
export const globalStatusTracker = new AgentStatusTracker();
