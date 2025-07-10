import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Campaign {
  id: string;
  name: string;
  [key: string]: any;
}

interface Agent {
  id: string;
  name: string;
  [key: string]: any;
}

interface CampaignAnalyticsProps {
  campaigns: Campaign[];
  agents: Agent[];
}

export function CampaignAnalytics({ campaigns, agents }: CampaignAnalyticsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Campaign analytics dashboard will be implemented here.</p>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-500">Campaigns: {campaigns.length}</p>
          <p className="text-sm text-gray-500">Agents: {agents.length}</p>
        </div>
      </CardContent>
    </Card>
  );
}