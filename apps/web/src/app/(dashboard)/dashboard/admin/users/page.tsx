'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Loader2, UserCog } from 'lucide-react';
import { formatDateTime, getStatusColor } from '@/lib/utils';

export default function AdminUsersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.users.adminList().then((res) => res.data.data),
    enabled: user?.role === 'admin',
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; role?: string; isActive?: boolean }) =>
      api.users.adminUpdate(payload.id, {
        role: payload.role,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update user.');
    },
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
          <h1 className="text-2xl font-bold text-gray-900">User Administration</h1>
          <p className="mt-1 text-gray-600">Manage user access and roles.</p>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center">
          <UserCog className="h-5 w-5 text-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
        </div>
        <div className="p-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {isLoading ? (
            <div className="flex items-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading users...
            </div>
          ) : users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">
                          {u.firstName || u.lastName
                            ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                            : u.email}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <select
                          value={u.role}
                          onChange={(event) =>
                            updateMutation.mutate({
                              id: u.id,
                              role: event.target.value,
                            })
                          }
                          className="input text-sm"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(
                            u.isActive ? 'completed' : 'failed'
                          )}`}
                        >
                          {u.isActive ? 'active' : 'disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDateTime(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: u.id,
                              isActive: !u.isActive,
                            })
                          }
                          className="btn btn-outline btn-sm"
                          disabled={updateMutation.isPending}
                        >
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
