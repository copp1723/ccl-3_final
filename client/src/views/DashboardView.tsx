import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Circle, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { useBrandingContext } from '@/components/BrandingProvider';
import { useApiCall } from '@/hooks/useErrorHandler';
import { Stats } from '@/types';

export function DashboardView() {
  const { branding } = useBrandingContext();
  const { apiCall, isError, error } = useApiCall();
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      const result = await apiCall(
        async () => {
          const response = await fetch('/api/leads/stats/summary');
          if (!response.ok) throw new Error(`Failed to load stats: ${response.statusText}`);
          return response.json();
        },
        { errorMessage: 'Failed to load dashboard statistics' }
      );
      
      if (result) {
        setStats(result);
      }
      setIsLoading(false);
    };

    loadStats();
  }, [apiCall]);

  // Error state
  if (isError && error) {
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
            <p className="text-sm text-red-600 mb-4">{error.message}</p>
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
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Overview of your lead management system</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Leads</CardTitle>
            <Users className="h-5 w-5" style={{ color: branding.primaryColor }} />
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
            <Circle className="h-5 w-5" style={{ color: branding.primaryColor }} />
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
    </div>
  );
}