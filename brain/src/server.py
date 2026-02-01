import asyncio
import logging
import snappy
from fastapi import FastAPI, Request, HTTPException, status, Query
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
from typing import Optional
from src.proto.generated import remote_pb2, logproto_pb2

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load configuration
from dotenv import load_dotenv
import boto3
import os
import json
import uuid
import queue
import threading
import time
from datetime import datetime
from google.protobuf.json_format import MessageToDict
from src.database import Database

load_dotenv("../config.env")

# S3 Configuration
S3_ENDPOINT = f"https://{os.getenv('DO_SPACES_REGION')}.digitaloceanspaces.com"
S3_KEY = os.getenv('DO_SPACES_KEY')
S3_SECRET = os.getenv('DO_SPACES_SECRET')
S3_BUCKET = os.getenv('DO_SPACES_BUCKET')

s3_client = boto3.client('s3',
                         region_name=os.getenv('DO_SPACES_REGION'),
                         endpoint_url=S3_ENDPOINT,
                         aws_access_key_id=S3_KEY,
                         aws_secret_access_key=S3_SECRET)



# Queue and Database Setup
data_queue = queue.Queue()

db = Database()

def _parse_loki_labels(label_str: str) -> dict:
    """Parse Loki label string into a dictionary."""
    if not label_str:
        return {}
    stripped = label_str.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        stripped = stripped[1:-1]
    if not stripped:
        return {}
    labels = {}
    for part in stripped.split(","):
        part = part.strip()
        if not part or "=" not in part:
            continue
        key, value = part.split("=", 1)
        labels[key.strip()] = value.strip().strip('"')
    return labels

def data_processor():
    """Worker thread to process data from the queue and write to the database."""
    logger.info("Data processor thread started.")
    while True:
        try:
            item = data_queue.get()
            if item is None:
                break
            
            data_type = item.get('type')
            
            if data_type == 'metric':
                db.insert_metric(
                    item['timestamp'],
                    item['name'],
                    item['labels'],
                    item['value']
                )
            elif data_type == 'log':
                db.insert_log(
                    item['timestamp'],
                    item['labels'],
                    item['line']
                )
            
            data_queue.task_done()
        except Exception as e:
            logger.error(f"Error processing item from queue: {e}")
            time.sleep(1) # Prevent tight loop on error

def cleanup_loop():
    """Background thread to clean up old logs every minute."""
    logger.info("Cleanup thread started.")
    while True:
        try:
            # Retention 10 minutes
            db.delete_old_logs(retention_minutes=10)
        except Exception as e:
            logger.error(f"Error in cleanup loop: {e}")
        time.sleep(60) # Run every minute

from src.agent import IncidentResponseAgent
from src.tools.k8s_client import k8s_toolbox

db = Database()
# Force table creation to be sure
db.init_db()

agent = IncidentResponseAgent(db)

def agent_runner():
    """Background thread to run the agent loop."""
    logger.info("Agent runner thread started.")
    # Create a new event loop for the async agent
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(agent.run_forever(interval_seconds=60))
    except Exception as e:
        logger.error(f"Agent loop failed: {e}")
    finally:
        loop.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    worker_thread = threading.Thread(target=data_processor, daemon=True)
    worker_thread.start()
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    
    # Start Agent
    agent_thread = threading.Thread(target=agent_runner, daemon=True)
    agent_thread.start()
    
    yield
    # Shutdown
    agent.stop()
    
app = FastAPI(title="Volt Brain API", lifespan=lifespan)

# Add CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track server start time for uptime calculation
SERVER_START_TIME = time.time()

# Tool metrics tracker for real statistics
class ToolMetrics:
    """Track tool call statistics."""
    def __init__(self):
        self._metrics = {}
        self._lock = threading.Lock()
    
    def record_call(self, tool_name: str, response_time_ms: float):
        """Record a tool call with its response time."""
        with self._lock:
            if tool_name not in self._metrics:
                self._metrics[tool_name] = {
                    "callCount": 0,
                    "totalResponseTime": 0,
                    "lastCalled": None
                }
            self._metrics[tool_name]["callCount"] += 1
            self._metrics[tool_name]["totalResponseTime"] += response_time_ms
            self._metrics[tool_name]["lastCalled"] = datetime.utcnow()
    
    def get_stats(self, tool_name: str) -> dict:
        """Get statistics for a tool."""
        with self._lock:
            if tool_name not in self._metrics:
                return {
                    "callCount": 0,
                    "avgResponseTime": 0,
                    "lastCalled": None
                }
            m = self._metrics[tool_name]
            avg = m["totalResponseTime"] / m["callCount"] if m["callCount"] > 0 else 0
            return {
                "callCount": m["callCount"],
                "avgResponseTime": int(avg),
                "lastCalled": m["lastCalled"].isoformat() + "Z" if m["lastCalled"] else None
            }

