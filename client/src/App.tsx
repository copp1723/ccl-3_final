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
  MessageSquare,
  Palette
} from 'lucide-react';
import { LeadImport } from '@/components/lead-import';
import { DashboardView } from '@/views/DashboardView';
import { LeadsView } from '@/views/LeadsView';
import { ConversationsView } from '@/views/ConversationsView';
import { BrandingManagementView } from '@/views/BrandingManagementView';
import { CampaignIntelligenceView } from '@/views/CampaignIntelligenceView';
import { ClientProvider, useClient } from '@/contexts/ClientContext';
import { ViewType } from '@/types';

function AppContent() {
  const [showImport, setShowImport] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [wsConnected] = useState(true);
  const { branding } = useClient();

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
                {branding.logoUrl ? (
                  <img
                    src={branding.logoUrl}
                    alt={`${branding.companyName} logo`}
                    className="h-8 w-8 object-contain rounded-lg"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor})`
                    }}
                  >
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{branding.companyName}</h1>
                  <p className="text-sm text-gray-600">AI Marketing Automation Platform</p>
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
              { key: 'agent-management', label: 'Agent Management', icon: Brain },
              { key: 'conversations', label: 'Conversations', icon: MessageSquare },
              { key: 'branding', label: 'Branding', icon: Palette }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key as ViewType)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 transition-colors ${
                  activeView === key
                    ? 'border-current'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={activeView === key ? {
                  color: branding.primaryColor,
                  borderColor: branding.primaryColor
                } : {}}
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
        {activeView === 'agent-management' && <CampaignIntelligenceView />}
        {activeView === 'conversations' && <ConversationsView />}
        {activeView === 'branding' && <BrandingManagementView />}
      </div>
    </div>
  );
}

function App() {
  return (
    <ClientProvider>
      <AppContent />
    </ClientProvider>
  );
}

export default App;