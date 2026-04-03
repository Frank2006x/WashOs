import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_data";
const SESSION_EXPIRES_AT_KEY = "session_expires_at";

export const AuthStorage = {
  // Store JWT token
  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (error) {
      console.error("Error saving token:", error);
      // Fallback for environment issues
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error("Error saving refresh token:", error);
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error("Error getting refresh token:", error);
      return null;
    }
  },

  // Get JWT token
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return await AsyncStorage.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error("Error getting token:", error);
      // Fallback
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
  },

  // Store user data
  async setUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error("Error saving user data:", error);
    }
  },

  async setSessionExpiry(expiresAtIso: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_EXPIRES_AT_KEY, expiresAtIso);
    } catch (error) {
      console.error("Error saving session expiry:", error);
    }
  },

  async getSessionExpiry(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SESSION_EXPIRES_AT_KEY);
    } catch (error) {
      console.error("Error getting session expiry:", error);
      return null;
    }
  },

  // Get user data
  async getUser(): Promise<any | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Error getting user data:", error);
      return null;
    }
  },

  // Clear all auth data
  async clearAuth(): Promise<void> {
    try {
      if (Platform.OS !== "web") {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
      await AsyncStorage.multiRemove([
        TOKEN_KEY,
        REFRESH_TOKEN_KEY,
        USER_KEY,
        SESSION_EXPIRES_AT_KEY,
      ]);
    } catch (error) {
      console.error("Error clearing auth data:", error);
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    const sessionExpiry = await this.getSessionExpiry();
    if (!token || !sessionExpiry) {
      return false;
    }

    return new Date(sessionExpiry).getTime() > Date.now();
  },
};