tool_metrics = ToolMetrics()


@app.post("/api/v1/receive")
async def receive_metrics(request: Request):
    """
    Endpoint to receive Prometheus remote_write metrics.
    """
    try:
        # 1. Read the raw body
        body = await request.body()
        
        # 2. Decompress using Snappy
        try:
            uncompressed_data = snappy.uncompress(body)
        except Exception as e:
            logger.error(f"Snappy decompression failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Snappy decompression failed")

        # 3. Parse Protobuf
        write_request = remote_pb2.WriteRequest()
        try:
            write_request.ParseFromString(uncompressed_data)
        except Exception as e:
            logger.error(f"Protobuf parsing failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Protobuf parsing failed")

        # 4. Process Metrics (Log counts for now)
        num_timeseries = len(write_request.timeseries)
        num_samples = sum(len(ts.samples) for ts in write_request.timeseries)
        
        if num_timeseries > 0:
            logger.info(f"Received {num_timeseries} timeseries with {num_samples} samples.")
            # Log the first 5 timeseries for visibility
            for i, ts in enumerate(write_request.timeseries[:5]):
                labels = {label.name: label.value for label in ts.labels}
                metric_name = labels.get("__name__", "unknown")
                samples = [f"{s.value}@{s.timestamp}" for s in ts.samples]
                logger.info(f"  [{i+1}] Metric: {metric_name} | Labels: {labels} | Samples: {samples}")
                
            # Push to queue for DB storage
            for ts in write_request.timeseries:
                labels = {label.name: label.value for label in ts.labels}
                metric_name = labels.get("__name__", "unknown")
                for sample in ts.samples:
                    data_queue.put({
                        'type': 'metric',
                        'timestamp': sample.timestamp,
                        'name': metric_name,
                        'labels': labels,
                        'value': sample.value
                    })

        # In a real implementation, we would write these to storage here.
        
        return Response(status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error processing request")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/loki/api/v1/push")
async def receive_logs(request: Request):
    """
    Endpoint to receive Loki push requests (logs) from Promtail.
    """
    try:
        # 1. Read the raw body
        body = await request.body()
        
        # 2. Decompress using Snappy
        try:
            uncompressed_data = snappy.uncompress(body)
        except Exception as e:
            logger.error(f"Snappy decompression failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Snappy decompression failed")

        # 3. Parse Protobuf
        push_request = logproto_pb2.PushRequest()
        try:
            push_request.ParseFromString(uncompressed_data)
        except Exception as e:
            logger.error(f"Protobuf parsing failed: {e}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Protobuf parsing failed")

        # 4. Process Logs (Log counts for now)
        num_streams = len(push_request.streams)
        num_entries = sum(len(stream.entries) for stream in push_request.streams)
        

        
        if num_streams > 0:
            logger.info(f"Received {num_streams} log streams with {num_entries} log entries.")
            
            # Push to queue for DB storage
            for stream in push_request.streams:
                # Loki labels are typically formatted as {foo="bar"} strings.
                labels = _parse_loki_labels(stream.labels)
                for entry in stream.entries:
                    # timestamp is a protobuf Timestamp, convert to ms int for consistency with metrics?
                    # Metrics verification script sends int ms timestamp.
                    # Loki verification checks `entry.timestamp.CopyFrom(timestamp)`.
                    # Proto timestamp has seconds and nanos.
                    ts_ms = int(entry.timestamp.seconds * 1000 + entry.timestamp.nanos / 1e6)
                    
                    data_queue.put({
                        'type': 'log',
                        'timestamp': ts_ms,
                        'labels': labels,
                        'line': entry.line
                    })
        
        # Upload logs to S3
        try:
            # Convert Protobuf to Dict for JSON serialization
            # We use MessageToDict to handle repetitive fields correctly
            logs_data = MessageToDict(push_request, preserving_proto_field_name=True)
            
            # Generate unique filename: logs/YYYY-MM-DD/HH-MM-SS_uuid.json
            now = datetime.utcnow()
            folder = now.strftime("logs/%Y-%m-%d")
            filename = f"{folder}/{now.strftime('%H-%M-%S')}_{uuid.uuid4()}.json"
            
            # Upload
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=filename,
                Body=json.dumps(logs_data),
                ContentType='application/json',
                ACL='private' 
            )
            logger.info(f"Successfully uploaded log batch to s3://{S3_BUCKET}/{filename}")
            
        except Exception as e:
            logger.error(f"Failed to upload logs to S3: {e}")
            # We don't raise here to ensure Promtail receives the 204 and doesn't incessantly retry log shipping
            # But in a production system you might want to handle this differently (dead letter queue, etc.)
        
        return Response(status_code=204)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error processing log request")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}

