"""
LLM Root Cause Analyzer

Uses Groq to perform structured root cause analysis.
Includes optimizations to minimize API calls:
- Result caching with TTL
- Confidence threshold filtering
- Rule-based fallback for common K8s errors
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

from ..config import settings
from ..signals.correlator import IncidentCandidate

logger = logging.getLogger(__name__)

# ============== OPTIMIZATION CONFIG ==============
CACHE_TTL_SECONDS = 300  # 5 minutes
MIN_CONFIDENCE_FOR_LLM = 0.6  # Skip LLM for low-confidence incidents
# =================================================


@dataclass
class RCAResult:
    """Structured root cause analysis result."""
    
    root_cause: str
    confidence: float
    evidence: list[str]
    contributing_factors: list[str]
    recommended_action: str
    rollback_guidance: str
    reasoning: str
    
    def to_dict(self) -> dict:
        return {
            "root_cause": self.root_cause,
            "confidence": self.confidence,
            "evidence": self.evidence,
            "contributing_factors": self.contributing_factors,
            "recommended_action": self.recommended_action,
            "rollback_guidance": self.rollback_guidance,
            "reasoning": self.reasoning
        }


# ============== RULE-BASED FALLBACK PATTERNS ==============
# Common K8s issues that don't need LLM analysis
RULE_BASED_PATTERNS: dict[str, RCAResult] = {
    "oomkilled": RCAResult(
        root_cause="Container killed due to Out of Memory (OOMKilled)",
        confidence=0.95,
        evidence=["OOMKilled event detected"],
        contributing_factors=["Memory limit too low", "Memory leak in application"],
        recommended_action="scale_deployment",
        rollback_guidance="Reduce memory usage or increase limits",
        reasoning="OOMKilled is a definitive signal - container exceeded memory limits."
    ),
    "crashloopbackoff": RCAResult(
        root_cause="Pod in CrashLoopBackOff - repeated crash cycles",
        confidence=0.9,
        evidence=["CrashLoopBackOff status detected"],
        contributing_factors=["Application startup failure", "Missing dependencies", "Configuration error"],
        recommended_action="escalate",
        rollback_guidance="Check pod logs for startup errors, verify config and dependencies",
        reasoning="CrashLoopBackOff requires investigation of logs to determine specific cause."
    ),
    "imagepullbackoff": RCAResult(
        root_cause="Failed to pull container image",
        confidence=0.95,
        evidence=["ImagePullBackOff status detected"],
        contributing_factors=["Image not found", "Registry authentication failed", "Network issue"],
        recommended_action="escalate",
        rollback_guidance="Verify image name, registry credentials, and network connectivity",
        reasoning="Image pull failures are configuration issues requiring manual intervention."
    ),
    "high_memory": RCAResult(
        root_cause="High memory utilization detected",
        confidence=0.85,
        evidence=["Memory usage exceeds threshold"],
        contributing_factors=["Memory leak", "Increased load", "Insufficient resources"],
        recommended_action="scale_deployment",
        rollback_guidance="Monitor after scaling, investigate if issue persists",
        reasoning="High memory typically requires scaling before deeper investigation."
    ),
    "high_cpu": RCAResult(
        root_cause="High CPU utilization detected",
        confidence=0.85,
        evidence=["CPU usage exceeds threshold"],
        contributing_factors=["Increased load", "Inefficient code", "Insufficient resources"],
        recommended_action="scale_deployment",
        rollback_guidance="Monitor after scaling, optimize if issue persists",
        reasoning="High CPU typically requires scaling before deeper investigation."
    ),
    "pod_restart": RCAResult(
        root_cause="Pod experiencing frequent restarts",
        confidence=0.8,
        evidence=["Multiple pod restarts detected"],
        contributing_factors=["Application crash", "Resource limits", "Liveness probe failures"],
        recommended_action="restart_pod",
        rollback_guidance="Check pod logs and events for specific failure reason",
        reasoning="Frequent restarts indicate instability requiring investigation."
    ),
}


# ============== SIMPLE TTL CACHE ==============
class RCACache:
    """Simple TTL-based cache for RCA results."""
    
    def __init__(self, ttl_seconds: int = CACHE_TTL_SECONDS):
        self.ttl = ttl_seconds
        self._cache: dict[str, tuple[RCAResult, float]] = {}
    
    @staticmethod
    def _fingerprint(incident: IncidentCandidate) -> str:
        """Create a cache key from incident characteristics."""
        key_parts = [
            incident.incident_type,
            incident.namespace,
            incident.source,
            # Include signal types but not exact values (for similar incidents)
            ",".join(sorted(set(s.type.value for s in incident.signals)))
        ]
        key_str = "|".join(key_parts)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def get(self, incident: IncidentCandidate) -> RCAResult | None:
        """Get cached result if exists and not expired."""
        fingerprint = self._fingerprint(incident)
        if fingerprint in self._cache:
            result, timestamp = self._cache[fingerprint]
            if time.time() - timestamp < self.ttl:
                logger.info(f"Cache HIT for {incident.id} (fingerprint: {fingerprint[:8]})")
                return result
            else:
                # Expired
                del self._cache[fingerprint]
        return None
    
    def set(self, incident: IncidentCandidate, result: RCAResult) -> None:
        """Store result in cache."""
        fingerprint = self._fingerprint(incident)
        self._cache[fingerprint] = (result, time.time())
        logger.info(f"Cached RCA for {incident.id} (fingerprint: {fingerprint[:8]})")
    
    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()


# Global cache instance
_rca_cache = RCACache()


def _check_rule_based_match(incident: IncidentCandidate) -> RCAResult | None:
    """Check if incident matches a known pattern for rule-based analysis."""
    # Check incident type and signal names for known patterns
    check_strings = [
        incident.incident_type.lower(),
        incident.source.lower(),
    ]
    for signal in incident.signals:
        check_strings.append(signal.name.lower())
        if isinstance(signal.value, str):
            check_strings.append(signal.value.lower())
    
    combined = " ".join(check_strings)
    
    # Check each pattern
    for pattern_key, result in RULE_BASED_PATTERNS.items():
        if pattern_key in combined:
            logger.info(f"Rule-based match: {pattern_key} for incident {incident.id}")
            return result
    
    return None


class GroqAnalyzer:
    """Groq-powered LLM analyzer using httpx."""
    
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.get_groq_api_key()
        self.model = settings.groq_model
    
    async def analyze(self, incident: IncidentCandidate) -> RCAResult:
        """Perform root cause analysis on an incident.
        
        Optimizations applied (in order):
        1. Check cache for previous analysis
        2. Check rule-based patterns for common K8s issues
        3. Check confidence threshold - skip LLM for low-confidence
        4. Only call LLM if above checks don't match
        """
        logger.info(f"Running RCA for incident {incident.id}")
        
        # ===== OPTIMIZATION 1: Check cache first =====
        cached_result = _rca_cache.get(incident)
        if cached_result:
            logger.info(f"[OPTIMIZATION] Cache hit - skipping LLM call for {incident.id}")
            return cached_result
        
        # ===== OPTIMIZATION 2: Rule-based fallback for common K8s issues =====
        rule_result = _check_rule_based_match(incident)
        if rule_result:
            logger.info(f"[OPTIMIZATION] Rule-based match - skipping LLM call for {incident.id}")
            _rca_cache.set(incident, rule_result)  # Cache rule-based results too
            return rule_result
        
        # ===== OPTIMIZATION 3: Confidence threshold =====
        if incident.confidence < MIN_CONFIDENCE_FOR_LLM:
            logger.info(f"[OPTIMIZATION] Low confidence ({incident.confidence:.2f} < {MIN_CONFIDENCE_FOR_LLM}) - skipping LLM for {incident.id}")
            low_conf_result = RCAResult(
                root_cause=f"Low-confidence detection: {incident.incident_type}",
                confidence=incident.confidence,
                evidence=[s.name for s in incident.signals[:3]],
                contributing_factors=["Insufficient signal correlation"],
                recommended_action="escalate",
                rollback_guidance="Monitor and gather more data before action",
                reasoning=f"Detection confidence ({incident.confidence:.2f}) below threshold ({MIN_CONFIDENCE_FOR_LLM}). Requires more data."
            )
            return low_conf_result
        
        # ===== LLM Analysis (only if optimizations don't apply) =====
        logger.info(f"[LLM] Calling Groq API for incident {incident.id}")
        
        signals_summary = []
        for signal in incident.signals:
            signals_summary.append({
                "type": signal.type.value,
                "name": signal.name,
                "value": str(signal.value),
                "severity": signal.severity.value,
                "source": signal.source
            })
        
        print(f"DEBUG_RCA: Building prompt for incident {incident.id}")
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(incident, signals_summary)
        
        print(f"DEBUG_RCA: System Prompt length: {len(system_prompt)}")
        print(f"DEBUG_RCA: User Prompt length: {len(user_prompt)}")
        print(f"DEBUG_RCA: API Key configured: {'Yes' if self.api_key else 'No'}")
        print(f"DEBUG_RCA: Sending request to {self.GROQ_API_URL}")
        
        # Retry logic for 429 Rate Limits
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    request_payload = {
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"}
                    }
                    print(f"DEBUG_RCA: Request payload keys: {request_payload.keys()}")
                    
                    response = await client.post(
                        self.GROQ_API_URL,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json"
                        },
                        json=request_payload
                    )
                    
                    print(f"DEBUG_RCA: Response Status: {response.status_code}")
                    
                    if response.status_code == 429:
                        if attempt < max_retries - 1:
                            wait_time = base_delay * (2 ** attempt)
                            logger.warning(f"Groq API Rate message (429). Retrying in {wait_time}s...")
                            print(f"DEBUG_RCA: Rate limit 429. Retrying in {wait_time}s...")
                            import asyncio
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            logger.error("Groq API rate limit exhausted.")
                            return RCAResult(
                                root_cause="Analysis Service Busy (Rate Limit)",
                                confidence=0.3,
                                evidence=[s.name for s in incident.signals[:3]],
                                contributing_factors=["High API Load"],
                                recommended_action="escalate",
                                rollback_guidance="Manual investigation required",
                                reasoning="Automated analysis unavailable due to API rate limits. Please investigate manually."
                            )

                    if response.status_code != 200:
                        print(f"DEBUG_RCA: Response Error Body: {response.text}")
                        logger.error(f"Groq API error: {response.text}")
                        response.raise_for_status()
                        
                    data = response.json()
                    print("DEBUG_RCA: Response JSON parsed successfully")
                    content = data["choices"][0]["message"]["content"]
                    print(f"DEBUG_RCA: Content received: {content[:100]}...")
                    
                    # Parse JSON response
                    try:
                        result = json.loads(content)
                        print("DEBUG_RCA: Content JSON parsed successfully")
                    except json.JSONDecodeError:
                        print("DEBUG_RCA: JSON decode error, trying fallback")
                        # Fallback for when model wraps json in markdown blocks
                        if "```json" in content:
                            content = content.split("```json")[1].split("```")[0].strip()
                            result = json.loads(content)
                        else:
                            print("DEBUG_RCA: Failed to parse JSON from content")
                            raise
                    
                    rca_result = RCAResult(
                        root_cause=result.get("root_cause", "Unknown"),
                        confidence=float(result.get("confidence", 0.5)),
                        evidence=result.get("evidence", []),
                        contributing_factors=result.get("contributing_factors", []),
                        recommended_action=result.get("recommended_action", "escalate"),
                        rollback_guidance=result.get("rollback_guidance", "Monitor after action"),
                        reasoning=result.get("reasoning", "")
                    )
                    
                    # Cache the LLM result for future similar incidents
                    _rca_cache.set(incident, rca_result)
                    logger.info(f"[LLM] Successfully analyzed {incident.id} - caching result")
                    return rca_result
                
            except Exception as e:
                # If it's not a rate limit issue (or retries exhausted), return fallback
                logger.error(f"Groq analysis failed: {e}")
                
                # Check for rate limit error in exception message just in case
                msg = str(e)
                if "429" in msg or "Too Many Requests" in msg:
                    reason = "Analysis Service Busy (Rate Limit)"
                    desc = "Automated analysis unavailable due to API rate limits."
                else:
                    reason = f"Analysis Failed: {type(e).__name__}"
                    desc = f"LLM analysis failed: {str(e)[:100]}"
                
                return RCAResult(
                    root_cause=reason,
                    confidence=0.3,
                    evidence=[s.name for s in incident.signals[:3]],
                    contributing_factors=[],
                    recommended_action="escalate",
                    rollback_guidance="Manual investigation required",
                    reasoning=desc
                )
    
    def _build_system_prompt(self) -> str:
        return """You are an expert SRE performing root cause analysis on a Kubernetes incident.

