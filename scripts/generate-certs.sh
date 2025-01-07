#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate CA key and certificate
openssl genrsa -out certs/ca.key 2048
openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 365 -out certs/ca.pem -subj "/C=US/ST=CA/L=San Francisco/O=Codeium/CN=localhost"

# Generate server key
openssl genrsa -out certs/server.key 2048

# Generate server CSR
openssl req -new -key certs/server.key -out certs/server.csr -subj "/C=US/ST=CA/L=San Francisco/O=Codeium/CN=localhost"

# Generate server certificate
openssl x509 -req -in certs/server.csr -CA certs/ca.pem -CAkey certs/ca.key -CAcreateserial -out certs/server.crt -days 365 -sha256

# Set permissions
chmod 600 certs/server.key
chmod 600 certs/ca.key

echo "SSL certificates generated successfully in ./certs directory"