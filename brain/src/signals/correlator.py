"""
Signal Correlator

Groups and correlates signals to identify potential incidents.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from .normalizer import Signal, SignalType, SignalSeverity

logger = logging.getLogger(__name__)


@dataclass
class IncidentCandidate:
    """A potential incident detected from correlated signals."""
    
    id: str
    incident_type: str  # memory_leak, api_timeout, disk_full
    source: str  # Primary affected resource
    namespace: str
    signals: list[Signal] = field(default_factory=list)
    confidence: float = 0.0
    severity: SignalSeverity = SignalSeverity.WARNING
    detected_at: datetime = field(default_factory=datetime.utcnow)
    metadata: dict = field(default_factory=dict)
    
    def add_signal(self, signal: Signal):
        """Add a corroborating signal."""
        self.signals.append(signal)
        self._update_confidence()
    
    def _update_confidence(self):
        """Recalculate confidence based on signals."""
        # More signals = higher confidence
        signal_count = len(self.signals)
        
        # Different signal types boost confidence more
        signal_types = set(s.type for s in self.signals)
        type_boost = len(signal_types) * 0.1
        
        # Critical severity signals boost confidence
        critical_count = sum(1 for s in self.signals if s.severity == SignalSeverity.CRITICAL)
        critical_boost = critical_count * 0.15
        
        # Base confidence from signal count
        base_confidence = min(0.5, signal_count * 0.15)
        
        self.confidence = min(1.0, base_confidence + type_boost + critical_boost)
        
        # Update overall severity
        if any(s.severity == SignalSeverity.CRITICAL for s in self.signals):
            self.severity = SignalSeverity.CRITICAL
        elif any(s.severity == SignalSeverity.WARNING for s in self.signals):
            self.severity = SignalSeverity.WARNING
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "incident_type": self.incident_type,
            "source": self.source,
            "namespace": self.namespace,
            "signal_count": len(self.signals),
            "signals": [s.to_dict() for s in self.signals],
            "confidence": self.confidence,
            "severity": self.severity.value,
            "detected_at": self.detected_at.isoformat(),
            "metadata": self.metadata
        }


class SignalCorrelator:
    """
    Correlates signals by service, namespace, and time window.
    Produces incident candidates with confidence scores.
    """
    
    def __init__(self, time_window_minutes: int = 5):
        self.time_window = timedelta(minutes=time_window_minutes)
        self._incident_counter = 0
    
    def _generate_id(self) -> str:
        self._incident_counter += 1
        return f"INC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{self._incident_counter:04d}"
    
    def correlate(
        self,
        signals: list[Signal],
        incident_type: str
    ) -> list[IncidentCandidate]:
        """
        Correlate signals and produce incident candidates.
        
        Args:
            signals: List of normalized signals
            incident_type: Type of incident being detected
        
        Returns:
            List of incident candidates
        """
        if not signals:
            return []
        
        # Group by namespace + source
        groups: dict[str, list[Signal]] = {}
        for signal in signals:
            key = f"{signal.namespace}/{signal.source}"
            if key not in groups:
                groups[key] = []
            groups[key].append(signal)
        
        # Create incident candidates for groups with sufficient signals
        candidates = []
        for key, group_signals in groups.items():
            # Filter by time window
            now = datetime.utcnow()
            recent_signals = [
                s for s in group_signals
                if now - s.timestamp < self.time_window
            ]
            
            if not recent_signals:
                continue
            
            # Create candidate if we have enough evidence
            if len(recent_signals) >= 1:  # At least 1 signal
                namespace, source = key.split("/", 1)
                candidate = IncidentCandidate(
                    id=self._generate_id(),
                    incident_type=incident_type,
                    source=source,
                    namespace=namespace
                )
                
                for signal in recent_signals:
                    candidate.add_signal(signal)
                
                candidates.append(candidate)
                logger.info(
                    f"Incident candidate: {candidate.id} - {incident_type} "
                    f"on {key} (confidence: {candidate.confidence:.2f})"
                )
        
        return candidates
    
    def filter_false_positives(
        self,
        candidates: list[IncidentCandidate],
        min_confidence: float = 0.3,
        min_signals: int = 2
    ) -> list[IncidentCandidate]:
        """
        Filter out likely false positives.
        
        Args:
            candidates: List of incident candidates
            min_confidence: Minimum confidence threshold
            min_signals: Minimum number of corroborating signals
        
        Returns:
            Filtered list of candidates
        """
        filtered = []
        for candidate in candidates:
            # Check minimum requirements
            if candidate.confidence < min_confidence:
                logger.debug(
                    f"Rejecting {candidate.id}: confidence {candidate.confidence:.2f} < {min_confidence}"
                )
                continue
            
            if len(candidate.signals) < min_signals:
                # Exception: single critical signal is enough
                if not any(s.severity == SignalSeverity.CRITICAL for s in candidate.signals):
                    logger.debug(
                        f"Rejecting {candidate.id}: only {len(candidate.signals)} signals"
                    )
                    continue
            
            filtered.append(candidate)
        
        rejected = len(candidates) - len(filtered)
        if rejected > 0:
            logger.info(f"Filtered out {rejected} false positive candidates")
        
        return filtered


# Global correlator instance
correlator = SignalCorrelator()
