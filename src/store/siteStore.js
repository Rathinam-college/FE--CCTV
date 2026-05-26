import { create } from 'zustand';
import api from '../services/api';

export const useSiteStore = create((set, get) => ({
  currentSite: {
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    brand: ''
  },
  allLocations: [],
  occupations: [],
  loading: false,

  fetchOccupations: async () => {
    try {
      const res = await api.get('/cameras/occupations/');
      set({ occupations: res.data });
    } catch (err) {
      console.error('Failed to fetch occupations:', err);
    }
  },

  fetchSite: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/cameras/global-site-config/');
      if (res.data) {
        set({ currentSite: res.data });
      }
    } catch (err) {
      console.error('Failed to fetch global site config:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchAllLocations: async () => {
    try {
      const res = await api.get('/cameras/master_locations/');
      set({ allLocations: res.data });
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  },

  deleteLocation: async (id) => {
    try {
      await api.delete(`/cameras/master_locations/${id}/`);
      const locs = get().allLocations.filter(l => l.id !== id);
      set({ allLocations: locs });
      return true;
    } catch (err) {
      console.error('Failed to delete location:', err);
      return false;
    }
  },

  updateLocation: async (id, data) => {
    try {
      const res = await api.put(`/cameras/master_locations/${id}/`, data);
      const locs = get().allLocations.map(l => l.id === id ? res.data : l);
      set({ allLocations: locs });
      return true;
    } catch (err) {
      console.error('Failed to update location:', err);
      return false;
    }
  },

  addLocation: async (data) => {
    try {
      const res = await api.post('/cameras/master_locations/', data);
      set((state) => ({ allLocations: [...state.allLocations, res.data] }));
      return res.data;
    } catch (err) {
      console.error('Failed to add location:', err);
      return null;
    }
  },

  ensureLocationExists: async (data) => {
    const { collegeName, block, floor, room, brand } = data;
    
    // Only check if we actually have some location data
    if (!collegeName && !block && !floor && !room) return;

    const exists = get().allLocations.find(loc => 
      (loc.collegeName || '') === (collegeName || '') &&
      (loc.block || '') === (block || '') &&
      (loc.floor || '') === (floor || '') &&
      (loc.room || '') === (room || '')
    );
    
    if (!exists) {
      await get().addLocation({ collegeName, block, floor, room, brand });
    }
  },

  applySite: async (siteData) => {
    set({ loading: true });
    try {
      const res = await api.post('/cameras/global-site-config/apply_site/', siteData);
      set({ currentSite: res.data });
      
      // Try to refresh locations list, but don't crash if it fails
      try {
        await get().fetchAllLocations();
      } catch (e) {
        console.warn('Registry list refresh failed:', e);
      }
      
      return { success: true };
    } catch (err) {
      console.error('Failed to apply site config:', err);
      return { success: false, error: err.message };
    } finally {
      set({ loading: false });
    }
  },

  clearSite: () => set({ currentSite: { collegeName: '', block: '', floor: '', room: '', brand: '' } })
}));
