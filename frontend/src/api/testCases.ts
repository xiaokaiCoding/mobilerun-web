import { apiClient } from './client';
import type { TestCase, Execution } from '../types';

export async function getTestCases(): Promise<TestCase[]> {
  const { data } = await apiClient.get<TestCase[]>('/test-cases');
  return data;
}

export async function createTestCase(
  payload: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TestCase> {
  const { data } = await apiClient.post<TestCase>('/test-cases', payload);
  return data;
}

export async function getTestCase(id: string): Promise<TestCase> {
  const { data } = await apiClient.get<TestCase>(`/test-cases/${id}`);
  return data;
}

export async function updateTestCase(
  id: string,
  payload: Partial<TestCase>,
): Promise<TestCase> {
  const { data } = await apiClient.put<TestCase>(`/test-cases/${id}`, payload);
  return data;
}

export async function deleteTestCase(id: string): Promise<void> {
  await apiClient.delete(`/test-cases/${id}`);
}

export async function getTestCaseHistory(id: string): Promise<Execution[]> {
  const { data } = await apiClient.get<Execution[]>(
    `/test-cases/${id}/history`,
  );
  return data;
}
