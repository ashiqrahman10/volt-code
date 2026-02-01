import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, List

# from .config import settings # Config not fully ported yet, using defaults or env
from .data_adapter import DataSource
from .database import Database
from .signals.correlator import IncidentCandidate, SignalCorrelator
from .detectors.base import BaseDetector
from .ml.ml_detector import MLAnomalyDetector
from .analysis.llm_rca import GroqAnalyzer, RCAResult, get_analyzer
from .decision.tree import DecisionTree, Decision, DecisionType, decision_tree

logger = logging.getLogger(__name__)

@dataclass
class IncidentReport:
    """Complete incident report with all analysis."""
    
    incident: IncidentCandidate
    rca: RCAResult
    decision: Decision
    action_result: Any = None
    verified: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> dict:
        return {
            "incident": self.incident.to_dict(),
            "rca": self.rca.to_dict(),
            "decision": self.decision.to_dict(),
            "action_result": self.action_result.to_dict() if self.action_result else None,
            "verified": self.verified,
            "created_at": self.created_at.isoformat()
        }

from .decision.actions import executor

# ...

class IncidentResponseAgent:
    """
    Main agent that orchestrates incident detection, analysis, and response.
    Adapted for 'brain' service (Receiver + Agent).
    """
    
    def __init__(
        self,
        db: Database,
        analyzer: GroqAnalyzer | None = None
    ):
        self.db = db
        self.data_source = DataSource(db)
        self.analyzer = analyzer or get_analyzer()
        self.decision_tree = decision_tree
        self.executor = executor
        
        # Initialize detectors
        # Currently only enabling MLAnomalyDetector as others depend on live MCP checks we might not have yet
        self.detectors: List[BaseDetector] = [
            MLAnomalyDetector(self.data_source),  # ML-based early warning
            # MemoryLeakDetector(self.mcp), # Needs porting/adapter
            # APITimeoutDetector(self.mcp),
            # DiskFullDetector(self.mcp),
        ]
        
        # State
        self._running = False
        self._incidents: list[IncidentReport] = []
        self._pending_approvals: list[IncidentReport] = []
    
    @property
    def incidents(self) -> list[IncidentReport]:
        return self._incidents
    
    @property
    def pending_approvals(self) -> list[IncidentReport]:
        return self._pending_approvals
    
    async def run_detection_cycle(self, namespace: str | None = None) -> list[IncidentCandidate]:
        """Run a single detection cycle across all detectors."""
        all_candidates = []
        
        for detector in self.detectors:
            try:
                candidates = await detector.detect(namespace)
                all_candidates.extend(candidates)
            except Exception as e:
                logger.error(f"Detector {detector.incident_type} failed: {e}")
        
        return all_candidates
    
    async def process_incident(self, incident: IncidentCandidate) -> IncidentReport:
        """Process a single incident through the full workflow."""
        logger.info(f"Processing incident {incident.id}")
        
        # Step 1: LLM Root Cause Analysis
        try:
            rca = await self.analyzer.analyze(incident)
            logger.info(f"RCA complete: {rca.root_cause} (confidence: {rca.confidence:.2f})")
        except Exception as e:
            logger.error(f"RCA failed: {e}")
            # Fallback
            rca = RCAResult(root_cause="Analysis failed", confidence=0.0, evidence=[])

        # Step 2: Decision Tree
        decision = self.decision_tree.decide(incident, rca)
        logger.info(f"Decision: {decision.decision_type.value} - {decision.reasoning}")
        
        # Create report
        report = IncidentReport(
            incident=incident,
            rca=rca,
            decision=decision
        )
        
        # Step 3: Execute based on decision strategy
        if decision.action:
            logger.info(f"Action proposed: {decision.action}")
            # Execute action using the real executor
            result = await self.executor.execute(decision.action, incident)
            report.action_result = result
        
        self._incidents.append(report)
        return report

    async def run_forever(
        self,
        namespace: str | None = None,
        interval_seconds: int = 30
    ):
        """Run continuous monitoring loop."""
        self._running = True
        logger.info(f"Starting continuous monitoring (interval: {interval_seconds}s)")
        
        while self._running:
            try:
                # Run detection
                candidates = await self.run_detection_cycle(namespace)
                
                if candidates:
                    logger.info(f"Detected {len(candidates)} candidates")
                
                # Process each incident
                for incident in candidates:
                    await self.process_incident(incident)
                
            except Exception as e:
                logger.error(f"Monitoring cycle failed: {e}")
            
            await asyncio.sleep(interval_seconds)
    
    def stop(self):
        """Stop the monitoring loop."""
        self._running = False
