import { apiClient } from './client';
import type { Device } from '../types';

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function getDevices(
  params?: { page?: number; page_size?: number },
): Promise<PagedResponse<Device>> {
  const { data } = await apiClient.get<PagedResponse<Device>>('/devices', { params });
  return data;
}

export async function scanDevices(): Promise<Device[]> {
  const { data } = await apiClient.post<Device[]>('/devices/scan');
  return data;
}

export async function registerDevice(payload: { serial: string; name?: string; model?: string; platform?: string }): Promise<Device> {
  const { data } = await apiClient.post<Device>('/devices/register', payload);
  return data;
}

export async function getDevice(id: string): Promise<Device> {
  const { data } = await apiClient.get<Device>(`/devices/${id}`);
  return data;
}

export async function updateDevice(
  id: string,
  payload: Partial<Device>,
): Promise<Device> {
  const { data } = await apiClient.put<Device>(`/devices/${id}`, payload);
  return data;
}
