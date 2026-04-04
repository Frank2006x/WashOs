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
  floor_no?: number;
  room_no?: number;
  qr_version: number;
  qr_payload: string; // JSON string ready to render as QR
  is_revoked: boolean;
  last_rotated_at?: string;
};

export type ActiveBookingResponse = {
  booking: Record<string, any> | null;
};

export type BookingRecord = {
  id: string;
  status: string;
  row_no?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BookingListResponse = {
  bookings: BookingRecord[];
};

export type BookingDetailResponse = {
  booking: Record<string, any>;
};

export type BookingEventsResponse = {
  events: Record<string, any>[];
};

export type QueryReplyRecord = {
  id: string;
  query_id: string;
  replied_by_user_id: string;
  message: string;
  created_at?: string;
};

export type QueryRecord = {
  id: string;
  booking_id: string;
  title: string;
  description: string;
  image_url?: string;
  service_rating?: number;
  handling_rating?: number;
  status: "open" | "acknowledged" | "resolved" | "closed";
  created_at?: string;
  updated_at?: string;
};

export type QueryListResponse = {
  queries: QueryRecord[];
};

export type QueryDetailResponse = {
  query: QueryRecord;
  replies: QueryReplyRecord[];
};

export type StaffRatingSummaryResponse = {
  avg_service_rating: number;
  avg_handling_rating: number;
  avg_overall_rating: number;
  rated_query_count: number;
};

function normalizeMaybeText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (value && typeof value === "object") {
    const maybe = value as {
      String?: unknown;
      string?: unknown;
      Valid?: unknown;
    };
    if (typeof maybe.String === "string") {
      const trimmed = maybe.String.trim();
      return trimmed || undefined;
    }
    if (typeof maybe.string === "string") {
      const trimmed = maybe.string.trim();
      return trimmed || undefined;
    }
  }

  return undefined;
}

function normalizeQueryRecord(input: any): QueryRecord {
  return {
    ...input,
    image_url: normalizeMaybeText(input?.image_url),
  } as QueryRecord;
}

function normalizeQueryListResponse(
  data: QueryListResponse,
): QueryListResponse {
  return {
    ...data,
    queries: (data?.queries || []).map((q) => normalizeQueryRecord(q)),
  };
}

function normalizeQueryDetailResponse(
  data: QueryDetailResponse,
): QueryDetailResponse {
  return {
    ...data,
    query: normalizeQueryRecord(data?.query),
    replies: data?.replies || [],
  };
}

export type IntakeScanResponse = {
  message: string;
  booking: {
    booking_id: string;
    status: string;
    bag_id: string;
    student_id: string;
    reg_no: string;
    name: string;
  };
};

export type NotificationRecord = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  payload?: Record<string, any> | string;
  read_at?: string;
  created_at?: string;
};

export type NotificationListResponse = {
  notifications: NotificationRecord[];
};

export type PushTokenRegisterRequest = {
  token: string;
  platform: "ios" | "android" | "web";
  device_name?: string;
};

export type MachineRecord = {
  id: string;
  code: string;
  machine_type: "washer" | "dryer";
  is_active: boolean;
};

export type MachineListResponse = {
  machines: MachineRecord[];
};

export type PickupVerifyResponse = {
  verified: boolean;
  booking: Record<string, any>;
};

export type StudentResidence = {
  block?: string;
  floor_no?: number;
  room_no?: number;
};

export type SlotWindow = {
  slot_window_id: string;
  date: string;
  start_at: string;
  end_at: string;
  allowed_start_floor: number;
  allowed_end_floor: number;
  capacity_limit: number;
  booked_count: number;
  remaining_capacity: number;
  eligible_via_override?: boolean;
};

export type AvailableSlotsResponse = {
  date: string;
  floor_no: number;
  daily_booking_limit: number;
  daily_booked_reservations: number;
  slots: SlotWindow[];
};

