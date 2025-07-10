import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Brain,
  User,
  Target,
  BookOpen,
  MessageSquare,
  Zap,
  Settings,
  Plus,
  X,
  Info,
  Save,
  AlertCircle
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type: 'overlord' | 'email' | 'sms' | 'chat';
  role: string;
  endGoal: string;
  instructions: string[];
  domainExpertise: string[];
  personality: 'professional' | 'friendly' | 'authoritative' | 'empathetic';
  tone: 'formal' | 'casual' | 'enthusiastic' | 'persuasive';
  responseLength: 'short' | 'medium' | 'long';
  apiModel?: string;
  temperature: number;
  maxTokens: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AgentConfiguratorProps {
  agent: Agent | null;
  onSave: (agent: Partial<Agent>) => Promise<void>;
  onCancel: () => void;
}

const AGENT_TYPES = [
  { value: 'overlord', label: 'Overlord (Master Agent)', description: 'Orchestrates all other agents and makes strategic decisions' },
  { value: 'email', label: 'Email Agent', description: 'Handles email communications and follow-ups' },
  { value: 'sms', label: 'SMS Agent', description: 'Manages text message communications' },
  { value: 'chat', label: 'Chat Agent', description: 'Handles website chat and real-time conversations' }
] as const;

const PERSONALITIES = [
  { value: 'professional', label: 'Professional', description: 'Formal, business-like approach' },
  { value: 'friendly', label: 'Friendly', description: 'Warm, approachable personality' },
  { value: 'authoritative', label: 'Authoritative', description: 'Expert, confident tone' },
  { value: 'empathetic', label: 'Empathetic', description: 'Understanding, supportive approach' }
] as const;

