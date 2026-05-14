import { create } from 'zustand';
import api from '../services/api';

const getInitialUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
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
      // The backend returns { _id, name, email, role, token, ... }
      localStorage.setItem('user', JSON.stringify(res.data));
      set({ user: res.data, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  
  logout: () => {
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/login';
  },

  checkAuth: () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
      set({ user: null, isAuthenticated: false });
    } else {
      set({ user, isAuthenticated: true });
    }
  }
}));
