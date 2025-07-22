import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Plus } from 'lucide-react';
import { CampaignEditor } from '@/components/email-agent/CampaignEditor';

export const CampaignsView: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">Manage your marketing campaigns</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Create Campaign</span>
        </Button>
      </div>

      {showCreateForm ? (
        <CampaignEditor 
          agents={[]} // TODO: Load actual agents
          onSave={() => {
            setShowCreateForm(false);
            // Optionally refresh the list
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Campaign Management</span>
            </CardTitle>
            <CardDescription>
              Create and manage email campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Campaigns</h3>
              <p className="text-gray-500 mb-4">
                Create and manage your email marketing campaigns.
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Campaign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 