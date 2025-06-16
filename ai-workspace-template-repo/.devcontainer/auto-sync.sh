#!/bin/bash

echo "🔄 Starting auto-sync service..."

while true; do
    sleep 30  # Check every 30 seconds
    
    # Check if there are any changes
    if [ -n "$(git status --porcelain)" ]; then
        echo "📝 Auto-committing changes..."
        
        # Add all changes
        git add .
        
        # Create commit with timestamp
        git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M:%S')" || true
        
        # Push in background (non-blocking)
        git push origin main &
    fi
done