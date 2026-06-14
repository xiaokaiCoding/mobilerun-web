import { apiClient } from './client';
import type { TestCase, Execution } from '../types';

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function getTestCases(
  params?: { page?: number; page_size?: number; status?: string },
): Promise<PagedResponse<TestCase>> {
  const { data } = await apiClient.get<PagedResponse<TestCase>>('/test-cases', { params });
  return data;
}

export async function createTestCase(
  payload: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TestCase> {
  const { data } = await apiClient.post<TestCase>('/test-cases', payload);
  return data;
}

export async function getTestCase(id: number | string): Promise<TestCase> {
  const { data } = await apiClient.get<TestCase>(`/test-cases/${id}`);
  return data;
}

export async function updateTestCase(
  id: number | string,
  payload: Partial<TestCase>,
): Promise<TestCase> {
  const { data } = await apiClient.put<TestCase>(`/test-cases/${id}`, payload);
  return data;
}

export async function deleteTestCase(id: number | string): Promise<void> {
  await apiClient.delete(`/test-cases/${id}`);
}

export async function getTestCaseHistory(id: number | string): Promise<Execution[]> {
  const { data } = await apiClient.get<Execution[]>(
    `/test-cases/${id}/history`,
  );
  return data;
}
