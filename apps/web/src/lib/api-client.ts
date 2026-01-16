import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Auth
  auth: {
    register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
      apiClient.post('/auth/register', data),
    login: (data: { email: string; password: string }) =>
      apiClient.post('/auth/login', data),
    refresh: (refreshToken: string) =>
      apiClient.post('/auth/refresh', { refreshToken }),
    me: () => apiClient.get('/auth/me'),
  },

  // Users
  users: {
    getProfile: () => apiClient.get('/users/me'),
    updateProfile: (data: { firstName?: string; lastName?: string }) =>
      apiClient.patch('/users/me', data),
  },

  // Environments
  environments: {
    list: () => apiClient.get('/environments'),
    get: (id: string) => apiClient.get(`/environments/${id}`),
    create: (data: { name: string; description?: string; isSandbox?: boolean }) =>
      apiClient.post('/environments', data),
    update: (id: string, data: { name?: string; description?: string }) =>
      apiClient.patch(`/environments/${id}`, data),
    delete: (id: string) => apiClient.delete(`/environments/${id}`),
    getAuthUrl: (id: string, isSandbox?: boolean) =>
      apiClient.get(`/environments/${id}/auth-url`, { params: { isSandbox } }),
    handleCallback: (id: string, code: string, isSandbox?: boolean, state?: string) =>
      apiClient.post(`/environments/${id}/callback`, { code, isSandbox, state }),
    disconnect: (id: string) => apiClient.post(`/environments/${id}/disconnect`),
    getStatus: (id: string) => apiClient.get(`/environments/${id}/status`),
  },

  // Templates
  templates: {
    list: () => apiClient.get('/templates'),
    get: (id: string) => apiClient.get(`/templates/${id}`),
    create: (data: {
      name: string;
      description?: string;
      category?: string;
      industry?: string;
      config?: Record<string, any>;
    }) => apiClient.post('/templates', data),
    update: (id: string, data: {
      name?: string;
      description?: string;
      category?: string;
      industry?: string;
      config?: Record<string, any>;
    }) => apiClient.patch(`/templates/${id}`, data),
    upsertPrompts: (id: string, prompts: Array<{
      salesforceObject: string;
      systemPrompt: string;
      userPromptTemplate: string;
      temperature?: number;
      outputSchema?: Record<string, any>;
    }>) => apiClient.put(`/templates/${id}/prompts`, { prompts }),
  },

  // Generator
  generator: {
    start: (data: {
      name: string;
      templateId: string;
      environmentId?: string;
      recordCounts: Record<string, number>;
      scenario?: string;
      industry?: string;
    }) => apiClient.post('/generate', data),
    getStatus: (datasetId: string) => apiClient.get(`/generate/${datasetId}/status`),
    inject: (datasetId: string) => apiClient.post(`/generate/${datasetId}/inject`),
    generateEmails: (datasetId: string, opportunityLocalId: string, emailCount?: number) =>
      apiClient.post(`/generate/${datasetId}/emails/${opportunityLocalId}`, { emailCount }),
    generateCall: (datasetId: string, opportunityLocalId: string, callType?: string, duration?: number) =>
      apiClient.post(`/generate/${datasetId}/calls/${opportunityLocalId}`, { callType, duration }),
  },

  // Datasets
  datasets: {
    list: () => apiClient.get('/datasets'),
    get: (id: string) => apiClient.get(`/datasets/${id}`),
    getRecords: (id: string, objectType?: string) =>
      apiClient.get(`/datasets/${id}/records`, { params: { objectType } }),
    delete: (id: string) => apiClient.delete(`/datasets/${id}`),
    cleanup: (id: string) => apiClient.post(`/datasets/${id}/cleanup`),
    export: (id: string) => apiClient.get(`/datasets/${id}/export`),
  },

  // Salesforce
  salesforce: {
    describe: (environmentId: string, objectType: string) =>
      apiClient.get(`/salesforce/${environmentId}/describe/${objectType}`),
    query: (environmentId: string, soql: string) =>
      apiClient.get(`/salesforce/${environmentId}/query`, { params: { q: soql } }),
    getRecord: (environmentId: string, objectType: string, recordId: string) =>
      apiClient.get(`/salesforce/${environmentId}/records/${objectType}/${recordId}`),
  },

  // Jobs
  jobs: {
    list: (params?: { datasetId?: string; type?: string; status?: string; limit?: number }) =>
      apiClient.get('/jobs', { params }),
    get: (id: string) => apiClient.get(`/jobs/${id}`),
    cancel: (id: string) => apiClient.post(`/jobs/${id}/cancel`),
    retry: (id: string) => apiClient.post(`/jobs/${id}/retry`),
  },
};
