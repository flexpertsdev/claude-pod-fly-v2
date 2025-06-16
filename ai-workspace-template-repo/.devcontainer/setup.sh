#!/bin/bash

echo "🚀 Setting up AI Development Workspace..."

# Ensure workspace structure exists
mkdir -p project planning reference chat-history iterations assets

# Initialize project if it doesn't exist
if [ ! -f "project/package.json" ]; then
    echo "📦 Initializing React project..."
    cd project
    npx create-react-app . --template typescript
    cd ..
fi

# Create initial planning documents if they don't exist
if [ ! -f "planning/requirements.md" ]; then
    cat > planning/requirements.md << 'EOF'
# Project Requirements

## Overview
This document will be updated as we discuss your project requirements.

## User Stories
- As a user, I want to...

## Technical Requirements
- React with TypeScript
- Responsive design
- Modern UI/UX

## Success Criteria
- Define what success looks like for this project
EOF
fi

# Create workspace config
if [ ! -f "workspace-config.json" ]; then
    cat > workspace-config.json << EOF
{
  "workspaceId": "${WORKSPACE_ID}",
  "projectId": "${PROJECT_ID}",
  "created": "$(date -Iseconds)",
  "status": "active",
  "platform": "ai-dev-workspace",
  "version": "1.0.0"
}
EOF
fi

# Set up git hooks for auto-commit
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
# Auto-push after commits (run in background to avoid blocking)
git push origin main &
EOF

chmod +x .git/hooks/post-commit

echo "✅ Workspace setup complete!"
echo "🤖 Claude Code is ready with API key: ${ANTHROPIC_API_KEY:0:8}..."
echo "📁 Workspace ID: ${WORKSPACE_ID}"