'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { api, Analysis } from '@/lib/api';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import Breadcrumbs from '@/components/Breadcrumbs';
import AnalysisHeader from '@/components/analysis/AnalysisHeader';
import PipelineProgress from '@/components/analysis/PipelineProgress';
import ImpactGraph from '@/components/analysis/ImpactGraph';
import EvidenceViewer from '@/components/analysis/EvidenceViewer';
import RiskFactorsList from '@/components/analysis/RiskFactorsList';
import RecommendedTestsList from '@/components/analysis/RecommendedTestsList';
import DependencySignals from '@/components/analysis/DependencySignals';
import AffectedComponentsList from '@/components/analysis/AffectedComponentsList';
import { isTerminalStatus, getLanguageColor } from '@/lib/utils';
import {
  Layers,
  Network,
  Sparkles,
  FileCode,
  Terminal,
  Code2,
  FolderGit2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Database,
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AnalysisPage({ params }: Props) {
  const { id } = use(params);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'evidence' | 'files' | 'raw'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollAnalysis = useCallback(async () => {
    try {
      const data = await api.getAnalysis(id);
      setAnalysis(data);
      return data;
    } catch {
      return null;
    }
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function init() {
      const data = await pollAnalysis();
      setLoading(false);
      if (data && !isTerminalStatus(data.status)) {
        interval = setInterval(async () => {
          const updated = await pollAnalysis();
          if (updated && isTerminalStatus(updated.status)) {
            clearInterval(interval);
          }
        }, 2000);
      }
    }

    init();
    return () => clearInterval(interval);
  }, [pollAnalysis]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await pollAnalysis();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <main className="container" style={{ paddingTop: 32, paddingBottom: 64 }}>
          <div className="skeleton" style={{ height: 20, width: 240, marginBottom: 20 }} />
          <div className="card skeleton" style={{ height: 160, marginBottom: 24 }} />
          <div className="card skeleton" style={{ height: 80, marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
            <div className="card skeleton" style={{ height: 400 }} />
            <div className="card skeleton" style={{ height: 400 }} />
          </div>
        </main>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="page-wrapper">
        <NavBar />
        <main className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--risk-high)' }}>
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>Analysis Report Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
            The requested analysis record ({id}) could not be retrieved from the database.
          </p>
          <Link href="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
            ← Back to Command Center
          </Link>
        </main>
      </div>
    );
  }

  const repo = analysis.evidence?.repository;
  const pr = analysis.evidence?.pr;
  const isRunning = !isTerminalStatus(analysis.status);

  // Evidence data
  const relevantCode = analysis.evidence?.relevant_code || [];
  const retrievedEvidence = analysis.evidence?.retrieved_evidence || null;
  const missingTests = analysis.evidence?.missing_test_candidates || analysis.evidence?.static_evidence?.missing_test_candidates || [];
  const changedFiles = analysis.changed_files_data || analysis.evidence?.changed_files || [];
  const graphNodeCount = analysis.graph_data?.nodes?.length || 0;

  return (
    <div className="page-wrapper">
      <NavBar subtitle="PR Risk Intelligence Report" badge={analysis.risk_level || 'ANALYZING'} />

      <main className="container" style={{ paddingTop: 28, paddingBottom: 64, flex: 1 }}>
        {/* Navigation Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Breadcrumbs
            items={[
              { label: 'Repositories', href: '/dashboard#repositories' },
              ...(repo
                ? [{ label: repo.full_name || repo.name, href: `/repositories/${repo.name}` }]
                : []),
              { label: pr?.number ? `PR #${pr.number}` : `Analysis ${id.slice(0, 8)}` },
            ]}
          />

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
            title="Refresh analysis state"
          >
            <RefreshCw size={12} className={isRefreshing || isRunning ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* PR Identity & Analysis Header */}
        <AnalysisHeader analysis={analysis} />

        {/* Pipeline Execution Tracker */}
        <PipelineProgress status={analysis.status} />

        {/* View Navigation Tabs */}
        <div className="tabs-nav-bar">
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'overview' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'overview' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={14} />
            <span>Overview & Tests</span>
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'graph' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'graph' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'graph' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Network size={14} />
            <span>Impact Graph (DAG)</span>
            {graphNodeCount > 0 && (
              <span style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 10 }}>
                {graphNodeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('evidence')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'evidence' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'evidence' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'evidence' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={14} />
            <span>RAG Evidence Chunks</span>
            {relevantCode.length > 0 && (
              <span style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 10 }}>
                {relevantCode.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('files')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'files' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'files' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'files' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <FileCode size={14} />
            <span>Changed Files & AST Symbols</span>
            <span style={{ fontSize: '0.68rem', fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 10 }}>
              {changedFiles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'raw' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'raw' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'raw' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Terminal size={14} />
            <span>Evidence JSON</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 1. Full-Width Executive Summary Banner */}
            {analysis.summary && (
              <div
                className="card"
                style={{
                  padding: '20px 24px',
                  background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: 'var(--accent-glow)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-secondary)',
                    }}
                  >
                    <Sparkles size={15} />
                  </div>
                  <h2 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                    Executive AI Analysis Summary
                  </h2>
                </div>

                <p
                  style={{
                    fontSize: '0.925rem',
                    lineHeight: 1.65,
                    color: 'var(--text-primary)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {analysis.summary}
                </p>
              </div>
            )}

            {/* 2-Column Balanced Grid */}
            <div className="grid-cols-2-responsive">
              {/* Left Column: Risk Factors, Edge Cases & Affected Components */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <RiskFactorsList
                  riskFactors={analysis.risk_factors}
                  edgeCases={analysis.edge_cases}
                  showSummary={false}
                  showAffectedComponents={false}
                />

                <AffectedComponentsList affectedComponents={analysis.affected_components} />
              </div>

              {/* Right Column: Dependency Signals & Recommended Tests */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Dependency Metrics & Security Signals */}
                <DependencySignals metrics={analysis.dependency_metrics} />

                {/* 2. Recommended Tests & Uncovered Symbols Alert */}
                <RecommendedTestsList
                  recommendedTests={analysis.recommended_tests}
                  missingTestCandidates={missingTests}
                  relatedTests={analysis.related_tests}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IMPACT GRAPH */}
        {activeTab === 'graph' && (
          <div>
            <ImpactGraph
              graphData={analysis.graph_data}
              changedSymbols={analysis.changed_symbols}
            />
          </div>
        )}

        {/* TAB 3: RAG EVIDENCE CHUNKS */}
        {activeTab === 'evidence' && (
          <div>
            <EvidenceViewer
              relevantCode={relevantCode}
              retrievedEvidence={retrievedEvidence}
            />
          </div>
        )}

        {/* TAB 4: CHANGED FILES & SYMBOLS */}
        {activeTab === 'files' && (
          <div className="card" style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>
              Modified Files & AST Symbols ({changedFiles.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {changedFiles.map((file, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileCode size={16} style={{ color: getLanguageColor(file.language) }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {file.path}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>+{file.added_lines}</span>
                      <span style={{ color: 'var(--risk-high)', fontWeight: 600 }}>-{file.removed_lines}</span>
                      {file.language && (
                        <span style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          {file.language}
                        </span>
                      )}
                    </div>
                  </div>

                  {file.changed_symbols && file.changed_symbols.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Modified AST Symbols:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {file.changed_symbols.map((sym, sIdx) => (
                          <span
                            key={sIdx}
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-secondary)',
                            }}
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: RAW EVIDENCE JSON */}
        {activeTab === 'raw' && (
          <div className="card" style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Evidence Package JSON Inspector
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(analysis.evidence, null, 2))}
                className="btn btn-secondary btn-sm"
              >
                Copy JSON
              </button>
            </div>
            <pre
              style={{
                background: '#07080b',
                padding: 16,
                borderRadius: 8,
                fontSize: '0.75rem',
                overflowX: 'auto',
                maxHeight: 600,
                color: '#9ca3af',
              }}
            >
              {JSON.stringify(analysis.evidence, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