export type SlotReservationRecord = {
  reservation_id: string;
  slot_window_id: string;
  status: string;
  override_used: boolean;
  checked_in_at?: string;
  cancelled_at?: string;
  created_at?: string;
  date: string;
  start_at: string;
  end_at: string;
  allowed_start_floor: number;
  allowed_end_floor: number;
};

export type SlotBookingsResponse = {
  reservations: SlotReservationRecord[];
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

  // GET /api/student/me/location — returns block, floor and room
  async getMyResidence(): Promise<StudentResidence> {
    const res = await api.get<StudentResidence>("/api/student/me/location");
    return res.data;
  },

  // PATCH /api/student/me/location — updates floor and room
  async updateMyResidence(
    floorNo: number,
    roomNo: number,
  ): Promise<StudentResidence> {
    const res = await api.patch<StudentResidence>("/api/student/me/location", {
      floor_no: floorNo,
      room_no: roomNo,
    });
    return res.data;
  },

  // GET /api/bookings/my/active — returns latest active booking (or null)
  async getMyActiveBooking(): Promise<ActiveBookingResponse> {
    const res = await api.get<ActiveBookingResponse>("/api/bookings/my/active");
    return res.data;
  },

  // GET /api/bookings/my — paginated booking history for the authenticated student
  async listMyBookings(limit = 20, offset = 0): Promise<BookingListResponse> {
    const res = await api.get<BookingListResponse>("/api/bookings/my", {
      params: { limit, offset },
    });
    return res.data;
  },

  async getBookingByID(bookingID: string): Promise<BookingDetailResponse> {
    const res = await api.get<BookingDetailResponse>(
      `/api/bookings/${bookingID}`,
    );
    return res.data;
  },

  async getBookingEvents(bookingID: string): Promise<BookingEventsResponse> {
    const res = await api.get<BookingEventsResponse>(
      `/api/bookings/${bookingID}/events`,
    );
    return res.data;
  },

  async collectBooking(bookingID: string): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>(
      `/api/bookings/${bookingID}/collect`,
    );
    return { booking: res.data?.booking };
  },

  async pickupVerifyScan(qrCode: string): Promise<PickupVerifyResponse> {
    const res = await api.post<PickupVerifyResponse>(
      "/api/scan/pickup-verify",
      {
        qr_code: qrCode,
      },
    );
    return res.data;
  },

  async listUnreadNotifications(
    limit = 20,
    offset = 0,
  ): Promise<NotificationListResponse> {
    const res = await api.get<NotificationListResponse>(
      "/api/notifications/my/unread",
      {
        params: { limit, offset },
      },
    );
    return res.data;
  },

  async listNotifications(
    limit = 50,
    offset = 0,
  ): Promise<NotificationListResponse> {
    const res = await api.get<NotificationListResponse>(
      "/api/notifications/my",
      {
        params: { limit, offset },
      },
    );
    return res.data;
  },

  async markNotificationRead(notificationID: string): Promise<void> {
    await api.patch(`/api/notifications/${notificationID}/read`);
  },

  async registerPushToken(payload: PushTokenRegisterRequest): Promise<void> {
    await api.post("/api/notifications/push-token", payload);
  },

  async deactivatePushToken(token: string): Promise<void> {
    await api.delete("/api/notifications/push-token", {
      data: { token },
    });
  },

  async listAvailableSlots(date: string): Promise<AvailableSlotsResponse> {
    const res = await api.get<AvailableSlotsResponse>(
      "/api/student/me/slots/available",
      { params: { date } },
    );
    return res.data;
  },

  async bookSlot(slotWindowID: string): Promise<{
    reservation_id: string;
    status: string;
    slot: SlotWindow;
  }> {
    const res = await api.post<{
      reservation_id: string;
      status: string;
      slot: SlotWindow;
    }>("/api/student/me/slots/book", {
      slot_window_id: slotWindowID,
    });
    return res.data;
  },

  async listMySlotReservations(
    limit = 20,
    offset = 0,
  ): Promise<SlotBookingsResponse> {
    const res = await api.get<SlotBookingsResponse>(
      "/api/student/me/slots/bookings",
      {
        params: { limit, offset },
      },
    );
    return res.data;
  },

  async cancelSlotReservation(reservationID: string): Promise<void> {
    await api.post(`/api/student/me/slots/${reservationID}/cancel`);
  },

  async raiseQueryWithImage(payload: {
    booking_id: string;
    title: string;
    description: string;
    service_rating?: number;
    handling_rating?: number;
    image?: {
      uri: string;
      name?: string;
      type?: string;
    };
    image_url?: string;
  }): Promise<{ query: QueryRecord }> {
    if (!payload.image && !payload.image_url) {
      throw new Error("image or image_url is required");
    }

    if (payload.image) {
      const form = new FormData();
      form.append("booking_id", payload.booking_id);
      form.append("title", payload.title);
      form.append("description", payload.description);

      if (typeof payload.service_rating === "number") {
        form.append("service_rating", String(payload.service_rating));
      }
      if (typeof payload.handling_rating === "number") {
        form.append("handling_rating", String(payload.handling_rating));
      }

      form.append("image", {
        uri: payload.image.uri,
        name: payload.image.name || `query-${Date.now()}.jpg`,
        type: payload.image.type || "image/jpeg",
      } as any);

      const res = await api.post<{ query: QueryRecord }>(
        "/api/student/queries",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
    }

    const res = await api.post<{ query: QueryRecord }>("/api/student/queries", {
      booking_id: payload.booking_id,
      title: payload.title,
      description: payload.description,
      image_url: payload.image_url,
      service_rating: payload.service_rating,
      handling_rating: payload.handling_rating,
    });
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },

  async listMyQueries(limit = 20, offset = 0): Promise<QueryListResponse> {
    const res = await api.get<QueryListResponse>("/api/student/queries", {
      params: { limit, offset },
    });
    return normalizeQueryListResponse(res.data);
  },

  async getMyQuery(queryID: string): Promise<QueryDetailResponse> {
    const res = await api.get<QueryDetailResponse>(
      `/api/student/queries/${queryID}`,
    );
    return normalizeQueryDetailResponse(res.data);
  },

  async updateMyQueryRating(
    queryID: string,
    ratings: { service_rating?: number; handling_rating?: number },
  ): Promise<{ query: QueryRecord }> {
    const res = await api.patch<{ query: QueryRecord }>(
      `/api/student/queries/${queryID}/rating`,
      ratings,
    );
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },
};

