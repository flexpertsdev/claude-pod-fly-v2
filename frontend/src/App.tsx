import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const WS_BASE = process.env.REACT_APP_WS_BASE || 'ws://localhost:8080';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

function App() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<'idle' | 'creating' | 'ready' | 'error'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeWorkspace();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeWorkspace = async () => {
    try {
      setWorkspaceStatus('creating');
      
      const response = await fetch(`${API_BASE}/api/workspaces/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          projectName: 'New React App',
          description: 'AI-generated React application'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setWorkspaceId(data.workspaceId);
        setWorkspaceStatus('ready');
        
        const ws = new WebSocket(WS_BASE);
        setWsConnection(ws);
        
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'init', workspaceId: data.workspaceId }));
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          addMessage('system', '❌ Connection error. Please refresh the page.');
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed');
        };
        
        addMessage('assistant', `🎉 Your development workspace is ready! 

I can help you build a React application through conversation. I have access to your complete workspace including:

📁 **Project files** - Your React app code  
📋 **Planning docs** - Requirements and specifications  
📂 **Reference materials** - Any files you want to upload  
💬 **Chat history** - Our previous conversations  

Your workspace: [${data.repositoryUrl}](${data.repositoryUrl})

What would you like to build?`);
        
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setWorkspaceStatus('error');
      addMessage('system', `❌ Failed to create workspace: ${error.message}`);
    }
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'typing':
        setIsTyping(data.status);
        break;
      case 'response':
        setIsTyping(false);
        if (data.success) {
          addMessage('assistant', data.response);
        } else {
          addMessage('system', `❌ ${data.response}`);
        }
        break;
      case 'error':
        setIsTyping(false);
        addMessage('system', `❌ Error: ${data.error}`);
        break;
      case 'connected':
        console.log('WebSocket connected to workspace:', data.workspaceId);
        break;
    }
  };

  const addMessage = (role: Message['role'], content: string) => {
    const message: Message = {
      id: Date.now() + Math.random() + '',
      role,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsConnection || workspaceStatus !== 'ready') return;

    addMessage('user', inputMessage);
    
    wsConnection.send(JSON.stringify({
      type: 'chat',
      workspaceId,
      message: inputMessage
    }));

    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🤖 AI Development Assistant</h1>
          <div className="workspace-status">
            <span className={`status-indicator ${workspaceStatus}`}></span>
            <span>Workspace: {workspaceStatus}</span>
          </div>
        </div>
      </header>

      <div className="chat-container">
        <div className="messages">
          {messages.map(message => (
            <div key={message.id} className={`message ${message.role}`}>
              <div className="message-bubble">
                <div 
                  className="message-content"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="message assistant">
              <div className="message-bubble typing">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="input-container">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe what you want to build..."
              disabled={workspaceStatus !== 'ready' || isTyping}
              className="message-input"
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || workspaceStatus !== 'ready' || isTyping}
              className="send-button"
            >
              {isTyping ? '⏳' : '📤'}
            </button>
          </div>
          
          <div className="quick-suggestions">
            <button 
              onClick={() => setInputMessage("I want to build a todo list app with modern design")}
              disabled={workspaceStatus !== 'ready' || isTyping}
            >
              📝 Todo App
            </button>
            <button 
              onClick={() => setInputMessage("Create a landing page for my business")}
              disabled={workspaceStatus !== 'ready' || isTyping}
            >
              🏢 Landing Page  
            </button>
            <button 
              onClick={() => setInputMessage("Build a simple blog with React")}
              disabled={workspaceStatus !== 'ready' || isTyping}
            >
              📚 Blog
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
