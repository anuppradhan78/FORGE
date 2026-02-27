/**
 * Type definitions for Neo4j graph visualization
 */

export type NodeType = 
  | 'User' 
  | 'Decision' 
  | 'Policy' 
  | 'Transaction' 
  | 'Context' 
  | 'FluxReport' 
  | 'Collection' 
  | 'Asset';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  properties: Record<string, any>;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphResponse {
  success: boolean;
  data: GraphData;
  nodeCount: number;
  edgeCount: number;
  error?: string;
  details?: string;
}

export interface Neo4jNode {
  identity: any;
  labels: string[];
  properties: Record<string, any>;
}

export interface Neo4jRelationship {
  identity: any;
  type: string;
  start: any;
  end: any;
  properties: Record<string, any>;
}

export interface Neo4jRecord {
  keys: string[];
  get: (key: string) => any;
}

/**
 * Predefined query names
 */
export enum PredefinedQuery {
  FULL_AUDIT = 'full-audit',
  USER_POLICIES = 'user-policies',
  RECENT_DECISIONS = 'recent-decisions',
  TRANSACTION_FLOW = 'transaction-flow',
  POLICY_VIOLATIONS = 'policy-violations',
}

/**
 * Node color mapping
 */
export const NODE_COLORS: Record<NodeType, string> = {
  User: '#3B82F6',        // Blue
  Decision: '#10B981',    // Green
  Policy: '#F59E0B',      // Amber
  Transaction: '#8B5CF6', // Purple
  Context: '#EC4899',     // Pink
  FluxReport: '#06B6D4',  // Cyan
  Collection: '#84CC16',  // Lime
  Asset: '#F97316',       // Orange
};

/**
 * Graph visualization configuration
 */
export interface GraphConfig {
  width: number;
  height: number;
  nodeRadius: number;
  linkDistance: number;
  chargeStrength: number;
  enableZoom: boolean;
  enableDrag: boolean;
  showLabels: boolean;
  showLegend: boolean;
  showControls: boolean;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  width: 800,
  height: 600,
  nodeRadius: 20,
  linkDistance: 150,
  chargeStrength: -300,
  enableZoom: true,
  enableDrag: true,
  showLabels: true,
  showLegend: true,
  showControls: true,
};
