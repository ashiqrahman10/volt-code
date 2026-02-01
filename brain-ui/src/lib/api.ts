/**
 * API Client for Volt Backend
 * Provides typed fetch functions for all backend endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
}

// ============== Health ==============

export interface HealthResponse {
    status: string;
    gateway_connected: boolean;
    timestamp: string;
}

export async function getHealth(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/api/health');
}

// ============== Incidents ==============

export interface IncidentsResponse {
    incidents: any[];
    total: number;
}

export async function getIncidents(limit: number = 50): Promise<IncidentsResponse> {
    return apiFetch<IncidentsResponse>(`/api/incidents?limit=${limit}`);
}

export async function getIncident(id: string): Promise<any> {
    return apiFetch<any>(`/api/incidents/${id}`);
}

// ============== Pending Approvals ==============

export interface PendingResponse {
    pending: any[];
    count: number;
}

export async function getPending(): Promise<PendingResponse> {
    return apiFetch<PendingResponse>('/api/pending');
}

// ============== Actions ==============

export interface ApprovalResponse {
    success: boolean;
    message: string;
    action_result?: any;
}

export async function approveIncident(incidentId: string): Promise<ApprovalResponse> {
    return apiFetch<ApprovalResponse>('/api/approve', {
        method: 'POST',
        body: JSON.stringify({ incident_id: incidentId }),
    });
}

export async function rejectIncident(incidentId: string): Promise<ApprovalResponse> {
    return apiFetch<ApprovalResponse>('/api/reject', {
        method: 'POST',
        body: JSON.stringify({ incident_id: incidentId }),
    });
}

// ============== Scans ==============

export interface ScanResponse {
    detected: number;
    reports: any[];
}

export async function triggerScan(namespace?: string): Promise<ScanResponse> {
    const params = namespace ? `?namespace=${namespace}` : '';
    return apiFetch<ScanResponse>(`/api/scan${params}`, { method: 'POST' });
}

export interface MLScanResponse {
    anomalies_detected: number;
    results: Array<{
        anomaly: any;
        llm_analysis: any;
    }>;
}

export async function triggerMLScan(namespace?: string): Promise<MLScanResponse> {
    const params = namespace ? `?namespace=${namespace}` : '';
    return apiFetch<MLScanResponse>(`/api/ml-scan${params}`, { method: 'POST' });
}

// ============== Cluster Metrics ==============

export interface ClusterMetrics {
    cpu: { usage: number; capacity: number };
    memory: { usage: number; capacity: number };
    pods: { running: number; pending: number; failed: number; total: number };
    nodes: { ready: number; total: number };
}

export async function getClusterMetrics(): Promise<ClusterMetrics> {
    return apiFetch<ClusterMetrics>('/api/cluster/metrics');
}

// ============== Audit Log ==============

export interface AuditEntry {
    id: string;
    timestamp: string;
    action: string;
    actor: 'system' | 'human' | 'gateway';
    target: string;
    details: string;
    result: 'success' | 'failure';
    metadata?: Record<string, any>;
}

export interface AuditResponse {
    entries: AuditEntry[];
    total: number;
}

export async function getAuditLog(limit: number = 100): Promise<AuditResponse> {
    return apiFetch<AuditResponse>(`/api/audit?limit=${limit}`);
}

// ============== Telemetry ==============

export interface LogEntry {
    timestamp: string;
    level: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    pod: string;
    namespace: string;
    container?: string;
}

export interface LogsResponse {
    logs: LogEntry[];
    total: number;
}

export async function getTelemetryLogs(options: {
    namespace?: string;
    pod?: string;
    limit?: number;
} = {}): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (options.namespace) params.set('namespace', options.namespace);
    if (options.pod) params.set('pod', options.pod);
    if (options.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    return apiFetch<LogsResponse>(`/api/telemetry/logs${query ? `?${query}` : ''}`);
}

export interface KubernetesEvent {
    timestamp: string;
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    object: string;
    namespace: string;
    count: number;
}

export interface EventsResponse {
    events: KubernetesEvent[];
    total: number;
}

export async function getTelemetryEvents(options: {
    namespace?: string;
    limit?: number;
} = {}): Promise<EventsResponse> {
    const params = new URLSearchParams();
    if (options.namespace) params.set('namespace', options.namespace);
    if (options.limit) params.set('limit', String(options.limit));

    const query = params.toString();
    return apiFetch<EventsResponse>(`/api/telemetry/events${query ? `?${query}` : ''}`);
}

// ============== System Status ==============

export interface SystemStatus {
    gateway: {
        connected: boolean;
        status: string;
        url: string;
        cluster: string;
        namespace: string;
        version: string;
        uptime: number;
        cpu: number;
        memory: number;
        lastHeartbeat: string;
    };
    brain: {
        status: string;
        uptime: number;
        incidentsProcessed: number;
        pendingApprovals: number;
        avgAnalysisTime?: number;
    };
    tools: Array<{
        name: string;
        category: string;
        status: 'operational' | 'degraded' | 'down';
        lastCalled: string;
        callCount: number;
        avgResponseTime: number;
    }>;
    prometheus: {
        status: string;
        endpoint: string;
        version: string;
        scrapeInterval: number;
        dataRetention: string;
        activeTargets: number;
        healthyTargets: number;
    };
    kubernetes: {
        status: string;
        version: string;
        nodes: {
            total: number;
            ready: number;
        };
        namespaces: number;
        apiServer: string;
        rbacEnabled: boolean;
    };
    mlService: {
        status: string;
        provider: string;
        model: string;
    };
    cluster: {
        name: string;
        version: string;
    };
}

export async function getSystemStatus(): Promise<SystemStatus> {
    return apiFetch<SystemStatus>('/api/system/status');
}

// ============== Issues ==============

export interface IssuesResponse {
    issues: any[];
    total: number;
    counts: {
        open: number;
        fixing: number;
        resolved: number;
        needs_attention: number;
    };
}

export interface IssueExecuteResponse {
    success: boolean;
    message: string;
    issue: any;
}

export async function getIssues(): Promise<IssuesResponse> {
    return apiFetch<IssuesResponse>('/api/issues');
}

export async function getIssue(id: string): Promise<any> {
    return apiFetch<any>(`/api/issues/${id}`);
}

export async function createIssue(incidentId: string): Promise<any> {
    return apiFetch<any>('/api/issues', {
        method: 'POST',
        body: JSON.stringify({ incident_id: incidentId }),
    });
}

export async function executeRemediation(issueId: string): Promise<IssueExecuteResponse> {
    return apiFetch<IssueExecuteResponse>(`/api/issues/${issueId}/execute`, {
        method: 'POST',
    });
}

export async function retryRemediation(issueId: string): Promise<IssueExecuteResponse> {
    return apiFetch<IssueExecuteResponse>(`/api/issues/${issueId}/retry`, {
        method: 'POST',
    });
}
