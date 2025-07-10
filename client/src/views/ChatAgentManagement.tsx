import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatAgentConfigurator } from '@/components/chat-agent/ChatAgentConfigurator';
import { Plus, Settings, BarChart3, Power, PowerOff } from 'lucide-react';

interface ChatAgent {
  id: string;
  name: string;
  personality: string;
  tone: string;
  active: boolean;
  performance: {
    conversations: number;
    successfulOutcomes: number;
    satisfactionScore: number;
  };
}

export function ChatAgentManagement() {
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [showConfigurator, setShowConfigurator] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await fetch('/api/agent-configurations?type=chat');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to load chat agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAgent = async (config: any) => {
    try {
      const url = editingAgent 
        ? `/api/agent-configurations/${editingAgent}`
        : '/api/agent-configurations';
      
      const method = editingAgent ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        await loadAgents();
        setShowConfigurator(false);
        setEditingAgent(null);
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const toggleAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agent-configurations/${agentId}/toggle`, {
        method: 'PATCH'
      });
      await loadAgents();
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  const createDefaultAgent = async () => {
    try {
      await fetch('/api/agent-configurations/create-defaults', {
        method: 'POST'
      });
      await loadAgents();
    } catch (error) {
      console.error('Failed to create default agents:', error);
    }
  };

  if (showConfigurator) {
    return (
      <div className="container mx-auto p-6">
        <ChatAgentConfigurator
          agentId={editingAgent || undefined}
          onSave={handleSaveAgent}
          onCancel={() => {
            setShowConfigurator(false);
            setEditingAgent(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Chat Agent Management</h1>
          <p className="text-gray-600">Configure AI agents for live chat interactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={createDefaultAgent}>
            Create Default
          </Button>
          <Button onClick={() => setShowConfigurator(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading agents...</div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">No Chat Agents Configured</h3>
            <p className="text-gray-600 mb-4">Create your first chat agent to start handling live conversations</p>
            <Button onClick={() => setShowConfigurator(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Chat Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {agent.name}
                      {agent.active ? (
                        <Badge variant="default" className="bg-green-500">
                          <Power className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <PowerOff className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{agent.personality}</Badge>
                      <Badge variant="outline">{agent.tone}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingAgent(agent.id);
                        setShowConfigurator(true);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={agent.active ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleAgent(agent.id)}
                    >
                      {agent.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {agent.performance?.conversations || 0}
                    </div>
                    <div className="text-sm text-gray-600">Conversations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {agent.performance?.successfulOutcomes || 0}
                    </div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {agent.performance?.satisfactionScore?.toFixed(1) || '0.0'}%
                    </div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}