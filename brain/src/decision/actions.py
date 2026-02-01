"""
Remediation Actions

Defines and executes remediation actions via Gateway Agent.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

# from ..mcp_client import MCPClient, mcp # Removed in port
from ..signals.correlator import IncidentCandidate

logger = logging.getLogger(__name__)


class ActionStatus(str, Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"


from ..tools.k8s_client import k8s_toolbox

@dataclass
class ActionResult:
    """Result of a remediation action."""
    
    action: str
    status: ActionStatus
    result: dict | None = None
    error: str | None = None
    audit_id: str | None = None
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    
    def to_dict(self) -> dict:
        return {
            "action": self.action,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "audit_id": self.audit_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class RemediationExecutor:
    """Executes remediation actions via Kubernetes Toolbox."""
    
    def __init__(self, toolbox=None):
        self.toolbox = toolbox or k8s_toolbox
    
    async def execute(
        self,
        action: str,
        incident: IncidentCandidate
    ) -> ActionResult:
        """
        Execute a remediation action.
        """
        logger.info(f"Executing {action} for incident {incident.id}")
        
        result = ActionResult(action=action, status=ActionStatus.EXECUTING)
        
        try:
            # Handle escalate (no-op for K8s)
            if action == "escalate":
                result.result = {
                    "message": f"Escalated: {incident.incident_type} on {incident.source}",
                    "requires_manual_action": True
                }
                result.status = ActionStatus.COMPLETED
                result.completed_at = datetime.utcnow()
                return result
            
            if not self.toolbox:
                raise RuntimeError("Kubernetes toolbox not available")

            # Execute K8s actions
            if action == "restart_pod" or action == "delete_pod":
                # Check for node vs pod
                if incident.incident_type == "disk_full":
                     raise ValueError("Cannot restart node for disk_full")

                response = self.toolbox.delete_pod(
                    name=incident.source,
                    namespace=incident.namespace
                )
                result.result = response
                
            elif action == "rollout_restart":
                deployment = self._extract_deployment_name(incident.source)
                response = self.toolbox.rollout_restart(
                    deployment_name=deployment,
                    namespace=incident.namespace
                )
                result.result = response
                
            elif action == "scale_deployment":
                deployment = self._extract_deployment_name(incident.source)
                # Simple logic: scale to 2 (should be adaptive in real world)
                response = self.toolbox.scale_deployment(
                    name=deployment,
                    namespace=incident.namespace,
                    replicas=2 
                )
                result.result = response
                
            else:
                raise ValueError(f"Unknown action: {action}")
            
            if result.result and result.result.get("status") == "error":
                 raise Exception(result.result.get("message"))

            result.status = ActionStatus.COMPLETED
            result.completed_at = datetime.utcnow()
            logger.info(f"Action {action} completed for {incident.id}")
            
        except Exception as e:
            logger.error(f"Action {action} failed for {incident.id}: {e}")
            result.status = ActionStatus.FAILED
            result.error = str(e)
            result.completed_at = datetime.utcnow()
        
        return result
    
    def _extract_deployment_name(self, pod_name: str) -> str:
        """
        Extract deployment name from pod name.
        """
        parts = pod_name.rsplit("-", 2)
        if len(parts) >= 3:
            return parts[0]
        return pod_name


# Global executor instance
executor = RemediationExecutor()
