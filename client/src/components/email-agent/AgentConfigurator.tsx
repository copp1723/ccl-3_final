import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Agent {
  id: string;
  name: string;
  [key: string]: any;
}

interface AgentConfiguratorProps {
  agent: Agent | null;
  onSave: (agent: Partial<Agent>) => Promise<void>;
  onCancel: () => void;
}

export function AgentConfigurator({ agent, onSave, onCancel }: AgentConfiguratorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Agent configuration panel will be implemented here.</p>
        {agent && <p className="text-sm text-gray-500 mt-2">Configuring: {agent.name}</p>}
      </CardContent>
    </Card>
  );
}