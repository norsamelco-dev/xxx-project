import { apiClient } from './client'
import type { SessionUser } from '../../types/pos'

export async function login(username: string, password: string) {
  const response = await apiClient.post<{ user: SessionUser; token?: string }>('/api/auth/login', {
    username,
    password,
    mobile: true,
  })

  return response.data
}

export async function fetchMe() {
  const response = await apiClient.get<{ user: SessionUser }>('/api/auth/me')
  return response.data.user
}

export async function logout() {
  await apiClient.post('/api/auth/logout')
}
