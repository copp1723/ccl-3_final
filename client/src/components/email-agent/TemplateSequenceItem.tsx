import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  GripVertical,
  Zap,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';

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

interface TemplateSequenceItemProps {
  template: Template;
  campaignTemplate: CampaignTemplate;
  index: number;
  isDragging: boolean;
  conversationMode: string;
  scheduleType: string;
  isFirst: boolean;
  isLast: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onUpdateDelay: (delay: number, unit: 'minutes' | 'hours' | 'days') => void;
}

export function TemplateSequenceItem({
  template,
  campaignTemplate,
  index,
  isDragging,
  conversationMode,
  scheduleType,
  isFirst,
  isLast,
  onDragStart,
  onDragEnd,
  onDrop,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateDelay
}: TemplateSequenceItemProps) {
  return (
    <div
      className={`p-4 rounded-lg border bg-white transition-all ${
        isDragging ? 'opacity-50' : ''
      }`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="mt-1 cursor-move">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <span className="font-medium">
                {isFirst ? 'Initial Email' : `Follow-up ${index}`}
              </span>
              <Badge variant="outline" className="text-xs">
                {template.category}
              </Badge>
              {conversationMode === 'auto' && isFirst && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Switches to AI on reply
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">{template.name}</p>
            <p className="text-xs text-gray-500 mt-1">Subject: {template.subject}</p>
            
            {/* Timing Configuration */}
            {scheduleType === 'template' && !isFirst && (
              <div className="mt-3 flex items-center space-x-2">
                <Label className="text-xs">Send after:</Label>
                <Input
                  type="number"
                  value={campaignTemplate.delay}
                  onChange={(e) => onUpdateDelay(
                    parseInt(e.target.value), 
                    campaignTemplate.delayUnit
                  )}
                  className="w-20 h-8"
                  min="0"
                />
                <Select
                  value={campaignTemplate.delayUnit}
                  onValueChange={(value: 'minutes' | 'hours' | 'days') => onUpdateDelay(
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
            onClick={onMoveUp}
            disabled={isFirst}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}