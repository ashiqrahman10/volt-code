// Mock data for Volt system
import { 
  Incident, 
  ClusterMetrics, 
  AuditLogEntry, 
  RemediationAction, 
  LogEntry, 
  KubernetesEvent,
  TelemetryMetric 
} from '../types';

export const mockClusterMetrics: ClusterMetrics = {
  cpu: { usage: 67, capacity: 100 },
  memory: { usage: 82, capacity: 100 },
  pods: { running: 142, pending: 3, failed: 2, total: 147 },
  nodes: { ready: 5, total: 5 }
};

export const mockIncidents: Incident[] = [
  {
    id: 'inc-001',
    title: 'Memory Leak Detected in payment-service',
    description: 'Continuous memory growth detected over 45 minutes with multiple OOMKill events',
    status: 'pending_approval',
    severity: 'critical',
    confidence: 0.92,
    detectedAt: new Date(Date.now() - 1000 * 60 * 45),
    updatedAt: new Date(Date.now() - 1000 * 60 * 2),
    namespace: 'production',
    service: 'payment-service',
    affectedPods: ['payment-service-7d8f9c-abc12', 'payment-service-7d8f9c-def34'],
    correlationScore: 0.89,
    tags: ['memory', 'oom', 'critical'],
    signals: [
      {
        id: 'sig-m-001',
        type: 'metric',
        name: 'container_memory_usage_bytes',
        value: 3.8e9,
        threshold: 2.5e9,
        trend: 'increasing',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        query: 'container_memory_usage_bytes{pod=~"payment-service.*"}'
      },
      {
        id: 'sig-e-001',
        type: 'event',
        eventType: 'Warning',
        reason: 'OOMKilled',
        message: 'Container payment-service exceeded memory limit',
        timestamp: new Date(Date.now() - 1000 * 60 * 8),
        resource: 'payment-service-7d8f9c-abc12'
      },
      {
        id: 'sig-l-001',
        type: 'log',
        message: 'java.lang.OutOfMemoryError: Java heap space',
        level: 'error',
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        pod: 'payment-service-7d8f9c-abc12',
        count: 47
      }
    ],
    rca: {
      summary: 'Payment service is experiencing a memory leak in the transaction processing module. Memory usage has increased linearly over 45 minutes, leading to OOMKill events.',
      suspectedCauses: [
        {
          cause: 'Memory leak in transaction caching layer',
          confidence: 0.87,
          evidence: [
            'Linear memory growth pattern over 45 minutes',
            'Multiple OOMKill events on 2 pods',
            'OutOfMemoryError in Java heap space',
            'No corresponding increase in request rate'
          ]
        },
        {
          cause: 'Unbounded cache growth without eviction policy',
          confidence: 0.72,
          evidence: [
            'Memory growth correlates with transaction volume',
            'No cache size limits configured',
            'JVM heap exhaustion pattern'
          ]
        }
      ],
      timeline: [
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 45),
          event: 'Memory usage begins linear increase',
          type: 'metric'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          event: 'Memory usage exceeds 80% threshold',
          type: 'metric'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 10),
          event: 'First OutOfMemoryError logged',
          type: 'log'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 8),
          event: 'Pod payment-service-7d8f9c-abc12 OOMKilled',
          type: 'event'
        },
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 3),
          event: 'Pod payment-service-7d8f9c-def34 OOMKilled',
          type: 'event'
        }
      ],
      recommendedActions: [
        'Restart affected pods to clear memory',
        'Increase memory limits temporarily',
        'Enable heap dump on OOM for analysis',
        'Review and fix caching implementation'
      ],
      rollbackGuidance: 'If restart fails to resolve, rollback to previous deployment version (v2.4.1) which did not exhibit this behavior',
      generatedAt: new Date(Date.now() - 1000 * 60 * 2)
    },
    proposedRemediation: {
      id: 'rem-001',
      incidentId: 'inc-001',
      type: 'rollout_restart',
      status: 'pending',
      description: 'Rolling restart of payment-service deployment to clear memory leak',
      target: 'deployment/payment-service',
      parameters: {
        namespace: 'production',
        deployment: 'payment-service'
      },
      riskLevel: 'medium',
      requiresApproval: true,
      blastRadius: '2 pods, ~50 concurrent requests will be temporarily affected',
      rollbackPlan: 'Automatic rollback if health checks fail after restart',
      createdAt: new Date(Date.now() - 1000 * 60 * 2)
    }
  },
  {
    id: 'inc-002',
    title: 'High API Latency in user-service',
    description: 'P95 latency increased from 200ms to 2.5s over the last 20 minutes',
    status: 'analyzing',
    severity: 'high',
    confidence: 0.78,
    detectedAt: new Date(Date.now() - 1000 * 60 * 20),
    updatedAt: new Date(Date.now() - 1000 * 60 * 1),
    namespace: 'production',
    service: 'user-service',
    affectedPods: ['user-service-6b7c8d-xyz89', 'user-service-6b7c8d-pqr56'],
    correlationScore: 0.73,
    tags: ['latency', 'performance'],
    signals: [
      {
        id: 'sig-m-002',
        type: 'metric',
        name: 'http_request_duration_p95',
        value: 2500,
        threshold: 500,
        trend: 'increasing',
        timestamp: new Date(Date.now() - 1000 * 60 * 1),
        query: 'histogram_quantile(0.95, http_request_duration_seconds{service="user-service"})'
      },
      {
        id: 'sig-l-002',
        type: 'log',
        message: 'Database connection pool exhausted, waiting for available connection',
        level: 'warn',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        pod: 'user-service-6b7c8d-xyz89',
        count: 234
      }
    ]
  },
  {
    id: 'inc-003',
    title: 'Disk Pressure on logging-collector',
    description: 'Disk usage at 94% on logging node, affecting log collection',
    status: 'remediating',
    severity: 'medium',
    confidence: 0.95,
    detectedAt: new Date(Date.now() - 1000 * 60 * 30),
    updatedAt: new Date(Date.now() - 1000 * 30),
    namespace: 'monitoring',
    service: 'logging-collector',
    affectedPods: ['logging-collector-0'],
    correlationScore: 0.91,
    tags: ['disk', 'storage'],
    signals: [
      {
        id: 'sig-m-003',
        type: 'metric',
        name: 'node_filesystem_avail_bytes',
        value: 6,
        threshold: 10,
        trend: 'decreasing',
        timestamp: new Date(Date.now() - 1000 * 60 * 1),
        query: 'node_filesystem_avail_bytes{mountpoint="/var/log"}'
      },
      {
        id: 'sig-e-003',
        type: 'event',
        eventType: 'Warning',
        reason: 'DiskPressure',
        message: 'Node has disk pressure',
        timestamp: new Date(Date.now() - 1000 * 60 * 10),
        resource: 'node/worker-3'
      }
    ],
    proposedRemediation: {
      id: 'rem-003',
      incidentId: 'inc-003',
      type: 'cleanup_logs',
      status: 'executing',
      description: 'Clean up old log files and compress archives',
      target: 'node/worker-3',
      parameters: {
        path: '/var/log',
        olderThan: '7d'
      },
      riskLevel: 'low',
      requiresApproval: false,
      blastRadius: 'Minimal - only affects archived logs',
      rollbackPlan: 'Logs are backed up before deletion',
      createdAt: new Date(Date.now() - 1000 * 60 * 5),
      approvedAt: new Date(Date.now() - 1000 * 60 * 4),
      approvedBy: 'system-auto',
      executedAt: new Date(Date.now() - 1000 * 30)
    }
  },
  {
    id: 'inc-004',
    title: 'Pod Crash Loop in recommendation-engine',
    description: 'Pod continuously restarting every 2 minutes',
    status: 'resolved',
    severity: 'high',
    confidence: 0.88,
    detectedAt: new Date(Date.now() - 1000 * 60 * 120),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
    resolvedAt: new Date(Date.now() - 1000 * 60 * 30),
    namespace: 'production',
    service: 'recommendation-engine',
    affectedPods: ['recommendation-engine-5c6d7e-mno34'],
    correlationScore: 0.94,
    tags: ['crashloop', 'stability'],
    signals: [
      {
        id: 'sig-e-004',
        type: 'event',
        eventType: 'Warning',
        reason: 'BackOff',
        message: 'Back-off restarting failed container',
        timestamp: new Date(Date.now() - 1000 * 60 * 35),
        resource: 'recommendation-engine-5c6d7e-mno34'
      },
      {
        id: 'sig-l-004',
        type: 'log',
        message: 'Failed to connect to Redis: connection refused',
        level: 'error',
        timestamp: new Date(Date.now() - 1000 * 60 * 40),
        pod: 'recommendation-engine-5c6d7e-mno34',
        count: 15
      }
    ]
  },
  {
    id: 'inc-005',
    title: 'False Positive: Transient CPU Spike',
    description: 'Brief CPU spike detected but no supporting evidence',
    status: 'rejected',
    severity: 'low',
    confidence: 0.34,
    detectedAt: new Date(Date.now() - 1000 * 60 * 180),
    updatedAt: new Date(Date.now() - 1000 * 60 * 175),
    namespace: 'staging',
    service: 'batch-processor',
    affectedPods: ['batch-processor-8e9f0g-rst78'],
    correlationScore: 0.21,
    tags: ['cpu', 'false-positive'],
    signals: [
      {
        id: 'sig-m-005',
        type: 'metric',
        name: 'container_cpu_usage',
        value: 85,
        threshold: 80,
        trend: 'stable',
        timestamp: new Date(Date.now() - 1000 * 60 * 180),
        query: 'container_cpu_usage_seconds_total{pod=~"batch-processor.*"}'
      }
    ]
  }
];

