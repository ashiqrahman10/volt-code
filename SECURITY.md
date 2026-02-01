# Security Best Practices

## Overview
This document outlines security best practices for the volt-code project to prevent exposure of sensitive credentials and secrets.

## Environment Variables

### Required Environment Variables

The following environment variables must be configured before deploying:

#### Loki S3 Configuration
- `LOKI_S3_BUCKET_NAME` - DigitalOcean Spaces bucket name
- `LOKI_S3_ENDPOINT` - S3 endpoint URL (e.g., https://sfo3.digitaloceanspaces.com)
- `LOKI_S3_REGION` - Region for the S3 bucket (e.g., sfo3)
- `LOKI_S3_ACCESS_KEY_ID` - DigitalOcean Spaces access key
- `LOKI_S3_SECRET_ACCESS_KEY` - DigitalOcean Spaces secret key

#### Loki Push Configuration
- `LOKI_PUSH_URL` - URL for Loki push endpoint (e.g., https://your-endpoint.com/loki/api/v1/push)

#### Prometheus Configuration
- `PROMETHEUS_REMOTE_WRITE_URL` - Prometheus remote write endpoint URL

#### Application Configuration
- `GROQ_API_KEYS` - Comma-separated list of Groq API keys for load balancing
- `GROQ_MODEL` - Groq model to use (default: llama-3.3-70b-versatile)
- `DO_SPACES_KEY` - DigitalOcean Spaces key
- `DO_SPACES_SECRET` - DigitalOcean Spaces secret
- `DO_SPACES_BUCKET` - DigitalOcean Spaces bucket name
- `DO_SPACES_REGION` - DigitalOcean Spaces region
- `GATEWAY_URL` - Gateway URL (default: http://localhost:8080)
- `MEMORY_THRESHOLD` - Memory threshold percentage (default: 80.0)

## Secrets Management

### DO NOT:
- ❌ Hardcode credentials in source code files
- ❌ Commit `.env` files to version control
- ❌ Include secrets in YAML/JSON configuration files
- ❌ Print or log API keys or secrets (even partial values)
- ❌ Share credentials in plain text via chat/email

### DO:
- ✅ Use environment variables for all sensitive configuration
- ✅ Use Kubernetes Secrets for in-cluster credentials
- ✅ Use a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault)
- ✅ Rotate credentials regularly
- ✅ Use different credentials for different environments (dev/staging/prod)
- ✅ Review code changes for accidentally committed secrets before pushing

## Kubernetes Secrets

For Kubernetes deployments, create secrets using:

```bash
# Loki S3 credentials
kubectl create secret generic loki-s3-credentials \
  --from-literal=access-key-id=YOUR_ACCESS_KEY \
  --from-literal=secret-access-key=YOUR_SECRET_KEY \
  --namespace=monitoring

# Reference in deployment
env:
  - name: LOKI_S3_ACCESS_KEY_ID
    valueFrom:
      secretKeyRef:
        name: loki-s3-credentials
        key: access-key-id
  - name: LOKI_S3_SECRET_ACCESS_KEY
    valueFrom:
      secretKeyRef:
        name: loki-s3-credentials
        key: secret-access-key
```

## Configuration File Setup

### For Development:
1. Copy example configuration:
   ```bash
   cp brain/config.env.example brain/config.env
   ```
2. Fill in your local development credentials
3. Never commit `config.env` (it's in .gitignore)

### For Production:
Use environment variables or Kubernetes secrets instead of config files.

## Debug Logging

When debugging, avoid logging sensitive information:

```python
# BAD
print(f"API Key: {api_key}")
print(f"Token: {token[:10]}...")

# GOOD
print(f"API Key configured: {'Yes' if api_key else 'No'}")
print(f"Authentication: {'Enabled' if token else 'Disabled'}")
```

## Secret Scanning

The repository should be regularly scanned for exposed secrets using tools like:
- `git-secrets`
- `truffleHog`
- `gitleaks`
- GitHub Secret Scanning

## If You Accidentally Commit a Secret

1. **Immediately rotate the compromised credential**
2. Remove the secret from version history:
   ```bash
   # Use git filter-branch or BFG Repo-Cleaner
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push the cleaned history
4. Notify the security team

## Regular Security Audits

- Review access logs for unusual activity
- Audit who has access to secrets
- Check for secrets in version control history
- Verify secrets rotation schedule
- Update dependencies for security patches

## Contact

For security concerns, please contact the security team immediately.
