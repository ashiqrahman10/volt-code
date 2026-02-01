"""
Base Detector

Abstract base class for incident detectors.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

# from ..mcp_client import MCPClient # Removed in port
from ..signals.normalizer import Signal, SignalNormalizer
from ..signals.correlator import IncidentCandidate, SignalCorrelator

logger = logging.getLogger(__name__)


class BaseDetector(ABC):
    """Base class for incident detectors."""
    
    incident_type: str = "unknown"
    
    def __init__(
        self,
        mcp: Any, # Typed as Any to support DataSource or None
        normalizer: SignalNormalizer | None = None,
        correlator: SignalCorrelator | None = None
    ):
        self.mcp = mcp
        self.normalizer = normalizer or SignalNormalizer()
        self.correlator = correlator or SignalCorrelator()
    
    @abstractmethod
    async def collect_signals(self, namespace: str | None = None) -> list[Signal]:
        """
        Collect and normalize signals for this incident type.
        
        Args:
            namespace: Optional namespace filter
        
        Returns:
            List of normalized signals
        """
        pass
    
    async def detect(self, namespace: str | None = None) -> list[IncidentCandidate]:
        """
        Run detection and return incident candidates.
        
        Args:
            namespace: Optional namespace filter
        
        Returns:
            List of incident candidates
        """
        logger.info(f"Running {self.incident_type} detection")
        
        # Collect signals
        signals = await self.collect_signals(namespace)
        logger.info(f"Collected {len(signals)} signals for {self.incident_type}")
        
        if not signals:
            return []
        
        # Correlate into incident candidates
        candidates = self.correlator.correlate(signals, self.incident_type)
        
        # Filter false positives - allow single signals with warning+ severity
        filtered = self.correlator.filter_false_positives(
            candidates, 
            min_confidence=0.15,  # Lower threshold for demo
            min_signals=1
        )
        
        logger.info(f"Detected {len(filtered)} {self.incident_type} incidents")
        return filtered
