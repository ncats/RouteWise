#!/bin/bash

set -e

ENV_NAME="playwright-e2e"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$SCRIPT_DIR/.env"
UI_TEST_DIR="$SCRIPT_DIR/ui"
API_TEST_DIR="$SCRIPT_DIR/api"

source "$(conda info --base)/etc/profile.d/conda.sh"

# Check for conda env
if ! conda info --envs | grep -q "^$ENV_NAME\s"; then
  echo "❌ Conda environment '$ENV_NAME' does not exist. Run setup first."
  exit 1
fi

# Check for .env
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at $ENV_FILE"
  exit 1
fi

# Activate env
conda activate "$ENV_NAME"

# Pass args through (support --headless override, etc.)
HEADLESS_OVERRIDE=""
PYTEST_ARGS=()

for arg in "$@"; do
  if [[ "$arg" == --headless=* ]]; then
    HEADLESS_OVERRIDE="${arg#--headless=}"
  else
    PYTEST_ARGS+=("$arg")
  fi
done

if [ -n "$HEADLESS_OVERRIDE" ]; then
  export HEADLESS="$HEADLESS_OVERRIDE"
fi

echo "🚀 Running Pytest with args: ${PYTEST_ARGS[*]}"
pytest "$UI_TEST_DIR" "$API_TEST_DIR" "${PYTEST_ARGS[@]}"
