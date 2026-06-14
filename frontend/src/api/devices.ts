import { apiClient } from './client';
import type { Device } from '../types';

export async function getDevices(): Promise<Device[]> {
  const { data } = await apiClient.get<Device[]>('/devices');
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
