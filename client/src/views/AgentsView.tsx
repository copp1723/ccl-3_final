import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';

export const AgentsView: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Agents</h1>
        <p className="text-gray-600">Configure and manage your AI agents</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Agent Management</span>
          </CardTitle>
          <CardDescription>
            Configure AI agents for different tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Agents</h3>
            <p className="text-gray-500">
              Configure and manage your AI agents for lead engagement.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 