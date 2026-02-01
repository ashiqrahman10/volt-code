"""
Signal Normalizer

Converts raw telemetry data into normalized signals for correlation.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class SignalType(str, Enum):
    METRIC = "metric"
    LOG = "log"
    EVENT = "event"


class SignalSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class Signal:
    """Normalized signal from telemetry."""
    
    type: SignalType
    source: str  # pod name, deployment, node
    namespace: str
    name: str  # metric name, log pattern, event type
    value: Any
    severity: SignalSeverity = SignalSeverity.INFO
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "source": self.source,
            "namespace": self.namespace,
            "name": self.name,
            "value": self.value,
            "severity": self.severity.value,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata
        }


class SignalNormalizer:
    """Normalizes raw telemetry into signals."""
    
    def normalize_metric(
        self,
        metric_name: str,
        value: float,
        labels: dict[str, str],
        threshold: float | None = None
    ) -> Signal:
        """
        Normalize a Prometheus metric into a signal.
        
        Args:
            metric_name: Metric name
            value: Metric value
            labels: Metric labels
            threshold: Optional threshold for severity determination
        """
        # Extract common labels
        pod = labels.get("pod", labels.get("container", "unknown"))
        namespace = labels.get("namespace", "default")
        
        # Determine severity based on threshold
        severity = SignalSeverity.INFO
        if threshold:
            if value > threshold * 0.8:
                severity = SignalSeverity.WARNING
            if value > threshold:
                severity = SignalSeverity.CRITICAL
        
        return Signal(
            type=SignalType.METRIC,
            source=pod,
            namespace=namespace,
            name=metric_name,
            value=value,
            severity=severity,
            metadata={"labels": labels, "threshold": threshold}
        )
    
    def normalize_log(
        self,
        log_lines: list[str],
        pod: str,
        namespace: str
    ) -> list[Signal]:
        """
        Normalize log lines into signals.
        Detects error patterns.
        """
        signals = []
        error_patterns = [
            ("OOM", SignalSeverity.CRITICAL, "out_of_memory"),
            ("OutOfMemory", SignalSeverity.CRITICAL, "out_of_memory"),
            ("killed", SignalSeverity.CRITICAL, "process_killed"),
            ("timeout", SignalSeverity.WARNING, "timeout"),
            ("Timeout", SignalSeverity.WARNING, "timeout"),
            ("connection refused", SignalSeverity.WARNING, "connection_refused"),
            ("error", SignalSeverity.WARNING, "error"),
            ("Error", SignalSeverity.WARNING, "error"),
            ("failed", SignalSeverity.WARNING, "failure"),
            ("Failed", SignalSeverity.WARNING, "failure"),
            ("No space left", SignalSeverity.CRITICAL, "disk_full"),
            ("disk full", SignalSeverity.CRITICAL, "disk_full"),
        ]
        
        for line in log_lines:
            for pattern, severity, signal_name in error_patterns:
                if pattern in line:
                    signals.append(Signal(
                        type=SignalType.LOG,
                        source=pod,
                        namespace=namespace,
                        name=signal_name,
                        value=line,
                        severity=severity,
                        metadata={"pattern": pattern, "full_line": line}
                    ))
                    break  # Only one signal per line
        
        return signals
    
    def normalize_event(self, event: dict) -> Signal:
        """
        Normalize a Kubernetes event into a signal.
        """
        involved = event.get("involved_object", {})
        event_type = event.get("type", "Normal")
        reason = event.get("reason", "Unknown")
        
        # Determine severity
        severity = SignalSeverity.INFO
        if event_type == "Warning":
            severity = SignalSeverity.WARNING
        
        # Critical reasons
        critical_reasons = ["OOMKilled", "OOMKilling", "FailedMount", "FailedScheduling"]
        if reason in critical_reasons:
            severity = SignalSeverity.CRITICAL
        
        return Signal(
            type=SignalType.EVENT,
            source=involved.get("name", "unknown"),
            namespace=event.get("namespace", "default"),
            name=reason,
            value=event.get("message", ""),
            severity=severity,
            metadata={
                "count": event.get("count", 1),
                "object_kind": involved.get("kind"),
                "first_timestamp": event.get("first_timestamp"),
                "last_timestamp": event.get("last_timestamp")
            }
        )


# Global normalizer instance
normalizer = SignalNormalizer()
