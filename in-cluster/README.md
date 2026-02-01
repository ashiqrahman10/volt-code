# In-Cluster Deployment Configuration

This directory contains Kubernetes manifests for deploying monitoring components (Prometheus, Loki, Promtail) in your cluster.

## ⚠️ Security Notice

**The configuration files in this directory use environment variable placeholders for sensitive credentials.**

You must substitute these placeholders with actual values before deploying, using one of the methods below.

## Required Environment Variables

Before deploying, you need to configure the following environment variables:

### Loki Configuration (`loki.yaml`)
- `LOKI_S3_BUCKET_NAME` - S3/Spaces bucket name
- `LOKI_S3_ENDPOINT` - S3 endpoint URL
- `LOKI_S3_REGION` - Region identifier
- `LOKI_S3_ACCESS_KEY_ID` - S3 access key
- `LOKI_S3_SECRET_ACCESS_KEY` - S3 secret key

### Promtail Configuration (`promtail.yaml`)
- `LOKI_PUSH_URL` - Loki push endpoint URL

### Prometheus Configuration (`prometheus.yaml`)
- `PROMETHEUS_REMOTE_WRITE_URL` - Remote write endpoint URL

## Deployment Methods

### Method 1: Using envsubst (Recommended for CI/CD)

```bash
# Export environment variables
export LOKI_S3_BUCKET_NAME="your-bucket"
export LOKI_S3_ENDPOINT="https://sfo3.digitaloceanspaces.com"
export LOKI_S3_REGION="sfo3"
export LOKI_S3_ACCESS_KEY_ID="your-access-key"
export LOKI_S3_SECRET_ACCESS_KEY="your-secret-key"
export LOKI_PUSH_URL="https://your-endpoint.com/loki/api/v1/push"
export PROMETHEUS_REMOTE_WRITE_URL="https://your-endpoint.com/api/v1/receive"

# Create namespace
kubectl create namespace monitoring

# Apply configurations with variable substitution
envsubst < loki.yaml | kubectl apply -f -
envsubst < promtail.yaml | kubectl apply -f -
envsubst < prometheus.yaml | kubectl apply -f -
```

### Method 2: Using Kubernetes Secrets (Recommended for Production)

1. Create a Kubernetes Secret with credentials:

```bash
kubectl create namespace monitoring

kubectl create secret generic loki-s3-config \
  --from-literal=bucket-name="your-bucket" \
  --from-literal=endpoint="https://sfo3.digitaloceanspaces.com" \
  --from-literal=region="sfo3" \
  --from-literal=access-key-id="your-access-key" \
  --from-literal=secret-access-key="your-secret-key" \
  --namespace=monitoring

kubectl create secret generic monitoring-endpoints \
  --from-literal=loki-push-url="https://your-endpoint.com/loki/api/v1/push" \
  --from-literal=prometheus-remote-write-url="https://your-endpoint.com/api/v1/receive" \
  --namespace=monitoring
```

2. Modify the manifests to reference the secrets using `valueFrom.secretKeyRef` instead of direct environment variable substitution.

### Method 3: Using Helm or Kustomize

For more complex deployments, consider using Helm charts or Kustomize overlays to manage configuration across different environments.

## Verification

After deployment, verify the pods are running:

```bash
kubectl get pods -n monitoring
kubectl logs -n monitoring deployment/loki
kubectl logs -n monitoring deployment/prometheus
kubectl logs -n monitoring daemonset/promtail
```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use different credentials** for each environment (dev/staging/prod)
3. **Rotate credentials** regularly
4. **Limit access** to Kubernetes secrets using RBAC
5. **Enable audit logging** to track secret access
6. **Use a secrets manager** (e.g., AWS Secrets Manager, HashiCorp Vault) for production

## Troubleshooting

### Pods not starting
Check if all environment variables are properly set:
```bash
kubectl describe pod -n monitoring <pod-name>
```

### Authentication failures
Verify credentials are correct and have proper permissions:
```bash
kubectl logs -n monitoring <pod-name>
```

### Network connectivity issues
Check if endpoints are reachable from the cluster:
```bash
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- sh
# Inside the pod:
curl -I https://your-endpoint.com
```

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Promtail Documentation](https://grafana.com/docs/loki/latest/clients/promtail/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
