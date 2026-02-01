"""
Issue Data Models

Defines the Issue entity for tracking incidents through the remediation workflow.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class IssueStatus(str, Enum):
    """Issue lifecycle states."""
    OPEN = "open"
    FIXING = "fixing"
    RESOLVED = "resolved"
    NEEDS_ATTENTION = "needs_attention"


class RemediationAttemptStatus(str, Enum):
    """Status of a remediation attempt."""
    PENDING = "pending"
    EXECUTING = "executing"
    SUCCESS = "success"
    FAILED = "failed"


@dataclass
class RemediationAttempt:
    """Record of a single remediation attempt."""
    id: str
    action: str
    target: str
    status: RemediationAttemptStatus
    executed_at: datetime
    completed_at: datetime | None = None
    result: str | None = None
    error: str | None = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "action": self.action,
            "target": self.target,
            "status": self.status.value,
            "executedAt": self.executed_at.isoformat(),
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
            "error": self.error
        }


@dataclass
class Issue:
    """
    Issue entity tracking an incident through the remediation workflow.
    
    Lifecycle: open -> fixing -> resolved / needs_attention
    """
    id: str
    incident_id: str
    status: IssueStatus
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    remediation_attempts: list[RemediationAttempt] = field(default_factory=list)
    verified: bool = False
    verification_message: str | None = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "incidentId": self.incident_id,
            "status": self.status.value,
            "createdAt": self.created_at.isoformat(),
            "updatedAt": self.updated_at.isoformat(),
            "remediationAttempts": [a.to_dict() for a in self.remediation_attempts],
            "verified": self.verified,
            "verificationMessage": self.verification_message
        }
