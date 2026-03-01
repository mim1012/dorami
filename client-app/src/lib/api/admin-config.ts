import { apiClient } from './client';

export type AdminConfigItem = Record<string, unknown>;
export type AdminConfigItems = AdminConfigItem[];

export interface AdminConfigSectionPayload {
  items: AdminConfigItems;
}

export interface GetAdminConfigSectionResponse {
  data: AdminConfigItems;
}

export async function getHomeFeaturedProducts() {
  const { data } = await apiClient.get<AdminConfigItems>('/admin/config/home-featured-products');
  return data;
}

export async function updateHomeFeaturedProducts(items: AdminConfigItems) {
  const { data } = await apiClient.put<AdminConfigItems>('/admin/config/home-featured-products', {
    items,
  });
  return data;
}

export async function getMarketingCampaigns() {
  const { data } = await apiClient.get<AdminConfigItems>('/admin/config/marketing-campaigns');
  return data;
}

export async function updateMarketingCampaigns(items: AdminConfigItems) {
  const { data } = await apiClient.put<AdminConfigItems>('/admin/config/marketing-campaigns', {
    items,
  });
  return data;
}

export async function getPaymentProviders() {
  const { data } = await apiClient.get<AdminConfigItems>('/admin/config/payment-providers');
  return data;
}

export async function updatePaymentProviders(items: AdminConfigItems) {
  const { data } = await apiClient.put<AdminConfigItems>('/admin/config/payment-providers', {
    items,
  });
  return data;
}
