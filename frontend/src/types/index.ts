export interface Device {
  id: number;
  serial: string;
  name: string;
  model: string;
  platform: 'android' | 'ios' | 'harmony';
  status: 'online' | 'offline' | 'busy';
  lastSeenAt: string;
  createdAt: string;
}

export interface LLMConfig {
  id: number;
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
  id: number;
  name: string;
  description: string;
  goal: string;
  maxSteps: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: number;
  test_case_id: number;
  device_id: number;
  llm_config_id: number | null;
  status: 'pending' | 'running' | 'success' | 'failed' | 'stopped';
  goal: string;
  result?: string;
  screenshot?: string;
  trajectory_path?: string;
  steps_taken: number;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface ExecutionEvent {
  id: string | number;
  executionId: string | number;
  eventType: string;
  eventData: Record<string, unknown>;
  seqNo: number;
  createdAt: string;
}
