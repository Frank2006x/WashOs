import axios from 'axios';
import { AuthStorage } from '../utils/authStorage';
import { LoginRequest, LoginResponse } from '../types/auth';

// Get API URL from environment variable
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3001';

console.log('Using API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AuthStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authService = {
  // Login user
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/login', data);
    return response.data;
  },

  // Logout user
  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
    await AuthStorage.clearAuth();
  },

  // Get current user profile
  async getProfile(): Promise<any> {
    const response = await api.get('/api/auth/profile');
    return response.data;
  },
};

export default api;
