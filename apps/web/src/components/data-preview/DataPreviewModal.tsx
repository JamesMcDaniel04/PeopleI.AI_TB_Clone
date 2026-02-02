'use client';

import { useState, useMemo } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  ArrowRight,
  AlertTriangle,
  Check,
} from 'lucide-react';

interface DatasetRecord {
  id: string;
  localId: string;
  salesforceObject: string;
  data: Record<string, any>;
  parentLocalId?: string;
}

interface DataPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  records: DatasetRecord[];
  datasetName: string;
  environmentName?: string;
  isLoading?: boolean;
}

export function DataPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  records,
  datasetName,
  environmentName,
  isLoading,
}: DataPreviewModalProps) {
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set());
  const [selectedRecord, setSelectedRecord] = useState<DatasetRecord | null>(null);

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, DatasetRecord[]>();
    for (const record of records) {
      const type = record.salesforceObject;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(record);
    }
    return groups;
  }, [records]);

  const objectOrder = [
    'Account',
    'Contact',
    'Lead',
    'Campaign',
    'Opportunity',
    'Case',
    'CampaignMember',
    'Task',
    'Event',
    'EmailMessage',
  ];

  const sortedObjectTypes = useMemo(() => {
    const types = Array.from(groupedRecords.keys());
    return types.sort((a, b) => {
      const indexA = objectOrder.indexOf(a);
      const indexB = objectOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [groupedRecords]);

  const toggleExpanded = (objectType: string) => {
    const newExpanded = new Set(expandedObjects);
    if (newExpanded.has(objectType)) {
      newExpanded.delete(objectType);
    } else {
      newExpanded.add(objectType);
    }
    setExpandedObjects(newExpanded);
  };

  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getDisplayFields = (record: DatasetRecord): string[] => {
    const priorityFields: Record<string, string[]> = {
      Account: ['Name', 'Industry', 'Website', 'Phone'],
      Contact: ['FirstName', 'LastName', 'Email', 'Title'],
      Lead: ['FirstName', 'LastName', 'Company', 'Status'],
      Opportunity: ['Name', 'StageName', 'Amount', 'CloseDate'],
      Task: ['Subject', 'Status', 'ActivityDate', 'Priority'],
      Event: ['Subject', 'StartDateTime', 'EndDateTime', 'Location'],
      Case: ['Subject', 'Status', 'Priority', 'Origin'],
      Campaign: ['Name', 'Type', 'Status', 'StartDate'],
      CampaignMember: ['Status', 'HasResponded'],
      EmailMessage: ['Subject', 'FromAddress', 'ToAddress', 'MessageDate'],
    };

    const fields = priorityFields[record.salesforceObject] || Object.keys(record.data).slice(0, 4);
    return fields.filter((f) => !f.startsWith('_') && !f.endsWith('_localId'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preview Generated Data</h2>
            <p className="text-sm text-gray-500">
              Review data before injecting into{' '}
              {environmentName ? <span className="font-medium">{environmentName}</span> : 'Salesforce'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left panel - Object list */}
          <div className="w-1/3 border-r overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Database className="h-4 w-4 mr-2" />
                {records.length} total records
              </div>

              <div className="space-y-2">
                {sortedObjectTypes.map((objectType) => {
                  const objectRecords = groupedRecords.get(objectType) || [];
                  const isExpanded = expandedObjects.has(objectType);

                  return (
                    <div key={objectType} className="border rounded-lg">
                      <button
                        onClick={() => toggleExpanded(objectType)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                          )}
                          <span className="font-medium text-gray-900">{objectType}</span>
                        </div>
                        <span className="text-sm text-gray-500">{objectRecords.length}</span>
                      </button>

                      {isExpanded && (
                        <div className="border-t bg-gray-50 max-h-48 overflow-y-auto">
                          {objectRecords.slice(0, 20).map((record) => (
                            <button
                              key={record.localId}
                              onClick={() => setSelectedRecord(record)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 border-b last:border-b-0 ${
                                selectedRecord?.localId === record.localId
                                  ? 'bg-primary-50 text-primary-700'
                                  : 'text-gray-600'
                              }`}
                            >
                              {record.data.Name ||
                                record.data.Subject ||
                                `${record.data.FirstName || ''} ${record.data.LastName || ''}`.trim() ||
                                record.localId}
                            </button>
                          ))}
                          {objectRecords.length > 20 && (
                            <div className="px-4 py-2 text-xs text-gray-400">
                              + {objectRecords.length - 20} more records
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel - Record detail */}
          <div className="w-2/3 overflow-y-auto">
            {selectedRecord ? (
              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded">
                    {selectedRecord.salesforceObject}
                  </span>
                  <h3 className="text-lg font-medium text-gray-900 mt-2">
                    {selectedRecord.data.Name ||
                      selectedRecord.data.Subject ||
                      `${selectedRecord.data.FirstName || ''} ${selectedRecord.data.LastName || ''}`.trim() ||
                      selectedRecord.localId}
                  </h3>
                  <p className="text-sm text-gray-500">ID: {selectedRecord.localId}</p>
                </div>

                <div className="space-y-4">
                  {/* Priority fields */}
                  <div className="grid grid-cols-2 gap-4">
                    {getDisplayFields(selectedRecord).map((field) => (
                      <div key={field}>
                        <label className="text-xs font-medium text-gray-500 uppercase">
                          {field}
                        </label>
                        <p className="text-sm text-gray-900">
                          {formatFieldValue(selectedRecord.data[field])}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* All fields */}
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">All Fields</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {Object.entries(selectedRecord.data)
                            .filter(([key]) => !key.startsWith('_'))
                            .map(([key, value]) => (
                              <tr key={key} className="border-b last:border-b-0">
                                <td className="py-2 pr-4 text-gray-500 font-mono text-xs">
                                  {key}
                                </td>
                                <td className="py-2 text-gray-900">
                                  {formatFieldValue(value)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Relationships */}
                  {selectedRecord.parentLocalId && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center text-sm text-blue-700">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Parent: {selectedRecord.parentLocalId}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a record to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex items-center text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4 mr-2" />
            This will create {records.length} records in Salesforce
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary btn-md">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="btn btn-primary btn-md"
            >
              {isLoading ? (
                <>Processing...</>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Inject Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
