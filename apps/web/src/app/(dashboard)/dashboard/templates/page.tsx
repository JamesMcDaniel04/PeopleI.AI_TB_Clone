'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { FileText, Loader2, ArrowRight, Sparkles } from 'lucide-react';

export default function TemplatesPage() {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.templates.list().then((res) => res.data.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Templates</h1>
          <p className="mt-1 text-gray-600">
            Choose a template to generate realistic demo data for different scenarios
          </p>
        </div>
        <Link href="/dashboard/templates/new" className="btn btn-primary btn-md">
          <Sparkles className="mr-2 h-4 w-4" />
          New Template
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates?.map((template: any) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: any }) {
  const defaultCounts = template.config?.defaultRecordCounts || {};
  const totalRecords = Object.values(defaultCounts).reduce(
    (a: number, b: any) => a + (b || 0),
    0
  );

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="p-2 bg-primary-100 rounded-lg">
            <FileText className="h-6 w-6 text-primary-600" />
          </div>
          {template.isSystem && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
              System
            </span>
          )}
        </div>

        <h3 className="mt-4 text-lg font-semibold text-gray-900">{template.name}</h3>
        <p className="mt-2 text-sm text-gray-500">{template.description}</p>

        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Industry:</span>
              <span className="ml-1 font-medium capitalize">{template.industry}</span>
            </div>
            <div>
              <span className="text-gray-500">Default:</span>
              <span className="ml-1 font-medium">{totalRecords} records</span>
            </div>
          </div>

          {template.config?.scenarios && (
            <div className="mt-3">
              <span className="text-xs text-gray-500">Scenarios:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {template.config.scenarios.slice(0, 3).map((scenario: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                  >
                    {scenario}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/generate?templateId=${template.id}`}
            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <Sparkles className="mr-1.5 h-4 w-4" />
            Use Template
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
          <Link
            href={`/dashboard/templates/${template.id}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Manage
          </Link>
        </div>
      </div>
    </div>
  );
}
