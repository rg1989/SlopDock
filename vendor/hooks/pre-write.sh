#!/bin/bash
# Protect sensitive files

TOOL_NAME="$1"
FILE_PATH="$2"

[[ "$TOOL_NAME" != "Write" ]] && exit 0

# Protected files
protected_files=(
    ".env.production"
    "*.key"
    "*.pem"
    "credentials.json"
    "secrets.yaml"
)

for pattern in "${protected_files[@]}"; do
    if [[ "$FILE_PATH" == $pattern ]]; then
        echo "BLOCKED: Cannot modify protected file: $FILE_PATH"
        exit 1
    fi
done

exit 0