export const mockAuditLog: AuditLogEntry[] = [
  {
    id: 'audit-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    action: 'cleanup_logs',
    actor: 'system',
    target: 'node/worker-3:/var/log',
    details: 'Cleaned up 2.3GB of old log files',
    result: 'success',
    metadata: { bytesFreed: 2468741120, filesDeleted: 156 }
  },
  {
    id: 'audit-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    action: 'rollout_restart',
    actor: 'human',
    target: 'deployment/recommendation-engine',
    details: 'Manual restart approved by ops-engineer@company.com',
    result: 'success',
    metadata: { approvedBy: 'ops-engineer@company.com', podsRestarted: 3 }
  },
  {
    id: 'audit-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    action: 'scale_deployment',
    actor: 'system',
    target: 'deployment/api-gateway',
    details: 'Auto-scaled from 5 to 8 replicas due to high traffic',
    result: 'success',
    metadata: { oldReplicas: 5, newReplicas: 8 }
  },
  {
    id: 'audit-004',
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    action: 'prom_query',
    actor: 'gateway',
    target: 'prometheus',
    details: 'Queried memory metrics for payment-service',
    result: 'success',
    metadata: { query: 'container_memory_usage_bytes{pod=~"payment-service.*"}' }
  },
  {
    id: 'audit-005',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    action: 'tail_logs',
    actor: 'gateway',
    target: 'pod/user-service-6b7c8d-xyz89',
    details: 'Retrieved last 500 log lines',
    result: 'success',
    metadata: { lines: 500, namespace: 'production' }
  }
];

