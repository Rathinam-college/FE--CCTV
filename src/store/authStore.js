import { create } from 'zustand';
import api from '../services/api';

const getInitialUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (user && !Array.isArray(user.permissions)) {
      user.permissions = [];
    }
    return user;
  } catch (err) {
    console.error("Auth initialization failed:", err);
    localStorage.removeItem('user');
    return null;
  }
};

const initialUser = getInitialUser();

export const useAuthStore = create((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  
  login: async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const userData = res.data;
      if (userData && !Array.isArray(userData.permissions)) {
        userData.permissions = [];
      }
      localStorage.setItem('user', JSON.stringify(userData));
      set({ user: userData, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/cctv/login';
  },

  checkAuth: () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user) {
        set({ user: null, isAuthenticated: false });
      } else {
        if (user && !Array.isArray(user.permissions)) {
          user.permissions = [];
        }
        set({ user, isAuthenticated: true });
      }
    } catch (e) {
      set({ user: null, isAuthenticated: false });
    }
  }
}));
