import apiClient from './client';
import type { AuthResponse, User } from '../../types';

export const authApi = {
  register: async (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ requiresVerification: boolean; email: string }> => {
    const res = await apiClient.post<{ requiresVerification: boolean; email: string }>('/auth/register', data);
    return res.data;
  },

  verifyRegistration: async (email: string, code: string): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/register/verify', { email, code });
    return res.data;
  },

  resendRegistrationOtp: async (email: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/register/resend-otp', { email });
    return res.data;
  },

  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', data);
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getMe: async (): Promise<{ user: User }> => {
    const res = await apiClient.get<{ user: User }>('/auth/me');
    return res.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
    return res.data;
  },

  verifyOtp: async (email: string, code: string): Promise<{ verified: boolean }> => {
    const res = await apiClient.post<{ verified: boolean }>('/auth/verify-otp', { email, code });
    return res.data;
  },

  resetPassword: async (email: string, code: string, newPassword: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', { email, code, newPassword });
    return res.data;
  },

  requestDeleteAccount: async (): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/delete-account/request');
    return res.data;
  },

  confirmDeleteAccount: async (code: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/delete-account/confirm', { code });
    return res.data;
  },
};
