import React from 'react';
import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AgentManagementDashboard } from '@/components/shared/AgentManagementDashboard';

export function AgentsView() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Agents
          </h2>
          <p className="text-gray-600">Configure and manage your AI agent workforce</p>
        </div>
      </div>

      {/* Agent Management Dashboard */}
      <AgentManagementDashboard 
        showCreateButton={true}
        allowEdit={true}
        allowDelete={true}
        compact={false}
        showAgentDetails={true}
      />
    </div>
  );
}
