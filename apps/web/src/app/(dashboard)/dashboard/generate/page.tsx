'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Cloud,
  FileText,
  Settings,
  CheckCircle,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

interface GenerationConfig {
  name: string;
  templateId: string;
  environmentId?: string;
  recordCounts: {
    Account: number;
    Contact: number;
    Opportunity: number;
    Task: number;
    Event: number;
  };
  scenario?: string;
  industry?: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [config, setConfig] = useState<Partial<GenerationConfig>>({
    recordCounts: {
      Account: 5,
      Contact: 15,
      Opportunity: 8,
      Task: 20,
      Event: 10,
    },
  });

  useEffect(() => {
    const templateId = searchParams.get('templateId');
    if (templateId && !config.templateId) {
      setConfig((prev) => ({ ...prev, templateId }));
    }
  }, [config.templateId, searchParams]);

  const { data: environments } = useQuery({
    queryKey: ['environments'],
    queryFn: () => api.environments.list().then((res) => res.data.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.templates.list().then((res) => res.data.data),
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenerationConfig) => api.generator.start(data),
    onSuccess: (response) => {
      const { datasetId } = response.data.data;
      router.push(`/dashboard/datasets/${datasetId}`);
    },
  });

  const connectedEnvs = environments?.filter((e: any) => e.status === 'connected') || [];
  const selectedTemplate = templates?.find((t: any) => t.id === config.templateId);

  const handleNext = () => {
    if (step < 4) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = () => {
    if (!config.name || !config.templateId) return;
    generateMutation.mutate(config as GenerationConfig);
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!config.templateId;
      case 2:
        return true; // Environment is optional
      case 3:
        return Object.values(config.recordCounts || {}).some((v) => v > 0);
      case 4:
        return !!config.name;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Generate Demo Data</h1>
        <p className="mt-1 text-gray-600">
          Create realistic synthetic sales data for your Salesforce demos
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  step > s
                    ? 'bg-green-500 text-white'
                    : step === s
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > s ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-full h-1 mx-2 ${
                    step > s ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                  style={{ width: '80px' }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>Template</span>
          <span>Environment</span>
          <span>Configure</span>
          <span>Review</span>
        </div>
      </div>

      <div className="card">
        {/* Step 1: Select Template */}
        {step === 1 && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <FileText className="h-6 w-6 text-primary-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold">Select a Template</h2>
                <p className="text-sm text-gray-500">
                  Choose a data template for your scenario
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates?.map((template: any) => (
                <div
                  key={template.id}
                  onClick={() => setConfig({ ...config, templateId: template.id })}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    config.templateId === template.id
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                      : 'hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                  <div className="mt-2 flex items-center text-xs text-gray-400">
                    <span className="capitalize">{template.industry}</span>
                    <span className="mx-2">-</span>
                    <span className="capitalize">{template.category?.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Environment */}
        {step === 2 && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <Cloud className="h-6 w-6 text-primary-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold">Select Environment (Optional)</h2>
                <p className="text-sm text-gray-500">
                  Choose a Salesforce org to inject data into
                </p>
              </div>
            </div>

            {connectedEnvs.length === 0 ? (
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-600">No connected Salesforce environments</p>
                <p className="text-sm text-gray-500 mt-1">
                  You can generate data without connecting to Salesforce and inject it later
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => setConfig({ ...config, environmentId: undefined })}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    !config.environmentId
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                      : 'hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <h3 className="font-medium text-gray-900">Generate Only</h3>
                  <p className="text-sm text-gray-500">
                    Create data without injecting into Salesforce
                  </p>
                </div>
                {connectedEnvs.map((env: any) => (
                  <div
                    key={env.id}
                    onClick={() => setConfig({ ...config, environmentId: env.id })}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      config.environmentId === env.id
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                        : 'hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{env.name}</h3>
                      <span className="text-xs text-green-600">Connected</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {env.salesforceInstanceUrl?.replace('https://', '')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configure Record Counts */}
        {step === 3 && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <Settings className="h-6 w-6 text-primary-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold">Configure Data Volume</h2>
                <p className="text-sm text-gray-500">
                  Set the number of records to generate for each object
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(['Account', 'Contact', 'Opportunity', 'Task', 'Event'] as const).map(
                (objectType) => (
                  <div
                    key={objectType}
                    className="flex items-center justify-between py-3 border-b"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{objectType}s</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {getObjectDescription(objectType)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={objectType === 'Account' ? 100 : 500}
                      value={config.recordCounts?.[objectType] || 0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          recordCounts: {
                            ...config.recordCounts!,
                            [objectType]: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="input w-24 text-center"
                    />
                  </div>
                )
              )}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Tip:</strong> Use the template defaults for a balanced dataset.
                {selectedTemplate && (
                  <button
                    onClick={() =>
                      setConfig({
                        ...config,
                        recordCounts: selectedTemplate.config?.defaultRecordCounts || config.recordCounts,
                      })
                    }
                    className="ml-2 text-primary-600 hover:text-primary-700"
                  >
                    Apply defaults
                  </button>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Review & Generate */}
        {step === 4 && (
          <div className="p-6">
            <div className="flex items-center mb-6">
              <Sparkles className="h-6 w-6 text-primary-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold">Review & Generate</h2>
                <p className="text-sm text-gray-500">
                  Confirm your settings and start generation
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="label">Dataset Name</label>
              <input
                type="text"
                value={config.name || ''}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="input mt-1"
                placeholder="e.g., Q1 Demo Data, Tech Industry Scenario"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Template</span>
                <span className="font-medium">{selectedTemplate?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Environment</span>
                <span className="font-medium">
                  {config.environmentId
                    ? connectedEnvs.find((e: any) => e.id === config.environmentId)?.name
                    : 'Generate only'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Records</span>
                <span className="font-medium">
                  {Object.values(config.recordCounts || {}).reduce((a, b) => a + b, 0)}
                </span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-gray-600 text-sm">Records breakdown:</span>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  {Object.entries(config.recordCounts || {})
                    .filter(([_, count]) => count > 0)
                    .map(([obj, count]) => (
                      <span key={obj} className="text-gray-500">
                        {count} {obj}s
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="btn btn-secondary btn-md"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn btn-primary btn-md"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || generateMutation.isPending}
              className="btn btn-primary btn-md"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Data
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getObjectDescription(objectType: string): string {
  const descriptions: Record<string, string> = {
    Account: 'Companies',
    Contact: 'People at companies',
    Opportunity: 'Deals/Sales',
    Task: 'Activities & calls',
    Event: 'Meetings',
  };
  return descriptions[objectType] || '';
}
