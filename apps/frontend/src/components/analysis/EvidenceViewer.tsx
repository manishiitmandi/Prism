'use client';

import { useState, useMemo } from 'react';
import { RelevantCodeChunk, RetrievedChunk } from '@/lib/api';
import {
  Sparkles,
  Layers,
  Database,
  Search,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileCode,
  Terminal,
  Activity,
} from 'lucide-react';

interface EvidenceViewerProps {
  relevantCode?: RelevantCodeChunk[] | null;
  retrievedEvidence?: {
    source_chunks?: RetrievedChunk[];
    test_chunks?: RetrievedChunk[];
    queries_used?: string[];
  } | null;
}

export default function EvidenceViewer({
  relevantCode,
  retrievedEvidence,
}: EvidenceViewerProps) {
  const [filter, setFilter] = useState<'all' | 'source' | 'test' | 'hybrid'>('all');
  const [search, setSearch] = useState('');
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Normalize chunks from relevant_code and retrieved_evidence
  const allChunks = useMemo(() => {
    const list: RelevantCodeChunk[] = [];

    if (relevantCode && relevantCode.length > 0) {
      list.push(...relevantCode);
    } else {
      // Fallback: build from retrieved_evidence if relevant_code not yet synthesized
      if (retrievedEvidence?.source_chunks) {
        retrievedEvidence.source_chunks.forEach(c => {
          list.push({
            file: c.file_path || 'unknown',
            symbol: c.symbol_name || c.file_path || 'chunk',
            code: c.content,
            start_line: c.start_line || 1,
            end_line: c.end_line || 1,
            language: c.language,
            provenance: c.provenance || 'semantic_search',
            similarity: c.similarity ?? c.score,
            is_test: false,
          });
        });
      }
      if (retrievedEvidence?.test_chunks) {
        retrievedEvidence.test_chunks.forEach(c => {
          list.push({
            file: c.file_path || 'unknown',
            symbol: c.symbol_name || c.file_path || 'test_chunk',
            code: c.content,
            start_line: c.start_line || 1,
            end_line: c.end_line || 1,
            language: c.language,
            provenance: c.provenance || 'semantic_search',
            similarity: c.similarity ?? c.score,
            is_test: true,
          });
        });
      }
    }

    return list;
  }, [relevantCode, retrievedEvidence]);

  const queries = retrievedEvidence?.queries_used || [];

  const filteredChunks = useMemo(() => {
    return allChunks.filter(chunk => {
      // Type filter
      if (filter === 'source' && chunk.is_test) return false;
      if (filter === 'test' && !chunk.is_test) return false;
      if (filter === 'hybrid' && chunk.provenance?.toLowerCase() !== 'hybrid') return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchFile = chunk.file.toLowerCase().includes(q);
        const matchSymbol = chunk.symbol.toLowerCase().includes(q);
        const matchCode = chunk.code.toLowerCase().includes(q);
        if (!matchFile && !matchSymbol && !matchCode) return false;
      }

      return true;
    });
  }, [allChunks, filter, search]);

  const toggleExpand = (idx: number) => {
    setExpandedIndices(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // ignore
    }
  };

  const counts = {
    all: allChunks.length,
    source: allChunks.filter(c => !c.is_test).length,
    test: allChunks.filter(c => c.is_test).length,
    hybrid: allChunks.filter(c => c.provenance?.toLowerCase() === 'hybrid').length,
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Top Banner / Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.2) 0%, rgba(167, 139, 250, 0.2) 100%)',
              border: '1px solid rgba(108, 99, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-secondary)',
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                RAG & Hybrid Retrieved Evidence
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: 'var(--accent-secondary)',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(108, 99, 255, 0.25)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                PGVECTOR + AST
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Context grounded from semantic vector embeddings and static AST callgraph reachability
            </p>
          </div>
        </div>

        {/* Count Pill */}
        <div
          style={{
            fontSize: '0.75rem',
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-secondary)',
            background: 'var(--bg-elevated)',
            padding: '4px 10px',
            borderRadius: 100,
            border: '1px solid var(--border)',
          }}
        >
          {allChunks.length} chunks indexed for reasoning
        </div>
      </div>

      {/* Semantic Search Queries Bar (if any) */}
      {queries.length > 0 && (
        <div
          style={{
            padding: '10px 20px',
            background: 'rgba(17, 19, 24, 0.8)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
            <Terminal size={13} />
            <span style={{ fontWeight: 600 }}>Embedding Search Queries:</span>
          </div>
          {queries.map((q, i) => (
            <span
              key={i}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem',
                color: 'var(--accent-secondary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                borderRadius: 4,
                maxWidth: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={q}
            >
              &quot;{q}&quot;
            </span>
          ))}
        </div>
      )}

      {/* Filters Toolbar */}
      <div
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(['all', 'source', 'test', 'hybrid'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                border: 'none',
                background: filter === tab ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: filter === tab ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {tab === 'all' ? 'All Evidence' : tab === 'source' ? 'Source Code' : tab === 'test' ? 'Test Files' : 'Hybrid Matches'}
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  background: filter === tab ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                  padding: '1px 4px',
                  borderRadius: 4,
                }}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search chunks or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px 4px 26px',
              fontSize: '0.75rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Chunks List */}
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filteredChunks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileCode size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.85rem' }}>No evidence chunks match current filters</p>
          </div>
        ) : (
          filteredChunks.map((chunk, idx) => {
            const isExpanded = !!expandedIndices[idx];
            const isCopied = copiedIndex === idx;
            const prov = (chunk.provenance || 'semantic_search').toLowerCase();

            // Provenance configuration
            let provBadge = {
              label: 'SEMANTIC SEARCH',
              color: 'var(--risk-low)',
              bg: 'rgba(38, 222, 129, 0.1)',
              border: 'rgba(38, 222, 129, 0.25)',
              icon: Sparkles,
            };

            if (prov.includes('hybrid')) {
              provBadge = {
                label: 'HYBRID FUSION',
                color: 'var(--accent-secondary)',
                bg: 'rgba(108, 99, 255, 0.12)',
                border: 'rgba(108, 99, 255, 0.3)',
                icon: Layers,
              };
            } else if (prov.includes('static') || prov.includes('graph')) {
              provBadge = {
                label: 'STATIC GRAPH',
                color: '#60a5fa',
                bg: 'rgba(96, 165, 250, 0.1)',
                border: 'rgba(96, 165, 250, 0.25)',
                icon: Activity,
              };
            }

            const ProvIcon = provBadge.icon;
            const lines = chunk.code ? chunk.code.split('\n') : [];
            const displayLines = isExpanded ? lines : lines.slice(0, 10);
            const hasMoreLines = lines.length > 10;

            return (
              <div
                key={idx}
                style={{
                  borderRadius: 8,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Chunk Meta Header */}
                <div
                  style={{
                    padding: '8px 14px',
                    background: 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Provenance Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: provBadge.color,
                        background: provBadge.bg,
                        border: `1px solid ${provBadge.border}`,
                      }}
                    >
                      <ProvIcon size={11} />
                      <span>[{provBadge.label}]</span>
                    </span>

                    {/* Similarity score */}
                    {chunk.similarity !== undefined && chunk.similarity !== null && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontFamily: "'JetBrains Mono', monospace",
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        sim = {(chunk.similarity * 100).toFixed(1)}%
                      </span>
                    )}

                    {/* File Path & Line Range */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {chunk.file}
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                        :L{chunk.start_line}-{chunk.end_line}
                      </span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => copyToClipboard(chunk.code, idx)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: isCopied ? 'var(--risk-low)' : 'var(--text-muted)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Copy code snippet"
                    >
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {hasMoreLines && (
                      <button
                        onClick={() => toggleExpand(idx)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span>{isExpanded ? 'Collapse' : `+${lines.length - 10} lines`}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Code Block with Line Numbers */}
                <div
                  style={{
                    position: 'relative',
                    maxHeight: isExpanded ? 'none' : 240,
                    overflowY: isExpanded ? 'visible' : 'auto',
                    background: '#07080b',
                    fontSize: '0.78rem',
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: '8px 0',
                  }}
                >
                  <div style={{ display: 'table', width: '100%' }}>
                    {displayLines.map((line, lIdx) => {
                      const lineNum = (chunk.start_line || 1) + lIdx;
                      return (
                        <div key={lIdx} style={{ display: 'table-row', lineHeight: 1.5 }}>
                          <span
                            style={{
                              display: 'table-cell',
                              width: 44,
                              textAlign: 'right',
                              paddingRight: 12,
                              color: 'var(--text-muted)',
                              userSelect: 'none',
                              opacity: 0.5,
                              fontSize: '0.72rem',
                            }}
                          >
                            {lineNum}
                          </span>
                          <span
                            style={{
                              display: 'table-cell',
                              color: '#d1d5db',
                              paddingRight: 16,
                              whiteSpace: 'pre',
                              wordBreak: 'normal',
                            }}
                          >
                            {line || ' '}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {hasMoreLines && !isExpanded && (
                    <div
                      onClick={() => toggleExpand(idx)}
                      style={{
                        padding: '6px 16px',
                        textAlign: 'center',
                        fontSize: '0.72rem',
                        color: 'var(--accent-secondary)',
                        background: 'linear-gradient(180deg, transparent 0%, #07080b 100%)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Show all {lines.length} lines ↓
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
