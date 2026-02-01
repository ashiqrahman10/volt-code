import logging
import json
import time
from typing import Any, Dict, List
from .database import Database

logger = logging.getLogger(__name__)

class DataSource:
    """
    Adapter to fetch data from the local SQLite database for ML components.
    Replaces the MCPClient for data fetching.
    """
    
    def __init__(self, db: Database):
        self.db = db
        
    async def prom_query(self, query: str) -> Dict[str, Any]:
        """
        Query metrics from local DB based on PromQL-like patterns.
        Maps common PromQL queries to actual stored metric names.
        """
        logger.info(f"PromQL query: {query}")
        
        # Map PromQL metric names to actual stored metric names
        if "container_memory_working_set_bytes" in query:
            return self._get_metrics_by_pattern([
                "cilium_process_resident_memory_bytes",
                "process_resident_memory_bytes"
            ])
        elif "container_cpu_usage_seconds_total" in query:
            return self._get_metrics_by_pattern([
                "cilium_process_cpu_seconds_total",
                "process_cpu_seconds_total"
            ])
        elif "kube_pod_container_status_restarts_total" in query:
            # Check for restart-related metrics or high error counts
            return self._get_restart_metrics()
        
        return {"data": {"result": []}}

    async def prom_query_range(self, query: str, start: str, end: str, step: str) -> Dict[str, Any]:
        """
        Get time-series metrics for trend analysis.
        """
        logger.info(f"PromQL range query: {query}")
        
        if "container_memory_working_set_bytes" in query:
            return self._get_metrics_range("cilium_process_resident_memory_bytes")
        elif "container_cpu_usage_seconds_total" in query:
            return self._get_metrics_range("cilium_process_cpu_seconds_total")
            
        return {"data": {"result": []}}

    async def tail_logs(self, pod: str, namespace: str, lines: int = 100) -> Dict[str, Any]:
        """
        Fetch recent logs for a pod from the DB.
        """
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                # Query logs filtering by namespace/pod in the labels JSON
                cursor.execute("""
                    SELECT line, labels, timestamp FROM logs 
                    WHERE labels LIKE ? OR labels LIKE ?
                    ORDER BY timestamp DESC LIMIT ?
                """, (f'%{pod}%', f'%{namespace}%', lines))
                rows = cursor.fetchall()
                
                logs = [row[0] for row in rows]
                return {"logs": logs}
        except Exception as e:
            logger.error(f"Failed to fetch logs: {e}")
            return {"logs": []}

    def _get_metrics_by_pattern(self, metric_names: List[str]) -> Dict[str, Any]:
        """Get latest metrics matching any of the given names."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                placeholders = ",".join("?" * len(metric_names))
                cursor.execute(f"""
                    SELECT name, labels, value, timestamp 
                    FROM metrics 
                    WHERE name IN ({placeholders})
                    ORDER BY timestamp DESC
                    LIMIT 100
                """, metric_names)
                rows = cursor.fetchall()
                
                result = []
                seen = set()  # Deduplicate by labels
                
                for name, labels_str, value, timestamp in rows:
                    if labels_str in seen:
                        continue
                    seen.add(labels_str)
                    
                    try:
                        labels = json.loads(labels_str) if labels_str else {}
                    except:
                        labels = {}
                    
                    # Extract pod and namespace from labels
                    pod = labels.get("pod", labels.get("instance", "unknown"))
                    namespace = labels.get("namespace", labels.get("kubernetes_namespace", "default"))
                    
                    result.append({
                        "metric": {
                            "__name__": name,
                            "pod": pod,
                            "namespace": namespace,
                            **{k: v for k, v in labels.items() if k not in ["__name__"]}
                        },
                        "value": [timestamp, str(value)]
                    })
                
                return {"data": {"result": result}}
        except Exception as e:
            logger.error(f"Failed to query metrics: {e}")
            return {"data": {"result": []}}

    def _get_metrics_range(self, metric_name: str) -> Dict[str, Any]:
        """Get time series data for a metric."""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                # Get metrics from the last 10 minutes
                cutoff = time.time() - 600
                cursor.execute("""
                    SELECT labels, GROUP_CONCAT(timestamp || ',' || value, ';') as series
                    FROM metrics 
                    WHERE name = ? AND timestamp > ?
                    GROUP BY labels
                    ORDER BY timestamp DESC
                    LIMIT 10
                """, (metric_name, cutoff))
                rows = cursor.fetchall()
                
                result = []
                for labels_str, series_str in rows:
                    try:
                        labels = json.loads(labels_str) if labels_str else {}
                    except:
                        labels = {}
                    
                    pod = labels.get("pod", labels.get("instance", "unknown"))
                    namespace = labels.get("namespace", "default")
                    
                    # Parse series data
                    values = []
                    if series_str:
                        for point in series_str.split(";"):
                            parts = point.split(",")
                            if len(parts) == 2:
                                values.append([float(parts[0]), parts[1]])
                    
                    if values:
                        result.append({
                            "metric": {
                                "__name__": metric_name,
                                "pod": pod,
                                "namespace": namespace
                            },
                            "values": values
                        })
                
                return {"data": {"result": result}}
        except Exception as e:
            logger.error(f"Failed to query metric range: {e}")
            return {"data": {"result": []}}

    def _get_restart_metrics(self) -> Dict[str, Any]:
        """
        Detect potential restart scenarios by looking for error patterns in logs
        or pods with high resource usage.
        """
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                
                # Look for error logs which might indicate restart-worthy issues
                cursor.execute("""
                    SELECT labels, COUNT(*) as error_count
                    FROM logs 
                    WHERE line LIKE '%error%' OR line LIKE '%Error%' OR line LIKE '%ERROR%'
                       OR line LIKE '%failed%' OR line LIKE '%crash%' OR line LIKE '%OOM%'
                    GROUP BY labels
                    HAVING error_count > 0
                    ORDER BY error_count DESC
                    LIMIT 20
                """)
                rows = cursor.fetchall()
                
                result = []
                for labels_str, error_count in rows:
                    try:
                        labels = json.loads(labels_str) if labels_str else {}
                    except:
                        labels = {}
                    
                    pod = labels.get("pod", labels.get("app", "unknown"))
                    namespace = labels.get("namespace", "default")
                    
                    # Treat high error count as potential restart signal
                    if error_count >= 3:
                        result.append({
                            "metric": {
                                "__name__": "kube_pod_container_status_restarts_total",
                                "pod": pod,
                                "namespace": namespace
                            },
                            "value": [time.time(), str(error_count / 3)]  # Normalize as "restart rate"
                        })
                
                return {"data": {"result": result}}
        except Exception as e:
            logger.error(f"Failed to query restart metrics: {e}")
            return {"data": {"result": []}}

