import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Mail,
  Upload,
  Users,
  Activity,
  Settings,
  MessageSquare
} from 'lucide-react';
import { LeadImport } from '@/components/lead-import';
import { DashboardView } from '@/views/DashboardView';
import { AgentsView } from '@/views/AgentsView';
import { EmailAgentView } from '@/views/EmailAgentView';
import { LeadsView } from '@/views/LeadsView';
import { MultiAgentCampaignView } from '@/views/MultiAgentCampaignView';
import { ConversationsView } from '@/views/ConversationsView';
import { ViewType } from '@/types';

function App() {
  const [showImport, setShowImport] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [wsConnected] = useState(true);

  if (showImport) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Import Leads</h1>
                <p className="text-gray-600">Upload and map your CSV data</p>
              </div>
              <Button variant="outline" onClick={() => setShowImport(false)}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
        <LeadImport />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">CCL-3 SWARM</h1>
                  <p className="text-sm text-gray-600">Lead Management System</p>
                </div>
              </div>
              <Badge variant={wsConnected ? 'default' : 'destructive'} className="ml-4">
                {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </Badge>
            </div>
            <div className="flex items-center space-x-3">
              <Button onClick={() => setShowImport(true)} className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Import Leads</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: Activity },
              { key: 'leads', label: 'Leads', icon: Users },
              { key: 'agents', label: 'Agents', icon: Brain },
              { key: 'email', label: 'Email Agent', icon: Mail },
              { key: 'multi-agent', label: 'Agent Hub', icon: Settings },
              { key: 'conversations', label: 'Conversations', icon: MessageSquare }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key as ViewType)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 transition-colors ${
                  activeView === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === 'dashboard' && <DashboardView />}
        {activeView === 'leads' && <LeadsView />}
        {activeView === 'agents' && <AgentsView />}
        {activeView === 'email' && <EmailAgentView />}
        {activeView === 'multi-agent' && <MultiAgentCampaignView />}
        {activeView === 'conversations' && <ConversationsView />}
      </div>
    </div>
  );
}

export default App;