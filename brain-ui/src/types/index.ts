// Core Types for Volt Incident Response System

export type IncidentStatus = 'detected' | 'analyzing' | 'pending_approval' | 'remediating' | 'resolved' | 'escalated' | 'rejected';
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type SignalType = 'metric' | 'log' | 'event';
export type RemediationStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

export interface MetricSignal {
  id: string;
  type: 'metric';
  name: string;
  value: number;
  threshold: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timestamp: Date;
  query: string;
}

export interface LogSignal {
  id: string;
  type: 'log';
  message: string;
  level: 'error' | 'warn' | 'info';
  timestamp: Date;
  pod: string;
  count: number;
}

export interface EventSignal {
  id: string;
  type: 'event';
  eventType: string;
  reason: string;
  message: string;
  timestamp: Date;
  resource: string;
}

export type Signal = MetricSignal | LogSignal | EventSignal;

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  confidence: number;
  detectedAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  namespace: string;
  service: string;
  affectedPods: string[];
  signals: Signal[];
  correlationScore: number;
  rca?: RootCauseAnalysis;
  proposedRemediation?: RemediationAction;
  tags: string[];
}

export interface RootCauseAnalysis {
  summary?: string;
  suspectedCauses?: Array<{
    cause: string;
    confidence: number;
    evidence: string[];
  }>;
  timeline?: Array<{
    timestamp: Date;
    event: string;
    type: SignalType;
  }>;
  recommendedActions?: string[];
  rollbackGuidance?: string;
  generatedAt?: Date;
  // Backend field names (snake_case)
  root_cause?: string;
  confidence?: number;
  evidence?: string[];
  contributing_factors?: string[];
  recommended_action?: string;
  rollback_guidance?: string;
  reasoning?: string;
}

export interface RemediationAction {
  id: string;
  incidentId: string;
  type: 'rollout_restart' | 'scale_deployment' | 'delete_pod' | 'cleanup_logs';
  status: RemediationStatus;
  description: string;
  target: string;
  parameters: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  blastRadius: string;
  rollbackPlan: string;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  executedAt?: Date;
  completedAt?: Date;
  result?: string;
}

export interface ClusterMetrics {
  cpu: {
    usage: number;
    capacity: number;
  };
  memory: {
    usage: number;
    capacity: number;
  };
  pods: {
    running: number;
    pending: number;
    failed: number;
    total: number;
  };
  nodes: {
    ready: number;
    total: number;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: 'system' | 'human' | 'gateway';
  target: string;
  details: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

export interface TelemetryMetric {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  pod: string;
  namespace: string;
  container?: string;
}

export interface KubernetesEvent {
  timestamp: Date;
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  object: string;
  namespace: string;
  count: number;
}

// ============== Issue Types ==============

export type IssueStatus = 'open' | 'fixing' | 'resolved' | 'needs_attention';

export type RemediationAttemptStatus = 'pending' | 'executing' | 'success' | 'failed';

export interface RemediationAttempt {
  id: string;
  action: string;
  target: string;
  status: RemediationAttemptStatus;
  executedAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
}

export interface Issue {
  id: string;
  incidentId: string;
  incident?: Incident;
  status: IssueStatus;
  createdAt: Date;
  updatedAt: Date;
  remediationAttempts: RemediationAttempt[];
  verified: boolean;
  verificationMessage?: string;
}
