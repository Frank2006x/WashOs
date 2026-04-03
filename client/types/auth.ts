export type UserRole = "student" | "laundry_staff";

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
  reg_no: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface LaundryStaff {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  laundry_service_id: string;
  created_at: string;
  updated_at: string;
}

export interface StudentSignInRequest {
  email: string;
  password: string;
}

export interface StaffSignInRequest {
  phone: string;
  password: string;
}

export interface StudentSignUpRequest {
  name: string;
  reg_no: string;
  email: string;
  password: string;
}

export interface StaffSignUpRequest {
  name: string;
  phone: string;
  password: string;
  email?: string;
}

export interface AuthResponse {
  token: string;
  access_token: string;
  refresh_token: string;
  user: User;
  profile?: Student | LaundryStaff;
}

export interface AuthContextType {
  user: User | null;
  profile: Student | LaundryStaff | null;
  loading: boolean;
  login: (
    role: UserRole,
    identifier: string,
    password: string,
  ) => Promise<void>;
  signup: (
    role: UserRole,
    payload: StudentSignUpRequest | StaffSignUpRequest,
  ) => Promise<void>;
  logout: () => Promise<void>;
  isSessionValid: boolean;
  isAuthenticated: boolean;
}
