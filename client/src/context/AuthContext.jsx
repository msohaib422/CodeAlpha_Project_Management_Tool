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
          role: data.role,
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
        role: data.role,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  };

  // Register handler
  const register = async (name, username, email, password) => {
    try {
      const { data } = await API.post('/auth/register', { name, username, email, password });
      localStorage.setItem('token', data.token);
      setUser({
        _id: data._id,
        name: data.name,
        username: data.username,
        email: data.email,
        profilePicture: data.profilePicture,
        bio: data.bio,
        role: data.role,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      return { success: false, message };
    }
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

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
        role: data.role || prevUser.role,
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
