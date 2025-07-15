import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApiCall } from '@/hooks/useErrorHandler';
import {
  Activity,
  Server,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Users,
  Mail,
  MessageSquare,
  Clock
} from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  responseTime?: number;
  lastChecked: string;
}

interface SystemHealth {
  overall: HealthStatus;
  database: HealthStatus;
  redis: HealthStatus;
  agents: HealthStatus;
  email: HealthStatus;
  queue: HealthStatus;
}

interface PerformanceMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  responseTime: number;
}

interface BusinessMetrics {
  leadsProcessed: number;
  emailsSent: number;
  chatMessages: number;
  conversionRate: number;
}

export function SystemHealthView() {
  const { apiCall, isError, error } = useApiCall();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [business, setBusiness] = useState<BusinessMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadHealthData = async () => {
    setIsLoading(true);
    
    const [healthResult, performanceResult, businessResult] = await Promise.all([
      apiCall(async () => {
        const response = await fetch('/api/monitoring/health/detailed');
        if (!response.ok) throw new Error('Failed to load health data');
        return response.json();
      }),
      apiCall(async () => {
        const response = await fetch('/api/monitoring/performance');
        if (!response.ok) throw new Error('Failed to load performance data');
        return response.json();
      }),
      apiCall(async () => {
        const response = await fetch('/api/monitoring/business');
        if (!response.ok) throw new Error('Failed to load business metrics');
        return response.json();
      })
    ]);

    if (healthResult?.data) setHealth(healthResult.data);
    if (performanceResult?.data) setPerformance(performanceResult.data);
    if (businessResult?.data) setBusiness(businessResult.data);
    
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'down':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isError && error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
            <p className="text-gray-600 mt-1">Monitor your system's health and performance</p>
          </div>
        </div>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600 mb-4">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Unable to load system health data</span>
            </div>
            <p className="text-sm text-red-600 mb-4">{error.message}</p>
            <Button onClick={loadHealthData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
          <p className="text-gray-600 mt-1">Monitor your system's health and performance</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button onClick={loadHealthData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="business">Business Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-12 bg-gray-200 rounded w-full"></div>
                </div>
              ) : health ? (
                <div className="flex items-center space-x-4">
                  {getStatusIcon(health.overall.status)}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Overall System Health</span>
                      <Badge className={getStatusColor(health.overall.status)}>
                        {health.overall.status.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{health.overall.message}</p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No health data available</div>
              )}
            </CardContent>
          </Card>

          {/* Component Health Grid */}
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Database</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(health.database.status)}>
                      {health.database.status}
                    </Badge>
                    {health.database.responseTime && (
                      <span className="text-xs text-gray-500">
                        {health.database.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{health.database.message}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Redis Cache</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(health.redis.status)}>
                      {health.redis.status}
                    </Badge>
                    {health.redis.responseTime && (
                      <span className="text-xs text-gray-500">
                        {health.redis.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{health.redis.message}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>AI Agents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(health.agents.status)}>
                      {health.agents.status}
                    </Badge>
                    {health.agents.responseTime && (
                      <span className="text-xs text-gray-500">
                        {health.agents.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{health.agents.message}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Email Service</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(health.email.status)}>
                      {health.email.status}
                    </Badge>
                    {health.email.responseTime && (
                      <span className="text-xs text-gray-500">
                        {health.email.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{health.email.message}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Server className="h-4 w-4" />
                    <span>Queue System</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(health.queue.status)}>
                      {health.queue.status}
                    </Badge>
                    {health.queue.responseTime && (
                      <span className="text-xs text-gray-500">
                        {health.queue.responseTime}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">{health.queue.message}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Infrastructure Status</CardTitle>
              <CardDescription>Detailed view of system infrastructure components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500 py-8">
                Infrastructure monitoring panel will be displayed here when data is available.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performance && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">CPU Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performance.cpu}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all" 
                      style={{ width: `${performance.cpu}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Memory Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performance.memory.percentage}%</div>
                  <div className="text-xs text-gray-500">
                    {performance.memory.used}MB / {performance.memory.total}MB
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all" 
                      style={{ width: `${performance.memory.percentage}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">System Uptime</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{formatUptime(performance.uptime)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{performance.responseTime}ms</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          {business && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Leads Processed</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{business.leadsProcessed}</div>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Emails Sent</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{business.emailsSent}</div>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Chat Messages</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{business.chatMessages}</div>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Conversion Rate</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{business.conversionRate}%</div>
                  <p className="text-xs text-gray-500 mt-1">This week</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SystemHealthView;