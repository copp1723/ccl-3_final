import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Plus, UserCheck, AlertCircle } from 'lucide-react';

interface HandoverRecipient {
  name: string;
  email: string;
  role: string;
  priority: 'high' | 'medium' | 'low';
}

interface HandoverCriteria {
  qualificationScore: number;
  conversationLength: number;
  timeThreshold: number;
  keywordTriggers: string[];
  goalCompletionRequired: string[];
  handoverRecipients: HandoverRecipient[];
}

interface HandoverConfigProps {
  handoverCriteria: HandoverCriteria;
  onHandoverCriteriaChange: (criteria: HandoverCriteria) => void;
  campaignGoals: string[];
}

const defaultHandoverCriteria: HandoverCriteria = {
  qualificationScore: 7,
  conversationLength: 5,
  timeThreshold: 300,
  keywordTriggers: [],
  goalCompletionRequired: [],
  handoverRecipients: []
};

export function HandoverConfig({ 
  handoverCriteria = defaultHandoverCriteria, 
  onHandoverCriteriaChange,
  campaignGoals 
}: HandoverConfigProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newRecipient, setNewRecipient] = useState<HandoverRecipient>({
    name: '',
    email: '',
    role: '',
    priority: 'medium'
  });

  const updateCriteria = (field: keyof HandoverCriteria, value: any) => {
    onHandoverCriteriaChange({
      ...handoverCriteria,
      [field]: value
    });
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !handoverCriteria.keywordTriggers.includes(newKeyword.trim())) {
      updateCriteria('keywordTriggers', [...handoverCriteria.keywordTriggers, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    updateCriteria('keywordTriggers', handoverCriteria.keywordTriggers.filter(k => k !== keyword));
  };

  const addRecipient = () => {
    if (newRecipient.name && newRecipient.email && newRecipient.role) {
      updateCriteria('handoverRecipients', [...handoverCriteria.handoverRecipients, newRecipient]);
      setNewRecipient({ name: '', email: '', role: '', priority: 'medium' });
    }
  };

  const removeRecipient = (index: number) => {
    updateCriteria('handoverRecipients', handoverCriteria.handoverRecipients.filter((_, i) => i !== index));
  };

  const toggleGoalRequirement = (goal: string) => {
    const current = handoverCriteria.goalCompletionRequired;
    if (current.includes(goal)) {
      updateCriteria('goalCompletionRequired', current.filter(g => g !== goal));
    } else {
      updateCriteria('goalCompletionRequired', [...current, goal]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <UserCheck className="h-5 w-5" />
          <span>Handover Configuration</span>
        </CardTitle>
        <CardDescription>
          Configure when and how conversations are handed over to human agents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Handover Recipients */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Handover Recipients</Label>
          
          {handoverCriteria.handoverRecipients.length > 0 && (
            <div className="space-y-2">
              {handoverCriteria.handoverRecipients.map((recipient, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{recipient.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {recipient.role}
                      </Badge>
                      <Badge 
                        variant={recipient.priority === 'high' ? 'destructive' : 
                                recipient.priority === 'medium' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {recipient.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{recipient.email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Recipient */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-3">
            <Label className="text-sm text-gray-600">Add Handover Recipient</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="recipientName" className="text-xs">Name</Label>
                <Input
                  id="recipientName"
                  placeholder="John Doe"
                  value={newRecipient.name}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipientEmail" className="text-xs">Email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="john@company.com"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipientRole" className="text-xs">Role</Label>
                <Input
                  id="recipientRole"
                  placeholder="Sales Manager"
                  value={newRecipient.role}
                  onChange={(e) => setNewRecipient(prev => ({ ...prev, role: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="recipientPriority" className="text-xs">Priority</Label>
                <Select
                  value={newRecipient.priority}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setNewRecipient(prev => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRecipient}
              disabled={!newRecipient.name || !newRecipient.email || !newRecipient.role}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recipient
            </Button>
          </div>
        </div>

        {/* Handover Triggers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qualificationScore">Qualification Score Threshold</Label>
            <Input
              id="qualificationScore"
              type="number"
              min="1"
              max="100"
              value={handoverCriteria.qualificationScore}
              onChange={(e) => updateCriteria('qualificationScore', parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500">Score above this triggers handover</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="conversationLength">Conversation Length Threshold</Label>
            <Input
              id="conversationLength"
              type="number"
              min="1"
              value={handoverCriteria.conversationLength}
              onChange={(e) => updateCriteria('conversationLength', parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500">Number of messages to trigger handover</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timeThreshold">Time Threshold (seconds)</Label>
          <Input
            id="timeThreshold"
            type="number"
            min="60"
            value={handoverCriteria.timeThreshold}
            onChange={(e) => updateCriteria('timeThreshold', parseInt(e.target.value))}
          />
          <p className="text-xs text-gray-500">Time elapsed before handover (300 = 5 minutes)</p>
        </div>

        {/* Keyword Triggers */}
        <div className="space-y-3">
          <Label>Keyword Triggers</Label>
          {handoverCriteria.keywordTriggers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {handoverCriteria.keywordTriggers.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="flex items-center space-x-1">
                  <span>{keyword}</span>
                  <button
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex space-x-2">
            <Input
              placeholder="Enter keyword (e.g., 'ready to buy')"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
            />
            <Button type="button" variant="outline" onClick={addKeyword}>
              Add
            </Button>
          </div>
        </div>

        {/* Goal Completion Requirements */}
        {campaignGoals.length > 0 && (
          <div className="space-y-3">
            <Label>Goal Completion Triggers</Label>
            <p className="text-sm text-gray-500">Select which goals must be completed to trigger handover</p>
            <div className="space-y-2">
              {campaignGoals.map((goal) => (
                <div key={goal} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`goal-${goal}`}
                    checked={handoverCriteria.goalCompletionRequired.includes(goal)}
                    onChange={() => toggleGoalRequirement(goal)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor={`goal-${goal}`} className="text-sm">{goal}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning for no recipients */}
        {handoverCriteria.handoverRecipients.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">No handover recipients configured</p>
              <p>Add at least one recipient to enable handover functionality.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}