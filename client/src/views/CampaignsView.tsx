import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignManager } from '@/components/email-agent/CampaignManager';
import { useAgents } from '@/hooks/useAgents';

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { agents } = useAgents();

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
    return <div className="flex justify-center p-8">Loading campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Campaign Management</h2>
        <p className="text-gray-600">Create and manage your email campaigns</p>
      </div>
      
      <CampaignManager 
        agents={agents} 
        campaigns={campaigns} 
        onUpdate={fetchCampaigns}
      />
    </div>
  );
} 