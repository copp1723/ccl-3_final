import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Circle, Mail, CheckCircle2, AlertCircle, Filter } from 'lucide-react';
import { Lead } from '@/types';

export function LeadsView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/leads')
      .then(res => res.json())
      .then(data => setLeads(data?.leads || []))
      .catch(console.error);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Circle className="h-4 w-4 text-blue-500" />;
      case 'contacted': return <Mail className="h-4 w-4 text-yellow-500" />;
      case 'qualified': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'unqualified': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-yellow-100 text-yellow-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'unqualified': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLeads = filter === 'all' ? leads : leads.filter(lead => lead.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
          <p className="text-gray-600 mt-1">{filteredLeads.length} of {leads.length} leads</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            <Filter className="h-4 w-4 text-gray-500" />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="border-none bg-transparent focus:outline-none text-sm font-medium"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="unqualified">Unqualified</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredLeads.map(lead => (
          <Card key={lead.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                    {getStatusIcon(lead.status)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                    <p className="text-sm text-gray-600">{lead.email}</p>
                    {lead.phone && <p className="text-sm text-gray-500">{lead.phone}</p>}
                    {lead.source && <p className="text-xs text-gray-400 mt-1">Source: {lead.source}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-medium text-gray-700">Score:</span>
                      <span className="text-lg font-bold text-blue-600">{lead.score}</span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(lead.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge className={`${getStatusColor(lead.status)} font-medium`}>
                    {lead.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredLeads.length === 0 && (
          <Card>
            <CardContent className="p-12">
              <div className="text-center text-gray-500">
                <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">No leads found</p>
                <p className="text-sm">Try adjusting your filter or import new leads</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}