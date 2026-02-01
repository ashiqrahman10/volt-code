"""
Trend Predictor

Predicts future metric values and potential issues using linear regression.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class TrendPrediction:
    """Prediction result for a metric trend."""
    
    metric_name: str
    source: str
    namespace: str
    
    # Current state
    current_value: float
    trend_direction: str  # rising, falling, stable
    rate_per_minute: float  # Change per minute
    
    # Predictions
    predicted_1m: float  # Value in 1 minute
    predicted_5m: float  # Value in 5 minutes
    predicted_15m: float  # Value in 15 minutes
    
    # Threshold analysis
    threshold: float | None
    time_to_threshold: float | None  # Minutes until threshold breach
    will_breach: bool
    
    confidence: float  # 0-1
    timestamp: datetime
    
    def to_dict(self) -> dict:
        return {
            "metric_name": self.metric_name,
            "source": self.source,
            "namespace": self.namespace,
            "current_value": self.current_value,
            "trend_direction": self.trend_direction,
            "rate_per_minute": self.rate_per_minute,
            "predicted_1m": self.predicted_1m,
            "predicted_5m": self.predicted_5m,
            "predicted_15m": self.predicted_15m,
            "threshold": self.threshold,
            "time_to_threshold": self.time_to_threshold,
            "will_breach": self.will_breach,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat()
        }


class TrendPredictor:
    """
    Predicts future metric values using linear regression.
    
    Useful for:
    - Memory leak detection (predicting OOM)
    - Disk usage forecasting
    - Load prediction
    """
    
    def __init__(self):
        # Thresholds for common metrics
        self.thresholds = {
            "memory_usage_percent": 95.0,
            "cpu_usage_percent": 90.0,
            "disk_usage_percent": 90.0,
            "restart_count": 5.0,
            "error_rate": 0.1,  # 10%
        }
    
    def predict(
        self,
        metric_name: str,
        values: list[float],
        timestamps: list[float],  # Unix timestamps
        source: str,
        namespace: str,
        threshold: float | None = None
    ) -> TrendPrediction:
        """
        Predict future values of a metric.
        
        Args:
            metric_name: Name of the metric
            values: Historical values
            timestamps: Corresponding timestamps
            source: Pod/service name
            namespace: Namespace
            threshold: Optional threshold to check against
        
        Returns:
            TrendPrediction with forecasts
        """
        if len(values) < 2:
            return self._empty_prediction(metric_name, source, namespace)
        
        # Convert to numpy arrays
        y = np.array(values)
        x = np.array(timestamps)
        
        # Normalize timestamps to minutes from start
        x_min = (x - x[0]) / 60.0
        
        # Linear regression
        slope, intercept = np.polyfit(x_min, y, 1)
        
        # Calculate R² for confidence
        y_pred = slope * x_min + intercept
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        confidence = max(0, min(1, r2))
        
        # Current value and rate
        current_value = float(y[-1])
        rate_per_minute = float(slope)
        
        # Determine trend direction
        if abs(rate_per_minute) < 0.01 * abs(current_value + 0.1):
            trend_direction = "stable"
        elif rate_per_minute > 0:
            trend_direction = "rising"
        else:
            trend_direction = "falling"
        
        # Predictions
        current_time_min = float(x_min[-1])
        predicted_1m = intercept + slope * (current_time_min + 1)
        predicted_5m = intercept + slope * (current_time_min + 5)
        predicted_15m = intercept + slope * (current_time_min + 15)
        
        # Threshold analysis
        threshold = threshold or self.thresholds.get(metric_name)
        time_to_threshold = None
        will_breach = False
        
        if threshold is not None and slope > 0:
            if current_value >= threshold:
                will_breach = True
                time_to_threshold = 0
            elif slope > 0:
                # Calculate time to breach
                time_to_threshold = (threshold - current_value) / slope
                if time_to_threshold <= 15:  # Within 15 minutes
                    will_breach = True
        
        return TrendPrediction(
            metric_name=metric_name,
            source=source,
            namespace=namespace,
            current_value=current_value,
            trend_direction=trend_direction,
            rate_per_minute=rate_per_minute,
            predicted_1m=predicted_1m,
            predicted_5m=predicted_5m,
            predicted_15m=predicted_15m,
            threshold=threshold,
            time_to_threshold=time_to_threshold,
            will_breach=will_breach,
            confidence=confidence,
            timestamp=datetime.utcnow()
        )
    
    def _empty_prediction(
        self,
        metric_name: str,
        source: str,
        namespace: str
    ) -> TrendPrediction:
        """Return empty prediction when insufficient data."""
        return TrendPrediction(
            metric_name=metric_name,
            source=source,
            namespace=namespace,
            current_value=0.0,
            trend_direction="unknown",
            rate_per_minute=0.0,
            predicted_1m=0.0,
            predicted_5m=0.0,
            predicted_15m=0.0,
            threshold=None,
            time_to_threshold=None,
            will_breach=False,
            confidence=0.0,
            timestamp=datetime.utcnow()
        )
    
    def predict_oom_time(
        self,
        memory_values: list[float],
        timestamps: list[float],
        memory_limit: float,
        source: str,
        namespace: str
    ) -> TrendPrediction:
        """
        Predict time until OOM based on memory growth.
        
        Args:
            memory_values: Memory usage values (bytes or %)
            timestamps: Corresponding timestamps
            memory_limit: Memory limit
            source: Pod name
            namespace: Namespace
        
        Returns:
            TrendPrediction with OOM forecast
        """
        return self.predict(
            metric_name="memory_for_oom",
            values=memory_values,
            timestamps=timestamps,
            source=source,
            namespace=namespace,
            threshold=memory_limit * 0.95  # 95% of limit
        )


# Global predictor instance
trend_predictor = TrendPredictor()
