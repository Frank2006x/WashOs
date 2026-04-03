import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthContextType,
  StaffSignUpRequest,
  StudentSignUpRequest,
  User,
  UserRole,
  Student,
  LaundryStaff,
} from "../types/auth";
import { AuthStorage } from "../utils/authStorage";
import { authService } from "../services/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toErrorMessage(error: any): string {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.request) {
    return "Could not connect to the server. Check network/API URL.";
  }
  return error?.message || "Auth operation failed";
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Student | LaundryStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);

  const forceLogout = async () => {
    await AuthStorage.clearAuth();
    setUser(null);
    setProfile(null);
    setIsSessionValid(false);
    setLoading(false);
  };

  const checkAuth = useCallback(async () => {
    try {
      const token = await AuthStorage.getToken();
      const refreshToken = await AuthStorage.getRefreshToken();
      const sessionExpiry = await AuthStorage.getSessionExpiry();
      const savedUser = await AuthStorage.getUser();

      if (!token || !refreshToken || !sessionExpiry || !savedUser?.user) {
        await forceLogout();
        return;
      }

      if (new Date(sessionExpiry).getTime() <= Date.now()) {
        await forceLogout();
        return;
      }

      if (authService.isJwtExpired(token)) {
        if (authService.isJwtExpired(refreshToken)) {
          await forceLogout();
          return;
        }

        try {
          const refreshed = await authService.refresh(refreshToken);
          const nextAccessToken = refreshed.access_token || refreshed.token;
          if (!nextAccessToken) {
            await forceLogout();
            return;
          }

          await AuthStorage.setToken(nextAccessToken);
          if (refreshed.refresh_token) {
            await AuthStorage.setRefreshToken(refreshed.refresh_token);
          }
        } catch {
          await forceLogout();
          return;
        }
      }

      setUser(savedUser.user);
      setProfile(savedUser.profile || null);
      setIsSessionValid(true);
    } catch (error) {
      console.error("Auth check failed:", error);
      await forceLogout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isSessionValid) {
      return;
    }

    const timer = setInterval(async () => {
      const sessionExpiry = await AuthStorage.getSessionExpiry();
      if (!sessionExpiry || new Date(sessionExpiry).getTime() <= Date.now()) {
        await forceLogout();
      }
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [isSessionValid]);

  const login = async (
    role: UserRole,
    identifier: string,
    password: string,
  ) => {
    try {
      const response =
        role === "student"
          ? await authService.studentSignIn({
              email: identifier.toLowerCase().trim(),
              password,
            })
          : await authService.staffSignIn({
              phone: identifier.trim(),
              password,
            });

      await authService.setSessionFromAuth(response);
      setUser(response.user);
      setProfile(response.profile || null);
      setIsSessionValid(true);
    } catch (error: any) {
      throw new Error(toErrorMessage(error));
    }
  };

  const signup = async (
    role: UserRole,
    payload: StudentSignUpRequest | StaffSignUpRequest,
  ) => {
    try {
      if (role === "student") {
        await authService.studentSignUp(payload as StudentSignUpRequest);
      } else {
        await authService.staffSignUp(payload as StaffSignUpRequest);
      }
    } catch (error: any) {
      throw new Error(toErrorMessage(error));
    }
  };

  const logout = async () => {
    // Local-only logout: clear secure storage and reset auth state.
    await AuthStorage.clearAuth();
    setUser(null);
    setProfile(null);
    setIsSessionValid(false);
    setLoading(false);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      loading,
      login,
      signup,
      logout,
      isSessionValid,
      isAuthenticated: !!user && isSessionValid,
    }),
    [user, profile, loading, isSessionValid],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
