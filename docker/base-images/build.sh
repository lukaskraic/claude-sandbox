#!/bin/bash
set -e

REGISTRY=${REGISTRY:-"localhost"}
TAG=${TAG:-"latest"}

echo "Building claude-sandbox/node:${TAG}..."
podman build -t ${REGISTRY}/claude-sandbox/node:${TAG} -f node/Dockerfile .

echo "Build complete!"
echo "To push: podman push ${REGISTRY}/claude-sandbox/node:${TAG}"
