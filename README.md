# AI Development Platform with DevContainer Workspaces

A SaaS platform that creates complete development workspaces for users, where Claude Code operates with full context to help non-technical users build React applications through natural conversation.

## Architecture Overview

```
[Chat UI] ↔ [Backend API] ↔ [DevPod Manager] ↔ [DevContainer + Claude Code] ↔ [GitHub Workspace Repo]
```

## Project Structure

```
ai-dev-platform/
├── backend/          # Node.js/Express API server
├── frontend/         # React chat interface
└── workspace-template/   # GitHub template for user workspaces
```

## Features

- 🤖 **Claude Code Integration** - Full workspace context and file access
- 📁 **Managed Workspaces** - Each user gets a complete DevContainer environment
- 💬 **Real-time Chat** - WebSocket-based communication
- 🔄 **Auto-sync** - All changes automatically saved to GitHub
- 📋 **Structured Organization** - Planning docs, reference materials, chat history
- 🚀 **One-click Deploy** - Automated deployment to GitHub Pages

## Quick Start

### Prerequisites

- Node.js 18+
- Docker
- DevPod CLI
- GitHub account with personal access token
- Anthropic API key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

3. Start the server:
```bash
npm start
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# Update API endpoints if needed
```

3. Start the development server:
```bash
npm start
```

### Workspace Template Setup

1. Create a new GitHub repository named `ai-workspace-template`
2. Copy the contents of `workspace-template/` to the repository
3. Mark it as a template repository in GitHub settings

## Environment Variables

### Backend (.env)
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_TEMPLATE_OWNER` - Your GitHub username
- `GITHUB_ORG` - GitHub organization for workspaces
- `PORT` - API server port (default: 3001)
- `WS_PORT` - WebSocket server port (default: 8080)

### Frontend (.env)
- `REACT_APP_API_BASE` - Backend API URL
- `REACT_APP_WS_BASE` - WebSocket server URL

## Deployment

### Backend Deployment (Railway/Render/Fly.io)

1. Push to your deployment platform
2. Set all environment variables
3. Ensure DevPod is installed on the server

### Frontend Deployment (Netlify/Vercel)

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Deploy the `build` directory
3. Set environment variables for API endpoints

## Security Considerations

- Rate limiting on workspace creation
- Resource limits per workspace (CPU, memory, storage)
- Automatic cleanup of inactive workspaces
- Secure environment variable management
- Network isolation between workspaces

## How It Works

1. **User Creates Workspace**: Frontend requests new workspace from API
2. **GitHub Repo Created**: API creates repo from template
3. **DevPod Provisions**: Container with Claude Code is created
4. **WebSocket Connection**: Real-time chat established
5. **Claude Processes**: Messages include full workspace context
6. **Auto-sync**: Changes automatically committed to GitHub
7. **Deploy**: User's app can be deployed with one click

## Development Workflow

Users interact through chat to:
- Define requirements
- Upload reference materials
- Build features iteratively
- Test and refine
- Deploy their application

All context is preserved across sessions through:
- Chat history logs
- Planning documents
- Git version control
- Workspace state persistence

## License

MIT