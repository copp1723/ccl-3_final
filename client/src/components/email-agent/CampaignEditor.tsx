// All campaign config is managed under the unified 'settings' object per CampaignSettings schema.
import React from 'react';
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
  ChevronRight,
  Clock,
  Plus,
  Upload,
  Download,
  Info,
  Copy,
  Library,
  Zap,
  MessageSquare,
  Settings
} from 'lucide-react';
import { TemplateSequenceItem } from './TemplateSequenceItem';
import { CampaignSettings } from './CampaignSettings';
import { LeadSelector } from './LeadSelector';
import { HandoverConfig } from './HandoverConfig';
import { useCampaignForm } from '@/hooks/useCampaignForm';
import { CampaignTouchSequenceEditor } from './CampaignTouchSequenceEditor';

interface CampaignEditorProps {
  campaign?: any;
  agents: any[];
  onSave: (campaign: any) => void;
  onCancel: () => void;
}

export function CampaignEditor({ campaign, agents, onSave, onCancel }: CampaignEditorProps) {
  const {
    formData,
    setFormData,
    templates,
    availableSchedules,
    showTemplateLibrary,
    setShowTemplateLibrary,
    isDragging,
    setIsDragging,
    addTemplate,
    removeTemplate,
    updateTemplateDelay,
    moveTemplate,
    importTemplates,
    exportTemplates,
    prepareFormData,
    availableTemplates
  } = useCampaignForm(campaign);

  // Ensure settings exists in formData
  React.useEffect(() => {
    if (!formData.settings) {
      setFormData(prev => ({
        ...prev,
        settings: {
          goals: [],
          qualificationCriteria: {},
          handoverCriteria: {},
          channelPreferences: {},
        }
      }));
    }
  // eslint-disable-next-line
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Always call onSave with unified settings object
    onSave({
      name: formData.name,
      agentId: formData.agentId,
      description: formData.description,
      templates: formData.templates,
      scheduleType: formData.scheduleType,
      fixedInterval: formData.fixedInterval,
      selectedLeads: formData.selectedLeads,
      conversationMode: formData.conversationMode,
      settings: formData.settings,
    });
  };

  const selectedAgent = agents.find(a => a.id === formData.agentId);

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

      {/* Lead Selection */}
      <LeadSelector
        selectedLeads={formData.selectedLeads || []}
        onLeadsChange={(leads) => setFormData(prev => ({ ...prev, selectedLeads: leads }))}
      />

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
                <TemplateSequenceItem
                  key={`${campaignTemplate.templateId}-${index}`}
                  template={template}
                  campaignTemplate={campaignTemplate}
                  index={index}
                  isDragging={isDragging === index}
                  conversationMode={formData.conversationMode}
                  scheduleType={formData.scheduleType}
                  isFirst={index === 0}
                  isLast={index === formData.templates.length - 1}
                  onDragStart={() => setIsDragging(index)}
                  onDragEnd={() => setIsDragging(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isDragging !== null && isDragging !== index) {
                      moveTemplate(isDragging, index);
                    }
                  }}
                  onMoveUp={() => moveTemplate(index, index - 1)}
                  onMoveDown={() => moveTemplate(index, index + 1)}
                  onRemove={() => removeTemplate(index)}
                  onUpdateDelay={(delay, unit) => updateTemplateDelay(index, delay, unit)}
                />
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

      {/* Touch Sequence Editor - all touch steps (email/SMS) managed in settings */}
      <CampaignTouchSequenceEditor
        sequence={formData.settings?.touchSequence || []}
        onChange={sequence =>
          setFormData(prev => ({
            ...prev,
            settings: {
              ...prev.settings,
              touchSequence: sequence
            }
          }))
        }
      />

      {/* Campaign Settings - all advanced config under settings */}
      // All multi-step touch/email/SMS scheduling is now managed in settings.touchSequence.
      <CampaignSettings
        settings={formData.settings || {}}
        onChange={(newSettings) =>
          setFormData(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }))
        }
      />

      {/* Handover Configuration (now inside settings) */}
      <HandoverConfig
        handoverCriteria={formData.settings?.handoverCriteria || {
          qualificationScore: 7,
          conversationLength: 5,
          timeThreshold: 300,
          keywordTriggers: [],
          goalCompletionRequired: [],
          handoverRecipients: []
        }}
        onHandoverCriteriaChange={(criteria) =>
          setFormData(prev => ({
            ...prev,
            settings: {
              ...prev.settings,
              handoverCriteria: criteria
            }
          }))
        }
        campaignGoals={selectedAgent?.endGoal ? [selectedAgent.endGoal] : []}
      />

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
