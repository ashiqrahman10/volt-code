import sys
import threading
import time
import json
import logging
import queue
from unittest.mock import MagicMock, patch

# Mock redis before importing server
import fakeredis
sys.modules['redis'] = MagicMock()
sys.modules['redis'].Redis = fakeredis.FakeRedis

# Now import server components
from src.database import Database
from src.server import redis_client, QUEUE_KEY, data_processor, cleanup_loop

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("validation")

def verify_redis_queue():
    print("--- Verifying Redis Queue ---")
    
    # Start the processor in a thread
    processor_thread = threading.Thread(target=data_processor, daemon=True)
    processor_thread.start()
    
    # Push a metric to Redis
    test_metric = {
        'type': 'metric',
        'timestamp': int(time.time() * 1000),
        'name': 'redis_test_metric',
        'labels': {'job': 'test'},
        'value': 99.9
    }
    redis_client.rpush(QUEUE_KEY, json.dumps(test_metric))
    print(f"Pushed metric: {test_metric['name']}")
    
    # Wait a bit for processing
    time.sleep(2)
    
    # Check DB
    db = Database()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM metrics WHERE name = 'redis_test_metric'")
        row = cursor.fetchone()
        
    if row:
        print("SUCCESS: Metric found in DB.")
    else:
        print("FAILURE: Metric NOT found in DB.")
        sys.exit(1)

def verify_log_deduplication():
    print("\n--- Verifying Log Deduplication ---")
    
    db = Database()
    ts = int(time.time() * 1000)
    labels = {'app': 'dedup_test'}
    line = "Duplicate log message"
    
    # Insert same log 3 times directly via DB to test logic, or via queue
    # Let's test via queue to be end-to-end
    
    for _ in range(3):
        item = {
            'type': 'log',
            'timestamp': ts,
            'labels': labels,
            'line': line
        }
        redis_client.rpush(QUEUE_KEY, json.dumps(item))
        
    print("Pushed 3 identical logs.")
    time.sleep(2)
    
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT count FROM logs WHERE line = ?", (line,))
        row = cursor.fetchone()
        
    if row:
        count = row[0]
        print(f"Log count in DB: {count}")
        if count == 3:
             print("SUCCESS: Log count is 3 (deduplicated).")
        else:
             print(f"FAILURE: Expected count 3, got {count}.")
             # If logic is insert ... on conflict update count = count + 1
             # First insert: count=1. Second: count=2. Third: count=3.
             sys.exit(1)
    else:
        print("FAILURE: Log not found.")
        sys.exit(1)

def verify_log_retention():
    print("\n--- Verifying Log Retention ---")
    db = Database()
    
    # Manually insert an old log
    old_ts = int((time.time() - 20 * 60) * 1000) # 20 mins ago
    db.insert_log(old_ts, {'app': 'old'}, "Old log")
    
    print("Inserted old log (20 mins ago).")
    
    # Trigger cleanup manually
    db.delete_old_logs(retention_minutes=10)
    
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM logs WHERE line = 'Old log'")
        row = cursor.fetchone()
        
    if not row:
         print("SUCCESS: Old log was deleted.")
    else:
         print("FAILURE: Old log still exists.")
         sys.exit(1)

if __name__ == "__main__":
    verify_redis_queue()
    verify_log_deduplication()
    verify_log_retention()
    print("\nALL TESTS PASSED")
