import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User, Student, Warden, LaundryStaff } from '../types/auth';
import { AuthStorage } from '../utils/authStorage';
import { authService } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Student | Warden | LaundryStaff | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AuthStorage.getToken();
      const savedUser = await AuthStorage.getUser();
      
      if (token && savedUser) {
        setUser(savedUser.user);
        setProfile(savedUser.profile);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      
      await AuthStorage.setToken(response.token);
      await AuthStorage.setUser(response);
      
      setUser(response.user);
      setProfile(response.profile || null);
    } catch (error: any) {
      let errorMessage = 'Login failed';
      
      if (error.response) {
        // Server responded with a status code outside the 2xx range
        errorMessage = error.response.data?.error || error.response.data?.message || `Error: ${error.response.status}`;
      } else if (error.request) {
        // Request was made but no response was received
        errorMessage = 'Could not connect to the server. Please check your network connection and API_URL.';
      } else {
        // Something else happened in setting up the request
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
