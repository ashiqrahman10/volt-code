#!/bin/bash
# scripts/build_proto.sh

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Create output directory if it doesn't exist
mkdir -p src/proto/generated

# Compile protos
# We use grpc_tools.protoc to generate Python code from the .proto files.
# -I specifies the include directory (src/proto).
# --python_out and --grpc_python_out specify where to save the generated code.

./venv/bin/python -m grpc_tools.protoc \
    -I src/proto \
    --python_out=src/proto/generated \
    --grpc_python_out=src/proto/generated \
    src/proto/types.proto src/proto/remote.proto src/proto/logproto.proto

# Create __init__.py files to make it a package
touch src/proto/__init__.py
touch src/proto/generated/__init__.py

echo "Protobuf compilation complete."
