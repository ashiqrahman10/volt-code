"""
Anomaly Detector

Uses Isolation Forest for unsupervised anomaly detection on metrics.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    IsolationForest = None
    StandardScaler = None

from .feature_extractor import MetricFeatures, LogFeatures

logger = logging.getLogger(__name__)


@dataclass
class AnomalyResult:
    """Result of anomaly detection."""
    
    source: str  # Pod/service name
    namespace: str
    anomaly_score: float  # 0-1, higher = more anomalous
    is_anomaly: bool
    anomaly_type: str  # metric, log, combined
    contributing_factors: list[str]
    timestamp: datetime
    
    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "namespace": self.namespace,
            "anomaly_score": self.anomaly_score,
            "is_anomaly": self.is_anomaly,
            "anomaly_type": self.anomaly_type,
            "contributing_factors": self.contributing_factors,
            "timestamp": self.timestamp.isoformat()
        }


class MetricAnomalyDetector:
    """
    Isolation Forest-based anomaly detector for metrics.
    
    Learns normal metric patterns and detects outliers.
    """
    
    def __init__(self, contamination: float = 0.1):
        """
        Args:
            contamination: Expected proportion of anomalies (0.1 = 10%)
        """
        if not SKLEARN_AVAILABLE:
            logger.warning("scikit-learn not installed, using fallback detection")
            self.model = None
            self.scaler = None
        else:
            self.model = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=100
            )
            self.scaler = StandardScaler()
        
        self._is_trained = False
        self._training_data: list[np.ndarray] = []
        self._min_training_samples = 10
    
    def add_training_sample(self, features: MetricFeatures):
        """Add a sample for training the model."""
        self._training_data.append(features.to_vector())
        
        # Auto-train when we have enough samples
        if len(self._training_data) >= self._min_training_samples and not self._is_trained:
            self.train()
    
    def train(self):
        """Train the model on collected samples."""
        if not SKLEARN_AVAILABLE:
            self._is_trained = True
            return
        
        if len(self._training_data) < self._min_training_samples:
            logger.warning(f"Not enough training data: {len(self._training_data)} < {self._min_training_samples}")
            return
        
        X = np.array(self._training_data)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train Isolation Forest
        self.model.fit(X_scaled)
        self._is_trained = True
        
        logger.info(f"Trained anomaly detector on {len(self._training_data)} samples")
    
    def detect(self, features: MetricFeatures) -> AnomalyResult:
        """
        Detect if the given metrics are anomalous.
        
        Args:
            features: Extracted metric features
        
        Returns:
            AnomalyResult with anomaly score
        """
        contributing_factors = []
        
        # If not trained, use heuristic-based detection
        if not self._is_trained or not SKLEARN_AVAILABLE:
            return self._heuristic_detect(features)
        
        # Get feature vector
        X = features.to_vector().reshape(1, -1)
        X_scaled = self.scaler.transform(X)
        
        # Get anomaly score (-1 for anomalies, 1 for normal)
        # Convert to 0-1 score where higher = more anomalous
        raw_score = self.model.decision_function(X_scaled)[0]
        
        # Normalize: decision_function returns negative for anomalies
        # More negative = more anomalous
        # Convert to 0-1 where 1 = very anomalous
        anomaly_score = max(0, min(1, (0.5 - raw_score) / 0.5))
        
        # Identify contributing factors
        if features.rate_of_change > 0.1:
            contributing_factors.append(f"High rate of change: {features.rate_of_change:.3f}")
        if features.spike_count > 0:
            contributing_factors.append(f"Detected {features.spike_count} spikes")
        if features.std > features.mean * 0.5:
            contributing_factors.append(f"High variance (std={features.std:.2f})")
        if features.p99 > features.p50 * 2:
            contributing_factors.append(f"P99 ({features.p99:.1f}) >> P50 ({features.p50:.1f})")
        
        is_anomaly = anomaly_score > 0.6
        
        return AnomalyResult(
            source=features.pod,
            namespace=features.namespace,
            anomaly_score=anomaly_score,
            is_anomaly=is_anomaly,
            anomaly_type="metric",
            contributing_factors=contributing_factors,
            timestamp=datetime.utcnow()
        )
    
    def _heuristic_detect(self, features: MetricFeatures) -> AnomalyResult:
        """Fallback heuristic-based detection when model not trained."""
        score = 0.0
        factors = []
        
        # High rate of change
        if abs(features.rate_of_change) > 0.1:
            score += 0.3
            factors.append(f"High rate of change: {features.rate_of_change:.3f}")
        
        # Spikes
        if features.spike_count > 2:
            score += 0.2
            factors.append(f"Multiple spikes: {features.spike_count}")
        
        # High variance relative to mean
        if features.mean > 0 and features.std > features.mean * 0.3:
            score += 0.2
            factors.append(f"High variance: std/mean = {features.std/features.mean:.2f}")
        
        # P99 >> P50 indicates tail latency issues
        if features.p50 > 0 and features.p99 > features.p50 * 3:
            score += 0.3
            factors.append(f"Tail latency: p99/p50 = {features.p99/features.p50:.1f}")
        
        return AnomalyResult(
            source=features.pod,
            namespace=features.namespace,
            anomaly_score=min(1.0, score),
            is_anomaly=score > 0.5,
            anomaly_type="metric",
            contributing_factors=factors,
            timestamp=datetime.utcnow()
        )


class LogAnomalyDetector:
    """
    Detects anomalies in log patterns.
    
    Uses frequency analysis and keyword detection.
    """
    
    def __init__(self):
        self._baseline_error_rate: float = 0.05  # Expected 5% errors
        self._baseline_logs_per_second: float = 1.0
    
    def set_baseline(self, error_rate: float, logs_per_second: float):
        """Set baseline values for comparison."""
        self._baseline_error_rate = error_rate
        self._baseline_logs_per_second = logs_per_second
    
    def detect(self, features: LogFeatures) -> AnomalyResult:
        """
        Detect anomalies in log patterns.
        
        Args:
            features: Extracted log features
        
        Returns:
            AnomalyResult with anomaly score
        """
        score = 0.0
        factors = []
        
        # Error rate spike
        if features.error_rate > self._baseline_error_rate * 2:
            score += 0.3
            factors.append(f"Error rate {features.error_rate:.1%} > baseline {self._baseline_error_rate:.1%}")
        
        # Log volume spike
        if self._baseline_logs_per_second > 0:
            volume_ratio = features.logs_per_second / self._baseline_logs_per_second
            if volume_ratio > 3:
                score += 0.2
                factors.append(f"Log volume {volume_ratio:.1f}x normal")
        
        # New patterns (could indicate new error types)
        if features.new_patterns > 3:
            score += 0.2
            factors.append(f"{features.new_patterns} new log patterns detected")
        
        # Critical keywords
        if features.has_oom:
            score += 0.4
            factors.append("OOM/memory keywords detected")
        if features.has_crash:
            score += 0.3
            factors.append("Crash/panic keywords detected")
        if features.has_timeout:
            score += 0.2
            factors.append("Timeout keywords detected")
        if features.has_connection_error:
            score += 0.2
            factors.append("Connection error keywords detected")
        
        return AnomalyResult(
            source=features.pod,
            namespace=features.namespace,
            anomaly_score=min(1.0, score),
            is_anomaly=score > 0.5,
            anomaly_type="log",
            contributing_factors=factors,
            timestamp=datetime.utcnow()
        )


class CombinedAnomalyDetector:
    """
    Combines metric and log anomaly detection.
    """
    
    def __init__(self):
        self.metric_detector = MetricAnomalyDetector()
        self.log_detector = LogAnomalyDetector()
    
    def detect(
        self,
        metric_features: MetricFeatures | None,
        log_features: LogFeatures | None
    ) -> AnomalyResult:
        """
        Combined anomaly detection.
        
        Args:
            metric_features: Metric features (optional)
            log_features: Log features (optional)
        
        Returns:
            Combined AnomalyResult
        """
        scores = []
        factors = []
        source = "unknown"
        namespace = "default"
        
        if metric_features:
            result = self.metric_detector.detect(metric_features)
            scores.append(result.anomaly_score)
            factors.extend([f"[metric] {f}" for f in result.contributing_factors])
            source = metric_features.pod
            namespace = metric_features.namespace
        
        if log_features:
            result = self.log_detector.detect(log_features)
            scores.append(result.anomaly_score)
            factors.extend([f"[log] {f}" for f in result.contributing_factors])
            source = log_features.pod
            namespace = log_features.namespace
        
        if not scores:
            return AnomalyResult(
                source=source,
                namespace=namespace,
                anomaly_score=0.0,
                is_anomaly=False,
                anomaly_type="combined",
                contributing_factors=[],
                timestamp=datetime.utcnow()
            )
        
        # Combine scores (max with boost for multiple signals)
        combined_score = max(scores)
        if len(scores) > 1 and all(s > 0.3 for s in scores):
            combined_score = min(1.0, combined_score + 0.2)
            factors.append("Multiple anomaly sources corroborate")
        
        return AnomalyResult(
            source=source,
            namespace=namespace,
            anomaly_score=combined_score,
            is_anomaly=combined_score > 0.5,
            anomaly_type="combined",
            contributing_factors=factors,
            timestamp=datetime.utcnow()
        )


# Global detector instance
anomaly_detector = CombinedAnomalyDetector()
