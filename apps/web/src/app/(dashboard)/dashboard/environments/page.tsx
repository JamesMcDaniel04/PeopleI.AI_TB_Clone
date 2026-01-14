'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import {
  Cloud,
  Plus,
  MoreVertical,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function EnvironmentsPage() {
  const queryClient = useQueryClient();

  const { data: environments, isLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: () => api.environments.list().then((res) => res.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.environments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environments'] });
    },
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
          <h1 className="text-2xl font-bold text-gray-900">Salesforce Environments</h1>
          <p className="mt-1 text-gray-600">
            Connect and manage your Salesforce orgs for data injection
          </p>
        </div>
        <Link href="/dashboard/environments/new" className="btn btn-primary btn-md">
          <Plus className="mr-2 h-4 w-4" />
          Add Environment
        </Link>
      </div>

      {environments?.length === 0 ? (
        <div className="card p-12 text-center">
          <Cloud className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No environments yet</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Connect a Salesforce org to start injecting generated demo data
          </p>
          <Link href="/dashboard/environments/new" className="btn btn-primary btn-md mt-6">
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Environment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {environments?.map((env: any) => (
            <EnvironmentCard
              key={env.id}
              environment={env}
              onDelete={() => {
                if (confirm('Are you sure you want to delete this environment?')) {
                  deleteMutation.mutate(env.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentCard({
  environment,
  onDelete,
}: {
  environment: any;
  onDelete: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const isConnected = environment.status === 'connected';
  const isConnecting = environment.status === 'connecting';

  return (
    <div className="card">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div
              className={`p-2 rounded-lg ${
                isConnected ? 'bg-green-100' : isConnecting ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              <Cloud
                className={`h-6 w-6 ${
                  isConnected ? 'text-green-600' : isConnecting ? 'text-blue-600' : 'text-gray-400'
                }`}
              />
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-gray-900">{environment.name}</h3>
              <span
                className={`inline-flex items-center text-xs ${
                  isConnected ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                {isConnected ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </>
                ) : isConnecting ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Connecting
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Disconnected
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border z-10">
                <Link
                  href={`/dashboard/environments/${environment.id}`}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Details
                </Link>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {environment.description && (
          <p className="mt-3 text-sm text-gray-500">{environment.description}</p>
        )}

        <div className="mt-4 pt-4 border-t space-y-2">
          {environment.salesforceInstanceUrl && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Instance:</span>{' '}
              {environment.salesforceInstanceUrl.replace('https://', '')}
            </div>
          )}
          <div className="text-xs text-gray-500">
            <span className="font-medium">Type:</span>{' '}
            {environment.isSandbox ? 'Sandbox' : 'Production'}
          </div>
          {environment.lastSyncedAt && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Last sync:</span>{' '}
              {formatRelativeTime(environment.lastSyncedAt)}
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t">
        <Link
          href={`/dashboard/environments/${environment.id}`}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Manage Environment
        </Link>
      </div>
    </div>
  );
}
