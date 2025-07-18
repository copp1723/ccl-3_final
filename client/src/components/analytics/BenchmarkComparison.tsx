import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const benchmarkData = {
  'Real Estate': { openRate: 22, clickRate: 2.5, conversionRate: 1.5 },
  'E-commerce': { openRate: 18, clickRate: 2.2, conversionRate: 2.0 },
  'Finance': { openRate: 25, clickRate: 3.0, conversionRate: 1.8 },
  'Healthcare': { openRate: 28, clickRate: 3.5, conversionRate: 2.5 },
};

interface BenchmarkComparisonProps {
  clientIndustry: keyof typeof benchmarkData;
  clientMetrics: {
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
}

export function BenchmarkComparison({ clientIndustry, clientMetrics }: BenchmarkComparisonProps) {
  const benchmarks = benchmarkData[clientIndustry];

  if (!benchmarks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Industry Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No benchmark data available for the "{clientIndustry}" industry.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance vs. {clientIndustry} Benchmarks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-medium">Open Rate</h4>
            <span className="text-sm text-gray-600">Benchmark: {benchmarks.openRate}%</span>
          </div>
          <Progress value={(clientMetrics.openRate / benchmarks.openRate) * 100} />
          <p className="text-right text-lg font-bold">{clientMetrics.openRate.toFixed(2)}%</p>
        </div>
        
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-medium">Click-Through Rate</h4>
            <span className="text-sm text-gray-600">Benchmark: {benchmarks.clickRate}%</span>
          </div>
          <Progress value={(clientMetrics.clickRate / benchmarks.clickRate) * 100} />
          <p className="text-right text-lg font-bold">{clientMetrics.clickRate.toFixed(2)}%</p>
        </div>

        <div>
           <div className="flex justify-between items-baseline mb-1">
            <h4 className="font-medium">Conversion Rate</h4>
            <span className="text-sm text-gray-600">Benchmark: {benchmarks.conversionRate}%</span>
          </div>
          <Progress value={(clientMetrics.conversionRate / benchmarks.conversionRate) * 100} />
          <p className="text-right text-lg font-bold">{clientMetrics.conversionRate.toFixed(2)}%</p>
        </div>
      </CardContent>
    </Card>
  );
}