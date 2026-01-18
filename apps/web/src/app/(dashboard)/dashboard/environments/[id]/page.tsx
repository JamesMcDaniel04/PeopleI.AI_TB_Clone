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

type RecordTypeOverrideRow = {
  objectType: string;
  recordType: string;
};

type FieldMappingRow = {
  objectType: string;
  sourceField: string;
  targetField: string;
};

type FieldDefaultRow = {
  objectType: string;
  field: string;
  value: string;
};

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
  const [recordTypeOverrides, setRecordTypeOverrides] = useState<RecordTypeOverrideRow[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingRow[]>([]);
  const [fieldDefaults, setFieldDefaults] = useState<FieldDefaultRow[]>([]);

  useEffect(() => {
    if (environment) {
      setFormState({
        name: environment.name || '',
        description: environment.description || '',
      });
      setRecordTypeOverrides(toRecordTypeOverrides(environment.injectionConfig));
      setFieldMappings(toFieldMappings(environment.injectionConfig));
      setFieldDefaults(toFieldDefaults(environment.injectionConfig));
    }
  }, [environment]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.environments.update(environmentId, {
        name: formState.name,
        description: formState.description || undefined,
        injectionConfig: buildInjectionConfig(
          recordTypeOverrides,
          fieldMappings,
          fieldDefaults,
        ),
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
  const isConnecting = status === 'connecting';

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
              disabled={connectMutation.isPending || isConnecting}
              className="btn btn-primary btn-md"
            >
              {connectMutation.isPending || isConnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect to Salesforce'}
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

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900">Salesforce Injection Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Override record types, map fields, and set defaults per object type.
        </p>

        <div className="mt-6 space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Record Type Overrides</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  setRecordTypeOverrides((prev) => [
                    ...prev,
                    { objectType: '', recordType: '' },
                  ])
                }
              >
                Add override
              </button>
            </div>
            {recordTypeOverrides.length === 0 ? (
              <p className="text-xs text-gray-500">
                No record type overrides configured.
              </p>
            ) : (
              <div className="space-y-2">
                {recordTypeOverrides.map((row, index) => (
                  <div key={`${row.objectType}-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={row.objectType}
                      onChange={(event) =>
                        setRecordTypeOverrides((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, objectType: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Object (e.g. Opportunity)"
                    />
                    <input
                      type="text"
                      value={row.recordType}
                      onChange={(event) =>
                        setRecordTypeOverrides((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, recordType: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="RecordTypeId or name"
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setRecordTypeOverrides((prev) =>
                          prev.filter((_, idx) => idx !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Field Mappings</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  setFieldMappings((prev) => [
                    ...prev,
                    { objectType: '', sourceField: '', targetField: '' },
                  ])
                }
              >
                Add mapping
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Use *_localId when mapping relationship fields (e.g. AccountId_localId -> Account__c_localId).
            </p>
            {fieldMappings.length === 0 ? (
              <p className="text-xs text-gray-500">No field mappings configured.</p>
            ) : (
              <div className="space-y-2">
                {fieldMappings.map((row, index) => (
                  <div key={`${row.objectType}-${row.sourceField}-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={row.objectType}
                      onChange={(event) =>
                        setFieldMappings((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, objectType: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Object"
                    />
                    <input
                      type="text"
                      value={row.sourceField}
                      onChange={(event) =>
                        setFieldMappings((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, sourceField: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Source field"
                    />
                    <input
                      type="text"
                      value={row.targetField}
                      onChange={(event) =>
                        setFieldMappings((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, targetField: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Target field"
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setFieldMappings((prev) =>
                          prev.filter((_, idx) => idx !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Field Defaults</h3>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  setFieldDefaults((prev) => [
                    ...prev,
                    { objectType: '', field: '', value: '' },
                  ])
                }
              >
                Add default
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Values are JSON-parsed when possible. Use quotes to force strings.
            </p>
            {fieldDefaults.length === 0 ? (
              <p className="text-xs text-gray-500">No default values configured.</p>
            ) : (
              <div className="space-y-2">
                {fieldDefaults.map((row, index) => (
                  <div key={`${row.objectType}-${row.field}-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      value={row.objectType}
                      onChange={(event) =>
                        setFieldDefaults((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, objectType: event.target.value }
                              : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Object"
                    />
                    <input
                      type="text"
                      value={row.field}
                      onChange={(event) =>
                        setFieldDefaults((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, field: event.target.value } : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Field"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(event) =>
                        setFieldDefaults((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, value: event.target.value } : item
                          )
                        )
                      }
                      className="input"
                      placeholder="Value"
                    />
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        setFieldDefaults((prev) =>
                          prev.filter((_, idx) => idx !== index)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Injection Settings
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

function toRecordTypeOverrides(injectionConfig: any): RecordTypeOverrideRow[] {
  const overrides = injectionConfig?.recordTypeOverrides || {};
  return Object.entries(overrides).map(([objectType, recordType]) => ({
    objectType,
    recordType: String(recordType),
  }));
}

function toFieldMappings(injectionConfig: any): FieldMappingRow[] {
  const mappings = injectionConfig?.fieldMappings || {};
  const rows: FieldMappingRow[] = [];
  Object.entries(mappings).forEach(([objectType, fields]) => {
    Object.entries(fields as Record<string, string>).forEach(([sourceField, targetField]) => {
      rows.push({
        objectType,
        sourceField,
        targetField,
      });
    });
  });
  return rows;
}

function toFieldDefaults(injectionConfig: any): FieldDefaultRow[] {
  const defaults = injectionConfig?.fieldDefaults || {};
  const rows: FieldDefaultRow[] = [];
  Object.entries(defaults).forEach(([objectType, fields]) => {
    Object.entries(fields as Record<string, any>).forEach(([field, value]) => {
      rows.push({
        objectType,
        field,
        value: stringifyDefaultValue(value),
      });
    });
  });
  return rows;
}

function stringifyDefaultValue(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildInjectionConfig(
  recordTypeOverrides: RecordTypeOverrideRow[],
  fieldMappings: FieldMappingRow[],
  fieldDefaults: FieldDefaultRow[],
): Record<string, any> {
  const config: Record<string, any> = {};
  const recordTypeMap: Record<string, string> = {};
  recordTypeOverrides.forEach((row) => {
    if (row.objectType && row.recordType) {
      recordTypeMap[row.objectType] = row.recordType;
    }
  });
  if (Object.keys(recordTypeMap).length > 0) {
    config.recordTypeOverrides = recordTypeMap;
  }

  const mappingMap: Record<string, Record<string, string>> = {};
  fieldMappings.forEach((row) => {
    if (!row.objectType || !row.sourceField || !row.targetField) {
      return;
    }
    if (!mappingMap[row.objectType]) {
      mappingMap[row.objectType] = {};
    }
    mappingMap[row.objectType][row.sourceField] = row.targetField;
  });
  if (Object.keys(mappingMap).length > 0) {
    config.fieldMappings = mappingMap;
  }

  const defaultMap: Record<string, Record<string, any>> = {};
  fieldDefaults.forEach((row) => {
    if (!row.objectType || !row.field) {
      return;
    }
    const trimmed = row.value.trim();
    if (!trimmed) {
      return;
    }
    if (!defaultMap[row.objectType]) {
      defaultMap[row.objectType] = {};
    }
    defaultMap[row.objectType][row.field] = parseDefaultValue(row.value);
  });
  if (Object.keys(defaultMap).length > 0) {
    config.fieldDefaults = defaultMap;
  }

  return config;
}

function parseDefaultValue(value: string): any {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
