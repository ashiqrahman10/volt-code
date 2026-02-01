/**
 * React Hooks for Volt API
 * Provides data fetching with loading and error states
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import type {
    ClusterMetrics,
    AuditEntry,
    LogEntry,
    KubernetesEvent,
    SystemStatus,
    HealthResponse
} from './api';
import type { Incident } from '../types';

// ============== Generic Hook ==============

interface UseDataResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

function useData<T>(
    fetcher: () => Promise<T>,
    deps: any[] = []
): UseDataResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetcher();
            setData(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, deps);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
}

// ============== Health ==============

export function useHealth() {
    return useData<HealthResponse>(() => api.getHealth(), []);
}

// ============== Incidents ==============

export function useIncidents(limit: number = 50) {
    const { data, loading, error, refetch } = useData(
        () => api.getIncidents(limit),
        [limit]
    );

    return {
        incidents: data?.incidents as Incident[] || [],
        total: data?.total || 0,
        loading,
        error,
        refetch
    };
}

export function useIncident(id: string) {
    const { data, loading, error, refetch } = useData(
        () => api.getIncident(id),
        [id]
    );

    return {
        incident: data as Incident | null,
        loading,
        error,
        refetch
    };
}

// ============== Pending Approvals ==============

export function usePendingApprovals() {
    const { data, loading, error, refetch } = useData(
        () => api.getPending(),
        []
    );

    return {
        pending: data?.pending as Incident[] || [],
        count: data?.count || 0,
        loading,
        error,
        refetch
    };
}

// ============== Cluster Metrics ==============

export function useClusterMetrics() {
    const { data, loading, error, refetch } = useData(
        () => api.getClusterMetrics(),
        []
    );

    return {
        metrics: data as ClusterMetrics | null,
        loading,
        error,
        refetch
    };
}

// ============== Audit Log ==============

export function useAuditLog(limit: number = 100) {
    const { data, loading, error, refetch } = useData(
        () => api.getAuditLog(limit),
        [limit]
    );

    return {
        entries: data?.entries || [],
        total: data?.total || 0,
        loading,
        error,
        refetch
    };
}

// ============== Telemetry ==============

export function useTelemetryLogs(options: {
    namespace?: string;
    pod?: string;
    limit?: number;
} = {}) {
    const { data, loading, error, refetch } = useData(
        () => api.getTelemetryLogs(options),
        [options.namespace, options.pod, options.limit]
    );

    return {
        logs: data?.logs || [],
        total: data?.total || 0,
        loading,
        error,
        refetch
    };
}

export function useTelemetryEvents(options: {
    namespace?: string;
    limit?: number;
} = {}) {
    const { data, loading, error, refetch } = useData(
        () => api.getTelemetryEvents(options),
        [options.namespace, options.limit]
    );

    return {
        events: data?.events || [],
        total: data?.total || 0,
        loading,
        error,
        refetch
    };
}

// ============== System Status ==============

export function useSystemStatus() {
    const { data, loading, error, refetch } = useData(
        () => api.getSystemStatus(),
        []
    );

    return {
        status: data as SystemStatus | null,
        loading,
        error,
        refetch
    };
}

// ============== Actions ==============

export function useApproveAction() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const approve = async (incidentId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.approveIncident(incidentId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to approve';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { approve, loading, error };
}

export function useRejectAction() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reject = async (incidentId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.rejectIncident(incidentId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to reject';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { reject, loading, error };
}

// ============== Scan ==============

export function useScan() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<api.ScanResponse | null>(null);

    const scan = async (namespace?: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.triggerScan(namespace);
            setResult(res);
            return res;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Scan failed';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { scan, loading, error, result };
}

export function useMLScan() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<api.MLScanResponse | null>(null);

    const scan = async (namespace?: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.triggerMLScan(namespace);
            setResult(res);
            return res;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'ML Scan failed';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { scan, loading, error, result };
}

// ============== Polling Hook ==============

export function usePolling<T>(
    fetcher: () => Promise<T>,
    intervalMs: number = 10000
) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetch = async () => {
            try {
                const result = await fetcher();
                if (mounted) {
                    setData(result);
                    setLoading(false);
                }
            } catch (e) {
                if (mounted) {
                    setError(e instanceof Error ? e.message : 'Unknown error');
                    setLoading(false);
                }
            }
        };

        fetch();
        const interval = setInterval(fetch, intervalMs);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [intervalMs]);

    return { data, loading, error };
}

// ============== Issues ==============

export function useIssues() {
    const { data, loading, error, refetch } = useData(
        () => api.getIssues(),
        []
    );

    return {
        issues: data?.issues || [],
        total: data?.total || 0,
        counts: data?.counts || { open: 0, fixing: 0, resolved: 0, needs_attention: 0 },
        loading,
        error,
        refetch
    };
}

export function useIssue(id: string) {
    const { data, loading, error, refetch } = useData(
        () => api.getIssue(id),
        [id]
    );

    return {
        issue: data,
        loading,
        error,
        refetch
    };
}

export function useRaiseIssue() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const raiseIssue = async (incidentId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.createIssue(incidentId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to raise issue';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { raiseIssue, loading, error };
}

export function useExecuteRemediation() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (issueId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.executeRemediation(issueId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to execute';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
}

export function useRetryRemediation() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const retry = async (issueId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await api.retryRemediation(issueId);
            return result;
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to retry';
            setError(msg);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    return { retry, loading, error };
}
