'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import {
  Database,
  Plus,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function DatasetsPage() {
  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list().then((res) => res.data.data),
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
          <h1 className="text-2xl font-bold text-gray-900">Datasets</h1>
          <p className="mt-1 text-gray-600">
            View and manage your generated demo data
          </p>
        </div>
        <Link href="/dashboard/generate" className="btn btn-primary btn-md">
          <Plus className="mr-2 h-4 w-4" />
          Generate New
        </Link>
      </div>

      {datasets?.length === 0 ? (
        <div className="card p-12 text-center">
          <Database className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No datasets yet</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Generate your first dataset of synthetic demo data
          </p>
          <Link href="/dashboard/generate" className="btn btn-primary btn-md mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Generate Your First Dataset
          </Link>
        </div>
      ) : (
        <div className="card divide-y">
          {datasets?.map((dataset: any) => (
            <DatasetRow key={dataset.id} dataset={dataset} />
          ))}
        </div>
      )}
    </div>
  );
}

function DatasetRow({ dataset }: { dataset: any }) {
  const statusConfig = {
    completed: {
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      label: 'Completed',
    },
    generating: {
      icon: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
      label: 'Generating...',
    },
    injecting: {
      icon: <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />,
      label: 'Injecting...',
    },
    generated: {
      icon: <CheckCircle className="h-5 w-5 text-blue-500" />,
      label: 'Generated',
    },
    failed: {
      icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      label: 'Failed',
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-gray-400" />,
      label: 'Pending',
    },
  };

  const status = statusConfig[dataset.status as keyof typeof statusConfig] || statusConfig.pending;

  const recordCount = Object.values(dataset.recordCounts || {}).reduce(
    (a: number, b: any) => a + (b || 0),
    0
  );

  return (
    <Link
      href={`/dashboard/datasets/${dataset.id}`}
      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center min-w-0">
        <div className="mr-4">{status.icon}</div>
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{dataset.name}</h3>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <span>{dataset.template?.name || 'Custom'}</span>
            <span className="mx-2">-</span>
            <span>{recordCount} records</span>
            <span className="mx-2">-</span>
            <span>{formatRelativeTime(dataset.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center ml-4">
        <span
          className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
            dataset.status
          )}`}
        >
          {status.label}
        </span>
        <ArrowRight className="ml-4 h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}
