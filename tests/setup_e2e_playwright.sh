#!/bin/bash

set -e

# Determine the absolute path to the script location (resolves symlinks too)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_NAME="playwright-e2e"
PYTHON_VERSION="3.11"

echo "🔍 Script directory: $SCRIPT_DIR"
echo "🔍 Project root: $PROJECT_ROOT"

# Activate Conda
source "$(conda info --base)/etc/profile.d/conda.sh"

# Check if environment exists
if conda info --envs | grep -q "^$ENV_NAME\s"; then
  echo "✅ Conda environment '$ENV_NAME' already exists."
else
  echo "🚧 Creating conda environment: $ENV_NAME"
  conda create -y -n $ENV_NAME python=$PYTHON_VERSION
fi

echo "📦 Activating environment: $ENV_NAME"
conda activate $ENV_NAME

# Install Python deps
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"
if [ ! -f "$REQUIREMENTS_FILE" ]; then
  echo "❌ Missing requirements.txt in $SCRIPT_DIR"
  exit 1
fi

pip install --upgrade pip
pip install -r "$REQUIREMENTS_FILE"

# Install browser binaries
echo "🧪 Installing Playwright browser dependencies"
playwright install

# Create default .env if it doesn't exist
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "⚙️ Creating default .env file in $SCRIPT_DIR"
  cat <<EOF > "$ENV_FILE"
HEADLESS=true
BASE_UI_URL=http://localhost:4204
BASE_API_URL=http://localhost:5099
EOF
  echo "⚠️  Please fill in AUTH_USERNAME and AUTH_PASSWORD in $ENV_FILE"
fi

echo "✅ Setup complete!"
echo "👉 To activate your environment later, run: conda activate $ENV_NAME"
echo "👉 To run tests: pytest $SCRIPT_DIR/tests"