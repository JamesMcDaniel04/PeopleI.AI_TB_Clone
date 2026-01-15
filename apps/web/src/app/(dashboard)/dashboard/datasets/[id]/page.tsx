'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Play,
  RefreshCw,
  Mail,
  PhoneCall,
} from 'lucide-react';

export default function DatasetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const datasetId = params.id as string;

  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<string>('');
  const [emailCount, setEmailCount] = useState(3);
  const [callType, setCallType] = useState('Discovery Call');
  const [callDuration, setCallDuration] = useState(30);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const { data: dataset, isLoading } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => api.datasets.get(datasetId).then((res) => res.data.data),
    refetchInterval: (data) => {
      // Poll while generating or injecting
      const status = data?.state?.data?.status;
      if (status === 'generating' || status === 'injecting' || status === 'pending') {
        return 2000;
      }
      return false;
    },
  });

  const { data: records } = useQuery({
    queryKey: ['dataset-records', datasetId, selectedObject],
    queryFn: () =>
      api.datasets.getRecords(datasetId, selectedObject || undefined).then((res) => res.data.data),
    enabled: !!dataset && dataset.status !== 'pending' && dataset.status !== 'generating',
  });

  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['dataset-records', datasetId, 'Opportunity'],
    queryFn: () => api.datasets.getRecords(datasetId, 'Opportunity').then((res) => res.data.data),
    enabled: !!dataset && dataset.status !== 'pending' && dataset.status !== 'generating',
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs', datasetId],
    queryFn: () => api.jobs.list({ datasetId, limit: 10 }).then((res) => res.data.data),
    enabled: !!dataset,
  });

  const injectMutation = useMutation({
    mutationFn: () => api.generator.inject(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['jobs', datasetId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.datasets.delete(datasetId),
    onSuccess: () => {
      router.push('/dashboard/datasets');
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: () => api.datasets.cleanup(datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['jobs', datasetId] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => api.generator.generateEmails(datasetId, selectedOpportunity, emailCount),
    onSuccess: () => {
      setEmailError(null);
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset-records', datasetId] });
    },
    onError: (error: any) => {
      setEmailError(error.response?.data?.message || 'Failed to generate email thread.');
    },
  });

  const callMutation = useMutation({
    mutationFn: () =>
      api.generator.generateCall(datasetId, selectedOpportunity, callType, callDuration),
    onSuccess: () => {
      setCallError(null);
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] });
      queryClient.invalidateQueries({ queryKey: ['dataset-records', datasetId] });
    },
    onError: (error: any) => {
      setCallError(error.response?.data?.message || 'Failed to generate call transcript.');
    },
  });

  useEffect(() => {
    if (!selectedOpportunity && opportunities?.length) {
      setSelectedOpportunity(opportunities[0].localId);
    }
  }, [opportunities, selectedOpportunity]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Dataset not found</p>
        <Link href="/dashboard/datasets" className="text-primary-600 mt-2 inline-block">
          Back to Datasets
        </Link>
      </div>
    );
  }

  const statusConfig = {
    completed: {
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      label: 'Completed',
      description: 'Data has been generated and injected into Salesforce',
    },
    generated: {
      icon: <CheckCircle className="h-6 w-6 text-blue-500" />,
      label: 'Generated',
      description: 'Data is ready to be injected into Salesforce',
    },
    generating: {
      icon: <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />,
      label: 'Generating...',
      description: 'AI is generating your demo data',
    },
    injecting: {
      icon: <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />,
      label: 'Injecting...',
      description: 'Pushing data to Salesforce',
    },
    failed: {
      icon: <AlertCircle className="h-6 w-6 text-red-500" />,
      label: 'Failed',
      description: dataset.errorMessage || 'An error occurred',
    },
    pending: {
      icon: <Clock className="h-6 w-6 text-gray-400" />,
      label: 'Pending',
      description: 'Waiting to start generation',
    },
  };

  const status = statusConfig[dataset.status as keyof typeof statusConfig] || statusConfig.pending;
  const recordCounts = dataset.recordCounts || {};
  const objectTypes = Object.keys(recordCounts).filter((k) => recordCounts[k] > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/datasets"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Datasets
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{dataset.name}</h1>
        </div>

        <div className="flex gap-3">
          {dataset.status === 'generated' && dataset.environmentId && (
            <button
              onClick={() => injectMutation.mutate()}
              disabled={injectMutation.isPending}
              className="btn btn-primary btn-md"
            >
              {injectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Inject to Salesforce
            </button>
          )}

          {dataset.status === 'completed' && (
            <button
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              className="btn btn-outline btn-md"
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Cleanup from SF
            </button>
          )}

          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this dataset?')) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="btn btn-outline btn-md text-red-600 hover:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Status card */}
      <div className="card p-6">
        <div className="flex items-start">
          <div className="mr-4">{status.icon}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Status: {status.label}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{status.description}</p>
              </div>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(
                  dataset.status
                )}`}
              >
                {dataset.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Template</p>
                <p className="font-medium">{dataset.template?.name || 'Custom'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Environment</p>
                <p className="font-medium">{dataset.environment?.name || 'None'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p className="font-medium">{formatDateTime(dataset.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="font-medium">
                  {Object.values(recordCounts).reduce((a: number, b: any) => a + b, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <Mail className="h-5 w-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Opportunity Enrichment</h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {opportunitiesLoading ? (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading opportunities...
            </div>
          ) : !opportunities || opportunities.length === 0 ? (
            <p className="text-sm text-gray-500">
              Generate opportunities first to create email threads or call transcripts.
            </p>
          ) : (
            <>
              <div>
                <label className="label">Opportunity</label>
                <select
                  value={selectedOpportunity}
                  onChange={(event) => setSelectedOpportunity(event.target.value)}
                  className="input mt-1"
                >
                  {opportunities.map((opp: any) => (
                    <option key={opp.localId} value={opp.localId}>
                      {opp.data?.Name || opp.localId}
                      {opp.data?.StageName ? ` • ${opp.data.StageName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <Mail className="h-4 w-4 mr-2 text-primary-600" />
                    Email Thread
                  </div>
                  <div>
                    <label className="label">Email Count</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={emailCount}
                      onChange={(event) => setEmailCount(Number(event.target.value) || 1)}
                      className="input mt-1 w-28"
                    />
                  </div>
                  {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                  <button
                    onClick={() => emailMutation.mutate()}
                    disabled={!selectedOpportunity || emailMutation.isPending}
                    className="btn btn-primary btn-md w-full"
                  >
                    {emailMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Generate Emails
                  </button>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <PhoneCall className="h-4 w-4 mr-2 text-primary-600" />
                    Call Transcript
                  </div>
                  <div>
                    <label className="label">Call Type</label>
                    <input
                      type="text"
                      value={callType}
                      onChange={(event) => setCallType(event.target.value)}
                      className="input mt-1"
                    />
                  </div>
                  <div>
                    <label className="label">Duration (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={callDuration}
                      onChange={(event) => setCallDuration(Number(event.target.value) || 5)}
                      className="input mt-1 w-28"
                    />
                  </div>
                  {callError && <p className="text-xs text-red-600">{callError}</p>}
                  <button
                    onClick={() => callMutation.mutate()}
                    disabled={!selectedOpportunity || callMutation.isPending}
                    className="btn btn-outline btn-md w-full"
                  >
                    {callMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PhoneCall className="mr-2 h-4 w-4" />
                    )}
                    Generate Call
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Record counts */}
      {objectTypes.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Generated Records</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedObject(null)}
                className={`px-3 py-1.5 text-sm rounded-full ${
                  selectedObject === null
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {objectTypes.map((objType) => (
                <button
                  key={objType}
                  onClick={() => setSelectedObject(objType)}
                  className={`px-3 py-1.5 text-sm rounded-full ${
                    selectedObject === objType
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {objType} ({recordCounts[objType]})
                </button>
              ))}
            </div>

            {/* Records table */}
            {records && records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Object
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Local ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        SF ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Data Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.slice(0, 50).map((record: any) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {record.salesforceObject}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                          {record.localId}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.salesforceId ? (
                            <span className="text-green-600 font-mono">
                              {record.salesforceId}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {getRecordPreview(record.data)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 50 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Showing first 50 of {records.length} records
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No records to display</p>
            )}
          </div>
        </div>
      )}

      {jobs?.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Job Activity</h2>
          </div>
          <div className="divide-y">
            {jobs.map((job: any) => (
              <div key={job.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatJobType(job.type)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(job.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600"
                      style={{ width: `${job.progress || 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{job.progress || 0}% complete</p>
                </div>
                {job.errorMessage && (
                  <p className="mt-2 text-xs text-red-600">{job.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatJobType(type: string): string {
  const map: Record<string, string> = {
    data_generation: 'Data generation',
    data_injection: 'Salesforce injection',
    cleanup: 'Salesforce cleanup',
  };
  return map[type] || type;
}

function getRecordPreview(data: any): string {
  if (data.Name) return data.Name;
  if (data.FirstName && data.LastName) return `${data.FirstName} ${data.LastName}`;
  if (data.Subject) return data.Subject;
  if (data.TextBody) return String(data.TextBody).slice(0, 50);
  if (data.FromAddress) return data.FromAddress;
  if (data.Email) return data.Email;
  return JSON.stringify(data).slice(0, 50) + '...';
}
