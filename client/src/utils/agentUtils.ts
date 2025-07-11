import { AgentType, AgentPersonality, AgentTone, ResponseLength, UnifiedAgentConfig, AgentCapabilities } from '@/types';

// Agent Type Definitions
export const AGENT_TYPES = [
  { 
    value: 'overlord' as const, 
    label: 'Overlord (Master Agent)', 
    description: 'Orchestrates all other agents and makes strategic decisions',
    icon: '🧠',
    capabilities: { email: true, sms: true, chat: true }
  },
  { 
    value: 'email' as const, 
    label: 'Email Agent', 
    description: 'Handles email communications and follow-ups',
    icon: '📧',
    capabilities: { email: true, sms: false, chat: false }
  },
  { 
    value: 'sms' as const, 
    label: 'SMS Agent', 
    description: 'Manages text message communications',
    icon: '📱',
    capabilities: { email: false, sms: true, chat: false }
  },
  { 
    value: 'chat' as const, 
    label: 'Chat Agent', 
    description: 'Handles website chat and real-time conversations',
    icon: '💬',
    capabilities: { email: false, sms: false, chat: true }
  }
] as const;

// Personality Options
export const PERSONALITY_OPTIONS: { value: AgentPersonality; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Formal, business-focused approach' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable demeanor' },
  { value: 'authoritative', label: 'Authoritative', description: 'Confident and expert positioning' },
  { value: 'empathetic', label: 'Empathetic', description: 'Understanding and supportive tone' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and informal style' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and positive approach' }
];

// Tone Options
export const TONE_OPTIONS: { value: AgentTone; label: string; description: string }[] = [
  { value: 'formal', label: 'Formal', description: 'Professional business communication' },
  { value: 'casual', label: 'Casual', description: 'Relaxed conversational style' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic and excited' },
  { value: 'persuasive', label: 'Persuasive', description: 'Compelling and convincing' },
  { value: 'conversational', label: 'Conversational', description: 'Natural dialogue style' },
  { value: 'warm', label: 'Warm', description: 'Friendly and welcoming' },
  { value: 'direct', label: 'Direct', description: 'Straightforward and clear' }
];

// Response Length Options
export const RESPONSE_LENGTH_OPTIONS: { value: ResponseLength; label: string; description: string }[] = [
  { value: 'short', label: 'Short', description: 'Concise, 1-2 sentences' },
  { value: 'medium', label: 'Medium', description: 'Balanced, 3-5 sentences' },
  { value: 'long', label: 'Long', description: 'Detailed, 6+ sentences' }
];

// Default configurations by agent type
export const DEFAULT_AGENT_CONFIGS: Record<AgentType, Partial<UnifiedAgentConfig>> = {
  overlord: {
    role: 'Master Coordinator',
    endGoal: 'Orchestrate all agents and optimize campaign performance',
    instructions: {
      dos: ['Coordinate between all agents', 'Monitor campaign performance', 'Make strategic decisions'],
      donts: ['Micromanage individual agents', 'Override agent expertise', 'Ignore performance data']
    },
    domainExpertise: ['Campaign Strategy', 'Multi-Agent Coordination', 'Performance Optimization'],
    personality: 'authoritative',
    tone: 'formal',
    responseLength: 'medium',
    temperature: 60,
    maxTokens: 800
  },
  email: {
    role: 'Email Marketing Specialist',
    endGoal: 'Drive engagement and conversions through email communications',
    instructions: {
      dos: ['Personalize email content', 'Follow up consistently', 'Track engagement metrics'],
      donts: ['Send spam-like content', 'Ignore unsubscribe requests', 'Use overly aggressive language']
    },
    domainExpertise: ['Email Marketing', 'Lead Nurturing', 'Content Creation'],
    personality: 'professional',
    tone: 'persuasive',
    responseLength: 'medium',
    temperature: 70,
    maxTokens: 600
  },
  sms: {
    role: 'SMS Communication Specialist',
    endGoal: 'Provide timely updates and drive immediate actions via SMS',
    instructions: {
      dos: ['Keep messages concise', 'Include clear call-to-actions', 'Respect timing preferences'],
      donts: ['Send messages too frequently', 'Use complex language', 'Ignore opt-out requests']
    },
    domainExpertise: ['SMS Marketing', 'Mobile Communication', 'Urgent Notifications'],
    personality: 'friendly',
    tone: 'direct',
    responseLength: 'short',
    temperature: 65,
    maxTokens: 200
  },
  chat: {
    role: 'Live Chat Support Specialist',
    endGoal: 'Provide immediate assistance and qualify leads through live chat',
    instructions: {
      dos: ['Respond within 30 seconds', 'Ask qualifying questions naturally', 'Provide helpful resources'],
      donts: ['Leave customers waiting', 'Be overly pushy', 'Provide incorrect information']
    },
    domainExpertise: ['Live Chat', 'Customer Support', 'Lead Qualification'],
    personality: 'friendly',
    tone: 'conversational',
    responseLength: 'short',
    temperature: 70,
    maxTokens: 300
  }
};

// Utility Functions
export function getAgentTypeInfo(type: AgentType) {
  return AGENT_TYPES.find(t => t.value === type);
}

export function getAgentCapabilities(type: AgentType): AgentCapabilities {
  const typeInfo = getAgentTypeInfo(type);
  return typeInfo?.capabilities || { email: false, sms: false, chat: false };
}

export function getDefaultConfigForType(type: AgentType): Partial<UnifiedAgentConfig> {
  return {
    ...DEFAULT_AGENT_CONFIGS[type],
    type,
    capabilities: getAgentCapabilities(type),
    active: true
  };
}

export function validateAgentConfig(config: Partial<UnifiedAgentConfig>): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!config.name?.trim()) {
    errors.name = 'Agent name is required';
  }

  if (!config.type) {
    errors.type = 'Agent type is required';
  }

  if (!config.role?.trim()) {
    errors.role = 'Agent role is required';
  }

  if (!config.endGoal?.trim()) {
    errors.endGoal = 'End goal is required';
  }

  if (!config.instructions?.dos?.some(instruction => instruction.trim())) {
    errors.instructions = 'At least one "do" instruction is required';
  }

  if (!config.instructions?.donts?.some(instruction => instruction.trim())) {
    errors.instructions = errors.instructions || 'At least one "don\'t" instruction is required';
  }

  if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 100)) {
    errors.temperature = 'Temperature must be between 0 and 100';
  }

  if (config.maxTokens !== undefined && (config.maxTokens < 50 || config.maxTokens > 4000)) {
    errors.maxTokens = 'Max tokens must be between 50 and 4000';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function cleanAgentConfig(config: Partial<UnifiedAgentConfig>): UnifiedAgentConfig {
  return {
    ...config,
    instructions: {
      dos: config.instructions?.dos?.filter(instruction => instruction.trim()) || [],
      donts: config.instructions?.donts?.filter(instruction => instruction.trim()) || []
    },
    domainExpertise: config.domainExpertise?.filter(expertise => expertise.trim()) || []
  } as UnifiedAgentConfig;
}

export function getAgentStatusColor(active: boolean): string {
  return active ? 'bg-green-500' : 'bg-gray-400';
}

export function getAgentStatusBadge(active: boolean): { variant: 'default' | 'secondary'; text: string } {
  return active 
    ? { variant: 'default', text: 'Active' }
    : { variant: 'secondary', text: 'Inactive' };
}
