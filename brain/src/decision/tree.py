"""
Decision Tree Engine

Implements the decision logic:
1. False Positive Rejection
2. Auto-Remediation (low risk, high confidence)
3. Human Approval (medium risk)
4. Escalation (high risk, low confidence)
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any

from ..config import settings
from ..signals.correlator import IncidentCandidate
from ..signals.normalizer import SignalSeverity
from ..analysis.llm_rca import RCAResult

logger = logging.getLogger(__name__)


class DecisionType(str, Enum):
    REJECT = "reject"  # False positive
    AUTO_FIX = "auto_fix"
    APPROVAL = "approval"
    ESCALATE = "escalate"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Decision:
    """Decision result from the decision tree."""
    
    decision_type: DecisionType
    action: str | None  # The remediation action to take
    risk_level: RiskLevel
    reasoning: str
    requires_approval: bool = False
    auto_approved: bool = False
    
    def to_dict(self) -> dict:
        return {
            "decision_type": self.decision_type.value,
            "action": self.action,
            "risk_level": self.risk_level.value,
            "reasoning": self.reasoning,
            "requires_approval": self.requires_approval,
            "auto_approved": self.auto_approved
        }


class DecisionTree:
    """
    Decision tree for incident response.
    
    Flow:
    1. Check for false positive indicators → REJECT
    2. Check if auto-fix is safe → AUTO_FIX
    3. Check if approval is needed → APPROVAL
    4. Otherwise → ESCALATE
    """
    
    # Actions considered safe for auto-fix
    SAFE_ACTIONS = {"restart_pod", "delete_pod"}
    
    # Actions requiring approval
    APPROVAL_ACTIONS = {"scale_deployment", "rollout_restart"}
    
    # Incident types that should never be auto-fixed
    ESCALATE_ONLY_TYPES = {"disk_full"}
    
    # ML early warnings require human review
    APPROVAL_ONLY_TYPES = {"early_warning"}

    
    def decide(
        self,
        incident: IncidentCandidate,
        rca: RCAResult
    ) -> Decision:
        """
        Make a decision based on incident and RCA.
        
        Args:
            incident: The incident candidate
            rca: Root cause analysis result
        
        Returns:
            Decision with action and reasoning
        """
        logger.info(f"Making decision for {incident.id}")
        
        # Stage 1: False Positive Rejection
        if self._is_false_positive(incident, rca):
            return Decision(
                decision_type=DecisionType.REJECT,
                action=None,
                risk_level=RiskLevel.LOW,
                reasoning="Rejected as false positive: insufficient evidence or low confidence"
            )
        
        # Stage 2: Check if escalation is required
        if incident.incident_type in self.ESCALATE_ONLY_TYPES:
            return Decision(
                decision_type=DecisionType.ESCALATE,
                action="escalate",
                risk_level=RiskLevel.HIGH,
                reasoning=f"{incident.incident_type} incidents always require human intervention"
            )
        
        # Stage 2b: ML early warnings always require human review
        if incident.incident_type in self.APPROVAL_ONLY_TYPES:
            return Decision(
                decision_type=DecisionType.APPROVAL,
                action=rca.recommended_action or "investigate",
                risk_level=RiskLevel.MEDIUM,
                reasoning=f"ML early warning: {rca.root_cause or 'Anomaly detected'}",
                requires_approval=True
            )

        
        # Stage 3: Determine risk level
        risk = self._assess_risk(incident, rca)
        
        # Stage 4: Make decision based on risk and confidence
        if risk == RiskLevel.LOW and rca.confidence >= settings.auto_fix_confidence_threshold:
            if rca.recommended_action in self.SAFE_ACTIONS:
                return Decision(
                    decision_type=DecisionType.AUTO_FIX,
                    action=rca.recommended_action,
                    risk_level=risk,
                    reasoning=f"High confidence ({rca.confidence:.2f}) and low risk. Auto-fixing: {rca.recommended_action}",
                    auto_approved=True
                )
        
        if risk in (RiskLevel.LOW, RiskLevel.MEDIUM):
            if rca.confidence >= settings.approval_confidence_threshold:
                return Decision(
                    decision_type=DecisionType.APPROVAL,
                    action=rca.recommended_action,
                    risk_level=risk,
                    reasoning=f"Confidence: {rca.confidence:.2f}, Risk: {risk.value}. Requires human approval.",
                    requires_approval=True
                )
        
        # Default: Escalate
        return Decision(
            decision_type=DecisionType.ESCALATE,
            action="escalate",
            risk_level=RiskLevel.HIGH,
            reasoning=f"Low confidence ({rca.confidence:.2f}) or high risk. Escalating for human investigation."
        )
    
    def _is_false_positive(self, incident: IncidentCandidate, rca: RCAResult) -> bool:
        """Check if this is likely a false positive."""
        # Very low confidence
        if rca.confidence < 0.3:
            return True
        
        # Single weak signal without critical severity
        if len(incident.signals) == 1:
            if incident.signals[0].severity != SignalSeverity.CRITICAL:
                if incident.confidence < 0.5:
                    return True
        
        return False
    
    def _assess_risk(self, incident: IncidentCandidate, rca: RCAResult) -> RiskLevel:
        """Assess the risk level of the incident."""
        # Critical severity = at least medium risk
        if incident.severity == SignalSeverity.CRITICAL:
            # Multiple signals = high risk
            if len(incident.signals) > 3:
                return RiskLevel.HIGH
            return RiskLevel.MEDIUM
        
        # Check recommended action
        if rca.recommended_action in self.SAFE_ACTIONS:
            return RiskLevel.LOW
        
        if rca.recommended_action in self.APPROVAL_ACTIONS:
            return RiskLevel.MEDIUM
        
        return RiskLevel.HIGH


# Global decision tree instance
decision_tree = DecisionTree()
