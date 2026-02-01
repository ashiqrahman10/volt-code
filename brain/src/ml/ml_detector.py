"""
ML-Based Detector

Integrates ML anomaly detection with the existing detector framework.
"""

import logging
from typing import Any

from ..data_adapter import DataSource
from ..signals.normalizer import Signal, SignalType, SignalSeverity, SignalNormalizer
from ..signals.correlator import IncidentCandidate, SignalCorrelator
from ..detectors.base import BaseDetector
from .feature_extractor import FeatureExtractor, MetricFeatures, LogFeatures
from .anomaly_detector import CombinedAnomalyDetector, AnomalyResult
from .predictor import TrendPredictor, TrendPrediction

logger = logging.getLogger(__name__)


class MLAnomalyDetector(BaseDetector):
    """
    ML-based detector that uses anomaly detection and trend prediction
    to identify potential issues before they become incidents.
    """
    
    incident_type = "early_warning"
    
    def __init__(
        self,
        data_source: DataSource,
        normalizer: SignalNormalizer | None = None,
        correlator: SignalCorrelator | None = None
    ):
        # We don't pass mcp to super because BaseDetector expects it.
        # We need to adjust BaseDetector or just not call super().__init__ if it's strictly MCP.
        # Let's check BaseDetector. It likely sets self.mcp.
        # For now, let's just set self.data_source and avoid using self.mcp in THIS class.
        
        # NOTE: BaseDetector init signature is (mcp_client, normalizer, correlator).
        # We are passing None for mcp_client to super() to avoid type issues if possible, 
        # or we need to refactor BaseDetector too.
        # Let's assume we can pass None or a dummy.
        super().__init__(None, normalizer, correlator)
        
        self.data_source = data_source
        
        self.feature_extractor = FeatureExtractor()
        self.anomaly_detector = CombinedAnomalyDetector()
        self.trend_predictor = TrendPredictor()
    
    async def collect_signals(self, namespace: str | None = None) -> list[Signal]:
        """
        Collect signals using ML anomaly detection.
        
        Queries metrics and logs, extracts features, and detects anomalies.
        """
        signals = []
        
        # 1. Analyze memory usage trends
        memory_signals = await self._analyze_memory_trends(namespace)
        signals.extend(memory_signals)
        
        # 2. Analyze CPU trends
        cpu_signals = await self._analyze_cpu_trends(namespace)
        signals.extend(cpu_signals)
        
        # 3. Analyze restart patterns
        restart_signals = await self._analyze_restarts(namespace)
        signals.extend(restart_signals)
        
        # 4. Analyze pod logs
        log_signals = await self._analyze_logs(namespace)
        signals.extend(log_signals)
        
        return signals
    
    async def _analyze_memory_trends(self, namespace: str | None) -> list[Signal]:
        """Analyze memory usage for anomalies and trends."""
        signals = []
        
        try:
            # Query memory usage over last 5 minutes
            query = """
            avg_over_time(
                container_memory_working_set_bytes{container!="", container!="POD"}[5m]
            )
            """
            result = await self.data_source.prom_query(query)
            
            if not result.get("data", {}).get("result"):
                return signals
            
            for item in result["data"]["result"]:
                labels = item["metric"]
                pod = labels.get("pod", "unknown")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                
                value = float(item["value"][1])
                
                # Query time series for trend analysis
                range_query = f'container_memory_working_set_bytes{{pod="{pod}",container!="",container!="POD"}}[5m]'
                range_result = await self.data_source.prom_query_range(
                    query=range_query,
                    start="5m",
                    end="now",
                    step="30s"
                )
                
                if range_result.get("data", {}).get("result"):
                    # Extract values and timestamps
                    values = []
                    timestamps = []
                    for point in range_result["data"]["result"][0].get("values", []):
                        timestamps.append(float(point[0]))
                        values.append(float(point[1]))
                    
                    if len(values) >= 3:
                        # Extract features
                        features = self.feature_extractor.extract_metric_features(
                            name="memory_usage",
                            values=values,
                            pod=pod,
                            namespace=ns
                        )
                        
                        # Detect anomalies
                        anomaly = self.anomaly_detector.metric_detector.detect(features)
                        
                        if anomaly.is_anomaly:
                            signals.append(Signal(
                                type=SignalType.METRIC,
                                source=pod,
                                namespace=ns,
                                name="memory_anomaly",
                                value=f"Anomaly score: {anomaly.anomaly_score:.2f}",
                                severity=SignalSeverity.WARNING if anomaly.anomaly_score < 0.7 else SignalSeverity.CRITICAL,
                                metadata={
                                    "anomaly_score": anomaly.anomaly_score,
                                    "contributing_factors": anomaly.contributing_factors,
                                    "rate_of_change": features.rate_of_change,
                                    "spike_count": features.spike_count
                                }
                            ))
                        
                        # Check trend prediction
                        prediction = self.trend_predictor.predict(
                            metric_name="memory_usage_percent",
                            values=[v / 1e9 for v in values],  # Convert to GB for readability
                            timestamps=timestamps,
                            source=pod,
                            namespace=ns
                        )
                        
                        if prediction.will_breach and prediction.time_to_threshold:
                            signals.append(Signal(
                                type=SignalType.METRIC,
                                source=pod,
                                namespace=ns,
                                name="memory_breach_prediction",
                                value=f"Predicted breach in {prediction.time_to_threshold:.1f} min",
                                severity=SignalSeverity.WARNING,
                                metadata={
                                    "prediction": prediction.to_dict(),
                                    "trend_direction": prediction.trend_direction,
                                    "confidence": prediction.confidence
                                }
                            ))
        
        except Exception as e:
            logger.warning(f"Failed to analyze memory trends: {e}")
        
        return signals
    
    async def _analyze_cpu_trends(self, namespace: str | None) -> list[Signal]:
        """Analyze CPU usage for anomalies."""
        signals = []
        
        try:
            query = """
            rate(container_cpu_usage_seconds_total{container!="", container!="POD"}[5m]) * 100
            """
            result = await self.data_source.prom_query(query)
            
            if not result.get("data", {}).get("result"):
                return signals
            
            for item in result["data"]["result"]:
                labels = item["metric"]
                pod = labels.get("pod", "unknown")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                
                cpu_percent = float(item["value"][1])
                
                # High CPU usage
                if cpu_percent > 80:
                    severity = SignalSeverity.CRITICAL if cpu_percent > 95 else SignalSeverity.WARNING
                    signals.append(Signal(
                        type=SignalType.METRIC,
                        source=pod,
                        namespace=ns,
                        name="high_cpu_usage",
                        value=f"{cpu_percent:.1f}% CPU",
                        severity=severity,
                        metadata={"cpu_percent": cpu_percent}
                    ))
        
        except Exception as e:
            logger.warning(f"Failed to analyze CPU trends: {e}")
        
        return signals
    
    async def _analyze_restarts(self, namespace: str | None) -> list[Signal]:
        """Analyze pod restart patterns."""
        signals = []
        
        try:
            # Restart rate over last 5 minutes
            query = """
            increase(kube_pod_container_status_restarts_total[5m]) > 0
            """
            result = await self.data_source.prom_query(query)
            
            if not result.get("data", {}).get("result"):
                return signals
            
            for item in result["data"]["result"]:
                labels = item["metric"]
                pod = labels.get("pod", "unknown")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                
                restart_rate = float(item["value"][1])
                
                if restart_rate >= 1:
                    severity = SignalSeverity.CRITICAL if restart_rate >= 3 else SignalSeverity.WARNING
                    signals.append(Signal(
                        type=SignalType.METRIC,
                        source=pod,
                        namespace=ns,
                        name="restart_spike",
                        value=f"{restart_rate:.0f} restarts in 5m",
                        severity=severity,
                        metadata={"restart_rate": restart_rate}
                    ))
        
        except Exception as e:
            logger.warning(f"Failed to analyze restarts: {e}")
        
        return signals
    
    async def _analyze_logs(self, namespace: str | None) -> list[Signal]:
        """Analyze pod logs for anomalies."""
        signals = []
        
        try:
            # Get pods with recent restarts (potential issues)
            result = await self.data_source.prom_query(
                "kube_pod_container_status_restarts_total > 0"
            )
            
            if not result.get("data", {}).get("result"):
                return signals
            
            # Analyze logs for each pod with restarts
            for item in result["data"]["result"]:
                labels = item["metric"]
                pod = labels.get("pod", "unknown")
                ns = labels.get("namespace", "default")
                
                if namespace and ns != namespace:
                    continue
                
                # Get recent logs
                try:
                    logs_result = await self.data_source.tail_logs(
                        pod=pod,
                        namespace=ns,
                        lines=100
                    )
                    
                    logs = logs_result.get("logs", [])
                    if logs:
                        # Extract log features
                        log_features = self.feature_extractor.extract_log_features(
                            logs=logs,
                            pod=pod,
                            namespace=ns
                        )
                        
                        # Detect log anomalies
                        anomaly = self.anomaly_detector.log_detector.detect(log_features)
                        
                        if anomaly.is_anomaly:
                            signals.append(Signal(
                                type=SignalType.LOG,
                                source=pod,
                                namespace=ns,
                                name="log_anomaly",
                                value=f"Log anomaly score: {anomaly.anomaly_score:.2f}",
                                severity=SignalSeverity.WARNING if anomaly.anomaly_score < 0.7 else SignalSeverity.CRITICAL,
                                metadata={
                                    "anomaly_score": anomaly.anomaly_score,
                                    "contributing_factors": anomaly.contributing_factors,
                                    "error_count": log_features.error_count,
                                    "has_oom": log_features.has_oom,
                                    "has_crash": log_features.has_crash
                                }
                            ))
                
                except Exception as e:
                    logger.debug(f"Failed to get logs for {pod}: {e}")
        
        except Exception as e:
            logger.warning(f"Failed to analyze logs: {e}")
        
        return signals
