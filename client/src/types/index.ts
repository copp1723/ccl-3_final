export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  status: string;
  score: number;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface Stats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
}

export type ViewType = 'dashboard' | 'leads' | 'agents' | 'email' | 'multi-agent' | 'conversations';