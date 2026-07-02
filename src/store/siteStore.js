import { create } from 'zustand';
import api from '../services/api';

export const useSiteStore = create((set, get) => ({
  currentSite: {
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    brand: ''
  },
  allLocations: [],
  divisions: [],
  brands: [],
  loading: false,

  fetchBrands: async () => {
    try {
      const res = await api.get('/cameras/brands/');
      set({ brands: res.data });
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    }
  },

  fetchDivisions: async () => {
    try {
      const res = await api.get('/cameras/divisions/');
      set({ divisions: res.data });
    } catch (err) {
      console.error('Failed to fetch divisions:', err);
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
      const res = await api.get('/cameras/locations/');
      let locations = res.data || [];

      // Extract legacy locations directly from cameras to ensure nothing is missing
      try {
        const camRes = await api.get('/cameras/');
        const legacyLocs = [];
        camRes.data.forEach(c => {
          if (c.divisionName || c.block || c.floor || c.room) {
            legacyLocs.push({
              id: `legacy-${c.id || Math.random()}`,
              divisionName: (c.divisionName || '').toUpperCase(),
              block: (c.block || '').toUpperCase(),
              floor: (c.floor || '').toUpperCase(),
              room: (c.room || '').toUpperCase()
            });
          }
          if (c.siteName) {
            const parts = c.siteName.split('|').map(p => p.trim().toUpperCase());
            legacyLocs.push({
              id: `legacy-site-${c.id || Math.random()}`,
              divisionName: parts[0] || '',
              block: parts[1] || '',
              floor: parts[2] || '',
              room: parts[3] || ''
            });
          }
        });
        // Deduplicate and merge
        const uniqueKeys = new Set(locations.map(l => `${(l.divisionName||'').toUpperCase()}|${(l.block||'').toUpperCase()}|${(l.floor||'').toUpperCase()}|${(l.room||'').toUpperCase()}`));
        legacyLocs.forEach(ll => {
          const key = `${ll.divisionName}|${ll.block}|${ll.floor}|${ll.room}`;
          if (!uniqueKeys.has(key)) {
            uniqueKeys.add(key);
            locations.push(ll);
          }
        });
      } catch (camErr) {
        console.error('Failed to aggregate camera locations:', camErr);
      }

      set({ allLocations: locations });
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  },

  deleteLocation: async (id) => {
    try {
      await api.delete(`/cameras/locations/${id}/`);
      const locs = get().allLocations.filter(l => l.id !== id);
      set({ allLocations: locs });
      return { success: true };
    } catch (err) {
      console.error('Failed to delete location:', err);
      return { success: false, message: err.response?.data?.message || 'Failed to delete' };
    }
  },

  updateLocation: async (id, data) => {
    try {
      const res = await api.put(`/cameras/locations/${id}/`, data);
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
      const res = await api.post('/cameras/locations/', data);
      await get().fetchAllLocations();
      return res.data;
    } catch (err) {
      console.error('Failed to add location:', err);
      throw err;
    }
  },

  ensureLocationExists: async (data) => {
    const { divisionName, block, floor, room, brand } = data;
    if (!divisionName && !block && !floor && !room) return;

    const exists = get().allLocations.find(loc => 
      (loc.divisionName || '') === (divisionName || '') &&
      (loc.block || '') === (block || '') &&
      (loc.floor || '') === (floor || '') &&
      (loc.room || '') === (room || '')
    );
    
    if (!exists) {
      try {
        await get().addLocation({ divisionName, block, floor, room, brand });
      } catch (err) {
        console.warn('ensureLocationExists caught an error (likely a duplicate backend constraint), ignoring:', err);
      }
    }
  },

  applySite: async (siteData) => {
    set({ loading: true });
    try {
      const res = await api.post('/cameras/global-site-config/apply_site/', siteData);
      set({ currentSite: res.data });
      

      return { success: true };
    } catch (err) {
      console.error('Failed to apply site config:', err);
      return { success: false, error: err.message };
    } finally {
      set({ loading: false });
    }
  },

  clearSite: () => set({ currentSite: { divisionName: '', block: '', floor: '', room: '', brand: '' } })
}));
