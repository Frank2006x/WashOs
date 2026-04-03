export type UserRole = 'student' | 'warden' | 'staff' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  room_id: string;
  created_at: string;
}

export interface Warden {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  block_id: string;
  created_at: string;
}

export interface LaundryStaff {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  laundry_service_id: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  profile?: Student | Warden | LaundryStaff;
}

export interface AuthContextType {
  user: User | null;
  profile: Student | Warden | LaundryStaff | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
