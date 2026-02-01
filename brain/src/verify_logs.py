import requests
import snappy
import time
from src.proto.generated import logproto_pb2
from google.protobuf.timestamp_pb2 import Timestamp

def verify_log_ingest():
    url = "http://localhost:9091/loki/api/v1/push"
    
    print(f"Sending log request to {url}...")

    # 1. Create a PushRequest
    push_request = logproto_pb2.PushRequest()
    
    # Create a Stream
    stream = push_request.streams.add()
    stream.labels = '{app="test-app", env="dev"}'
    
    # Create an Entry
    entry = stream.entries.add()
    timestamp = Timestamp()
    timestamp.GetCurrentTime()
    entry.timestamp.CopyFrom(timestamp)
    entry.line = "This is a test log message from verify_logs.py"
    
    # 2. Serialize and Compress
    serialized_data = push_request.SerializeToString()
    compressed_data = snappy.compress(serialized_data)
    
    # 3. Send Request
    try:
        response = requests.post(
            url, 
            data=compressed_data, 
            headers={
                "Content-Encoding": "snappy",
                "Content-Type": "application/x-protobuf"
            }
        )
        
        if response.status_code == 204:
            print("SUCCESS: Server returned 204 OK.")
        else:
            print(f"FAILURE: Server returned {response.status_code}.")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print(f"FAILURE: Could not connect to {url}. Is the server running?")

if __name__ == "__main__":
    verify_log_ingest()
