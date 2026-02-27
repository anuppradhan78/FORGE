'use client';

import React, { useState, useCallback } from 'react';
import GraphVisualization from './GraphVisualization';
import { useGraphData, PREDEFINED_QUERIES } from '../lib/useGraphData';
import { GraphNode, GraphData } from '../types/graph';

interface InteractiveGraphViewProps {
  predefinedQuery?: string;
  width?: number;
  height?: number;
  showControls?: boolean;
  highlightNodeId?: string;
}

export default function InteractiveGraphView({
  predefinedQuery = PREDEFINED_QUERIES.RECENT_DECISIONS,
  width = 1000,
  height = 700,
  showControls = true,
  highlightNodeId,
}: InteractiveGraphViewProps) {
  const { data, loading, error, refetch, executeQuery } = useGraphData({
    predefined: predefinedQuery,
    autoFetch: true,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [showQueryInput, setShowQueryInput] = useState(false);

  /**
   * Auto-highlight node from URL parameter
   */
  React.useEffect(() => {
    if (highlightNodeId && data) {
      const node = data.nodes.find((n) => n.id === highlightNodeId);
      if (node) {
        handleNodeClick(node);
      }
    }
  }, [highlightNodeId, data]);

  /**
   * Handle node click - show details and highlight provenance path
   */
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);

    // If it's a Decision node, highlight the provenance path
    if (node.type === 'Decision' && data) {
      const path = findProvenancePath(node.id, data);
      setHighlightedPath(path);
    } else {
      setHighlightedPath([node.id]);
    }
  }, [data]);

  /**
   * Find the provenance path for a decision node
   * Returns array of node IDs in the path: User -> Decision -> Policies -> Context -> Transaction
   */
  const findProvenancePath = (decisionId: string, graphData: any): string[] => {
    const path: string[] = [];
    const visited = new Set<string>();

    // Find all connected nodes using BFS
    const queue: string[] = [decisionId];
    visited.add(decisionId);
    path.push(decisionId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // Find all edges connected to this node
      graphData.edges.forEach((edge: any) => {
        if (edge.source === currentId && !visited.has(edge.target)) {
          visited.add(edge.target);
          path.push(edge.target);
          queue.push(edge.target);
        } else if (edge.target === currentId && !visited.has(edge.source)) {
          visited.add(edge.source);
          path.push(edge.source);
          queue.push(edge.source);
        }
      });
    }

    return path;
  };

  /**
   * Clear selection and highlighting
   */
  const clearSelection = () => {
    setSelectedNode(null);
    setHighlightedPath([]);
  };

  /**
   * Execute custom Cypher query
   */
  const handleCustomQuery = async () => {
    if (!customQuery.trim()) return;

    try {
      await executeQuery(customQuery);
      setShowQueryInput(false);
      clearSelection();
    } catch (err) {
      console.error('Query execution failed:', err);
    }
  };

  /**
   * Load predefined query
   */
  const loadPredefinedQuery = async (queryName: string) => {
    const { data: newData } = await useGraphData({
      predefined: queryName,
      autoFetch: false,
    });
    clearSelection();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading graph data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-bold mb-2">Error Loading Graph</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-yellow-800 font-bold mb-2">No Data Available</h3>
        <p className="text-yellow-600 mb-4">
          No graph data found. Make sure Neo4j is running and contains data.
        </p>
        <button
          onClick={refetch}
          className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      {showControls && (
        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Graph Controls</h3>
            <div className="flex gap-2">
              <button
                onClick={refetch}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
              <button
                onClick={() => setShowQueryInput(!showQueryInput)}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                {showQueryInput ? '✕ Close' : '⚡ Custom Query'}
              </button>
              {selectedNode && (
                <button
                  onClick={clearSelection}
                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          {/* Predefined Queries */}
          <div>
            <label className="block text-sm font-semibold mb-2">Predefined Queries:</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PREDEFINED_QUERIES).map(([key, value]) => (
                <button
                  key={value}
                  onClick={() => window.location.href = `?predefined=${value}`}
                  className={`px-3 py-1 rounded text-sm ${
                    predefinedQuery === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {key.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Query Input */}
          {showQueryInput && (
            <div>
              <label className="block text-sm font-semibold mb-2">Custom Cypher Query:</label>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="MATCH (n) RETURN n LIMIT 25"
                className="w-full border border-gray-300 rounded p-2 font-mono text-sm"
                rows={4}
              />
              <button
                onClick={handleCustomQuery}
                className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Execute Query
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-sm text-gray-600">
            <span>📊 Nodes: {data.nodes.length}</span>
            <span>🔗 Edges: {data.edges.length}</span>
            {highlightedPath.length > 0 && (
              <span className="text-orange-600 font-semibold">
                ⭐ Highlighted: {highlightedPath.length} nodes
              </span>
            )}
          </div>
        </div>
      )}

      {/* Graph Visualization */}
      <div className="relative">
        <GraphVisualization
          data={data}
          width={width}
          height={height}
          onNodeClick={handleNodeClick}
          highlightPath={highlightedPath}
        />
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-bold text-xl mb-1">{selectedNode.label}</h3>
              <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={clearSelection}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm text-gray-600 mb-2">Properties:</h4>
              <div className="bg-gray-50 rounded p-3 space-y-2">
                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-semibold text-sm text-gray-700 w-1/3">{key}:</span>
                    <span className="text-sm text-gray-900 w-2/3 break-all">
                      {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedNode.type === 'Decision' && highlightedPath.length > 1 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-600 mb-2">
                  Decision Provenance Path:
                </h4>
                <div className="bg-orange-50 rounded p-3">
                  <p className="text-sm text-gray-700">
                    This decision is connected to {highlightedPath.length - 1} other nodes
                    in the governance graph, showing the complete audit trail.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {highlightedPath.map((nodeId) => {
                      const node = data.nodes.find((n) => n.id === nodeId);
                      return node ? (
                        <span
                          key={nodeId}
                          className="inline-block px-2 py-1 rounded text-xs bg-orange-200 text-orange-800"
                        >
                          {node.type}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
