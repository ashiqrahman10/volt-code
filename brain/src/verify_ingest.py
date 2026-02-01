import requests
import snappy
import time
from src.proto.generated import remote_pb2, types_pb2

def verify_ingest():
    url = "http://localhost:9091/api/v1/receive"
    
    print(f"Sending request to {url}...")

    # 1. Create a WriteRequest
    write_request = remote_pb2.WriteRequest()
    
    # Create a TimeSeries
    ts = write_request.timeseries.add()
    
    # Add Labels
    label = ts.labels.add()
    label.name = "__name__"
    label.value = "test_metric"
    
    label2 = ts.labels.add()
    label2.name = "job"
    label2.value = "verification_script"
    
    # Add Sample
    sample = ts.samples.add()
    sample.value = 123.456
    sample.timestamp = int(time.time() * 1000) # ms timestamp
    
    # 2. Serialize and Compress
    serialized_data = write_request.SerializeToString()
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
        
        if response.status_code == 200:
            print("SUCCESS: Server returned 200 OK.")
        else:
            print(f"FAILURE: Server returned {response.status_code}.")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print(f"FAILURE: Could not connect to {url}. Is the server running?")

if __name__ == "__main__":
    verify_ingest()
