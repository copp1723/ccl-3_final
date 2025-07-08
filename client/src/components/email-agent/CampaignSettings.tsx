import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, MessageSquare, Target, X } from 'lucide-react';

interface CampaignSettingsProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

export function CampaignSettings({ formData, setFormData }: CampaignSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Campaign Settings</span>
        </CardTitle>
        <CardDescription>
          Configure campaign behavior and AI settings
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
  );
}