import React, { useState, useEffect } from 'react';
import { useClient } from '@/contexts/ClientContext';
import { useApiCall } from '@/hooks/useApiCall';
import { TemplateEditor } from '@/components/email-agent/TemplateEditor';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function TemplateLibraryView() {
  const { activeClient } = useClient();
  const { get } = useApiCall();
  const [templates, setTemplates] = useState([]);
  const [showGlobal, setShowGlobal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      
      let url = '/api/email/templates';
      const params = new URLSearchParams();

      if (showGlobal) {
        params.append('global', 'true');
      } else if (activeClient) {
        // This assumes the API will use the activeClient from the session/token
        // Alternatively, you could pass: params.append('clientId', activeClient.id);
      } else {
        // No active client and not showing global, so load nothing.
        setTemplates([]);
        setLoading(false);
        return;
      }

      try {
        const response = await get(`${url}?${params.toString()}`);
        const data = await response.json();
        if (data.success) {
          setTemplates(data.templates);
        }
      } catch (error) {
        console.error("Failed to fetch templates", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [activeClient, showGlobal, get]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Template Library</h1>
          <p className="text-gray-600">
            {showGlobal ? "Showing global agency templates" : `Showing templates for ${activeClient?.name || '...'}`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="global-switch">Show Global</Label>
          <Switch 
            id="global-switch"
            checked={showGlobal}
            onCheckedChange={setShowGlobal}
          />
        </div>
      </div>
      
      {/* 
        The existing TemplateEditor likely needs to be refactored to be more
        of a presentational component, and to take the templates as a prop.
        For now, I'm assuming we can reuse it as-is and it will internally
        fetch the correct templates based on the context.
      */}
      {loading ? (
        <p>Loading templates...</p>
      ) : (
        <TemplateEditor />
      )}
    </div>
  );
}