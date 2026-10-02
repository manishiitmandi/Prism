'use client';

import { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GraphData, GraphNode, GraphEdge } from '@/lib/api';
import { Network, Search, Filter, CheckCircle2, AlertTriangle, Layers, FileCode, Code2, ArrowRight, X } from 'lucide-react';

interface ImpactGraphProps {
  graphData: GraphData | null;
  changedSymbols?: string[] | null;
}

// Custom Node Component
function CustomSymbolNode({ data }: { data: any }) {
  const isChanged = data.isChanged;
  const isTest = data.isTest;
  const isSelected = data.isSelected;

  let borderColor = 'var(--border)';
  let bg = 'var(--bg-card)';
  let badgeColor = 'var(--text-muted)';
  let badgeBg = 'var(--bg-elevated)';

  if (isChanged) {
    borderColor = 'var(--risk-high)';
    bg = 'linear-gradient(135deg, rgba(255, 77, 109, 0.12) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--risk-high)';
    badgeBg = 'rgba(255, 77, 109, 0.15)';
  } else if (isTest) {
    borderColor = 'var(--risk-low)';
    bg = 'linear-gradient(135deg, rgba(38, 222, 129, 0.1) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--risk-low)';
    badgeBg = 'rgba(38, 222, 129, 0.15)';
  } else {
    borderColor = isSelected ? 'var(--accent-secondary)' : 'var(--border)';
    bg = 'linear-gradient(135deg, rgba(108, 99, 255, 0.08) 0%, var(--bg-card) 100%)';
    badgeColor = 'var(--accent-secondary)';
    badgeBg = 'rgba(108, 99, 255, 0.15)';
  }

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        background: bg,
        border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : borderColor}`,
        boxShadow: isSelected
          ? '0 0 16px rgba(108, 99, 255, 0.4)'
          : isChanged
          ? '0 0 12px rgba(255, 77, 109, 0.2)'
          : 'var(--shadow-card)',
        minWidth: 200,
        maxWidth: 280,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: borderColor, width: 8, height: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '1px 6px',
            borderRadius: 4,
            background: badgeBg,
            color: badgeColor,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {isChanged ? 'CHANGED' : isTest ? 'TEST' : data.kind || 'SYMBOL'}
        </span>

        {data.language && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            {data.language}
          </span>
        )}
      </div>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
          lineHeight: 1.3,
        }}
        title={data.label}
      >
        {data.label}
      </div>

      {data.filePath && (
        <div
          style={{
            fontSize: '0.68rem',
            color: 'var(--text-muted)',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.filePath}
        >
          {data.filePath.split('/').pop()}
          {data.startLine ? `:${data.startLine}` : ''}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = {
  symbolNode: CustomSymbolNode,
};

export default function ImpactGraph({ graphData, changedSymbols }: ImpactGraphProps) {
  const [filterType, setFilterType] = useState<'all' | 'changed' | 'callers' | 'tests'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const rawNodes = graphData?.nodes || [];
  const rawEdges = graphData?.edges || [];

  const changedSet = useMemo(() => {
    const set = new Set<string>();
    if (changedSymbols) {
      changedSymbols.forEach(s => set.add(s.toLowerCase()));
    }
    return set;
  }, [changedSymbols]);

  // Compute Layout Positions
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!rawNodes || rawNodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    // Partition into ranks:
    // Rank 0: Changed symbols (or root nodes)
    // Rank 1: Dependencies / Callers
    // Rank 2: Tests
    const rank0: GraphNode[] = [];
    const rank1: GraphNode[] = [];
    const rank2: GraphNode[] = [];

    rawNodes.forEach(node => {
      const isChanged = changedSet.has(node.id.toLowerCase()) || node.kind === 'changed_symbol';
      const isTest = node.is_test || node.kind === 'test' || node.id.toLowerCase().includes('test');

      if (isChanged) {
        rank0.push(node);
      } else if (isTest) {
        rank2.push(node);
      } else {
        rank1.push(node);
      }
    });

    // If rank0 is empty (e.g. names mismatched), put first few nodes into rank 0
    if (rank0.length === 0 && rank1.length > 0) {
      rank0.push(rank1.shift()!);
    }

    const ranks = [rank0, rank1, rank2];
    const nodes: Node[] = [];

    const X_GAP = 320;
    const Y_GAP = 95;

    ranks.forEach((group, rankIdx) => {
      group.forEach((node, nodeIdx) => {
        const isChanged = changedSet.has(node.id.toLowerCase()) || node.kind === 'changed_symbol';
        const isTest = node.is_test || node.kind === 'test' || node.id.toLowerCase().includes('test');

        // Center vertically
        const yOffset = (nodeIdx - group.length / 2) * Y_GAP;

        nodes.push({
          id: node.id,
          type: 'symbolNode',
          position: {
            x: rankIdx * X_GAP + 50,
            y: yOffset + 240,
          },
          data: {
            label: node.id,
            kind: node.kind,
            filePath: node.file_path,
            language: node.language,
            startLine: (node as any).start_line,
            endLine: (node as any).end_line,
            isChanged,
            isTest,
            rawNode: node,
            isSelected: selectedNode?.id === node.id,
          },
        });
      });
    });

    const edges: Edge[] = rawEdges.map((edge, idx) => {
      const isCall = edge.kind?.toLowerCase().includes('call');
      const isContains = edge.kind?.toLowerCase().includes('contain');

      return {
        id: `e-${idx}-${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: isCall,
        label: edge.kind,
        labelStyle: {
          fill: 'var(--text-muted)',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
        },
        labelBgStyle: {
          fill: 'var(--bg-card)',
          fillOpacity: 0.85,
        },
        style: {
          stroke: isCall ? 'var(--accent-secondary)' : isContains ? 'var(--text-muted)' : 'var(--border)',
          strokeWidth: isCall ? 2 : 1.2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isCall ? 'var(--accent-secondary)' : 'var(--text-muted)',
          width: 14,
          height: 14,
        },
      };
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [rawNodes, rawEdges, changedSet, selectedNode]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update selection in node state when selectedNode changes
  const filteredNodes = useMemo(() => {
    return initialNodes.map(node => {
      const isSelected = selectedNode?.id === node.id;
      const matchesSearch = !searchQuery.trim() || node.id.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      if (filterType === 'changed') matchesFilter = !!node.data.isChanged;
      if (filterType === 'tests') matchesFilter = !!node.data.isTest;
      if (filterType === 'callers') matchesFilter = !node.data.isChanged && !node.data.isTest;

      const visible = matchesSearch && matchesFilter;

      return {
        ...node,
        hidden: !visible,
        data: {
          ...node.data,
          isSelected,
        },
      };
    });
  }, [initialNodes, selectedNode, searchQuery, filterType]);

  const onNodeClick = useCallback((_e: any, node: Node) => {
    setSelectedNode(node.data.rawNode || null);
  }, []);

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
    changed: rawNodes.filter(n => changedSet.has(n.id.toLowerCase()) || n.kind === 'changed_symbol').length,
    tests: rawNodes.filter(n => n.is_test || n.kind === 'test' || n.id.toLowerCase().includes('test')).length,
    callers: rawNodes.filter(n => !changedSet.has(n.id.toLowerCase()) && !n.is_test && n.kind !== 'test').length,
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 580,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Graph Toolbar */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Network size={16} style={{ color: 'var(--accent-secondary)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Call & Impact Graph
            </span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border)' }}>
            {(['all', 'changed', 'callers', 'tests'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                style={{
                  border: 'none',
                  background: filterType === tab ? 'var(--bg-elevated)' : 'transparent',
                  color: filterType === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{tab}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({counts[tab]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', width: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Find symbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                fontSize: '0.75rem',
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

      {/* React Flow Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background color="var(--border-subtle)" gap={20} size={1} />
          <Controls position="top-right" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <MiniMap
            nodeColor={(node: any) => {
              if (node.data?.isChanged) return 'var(--risk-high)';
              if (node.data?.isTest) return 'var(--risk-low)';
              return 'var(--accent-secondary)';
            }}
            maskColor="rgba(10, 11, 15, 0.7)"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              height: 100,
              width: 140,
            }}
            position="bottom-left"
          />
        </ReactFlow>

        {/* Selected Node Drawer / Info Card */}
        {selectedNode && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              width: 340,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              boxShadow: 'var(--shadow-elevated)',
              zIndex: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Code2 size={14} style={{ color: 'var(--accent-secondary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Symbol Details
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>

            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 6,
                wordBreak: 'break-all',
              }}
            >
              {selectedNode.id}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem', marginBottom: 8 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Kind: </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{selectedNode.kind}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Language: </span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{selectedNode.language || 'Unknown'}</span>
              </div>
            </div>

            {selectedNode.file_path && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>
                <span style={{ color: 'var(--text-secondary)' }}>File: </span>
                {selectedNode.file_path}
                {(selectedNode as any).start_line ? ` (L${(selectedNode as any).start_line}-${(selectedNode as any).end_line})` : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
