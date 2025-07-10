import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SimpleReportProps {
  stats?: {
    totalLeads: number;
    newLeads: number;
    contactedLeads: number;
    qualifiedLeads: number;
  };
}

export function SimpleReport({ stats }: SimpleReportProps) {
  const defaultStats = {
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    ...stats
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{defaultStats.totalLeads}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">New</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{defaultStats.newLeads}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Contacted</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{defaultStats.contactedLeads}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Qualified</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{defaultStats.qualifiedLeads}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export function QuickActions({ onImportLeads, onCreateCampaign }: {
  onImportLeads?: () => void;
  onCreateCampaign?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onImportLeads}
            className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full mb-2"></div>
            <span className="text-sm font-medium text-gray-900">Import Leads</span>
          </button>
          <button
            onClick={onCreateCampaign}
            className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <div className="w-8 h-8 bg-green-500 rounded-full mb-2"></div>
            <span className="text-sm font-medium text-gray-900">Create Campaign</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
