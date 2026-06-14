import { apiClient } from './client';

export interface LLMConfigData {
  provider: string;
  model: string;
  base_url: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
}

export function getLLMConfig() {
  return apiClient.get<LLMConfigData>('/llm-config').then(r => r.data);
}

export function updateLLMConfig(data: Partial<LLMConfigData>) {
  return apiClient.put('/llm-config', data);
}
