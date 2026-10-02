'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from '@dagrejs/dagre';
import { GraphData, GraphNode, GraphEdge } from '@/lib/api';
import {
  Network,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileCode,
  Code2,
  ArrowRight,
  ArrowDown,
  X,
  Flame,
  Focus,
  Maximize2,
  SlidersHorizontal,
  ChevronRight,
  Eye,
} from 'lucide-react';

interface ImpactGraphProps {
  graphData: GraphData | null;
  changedSymbols?: string[] | null;
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 72;

// Custom Node Component
function CustomSymbolNode({ data }: { data: any }) {
  const isChanged = data.isChanged;
  const isTest = data.isTest;
  const isSelected = data.isSelected;
  const isHovered = data.isHovered;
  const isHighlighted = data.isHighlighted;
  const isDimmed = data.isDimmed;
  const rankdir = data.rankdir || 'LR';

  // Parse label into namespace and symbol name
  const rawId: string = data.label || '';
  let namespace = '';
  let symbolName = rawId;

  if (rawId.includes('.')) {
    const parts = rawId.split('.');
    symbolName = parts.pop() || rawId;
    namespace = parts.join('.') + '.';
  }

  let borderColor = 'var(--border)';
  let bg = 'var(--bg-card)';
  let badgeColor = 'var(--text-muted)';
  let badgeBg = 'var(--bg-elevated)';

  if (isChanged) {
    borderColor = 'var(--risk-high)';
    bg = 'linear-gradient(135deg, rgba(255, 77, 109, 0.15) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--risk-high)';
    badgeBg = 'rgba(255, 77, 109, 0.18)';
  } else if (isTest) {
    borderColor = 'var(--risk-low)';
    bg = 'linear-gradient(135deg, rgba(38, 222, 129, 0.12) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--risk-low)';
    badgeBg = 'rgba(38, 222, 129, 0.18)';
  } else if (isSelected || isHighlighted || isHovered) {
    borderColor = 'var(--accent-secondary)';
    bg = 'linear-gradient(135deg, rgba(108, 99, 255, 0.18) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--accent-secondary)';
    badgeBg = 'rgba(108, 99, 255, 0.2)';
  }

  const isVertical = rankdir === 'TB';
  const targetPos = isVertical ? Position.Top : Position.Left;
  const sourcePos = isVertical ? Position.Bottom : Position.Right;

  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        padding: '8px 12px',
        borderRadius: 8,
        background: bg,
        border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : isHighlighted || isHovered ? 'var(--accent-secondary)' : borderColor}`,
        boxShadow: isSelected
          ? '0 0 20px rgba(108, 99, 255, 0.5), 0 4px 12px rgba(0,0,0,0.5)'
          : isChanged
          ? '0 0 16px rgba(255, 77, 109, 0.3), 0 4px 12px rgba(0,0,0,0.4)'
          : isHighlighted || isHovered
          ? '0 0 14px rgba(167, 139, 250, 0.35)'
          : 'var(--shadow-card)',
        opacity: isDimmed ? 0.18 : 1,
        transition: 'opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        pointerEvents: 'all',
      }}
    >
      <Handle
        type="target"
        position={targetPos}
        style={{
          background: isHighlighted || isHovered ? 'var(--accent-secondary)' : borderColor,
          width: 8,
          height: 8,
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header: Badge + Language/Kind */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isChanged && <Flame size={11} style={{ color: 'var(--risk-high)' }} />}
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '1px 5px',
              borderRadius: 3,
              background: badgeBg,
              color: badgeColor,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {isChanged ? 'MODIFIED' : isTest ? 'TEST' : data.kind || 'SYMBOL'}
          </span>
        </div>

        {data.filePath && (
          <span
            style={{
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              maxWidth: 110,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={data.filePath}
          >
            {data.filePath.split('/').pop()}
            {data.startLine ? `:${data.startLine}` : ''}
          </span>
        )}
      </div>

      {/* Main Symbol Name with graceful truncate and namespace */}
      <div style={{ minWidth: 0, pointerEvents: 'none' }}>
        {namespace && (
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.1,
            }}
            title={rawId}
          >
            {namespace}
          </div>
        )}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            fontWeight: 700,
            color: isChanged ? '#ff94a5' : isTest ? '#4ade80' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
          }}
          title={rawId}
        >
          {symbolName}
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePos}
        style={{
          background: isHighlighted || isHovered ? 'var(--accent-secondary)' : borderColor,
          width: 8,
          height: 8,
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

const nodeTypes = {
  symbolNode: CustomSymbolNode,
};

function ImpactGraphInner({ graphData, changedSymbols }: ImpactGraphProps) {
  const [filterType, setFilterType] = useState<'all' | 'blast_radius' | 'changed' | 'callers' | 'tests'>('all');
  const [callsOnly, setCallsOnly] = useState(true);
  const [rankDir, setRankDir] = useState<'LR' | 'TB'>('LR');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const rawNodes = graphData?.nodes || [];
  const rawEdges = graphData?.edges || [];

  const changedSet = useMemo(() => {
    const set = new Set<string>();
    if (changedSymbols) {
      changedSymbols.forEach(s => set.add(s.toLowerCase()));
    }
    return set;
  }, [changedSymbols]);

  // Compute direct 1-hop neighbors of changed symbols
  const directNeighborSet = useMemo(() => {
    const set = new Set<string>();
    rawNodes.forEach(n => {
      if (changedSet.has(n.id.toLowerCase())) {
        set.add(n.id);
      }
    });

    rawEdges.forEach(e => {
      const srcChanged = changedSet.has(e.source.toLowerCase());
      const tgtChanged = changedSet.has(e.target.toLowerCase());
      if (srcChanged) set.add(e.target);
      if (tgtChanged) set.add(e.source);
    });

    return set;
  }, [rawNodes, rawEdges, changedSet]);

  // Filtered nodes and edges based on user options
  const { visibleNodes, visibleEdges } = useMemo(() => {
    let edges = rawEdges;
    if (callsOnly) {
      edges = edges.filter(e => {
        const k = e.kind?.toUpperCase();
        if (k === 'CALLS' || k === 'EXTENDS') return true;
        // Always preserve CONTAINS between changed symbols
        const isBetweenChanged =
          changedSet.has(e.source.toLowerCase()) && changedSet.has(e.target.toLowerCase());
        return isBetweenChanged;
      });
    }

    let nodes = rawNodes;
    if (filterType === 'blast_radius') {
      nodes = nodes.filter(n => directNeighborSet.has(n.id));
      const visibleIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    } else if (filterType === 'changed') {
      nodes = nodes.filter(n => changedSet.has(n.id.toLowerCase()) || n.kind === 'changed_symbol');
      const visibleIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    } else if (filterType === 'callers') {
      nodes = nodes.filter(n => !changedSet.has(n.id.toLowerCase()) && !n.is_test && n.kind !== 'test');
      const visibleIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    } else if (filterType === 'tests') {
      nodes = nodes.filter(n => n.is_test || n.kind === 'test' || n.id.toLowerCase().includes('test'));
      const visibleIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    }

    return { visibleNodes: nodes, visibleEdges: edges };
  }, [rawNodes, rawEdges, callsOnly, filterType, directNeighborSet, changedSet]);

  // Dagre Layout Calculation: runs ONLY when visible structure or direction changes!
  const nodePositions = useMemo(() => {
    if (visibleNodes.length === 0) return {};

    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: rankDir,
      nodesep: rankDir === 'LR' ? 45 : 60,
      ranksep: rankDir === 'LR' ? 140 : 100,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    visibleNodes.forEach(node => {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    visibleEdges.forEach(edge => {
      g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const positions: Record<string, { x: number; y: number }> = {};
    visibleNodes.forEach(node => {
      const pos = g.node(node.id) || { x: 0, y: 0 };
      positions[node.id] = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      };
    });

    return positions;
  }, [visibleNodes, visibleEdges, rankDir]);

  // Active focus element: hovered node or selected node
  const activeFocusId = hoveredNodeId || selectedNodeId;

  // Compute connected nodes and edges for activeFocusId
  const { connectedEdgeIds, connectedNodeIds, incomingNodeIds, outgoingNodeIds } = useMemo(() => {
    const cEdges = new Set<string>();
    const cNodes = new Set<string>();
    const inNodes = new Set<string>();
    const outNodes = new Set<string>();

    if (activeFocusId) {
      cNodes.add(activeFocusId);

      visibleEdges.forEach((e, idx) => {
        const edgeKey = `e-${e.source}-${e.target}-${idx}`;
        if (e.target === activeFocusId) {
          cEdges.add(edgeKey);
          cNodes.add(e.source);
          inNodes.add(e.source);
        } else if (e.source === activeFocusId) {
          cEdges.add(edgeKey);
          cNodes.add(e.target);
          outNodes.add(e.target);
        }
      });
    }

    return {
      connectedEdgeIds: cEdges,
      connectedNodeIds: cNodes,
      incomingNodeIds: inNodes,
      outgoingNodeIds: outNodes,
    };
  }, [activeFocusId, visibleEdges]);

  // Pure memoized nodes for React Flow: updates smoothly without remounting!
  const renderedNodes: Node[] = useMemo(() => {
    const hasFocus = Boolean(activeFocusId);

    return visibleNodes.map(node => {
      const pos = nodePositions[node.id] || { x: 0, y: 0 };
      const isChanged = changedSet.has(node.id.toLowerCase()) || node.kind === 'changed_symbol';
      const isTest = node.is_test || node.kind === 'test' || node.id.toLowerCase().includes('test');
      const isSelected = selectedNodeId === node.id;
      const isHovered = hoveredNodeId === node.id;
      const isConnected = connectedNodeIds.has(node.id);
      const isDimmed = hasFocus && !isConnected;

      const matchesSearch = !searchQuery.trim() || node.id.toLowerCase().includes(searchQuery.toLowerCase());

      return {
        id: node.id,
        type: 'symbolNode',
        position: pos,
        hidden: !matchesSearch,
        data: {
          label: node.id,
          kind: node.kind,
          filePath: node.file_path,
          language: node.language,
          startLine: (node as any).start_line,
          endLine: (node as any).end_line,
          isChanged,
          isTest,
          isSelected,
          isHovered,
          isHighlighted: isConnected && !isSelected,
          isDimmed,
          rankdir: rankDir,
          rawNode: node,
        },
      };
    });
  }, [
    visibleNodes,
    nodePositions,
    changedSet,
    selectedNodeId,
    hoveredNodeId,
    connectedNodeIds,
    activeFocusId,
    rankDir,
    searchQuery,
    filterType,
  ]);

  // Pure memoized edges for React Flow
  const renderedEdges: Edge[] = useMemo(() => {
    const hasFocus = Boolean(activeFocusId);

    return visibleEdges.map((edge, idx) => {
      const edgeKey = `e-${edge.source}-${edge.target}-${idx}`;
      const isConnected = connectedEdgeIds.has(edgeKey);
      const isOutgoing = edge.source === activeFocusId;
      const isIncoming = edge.target === activeFocusId;

      let strokeColor = 'rgba(100, 116, 139, 0.28)';
      let strokeWidth = 1.2;
      let animated = false;
      let opacity = hasFocus ? 0.08 : 1;
      let zIndex = 1;

      if (isConnected) {
        opacity = 1;
        zIndex = 10;
        animated = true;
        if (isOutgoing) {
          strokeColor = '#c084fc'; // Purple for outgoing (calls)
          strokeWidth = 2.5;
        } else if (isIncoming) {
          strokeColor = '#38bdf8'; // Sky blue for incoming (called by)
          strokeWidth = 2.5;
        }
      }

      return {
        id: edgeKey,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        animated,
        zIndex,
        label: isConnected ? edge.kind : undefined,
        labelStyle: {
          fill: isOutgoing ? '#c084fc' : '#38bdf8',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
        },
        labelBgStyle: {
          fill: 'var(--bg-secondary)',
          fillOpacity: 0.95,
          stroke: isOutgoing ? '#c084fc' : '#38bdf8',
          strokeWidth: 1,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        style: {
          stroke: strokeColor,
          strokeWidth,
          opacity,
          transition: 'stroke 0.15s, opacity 0.15s',
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: isConnected ? 16 : 10,
          height: isConnected ? 16 : 10,
        },
      };
    });
  }, [visibleEdges, connectedEdgeIds, activeFocusId]);

  // Click selection
  const onNodeClick = useCallback((_e: any, node: Node) => {
    setSelectedNodeId(prev => (prev === node.id ? null : node.id));
  }, []);

  // Debounced hover handlers: avoids rapid thrashing
  const onNodeMouseEnter = useCallback((_e: any, node: Node) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback((_e: any, node: Node) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNodeId(prev => (prev === node.id ? null : prev));
    }, 50);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
  }, []);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return rawNodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, rawNodes]);

  if (!rawNodes || rawNodes.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 40,
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--text-muted)',
          }}
        >
          <Network size={24} />
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
          No AST Graph Relationships
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto' }}>
          This Pull Request either modifies non-code documentation/configuration files or did not produce new inter-symbol dependency edges in the Tree-sitter static AST graph.
        </p>
      </div>
    );
  }

  const counts = {
    all: rawNodes.length,
    blast_radius: directNeighborSet.size,
    changed: rawNodes.filter(n => changedSet.has(n.id.toLowerCase()) || n.kind === 'changed_symbol').length,
    callers: rawNodes.filter(n => !changedSet.has(n.id.toLowerCase()) && !n.is_test && n.kind !== 'test').length,
    tests: rawNodes.filter(n => n.is_test || n.kind === 'test' || n.id.toLowerCase().includes('test')).length,
  };

  return (
    <div
      className="card react-flow-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 640,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Toolbar */}
      <div className="impact-graph-toolbar">
        {/* Left: Filter Pills */}
        <div className="impact-graph-filters">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Network size={15} style={{ color: 'var(--accent-secondary)' }} />
            <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Call & Impact Graph
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}>
            {(
              [
                { key: 'all', label: 'All Symbols', count: counts.all },
                { key: 'blast_radius', label: 'Blast Radius', count: counts.blast_radius },
                { key: 'changed', label: 'Changed Only', count: counts.changed },
                { key: 'callers', label: 'Callers', count: counts.callers },
                { key: 'tests', label: 'Tests', count: counts.tests },
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                style={{
                  border: 'none',
                  background: filterType === tab.key ? 'var(--bg-elevated)' : 'transparent',
                  color: filterType === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '4px 9px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.label}</span>
                <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Toggle: Calls Only vs All Edges */}
          <button
            onClick={() => setCallsOnly(prev => !prev)}
            style={{
              border: '1px solid var(--border)',
              background: callsOnly ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
              color: callsOnly ? '#38bdf8' : 'var(--text-muted)',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Hide CONTAINS structural edges and show only CALLS / invocation edges"
          >
            <span>{callsOnly ? 'Calls Only' : 'All Relationships'}</span>
          </button>
        </div>

        {/* Right: Direction + Search */}
        <div className="impact-graph-controls">
          {/* Orientation Toggle */}
          <button
            onClick={() => setRankDir(prev => (prev === 'LR' ? 'TB' : 'LR'))}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
            title="Toggle between Horizontal (LR) and Vertical (TB) layout"
          >
            {rankDir === 'LR' ? <ArrowRight size={12} /> : <ArrowDown size={12} />}
            <span>{rankDir === 'LR' ? 'Horizontal' : 'Vertical'}</span>
          </button>

          {/* Search */}
          <div className="impact-graph-search" style={{ position: 'relative', width: 170 }}>
            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Filter symbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 24px',
                fontSize: '0.72rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>
        </div>
      </div>

      {/* Path Legend Indicator */}
      <div
        style={{
          padding: '6px 16px',
          background: 'rgba(10, 11, 15, 0.85)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          zIndex: 9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-high)', boxShadow: '0 0 6px var(--risk-high)' }} />
            <span>Modified Symbol</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
            <span>Incoming Caller (Calls this)</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c084fc' }} />
            <span>Outgoing Dependency (Called by this)</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-low)' }} />
            <span>Related Test</span>
          </span>
        </div>

        <span style={{ fontStyle: 'italic', opacity: 0.8 }}>
          💡 Click any node to pin & inspect call paths
        </span>
      </div>

      {/* Informative banner when viewing Changed Only */}
      {filterType === 'changed' && (
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(255, 77, 109, 0.1)',
            borderBottom: '1px solid rgba(255, 77, 109, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: '#ff94a5',
            zIndex: 9,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Flame size={13} />
            <span>
              Showing the <strong>{counts.changed} modified AST symbols</strong> in this PR.
              The edge indicates that <code>_IncludedRouter</code> class contains the <code>_match</code> method.
            </span>
          </div>
          <button
            onClick={() => setFilterType('blast_radius')}
            style={{
              background: 'rgba(255, 77, 109, 0.2)',
              border: '1px solid rgba(255, 77, 109, 0.4)',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            View Blast Radius ({counts.blast_radius} nodes) →
          </button>
        </div>
      )}

      {/* React Flow Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={renderedNodes}
          edges={renderedEdges}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.15}
          maxZoom={1.6}
        >
          <Background color="var(--border-subtle)" gap={24} size={1} />
          <Controls position="top-right" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <MiniMap
            nodeColor={(node: any) => {
              if (node.data?.isChanged) return 'var(--risk-high)';
              if (node.data?.isTest) return 'var(--risk-low)';
              if (node.data?.isSelected || node.data?.isHighlighted || node.data?.isHovered) return 'var(--accent-secondary)';
              return 'var(--border)';
            }}
            maskColor="rgba(10, 11, 15, 0.75)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              height: 90,
              width: 130,
            }}
            position="bottom-left"
          />
        </ReactFlow>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="node-inspector-drawer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code2 size={15} style={{ color: 'var(--accent-secondary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                  Node Inspector
                </span>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                title="Close Inspector"
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 8,
                wordBreak: 'break-all',
                lineHeight: 1.3,
              }}
            >
              {selectedNode.id}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem', marginBottom: 10, background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 6 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Kind: </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'capitalize' }}>{selectedNode.kind}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Language: </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{selectedNode.language || 'Python'}</span>
              </div>
            </div>

            {selectedNode.file_path && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 12, wordBreak: 'break-all' }}>
                <span style={{ color: 'var(--text-secondary)' }}>File: </span>
                {selectedNode.file_path}
                {(selectedNode as any).start_line ? ` (L${(selectedNode as any).start_line}-${(selectedNode as any).end_line})` : ''}
              </div>
            )}

            {/* Direct Callers & Callees Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginBottom: 4 }}>
                  <span>Called By ({incomingNodeIds.size})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 60, overflowY: 'auto' }}>
                  {incomingNodeIds.size === 0 ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None (root caller)</span>
                  ) : (
                    Array.from(incomingNodeIds).map(id => (
                      <span
                        key={id}
                        onClick={() => setSelectedNodeId(id)}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          cursor: 'pointer',
                        }}
                        title={`Select ${id}`}
                      >
                        {id.split('.').pop()}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#c084fc', fontWeight: 600, marginBottom: 4 }}>
                  <span>Calls Into ({outgoingNodeIds.size})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 60, overflowY: 'auto' }}>
                  {outgoingNodeIds.size === 0 ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>None (leaf callee)</span>
                  ) : (
                    Array.from(outgoingNodeIds).map(id => (
                      <span
                        key={id}
                        onClick={() => setSelectedNodeId(id)}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(192, 132, 252, 0.1)',
                          border: '1px solid rgba(192, 132, 252, 0.25)',
                          color: '#c084fc',
                          cursor: 'pointer',
                        }}
                        title={`Select ${id}`}
                      >
                        {id.split('.').pop()}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ImpactGraph(props: ImpactGraphProps) {
  return (
    <ReactFlowProvider>
      <ImpactGraphInner {...props} />
    </ReactFlowProvider>
  );
}
