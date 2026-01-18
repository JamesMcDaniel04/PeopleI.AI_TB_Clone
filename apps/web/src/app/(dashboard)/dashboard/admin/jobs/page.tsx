'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatDateTime, getStatusColor } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2, Activity, Database } from 'lucide-react';

export default function AdminJobsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-job-metrics'],
    queryFn: () => api.jobs.metrics().then((res) => res.data.data),
    enabled: user?.role === 'admin',
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: () => api.jobs.adminList({ limit: 50 }).then((res) => res.data.data),
    enabled: user?.role === 'admin',
  });

  if (!user) {
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <div className="card p-6">
        <p className="text-sm text-gray-600">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Operations</h1>
          <p className="mt-1 text-gray-600">Monitor queues and recent background jobs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['generation', 'injection', 'cleanup'].map((queue) => (
          <div key={queue} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Activity className="h-5 w-5 text-primary-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-500 capitalize">{queue}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {metrics?.[queue]?.active ?? 0}
                  </p>
                </div>
              </div>
              <div className="text-xs text-gray-500 text-right">
                <p>Waiting: {metrics?.[queue]?.waiting ?? 0}</p>
                <p>Failed: {metrics?.[queue]?.failed ?? 0}</p>
              </div>
            </div>
          </div>
        ))}
        {metricsLoading && (
          <div className="card p-4 flex items-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading metrics...
          </div>
        )}
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <Database className="h-5 w-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
          </div>
        </div>
        <div className="p-6">
          {jobsLoading ? (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading jobs...
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Dataset
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs.map((job: any) => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {job.type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {job.userId || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {job.datasetId || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDateTime(job.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {job.progress || 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No jobs found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
