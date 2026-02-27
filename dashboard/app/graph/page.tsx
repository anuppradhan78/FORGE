'use client';

import { useSearchParams } from 'next/navigation';
import InteractiveGraphView from '@/components/InteractiveGraphView';

export default function GraphPage() {
  const searchParams = useSearchParams();
  const highlightNodeId = searchParams.get('highlight');
  const highlightNodeType = searchParams.get('type');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Neo4j Graph Visualization
          </h1>
          <p className="text-gray-600">
            Interactive visualization of the FORGE governance graph with decision provenance tracking
          </p>
          {highlightNodeId && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                Highlighting {highlightNodeType || 'node'}: <span className="font-mono">{highlightNodeId}</span>
              </p>
            </div>
          )}
        </div>

        <InteractiveGraphView
          width={1200}
          height={800}
          showControls={true}
          highlightNodeId={highlightNodeId || undefined}
        />

        <div className="mt-8 bg-white border border-gray-300 rounded-lg p-6">
          <h2 className="font-bold text-xl mb-4">Features</h2>
          <ul className="space-y-2 text-gray-700">
            <li>✅ <strong>Force-directed graph layout</strong> - Nodes automatically position themselves</li>
            <li>✅ <strong>Color-coded node types</strong> - User (Blue), Decision (Green), Policy (Amber), Transaction (Purple), Context (Pink)</li>
            <li>✅ <strong>Interactive controls</strong> - Drag nodes, zoom, and pan</li>
            <li>✅ <strong>Click for details</strong> - Click any node to see its properties</li>
            <li>✅ <strong>Provenance highlighting</strong> - Click a Decision node to highlight its complete audit trail</li>
            <li>✅ <strong>Hover tooltips</strong> - Hover over nodes to see quick information</li>
            <li>✅ <strong>Edge labels</strong> - Relationship types shown on connections</li>
            <li>✅ <strong>Predefined queries</strong> - Quick access to common graph views</li>
            <li>✅ <strong>Custom Cypher queries</strong> - Execute your own queries</li>
            <li>✅ <strong>Performance optimized</strong> - Handles up to 50 nodes without lag</li>
          </ul>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="font-bold text-xl mb-4 text-blue-900">Usage Examples</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">View Recent Decisions</h3>
              <p className="text-blue-700 text-sm">
                Shows the last 20 decisions made by users, including the policies that were checked.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">Full Audit Trail</h3>
              <p className="text-blue-700 text-sm">
                Displays the complete governance graph with all relationships between users, decisions, policies, contexts, and transactions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">Transaction Flow</h3>
              <p className="text-blue-700 text-sm">
                Visualizes the flow from user decisions to transactions and their reconciliation reports.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-blue-800 mb-2">Custom Queries</h3>
              <p className="text-blue-700 text-sm mb-2">
                Execute custom Cypher queries to explore specific aspects of the graph. Examples:
              </p>
              <pre className="bg-blue-100 p-3 rounded text-xs overflow-x-auto">
{`// Find all decisions by a specific user
MATCH (u:User {id: 'demo-user-1'})-[:MADE_DECISION]->(d:Decision)
RETURN u, d LIMIT 10

// Find policy violations
MATCH (d:Decision)-[:CHECKED_POLICY]->(p:Policy)
WHERE d.verdict = 'reject'
RETURN d, p

// Find transaction chains
MATCH path = (u:User)-[:MADE_DECISION]->(d:Decision)-[:TRIGGERED_TX]->(t:Transaction)
RETURN path LIMIT 5`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