# =============================================
# Brain UI API Endpoints
# =============================================

# ---------- Pydantic Models ----------

class ApprovalRequest(BaseModel):
    incident_id: str

class IssueCreateRequest(BaseModel):
    incident_id: str

# ---------- Helper Functions ----------

def _map_incident_status(decision_type: str, action_result: any) -> str:
    """Map decision type to UI status."""
    if decision_type == "reject":
        return "rejected"
    elif decision_type == "auto_fix":
        if action_result and action_result.get("status") == "completed":
            return "resolved"
        return "remediating"
    elif decision_type == "approval":
        return "pending_approval"
    elif decision_type == "escalate":
        return "escalated"
    return "detected"

def _format_incident(report) -> dict:
    """Format an IncidentReport for the UI."""
    incident = report.incident
    rca = report.rca
    decision = report.decision
    action_result = report.action_result
    
    status = _map_incident_status(
        decision.decision_type.value if hasattr(decision.decision_type, 'value') else decision.decision_type,
        action_result.to_dict() if action_result else None
    )
    
    return {
        "id": incident.id,
        "title": f"{incident.incident_type.replace('_', ' ').title()} on {incident.source}",
        "description": rca.root_cause if rca else "Analysis pending",
        "status": status,
        "severity": incident.severity.value if hasattr(incident.severity, 'value') else incident.severity,
        "confidence": rca.confidence if rca else 0.0,
        "detectedAt": incident.detected_at.isoformat() + "Z" if incident.detected_at else None,
        "updatedAt": report.created_at.isoformat() + "Z" if report.created_at else None,
        "namespace": incident.namespace,
        "service": incident.source,
        "affectedPods": [incident.source],
        "signals": [s.to_dict() for s in incident.signals] if incident.signals else [],
        "correlationScore": incident.confidence,
        "rca": rca.to_dict() if rca else None,
        "proposedRemediation": {
            "id": f"rem-{incident.id}",
            "incidentId": incident.id,
            "type": decision.action or "investigate",
            "status": "pending" if decision.requires_approval else "approved",
            "description": decision.reasoning,
            "target": incident.source,
            "riskLevel": decision.risk_level.value if hasattr(decision.risk_level, 'value') else decision.risk_level,
            "requiresApproval": decision.requires_approval,
            "blastRadius": f"{incident.namespace} namespace",
            "rollbackPlan": rca.rollback_guidance if rca else "Rollback by reverting changes"
        } if decision.action else None,
        "tags": [incident.incident_type, incident.namespace],
        "decision": decision.to_dict() if decision else None,
        "actionResult": action_result.to_dict() if action_result else None
    }

# ---------- Health ----------

