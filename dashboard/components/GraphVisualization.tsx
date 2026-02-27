'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

import { GraphNode, GraphEdge, GraphData, NODE_COLORS } from '../types/graph';

interface GraphVisualizationProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  highlightPath?: string[]; // Array of node IDs to highlight
}

const NODE_RADIUS = 20;
const LINK_DISTANCE = 150;
const CHARGE_STRENGTH = -300;

export default function GraphVisualization({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  highlightPath = [],
}: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    
    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Create arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .enter().append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', NODE_RADIUS + 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(data.nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(data.edges)
        .id((d) => d.id)
        .distance(LINK_DISTANCE))
      .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(NODE_RADIUS + 10));

    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.edges)
      .enter().append('line')
      .attr('stroke', (d) => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightPath.includes(sourceId) && highlightPath.includes(targetId);
        return isHighlighted ? '#F59E0B' : '#999';
      })
      .attr('stroke-opacity', (d) => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightPath.includes(sourceId) && highlightPath.includes(targetId);
        return isHighlighted ? 0.8 : 0.3;
      })
      .attr('stroke-width', (d) => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const isHighlighted = highlightPath.includes(sourceId) && highlightPath.includes(targetId);
        return isHighlighted ? 3 : 2;
      })
      .attr('marker-end', 'url(#arrowhead)');

    // Create link labels
    const linkLabel = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(data.edges)
      .enter().append('text')
      .attr('font-size', 10)
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text((d) => d.type);

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Add circles to nodes
    node.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => NODE_COLORS[d.type])
      .attr('stroke', (d) => highlightPath.includes(d.id) ? '#F59E0B' : '#fff')
      .attr('stroke-width', (d) => highlightPath.includes(d.id) ? 4 : 2)
      .attr('opacity', (d) => highlightPath.length === 0 || highlightPath.includes(d.id) ? 1 : 0.3);

    // Add labels to nodes
    node.append('text')
      .attr('dy', NODE_RADIUS + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('fill', '#333')
      .text((d) => d.label);

    // Add type badges
    node.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .text((d) => d.type.charAt(0));

    // Node interaction handlers
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedNode(d);
      if (onNodeClick) {
        onNodeClick(d);
      }
    });

    node.on('mouseenter', (event, d) => {
      setHoveredNode(d);
    });

    node.on('mouseleave', () => {
      setHoveredNode(null);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      linkLabel
        .attr('x', (d) => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', (d) => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragStarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragEnded(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, width, height, onNodeClick, highlightPath]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-300 rounded-lg bg-white"
      />
      
      {/* Tooltip for hovered node */}
      {hoveredNode && (
        <div className="absolute top-4 left-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-xs z-10">
          <h3 className="font-bold text-lg mb-2">{hoveredNode.label}</h3>
          <p className="text-sm text-gray-600 mb-2">Type: {hoveredNode.type}</p>
          <div className="text-xs">
            {Object.entries(hoveredNode.properties).slice(0, 5).map(([key, value]) => (
              <div key={key} className="mb-1">
                <span className="font-semibold">{key}:</span>{' '}
                <span className="text-gray-700">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
        <h4 className="font-bold text-sm mb-2">Node Types</h4>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 mb-1">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs">{type}</span>
          </div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs text-gray-600">
        <p>🖱️ Drag nodes to reposition</p>
        <p>🔍 Scroll to zoom</p>
        <p>👆 Click nodes for details</p>
      </div>
    </div>
  );
}
