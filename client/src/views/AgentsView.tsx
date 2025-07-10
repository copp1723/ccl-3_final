import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Agent } from '@/types';
import { getAgentIcon } from '@/utils/agentIcons';

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    // Try API first, fallback to defaults
    fetch('/api/agents')
      .then(res => res.json())
      .then(data => setAgents(data?.agents || []))
      .catch(() => setAgents([
        { id: 'email-agent-1', name: 'Email Agent', role: 'email_specialist', status: 'active' },
        { id: 'sms-agent-1', name: 'SMS Agent', role: 'sms_specialist', status: 'active' },
        { id: 'chat-agent-1', name: 'Chat Agent', role: 'chat_specialist', status: 'active' },
        { id: 'overlord-agent-1', name: 'Overlord Agent', role: 'coordination_specialist', status: 'active' }
      ]));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Agents</h2>
        <p className="text-gray-600">Manage your AI agent workforce</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => (
          <Card key={agent.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12 bg-gradient-to-r from-blue-600 to-purple-600 shadow-md">
                    <AvatarFallback className="bg-transparent">
                      {getAgentIcon(agent.id)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{agent.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{agent.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <Badge 
                    variant={agent.status === 'active' ? 'default' : 'secondary'}
                    className="font-medium"
                  >
                    {agent.status}
                  </Badge>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Last Active</span>
                  <span className="text-gray-700 font-medium">2 min ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}