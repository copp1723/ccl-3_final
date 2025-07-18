import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ROICalculator() {
  const [campaignCost, setCampaignCost] = useState('');
  const [revenueGenerated, setRevenueGenerated] = useState('');

  const roi = useMemo(() => {
    const cost = parseFloat(campaignCost);
    const revenue = parseFloat(revenueGenerated);

    if (isNaN(cost) || isNaN(revenue) || cost === 0) {
      return null;
    }

    const calculatedRoi = ((revenue - cost) / cost) * 100;
    return calculatedRoi.toFixed(2);
  }, [campaignCost, revenueGenerated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ROI Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="campaignCost">Total Campaign Cost ($)</Label>
          <Input 
            id="campaignCost"
            type="number"
            value={campaignCost}
            onChange={e => setCampaignCost(e.target.value)}
            placeholder="e.g., 5000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="revenueGenerated">Total Revenue Generated ($)</Label>
          <Input 
            id="revenueGenerated"
            type="number"
            value={revenueGenerated}
            onChange={e => setRevenueGenerated(e.target.value)}
            placeholder="e.g., 20000"
          />
        </div>
        
        {roi !== null && (
          <div className="pt-4">
            <h4 className="text-lg font-semibold">Calculated ROI</h4>
            <p className={`text-3xl font-bold ${parseFloat(roi) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roi}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}