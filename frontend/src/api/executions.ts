import { apiClient } from './client';
import type { Execution } from '../types';

export interface CreateExecutionPayload {
  device_id: number;
  test_case_id: number;
  llm_config_id?: number | null;
}

export async function getExecutions(
  params?: Record<string, string>,
): Promise<Execution[]> {
  const { data } = await apiClient.get<Execution[]>('/executions', { params });
  return data;
}

export async function createExecution(
  payload: CreateExecutionPayload,
): Promise<Execution> {
  const { data } = await apiClient.post<Execution>('/executions', payload);
  return data;
}

export async function getExecution(id: string): Promise<Execution> {
  const { data } = await apiClient.get<Execution>(`/executions/${id}`);
  return data;
}

export async function stopExecution(id: string): Promise<void> {
  await apiClient.post(`/executions/${id}/stop`);
}
