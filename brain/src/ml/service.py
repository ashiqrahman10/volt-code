"""
ML Anomaly Detection Service

Simple flow:
1. Collect metrics and logs from the cluster
2. ML detects if anything looks anomalous
3. If anomaly found, send the raw data to LLM for intelligent analysis
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..mcp_client import MCPClient
from .feature_extractor import FeatureExtractor, MetricFeatures, LogFeatures
from .anomaly_detector import CombinedAnomalyDetector, AnomalyResult

logger = logging.getLogger(__name__)


@dataclass
class AnomalyContext:
    """
    Context collected when an anomaly is detected.
    This entire context is sent to the LLM for analysis.
    """
    
    pod: str
    namespace: str
    anomaly_score: float
    anomaly_type: str  # metric, log, combined
    contributing_factors: list[str]
    
    # Raw data for LLM analysis
    raw_metrics: dict = field(default_factory=dict)
    raw_logs: list[str] = field(default_factory=list)
    raw_events: list[dict] = field(default_factory=list)
    
    # Feature summary
    metric_features: dict | None = None
    log_features: dict | None = None
    
    detected_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_llm_prompt(self) -> str:
        """Format this context as a prompt for the LLM."""
        sections = []
        
        sections.append(f"## Anomaly Detected")
        sections.append(f"- **Pod**: {self.pod}")
        sections.append(f"- **Namespace**: {self.namespace}")
        sections.append(f"- **Anomaly Score**: {self.anomaly_score:.2f}")
        sections.append(f"- **Type**: {self.anomaly_type}")
        sections.append(f"- **Contributing Factors**: {', '.join(self.contributing_factors)}")
        sections.append("")
        
        if self.raw_metrics:
            sections.append("## Metrics")
            for name, values in self.raw_metrics.items():
                if isinstance(values, list):
                    sections.append(f"- **{name}**: {values[-5:] if len(values) > 5 else values}")
                else:
                    sections.append(f"- **{name}**: {values}")
            sections.append("")
        
        if self.metric_features:
            sections.append("## Metric Analysis")
            for k, v in self.metric_features.items():
                sections.append(f"- {k}: {v}")
            sections.append("")
        
        if self.raw_logs:
            sections.append("## Recent Logs")
            sections.append("```")
            for log in self.raw_logs[-30:]:  # Last 30 logs
                sections.append(log[:200])  # Truncate long lines
            sections.append("```")
            sections.append("")
        
        if self.log_features:
            sections.append("## Log Analysis")
            for k, v in self.log_features.items():
                sections.append(f"- {k}: {v}")
            sections.append("")
        
        if self.raw_events:
            sections.append("## Kubernetes Events")
            for event in self.raw_events[-10:]:  # Last 10 events
                sections.append(f"- [{event.get('type', 'Unknown')}] {event.get('reason', 'Unknown')}: {event.get('message', '')[:100]}")
            sections.append("")
        
        return "\n".join(sections)
    
    def to_dict(self) -> dict:
        return {
            "pod": self.pod,
            "namespace": self.namespace,
            "anomaly_score": self.anomaly_score,
            "anomaly_type": self.anomaly_type,
            "contributing_factors": self.contributing_factors,
            "raw_metrics": self.raw_metrics,
            "raw_logs": self.raw_logs[-30:],  # Limit for JSON
            "raw_events": self.raw_events[-10:],
            "metric_features": self.metric_features,
            "log_features": self.log_features,
            "detected_at": self.detected_at.isoformat()
        }


class AnomalyDetectionService:
    """
    Service that:
    1. Collects telemetry data
    2. Runs ML anomaly detection
    3. Returns context for LLM analysis when anomalies are found
    """
    
    def __init__(self, mcp: MCPClient):
        self.mcp = mcp
        self.feature_extractor = FeatureExtractor()
        self.anomaly_detector = CombinedAnomalyDetector()
        
        # Threshold for reporting anomalies
        self.anomaly_threshold = 0.3
    
    async def scan_for_anomalies(
        self,
        namespace: str | None = None
    ) -> list[AnomalyContext]:
        """
        Scan the cluster for anomalies.
        
        Returns list of AnomalyContext for any detected anomalies.
        These should be sent to the LLM for analysis.
        """
        anomalies = []
        
        # Get all pods with restarts (potential issues)
        pods_to_check = await self._get_pods_with_activity(namespace)
        
        for pod_info in pods_to_check:
            pod = pod_info["pod"]
            ns = pod_info["namespace"]
            
            try:
                context = await self._analyze_pod(pod, ns)
                if context and context.anomaly_score >= self.anomaly_threshold:
                    anomalies.append(context)
                    logger.info(
                        f"Anomaly detected: {pod} (score: {context.anomaly_score:.2f})"
                    )
            except Exception as e:
                logger.warning(f"Failed to analyze pod {pod}: {e}")
        
        return anomalies
    
    async def _get_pods_with_activity(
        self,
        namespace: str | None
    ) -> list[dict]:
        """Get pods that have recent activity (restarts, high resource usage)."""
        pods = []
        
        # Pods with restarts
        try:
            result = await self.mcp.prom_query(
                "kube_pod_container_status_restarts_total > 0"
            )
            for item in result.get("data", {}).get("result", []):
                labels = item["metric"]
                pod = labels.get("pod", "")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                if pod:
                    pods.append({"pod": pod, "namespace": ns, "reason": "restarts"})
        except Exception as e:
            logger.warning(f"Failed to get restart info: {e}")
        
        # Pods with high memory (>70%)
        try:
            result = await self.mcp.prom_query("""
                (container_memory_working_set_bytes{container!="", container!="POD"} 
                / container_spec_memory_limit_bytes{container!="", container!="POD"}) > 0.7
            """)
            for item in result.get("data", {}).get("result", []):
                labels = item["metric"]
                pod = labels.get("pod", "")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                if pod and not any(p["pod"] == pod for p in pods):
                    pods.append({"pod": pod, "namespace": ns, "reason": "high_memory"})
        except Exception as e:
            logger.debug(f"Failed to get memory info: {e}")
        
        return pods
    
    async def _analyze_pod(
        self,
        pod: str,
        namespace: str
    ) -> AnomalyContext | None:
        """Collect data and analyze a single pod for anomalies."""
        
        raw_metrics = {}
        raw_logs = []
        raw_events = []
        
        # 1. Collect metrics
        try:
            # Memory usage
            result = await self.mcp.prom_query(
                f'container_memory_working_set_bytes{{pod="{pod}",container!="",container!="POD"}}'
            )
            if result.get("data", {}).get("result"):
                raw_metrics["memory_bytes"] = float(result["data"]["result"][0]["value"][1])
            
            # Restart count
            result = await self.mcp.prom_query(
                f'kube_pod_container_status_restarts_total{{pod="{pod}"}}'
            )
            if result.get("data", {}).get("result"):
                raw_metrics["restart_count"] = float(result["data"]["result"][0]["value"][1])
            
            # Memory over time (for trend)
            result = await self.mcp.prom_query_range(
                query=f'container_memory_working_set_bytes{{pod="{pod}",container!="",container!="POD"}}',
                start="5m",
                end="now",
                step="30s"
            )
            if result.get("data", {}).get("result"):
                values = [float(v[1]) for v in result["data"]["result"][0].get("values", [])]
                raw_metrics["memory_history"] = values
        except Exception as e:
            logger.debug(f"Failed to get metrics for {pod}: {e}")
        
        # 2. Collect logs
        try:
            logs_result = await self.mcp.tail_logs(
                pod=pod,
                namespace=namespace,
                lines=100
            )
            raw_logs = logs_result.get("logs", [])
        except Exception as e:
            logger.debug(f"Failed to get logs for {pod}: {e}")
        
        # 3. Collect events
        try:
            events_result = await self.mcp.get_events(
                namespace=namespace,
                resource_name=pod,
                limit=20
            )
            raw_events = events_result.get("events", [])
        except Exception as e:
            logger.debug(f"Failed to get events for {pod}: {e}")
        
        # 4. Extract features and detect anomalies
        metric_features = None
        log_features = None
        anomaly_result = None
        
        if "memory_history" in raw_metrics and len(raw_metrics["memory_history"]) >= 3:
            metric_features = self.feature_extractor.extract_metric_features(
                name="memory",
                values=raw_metrics["memory_history"],
                pod=pod,
                namespace=namespace
            )
            
            anomaly_result = self.anomaly_detector.metric_detector.detect(metric_features)
        
        if raw_logs:
            log_features = self.feature_extractor.extract_log_features(
                logs=raw_logs,
                pod=pod,
                namespace=namespace
            )
            
            log_anomaly = self.anomaly_detector.log_detector.detect(log_features)
            
            # Combine with metric anomaly
            if anomaly_result:
                combined_score = max(anomaly_result.anomaly_score, log_anomaly.anomaly_score)
                if anomaly_result.anomaly_score > 0.2 and log_anomaly.anomaly_score > 0.2:
                    combined_score = min(1.0, combined_score + 0.2)
                anomaly_result = AnomalyResult(
                    source=pod,
                    namespace=namespace,
                    anomaly_score=combined_score,
                    is_anomaly=combined_score > 0.3,
                    anomaly_type="combined",
                    contributing_factors=anomaly_result.contributing_factors + log_anomaly.contributing_factors,
                    timestamp=datetime.utcnow()
                )
            else:
                anomaly_result = log_anomaly
        
        # 5. Event-based anomaly detection (for CrashLoopBackOff, OOMKilled, etc.)
        if raw_events and not anomaly_result:
            event_score = 0.0
            event_factors = []
            
            for event in raw_events:
                reason = event.get("reason", "").lower()
                event_type = event.get("type", "").lower()
                message = event.get("message", "").lower()
                
                # Critical events
                if reason in ["backoff", "crashloopbackoff", "oomkilled", "failed"]:
                    event_score = max(event_score, 0.8)
                    event_factors.append(f"Event: {event.get('reason')} - {event.get('message', '')[:80]}")
                elif event_type == "warning":
                    event_score = max(event_score, 0.5)
                    event_factors.append(f"Warning: {event.get('reason')} - {event.get('message', '')[:60]}")
                
                # OOMKilled in message
                if "oomkilled" in message or "out of memory" in message:
                    event_score = max(event_score, 0.9)
                    event_factors.append("OOMKilled detected in events")
            
            if event_score > 0:
                anomaly_result = AnomalyResult(
                    source=pod,
                    namespace=namespace,
                    anomaly_score=event_score,
                    is_anomaly=event_score >= self.anomaly_threshold,
                    anomaly_type="event",
                    contributing_factors=event_factors,
                    timestamp=datetime.utcnow()
                )
        
        # If no anomaly detected, return None
        if not anomaly_result or anomaly_result.anomaly_score < self.anomaly_threshold:
            return None
        
        # Build context for LLM
        return AnomalyContext(
            pod=pod,
            namespace=namespace,
            anomaly_score=anomaly_result.anomaly_score,
            anomaly_type=anomaly_result.anomaly_type,
            contributing_factors=anomaly_result.contributing_factors,
            raw_metrics=raw_metrics,
            raw_logs=raw_logs,
            raw_events=raw_events,
            metric_features=asdict_safe(metric_features) if metric_features else None,
            log_features=asdict_safe(log_features) if log_features else None
        )



def asdict_safe(obj) -> dict | None:
    """Convert dataclass to dict, handling non-serializable types."""
    if obj is None:
        return None
    try:
        from dataclasses import asdict
        d = asdict(obj)
        # Remove non-serializable
        return {k: v for k, v in d.items() if not callable(v)}
    except:
        return None


# Global service instance (will be initialized with MCP client)
_anomaly_service: AnomalyDetectionService | None = None


def get_anomaly_service(mcp: MCPClient) -> AnomalyDetectionService:
    """Get or create the anomaly detection service."""
    global _anomaly_service
    if _anomaly_service is None:
        _anomaly_service = AnomalyDetectionService(mcp)
    return _anomaly_service
