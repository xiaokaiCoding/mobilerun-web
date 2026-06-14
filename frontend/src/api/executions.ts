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

export async function deleteExecution(id: string): Promise<void> {
  await apiClient.delete(`/executions/${id}`);
}

export async function getExecutionEvents(id: string): Promise<Array<{
  id?: number;
  executionId?: number;
  eventType: string;
  eventData?: Record<string, unknown>;
  seqNo?: number;
  createdAt?: string;
}>> {
  const { data } = await apiClient.get(`/executions/${id}/events`);
  // Backend returns: [{id, execution_id, event_type, event_data, seq_no, created_at}]
  return (data as Array<Record<string, unknown>>).map((item) => ({
    id: item.id as number,
    executionId: item.execution_id as number,
    eventType: item.event_type as string,
    eventData: (item.event_data as Record<string, unknown>) || {},
    seqNo: item.seq_no as number,
    createdAt: item.created_at as string,
  }));
}