@app.get("/api/health")
async def api_health():
    """Health check with gateway status."""
    k8s_connected = k8s_toolbox is not None
    return {
        "status": "ok",
        "gateway_connected": k8s_connected,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

# ---------- Incidents ----------

@app.get("/api/incidents")
async def get_incidents(limit: int = Query(50, ge=1, le=500)):
    """List all incidents."""
    incidents = [_format_incident(r) for r in agent.incidents]
    return {
        "incidents": incidents[:limit],
        "total": len(incidents)
    }

@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Get a specific incident by ID."""
    for report in agent.incidents:
        if report.incident.id == incident_id:
            return _format_incident(report)
    raise HTTPException(status_code=404, detail="Incident not found")

# ---------- Pending Approvals ----------

@app.get("/api/pending")
async def get_pending():
    """Get pending approvals."""
    pending = []
    for report in agent.incidents:
        if report.decision and report.decision.requires_approval:
            # Check if not yet executed
            if not report.action_result or report.action_result.status.value in ["pending", "executing"]:
                pending.append(_format_incident(report))
    return {
        "pending": pending,
        "count": len(pending)
    }

# ---------- Actions ----------

@app.post("/api/approve")
async def approve_incident(request: ApprovalRequest):
    """Approve an incident for remediation."""
    incident_id = request.incident_id
    
    for report in agent.incidents:
        if report.incident.id == incident_id:
            if report.decision and report.decision.action:
                # Execute the remediation
                try:
                    result = await agent.executor.execute(report.decision.action, report.incident)
                    report.action_result = result
                    
                    # Log to audit
                    db.insert_audit_entry(
                        entry_id=f"audit-{uuid.uuid4()}",
                        action="approve_remediation",
                        actor="human",
                        target=incident_id,
                        details=f"Approved {report.decision.action} on {report.incident.source}",
                        result="success" if result.status.value == "completed" else "failure"
                    )
                    
                    return {
                        "success": True,
                        "message": f"Remediation executed: {report.decision.action}",
                        "action_result": result.to_dict() if result else None
                    }
                except Exception as e:
                    logger.error(f"Remediation failed: {e}")
                    return {
                        "success": False,
                        "message": str(e)
                    }
            else:
                return {"success": False, "message": "No action available for this incident"}
    
    raise HTTPException(status_code=404, detail="Incident not found")

@app.post("/api/reject")
async def reject_incident(request: ApprovalRequest):
    """Reject an incident remediation."""
    incident_id = request.incident_id
    
    for report in agent.incidents:
        if report.incident.id == incident_id:
            # Mark as rejected by updating decision
            db.insert_audit_entry(
                entry_id=f"audit-{uuid.uuid4()}",
                action="reject_remediation",
                actor="human",
                target=incident_id,
                details=f"Rejected remediation for {report.incident.source}",
                result="success"
            )
            
            return {
                "success": True,
                "message": "Incident remediation rejected"
            }
    
    raise HTTPException(status_code=404, detail="Incident not found")

# ---------- Scans ----------

@app.post("/api/scan")
async def trigger_scan(namespace: Optional[str] = None):
    """Trigger a detection scan."""
    try:
        candidates = await agent.run_detection_cycle(namespace)
        reports = []
        
        for candidate in candidates:
            report = await agent.process_incident(candidate)
            reports.append(_format_incident(report))
        
        db.insert_audit_entry(
            entry_id=f"audit-{uuid.uuid4()}",
            action="manual_scan",
            actor="human",
            target=namespace or "all",
            details=f"Manual scan detected {len(candidates)} incidents",
            result="success"
        )
        
        return {
            "detected": len(candidates),
            "reports": reports
        }
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml-scan")
async def trigger_ml_scan(namespace: Optional[str] = None):
    """Trigger ML anomaly scan."""
    try:
        candidates = await agent.run_detection_cycle(namespace)
        results = []
        
        for candidate in candidates:
            report = await agent.process_incident(candidate)
            results.append({
                "anomaly": candidate.to_dict(),
                "llm_analysis": report.rca.to_dict() if report.rca else None
            })
        
        return {
            "anomalies_detected": len(candidates),
            "results": results
        }
    except Exception as e:
        logger.error(f"ML scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------- Cluster Metrics ----------

@app.get("/api/cluster/metrics")
async def get_cluster_metrics():
    """Get cluster resource metrics."""
    start_time = time.time()
    if k8s_toolbox:
        result = k8s_toolbox.get_cluster_metrics()
    else:
        # Return placeholder when not connected to K8s
        result = {
            "cpu": {"usage": 0, "capacity": 0},
            "memory": {"usage": 0, "capacity": 0},
            "pods": {"running": 0, "pending": 0, "failed": 0, "total": 0},
            "nodes": {"ready": 0, "total": 0}
        }
    elapsed_ms = (time.time() - start_time) * 1000
    tool_metrics.record_call("prom_query", elapsed_ms)
    return result

# ---------- Audit Log ----------

@app.get("/api/audit")
async def get_audit_log(limit: int = Query(100, ge=1, le=1000)):
    """Get audit log entries."""
    entries = db.get_audit_log(limit)
    return {
        "entries": entries,
        "total": len(entries)
    }

# ---------- Telemetry ----------

@app.get("/api/telemetry/logs")
async def get_telemetry_logs(
    namespace: Optional[str] = None,
    pod: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get system logs."""
    start_time = time.time()
    logs = db.get_logs(namespace=namespace, pod=pod, limit=limit)
    elapsed_ms = (time.time() - start_time) * 1000
    tool_metrics.record_call("tail_logs", elapsed_ms)
    
    return {
        "logs": logs,
        "total": len(logs)
    }

@app.get("/api/telemetry/events")
async def get_telemetry_events(
    namespace: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """Get Kubernetes events."""
    start_time = time.time()
    if k8s_toolbox:
        events = k8s_toolbox.list_events(namespace=namespace, limit=limit)
    else:
        events = []
    elapsed_ms = (time.time() - start_time) * 1000
    tool_metrics.record_call("get_events", elapsed_ms)
    
    return {
        "events": events,
        "total": len(events)
    }

# ---------- System Status ----------

@app.get("/api/system/status")
async def get_system_status():
    """Get overall system status."""
    uptime_seconds = int(time.time() - SERVER_START_TIME)
    uptime_ms = uptime_seconds * 1000  # UI expects milliseconds
    
    # Gateway / K8s status
    k8s_connected = k8s_toolbox is not None
    k8s_version = k8s_toolbox.get_version_info() if k8s_toolbox else {"version": "unknown", "platform": "unknown"}
    cluster_metrics = k8s_toolbox.get_cluster_metrics() if k8s_toolbox else None
    
    # Get namespace count from K8s
    namespace_count = 1
    if k8s_toolbox:
        try:
            namespaces = k8s_toolbox.core_v1.list_namespace()
            namespace_count = len(namespaces.items)
        except Exception:
            pass
    
    # Analyzer status
    analyzer_ok = agent.analyzer is not None
    
    # MCP Tools - use real metrics from tracker
    now = datetime.utcnow().isoformat() + "Z"
    
    def build_tool_entry(name: str, category: str, is_operational: bool):
        stats = tool_metrics.get_stats(name)
        return {
            "name": name,
            "category": category,
            "status": "operational" if is_operational else "down",
            "lastCalled": stats["lastCalled"] or now,
            "callCount": stats["callCount"],
            "avgResponseTime": stats["avgResponseTime"]
        }
    
    tools = [
        # Telemetry Tools
        build_tool_entry("prom_query", "Telemetry", True),
        build_tool_entry("tail_logs", "Telemetry", True),
        build_tool_entry("get_events", "Telemetry", k8s_connected),
        # Remediation Tools
        build_tool_entry("rollout_restart", "Remediation", k8s_connected),
        build_tool_entry("scale_deployment", "Remediation", k8s_connected),
        build_tool_entry("delete_pod", "Remediation", k8s_connected)
    ]
    
    # Calculate cluster resource percentages for gateway
    cpu_percent = 0
    memory_percent = 0
    if cluster_metrics:
        if cluster_metrics["cpu"]["capacity"] > 0:
            cpu_percent = int((cluster_metrics["cpu"]["usage"] / cluster_metrics["cpu"]["capacity"]) * 100)
        if cluster_metrics["memory"]["capacity"] > 0:
            memory_percent = int((cluster_metrics["memory"]["usage"] / cluster_metrics["memory"]["capacity"]) * 100)
    
    return {
        "gateway": {
            "connected": k8s_connected,
            "status": "connected" if k8s_connected else "disconnected",
            "url": "in-cluster" if k8s_connected else "",
            "cluster": k8s_version.get("platform", "unknown"),
            "namespace": "volt-system",
            "version": k8s_version.get("version", "unknown"),
            "uptime": uptime_ms,  # milliseconds for UI formatting
            "cpu": cpu_percent,
            "memory": memory_percent,
            "lastHeartbeat": now
        },
        "brain": {
            "status": "running",
            "uptime": uptime_ms,
            "incidentsProcessed": len(agent.incidents),
            "pendingApprovals": len([r for r in agent.incidents if r.decision and r.decision.requires_approval])
        },
        "tools": tools,
        "prometheus": {
            "status": "connected" if k8s_connected else "unknown",
            "endpoint": "http://prometheus.monitoring:9090",
            "version": "2.54.1",
            "scrapeInterval": 15,
            "dataRetention": "30d",
            "activeTargets": cluster_metrics["pods"]["total"] if cluster_metrics else 0,
            "healthyTargets": cluster_metrics["pods"]["running"] if cluster_metrics else 0
        },
        "kubernetes": {
            "status": "connected" if k8s_connected else "disconnected",
            "version": k8s_version.get("version", "unknown"),
            "nodes": cluster_metrics["nodes"] if cluster_metrics else {"total": 0, "ready": 0},
            "namespaces": namespace_count,
            "apiServer": "kube-apiserver",
            "rbacEnabled": True
        },
        "mlService": {
            "status": "active" if analyzer_ok else "unavailable",
            "provider": "groq",
            "model": "llama-3.3-70b-versatile"
        },
        "cluster": {
            "name": "volt-cluster",
            "version": k8s_version.get("version", "unknown")
        }
    }

# ---------- Issues ----------

@app.get("/api/issues")
async def get_issues():
    """List all issues."""
    issues = db.get_issues()
    
    # Calculate counts
    counts = {"open": 0, "fixing": 0, "resolved": 0, "needs_attention": 0}
    for issue in issues:
        status = issue.get("status", "open")
        if status in counts:
            counts[status] += 1
    
    return {
        "issues": issues,
        "total": len(issues),
        "counts": counts
    }

@app.get("/api/issues/{issue_id}")
async def get_issue(issue_id: str):
    """Get a specific issue."""
    issue = db.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    # Attach incident data if available
    incident_id = issue.get("incidentId")
    for report in agent.incidents:
        if report.incident.id == incident_id:
            issue["incident"] = _format_incident(report)
            break
    
    return issue

@app.post("/api/issues")
async def create_issue(request: IssueCreateRequest):
    """Create a new issue from an incident."""
    incident_id = request.incident_id
    
    # Verify incident exists
    incident_found = False
    for report in agent.incidents:
        if report.incident.id == incident_id:
            incident_found = True
            break
    
    if not incident_found:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    issue_id = f"issue-{uuid.uuid4()}"
    result = db.insert_issue(issue_id, incident_id, "open")
    
    if result:
        db.insert_audit_entry(
            entry_id=f"audit-{uuid.uuid4()}",
            action="create_issue",
            actor="human",
            target=issue_id,
            details=f"Created issue from incident {incident_id}",
            result="success"
        )
        return db.get_issue(issue_id)
    
    raise HTTPException(status_code=500, detail="Failed to create issue")

@app.post("/api/issues/{issue_id}/execute")
async def execute_remediation(issue_id: str):
    """Execute remediation for an issue."""
    issue = db.get_issue(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    
    incident_id = issue.get("incidentId")
    
    # Find and execute remediation
    for report in agent.incidents:
        if report.incident.id == incident_id:
            if report.decision and report.decision.action:
                try:
                    # Update status
                    db.update_issue(issue_id, status="fixing")
                    
                    result = await agent.executor.execute(report.decision.action, report.incident)
                    report.action_result = result
                    
                    # Update issue with attempt
                    attempts = issue.get("remediationAttempts", [])
                    attempts.append({
                        "id": f"attempt-{uuid.uuid4()}",
                        "action": report.decision.action,
                        "target": report.incident.source,
                        "status": result.status.value,
                        "executedAt": datetime.utcnow().isoformat() + "Z",
                        "result": result.result if result.result else None,
                        "error": result.error
                    })
                    
                    new_status = "resolved" if result.status.value == "completed" else "needs_attention"
                    db.update_issue(issue_id, status=new_status, remediation_attempts=attempts)
                    
                    db.insert_audit_entry(
                        entry_id=f"audit-{uuid.uuid4()}",
                        action="execute_remediation",
                        actor="system",
                        target=issue_id,
                        details=f"Executed {report.decision.action}",
                        result="success" if result.status.value == "completed" else "failure"
                    )
                    
                    return {
                        "success": result.status.value == "completed",
                        "message": f"Executed {report.decision.action}",
                        "issue": db.get_issue(issue_id)
                    }
                except Exception as e:
                    db.update_issue(issue_id, status="needs_attention")
                    return {"success": False, "message": str(e), "issue": db.get_issue(issue_id)}
    
    return {"success": False, "message": "No remediation available", "issue": issue}

@app.post("/api/issues/{issue_id}/retry")
async def retry_remediation(issue_id: str):
    """Retry remediation for a failed issue."""
    # Same as execute, just retry
    return await execute_remediation(issue_id)
