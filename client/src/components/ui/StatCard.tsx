import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  color?: string;
  isLoading?: boolean;
}

export function StatCard({ title, value, subtitle, icon: Icon, color, isLoading }: StatCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className="h-5 w-5" style={{ color }} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-12"></div>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold" style={{ color: color || 'inherit' }}>
              {value}
            </div>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default StatCard;