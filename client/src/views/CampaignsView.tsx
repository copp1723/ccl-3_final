import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Target, Plus, BarChart3, Brain, Play } from 'lucide-react';
import { CampaignIntelligenceHub } from '@/components/campaign-intelligence';
import { CampaignManager } from '@/components/email-agent/CampaignManager';
import { CampaignAnalytics } from '@/components/shared/UnifiedAnalytics';
import { useAgents } from '@/hooks/useAgents';
import { Campaign } from '@/types';

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { agents } = useAgents();
  
  // Ensure arrays are valid
  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const safeAgents = Array.isArray(agents) ? agents : [];

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns');
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Campaign Management
          </h2>
          <p className="text-gray-600">Create, manage, and optimize marketing campaigns with AI insights</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Campaign Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
              <p className="text-2xl font-bold">{safeCampaigns.length}</p>
            </div>
            <Target className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
              <p className="text-2xl font-bold">{safeCampaigns.filter(c => c.status === 'active').length}</p>
            </div>
            <Play className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI-Powered</p>
              <p className="text-2xl font-bold">{safeCampaigns.filter(c => c.agentId || (c.assignedAgents && Array.isArray(c.assignedAgents) && c.assignedAgents.length > 0)).length}</p>
            </div>
            <Brain className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold">94%</p>
            </div>
            <BarChart3 className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="campaigns">Campaign Management</TabsTrigger>
          <TabsTrigger value="intelligence">AI Intelligence Hub</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Campaign Management</h3>
                  <p className="text-gray-600">Create, edit, and manage your marketing campaigns</p>
                </div>
              </div>
              <CampaignManager 
                agents={safeAgents} 
                campaigns={safeCampaigns} 
                onUpdate={fetchCampaigns}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-4">
          <CampaignIntelligenceHub 
            campaigns={safeCampaigns} 
            onUpdate={fetchCampaigns}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="bg-white rounded-lg border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Campaign Analytics</h3>
                  <p className="text-gray-600">Monitor performance across all campaigns and agents</p>
                </div>
              </div>
              <CampaignAnalytics campaigns={safeCampaigns} agents={safeAgents} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
