import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BrandingConfigForm } from '@/components/branding/BrandingConfigForm';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Palette, 
  Globe,
  Building,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { CCLBrandingConfig, ClientBrandingData } from '../../../shared/config/branding-config';

type ViewMode = 'list' | 'create' | 'edit';

export function BrandingManagementView() {
  const [brandings, setBrandings] = useState<ClientBrandingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedBranding, setSelectedBranding] = useState<ClientBrandingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBrandings();
  }, []);

  const loadBrandings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/branding');
      const data = await response.json();
      
      if (data.success) {
        setBrandings(data.brandings);
      } else {
        setError(data.error || 'Failed to load brandings');
      }
    } catch (error) {
      console.error('Error loading brandings:', error);
      setError('Failed to load branding configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranding = async (data: {
    name: string;
    domain?: string;
    branding: CCLBrandingConfig;
  }) => {
    try {
      const response = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        await loadBrandings();
        setViewMode('list');
        setError(null);
      } else {
        setError(result.error || 'Failed to create branding');
      }
    } catch (error) {
      console.error('Error creating branding:', error);
      setError('Failed to create branding configuration');
    }
  };

  const handleUpdateBranding = async (data: {
    name: string;
    domain?: string;
    branding: CCLBrandingConfig;
  }) => {
    if (!selectedBranding) return;

    try {
      const response = await fetch(`/api/branding/${selectedBranding.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.branding)
      });

      const result = await response.json();
      
      if (result.success) {
        await loadBrandings();
        setViewMode('list');
        setSelectedBranding(null);
        setError(null);
      } else {
        setError(result.error || 'Failed to update branding');
      }
    } catch (error) {
      console.error('Error updating branding:', error);
      setError('Failed to update branding configuration');
    }
  };

  const handleDeleteBranding = async (brandingId: string) => {
    if (!confirm('Are you sure you want to delete this branding configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/branding/${brandingId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        await loadBrandings();
        setError(null);
      } else {
        setError(result.error || 'Failed to delete branding');
      }
    } catch (error) {
      console.error('Error deleting branding:', error);
      setError('Failed to delete branding configuration');
    }
  };

  const handleEditBranding = (branding: ClientBrandingData) => {
    setSelectedBranding(branding);
    setViewMode('edit');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedBranding(null);
    setError(null);
  };

  if (viewMode === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Create Client Branding</h2>
            <p className="text-gray-600">Configure branding for a new client</p>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}
        
        <BrandingConfigForm
          onSave={handleCreateBranding}
          onCancel={handleBackToList}
        />
      </div>
    );
  }

  if (viewMode === 'edit' && selectedBranding) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Edit Client Branding</h2>
            <p className="text-gray-600">Modify branding for {selectedBranding.name}</p>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          </div>
        )}
        
        <BrandingConfigForm
          initialData={selectedBranding}
          onSave={handleUpdateBranding}
          onCancel={handleBackToList}
          isEditing={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Branding Management</h2>
          <p className="text-gray-600">Manage client branding configurations and white-label settings</p>
        </div>
        <Button onClick={() => setViewMode('create')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Client Branding
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="text-lg">Loading branding configurations...</div>
        </div>
      ) : brandings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Client Brandings</h3>
            <p className="text-gray-600 mb-4">
              Create your first client branding configuration to enable white-label functionality
            </p>
            <Button onClick={() => setViewMode('create')}>
              <Plus className="h-4 w-4 mr-2" />
              Create Client Branding
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {brandings.map((branding) => (
            <Card key={branding.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    {branding.branding.logoUrl && (
                      <img 
                        src={branding.branding.logoUrl} 
                        alt="Logo" 
                        className="h-10 w-10 object-contain rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <span>{branding.name}</span>
                        {branding.isStatic && (
                          <Badge variant="secondary">Static</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {branding.branding.companyName}
                        {branding.domain && ` • ${branding.domain}`}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBranding(branding)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!branding.isStatic && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteBranding(branding.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-600">Primary Color</div>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: branding.branding.primaryColor }}
                      />
                      <span className="text-sm">{branding.branding.primaryColor}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-600">Secondary Color</div>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: branding.branding.secondaryColor }}
                      />
                      <span className="text-sm">{branding.branding.secondaryColor}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-600">Email From</div>
                    <div className="text-sm">{branding.branding.emailFromName}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-600">Support Email</div>
                    <div className="text-sm">{branding.branding.supportEmail}</div>
                  </div>
                </div>
                
                {branding.branding.websiteUrl && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={branding.branding.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        {branding.branding.websiteUrl}
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
