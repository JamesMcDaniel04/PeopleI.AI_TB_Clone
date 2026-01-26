'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import {
  Camera,
  Loader2,
  Star,
  Trash2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export default function SnapshotsPage() {
  const queryClient = useQueryClient();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    environmentId: '',
    isGoldenImage: false,
  });

  const { data: environments } = useQuery({
    queryKey: ['environments'],
    queryFn: () => api.environments.list().then((res) => res.data.data),
  });

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ['snapshots', selectedEnvironmentId],
    queryFn: () =>
      api.snapshots
        .list({
          environmentId: selectedEnvironmentId || undefined,
        })
        .then((res) => res.data),
  });

  const { data: goldenImage } = useQuery({
    queryKey: ['golden-image', selectedEnvironmentId],
    queryFn: () =>
      api.snapshots.getGoldenImage(selectedEnvironmentId).then((res) => res.data),
    enabled: !!selectedEnvironmentId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.snapshots.create({
        name: formState.name,
        description: formState.description || undefined,
        environmentId: formState.environmentId,
        isGoldenImage: formState.isGoldenImage,
      }),
    onSuccess: () => {
      setFormState({ name: '', description: '', environmentId: '', isGoldenImage: false });
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['golden-image'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (snapshotId: string) =>
      api.snapshots.restore(snapshotId, { deleteExisting: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });

  const setGoldenMutation = useMutation({
    mutationFn: (snapshotId: string) => api.snapshots.setGoldenImage(snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['golden-image'] });
    },
  });

  const resetToGoldenMutation = useMutation({
    mutationFn: () => api.snapshots.resetToGolden(selectedEnvironmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (snapshotId: string) => api.snapshots.remove(snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['golden-image'] });
    },
  });

  const envOptions = useMemo(
    () => environments || [],
    [environments],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Snapshots</h1>
          <p className="text-sm text-gray-600 mt-1">
            Capture and restore Salesforce demo environments with golden images.
          </p>
        </div>
        {goldenImage && (
          <button
            onClick={() => {
              if (
                confirm(
                  `Reset environment to golden image "${goldenImage.name}"? This will delete existing demo data.`,
                )
              ) {
                resetToGoldenMutation.mutate();
              }
            }}
            disabled={resetToGoldenMutation.isPending}
            className="btn btn-outline btn-md"
          >
            {resetToGoldenMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reset to Golden
          </button>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100">
            <Camera className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create Snapshot</h2>
            <p className="text-sm text-gray-500">Capture the current demo data state.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Environment</label>
            <select
              value={formState.environmentId}
              onChange={(e) => setFormState({ ...formState, environmentId: e.target.value })}
              className="input mt-1"
            >
              <option value="">Select environment</option>
              {envOptions.map((env: any) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Name</label>
            <input
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="input mt-1"
              placeholder="Q2 Golden Image"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              className="input mt-1"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={formState.isGoldenImage}
                onChange={(e) =>
                  setFormState({ ...formState, isGoldenImage: e.target.checked })
                }
              />
              Set as golden image
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => createMutation.mutate()}
            disabled={!formState.name || !formState.environmentId || createMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Create Snapshot
          </button>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Snapshot Library</h2>
            <p className="text-sm text-gray-500">
              Manage saved snapshots for all environments.
            </p>
          </div>
          <div>
            <select
              value={selectedEnvironmentId}
              onChange={(e) => setSelectedEnvironmentId(e.target.value)}
              className="input"
            >
              <option value="">All environments</option>
              {envOptions.map((env: any) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading snapshots...
            </div>
          ) : snapshots?.length ? (
            <div className="space-y-3">
              {snapshots.map((snapshot: any) => (
                <div
                  key={snapshot.id}
                  className="border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{snapshot.name}</h3>
                      {snapshot.isGoldenImage && (
                        <span className="inline-flex items-center text-xs text-amber-600">
                          <Star className="h-3 w-3 mr-1" />
                          Golden
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {snapshot.environment?.name || 'Unknown environment'} •{' '}
                      {snapshot.type?.replace('_', ' ')} •{' '}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                          snapshot.status || '',
                        )}`}
                      >
                        {snapshot.status}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {snapshot.metadata?.totalRecords || 0} records •{' '}
                      {formatDateTime(snapshot.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {snapshot.status === 'ready' && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Restore snapshot "${snapshot.name}"? This will delete existing demo data.`,
                            )
                          ) {
                            restoreMutation.mutate(snapshot.id);
                          }
                        }}
                        disabled={restoreMutation.isPending}
                        className="btn btn-outline btn-sm"
                      >
                        {restoreMutation.isPending ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-2 h-3 w-3" />
                        )}
                        Restore
                      </button>
                    )}
                    {snapshot.status === 'ready' && !snapshot.isGoldenImage && (
                      <button
                        onClick={() => setGoldenMutation.mutate(snapshot.id)}
                        disabled={setGoldenMutation.isPending}
                        className="btn btn-outline btn-sm"
                      >
                        {setGoldenMutation.isPending ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Star className="mr-2 h-3 w-3" />
                        )}
                        Set Golden
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Delete snapshot "${snapshot.name}"?`)) {
                          deleteMutation.mutate(snapshot.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="btn btn-outline btn-sm text-red-600 hover:bg-red-50"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-3 w-3" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No snapshots created yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
