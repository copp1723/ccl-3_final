import React from 'react';
import { useClient } from '@/contexts/ClientContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building } from 'lucide-react';

export function ClientSwitcher() {
  const { clients, activeClient, switchClient, isLoading } = useClient();

  if (isLoading) {
    return (
      <div className="w-48 h-9 bg-gray-200 rounded animate-pulse" />
    );
  }

  if (clients.length === 0) {
    return null; // Don't show the switcher if there are no clients
  }

  return (
    <Select
      value={activeClient?.id || ''}
      onValueChange={(clientId) => switchClient(clientId)}
    >
      <SelectTrigger className="w-48">
        <div className="flex items-center space-x-2">
          <Building className="h-4 w-4" />
          <SelectValue placeholder="Select a client..." />
        </div>
      </SelectTrigger>
      <SelectContent>
        {clients.map(client => (
          <SelectItem key={client.id} value={client.id}>
            {client.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}