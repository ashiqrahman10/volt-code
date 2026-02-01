1️⃣ TASK-BASED SPECIFICATION

(Execution-oriented, LLM-friendly)

Phase 0 — Foundations (Telemetry Plumbing)

Task 0.1 — Cluster Telemetry Export

Goal: Ship cluster metrics & logs to external incident server.

Tasks
	•	Install Prometheus in cluster
	•	Configure:
	•	Metrics scraping (node, pod, app, ingress)
	•	Export metrics to external server (remote_write or OTLP)
	•	Install log collection:
	•	Promtail / OTel Collector as DaemonSet
	•	Enrich logs with pod, namespace, node labels
	•	Ensure logs are queryable by time + label

Output
	•	External server can query:
	•	Metrics by timestamp & labels
	•	Logs by service/pod/time window

⸻

Task 0.2 — Object Storage (Log Durability)

Goal: Persist logs to DigitalOcean Spaces.

Tasks
	•	Configure Loki with S3-compatible backend
	•	Create DO Spaces bucket
	•	Store logs in chunked, compressed format
	•	Retention rules (e.g., 7d hot, 30d cold)

Output
	•	Logs survive pod restarts & Loki restarts
	•	Historical logs available for RCA

⸻

Phase 1 — Incident Detection Engine

Task 1.1 — Metric Windowing Service

Goal: Convert raw metrics into analysis windows.

Tasks
	•	Pull metrics every N seconds
	•	Aggregate into:
	•	rolling windows (1m, 5m, 15m)
	•	per-pod, per-service, per-node views
	•	Normalize & store temporarily

Output
	•	Clean time-series windows ready for analysis

⸻

Task 1.2 — Rule-Based Incident Detection (Baseline)

Goal: Detect obvious incidents before ML.

Incident Types
	•	Memory spike
	•	Memory leak (slope-based)
	•	Disk nearing full
	•	API timeout / latency spike

Tasks
	•	Threshold checks
	•	Rate-of-change checks
	•	Event correlation (restarts, OOMKilled, evictions)

Output
	•	IncidentCandidate object:

{
  "type": "memory_leak",
  "scope": "deployment",
  "target": "payments-api",
  "confidence": 0.71,
  "evidence": {
    "metrics": [...],
    "events": [...]
  }
}


⸻

Phase 2 — ML-Based Anomaly Detection

Task 2.1 — Anomaly Model

Goal: Detect non-obvious deviations.

Tasks
	•	Train model on:
	•	historical metrics
	•	seasonal patterns
	•	Detect:
	•	sustained drift
	•	sudden spikes
	•	correlated multi-metric anomalies

Output
	•	Incident candidates with ML confidence score

⸻

Task 2.2 — Incident Correlation

Goal: Merge multiple weak signals into one incident.

Tasks
	•	Correlate:
	•	metrics + events + logs timing
	•	Deduplicate noisy alerts
	•	Assign severity

Output
	•	Single incident timeline, not alert spam

⸻

Phase 3 — Log-Aware RCA via LLM

Task 3.1 — Log Context Extractor

Goal: Prepare logs for LLM consumption.

Tasks
	•	Pull logs from Loki:
	•	time-boxed around anomaly
	•	scoped to affected pods/services
	•	De-noise:
	•	remove health checks
	•	collapse duplicates
	•	Chunk logs with metadata

Output
	•	Compact, high-signal log context

⸻

Task 3.2 — RCA Prompt Orchestrator

Goal: Ask the LLM the right question.

Tasks
	•	Construct structured prompt:
	•	Incident summary
	•	Metric anomalies
	•	Log excerpts
	•	Recent changes (deploys, scaling)
	•	Ask LLM for:
	•	Root cause hypotheses (ranked)
	•	Evidence per hypothesis
	•	Suggested remediation steps

Output

{
  "root_causes": [
    {
      "hypothesis": "Memory leak due to unbounded cache",
      "confidence": 0.78,
      "evidence": [...]
    }
  ],
  "recommended_actions": [...]
}


⸻

Phase 4 — Action Planning & Approval

Task 4.1 — Action Policy Engine

Goal: Decide what can be done automatically.

Tasks
	•	Define action tiers:
	•	Read-only
	•	Low-risk auto
	•	Human approval required
	•	Enforce:
	•	namespace allowlist
	•	blast radius limits
	•	rate limits

Output
	•	Approved action plan or approval request

⸻

Task 4.2 — Human-in-Loop Interface

Goal: Let users approve safely.

Tasks
	•	UI showing:
	•	incident timeline
	•	RCA summary
	•	proposed actions
	•	expected impact
	•	Approve / Reject / Modify

Output
	•	Explicit user authorization event

⸻

Phase 5 — Cluster Action Execution (MCP)

Task 5.1 — In-Cluster Executor Service

Goal: Safely mutate cluster state.

Tasks
	•	Deploy executor pod
	•	RBAC-scoped ServiceAccount
	•	API supports typed actions only
	•	restart pod
	•	scale deployment
	•	rollback release
	•	run diagnostic job

Output
	•	Controlled, auditable execution channel

⸻

Task 5.2 — Execution Feedback Loop

Goal: Close the loop.

Tasks
	•	Capture:
	•	command output
	•	before/after metrics
	•	Update incident status
	•	Detect resolution or escalation

Output
	•	Incident marked resolved / ongoing

⸻

2️⃣ SYSTEM SPECIFICATION SHEET

System Name

Intelligent Incident Response Platform

⸻

Core Components

In-Cluster

Component	Responsibility
Prometheus	Metrics scraping
Log Agent	Log collection
Loki	Log indexing + object storage
Executor (MCP)	Controlled cluster actions


⸻

External Server

Component	Responsibility
Telemetry Ingest	Receive metrics/logs
Anomaly Engine	Detect incidents
RCA Orchestrator	LLM-driven analysis
Policy Engine	Safety & approval
API Layer	UI + executor calls


⸻

Data Types

Metrics
	•	CPU, memory, disk
	•	Latency (p95/p99)
	•	Error & timeout rates
	•	Restarts, evictions

Logs
	•	Application logs
	•	Kubernetes events
	•	Container runtime errors

⸻

Action Model (Typed)

Action:
  type: RestartDeployment | ScaleDeployment | RunJob | Rollback
  target:
    namespace: string
    name: string
  parameters: object


⸻

Safety Constraints
	•	No arbitrary shell execution
	•	No cluster-admin privileges
	•	No cross-namespace mutation unless allowed
	•	All actions logged & replayable

⸻

Non-Goals (Explicit)
	•	No autonomous destructive actions
	•	No direct LLM → kubectl access
	•	No blind auto-scaling without bounds

⸻

3️⃣ FEATURE LIST

MVP (Hackathon-viable)
	•	Metrics export to external server
	•	Rule-based anomaly detection
	•	Log-aware RCA using LLM
	•	Human-approved remediation
	•	Restart / scale / diagnostics

⸻

Advanced
	•	ML-based anomaly detection
	•	Multi-signal correlation
	•	Confidence-based auto actions
	•	Incident timelines & history
	•	DigitalOcean Spaces log retention

⸻

Stretch / Differentiators
	•	Predictive incident detection
	•	Change-impact analysis (deploy → incident)
	•	Natural-language incident queries
	•	Self-learning remediation ranking
	•	Policy-as-code for autonomy levels
