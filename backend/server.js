const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Octokit } = require('@octokit/rest');
const { exec } = require('child_process');
const { promisify } = require('util');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

const app = express();
const execAsync = promisify(exec);

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const workspaceCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many workspace creation requests, please try again later.'
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

class DevPodManager {
  async createWorkspace(workspaceId, repoUrl) {
    try {
      // Check if DevPod is available
      const devpodCheck = await execAsync('which devpod').catch(() => null);
      
      if (devpodCheck && devpodCheck.stdout.trim()) {
        // DevPod is available, use it
        const command = `devpod up ${repoUrl} --id ${workspaceId} --provider docker`;
        const result = await execAsync(command);
        
        return {
          success: true,
          workspaceId,
          status: 'created',
          output: result.stdout,
          mode: 'devpod'
        };
      } else {
        // Fallback mode without DevPod
        console.log('DevPod not available, using mock mode');
        return {
          success: true,
          workspaceId,
          status: 'created',
          output: 'Workspace created in mock mode (DevPod not available)',
          mode: 'mock'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async executeInWorkspace(workspaceId, message) {
    try {
      // Check if DevPod is available
      const devpodCheck = await execAsync('which devpod').catch(() => null);
      
      if (devpodCheck && devpodCheck.stdout.trim()) {
        // DevPod mode
        const escapedMessage = message.replace(/'/g, "'\\''");
        const command = `devpod ssh ${workspaceId} --command "cd /workspace && python3 .devcontainer/claude-handler.py '${escapedMessage}'"`;
        const result = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
        
        return JSON.parse(result.stdout);
      } else {
        // Direct Claude API mode for production without DevPod
        const axios = require('axios');
        
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
          workspace_updated: true,
          mode: 'direct-api'
        };
      }
    } catch (error) {
      console.error('Execution error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        response: "I encountered an error processing your request."
      };
    }
  }
  
  async getWorkspaceStatus(workspaceId) {
    try {
      const command = `devpod list --output json`;
      const result = await execAsync(command);
      const workspaces = JSON.parse(result.stdout);
      
      const workspace = workspaces.find(w => w.id === workspaceId);
      return workspace || { status: 'not_found' };
    } catch (error) {
      return { status: 'error', error: error.message };
    }
  }
  
  async stopWorkspace(workspaceId) {
    try {
      const command = `devpod stop ${workspaceId}`;
      await execAsync(command);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async deleteWorkspace(workspaceId) {
    try {
      const command = `devpod delete ${workspaceId} --force`;
      await execAsync(command);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const devpod = new DevPodManager();

app.post('/api/workspaces/create', workspaceCreationLimiter, async (req, res) => {
  try {
    const { userId, projectName, description } = req.body;
    
    if (!userId || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'userId and projectName are required'
      });
    }
    
    const workspaceId = `workspace-${userId}-${Date.now()}`;
    
    const repo = await octokit.repos.createUsingTemplate({
      template_owner: process.env.GITHUB_TEMPLATE_OWNER,
      template_repo: 'ai-workspace-template',
      owner: process.env.GITHUB_ORG,
      name: workspaceId,
      description: `AI Development Workspace: ${projectName}`,
      private: false
    });
    
    const workspace = await devpod.createWorkspace(workspaceId, repo.data.clone_url);
    
    if (!workspace.success) {
      throw new Error(workspace.error);
    }
    
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

app.post('/api/workspaces/:workspaceId/stop', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const result = await devpod.stopWorkspace(workspaceId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/workspaces/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const result = await devpod.deleteWorkspace(workspaceId);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const wss = new WebSocket.Server({ port: process.env.WS_PORT || 8080 });

const activeConnections = new Map();

wss.on('connection', (ws) => {
  let connectionWorkspaceId = null;
  
  ws.on('message', async (data) => {
    try {
      const { type, workspaceId, message } = JSON.parse(data);
      
      if (type === 'init') {
        connectionWorkspaceId = workspaceId;
        activeConnections.set(workspaceId, ws);
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
  
  ws.on('close', () => {
    if (connectionWorkspaceId) {
      activeConnections.delete(connectionWorkspaceId);
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 AI Development Platform API running on port ${PORT}`);
  console.log(`📡 WebSocket server running on port ${process.env.WS_PORT || 8080}`);
});