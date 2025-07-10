import { Mail, Phone, MessageCircle, Bot, Brain } from 'lucide-react';

export const agentIcons: Record<string, JSX.Element> = {
  email: <Mail className="h-5 w-5 text-white" />,
  sms: <Phone className="h-5 w-5 text-white" />,
  chat: <MessageCircle className="h-5 w-5 text-white" />,
  overlord: <Bot className="h-5 w-5 text-white" />
};

export const getAgentIcon = (agentId: string): JSX.Element => {
  const type = Object.keys(agentIcons).find(key => agentId.includes(key));
  return type ? agentIcons[type] : <Brain className="h-5 w-5 text-white" />;
};