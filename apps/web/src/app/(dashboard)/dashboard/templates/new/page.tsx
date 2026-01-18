'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';

export default function NewTemplatePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: '',
    description: '',
    category: 'sales_scenario',
    industry: 'general',
    scenariosText: '',
    recordCounts: {
      Account: 5,
      Contact: 15,
      Opportunity: 8,
      Task: 20,
      Event: 10,
      EmailMessage: 10,
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.templates.create({
        name: formState.name,
        description: formState.description || undefined,
        category: formState.category,
        industry: formState.industry,
        config: {
          defaultRecordCounts: formState.recordCounts,
          scenarios: formState.scenariosText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });

      router.push(`/dashboard/templates/${response.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create template');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Templates
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create Template</h1>
          <p className="mt-1 text-gray-600">
            Start from a baseline template and customize prompts next.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex items-center">
          <div className="p-2 bg-primary-100 rounded-lg">
            <FileText className="h-6 w-6 text-primary-600" />
          </div>
          <div className="ml-3">
            <h2 className="text-lg font-semibold text-gray-900">Template Details</h2>
            <p className="text-sm text-gray-500">Define the base configuration.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Name</label>
            <input
              type="text"
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, name: event.target.value }))
              }
              className="input mt-1"
              required
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              type="text"
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              type="text"
              value={formState.category}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, category: event.target.value }))
              }
              className="input mt-1"
            />
          </div>
          <div>
            <label className="label">Industry</label>
            <input
              type="text"
              value={formState.industry}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, industry: event.target.value }))
              }
              className="input mt-1"
            />
          </div>
        </div>

        <div>
          <label className="label">Default Record Counts</label>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-2">
            {Object.entries(formState.recordCounts).map(([objectType, value]) => (
              <div key={objectType}>
                <label className="text-xs text-gray-500">{objectType}</label>
                <input
                  type="number"
                  min="0"
                  value={value}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      recordCounts: {
                        ...prev.recordCounts,
                        [objectType]: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  className="input mt-1"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Scenarios (one per line)</label>
          <textarea
            rows={4}
            value={formState.scenariosText}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, scenariosText: event.target.value }))
            }
            className="input mt-1"
          />
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button type="submit" disabled={isLoading} className="btn btn-primary btn-md">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Template'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
