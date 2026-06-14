import { apiClient } from './client';
import type { LLMConfig } from '../types';

export async function getLLMConfigs(): Promise<LLMConfig[]> {
  const { data } = await apiClient.get<LLMConfig[]>('/llm-configs');
  return data;
}

export async function getActiveLLMConfig(): Promise<LLMConfig> {
  const { data } = await apiClient.get<LLMConfig>('/llm-configs/active');
  return data;
}

export async function createLLMConfig(
  payload: Omit<LLMConfig, 'id' | 'createdAt' | 'isActive'>,
): Promise<LLMConfig> {
  const { data } = await apiClient.post<LLMConfig>('/llm-configs', payload);
  return data;
}

export async function updateLLMConfig(
  id: string,
  payload: Partial<LLMConfig>,
): Promise<LLMConfig> {
  const { data } = await apiClient.put<LLMConfig>(`/llm-configs/${id}`, payload);
  return data;
}

export async function activateLLMConfig(id: string): Promise<LLMConfig> {
  const { data } = await apiClient.put<LLMConfig>(
    `/llm-configs/${id}/activate`,
  );
  return data;
}

export async function deleteLLMConfig(id: string): Promise<void> {
  await apiClient.delete(`/llm-configs/${id}`);
}
