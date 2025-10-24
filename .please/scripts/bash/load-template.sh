#!/usr/bin/env bash
# load-template.sh - Load template with project override support
#
# Usage: load-template.sh <template-name>
# Returns: Path to template file (project customization takes priority over plugin default)
#
# Example:
#   SPEC_TEMPLATE=$(load-template.sh "spec-template.md")

set -euo pipefail

TEMPLATE_NAME="$1"

if [[ -z "$TEMPLATE_NAME" ]]; then
    echo "ERROR: Template name required" >&2
    echo "Usage: load-template.sh <template-name>" >&2
    exit 1
fi

# Get plugin root from environment or fall back to script location
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [[ -z "$PLUGIN_ROOT" ]]; then
    # Fallback: calculate from script location
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PLUGIN_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi

# Priority 1: Project-level customized template
PROJECT_TEMPLATE=".please/templates/${TEMPLATE_NAME}"
if [[ -f "$PROJECT_TEMPLATE" ]]; then
    echo "[INFO] Using customized template from project: $PROJECT_TEMPLATE" >&2
    echo "$PROJECT_TEMPLATE"
    exit 0
fi

# Priority 2: Plugin default template
PLUGIN_TEMPLATE="${PLUGIN_ROOT}/spec-kit/.please/templates/${TEMPLATE_NAME}"
if [[ -f "$PLUGIN_TEMPLATE" ]]; then
    echo "[INFO] Using default template from plugin: $PLUGIN_TEMPLATE" >&2
    echo "$PLUGIN_TEMPLATE"
    exit 0
fi

# Template not found in either location
echo "ERROR: Template '${TEMPLATE_NAME}' not found" >&2
echo "  Checked project: $PROJECT_TEMPLATE" >&2
echo "  Checked plugin: $PLUGIN_TEMPLATE" >&2
exit 1
