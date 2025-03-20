#!/bin/bash

CONDA_ENV_FILE="environment.yml"

# Check if the environment.yml file exists
if [ ! -f $CONDA_ENV_FILE ]; then
  echo "$CONDA_ENV_FILE file not found!"
  exit 1
fi

# Use awk to extract the name property from the environment.yml file
CONDA_ENV_NAME=$(awk '/^[[:space:]]*name:/ { print $2 }' $CONDA_ENV_FILE)

# Check if the name was found
if [ -z "$CONDA_ENV_NAME" ]; then
  echo "No name property found in $CONDA_ENV_FILE!"
  exit 1
else
  echo "Environment name: $CONDA_ENV_NAME"
fi

# Function to print usage information
usage() {
    echo "Usage: $0 [--dev] [--skip-env-setup] [-h|--help]"
    echo "  --dev                Run the FastAPI app in development mode with auto-reload"
    echo "  --skip-env-setup     Skip the Conda environment creation/update"
    echo "  -h, --help           Show this help message and exit"
}

# Function to convert DEBUG value to boolean
is_debug_mode() {
    # Convert DEBUG to lowercase
    debug_value=$(echo "$DEBUG" | tr '[:upper:]' '[:lower:]')
    if [ "$debug_value" = "true" ]; then
        echo true
    else
        echo false
    fi
}

# Function to check for conda or micromamba
check_conda_or_micromamba() {
    if command -v conda &> /dev/null; then
        echo "Conda is installed"
        CONDA_COMMAND="conda"
        EXTRA_RUN_OPTIONS="--no-capture-output"
    elif command -v micromamba &> /dev/null; then
        echo "Micromamba is installed"
        CONDA_COMMAND="micromamba"
        EXTRA_RUN_OPTIONS=""
    else
        echo "Neither Conda nor Micromamba is installed. Please install one of them."
        exit 1
    fi
    echo "CONDA_COMMAND: $CONDA_COMMAND"
}

# Function to create Conda environment if it does not exist
setup_conda_environment() {
    if $CONDA_COMMAND env list | grep -q "$CONDA_ENV_NAME"; then
        echo "Conda environment '$CONDA_ENV_NAME' already exists. Updating..."
        $CONDA_COMMAND env update -f "$CONDA_ENV_FILE"
    else
        echo "Creating Conda environment from $CONDA_ENV_FILE..."
        $CONDA_COMMAND env create -f "$CONDA_ENV_FILE"
    fi
}

# Function to start FastAPI app with Uvicorn using conda run
start_fastapi() {
    echo "Starting FastAPI app..."
    local mode=$1
    local debug_flag=$2

    if [ "$mode" = "development" ]; then
        exec $CONDA_COMMAND run $EXTRA_RUN_OPTIONS -n "$CONDA_ENV_NAME" uvicorn server:app --reload --host 0.0.0.0 --port 5099 $debug_flag
    else
        exec $CONDA_COMMAND run $EXTRA_RUN_OPTIONS -n "$CONDA_ENV_NAME" uvicorn server:app --host 0.0.0.0 --port 5099 $debug_flag
    fi
}

# Parse arguments
mode="production"
skip_env_setup=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dev) mode="development";;
        --skip-env-setup) skip_env_setup=true;;
        -h|--help) usage; exit 0;;
        *) echo "Unknown parameter passed: $1"; usage; exit 1;;
    esac
    shift
done

# Determine if debug mode is enabled
debug_mode=$(is_debug_mode)
if [ "$debug_mode" = true ]; then
    debug_flag="--log-level debug"
else
    debug_flag=""
fi

# Check if conda or micromamba is installed
check_conda_or_micromamba

# Setup Conda environment if not skipped
if [ "$skip_env_setup" = false ]; then
    echo "Setting up Conda environment..."
    setup_conda_environment
fi

# Start the FastAPI app d
start_fastapi $mode "$debug_flag"