const TONES = [
  { value: 'formal', label: 'Formal', description: 'Business professional language' },
  { value: 'casual', label: 'Casual', description: 'Relaxed, conversational style' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Energetic, positive approach' },
  { value: 'persuasive', label: 'Persuasive', description: 'Sales-focused, compelling language' }
] as const;

const RESPONSE_LENGTHS = [
  { value: 'short', label: 'Short', description: '1-2 sentences, concise responses' },
  { value: 'medium', label: 'Medium', description: '2-4 sentences, balanced detail' },
  { value: 'long', label: 'Long', description: '4+ sentences, comprehensive responses' }
] as const;

export function AgentConfigurator({ agent, onSave, onCancel }: AgentConfiguratorProps) {
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    type: 'email',
    role: '',
    endGoal: '',
    instructions: [''],
    domainExpertise: [''],
    personality: 'professional',
    tone: 'formal',
    responseLength: 'medium',
    temperature: 70,
    maxTokens: 500,
    active: true,
    ...agent
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (agent) {
      setFormData(agent);
    }
  }, [agent]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Agent name is required';
    }

    if (!formData.role?.trim()) {
      newErrors.role = 'Agent role is required';
    }

    if (!formData.endGoal?.trim()) {
      newErrors.endGoal = 'End goal is required';
    }

    if (!formData.instructions?.some(inst => inst.trim())) {
      newErrors.instructions = 'At least one instruction is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Clean up empty instructions and domain expertise
      const cleanedData = {
        ...formData,
        instructions: formData.instructions?.filter(inst => inst.trim()) || [],
        domainExpertise: formData.domainExpertise?.filter(domain => domain.trim()) || []
      };

      await onSave(cleanedData);
    } catch (error) {
      console.error('Failed to save agent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addInstruction = () => {
    setFormData(prev => ({
      ...prev,
      instructions: [...(prev.instructions || []), '']
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions?.map((inst, i) => i === index ? value : inst) || []
    }));
  };

  const removeInstruction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      instructions: prev.instructions?.filter((_, i) => i !== index) || []
    }));
  };

  const addDomainExpertise = () => {
    setFormData(prev => ({
      ...prev,
      domainExpertise: [...(prev.domainExpertise || []), '']
    }));
  };

  const updateDomainExpertise = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      domainExpertise: prev.domainExpertise?.map((domain, i) => i === index ? value : domain) || []
    }));
  };

  const removeDomainExpertise = (index: number) => {
    setFormData(prev => ({
      ...prev,
      domainExpertise: prev.domainExpertise?.filter((_, i) => i !== index) || []
    }));
  };

  const selectedAgentType = AGENT_TYPES.find(type => type.value === formData.type);
  const selectedPersonality = PERSONALITIES.find(p => p.value === formData.personality);
  const selectedTone = TONES.find(t => t.value === formData.tone);
  const selectedResponseLength = RESPONSE_LENGTHS.find(r => r.value === formData.responseLength);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>{agent ? 'Edit' : 'Create'} AI Agent</span>
          </CardTitle>
          <CardDescription>
            Configure your AI agent's basic information and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Professional Sales Agent"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Agent Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select agent type" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-gray-500">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgentType && (
                <p className="text-xs text-gray-600">{selectedAgentType.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Agent Role *</Label>
            <Input
              id="role"
              value={formData.role || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
              placeholder="e.g., Lead Qualification Specialist"
              className={errors.role ? 'border-red-500' : ''}
            />
            {errors.role && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.role}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endGoal">End Goal *</Label>
            <Textarea
              id="endGoal"
              value={formData.endGoal || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, endGoal: e.target.value }))}
              placeholder="e.g., Qualify leads for automotive financing and schedule consultation calls"
              rows={3}
              className={errors.endGoal ? 'border-red-500' : ''}
            />
            {errors.endGoal && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="h-3 w-3" />
                <span>{errors.endGoal}</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
            />
            <Label htmlFor="active">Agent is active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Personality & Communication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Personality & Communication Style</span>
          </CardTitle>
          <CardDescription>
            Define how your agent communicates with leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="personality">Personality</Label>
              <Select
                value={formData.personality}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, personality: value }))}
              >
                <SelectTrigger id="personality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONALITIES.map((personality) => (
                    <SelectItem key={personality.value} value={personality.value}>
                      <div className="flex flex-col">
                        <span>{personality.label}</span>
                        <span className="text-xs text-gray-500">{personality.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPersonality && (
                <p className="text-xs text-gray-600">{selectedPersonality.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Communication Tone</Label>
              <Select
                value={formData.tone}
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, tone: value }))}
              >
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => (
                    <SelectItem key={tone.value} value={tone.value}>
                      <div className="flex flex-col">
                        <span>{tone.label}</span>
                        <span className="text-xs text-gray-500">{tone.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTone && (
                <p className="text-xs text-gray-600">{selectedTone.description}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responseLength">Response Length</Label>
            <Select
              value={formData.responseLength}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, responseLength: value }))}
            >
              <SelectTrigger id="responseLength">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSE_LENGTHS.map((length) => (
                  <SelectItem key={length.value} value={length.value}>
                    <div className="flex flex-col">
                      <span>{length.label}</span>
                      <span className="text-xs text-gray-500">{length.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedResponseLength && (
              <p className="text-xs text-gray-600">{selectedResponseLength.description}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>Instructions</span>
          </CardTitle>
          <CardDescription>
            Provide specific instructions for how the agent should behave
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {formData.instructions?.map((instruction, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="flex-1 space-y-1">
                  <Input
                    value={instruction}
                    onChange={(e) => updateInstruction(index, e.target.value)}
                    placeholder={`Instruction ${index + 1}`}
                  />
                </div>
                {formData.instructions!.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeInstruction(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInstruction}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Instruction</span>
          </Button>

          {errors.instructions && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <AlertCircle className="h-3 w-3" />
              <span>{errors.instructions}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Domain Expertise */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Domain Expertise</span>
          </CardTitle>
          <CardDescription>
            Define areas of expertise for industry-specific knowledge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {formData.domainExpertise?.map((domain, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="flex-1 space-y-1">
                  <Input
                    value={domain}
                    onChange={(e) => updateDomainExpertise(index, e.target.value)}
                    placeholder={`Domain expertise ${index + 1}`}
                  />
                </div>
                {formData.domainExpertise!.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeDomainExpertise(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addDomainExpertise}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Domain Expertise</span>
          </Button>
        </CardContent>
      </Card>

      {/* AI Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>AI Model Settings</span>
          </CardTitle>
          <CardDescription>
            Fine-tune the AI model parameters for optimal performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiModel">API Model (Optional)</Label>
            <Input
              id="apiModel"
              value={formData.apiModel || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, apiModel: e.target.value }))}
              placeholder="e.g., gpt-4, claude-3, leave blank for default"
            />
            <p className="text-xs text-gray-600">
              Specify a custom AI model or leave blank to use the system default
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">Creativity (Temperature)</Label>
                <Badge variant="outline">{formData.temperature}%</Badge>
              </div>
              <Slider
                id="temperature"
                value={[formData.temperature || 70]}
                onValueChange={(value: number[]) => setFormData(prev => ({ ...prev, temperature: value[0] }))}
                max={100}
                min={0}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-gray-600">
                Lower values = more focused and deterministic responses. Higher values = more creative and varied responses.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxTokens">Max Response Length</Label>
                <Badge variant="outline">{formData.maxTokens} tokens</Badge>
              </div>
              <Slider
                id="maxTokens"
                value={[formData.maxTokens || 500]}
                onValueChange={(value: number[]) => setFormData(prev => ({ ...prev, maxTokens: value[0] }))}
                max={2000}
                min={100}
                step={50}
                className="w-full"
              />
              <p className="text-xs text-gray-600">
                Controls the maximum length of AI responses. ~4 characters per token.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {formData.name && formData.endGoal && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5" />
              <span>Agent Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-blue-900">{formData.name}</h4>
                <div className="flex items-center space-x-2">
                  <Badge variant={formData.active ? 'default' : 'secondary'}>
                    {formData.active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">{selectedAgentType?.label}</Badge>
                </div>
              </div>
              <p className="text-sm text-blue-800">
                <strong>Role:</strong> {formData.role}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Goal:</strong> {formData.endGoal}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Style:</strong> {selectedPersonality?.label} personality with {selectedTone?.label.toLowerCase()} tone
              </p>
              {formData.instructions && formData.instructions.filter(i => i.trim()).length > 0 && (
                <p className="text-sm text-blue-800">
                  <strong>Instructions:</strong> {formData.instructions.filter(i => i.trim()).length} configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Zap className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {agent ? 'Update' : 'Create'} Agent
            </>
          )}
        </Button>
      </div>
    </form>
  );
}