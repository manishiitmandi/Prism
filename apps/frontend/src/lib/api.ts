/** API client for PRism backend */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_V1 = `${API_BASE}/api/v1`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_V1}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Repository {
  id: string;
  github_id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  description: string | null;
  language: string | null;
  private: boolean;
  created_at: string;
  updated_at: string;
}

export interface PullRequest {
  number: number;
  title: string;
  author: string;
  state: string;
  base_branch: string;
  head_branch: string;
  additions: number;
  deletions: number;
  changed_files: number;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface RiskFactor {
  title: string;
  description: string;
  evidence: string[];
}

export interface AffectedComponent {
  component: string;
  reason: string;
  evidence: string[];
}

export interface RecommendedTest {
  test_name: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ChangedFile {
  path: string;
  language: string | null;
  status: string;
  added_lines: number;
  removed_lines: number;
  changed_symbols: string[];
}

export interface DependencyMetrics {
  direct_dependents: number;
  transitive_dependents: number;
  affected_modules: number;
  affected_tests: number;
  public_api_changed: boolean;
  database_changed: boolean;
  config_changed: boolean;
  auth_changed: boolean;
  payment_changed: boolean;
  tests_changed: boolean;
  tests_absent: boolean;
}

export interface GraphNode {
  id: string;
  kind: string;
  file_path: string;
  language?: string;
  is_test?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RelevantCodeChunk {
  file: string;
  symbol: string;
  code: string;
  start_line: number;
  end_line: number;
  language?: string | null;
  provenance: 'hybrid' | 'static_graph' | 'semantic_search' | string;
  similarity?: number | null;
  relevance_score?: number | null;
  is_test?: boolean;
}

export interface RetrievedChunk {
  file_path?: string;
  symbol_name?: string;
  start_line?: number;
  end_line?: number;
  content: string;
  similarity?: number;
  score?: number;
  language?: string;
  chunk_type?: string;
  is_test?: boolean;
  provenance?: string;
}

export interface AnalysisEvidence {
  pr?: {
    number: number;
    title: string;
    author: string;
    additions: number;
    deletions: number;
    head_branch?: string;
    base_branch?: string;
    html_url?: string;
  };
  repository?: {
    owner: string;
    name: string;
    full_name: string;
  };
  changed_files?: ChangedFile[];
  changed_symbols?: string[];
  affected_components?: AffectedComponent[];
  dependency_metrics?: DependencyMetrics;
  related_tests?: string[];
  missing_test_candidates?: string[];
  relevant_code?: RelevantCodeChunk[];
  retrieved_evidence?: {
    source_chunks?: RetrievedChunk[];
    test_chunks?: RetrievedChunk[];
    queries_used?: string[];
  };
  static_evidence?: {
    changed_files?: ChangedFile[];
    changed_symbols?: string[];
    affected_components?: AffectedComponent[];
    dependency_metrics?: DependencyMetrics;
    related_tests?: string[];
    missing_test_candidates?: string[];
  };
  [key: string]: unknown;
}

export interface Analysis {
  id: string;
  pull_request_id: string;
  status: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  summary: string | null;
  error_message: string | null;
  changed_files_data: ChangedFile[] | null;
  changed_symbols: string[] | null;
  affected_components: AffectedComponent[] | null;
  risk_factors: RiskFactor[] | null;
  recommended_tests: RecommendedTest[] | null;
  edge_cases: string[] | null;
  dependency_metrics: DependencyMetrics | null;
  related_tests: string[] | null;
  evidence: AnalysisEvidence | null;
  graph_data: GraphData | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisStatus {
  id: string;
  status: string;
  risk_level: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export const api = {
  // Repositories
  async listRepositories(): Promise<Repository[]> {
    return request<Repository[]>('/repositories');
  },

  async createRepository(owner: string, name: string): Promise<Repository> {
    return request<Repository>('/repositories', {
      method: 'POST',
      body: JSON.stringify({ owner, name }),
    });
  },

  async getRepository(id: string): Promise<Repository> {
    return request<Repository>(`/repositories/${id}`);
  },

  async listPullRequests(repoId: string): Promise<PullRequest[]> {
    return request<PullRequest[]>(`/repositories/${repoId}/pull-requests`);
  },

  // Analyses
  async listAnalyses(params?: { limit?: number; repositoryId?: string }): Promise<Analysis[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.repositoryId) query.set('repository_id', params.repositoryId);
    const qStr = query.toString();
    return request<Analysis[]>(`/analyses${qStr ? `?${qStr}` : ''}`);
  },

  async triggerAnalysis(repoId: string, prNumber: number): Promise<AnalysisStatus> {
    return request<AnalysisStatus>(
      `/repositories/${repoId}/pull-requests/${prNumber}/analyze`,
      { method: 'POST' }
    );
  },

  async getAnalysis(analysisId: string): Promise<Analysis> {
    return request<Analysis>(`/analyses/${analysisId}`);
  },

  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
    return request<AnalysisStatus>(`/analyses/${analysisId}/status`);
  },

  // Health
  async health(): Promise<{ status: string; version: string }> {
    return request<{ status: string; version: string }>('/health');
  },
};
