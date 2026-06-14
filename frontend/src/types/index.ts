export interface Device {
  id: string;
  serial: string;
  name: string;
  model: string;
  platform: 'android' | 'ios' | 'harmony';
  status: 'online' | 'offline' | 'busy';
  lastSeenAt: string;
  createdAt: string;
}

export interface LLMConfig {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  goal: string;
  maxSteps: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  testCaseId: string;
  deviceId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'stopped';
  goal: string;
  result?: string;
  stepsTaken: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface ExecutionEvent {
  id: string | number;
  executionId: string | number;
  eventType: string;
  eventData: Record<string, unknown>;
  seqNo: number;
  createdAt: string;
}
