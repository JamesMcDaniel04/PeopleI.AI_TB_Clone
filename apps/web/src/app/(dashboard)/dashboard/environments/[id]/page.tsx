'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatRelativeTime, getStatusColor } from '@/lib/utils';
import {
  ArrowLeft,
  Cloud,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Trash2,
  Save,
} from 'lucide-react';

export default function EnvironmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const environmentId = params.id as string;

  const { data: environment, isLoading } = useQuery({
    queryKey: ['environment', environmentId],
    queryFn: () => api.environments.get(environmentId).then((res) => res.data.data),
  });

  const statusQuery = useQuery({
    queryKey: ['environment-status', environmentId],
    queryFn: () => api.environments.getStatus(environmentId).then((res) => res.data.data),
    enabled: false,
  });

  const [formState, setFormState] = useState({ name: '', description: '' });

  useEffect(() => {
    if (environment) {
      setFormState({
        name: environment.name || '',
        description: environment.description || '',
      });
    }
  }, [environment]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.environments.update(environmentId, {
        name: formState.name,
        description: formState.description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment', environmentId] });
      queryClient.invalidateQueries({ queryKey: ['environments'] });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => api.environments.getAuthUrl(environmentId, environment?.isSandbox),
    onSuccess: (response) => {
      const authUrl = response.data.data.authUrl;
      window.location.href = authUrl;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.environments.disconnect(environmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['environment', environmentId] });
      queryClient.invalidateQueries({ queryKey: ['environments'] });
      queryClient.removeQueries({ queryKey: ['environment-status', environmentId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.environments.delete(environmentId),
    onSuccess: () => {
      router.push('/dashboard/environments');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!environment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Environment not found</p>
        <Link href="/dashboard/environments" className="text-primary-600 mt-2 inline-block">
          Back to Environments
        </Link>
      </div>
    );
  }

  const statusData = statusQuery.data;
  const status = statusData?.status || environment.status;
  const isConnected = statusData?.isConnected ?? environment.status === 'connected';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/environments"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Environments
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{environment.name}</h1>
          {environment.description && (
            <p className="mt-1 text-gray-600">{environment.description}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            className="btn btn-outline btn-md"
          >
            {statusQuery.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Check Connection
          </button>

          {isConnected ? (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="btn btn-outline btn-md"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="btn btn-primary btn-md"
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Connect to Salesforce
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <div
                className={`p-2 rounded-lg ${
                  isConnected ? 'bg-green-100' : 'bg-gray-100'
                }`}
              >
                <Cloud
                  className={`h-6 w-6 ${
                    isConnected ? 'text-green-600' : 'text-gray-400'
                  }`}
                />
              </div>
              <div className="ml-3">
                <h2 className="text-lg font-semibold text-gray-900">Connection</h2>
                <p className="text-sm text-gray-500">
                  {isConnected ? 'Connected to Salesforce' : 'Not connected'}
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(
                status
              )}`}
            >
              {status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="text-gray-500">Environment Type</span>
              <div className="mt-1 font-medium text-gray-900">
                {environment.isSandbox ? 'Sandbox' : 'Production'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Instance</span>
              <div className="mt-1 font-medium text-gray-900">
                {statusData?.instanceUrl?.replace('https://', '') ||
                  environment.salesforceInstanceUrl?.replace('https://', '') ||
                  '-'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Org ID</span>
              <div className="mt-1 font-medium text-gray-900">
                {statusData?.orgId || environment.salesforceOrgId || '-'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Last Sync</span>
              <div className="mt-1 font-medium text-gray-900">
                {environment.lastSyncedAt ? formatRelativeTime(environment.lastSyncedAt) : '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900">Edit Details</h2>
          <p className="text-sm text-gray-500 mt-1">
            Update the name or description for this environment.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                }
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                rows={3}
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, description: event.target.value }))
                }
                className="input mt-1"
              />
            </div>
          </div>

          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="btn btn-primary btn-md mt-4 w-full"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="card p-6 border border-red-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Danger Zone</h2>
            <p className="text-sm text-gray-500 mt-1">
              Deleting an environment will remove its connection data.
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Delete this environment? This cannot be undone.')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="btn btn-outline btn-md text-red-600 hover:bg-red-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Environment
          </button>
        </div>
      </div>
    </div>
  );
}
