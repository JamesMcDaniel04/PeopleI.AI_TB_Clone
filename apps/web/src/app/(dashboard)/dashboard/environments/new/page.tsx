'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import { ArrowLeft, Loader2, Cloud } from 'lucide-react';
import Link from 'next/link';

const createEnvSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  isSandbox: z.boolean().default(true),
});

type CreateEnvForm = z.infer<typeof createEnvSchema>;

export default function NewEnvironmentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateEnvForm>({
    resolver: zodResolver(createEnvSchema),
    defaultValues: {
      isSandbox: true,
    },
  });

  const onSubmit = async (data: CreateEnvForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.environments.create(data);
      const environment = response.data.data;

      // Redirect to environment page to connect Salesforce
      router.push(`/dashboard/environments/${environment.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create environment');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/environments"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Environments
        </Link>
      </div>

      <div className="card">
        <div className="p-6 border-b">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Cloud className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-gray-900">
                Add Salesforce Environment
              </h1>
              <p className="text-sm text-gray-500">
                Create a new environment to connect your Salesforce org
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="label">
              Environment Name
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="input mt-1"
              placeholder="e.g., Production Org, Demo Sandbox"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description (optional)
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className="input mt-1"
              placeholder="Brief description of this environment"
            />
          </div>

          <div>
            <label className="label mb-3 block">Environment Type</label>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="true"
                  {...register('isSandbox')}
                  defaultChecked
                  className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="ml-3">
                  <span className="font-medium text-gray-900">Sandbox</span>
                  <span className="text-sm text-gray-500 ml-2">
                    (Recommended for testing)
                  </span>
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="false"
                  {...register('isSandbox')}
                  className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="ml-3">
                  <span className="font-medium text-gray-900">Production</span>
                  <span className="text-sm text-gray-500 ml-2">
                    (Use with caution)
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end gap-3">
            <Link
              href="/dashboard/environments"
              className="btn btn-secondary btn-md"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Environment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
