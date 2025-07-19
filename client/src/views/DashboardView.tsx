import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Circle, CheckCircle2, TrendingUp, AlertCircle, BarChart3, FileDown, PlusCircle } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useApiCall } from '@/hooks/useApiCall';
import { Stats } from '@/types';

export function DashboardView() {
  const { branding } = useClient();
  const safeBranding = branding || { primaryColor: '#3b82f6', secondaryColor: '#64748b' };
  const { get } = useApiCall();
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await get('/api/leads/stats/summary');
        const result = await response.json();
        
        // Map the backend response to expected frontend format
        const data = {
          totalLeads: result.total || 0,
          newLeads: result.new || 0,
          contactedLeads: result.byStatus?.contacted || 0,
          qualifiedLeads: result.qualified || 0,
          conversionRate: result.total > 0 ? Math.round((result.qualified / result.total) * 100) : 0
        };
        setStats(data);
      } catch (err) {
        setError('Failed to load dashboard statistics');
        console.error('Dashboard stats error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [get]);

  // Error state
  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-1">Overview of your lead management system</p>
        </div>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600 mb-4">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Unable to load dashboard data</span>
            </div>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of your lead management and analytics</p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reporting Hub</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
                <Users className="h-5 w-5" style={{ color: safeBranding.primaryColor }} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-12"></div>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl font-bold text-gray-900">{stats.totalLeads}</div>
                    <p className="text-xs text-gray-500 mt-1">All time</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">New Leads</CardTitle>
                <Circle className="h-5 w-5" style={{ color: safeBranding.primaryColor }} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: branding.primaryColor }}>{stats.newLeads}</div>
                <p className="text-xs text-gray-500 mt-1">Awaiting contact</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Qualified</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.qualifiedLeads}</div>
                <p className="text-xs text-gray-500 mt-1">Ready for submission</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Conversion</CardTitle>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.conversionRate}%</div>
                <p className="text-xs text-gray-500 mt-1">Success rate</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold">Reporting Hub</h3>
              <p className="text-gray-600">
                A unified view of your campaign performance and analytics.
              </p>
            </div>
            <div>
              <Button className="mr-2">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Custom Report
              </Button>
              <Button variant="outline">
                <FileDown className="mr-2 h-4 w-4" />
                Export All Data
              </Button>
            </div>
          </div>

          {/* Performance Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Key performance metrics will be displayed here.</p>
            </CardContent>
          </Card>

          {/* Saved Reports */}
          <Card>
            <CardHeader>
              <CardTitle>My Saved Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <p>A list of saved and scheduled reports will appear here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}