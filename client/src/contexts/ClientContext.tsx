import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CCLBrandingConfig, DEFAULT_BRANDING } from '../../../shared/config/branding-config';
import { useApiCall } from '../hooks/useApiCall';
import { Client } from '@/types';

interface ClientContextType {
  activeClient: Client | null;
  clients: Client[];
  isLoading: boolean;
  error: string | null;
  branding: CCLBrandingConfig;
  switchClient: (clientId: string | null) => void;
  refreshClients: () => Promise<void>;
  addClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Promise<Client | undefined>;
  updateClient: (clientId: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>) => Promise<Client | undefined>;
  getClientById: (clientId: string) => Client | undefined;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}

interface ClientProviderProps {
  children: React.ReactNode;
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get, post, put } = useApiCall();

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await get('/api/clients');
      const data = await response.json();
      if (data.success) {
        setClients(data.data);
        if (data.data.length > 0) {
          const lastActiveId = localStorage.getItem('lastActiveClientId');
          const clientToActivate = data.data.find((c: Client) => c.id === lastActiveId) || data.data[0];
          setActiveClient(clientToActivate);
        }
      } else {
        setError(data.message || 'Failed to fetch clients');
      }
    } catch (err) {
      setError('An error occurred while fetching clients');
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const switchClient = (clientId: string | null) => {
    if (clientId === null) {
      setActiveClient(null);
      localStorage.removeItem('lastActiveClientId');
      return;
    }
    const newActiveClient = clients.find(c => c.id === clientId);
    if (newActiveClient) {
      setActiveClient(newActiveClient);
      localStorage.setItem('lastActiveClientId', newActiveClient.id);
    }
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client | undefined> => {
    try {
      const response = await post('/api/clients', clientData);
      const result = await response.json();
      if (result.success) {
        await fetchClients();
        return result.data;
      } else {
        setError(result.message || 'Failed to add client');
      }
    } catch (err) {
      setError('An error occurred while adding the client');
    }
  };

  const updateClient = async (clientId: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<Client | undefined> => {
    try {
      const response = await put(`/api/clients/${clientId}`, updates);
      const result = await response.json();
      if (result.success) {
        await fetchClients();
        return result.data;
      } else {
        setError(result.message || 'Failed to update client');
      }
    } catch (err) {
      setError('An error occurred while updating the client');
    }
  };
  
  const getClientById = (clientId: string) => {
      return clients.find(c => c.id === clientId);
  };

  const branding = activeClient?.brand_config || activeClient?.branding || activeClient?.settings?.branding || DEFAULT_BRANDING;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.style.setProperty('--primary-color', branding.primaryColor);
    root.style.setProperty('--secondary-color', branding.secondaryColor);
    
    const primaryHsl = hexToHsl(branding.primaryColor)
    const secondaryHsl = hexToHsl(branding.secondaryColor)
    
    root.style.setProperty('--primary', primaryHsl)
    root.style.setProperty('--secondary', secondaryHsl)
    
    document.title = `${branding.companyName} - AI Marketing Platform`;
    
    if (branding.favicon) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
      }
      favicon.href = branding.favicon;
    }

    let customStyleElement = document.getElementById('client-custom-css');
    if (branding.customCss) {
      if (!customStyleElement) {
        customStyleElement = document.createElement('style');
        customStyleElement.id = 'client-custom-css';
        document.head.appendChild(customStyleElement);
      }
      customStyleElement.textContent = branding.customCss;
    } else if (customStyleElement) {
      customStyleElement.remove();
    }
  }, [branding]);

  const value = {
    activeClient,
    clients,
    isLoading,
    error,
    branding,
    switchClient,
    refreshClients: fetchClients,
    addClient,
    updateClient,
    getClientById,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

function hexToHsl(hex: string): string {
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}