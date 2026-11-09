#!/usr/bin/env bash
set -e
echo "=== Running backend tests ==="
cd backend
export USE_MOCK_LLM=1
export PYTHONPATH=$(pwd)
.venv/bin/python -m pytest -q tests/unit
echo "=== Unit tests passed ==="

echo "=== Running integration tests (mock) ==="
.venv/bin/python -m pytest -q tests/integration || { echo "Integration tests failed"; exit 1; }

cd ../frontend
echo "=== Frontend build ==="
npm run build || { echo "Frontend build failed"; exit 1; }
echo "=== Frontend typecheck ==="
npm run lint || { echo "Frontend typecheck failed"; exit 1; }

echo "=== All verification passed ==="
