import { create } from 'zustand';
import api from '../services/api';

const enrichPermissions = (user) => {
  if (!user || !Array.isArray(user.permissions)) return user;
  
  const perms = new Set(user.permissions);
  const map = {
    'Cameras': 'Assets',
    'NVRs': 'Storage',
    'Biometrics': 'Identity',
    'Network Switches': 'Network',
    'Racks': 'Network',
    'Tickets': 'Maintenance',
    'Upgrades': 'Maintenance',
    'Billing & PO': 'Maintenance',
    'General Billing': 'Maintenance',
    'Projects': 'Projects',
    'Reports': 'Logs',
    'Divisions': 'Logs',
    'Brands': 'Logs',
    'Activity Logs': 'Logs',
    'Onboarding': 'Onboarding',
    'User Management': 'Users',
    'Database Backup': 'Backup'
  };

  ['VIEW', 'EDIT'].forEach(type => {
    Object.keys(map).forEach(newP => {
      if (perms.has(`${newP}:${type}`)) {
        perms.add(`${map[newP]}:${type}`);
      }
      // Also map legacy back to granular if they had old permissions
      if (perms.has(`${map[newP]}:${type}`)) {
        perms.add(`${newP}:${type}`);
      }
    });
  });

  return { ...user, permissions: Array.from(perms) };
};

const getInitialUser = () => {
  try {
    const userStr = localStorage.getItem('cctv_user');
    if (!userStr) return null;
    let user = JSON.parse(userStr);
    if (user && !Array.isArray(user.permissions)) {
      user.permissions = [];
    }
    return enrichPermissions(user);
  } catch (err) {
    console.error("Auth initialization failed:", err);
    localStorage.removeItem('cctv_user');
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
      let userData = res.data;
      if (userData && !Array.isArray(userData.permissions)) {
        userData.permissions = [];
      }
      userData = enrichPermissions(userData);
      localStorage.setItem('cctv_user', JSON.stringify(userData));
      set({ user: userData, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  
  logout: () => {
    localStorage.removeItem('cctv_user');
    set({ user: null, isAuthenticated: false });
    window.location.href = '/cctv/login';
  },

  checkAuth: () => {
    try {
      let user = JSON.parse(localStorage.getItem('cctv_user'));
      if (!user) {
        set({ user: null, isAuthenticated: false });
      } else {
        if (user && !Array.isArray(user.permissions)) {
          user.permissions = [];
        }
        user = enrichPermissions(user);
        set({ user, isAuthenticated: true });
      }
    } catch (e) {
      set({ user: null, isAuthenticated: false });
    }
  }
}));
