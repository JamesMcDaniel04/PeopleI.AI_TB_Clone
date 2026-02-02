'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export interface JobProgressEvent {
  jobId: string;
  datasetId: string;
  type: 'generation' | 'injection';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  currentObject?: string;
  recordCounts?: Record<string, number>;
  error?: string;
}

export interface SnapshotEvent {
  snapshotId: string;
  environmentId: string;
  status: 'creating' | 'ready' | 'restoring' | 'failed';
  message?: string;
  progress?: number;
}

export interface NotificationEvent {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  onJobProgress?: (event: JobProgressEvent) => void;
  onJobCompleted?: (event: JobProgressEvent) => void;
  onJobFailed?: (event: JobProgressEvent) => void;
  onSnapshotUpdate?: (event: SnapshotEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { accessToken } = useAuthStore();

  const connect = useCallback(() => {
    if (!accessToken) {
      setConnectionError('No access token available');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(`${WS_URL}/events`, {
      auth: { token: accessToken },
      query: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      console.log('WebSocket connected');
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      setConnectionError(error.message);
      console.error('WebSocket connection error:', error);
    });

    // Job events
    socket.on('job:progress', (event: JobProgressEvent) => {
      options.onJobProgress?.(event);
    });

    socket.on('job:completed', (event: JobProgressEvent) => {
      options.onJobCompleted?.(event);
    });

    socket.on('job:failed', (event: JobProgressEvent) => {
      options.onJobFailed?.(event);
    });

    // Snapshot events
    socket.on('snapshot:update', (event: SnapshotEvent) => {
      options.onSnapshotUpdate?.(event);
    });

    // Notifications
    socket.on('notification', (event: NotificationEvent) => {
      options.onNotification?.(event);
    });

    socketRef.current = socket;
  }, [accessToken, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribeToDataset = useCallback((datasetId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:dataset', { datasetId });
    }
  }, []);

  const unsubscribeFromDataset = useCallback((datasetId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:dataset', { datasetId });
    }
  }, []);

  const subscribeToEnvironment = useCallback((environmentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:environment', { environmentId });
    }
  }, []);

  const unsubscribeFromEnvironment = useCallback((environmentId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:environment', { environmentId });
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect !== false && accessToken) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [accessToken, options.autoConnect, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    subscribeToDataset,
    unsubscribeFromDataset,
    subscribeToEnvironment,
    unsubscribeFromEnvironment,
  };
}

/**
 * Hook for subscribing to a specific dataset's job progress
 */
export function useDatasetProgress(datasetId: string | null) {
  const [progress, setProgress] = useState<JobProgressEvent | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subscribeToDataset, unsubscribeFromDataset, isConnected } = useWebSocket({
    autoConnect: true,
    onJobProgress: (event) => {
      if (event.datasetId === datasetId) {
        setProgress(event);
      }
    },
    onJobCompleted: (event) => {
      if (event.datasetId === datasetId) {
        setProgress(event);
        setIsComplete(true);
      }
    },
    onJobFailed: (event) => {
      if (event.datasetId === datasetId) {
        setProgress(event);
        setError(event.error || 'Job failed');
      }
    },
  });

  useEffect(() => {
    if (datasetId && isConnected) {
      subscribeToDataset(datasetId);
      return () => {
        unsubscribeFromDataset(datasetId);
      };
    }
  }, [datasetId, isConnected, subscribeToDataset, unsubscribeFromDataset]);

  const reset = useCallback(() => {
    setProgress(null);
    setIsComplete(false);
    setError(null);
  }, []);

  return {
    progress,
    isComplete,
    error,
    isConnected,
    reset,
  };
}
