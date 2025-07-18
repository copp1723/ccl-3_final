import React from 'react';
import { useClient } from '@/contexts/ClientContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, PlusCircle } from 'lucide-react';

interface ClientDashboardProps {
  onSelectClient: (clientId: string) => void;
  onAddNewClient: () => void;
}

export function ClientDashboard({ onSelectClient, onAddNewClient }: ClientDashboardProps) {
  const { clients, isLoading, error } = useClient();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-1/4 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 p-4 rounded-lg">
        <p><strong>Error:</strong> {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Client Management</h2>
        <Button onClick={onAddNewClient}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Client
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {clients.map(client => (
          <Card 
            key={client.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onSelectClient(client.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>{client.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{client.industry || 'No industry specified'}</p>
              {/* Future: Add a summary of campaigns or other stats */}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}