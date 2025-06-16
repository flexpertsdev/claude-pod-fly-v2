const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Octokit } = require('@octokit/rest');
const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Mock DevPod Manager for local testing
class MockDevPodManager {
  constructor() {
    this.workspaces = new Map();
  }

  async createWorkspace(workspaceId, repoUrl) {
    this.workspaces.set(workspaceId, {
      id: workspaceId,
      repoUrl,
      status: 'running',
      created: new Date()
    });
    
    return {
      success: true,
      workspaceId,
      status: 'created',
      output: 'Mock workspace created successfully'
    };
  }
  
  async executeInWorkspace(workspaceId, message) {
    try {
      // Direct Claude API call for local testing
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are an AI assistant helping build a React application. The user said: "${message}". 
          
          Provide helpful guidance for building their React app. Keep responses concise and practical.`
        }]
      }, {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });
      
      return {
        success: true,
        response: response.data.content[0].text,
        context_used: true,
        workspace_updated: true
      };
    } catch (error) {
      console.error('Claude API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        response: "I encountered an error processing your request. Please check the API configuration."
      };
    }
  }
  
  async getWorkspaceStatus(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    return workspace || { status: 'not_found' };
  }
}

const devpod = new MockDevPodManager();

// API Routes
app.post('/api/workspaces/create', async (req, res) => {
  try {
    const { userId, projectName, description } = req.body;
    
    if (!userId || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'userId and projectName are required'
      });
    }
    
    const workspaceId = `workspace-${userId}-${Date.now()}`;
    
    // Create GitHub repo
    const repo = await octokit.repos.createUsingTemplate({
      template_owner: process.env.GITHUB_TEMPLATE_OWNER,
      template_repo: 'ai-workspace-template',
      owner: process.env.GITHUB_ORG,
      name: workspaceId,
      description: `AI Development Workspace: ${projectName}`,
      private: false
    });
    
    // Mock workspace creation
    const workspace = await devpod.createWorkspace(workspaceId, repo.data.clone_url);
    
    res.json({
      success: true,
      workspaceId,
      repositoryUrl: repo.data.html_url,
      cloneUrl: repo.data.clone_url,
      workspace: workspace
    });
    
  } catch (error) {
    console.error('Workspace creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/workspaces/:workspaceId/chat', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'message is required'
      });
    }
    
    const result = await devpod.executeInWorkspace(workspaceId, message);
    res.json(result);
    
  } catch (error) {
    console.error('Chat execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      response: "I encountered an error. Please try again."
    });
  }
});

app.get('/api/workspaces/:workspaceId/status', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const status = await devpod.getWorkspaceStatus(workspaceId);
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// WebSocket server
const wss = new WebSocket.Server({ port: process.env.WS_PORT || 8080 });

wss.on('connection', (ws) => {
  let connectionWorkspaceId = null;
  
  ws.on('message', async (data) => {
    try {
      const { type, workspaceId, message } = JSON.parse(data);
      
      if (type === 'init') {
        connectionWorkspaceId = workspaceId;
        ws.send(JSON.stringify({ type: 'connected', workspaceId }));
      }
      
      if (type === 'chat' && workspaceId && message) {
        ws.send(JSON.stringify({ type: 'typing', status: true }));
        
        const result = await devpod.executeInWorkspace(workspaceId, message);
        
        ws.send(JSON.stringify({ 
          type: 'response', 
          ...result,
          timestamp: new Date().toISOString()
        }));
        
        ws.send(JSON.stringify({ type: 'typing', status: false }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: error.message 
      }));
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 AI Development Platform API (LOCAL MODE) running on port ${PORT}`);
  console.log(`📡 WebSocket server running on port ${process.env.WS_PORT || 8080}`);
  console.log(`⚠️  Running in mock mode - DevPod functionality simulated`);
});