export const staffService = {
  // POST /api/scan/intake — records bag intake after QR scan
  async intakeScan(qrCode: string): Promise<IntakeScanResponse> {
    const res = await api.post<IntakeScanResponse>("/api/scan/intake", {
      qr_code: qrCode,
    });
    return res.data;
  },

  async listMachines(type: "washer" | "dryer"): Promise<MachineListResponse> {
    const res = await api.get<MachineListResponse>("/api/machines", {
      params: { type },
    });
    return res.data;
  },

  async scanWashStart(
    qrCode: string,
    machineID: string,
  ): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>("/api/scan/wash-start", {
      qr_code: qrCode,
      machine_id: machineID,
    });
    return { booking: res.data?.booking };
  },

  async scanWashFinish(
    qrCode: string,
    machineID: string,
  ): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>("/api/scan/wash-finish", {
      qr_code: qrCode,
      machine_id: machineID,
    });
    return { booking: res.data?.booking };
  },

  async scanDryStart(
    qrCode: string,
    machineID: string,
  ): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>("/api/scan/dry-start", {
      qr_code: qrCode,
      machine_id: machineID,
    });
    return { booking: res.data?.booking };
  },

  async scanDryFinish(
    qrCode: string,
    machineID: string,
  ): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>("/api/scan/dry-finish", {
      qr_code: qrCode,
      machine_id: machineID,
    });
    return { booking: res.data?.booking };
  },

  async scanReady(
    qrCode: string,
    rowNo: string,
  ): Promise<BookingDetailResponse> {
    const res = await api.post<BookingDetailResponse>("/api/scan/ready", {
      qr_code: qrCode,
      row_no: rowNo,
    });
    return { booking: res.data?.booking };
  },

  async listProcessingBookings(
    limit = 20,
    offset = 0,
  ): Promise<BookingListResponse> {
    const res = await api.get<BookingListResponse>("/api/bookings/processing", {
      params: { limit, offset },
    });
    return res.data;
  },

  async listReadyBookings(
    limit = 20,
    offset = 0,
  ): Promise<BookingListResponse> {
    const res = await api.get<BookingListResponse>("/api/bookings/ready", {
      params: { limit, offset },
    });
    return res.data;
  },

  async getBookingByID(bookingID: string): Promise<BookingDetailResponse> {
    const res = await api.get<BookingDetailResponse>(
      `/api/bookings/${bookingID}`,
    );
    return res.data;
  },

  async getBookingEvents(bookingID: string): Promise<BookingEventsResponse> {
    const res = await api.get<BookingEventsResponse>(
      `/api/bookings/${bookingID}/events`,
    );
    return res.data;
  },

  async listUnreadNotifications(
    limit = 20,
    offset = 0,
  ): Promise<NotificationListResponse> {
    const res = await api.get<NotificationListResponse>(
      "/api/notifications/my/unread",
      {
        params: { limit, offset },
      },
    );
    return res.data;
  },

  async listNotifications(
    limit = 50,
    offset = 0,
  ): Promise<NotificationListResponse> {
    const res = await api.get<NotificationListResponse>(
      "/api/notifications/my",
      {
        params: { limit, offset },
      },
    );
    return res.data;
  },

  async markNotificationRead(notificationID: string): Promise<void> {
    await api.patch(`/api/notifications/${notificationID}/read`);
  },

  async listQueries(limit = 20, offset = 0): Promise<QueryListResponse> {
    const res = await api.get<QueryListResponse>("/api/staff/queries", {
      params: { limit, offset },
    });
    return normalizeQueryListResponse(res.data);
  },

  async getRatingSummary(): Promise<StaffRatingSummaryResponse> {
    const res = await api.get<StaffRatingSummaryResponse>(
      "/api/staff/queries/ratings/summary",
    );
    return res.data;
  },

  async getQuery(queryID: string): Promise<QueryDetailResponse> {
    const res = await api.get<QueryDetailResponse>(
      `/api/staff/queries/${queryID}`,
    );
    return normalizeQueryDetailResponse(res.data);
  },

  async acknowledgeQuery(queryID: string): Promise<{ query: QueryRecord }> {
    const res = await api.post<{ query: QueryRecord }>(
      `/api/staff/queries/${queryID}/acknowledge`,
    );
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },

  async replyQuery(
    queryID: string,
    message: string,
  ): Promise<{ query: QueryRecord; reply: QueryReplyRecord }> {
    const res = await api.post<{ query: QueryRecord; reply: QueryReplyRecord }>(
      `/api/staff/queries/${queryID}/reply`,
      { message },
    );
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },

  async resolveQuery(queryID: string): Promise<{ query: QueryRecord }> {
    const res = await api.post<{ query: QueryRecord }>(
      `/api/staff/queries/${queryID}/resolve`,
    );
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },

  async closeQuery(queryID: string): Promise<{ query: QueryRecord }> {
    const res = await api.post<{ query: QueryRecord }>(
      `/api/staff/queries/${queryID}/close`,
    );
    return { ...res.data, query: normalizeQueryRecord(res.data?.query) };
  },
};

export default api;
