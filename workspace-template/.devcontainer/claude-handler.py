#!/usr/bin/env python3
"""
Claude Code wrapper that handles workspace context and file management
"""

import os
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

class WorkspaceClaudeHandler:
    def __init__(self):
        self.workspace_root = Path("/workspace")
        self.project_dir = self.workspace_root / "project"
        self.planning_dir = self.workspace_root / "planning"
        self.chat_dir = self.workspace_root / "chat-history"
        
    def get_workspace_context(self):
        """Build context from all workspace files"""
        context = {
            "workspace_structure": self.get_file_tree(),
            "project_files": self.get_project_files(),
            "planning_docs": self.get_planning_docs(),
            "recent_chat": self.get_recent_chat_history()
        }
        return context
    
    def get_file_tree(self):
        """Get complete workspace file structure"""
        result = subprocess.run(
            ["tree", "-I", "node_modules|.git", str(self.workspace_root)],
            capture_output=True, text=True
        )
        return result.stdout if result.returncode == 0 else "No file tree available"
    
    def get_project_files(self):
        """Get current project file contents (key files only)"""
        key_files = ["package.json", "src/App.tsx", "src/index.tsx", "README.md"]
        files = {}
        
        for file_path in key_files:
            full_path = self.project_dir / file_path
            if full_path.exists():
                try:
                    files[file_path] = full_path.read_text()
                except:
                    files[file_path] = "[Binary or unreadable file]"
        
        return files
    
    def get_planning_docs(self):
        """Get planning documents"""
        docs = {}
        if self.planning_dir.exists():
            for doc_file in self.planning_dir.glob("*.md"):
                try:
                    docs[doc_file.name] = doc_file.read_text()
                except:
                    docs[doc_file.name] = "[Unreadable file]"
        return docs
    
    def get_recent_chat_history(self):
        """Get recent chat history for context"""
        if not self.chat_dir.exists():
            return "No chat history yet"
        
        # Get most recent chat file
        chat_files = sorted(self.chat_dir.glob("session-*.md"))
        if chat_files:
            try:
                return chat_files[-1].read_text()
            except:
                return "Could not read recent chat"
        return "No chat sessions yet"
    
    def save_chat_message(self, role, content):
        """Save chat message to current session"""
        self.chat_dir.mkdir(exist_ok=True)
        
        # Find or create current session file
        today = datetime.now().strftime("%Y-%m-%d")
        session_file = self.chat_dir / f"session-{today}.md"
        
        timestamp = datetime.now().strftime("%H:%M:%S")
        message = f"\n## {role.upper()} ({timestamp})\n\n{content}\n"
        
        with open(session_file, "a") as f:
            f.write(message)
    
    def execute_claude_code(self, user_message):
        """Execute Claude Code with full workspace context"""
        
        # Save user message to chat history
        self.save_chat_message("user", user_message)
        
        # Build context-aware prompt
        context = self.get_workspace_context()
        
        enhanced_prompt = f"""
WORKSPACE CONTEXT:
{json.dumps(context, indent=2)}

USER MESSAGE:
{user_message}

You are operating in a complete development workspace with access to:
- /workspace/project/ - The React app being built
- /workspace/planning/ - Requirements and planning documents  
- /workspace/reference/ - User-uploaded examples and assets
- /workspace/chat-history/ - Previous conversation history

Please help the user build their React application. You can:
1. Create/modify files in any workspace directory
2. Update planning documents as requirements evolve
3. Reference previous conversations and decisions
4. Use uploaded reference materials for guidance

Focus on iterative development - ask clarifying questions and build incrementally.
"""

        try:
            # Execute Claude Code with enhanced context
            result = subprocess.run(
                ["claude-code", enhanced_prompt],
                capture_output=True,
                text=True,
                cwd=str(self.workspace_root),
                timeout=120  # 2 minute timeout
            )
            
            response = result.stdout if result.returncode == 0 else f"Error: {result.stderr}"
            
            # Save Claude's response to chat history
            self.save_chat_message("assistant", response)
            
            return {
                "success": True,
                "response": response,
                "context_used": True,
                "workspace_updated": True
            }
            
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "response": "Request timed out. Please try with a simpler request.",
                "error": "timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "response": f"Error executing Claude Code: {str(e)}",
                "error": str(e)
            }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python claude-handler.py 'Your message to Claude'")
        sys.exit(1)
    
    handler = WorkspaceClaudeHandler()
    result = handler.execute_claude_code(" ".join(sys.argv[1:]))
    
    print(json.dumps(result, indent=2))