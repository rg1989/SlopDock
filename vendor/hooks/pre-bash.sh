#!/bin/bash
# Safety checks for bash commands

TOOL_NAME="$1"
COMMAND="$2"

[[ "$TOOL_NAME" != "Bash" ]] && exit 0

# Block destructive commands
dangerous_patterns=(
    "rm -rf /"
    "rm -rf ~"
    "DROP DATABASE.*production"
    "> /dev/sda"
    "mkfs"
    ":(){:|:&};:"
)

for pattern in "${dangerous_patterns[@]}"; do
    if [[ "$COMMAND" =~ $pattern ]]; then
        echo "BLOCKED: Dangerous command pattern detected: $pattern"
        exit 1
    fi
done

exit 0
