import React, { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on page load
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await API.get('/auth/me');
        setUser({
          _id: data._id,
          name: data.name,
          username: data.username,
          email: data.email,
          profilePicture: data.profilePicture,
          bio: data.bio,
        });
      } catch (error) {
        console.error('Session validation failed:', error);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  // Login handler
  const login = async (identifier, password) => {
    try {
      const { data } = await API.post('/auth/login', { identifier, password });
      localStorage.setItem('token', data.token);
      setUser({
        _id: data._id,
        name: data.name,
        username: data.username,
        email: data.email,
        profilePicture: data.profilePicture,
        bio: data.bio,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  };

  // Register handler (step 1 only: OTP is sent; no session is granted)
  const register = async (name, username, email, password) => {
    try {
      await API.post('/auth/register', { name, username, email, password });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      return { success: false, message };
    }
  };

  // Refresh session (sliding 10-minute window while active)
  const refreshSession = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const { data } = await API.post('/auth/refresh');
      if (data.token) {
        localStorage.setItem('token', data.token);
        setUser({
          _id: data._id,
          name: data.name,
          username: data.username,
          email: data.email,
          profilePicture: data.profilePicture,
          bio: data.bio,
        });
      }
    } catch (error) {
      // Token expired or invalid
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Keep session alive while app is in use
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshSession, 5 * 60 * 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshSession();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  // Update profile handler
  const updateProfile = async (profileData) => {
    try {
      const headers = profileData instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
      const { data } = await API.put('/users/profile', profileData, { headers });
      setUser((prevUser) => ({
        ...prevUser,
        name: data.name,
        email: data.email,
        profilePicture: data.profilePicture,
        bio: data.bio,
      }));
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile';
      return { success: false, message };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
