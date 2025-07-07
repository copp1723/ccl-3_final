import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Brain, 
  Mail, 
  MessageSquare, 
  Phone, 
  Users, 
  TrendingUp, 
  Activity,
  Upload,
  Plus,
  MoreVertical,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter
} from 'lucide-react';
import { LeadImport } from '@/components/lead-import';
import { EmailAgent } from '@/components/email-agent';

interface Agent {
  id: string;
  name: string;
  status: string;
  role: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  score: number;
  createdAt: string;
}

interface Stats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
}

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'leads' | 'agents' | 'email' | 'conversations'>('dashboard');

  useEffect(() => {
    // Fetch initial data
    Promise.all([
      fetch('/api/agents').then(res => res.json()),
      fetch('/api/leads').then(res => res.json()),
      fetch('/api/leads/stats/summary').then(res => res.json())
    ]).then(([agentsData, leadsData, statsData]) => {
      setAgents(agentsData.agents || []);
      setLeads(leadsData.leads || []);
      setStats(statsData || stats);
    }).catch(console.error);

    // Setup WebSocket connection
    const ws = new WebSocket(`ws://localhost:5000`);
    
    ws.onopen = () => {
      setWsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      
      if (data.type === 'new_lead') {
        setLeads(prev => [data.lead, ...prev]);
        setStats(prev => ({ ...prev, totalLeads: prev.totalLeads + 1, newLeads: prev.newLeads + 1 }));
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  const getAgentIcon = (agentId: string) => {
    const iconProps = { className: "h-5 w-5" };
    switch (agentId) {
      case 'overlord': return <Brain {...iconProps} />;
      case 'email': return <Mail {...iconProps} />;
      case 'sms': return <Phone {...iconProps} />;
      case 'chat': return <MessageSquare {...iconProps} />;
      default: return <Activity {...iconProps} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Circle className="h-4 w-4 text-blue-500" />;
      case 'contacted': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'qualified': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'closed': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
              { key: 'conversations', label: 'Conversations', icon: MessageSquare }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key as any)}
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
        {activeView === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalLeads}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                  <Circle className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newLeads}</div>
                  <p className="text-xs text-muted-foreground">Awaiting contact</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Qualified</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.qualifiedLeads}</div>
                  <p className="text-xs text-muted-foreground">Ready for sale</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Leads */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Leads</CardTitle>
                  <CardDescription>Latest incoming leads</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="flex items-center space-x-4">
                        <Avatar>
                          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                            {lead.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{lead.name}</p>
                          <p className="text-sm text-gray-500 truncate">{lead.email}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(lead.status)}
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {leads.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No leads yet</p>
                        <Button 
                          onClick={() => setShowImport(true)} 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                        >
                          Import your first leads
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Agent Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent Status</CardTitle>
                  <CardDescription>System agents and their current state</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {agents.map((agent) => (
                      <div key={agent.id} className="flex items-center space-x-4">
                        <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full">
                          {getAgentIcon(agent.id)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                          <p className="text-sm text-gray-500">{agent.role.replace(/_/g, ' ')}</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                          {agent.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeView === 'leads' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Lead Management</h2>
                <p className="text-gray-600">Manage and track all your leads</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                <Button onClick={() => setShowImport(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {leads.length > 0 ? (
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Lead
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {leads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">
                                    {lead.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{lead.email}</div>
                              {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{lead.source}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(lead.status)}
                                <Badge className={getStatusColor(lead.status)}>
                                  {lead.status}
                                </Badge>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{lead.score}/100</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                    <p className="text-gray-500 mb-6">Get started by importing your first batch of leads.</p>
                    <Button onClick={() => setShowImport(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Leads
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeView === 'agents' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Agent Management</h2>
              <p className="text-gray-600">Monitor and configure your AI agents</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full">
                        {getAgentIcon(agent.id)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription>{agent.role.replace(/_/g, ' ')}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        {agent.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeView === 'email' && <EmailAgent />}

        {activeView === 'conversations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Conversations</h2>
              <p className="text-gray-600">View and manage agent-lead interactions</p>
            </div>

            <Card>
              <CardContent className="p-12">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
                  <p className="text-gray-500">Conversations will appear here once agents start engaging with leads.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
