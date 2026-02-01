import sqlite3
import logging
import json
import hashlib
from contextlib import contextmanager

logger = logging.getLogger(__name__)

DB_NAME = "brain.db"

class Database:
    def __init__(self, db_name=DB_NAME):
        self.db_name = db_name
        self.init_db()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_name)
        try:
            yield conn
        finally:
            conn.close()

    def init_db(self):
        """Initialize the database with necessary tables."""
        create_metrics_table = """
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            name TEXT NOT NULL,
            labels TEXT,
            value REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        # Updated logs table with hash for deduplication and count
        create_logs_table = """
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            labels TEXT,
            line TEXT NOT NULL,
            hash TEXT UNIQUE,
            count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(create_metrics_table)
            cursor.execute(create_logs_table)
            
            # Migration: Ensure new columns exist
            try:
                cursor.execute("ALTER TABLE logs ADD COLUMN hash TEXT")
            except sqlite3.OperationalError:
                pass # Column likely already exists

            try:
                cursor.execute("ALTER TABLE logs ADD COLUMN count INTEGER DEFAULT 1")
            except sqlite3.OperationalError:
                pass # Column likely already exists
                
            # Ensure hash index exists
            try:
                cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_hash ON logs(hash);")
            except sqlite3.OperationalError:
                pass

            conn.commit()
            logger.info("Database initialized successfully.")

    def insert_metric(self, timestamp, name, labels, value):
        """Insert a metric into the database."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO metrics (timestamp, name, labels, value) VALUES (?, ?, ?, ?)",
                    (timestamp, name, json.dumps(labels), value)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to insert metric: {e}")

    def insert_log(self, timestamp, labels, line):
        """Insert a log entry into the database with deduplication."""
        try:
            # Generate hash of labels + line to identify duplicates
            labels_str = json.dumps(labels, sort_keys=True)
            content_hash = hashlib.sha256((labels_str + line).encode('utf-8')).hexdigest()

            with self.get_connection() as conn:
                cursor = conn.cursor()
                # Upsert: Insert or update timestamp and increment count
                cursor.execute(
                    """
                    INSERT INTO logs (timestamp, labels, line, hash, count) 
                    VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT(hash) DO UPDATE SET 
                        timestamp = excluded.timestamp,
                        count = count + 1
                    """,
                    (timestamp, labels_str, line, content_hash)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to insert log: {e}")

    def _parse_labels(self, labels_raw: str | None) -> dict:
        """Parse stored labels into a dictionary."""
        if not labels_raw:
            return {}
        try:
            return json.loads(labels_raw)
        except json.JSONDecodeError:
            pass
        stripped = labels_raw.strip()
        if stripped.startswith("{") and stripped.endswith("}"):
            stripped = stripped[1:-1]
        if not stripped:
            return {}
        labels = {}
        for part in stripped.split(","):
            part = part.strip()
            if not part or "=" not in part:
                continue
            key, value = part.split("=", 1)
            labels[key.strip()] = value.strip().strip('"')
        return labels

    def delete_old_logs(self, retention_minutes=10):
        """Delete logs older than retention_minutes."""
        try:
            # Calculate cutoff timestamp (ms)
            # retention is in minutes, timestamp in ms
            import time
            cutoff_time = int((time.time() - (retention_minutes * 60)) * 1000)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM logs WHERE timestamp < ?", (cutoff_time,))
                deleted_count = cursor.rowcount
                conn.commit()
                if deleted_count > 0:
                    logger.info(f"Deleted {deleted_count} old log entries.")
        except Exception as e:
            logger.error(f"Failed to delete old logs: {e}")

    def get_logs(self, namespace: str | None = None, pod: str | None = None, limit: int = 100) -> list[dict]:
        """Get logs with optional filters."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                query = "SELECT id, timestamp, labels, line, count FROM logs ORDER BY timestamp DESC LIMIT ?"
                cursor.execute(query, (limit,))
                rows = cursor.fetchall()
                
                logs = []
                for row in rows:
                    labels_raw = row[2]
                    labels = self._parse_labels(labels_raw)
                    
                    # Parse namespace and pod from labels if available
                    log_namespace = labels.get("namespace", "unknown")
                    log_pod = labels.get("pod", labels.get("instance", "unknown"))
                    
                    # Apply filters
                    if namespace and log_namespace != namespace:
                        continue
                    if pod and log_pod != pod:
                        continue
                    
                    # Determine log level from line content
                    line = row[3]
                    level = "info"
                    if "error" in line.lower() or "err" in line.lower():
                        level = "error"
                    elif "warn" in line.lower():
                        level = "warn"
                    elif "debug" in line.lower():
                        level = "debug"
                    
                    logs.append({
                        "timestamp": self._ms_to_iso(row[1]),
                        "level": level,
                        "message": line,
                        "pod": log_pod,
                        "namespace": log_namespace,
                        "count": row[4] or 1
                    })
                
                return logs
        except Exception as e:
            logger.error(f"Failed to get logs: {e}")
            return []

    def _ms_to_iso(self, timestamp_ms: int) -> str:
        """Convert millisecond timestamp to ISO format string."""
        from datetime import datetime
        return datetime.utcfromtimestamp(timestamp_ms / 1000).isoformat() + "Z"

    # ============== Audit Log ==============
    
    def _init_audit_table(self):
        """Initialize audit log table."""
        create_audit_table = """
        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            action TEXT NOT NULL,
            actor TEXT NOT NULL,
            target TEXT,
            details TEXT,
            result TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(create_audit_table)
            conn.commit()

    def insert_audit_entry(self, entry_id: str, action: str, actor: str, target: str, 
                          details: str, result: str, metadata: dict | None = None):
        """Insert an audit log entry."""
        import time
        try:
            # Ensure table exists
            self._init_audit_table()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO audit_log (id, timestamp, action, actor, target, details, result, metadata)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (entry_id, int(time.time() * 1000), action, actor, target, details, result, 
                     json.dumps(metadata) if metadata else None)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to insert audit entry: {e}")

    def get_audit_log(self, limit: int = 100) -> list[dict]:
        """Get audit log entries."""
        try:
            self._init_audit_table()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, timestamp, action, actor, target, details, result, metadata FROM audit_log ORDER BY timestamp DESC LIMIT ?",
                    (limit,)
                )
                rows = cursor.fetchall()
                
                entries = []
                for row in rows:
                    metadata = None
                    if row[7]:
                        try:
                            metadata = json.loads(row[7])
                        except:
                            pass
                    
                    entries.append({
                        "id": row[0],
                        "timestamp": self._ms_to_iso(row[1]),
                        "action": row[2],
                        "actor": row[3],
                        "target": row[4],
                        "details": row[5],
                        "result": row[6],
                        "metadata": metadata
                    })
                
                return entries
        except Exception as e:
            logger.error(f"Failed to get audit log: {e}")
            return []

    # ============== Issues ==============
    
    def _init_issues_table(self):
        """Initialize issues table."""
        create_issues_table = """
        CREATE TABLE IF NOT EXISTS issues (
            id TEXT PRIMARY KEY,
            incident_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            remediation_attempts TEXT,
            verified INTEGER DEFAULT 0,
            verification_message TEXT
        );
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(create_issues_table)
            conn.commit()

    def insert_issue(self, issue_id: str, incident_id: str, status: str = "open"):
        """Create a new issue from an incident."""
        import time
        try:
            self._init_issues_table()
            now = int(time.time() * 1000)
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO issues (id, incident_id, status, created_at, updated_at, remediation_attempts)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (issue_id, incident_id, status, now, now, "[]")
                )
                conn.commit()
                return {"id": issue_id, "incident_id": incident_id, "status": status}
        except Exception as e:
            logger.error(f"Failed to insert issue: {e}")
            return None

    def get_issues(self) -> list[dict]:
        """Get all issues."""
        try:
            self._init_issues_table()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, incident_id, status, created_at, updated_at, remediation_attempts, verified, verification_message FROM issues ORDER BY created_at DESC"
                )
                rows = cursor.fetchall()
                
                issues = []
                for row in rows:
                    attempts = []
                    if row[5]:
                        try:
                            attempts = json.loads(row[5])
                        except:
                            pass
                    
                    issues.append({
                        "id": row[0],
                        "incidentId": row[1],
                        "status": row[2],
                        "createdAt": self._ms_to_iso(row[3]),
                        "updatedAt": self._ms_to_iso(row[4]),
                        "remediationAttempts": attempts,
                        "verified": bool(row[6]),
                        "verificationMessage": row[7]
                    })
                
                return issues
        except Exception as e:
            logger.error(f"Failed to get issues: {e}")
            return []

    def get_issue(self, issue_id: str) -> dict | None:
        """Get a single issue by ID."""
        try:
            self._init_issues_table()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, incident_id, status, created_at, updated_at, remediation_attempts, verified, verification_message FROM issues WHERE id = ?",
                    (issue_id,)
                )
                row = cursor.fetchone()
                
                if not row:
                    return None
                
                attempts = []
                if row[5]:
                    try:
                        attempts = json.loads(row[5])
                    except:
                        pass
                
                return {
                    "id": row[0],
                    "incidentId": row[1],
                    "status": row[2],
                    "createdAt": self._ms_to_iso(row[3]),
                    "updatedAt": self._ms_to_iso(row[4]),
                    "remediationAttempts": attempts,
                    "verified": bool(row[6]),
                    "verificationMessage": row[7]
                }
        except Exception as e:
            logger.error(f"Failed to get issue: {e}")
            return None

    def update_issue(self, issue_id: str, status: str | None = None, 
                    remediation_attempts: list | None = None,
                    verified: bool | None = None, verification_message: str | None = None) -> dict | None:
        """Update an issue."""
        import time
        try:
            self._init_issues_table()
            
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                updates = ["updated_at = ?"]
                params = [int(time.time() * 1000)]
                
                if status is not None:
                    updates.append("status = ?")
                    params.append(status)
                if remediation_attempts is not None:
                    updates.append("remediation_attempts = ?")
                    params.append(json.dumps(remediation_attempts))
                if verified is not None:
                    updates.append("verified = ?")
                    params.append(1 if verified else 0)
                if verification_message is not None:
                    updates.append("verification_message = ?")
                    params.append(verification_message)
                
                params.append(issue_id)
                
                cursor.execute(
                    f"UPDATE issues SET {', '.join(updates)} WHERE id = ?",
                    params
                )
                conn.commit()
                
                return self.get_issue(issue_id)
        except Exception as e:
            logger.error(f"Failed to update issue: {e}")
            return None
