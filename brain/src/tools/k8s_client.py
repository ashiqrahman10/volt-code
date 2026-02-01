import logging
import time
from typing import Any, Dict, List, Optional

from kubernetes import client, config
from kubernetes.client.rest import ApiException

logger = logging.getLogger(__name__)

class KubernetesToolbox:
    """
    A toolbox for interacting with the Kubernetes API.
    Handles loading configuration (in-cluster or local) and provides high-level methods.
    """
    
    def __init__(self):
        self._load_config()
        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        
    def _load_config(self):
        """Load Kubernetes configuration."""
        try:
            # Try loading in-cluster config first
            config.load_incluster_config()
            logger.info("Loaded in-cluster Kubernetes config")
        except config.ConfigException:
            try:
                # Fallback to local kubeconfig
                config.load_kube_config()
                logger.info("Loaded local kubeconfig")
            except config.ConfigException:
                logger.error("Could not load Kubernetes configuration")
                raise

    def list_pods(self, namespace: str = "default") -> List[Dict[str, Any]]:
        """List pods in a namespace."""
        try:
            pods = self.core_v1.list_namespaced_pod(namespace)
            result = []
            for pod in pods.items:
                result.append({
                    "name": pod.metadata.name,
                    "namespace": pod.metadata.namespace,
                    "status": pod.status.phase,
                    "node": pod.spec.node_name,
                    "ip": pod.status.pod_ip,
                    "restarts": sum(c.restart_count for c in pod.status.container_statuses) if pod.status.container_statuses else 0
                })
            return result
        except ApiException as e:
            logger.error(f"Failed to list pods: {e}")
            return []

    def get_pod_logs(self, name: str, namespace: str, lines: int = 100, container: str | None = None) -> str:
        """Get logs for a pod. Specify container for multi-container pods."""
        try:
            return self.core_v1.read_namespaced_pod_log(
                name=name,
                namespace=namespace,
                tail_lines=lines,
                container=container
            )
        except ApiException as e:
            logger.error(f"Failed to get logs for {name}: {e}")
            return f"Error retrieving logs: {e}"

    def delete_pod(self, name: str, namespace: str) -> Dict[str, Any]:
        """Delete a pod (triggering restart by controller)."""
        try:
            self.core_v1.delete_namespaced_pod(name=name, namespace=namespace)
            logger.info(f"Deleted pod {name} in {namespace}")
            return {"status": "success", "action": "delete_pod", "target": name}
        except ApiException as e:
            logger.error(f"Failed to delete pod {name}: {e}")
            return {"status": "error", "message": str(e)}

    def rollout_restart(self, deployment_name: str, namespace: str) -> Dict[str, Any]:
        """
        Perform a rollout restart of a deployment by updating an annotation.
        """
        try:
            # Patch the deployment with a timestamp annotation to trigger restart
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": f"{datetime.utcnow().isoformat()}Z"
                            }
                        }
                    }
                }
            }
            from datetime import datetime
            
            self.apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=namespace,
                body=body
            )
            logger.info(f"Triggered rollout restart for {deployment_name}")
            return {"status": "success", "action": "rollout_restart", "target": deployment_name}
        except ApiException as e:
            logger.error(f"Failed to restart deployment {deployment_name}: {e}")
            return {"status": "error", "message": str(e)}

    def scale_deployment(self, name: str, namespace: str, replicas: int) -> Dict[str, Any]:
        """Scale a deployment."""
        try:
            body = {"spec": {"replicas": replicas}}
            self.apps_v1.patch_namespaced_deployment(
                name=name,
                namespace=namespace,
                body=body
            )
            logger.info(f"Scaled {name} to {replicas} replicas")
            return {"status": "success", "action": "scale", "target": name, "replicas": replicas}
        except ApiException as e:
            logger.error(f"Failed to scale {name}: {e}")
            return {"status": "error", "message": str(e)}

    def list_nodes(self) -> List[Dict[str, Any]]:
        """List all nodes in the cluster."""
        try:
            nodes = self.core_v1.list_node()
            result = []
            for node in nodes.items:
                # Check node conditions for Ready status
                ready = False
                for condition in node.status.conditions or []:
                    if condition.type == "Ready":
                        ready = condition.status == "True"
                        break
                
                # Get allocatable resources
                allocatable = node.status.allocatable or {}
                capacity = node.status.capacity or {}
                
                result.append({
                    "name": node.metadata.name,
                    "ready": ready,
                    "cpu_capacity": capacity.get("cpu", "0"),
                    "memory_capacity": capacity.get("memory", "0"),
                    "cpu_allocatable": allocatable.get("cpu", "0"),
                    "memory_allocatable": allocatable.get("memory", "0"),
                })
            return result
        except ApiException as e:
            logger.error(f"Failed to list nodes: {e}")
            return []

    def get_cluster_metrics(self) -> Dict[str, Any]:
        """Get cluster-wide metrics (CPU, memory, pods, nodes)."""
        try:
            # Get nodes
            nodes = self.list_nodes()
            nodes_ready = sum(1 for n in nodes if n.get("ready"))
            nodes_total = len(nodes)
            
            # Get all pods
            pods = self.core_v1.list_pod_for_all_namespaces()
            pods_running = 0
            pods_pending = 0
            pods_failed = 0
            pods_total = len(pods.items)
            
            for pod in pods.items:
                phase = pod.status.phase
                if phase == "Running":
                    pods_running += 1
                elif phase == "Pending":
                    pods_pending += 1
                elif phase in ("Failed", "Unknown"):
                    pods_failed += 1
            
            # Calculate approximate CPU/memory (simplified)
            # Real implementation would use metrics-server
            total_cpu_capacity = 0
            total_memory_capacity = 0
            
            for node in nodes:
                cpu_str = node.get("cpu_capacity", "0")
                mem_str = node.get("memory_capacity", "0")
                
                # Parse CPU (cores or millicores)
                if cpu_str.endswith("m"):
                    total_cpu_capacity += int(cpu_str[:-1]) / 1000
                else:
                    try:
                        total_cpu_capacity += int(cpu_str)
                    except:
                        pass
                
                # Parse memory (Ki, Mi, Gi)
                try:
                    if mem_str.endswith("Ki"):
                        total_memory_capacity += int(mem_str[:-2]) * 1024
                    elif mem_str.endswith("Mi"):
                        total_memory_capacity += int(mem_str[:-2]) * 1024 * 1024
                    elif mem_str.endswith("Gi"):
                        total_memory_capacity += int(mem_str[:-2]) * 1024 * 1024 * 1024
                except:
                    pass
            
            # Estimate usage (placeholder - real values need metrics-server)
            cpu_usage_estimate = total_cpu_capacity * 0.3  # 30% estimate
            memory_usage_estimate = total_memory_capacity * 0.4  # 40% estimate
            
            return {
                "cpu": {
                    "usage": round(cpu_usage_estimate, 2),
                    "capacity": round(total_cpu_capacity, 2)
                },
                "memory": {
                    "usage": int(memory_usage_estimate),
                    "capacity": int(total_memory_capacity)
                },
                "pods": {
                    "running": pods_running,
                    "pending": pods_pending,
                    "failed": pods_failed,
                    "total": pods_total
                },
                "nodes": {
                    "ready": nodes_ready,
                    "total": nodes_total
                }
            }
        except ApiException as e:
            logger.error(f"Failed to get cluster metrics: {e}")
            return {
                "cpu": {"usage": 0, "capacity": 0},
                "memory": {"usage": 0, "capacity": 0},
                "pods": {"running": 0, "pending": 0, "failed": 0, "total": 0},
                "nodes": {"ready": 0, "total": 0}
            }

    def list_events(self, namespace: str | None = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List Kubernetes events."""
        try:
            if namespace:
                events = self.core_v1.list_namespaced_event(namespace, limit=limit)
            else:
                events = self.core_v1.list_event_for_all_namespaces(limit=limit)
            
            result = []
            for event in events.items:
                result.append({
                    "timestamp": event.last_timestamp.isoformat() if event.last_timestamp else event.metadata.creation_timestamp.isoformat() if event.metadata.creation_timestamp else "",
                    "type": event.type or "Normal",
                    "reason": event.reason or "",
                    "message": event.message or "",
                    "object": f"{event.involved_object.kind}/{event.involved_object.name}" if event.involved_object else "",
                    "namespace": event.metadata.namespace or "",
                    "count": event.count or 1
                })
            
            # Sort by timestamp descending
            result.sort(key=lambda x: x["timestamp"], reverse=True)
            return result[:limit]
        except ApiException as e:
            logger.error(f"Failed to list events: {e}")
            return []

    def get_version_info(self) -> Dict[str, str]:
        """Get Kubernetes cluster version."""
        try:
            version_api = client.VersionApi()
            version = version_api.get_code()
            return {
                "version": version.git_version,
                "platform": version.platform
            }
        except Exception as e:
            logger.error(f"Failed to get version: {e}")
            return {"version": "unknown", "platform": "unknown"}

# Global instance
try:
    k8s_toolbox = KubernetesToolbox()
except Exception as e:
    logger.warning(f"Failed to initialize Kubernetes toolbox: {e}")
    k8s_toolbox = None

