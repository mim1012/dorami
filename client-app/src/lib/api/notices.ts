import { apiClient } from './client';

export interface Notice {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  category: 'IMPORTANT' | 'GENERAL';
  createdAt: string;
  updatedAt: string;
}

export async function getActiveNotices(): Promise<Notice[]> {
  const response = await apiClient.get<Notice[]>('/notices');
  return response.data;
}

export async function getAdminNotices(): Promise<Notice[]> {
  const response = await apiClient.get<Notice[]>('/notices/admin');
  return response.data;
}

export async function createNotice(dto: {
  title: string;
  content: string;
  category: 'IMPORTANT' | 'GENERAL';
  isActive?: boolean;
}): Promise<Notice> {
  const response = await apiClient.post<Notice>('/notices/admin', dto);
  return response.data;
}

export async function updateNotice(
  id: string,
  dto: Partial<{
    title: string;
    content: string;
    category: 'IMPORTANT' | 'GENERAL';
    isActive: boolean;
  }>,
): Promise<Notice> {
  const response = await apiClient.put<Notice>(`/notices/admin/${id}`, dto);
  return response.data;
}

export async function deleteNotice(id: string): Promise<void> {
  await apiClient.delete(`/notices/admin/${id}`);
}