export const mockLogEntries: LogEntry[] = [
  {
    timestamp: new Date(Date.now() - 1000 * 10),
    level: 'error',
    message: 'java.lang.OutOfMemoryError: Java heap space at com.company.TransactionCache.put(TransactionCache.java:145)',
    pod: 'payment-service-7d8f9c-abc12',
    namespace: 'production',
    container: 'payment-service'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 30),
    level: 'warn',
    message: 'Database connection pool exhausted, waiting for available connection (pool size: 50)',
    pod: 'user-service-6b7c8d-xyz89',
    namespace: 'production',
    container: 'user-service'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 45),
    level: 'error',
    message: 'Failed to process payment transaction: timeout after 30s',
    pod: 'payment-service-7d8f9c-def34',
    namespace: 'production',
    container: 'payment-service'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60),
    level: 'info',
    message: 'Health check passed: all systems operational',
    pod: 'api-gateway-9a0b1c-uvw12',
    namespace: 'production',
    container: 'api-gateway'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 90),
    level: 'error',
    message: 'Redis connection failed: ECONNREFUSED 10.0.2.15:6379',
    pod: 'recommendation-engine-5c6d7e-mno34',
    namespace: 'production',
    container: 'recommendation-engine'
  }
];

export const mockKubernetesEvents: KubernetesEvent[] = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
    type: 'Warning',
    reason: 'OOMKilled',
    message: 'Container payment-service in pod payment-service-7d8f9c-abc12 exceeded memory limit (2.5Gi)',
    object: 'Pod/payment-service-7d8f9c-abc12',
    namespace: 'production',
    count: 1
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 10),
    type: 'Warning',
    reason: 'DiskPressure',
    message: 'Node worker-3 has disk pressure: available space below threshold',
    object: 'Node/worker-3',
    namespace: 'monitoring',
    count: 3
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 35),
    type: 'Warning',
    reason: 'BackOff',
    message: 'Back-off restarting failed container recommendation-engine in pod recommendation-engine-5c6d7e-mno34',
    object: 'Pod/recommendation-engine-5c6d7e-mno34',
    namespace: 'production',
    count: 8
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    type: 'Normal',
    reason: 'Scaled',
    message: 'Scaled up deployment api-gateway from 5 to 8 replicas',
    object: 'Deployment/api-gateway',
    namespace: 'production',
    count: 1
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    type: 'Normal',
    reason: 'Pulled',
    message: 'Successfully pulled image "payment-service:v2.4.2"',
    object: 'Pod/payment-service-7d8f9c-abc12',
    namespace: 'production',
    count: 1
  }
];

// Time series data for charts
export const generateMetricTimeSeries = (
  duration: number = 60,
  baseline: number = 50,
  volatility: number = 10,
  trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
): TelemetryMetric[] => {
  const data: TelemetryMetric[] = [];
  const now = Date.now();
  
  for (let i = duration; i >= 0; i--) {
    const timestamp = new Date(now - i * 60 * 1000);
    let trendValue = 0;
    
    if (trend === 'increasing') {
      trendValue = ((duration - i) / duration) * 30;
    } else if (trend === 'decreasing') {
      trendValue = -((duration - i) / duration) * 20;
    }
    
    const noise = (Math.random() - 0.5) * volatility;
    const value = Math.max(0, baseline + trendValue + noise);
    
    data.push({ timestamp, value });
  }
  
  return data;
};
