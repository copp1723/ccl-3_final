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
  Palette,
  Target,
  LogOut,
  Building,
  Copy,
  BarChart3
} from 'lucide-react';
import { LeadImport } from '@/components/lead-import';
import { DashboardView } from '@/views/DashboardView';
import { LeadsView } from '@/views/LeadsView';
import { ConversationsView } from '@/views/ConversationsView';
import { BrandingManagementView } from '@/views/BrandingManagementView';
import { AgentsView } from '@/views/AgentsView';
import { CampaignsView } from '@/views/CampaignsView';
import { ClientManagementView } from '@/views/ClientManagementView';
import { TemplateLibraryView } from '@/views/TemplateLibraryView';
import { ReportingDashboardView } from '@/views/ReportingDashboardView';
import { ClientProvider, useClient } from '@/contexts/ClientContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/ui/LoginForm';
import { ViewType } from '@/types';
import { ClientSwitcher } from '@/components/client-management/ClientSwitcher';

function AppContent() {
  const [showImport, setShowImport] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [wsConnected] = useState(true);
  const { activeClient } = useClient();
  const branding = activeClient?.brand_config || DEFAULT_BRANDING;
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

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
              <ClientSwitcher />
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                Welcome, {user?.firstName || user?.username}
              </span>
              <Button onClick={() => setShowImport(true)} className="flex items-center space-x-2">
                <Upload className="h-4 w-4" />
                <span>Import Leads</span>
              </Button>
              <Button variant="outline" onClick={logout} className="flex items-center space-x-2">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
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
              { key: 'clients', label: 'Clients', icon: Building },
              { key: 'leads', label: 'Leads', icon: Users },
              { key: 'agents', label: 'Agents', icon: Brain },
              { key: 'campaigns', label: 'Campaigns', icon: Target },
              { key: 'templates', label: 'Templates', icon: Copy },
              { key: 'reports', label: 'Reports', icon: BarChart3 },
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
        {activeView === 'clients' && <ClientManagementView />}
        {activeView === 'leads' && <LeadsView />}
        {activeView === 'agents' && <AgentsView />}
        {activeView === 'campaigns' && <CampaignsView />}
        {activeView === 'templates' && <TemplateLibraryView />}
        {activeView === 'reports' && <ReportingDashboardView />}
        {activeView === 'conversations' && <ConversationsView />}
        {activeView === 'branding' && <BrandingManagementView />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <AppContent />
      </ClientProvider>
    </AuthProvider>
  );
}