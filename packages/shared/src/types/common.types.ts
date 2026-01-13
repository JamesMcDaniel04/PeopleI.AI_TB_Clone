export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export enum DatasetStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  GENERATED = 'generated',
  INJECTING = 'injecting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum RecordStatus {
  GENERATED = 'generated',
  INJECTING = 'injecting',
  INJECTED = 'injected',
  FAILED = 'failed',
}

export enum EnvironmentStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Environment {
  id: string;
  userId: string;
  name: string;
  description?: string;
  salesforceInstanceUrl?: string;
  salesforceOrgId?: string;
  isSandbox: boolean;
  status: EnvironmentStatus;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dataset {
  id: string;
  userId: string;
  environmentId?: string;
  templateId?: string;
  name: string;
  description?: string;
  status: DatasetStatus;
  config: Record<string, any>;
  recordCounts: Record<string, number>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetRecord {
  id: string;
  datasetId: string;
  salesforceObject: string;
  localId: string;
  salesforceId?: string;
  data: Record<string, any>;
  status: RecordStatus;
  parentLocalId?: string;
  errorMessage?: string;
  injectedAt?: Date;
  createdAt: Date;
}
