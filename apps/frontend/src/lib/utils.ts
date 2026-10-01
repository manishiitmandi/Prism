/** Utility helpers */

export function getRiskColor(risk: string | null): string {
  switch (risk?.toUpperCase()) {
    case 'HIGH': return 'var(--risk-high)';
    case 'MEDIUM': return 'var(--risk-medium)';
    case 'LOW': return 'var(--risk-low)';
    default: return 'var(--text-muted)';
  }
}

export function getRiskBadgeClass(risk: string | null): string {
  switch (risk?.toUpperCase()) {
    case 'HIGH': return 'badge badge-high';
    case 'MEDIUM': return 'badge badge-medium';
    case 'LOW': return 'badge badge-low';
    default: return 'badge badge-neutral';
  }
}

export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'QUEUED': return 'var(--status-queued)';
    case 'CLONING': return 'var(--status-parsing)';
    case 'PARSING': return 'var(--status-parsing)';
    case 'ANALYZING': return 'var(--status-analyzing)';
    case 'RETRIEVING': return 'var(--status-analyzing)';
    case 'AI_ANALYSIS': return 'var(--accent-secondary)';
    case 'COMPLETED': return 'var(--status-completed)';
    case 'FAILED': return 'var(--status-failed)';
    default: return 'var(--text-muted)';
  }
}

export function getStatusLabel(status: string): string {
  switch (status.toUpperCase()) {
    case 'QUEUED': return 'Queued';
    case 'CLONING': return 'Fetching PR';
    case 'PARSING': return 'Parsing Code';
    case 'ANALYZING': return 'Impact Analysis';
    case 'RETRIEVING': return 'Building Evidence';
    case 'AI_ANALYSIS': return 'AI Analysis';
    case 'COMPLETED': return 'Completed';
    case 'FAILED': return 'Failed';
    default: return status;
  }
}

export function isTerminalStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export function getLanguageColor(lang: string | null): string {
  switch (lang?.toLowerCase()) {
    case 'python': return '#3776ab';
    case 'javascript': return '#f7df1e';
    case 'typescript': return '#3178c6';
    case 'go': return '#00add8';
    case 'java': return '#ed8b00';
    case 'rust': return '#dea584';
    case 'ruby': return '#cc342d';
    default: return 'var(--text-muted)';
  }
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return 'just now';
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
  return `${Math.floor(diffSecs / 86400)}d ago`;
}

export function getNodeKindIcon(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'function': return 'ƒ';
    case 'method': return 'm';
    case 'class': return 'C';
    case 'file': return '📄';
    case 'test': return '✓';
    default: return '◆';
  }
}

export function truncatePath(path: string, maxLength = 40): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return `...${path.slice(-maxLength)}`;
  return `.../${parts.slice(-2).join('/')}`;
}
