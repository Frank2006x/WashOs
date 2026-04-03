import axios from "axios";
import { AuthStorage } from "../utils/authStorage";
import {
  AuthResponse,
  StaffSignInRequest,
  StaffSignUpRequest,
  StudentSignInRequest,
  StudentSignUpRequest,
} from "../types/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:3001";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    if (globalThis.atob) {
      return JSON.parse(globalThis.atob(padded));
    }

    // React Native fallback
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = padded.replace(/=+$/, "");
    let output = "";
    let bc = 0;
    let bs = 0;
    let buffer: number;
    for (let i = 0; i < str.length; i++) {
      buffer = chars.indexOf(str.charAt(i));
      if (buffer === -1) {
        continue;
      }
      bs = bc % 4 ? bs * 64 + buffer : buffer;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }

    return JSON.parse(output);
  } catch {
    return null;
  }
}

function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  return Date.now() >= Number(payload.exp) * 1000;
}

function subscribeTokenRefresh(callback: (token: string) => void): void {
  refreshSubscribers.push(callback);
}

function onRefreshed(newToken: string): void {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await AuthStorage.getRefreshToken();
  if (!refreshToken || isJwtExpired(refreshToken)) {
    throw new Error("Refresh token expired");
  }

  const response = await api.post(
    "/api/auth/refresh",
    { refresh_token: refreshToken },
    { headers: { Authorization: undefined } },
  );
  const accessToken: string =
    response.data?.access_token || response.data?.token;
  const nextRefreshToken: string = response.data?.refresh_token || refreshToken;

  if (!accessToken) {
    throw new Error("Invalid refresh response");
  }

  await AuthStorage.setToken(accessToken);
  await AuthStorage.setRefreshToken(nextRefreshToken);
  return accessToken;
}

api.interceptors.request.use(
  async (config) => {
    const token = await AuthStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest?.url?.includes("/api/auth/");

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isAuthRoute
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        subscribeTokenRefresh((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      onRefreshed(newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      await AuthStorage.clearAuth();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export const authService = {
  decodeJwtPayload,
  isJwtExpired,

  async studentSignIn(data: StudentSignInRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      "/api/auth/student/signin",
      data,
    );
    return response.data;
  },

  async staffSignIn(data: StaffSignInRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>(
      "/api/auth/staff/signin",
      data,
    );
    return response.data;
  },

  async studentSignUp(data: StudentSignUpRequest): Promise<void> {
    await api.post("/api/auth/student/signup", data);
  },

  async staffSignUp(data: StaffSignUpRequest): Promise<void> {
    await api.post("/api/auth/staff/signup", data);
  },

  async refresh(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token?: string; token?: string }> {
    const response = await api.post("/api/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  async logout(): Promise<void> {
    const refreshToken = await AuthStorage.getRefreshToken();
    try {
      await api.post("/api/auth/logout", {
        refresh_token: refreshToken || undefined,
      });
    } finally {
      await AuthStorage.clearAuth();
    }
  },

  // Called by AuthContext after storage is already cleared.
  // Accepts tokens explicitly so the auth middleware on /logout still receives a Bearer token.
  async logoutWithTokens(
    accessToken: string,
    refreshToken?: string | null,
  ): Promise<void> {
    await api.post(
      "/api/auth/logout",
      { refresh_token: refreshToken || undefined },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  },

  async setSessionFromAuth(response: AuthResponse): Promise<void> {
    const accessToken = response.access_token || response.token;
    await AuthStorage.setToken(accessToken);
    await AuthStorage.setRefreshToken(response.refresh_token);
    await AuthStorage.setUser(response);
    const sessionExpiry = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await AuthStorage.setSessionExpiry(sessionExpiry);
  },
};

// ─── Student API ────────────────────────────────────────────────────────────

export type BagResponse = {
  bag_id: string;
  student_id: string;
  reg_no: string;
  name: string;
  block?: string;
  qr_version: number;
  qr_payload: string; // JSON string ready to render as QR
  is_revoked: boolean;
  last_rotated_at?: string;
};

export const studentService = {
  // GET /api/student/me/bag — fetch bag only if it exists (returns null if none)
  async getMyBag(): Promise<BagResponse | null> {
    try {
      const res = await api.get<BagResponse>("/api/student/me/bag");
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  },

  // POST /api/student/me/bag/init — generate QR for the first time (idempotent)
  async initMyBag(): Promise<BagResponse> {
    const res = await api.post<BagResponse>("/api/student/me/bag/init");
    return res.data;
  },

  // POST /api/student/me/bag/rotate — rotates the QR version
  async rotateMyQR(): Promise<BagResponse> {
    const res = await api.post<BagResponse>("/api/student/me/bag/rotate");
    return res.data;
  },

  // PATCH /api/student/me/block — sets hostel block
  async updateMyBlock(block: string): Promise<void> {
    await api.patch("/api/student/me/block", { block });
  },
};

export default api;
