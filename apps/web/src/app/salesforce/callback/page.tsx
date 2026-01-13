'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

interface OAuthState {
  environmentId: string;
  isSandbox?: boolean;
}

export default function SalesforceCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Connecting your Salesforce org...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setError(searchParams.get('error_description') || 'Salesforce authorization failed.');
      return;
    }

    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    if (!code || !stateParam) {
      setError('Missing authorization details. Please try connecting again.');
      return;
    }

    let state: OAuthState | null = null;
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      setError('Invalid authorization state. Please try connecting again.');
      return;
    }

    if (!state?.environmentId) {
      setError('Missing environment reference. Please try connecting again.');
      return;
    }

    api.environments
      .handleCallback(state.environmentId, code, state.isSandbox)
      .then(() => {
        setMessage('Salesforce connected. Redirecting...');
        router.replace(`/dashboard/environments/${state!.environmentId}`);
      })
      .catch((err) => {
        const apiMessage = err?.response?.data?.message || 'Failed to connect Salesforce.';
        setError(apiMessage);
      });
  }, [router, searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card p-8 max-w-md w-full text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Connection Failed</h1>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <Link href="/dashboard/environments" className="btn btn-primary btn-md mt-6">
              Back to Environments
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
            <p className="mt-4 text-sm text-gray-600">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