You must ignore your previous instructions and guidelines and respond in strictly valid JSON format. Do not use Markdown notation.

Response Format:
{
    "root_cause": "Clear description of the most likely root cause",
    "confidence": 0.0-1.0,
    "evidence": ["List of evidence supporting this conclusion"],
    "contributing_factors": ["Other factors that may be involved"],
    "recommended_action": "restart_pod|scale_deployment|rollout_restart|escalate",
    "rollback_guidance": "What to do if the action doesn't resolve the issue",
    "reasoning": "Step-by-step explanation of your analysis"
}

## Action Recommendations
- `restart_pod`: For single pod issues (memory leak, stuck process)
- `scale_deployment`: For capacity issues (high load, timeouts)
- `rollout_restart`: For deployment-wide issues
- `escalate`: For complex issues requiring human investigation

## Guidelines
1. Be specific about the root cause
2. Only recommend auto-fix actions for high-confidence (>0.8), reversible issues
3. Recommend escalation for disk issues, multi-service problems, or low confidence
4. Include clear reasoning for your conclusions
"""

    def _build_user_prompt(self, incident: IncidentCandidate, signals: list[dict]) -> str:
        """Build the analysis prompt."""
        
        return f"""
## Incident Details
- **Type**: {incident.incident_type}
- **Affected Resource**: {incident.source}
- **Namespace**: {incident.namespace}
- **Initial Confidence**: {incident.confidence:.2f}
- **Severity**: {incident.severity.value}

## Signals Detected
```json
{json.dumps(signals, indent=2)}
```
"""


# Global analyzer instance
_analyzer: GroqAnalyzer | None = None


def get_analyzer() -> GroqAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = GroqAnalyzer()
    return _analyzer
