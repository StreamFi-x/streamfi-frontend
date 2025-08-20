#!/bin/bash

# Test commit message script
# Usage: ./scripts/test-commit.sh "your commit message"

if [ $# -eq 0 ]; then
    echo "❌ Please provide a commit message to test!"
    echo ""
    echo "Usage: ./scripts/test-commit.sh \"your commit message\""
    echo ""
    echo "Examples:"
    echo "  ./scripts/test-commit.sh \"test\""
    echo "  ./scripts/test-commit.sh \"feat: add new feature\""
    echo "  ./scripts/test-commit.sh \"fix: resolve bug\""
    exit 1
fi

commit_msg="$1"

echo "🧪 Testing commit message: '$commit_msg'"
echo ""

# Create a temporary file with the commit message
temp_file=$(mktemp)
echo "$commit_msg" > "$temp_file"

# Run the commit-msg hook
if .git/hooks/commit-msg "$temp_file"; then
    echo "✅ Commit message is valid!"
    echo "   You can now commit with: git commit -m \"$commit_msg\""
else
    echo "❌ Commit message is invalid!"
    echo "   Please fix the issues above and try again."
fi

# Clean up
rm "$temp_file"
