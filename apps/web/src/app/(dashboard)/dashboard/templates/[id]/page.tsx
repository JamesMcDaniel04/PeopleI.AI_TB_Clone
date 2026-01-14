'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Loader2, ArrowLeft, Save, FileText } from 'lucide-react';

type PromptForm = {
  salesforceObject: string;
  systemPrompt: string;
  userPromptTemplate: string;
  temperature?: number;
};

const OBJECT_TYPES = ['Account', 'Contact', 'Opportunity', 'Task', 'Event', 'EmailMessage'];

export default function TemplateDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const templateId = params.id as string;

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => api.templates.get(templateId).then((res) => res.data.data),
  });

  const [metaState, setMetaState] = useState({
    name: '',
    description: '',
    category: '',
    industry: '',
    scenariosText: '',
    recordCounts: {
      Account: 0,
      Contact: 0,
      Opportunity: 0,
      Task: 0,
      Event: 0,
    },
  });

  const [prompts, setPrompts] = useState<PromptForm[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;

    const defaultCounts = template.config?.defaultRecordCounts || {};
    const scenarios = template.config?.scenarios || [];

    setMetaState({
      name: template.name || '',
      description: template.description || '',
      category: template.category || '',
      industry: template.industry || '',
      scenariosText: scenarios.join('\n'),
      recordCounts: {
        Account: defaultCounts.Account || 0,
        Contact: defaultCounts.Contact || 0,
        Opportunity: defaultCounts.Opportunity || 0,
        Task: defaultCounts.Task || 0,
        Event: defaultCounts.Event || 0,
      },
    });

    const promptMap = new Map(
      (template.prompts || []).map((prompt: any) => [prompt.salesforceObject, prompt]),
    );

    const promptState = OBJECT_TYPES.map((objectType) => {
      const existing = promptMap.get(objectType);
      return {
        salesforceObject: objectType,
        systemPrompt: existing?.systemPrompt || '',
        userPromptTemplate: existing?.userPromptTemplate || '',
        temperature: existing?.temperature ?? 0.7,
      };
    });

    setPrompts(promptState);
  }, [template]);

  const updateTemplateMutation = useMutation({
    mutationFn: () =>
      api.templates.update(templateId, {
        name: metaState.name,
        description: metaState.description || undefined,
        category: metaState.category || undefined,
        industry: metaState.industry || undefined,
        config: {
          defaultRecordCounts: metaState.recordCounts,
          scenarios: metaState.scenariosText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(['template', templateId], response.data.data);
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setMetaError(null);
    },
    onError: (error: any) => {
      setMetaError(error.response?.data?.message || 'Failed to update template.');
    },
  });

  const updatePromptsMutation = useMutation({
    mutationFn: () =>
      api.templates.upsertPrompts(
        templateId,
        prompts.map((prompt) => ({
          ...prompt,
          temperature: Number(prompt.temperature ?? 0.7),
        })),
      ),
    onSuccess: (response) => {
      queryClient.setQueryData(['template', templateId], {
        ...template,
        prompts: response.data.data,
      });
      setPromptError(null);
    },
    onError: (error: any) => {
      setPromptError(error.response?.data?.message || 'Failed to update prompts.');
    },
  });

  const promptSections = useMemo(
    () =>
      prompts.map((prompt, index) => ({
        prompt,
        index,
      })),
    [prompts],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Template not found</p>
        <Link href="/dashboard/templates" className="text-primary-600 mt-2 inline-block">
          Back to Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/templates"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Templates
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{template.name}</h1>
          <p className="mt-1 text-gray-600">Manage template configuration and prompts.</p>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-primary-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Template Settings</h2>
          </div>
          <button
            onClick={() => updateTemplateMutation.mutate()}
            disabled={updateTemplateMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {updateTemplateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </button>
        </div>
        <div className="p-6 space-y-4">
          {metaError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{metaError}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={metaState.name}
                onChange={(event) =>
                  setMetaState((prev) => ({ ...prev, name: event.target.value }))
                }
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                type="text"
                value={metaState.description}
                onChange={(event) =>
                  setMetaState((prev) => ({ ...prev, description: event.target.value }))
                }
                className="input mt-1"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                type="text"
                value={metaState.category}
                onChange={(event) =>
                  setMetaState((prev) => ({ ...prev, category: event.target.value }))
                }
                className="input mt-1"
                placeholder="sales_scenario"
              />
            </div>
            <div>
              <label className="label">Industry</label>
              <input
                type="text"
                value={metaState.industry}
                onChange={(event) =>
                  setMetaState((prev) => ({ ...prev, industry: event.target.value }))
                }
                className="input mt-1"
                placeholder="technology"
              />
            </div>
          </div>

          <div>
            <label className="label">Default Record Counts</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
              {Object.entries(metaState.recordCounts).map(([objectType, value]) => (
                <div key={objectType}>
                  <label className="text-xs text-gray-500">{objectType}</label>
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={(event) =>
                      setMetaState((prev) => ({
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
              value={metaState.scenariosText}
              onChange={(event) =>
                setMetaState((prev) => ({ ...prev, scenariosText: event.target.value }))
              }
              className="input mt-1"
              placeholder="Enterprise software sales"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Library</h2>
          <button
            onClick={() => updatePromptsMutation.mutate()}
            disabled={updatePromptsMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {updatePromptsMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Prompts
          </button>
        </div>
        <div className="p-6 space-y-6">
          {promptError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{promptError}</p>
            </div>
          )}
          {promptSections.map(({ prompt, index }) => (
            <div key={prompt.salesforceObject} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  {prompt.salesforceObject} Prompt
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Temperature</span>
                  <input
                    type="number"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={prompt.temperature ?? 0.7}
                    onChange={(event) => {
                      const next = [...prompts];
                      next[index] = {
                        ...next[index],
                        temperature: Number(event.target.value),
                      };
                      setPrompts(next);
                    }}
                    className="input w-24 text-center"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">System Prompt</label>
                  <textarea
                    rows={6}
                    value={prompt.systemPrompt}
                    onChange={(event) => {
                      const next = [...prompts];
                      next[index] = { ...next[index], systemPrompt: event.target.value };
                      setPrompts(next);
                    }}
                    className="input mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="label">User Prompt Template</label>
                  <textarea
                    rows={6}
                    value={prompt.userPromptTemplate}
                    onChange={(event) => {
                      const next = [...prompts];
                      next[index] = {
                        ...next[index],
                        userPromptTemplate: event.target.value,
                      };
                      setPrompts(next);
                    }}
                    className="input mt-1 font-mono text-xs"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Available placeholders:{' '}
                  <span className="font-mono">{'{{count}}'}</span>,{' '}
                  <span className="font-mono">{'{{industry}}'}</span>,{' '}
                  <span className="font-mono">{'{{scenario}}'}</span>,{' '}
                  <span className="font-mono">{'{{objectType}}'}</span>,{' '}
                  <span className="font-mono">{'{{context}}'}</span>.
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
