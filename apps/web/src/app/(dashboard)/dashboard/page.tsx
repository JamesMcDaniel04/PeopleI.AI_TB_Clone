'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import {
  Cloud,
  Database,
  FileText,
  ArrowRight,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: environments } = useQuery({
    queryKey: ['environments'],
    queryFn: () => api.environments.list().then((res) => res.data.data),
  });

  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.datasets.list().then((res) => res.data.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.templates.list().then((res) => res.data.data),
  });

  const connectedEnvs = environments?.filter((e: any) => e.status === 'connected') || [];
  const recentDatasets = datasets?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'User'}
        </h1>
        <p className="mt-1 text-gray-600">
          Generate synthetic sales data for your Salesforce demos
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          icon={<Cloud className="h-6 w-6 text-blue-600" />}
          label="Salesforce Environments"
          value={environments?.length || 0}
          subtext={`${connectedEnvs.length} connected`}
          href="/dashboard/environments"
        />
        <StatsCard
          icon={<Database className="h-6 w-6 text-green-600" />}
          label="Generated Datasets"
          value={datasets?.length || 0}
          subtext="Total datasets"
          href="/dashboard/datasets"
        />
        <StatsCard
          icon={<FileText className="h-6 w-6 text-purple-600" />}
          label="Available Templates"
          value={templates?.length || 0}
          subtext="Ready to use"
          href="/dashboard/templates"
        />
      </div>

      {/* Quick actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            href="/dashboard/generate"
            icon={<Plus className="h-5 w-5" />}
            title="Generate Data"
            description="Create new synthetic demo data"
          />
          <QuickAction
            href="/dashboard/environments/new"
            icon={<Cloud className="h-5 w-5" />}
            title="Connect Salesforce"
            description="Add a new Salesforce org"
          />
          <QuickAction
            href="/dashboard/templates"
            icon={<FileText className="h-5 w-5" />}
            title="Browse Templates"
            description="View available data templates"
          />
        </div>
      </div>

      {/* Recent datasets */}
      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Datasets</h2>
          <Link
            href="/dashboard/datasets"
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
          >
            View all <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        <div className="divide-y">
          {recentDatasets.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p>No datasets yet</p>
              <Link
                href="/dashboard/generate"
                className="mt-2 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
              >
                Generate your first dataset <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          ) : (
            recentDatasets.map((dataset: any) => (
              <DatasetRow key={dataset.id} dataset={dataset} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  icon,
  label,
  value,
  subtext,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtext: string;
  href: string;
}) {
  return (
    <Link href={href} className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{subtext}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">{icon}</div>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="p-2 bg-primary-100 rounded-lg text-primary-600">{icon}</div>
      <div className="ml-4">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

function DatasetRow({ dataset }: { dataset: any }) {
  const statusIcon = {
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    generating: <Clock className="h-4 w-4 text-blue-500" />,
    injecting: <Clock className="h-4 w-4 text-yellow-500" />,
    failed: <AlertCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-gray-400" />,
  }[dataset.status] || <Clock className="h-4 w-4 text-gray-400" />;

  return (
    <Link
      href={`/dashboard/datasets/${dataset.id}`}
      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
    >
      <div className="flex items-center">
        <div className="mr-3">{statusIcon}</div>
        <div>
          <p className="font-medium text-gray-900">{dataset.name}</p>
          <p className="text-sm text-gray-500">
            {dataset.template?.name || 'Custom'} - {formatRelativeTime(dataset.createdAt)}
          </p>
        </div>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(dataset.status)}`}>
        {dataset.status}
      </span>
    </Link>
  );
}
