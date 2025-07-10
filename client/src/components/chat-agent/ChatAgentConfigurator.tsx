import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save, RotateCcw } from 'lucide-react';

interface ChatAgentConfig {
  id?: string;
  name: string;
  type: 'chat';
  role: string;
  endGoal: string;
  instructions: {
    dos: string[];
    donts: string[];
  };
  domainExpertise: string[];
  personality: string;
  tone: string;
  responseLength: 'short' | 'medium' | 'long';
  temperature: number;
  maxTokens: number;
  active: boolean;
}

interface ChatAgentConfiguratorProps {
  agentId?: string;
  onSave: (config: ChatAgentConfig) => Promise<void>;
  onCancel: () => void;
}

export function ChatAgentConfigurator({ agentId, onSave, onCancel }: ChatAgentConfiguratorProps) {
  const [config, setConfig] = useState<ChatAgentConfig>({
    name: '',
    type: 'chat',
    role: 'Customer Support Specialist',
    endGoal: 'Provide immediate assistance and qualify leads through live chat',
    instructions: {
      dos: ['Respond within 30 seconds', 'Ask qualifying questions naturally'],
      donts: ['Leave customers waiting', 'Be overly pushy']
    },
    domainExpertise: ['Live Chat', 'Customer Support'],
    personality: 'friendly',
    tone: 'conversational',
    responseLength: 'short',
    temperature: 70,
    maxTokens: 300,
    active: true
  });

  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');
  const [newExpertise, setNewExpertise] = useState('');

  const personalities = ['professional', 'friendly', 'casual', 'enthusiastic', 'empathetic'];
  const tones = ['conversational', 'formal', 'casual', 'warm', 'direct'];

  const addInstruction = (type: 'dos' | 'donts', value: string) => {
    if (!value.trim()) return;
    setConfig(prev => ({
      ...prev,
      instructions: {
        ...prev.instructions,
        [type]: [...prev.instructions[type], value.trim()]
      }
    }));
    if (type === 'dos') setNewDo('');
    else setNewDont('');
  };

  const removeInstruction = (type: 'dos' | 'donts', index: number) => {
    setConfig(prev => ({
      ...prev,
      instructions: {
        ...prev.instructions,
        [type]: prev.instructions[type].filter((_, i) => i !== index)
      }
    }));
  };

  const addExpertise = () => {
    if (!newExpertise.trim()) return;
    setConfig(prev => ({
      ...prev,
      domainExpertise: [...prev.domainExpertise, newExpertise.trim()]
    }));
    setNewExpertise('');
  };

  const removeExpertise = (index: number) => {
    setConfig(prev => ({
      ...prev,
      domainExpertise: prev.domainExpertise.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    await onSave(config);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Live Chat Support Agent"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={config.role}
                onChange={(e) => setConfig(prev => ({ ...prev, role: e.target.value }))}
                placeholder="e.g., Customer Support Specialist"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="endGoal">Primary Goal</Label>
            <Textarea
              id="endGoal"
              value={config.endGoal}
              onChange={(e) => setConfig(prev => ({ ...prev, endGoal: e.target.value }))}
              placeholder="What should this agent accomplish?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Personality</Label>
              <Select value={config.personality} onValueChange={(value) => setConfig(prev => ({ ...prev, personality: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {personalities.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tone</Label>
              <Select value={config.tone} onValueChange={(value) => setConfig(prev => ({ ...prev, tone: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tones.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Response Length</Label>
              <Select value={config.responseLength} onValueChange={(value: 'short' | 'medium' | 'long') => setConfig(prev => ({ ...prev, responseLength: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>DO (Best Practices)</Label>
            <div className="space-y-2">
              {config.instructions.dos.map((instruction, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="outline" className="flex-1 justify-start">
                    {instruction}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInstruction('dos', index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newDo}
                  onChange={(e) => setNewDo(e.target.value)}
                  placeholder="Add a DO instruction..."
                  onKeyPress={(e) => e.key === 'Enter' && addInstruction('dos', newDo)}
                />
                <Button onClick={() => addInstruction('dos', newDo)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>DON'T (Avoid These)</Label>
            <div className="space-y-2">
              {config.instructions.donts.map((instruction, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Badge variant="destructive" className="flex-1 justify-start">
                    {instruction}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInstruction('donts', index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newDont}
                  onChange={(e) => setNewDont(e.target.value)}
                  placeholder="Add a DON'T instruction..."
                  onKeyPress={(e) => e.key === 'Enter' && addInstruction('donts', newDont)}
                />
                <Button onClick={() => addInstruction('donts', newDont)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Expertise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {config.domainExpertise.map((expertise, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {expertise}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => removeExpertise(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                placeholder="Add expertise area..."
                onKeyPress={(e) => e.key === 'Enter' && addExpertise()}
              />
              <Button onClick={addExpertise}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Temperature ({config.temperature}%)</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={config.temperature}
                onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500">Lower = more consistent, Higher = more creative</div>
            </div>
            <div>
              <Label>Max Tokens</Label>
              <Input
                type="number"
                value={config.maxTokens}
                onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                min="50"
                max="1000"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.active}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, active: checked }))}
            />
            <Label>Active Agent</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}