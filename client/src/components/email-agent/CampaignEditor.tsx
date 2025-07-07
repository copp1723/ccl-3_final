import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Mail, 
  Brain, 
  FileText, 
  Calendar,
  X,
  ChevronRight,
  Target,
  Clock,
  Settings,
  Plus,
  GripVertical,
  Zap,
  MessageSquare,
  Upload,
  Download,
  Info,
  ChevronUp,
  ChevronDown,
  Copy,
  Library
} from 'lucide-react';

interface CampaignEditorProps {
  campaign?: any;
  agents: any[];
  onSave: (campaign: any) => void;
  onCancel: () => void;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  category: string;
  variables: string[];
}

interface CampaignTemplate {
  templateId: string;
  delay: number;
  delayUnit: 'minutes' | 'hours' | 'days';
  order: number;
}

interface Schedule {
  id: string;
  name: string;
  type: 'template' | 'fixed' | 'custom';
  config?: any;
}

export function CampaignEditor({ campaign, agents, onSave, onCancel }: CampaignEditorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [availableSchedules, setAvailableSchedules] = useState<Schedule[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    agentId: '',
    status: 'draft',
    templates: [] as CampaignTemplate[],
    scheduleType: 'template' as 'template' | 'fixed' | 'custom',
    fixedInterval: { days: 3, emails: 5 },
    conversationMode: 'auto' as 'auto' | 'template' | 'ai',
    audience: {
      filters: [] as any[],
      targetCount: 0
    },
    settings: {
      sendTimeOptimization: true,
      enableAIMode: true,
      aiModeThreshold: 'first_reply' as 'first_reply' | 'buying_signals' | 'manual',
      handoverGoal: '',
      handoverKeywords: [] as string[],
      dailyLimit: 100,
      timezone: 'recipient',
      templateLibrary: 'custom' as 'custom' | 'welcome' | 'followup' | 'nurture' | 'reengagement',
      handoverFollowUp: {
        enabled: false,
        daysAfterHandover: 7,
        maxAttempts: 2,
        daysBetweenAttempts: 3
      }
    }
  });

  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [isDragging, setIsDragging] = useState<number | null>(null);

  useEffect(() => {
    loadData();
    if (campaign) {
      // Convert existing campaign data to new format
      const campaignTemplates = campaign.templates?.map((templateId: string, index: number) => ({
        templateId,
        delay: campaign.settings?.followUpSchedule?.daysBetweenEmails || 3,
        delayUnit: 'days' as const,
        order: index
      })) || [];

      setFormData({
        ...campaign,
        templates: campaignTemplates,
        scheduleType: campaign.scheduleType || 'template',
        fixedInterval: campaign.fixedInterval || { days: 3, emails: 5 },
        conversationMode: campaign.conversationMode || 'auto',
        settings: {
          sendTimeOptimization: campaign.settings?.sendTimeOptimization ?? true,
          enableAIMode: campaign.settings?.enableAIMode ?? true,
          aiModeThreshold: campaign.settings?.aiModeThreshold || 'first_reply',
          handoverGoal: campaign.settings?.handoverGoal || '',
          handoverKeywords: campaign.settings?.handoverKeywords || [],
          dailyLimit: campaign.settings?.dailyLimit || 100,
          timezone: campaign.settings?.timezone || 'recipient',
          templateLibrary: campaign.settings?.templateLibrary || 'custom',
          handoverFollowUp: campaign.settings?.handoverFollowUp || {
            enabled: false,
            daysAfterHandover: 7,
            maxAttempts: 2,
            daysBetweenAttempts: 3
          }
        }
      });
    }
  }, [campaign]);

  const loadData = async () => {
    try {
      const [templatesRes, schedulesRes] = await Promise.all([
        fetch('/api/email/templates'),
        fetch('/api/email/schedules')
      ]);

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplates(templatesData.data || []);
      }

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        setAvailableSchedules(schedulesData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processedData = {
      ...formData,
      // Convert templates array back to the format expected by backend if needed
      templates: formData.scheduleType === 'template' 
        ? formData.templates 
        : formData.templates.map(t => t.templateId),
      settings: {
        ...formData.settings,
        // Include schedule info in settings for backward compatibility
        followUpSchedule: formData.scheduleType === 'fixed' ? {
          totalEmails: formData.fixedInterval.emails,
          daysBetweenEmails: formData.fixedInterval.days,
          enabled: true
        } : undefined
      }
    };
    onSave(processedData);
  };

  const addTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const newTemplate: CampaignTemplate = {
      templateId,
      delay: formData.templates.length === 0 ? 0 : 1,
      delayUnit: 'days',
      order: formData.templates.length
    };

    setFormData(prev => ({
      ...prev,
      templates: [...prev.templates, newTemplate]
    }));
  };

  const removeTemplate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      templates: prev.templates.filter((_, i) => i !== index)
    }));
  };

  const updateTemplateDelay = (index: number, delay: number, delayUnit: 'minutes' | 'hours' | 'days') => {
    setFormData(prev => ({
      ...prev,
      templates: prev.templates.map((t, i) => 
        i === index ? { ...t, delay, delayUnit } : t
      )
    }));
  };

  const moveTemplate = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= formData.templates.length) return;
    
    const newTemplates = [...formData.templates];
    const [removed] = newTemplates.splice(fromIndex, 1);
    newTemplates.splice(toIndex, 0, removed);
    
    // Update order
    newTemplates.forEach((t, i) => t.order = i);
    
    setFormData(prev => ({ ...prev, templates: newTemplates }));
  };

  const importTemplates = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const text = await file.text();
        try {
          const imported = JSON.parse(text);
          if (imported.templates && Array.isArray(imported.templates)) {
            setFormData(prev => ({ ...prev, templates: imported.templates }));
          }
        } catch (err) {
          console.error('Error importing templates:', err);
        }
      }
    };
    input.click();
  };

  const exportTemplates = () => {
    const data = {
      campaignName: formData.name,
      templates: formData.templates,
      scheduleType: formData.scheduleType,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-templates-${formData.name || 'export'}.json`;
    a.click();
  };

  const selectedAgent = agents.find(a => a.id === formData.agentId);
  const availableTemplates = templates.filter(t => 
    !formData.templates.some(ct => ct.templateId === t.id)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>{campaign ? 'Edit' : 'Create'} Campaign</span>
          </CardTitle>
          <CardDescription>
            Configure your email campaign settings and content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Q4 Sales Outreach"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent">AI Agent</Label>
              <Select
                value={formData.agentId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, agentId: value }))}
              >
                <SelectTrigger id="agent">
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center space-x-2">
                        <Brain className="h-4 w-4" />
                        <span>{agent.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the campaign goals and target audience..."
              rows={3}
            />
          </div>

          {/* Conversation Mode */}
          <div className="space-y-2">
            <Label>Conversation Mode</Label>
            <Select
              value={formData.conversationMode}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, conversationMode: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Auto (Template → AI on reply)</span>
                  </div>
                </SelectItem>
                <SelectItem value="template">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Templates Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="ai">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>AI Conversations Only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {formData.conversationMode === 'auto' && 'Starts with templates, switches to AI when lead replies'}
              {formData.conversationMode === 'template' && 'Only sends templated emails, no AI conversations'}
              {formData.conversationMode === 'ai' && 'AI handles all conversations from the start'}
            </p>
          </div>

          {selectedAgent && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Agent Configuration</p>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>End Goal:</strong> {selectedAgent.endGoal}</p>
                <p><strong>Mode:</strong> Will use {formData.conversationMode === 'auto' ? 'Template → AI' : formData.conversationMode === 'template' ? 'Templates Only' : 'AI Only'} approach</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Templates - Dynamic Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Email Sequence</span>
                {formData.templates.length > 0 && (
                  <Badge variant="secondary">{formData.templates.length} templates</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Build your email sequence with flexible timing
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
              >
                <Library className="h-4 w-4 mr-2" />
                Template Library
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={importTemplates}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              {formData.templates.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportTemplates}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schedule Type Selection */}
          <div className="space-y-2">
            <Label>Schedule Type</Label>
            <Select
              value={formData.scheduleType}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, scheduleType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>Dynamic (Per-template timing)</span>
                  </div>
                </SelectItem>
                <SelectItem value="fixed">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Fixed Interval</span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Custom Schedule</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fixed Interval Configuration */}
          {formData.scheduleType === 'fixed' && (
            <div className="bg-gray-50 border rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixedEmails">Number of Emails</Label>
                  <Input
                    id="fixedEmails"
                    type="number"
                    value={formData.fixedInterval.emails}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      fixedInterval: { ...prev.fixedInterval, emails: parseInt(e.target.value) }
                    }))}
                    min="1"
                    max="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixedDays">Days Between</Label>
                  <Input
                    id="fixedDays"
                    type="number"
                    value={formData.fixedInterval.days}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      fixedInterval: { ...prev.fixedInterval, days: parseInt(e.target.value) }
                    }))}
                    min="1"
                    max="30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Template Sequence */}
          <div className="space-y-3">
            {formData.templates.map((campaignTemplate, index) => {
              const template = templates.find(t => t.id === campaignTemplate.templateId);
              if (!template) return null;

              return (
                <div
                  key={`${campaignTemplate.templateId}-${index}`}
                  className={`p-4 rounded-lg border bg-white transition-all ${
                    isDragging === index ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={() => setIsDragging(index)}
                  onDragEnd={() => setIsDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isDragging !== null && isDragging !== index) {
                      moveTemplate(isDragging, index);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="mt-1 cursor-move">
                        <GripVertical className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">
                            {index === 0 ? 'Initial Email' : `Follow-up ${index}`}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                          {formData.conversationMode === 'auto' && index === 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Zap className="h-3 w-3 mr-1" />
                              Switches to AI on reply
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{template.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Subject: {template.subject}</p>
                        
                        {/* Timing Configuration */}
                        {formData.scheduleType === 'template' && index > 0 && (
                          <div className="mt-3 flex items-center space-x-2">
                            <Label className="text-xs">Send after:</Label>
                            <Input
                              type="number"
                              value={campaignTemplate.delay}
                              onChange={(e) => updateTemplateDelay(
                                index, 
                                parseInt(e.target.value), 
                                campaignTemplate.delayUnit
                              )}
                              className="w-20 h-8"
                              min="0"
                            />
                            <Select
                              value={campaignTemplate.delayUnit}
                              onValueChange={(value: any) => updateTemplateDelay(
                                index, 
                                campaignTemplate.delay, 
                                value
                              )}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">minutes</SelectItem>
                                <SelectItem value="hours">hours</SelectItem>
                                <SelectItem value="days">days</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-gray-500">from previous email</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveTemplate(index, index - 1)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveTemplate(index, index + 1)}
                        disabled={index === formData.templates.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTemplate(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Template */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <Label className="text-sm text-gray-600 mb-2 block">Add Template</Label>
              <Select
                value=""
                onValueChange={(value) => value && addTemplate(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {template.category}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {availableTemplates.length === 0 && (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      No more templates available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {formData.templates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No templates added yet. Add templates to build your sequence.</p>
              </div>
            )}
          </div>

          {/* Template Stats */}
          {formData.templates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Sequence Summary:</p>
                  <ul className="space-y-1">
                    <li>• {formData.templates.length} email{formData.templates.length > 1 ? 's' : ''} in sequence</li>
                    {formData.scheduleType === 'template' && formData.templates.length > 1 && (
                      <li>• Total campaign duration: ~{
                        formData.templates.slice(1).reduce((acc, t) => {
                          const multiplier = t.delayUnit === 'days' ? 1 : t.delayUnit === 'hours' ? 1/24 : 1/1440;
                          return acc + (t.delay * multiplier);
                        }, 0).toFixed(1)
                      } days</li>
                    )}
                    {formData.conversationMode === 'auto' && (
                      <li>• AI takes over after first reply</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Campaign Settings</span>
          </CardTitle>
          <CardDescription>
            Fine-tune campaign behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Send Time Optimization</Label>
                <p className="text-sm text-gray-500">
                  Automatically send emails at optimal times for each recipient
                </p>
              </div>
              <Switch
                checked={formData.settings.sendTimeOptimization}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, sendTimeOptimization: checked }
                  }))
                }
              />
            </div>

            {formData.conversationMode !== 'template' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable AI Conversations</Label>
                  <p className="text-sm text-gray-500">
                    Allow AI to take over when conditions are met
                  </p>
                </div>
                <Switch
                  checked={formData.settings.enableAIMode}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, enableAIMode: checked }
                    }))
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dailyLimit">Daily Send Limit</Label>
              <Input
                id="dailyLimit"
                type="number"
                value={formData.settings.dailyLimit}
                onChange={(e) => 
                  setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, dailyLimit: parseInt(e.target.value) }
                  }))
                }
                min="1"
                max="1000"
              />
              <p className="text-sm text-gray-500">
                Maximum emails to send per day from this campaign
              </p>
            </div>
          </div>

          {/* AI Mode Configuration */}
          {formData.conversationMode !== 'template' && formData.settings.enableAIMode && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span>AI Conversation Settings</span>
              </h4>

              <div className="space-y-2">
                <Label>Switch to AI Mode When</Label>
                <Select
                  value={formData.settings.aiModeThreshold}
                  onValueChange={(value: any) => 
                    setFormData(prev => ({
                      ...prev,
                      settings: { ...prev.settings, aiModeThreshold: value }
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first_reply">Lead replies to any email</SelectItem>
                    <SelectItem value="buying_signals">Buying signals detected</SelectItem>
                    <SelectItem value="manual">Manual trigger only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Handover Configuration */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Handover Configuration</span>
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor="handoverGoal">Handover Goal</Label>
              <Textarea
                id="handoverGoal"
                value={formData.settings.handoverGoal}
                onChange={(e) => 
                  setFormData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, handoverGoal: e.target.value }
                  }))
                }
                placeholder="e.g., Qualify they are ready to buy, Schedule a demo, Express strong interest"
                rows={2}
              />
              <p className="text-sm text-gray-500">
                Describe when the AI should hand over to a human agent
              </p>
            </div>

            <div className="space-y-2">
              <Label>Handover Keywords</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.settings.handoverKeywords.map((keyword, idx) => (
                  <Badge key={idx} variant="secondary" className="pr-1">
                    {keyword}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            handoverKeywords: prev.settings.handoverKeywords.filter((_, i) => i !== idx)
                          }
                        }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
              <div className="flex space-x-2">
                <Input
                  id="newKeyword"
                  placeholder="Add keyword (e.g., 'ready to buy', 'pricing', 'demo')"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        setFormData(prev => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            handoverKeywords: [...prev.settings.handoverKeywords, input.value.trim()]
                          }
                        }));
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>
              <p className="text-sm text-gray-500">
                Keywords that trigger immediate handover to human agent
              </p>
            </div>
          </div>

          {/* Handover Follow-up */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Follow-up After Handover</Label>
                <p className="text-sm text-gray-500">
                  Check if lead was helped by human agent after handover
                </p>
              </div>
              <Switch
                checked={formData.settings.handoverFollowUp.enabled}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      handoverFollowUp: {
                        ...prev.settings.handoverFollowUp,
                        enabled: checked
                      }
                    }
                  }))
                }
              />
            </div>
            
            {formData.settings.handoverFollowUp.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daysAfter">Days After Handover</Label>
                  <Input
                    id="daysAfter"
                    type="number"
                    value={formData.settings.handoverFollowUp.daysAfterHandover}
                    onChange={(e) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          handoverFollowUp: {
                            ...prev.settings.handoverFollowUp,
                            daysAfterHandover: parseInt(e.target.value)
                          }
                        }
                      }))
                    }
                    min="1"
                    max="30"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">Max Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    value={formData.settings.handoverFollowUp.maxAttempts}
                    onChange={(e) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          handoverFollowUp: {
                            ...prev.settings.handoverFollowUp,
                            maxAttempts: parseInt(e.target.value)
                          }
                        }
                      }))
                    }
                    min="1"
                    max="3"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="daysBetweenAttempts">Days Between Attempts</Label>
                  <Input
                    id="daysBetweenAttempts"
                    type="number"
                    value={formData.settings.handoverFollowUp.daysBetweenAttempts}
                    onChange={(e) => 
                      setFormData(prev => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          handoverFollowUp: {
                            ...prev.settings.handoverFollowUp,
                            daysBetweenAttempts: parseInt(e.target.value)
                          }
                        }
                      }))
                    }
                    min="1"
                    max="14"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {campaign ? 'Update' : 'Create'} Campaign
        </Button>
      </div>
    </form>
  );
}