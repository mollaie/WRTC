#!/bin/sh

# Set environment variables to ignore SSL verification
export PYTHONWARNINGS="ignore:Unverified HTTPS request"
export PYTHONHTTPSVERIFY=0

# Execute the original command passed as arguments
exec "$@"
