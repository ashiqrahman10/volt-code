"""
Feature Extractor

Extracts features from metrics and logs for ML anomaly detection.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class MetricFeatures:
    """Extracted features from a time series metric."""
    
    name: str
    pod: str
    namespace: str
    
    # Statistical features
    mean: float = 0.0
    std: float = 0.0
    min_val: float = 0.0
    max_val: float = 0.0
    
    # Trend features
    rate_of_change: float = 0.0  # Slope of linear fit
    variance_change: float = 0.0  # Change in variance
    
    # Percentiles
    p50: float = 0.0
    p90: float = 0.0
    p99: float = 0.0
    
    # Spike detection
    spike_count: int = 0  # Values > 2 std from mean
    
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_vector(self) -> np.ndarray:
        """Convert to feature vector for ML model."""
        return np.array([
            self.mean,
            self.std,
            self.min_val,
            self.max_val,
            self.rate_of_change,
            self.variance_change,
            self.p50,
            self.p90,
            self.p99,
            self.spike_count
        ])


@dataclass  
class LogFeatures:
    """Extracted features from log messages."""
    
    pod: str
    namespace: str
    
    # Frequency features
    total_logs: int = 0
    error_count: int = 0
    warning_count: int = 0
    
    # Pattern features
    unique_patterns: int = 0
    new_patterns: int = 0  # Patterns not seen before
    
    # Rate features
    logs_per_second: float = 0.0
    error_rate: float = 0.0
    
    # Keywords
    has_oom: bool = False
    has_timeout: bool = False
    has_connection_error: bool = False
    has_crash: bool = False
    
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_vector(self) -> np.ndarray:
        """Convert to feature vector for ML model."""
        return np.array([
            self.total_logs,
            self.error_count,
            self.warning_count,
            self.unique_patterns,
            self.new_patterns,
            self.logs_per_second,
            self.error_rate,
            float(self.has_oom),
            float(self.has_timeout),
            float(self.has_connection_error),
            float(self.has_crash)
        ])


class FeatureExtractor:
    """Extracts ML features from raw metrics and logs."""
    
    # Keywords indicating issues
    ERROR_KEYWORDS = ['error', 'fail', 'exception', 'crash', 'panic']
    WARNING_KEYWORDS = ['warn', 'warning', 'deprecated', 'slow']
    OOM_KEYWORDS = ['oom', 'out of memory', 'oomkilled', 'memory limit']
    TIMEOUT_KEYWORDS = ['timeout', 'timed out', 'deadline exceeded']
    CONNECTION_KEYWORDS = ['connection refused', 'connection reset', 'no route to host']
    CRASH_KEYWORDS = ['crash', 'segfault', 'sigsegv', 'panic', 'fatal']
    
    def __init__(self):
        self._known_log_patterns: set[str] = set()
    
    def extract_metric_features(
        self,
        name: str,
        values: list[float],
        pod: str,
        namespace: str
    ) -> MetricFeatures:
        """
        Extract features from a metric time series.
        
        Args:
            name: Metric name
            values: Time series values
            pod: Pod name
            namespace: Namespace
        
        Returns:
            MetricFeatures object
        """
        if not values:
            return MetricFeatures(name=name, pod=pod, namespace=namespace)
        
        arr = np.array(values)
        
        # Statistical features
        mean = float(np.mean(arr))
        std = float(np.std(arr))
        
        # Percentiles
        p50 = float(np.percentile(arr, 50))
        p90 = float(np.percentile(arr, 90))
        p99 = float(np.percentile(arr, 99))
        
        # Rate of change (linear regression slope)
        if len(arr) > 1:
            x = np.arange(len(arr))
            slope = np.polyfit(x, arr, 1)[0]
            rate_of_change = float(slope)
        else:
            rate_of_change = 0.0
        
        # Variance change (compare first half to second half)
        if len(arr) >= 4:
            mid = len(arr) // 2
            var1 = np.var(arr[:mid])
            var2 = np.var(arr[mid:])
            variance_change = float(var2 - var1)
        else:
            variance_change = 0.0
        
        # Spike detection
        if std > 0:
            spikes = np.abs(arr - mean) > 2 * std
            spike_count = int(np.sum(spikes))
        else:
            spike_count = 0
        
        return MetricFeatures(
            name=name,
            pod=pod,
            namespace=namespace,
            mean=mean,
            std=std,
            min_val=float(np.min(arr)),
            max_val=float(np.max(arr)),
            rate_of_change=rate_of_change,
            variance_change=variance_change,
            p50=p50,
            p90=p90,
            p99=p99,
            spike_count=spike_count
        )
    
    def extract_log_features(
        self,
        logs: list[str],
        pod: str,
        namespace: str,
        time_window_seconds: float = 60.0
    ) -> LogFeatures:
        """
        Extract features from log messages.
        
        Args:
            logs: List of log messages
            pod: Pod name
            namespace: Namespace
            time_window_seconds: Time window for rate calculation
        
        Returns:
            LogFeatures object
        """
        if not logs:
            return LogFeatures(pod=pod, namespace=namespace)
        
        # Count by severity
        error_count = 0
        warning_count = 0
        
        # Pattern tracking
        patterns = set()
        new_patterns = 0
        
        # Keyword detection
        has_oom = False
        has_timeout = False
        has_connection_error = False
        has_crash = False
        
        for log in logs:
            log_lower = log.lower()
            
            # Severity detection
            if any(kw in log_lower for kw in self.ERROR_KEYWORDS):
                error_count += 1
            elif any(kw in log_lower for kw in self.WARNING_KEYWORDS):
                warning_count += 1
            
            # Pattern extraction (first 50 chars, normalized)
            pattern = self._extract_pattern(log)
            patterns.add(pattern)
            
            if pattern not in self._known_log_patterns:
                new_patterns += 1
                self._known_log_patterns.add(pattern)
            
            # Keyword detection
            if any(kw in log_lower for kw in self.OOM_KEYWORDS):
                has_oom = True
            if any(kw in log_lower for kw in self.TIMEOUT_KEYWORDS):
                has_timeout = True
            if any(kw in log_lower for kw in self.CONNECTION_KEYWORDS):
                has_connection_error = True
            if any(kw in log_lower for kw in self.CRASH_KEYWORDS):
                has_crash = True
        
        total_logs = len(logs)
        logs_per_second = total_logs / time_window_seconds if time_window_seconds > 0 else 0
        error_rate = error_count / total_logs if total_logs > 0 else 0
        
        return LogFeatures(
            pod=pod,
            namespace=namespace,
            total_logs=total_logs,
            error_count=error_count,
            warning_count=warning_count,
            unique_patterns=len(patterns),
            new_patterns=new_patterns,
            logs_per_second=logs_per_second,
            error_rate=error_rate,
            has_oom=has_oom,
            has_timeout=has_timeout,
            has_connection_error=has_connection_error,
            has_crash=has_crash
        )
    
    def _extract_pattern(self, log: str) -> str:
        """
        Extract a pattern from a log message.
        Normalizes numbers and IDs to detect similar messages.
        """
        import re
        
        # Take first 100 chars
        pattern = log[:100]
        
        # Replace numbers with placeholder
        pattern = re.sub(r'\d+', '<NUM>', pattern)
        
        # Replace UUIDs
        pattern = re.sub(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', '<UUID>', pattern, flags=re.IGNORECASE)
        
        # Replace IP addresses
        pattern = re.sub(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', '<IP>', pattern)
        
        return pattern.strip()
    
    def reset_patterns(self):
        """Reset known log patterns (for retraining)."""
        self._known_log_patterns.clear()


# Global extractor instance
feature_extractor = FeatureExtractor()
