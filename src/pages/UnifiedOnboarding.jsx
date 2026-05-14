import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  Building, MapPin, Server, Save, ShieldCheck, Globe, LayoutGrid, Activity, Trash2, Edit2, X, Users, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';
import { useSiteStore } from '../store/siteStore';

export default function UnifiedOnboarding() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { 
    currentSite, 
    fetchSite, 
    applySite, 
    loading,
    allLocations,
    fetchAllLocations,
    deleteLocation,
    updateLocation
  } = useSiteStore();

  const [formData, setFormData] = useState({
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    assignedTo: ''
  });

  const [users, setUsers] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);

  useEffect(() => {
    fetchSite();
    fetchAllLocations();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  // Disabling auto-preview of current site to keep form clean for new entries
  /* 
  useEffect(() => {
    if (currentSite) {
      setFormData({
        collegeName: currentSite.collegeName || '',
        block: currentSite.block || '',
        floor: currentSite.floor || '',
        room: currentSite.room || '',
        brand: currentSite.brand || '',
        assignedTo: currentSite.assignedTo?.id || currentSite.assignedTo || ''
      });
    }
  }, [currentSite]);
  */

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    // Common default brands
    ['HIKVISION', 'DAHUA', 'CP PLUS', 'UNV', 'HONEYWELL', 'ZKTECO', 'CISCO'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [allLocations]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'brand' && value === 'NEW') {
      setIsAddingNewBrand(true);
      setFormData(prev => ({ ...prev, brand: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleApplySite = async (e) => {
    if (e) e.preventDefault();
    
    const payload = {
      ...formData,
      assignedTo: formData.assignedTo === '' ? null : formData.assignedTo
    };

    // If we are editing an existing master location
    if (editingId) {
      const updated = await updateLocation(editingId, payload);
      if (updated) {
        showNotification('Master Location registry updated', 'success');
      }
    }

    // Always apply to the current active site intelligence
    const result = await applySite(payload);
    if (result.success) {
      showNotification('Global Site Intelligence Synchronized', 'success');
      setEditingId(null);
      setFormData({ collegeName: '', block: '', floor: '', room: '', brand: '', assignedTo: '' });
      setIsAddingNewBrand(false);
      fetchAllLocations(); // Refresh list
    } else {
      showNotification('Sync failed', 'error');
    }
  };

  const handleSelectFromRegistry = (loc) => {
    setEditingId(loc.id);
    setFormData({
      collegeName: loc.collegeName || '',
      block: loc.block || '',
      floor: loc.floor || '',
      room: loc.room || '',
      brand: loc.brand || '',
      assignedTo: loc.assignedTo?.id || loc.assignedTo || ''
    });
    setIsAddingNewBrand(false);
    showNotification('Location loaded for editing.', 'info');
  };

  const handleDeleteLocation = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this location from the registry?')) {
      const success = await deleteLocation(id);
      if (success) {
        showNotification('Location removed from registry', 'success');
        if (editingId === id) {
           setEditingId(null);
           setFormData({ collegeName: '', block: '', floor: '', room: '', brand: '' });
           setIsAddingNewBrand(false);
        }
      } else {
        showNotification('Failed to delete location', 'error');
      }
    }
  };

  const canView = user?.role === 'Super Admin' || user?.permissions?.includes('Onboarding:VIEW');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Onboarding:EDIT');

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <ShieldAlert size={64} className="text-red-500 mb-6 opacity-80" />
        <h2 className="text-2xl font-bold text-main tracking-tight mb-2">Access Restricted</h2>
        <p className="text-dim">Please contact the CCTV Admin to request access permissions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-fade-in">
      {/* Header Section */}
      <div className="flex justify-between items-end border-b border-white/10 pb-8">
        <div>
          <h1 className="text-5xl font-black font-['Space_Grotesk'] tracking-tighter text-white italic">
            ONBOARDING
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.4em] mt-2">Master Infrastructure Control Panel</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">System Status</div>
          <div className="flex items-center text-emerald-500 font-bold text-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
            ACTIVE DEPLOYMENT MODE
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Configuration Form (4/12) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-panel p-8 bg-panel border-main shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <ShieldCheck size={100} className="text-white" />
            </div>

            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-8 flex items-center">
              <ShieldCheck className="mr-3 text-blue-500" size={24} />
              {editingId ? 'Modify' : 'Register'}
            </h2>

            <form onSubmit={handleApplySite} className="space-y-6 relative z-10">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">College</label>
                  <input
                    required
                    type="text"
                    value={formData.collegeName}
                    onChange={(e) => setFormData({...formData, collegeName: e.target.value})}
                    className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
                    placeholder="Institution Name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">Block</label>
                  <input
                    required
                    type="text"
                    value={formData.block}
                    onChange={(e) => setFormData({...formData, block: e.target.value})}
                    className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
                    placeholder="Building Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">Floor</label>
                    <input
                      type="text"
                      value={formData.floor}
                      onChange={(e) => setFormData({...formData, floor: e.target.value})}
                      className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
                      placeholder="e.g. 1st"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">Room</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({...formData, room: e.target.value})}
                      className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
                      placeholder="e.g. 101"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">Device Brand</label>
                  {!isAddingNewBrand ? (
                    <select
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white cursor-pointer"
                    >
                      <option value="">Select Brand</option>
                      {uniqueBrands.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="NEW">+ Add New Brand</option>
                    </select>
                  ) : (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({...formData, brand: e.target.value.toUpperCase()})}
                        className="glass-input flex-1 p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
                        placeholder="Enter Brand Name"
                        autoFocus
                      />
                      <button 
                        type="button" 
                        onClick={() => setIsAddingNewBrand(false)}
                        className="p-4 bg-white/5 border border-white/10 rounded-xl text-dim hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-[0.2em] ml-1">Responsibility</label>
                  <select
                    name="assignedTo"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    className="glass-input w-full p-4 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white cursor-pointer"
                  >
                    <option value="">Select Responsible User</option>
                    {users.map(u => (
                      <option key={u.id || u._id} value={u.id || u._id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-col space-y-3">
                {canEdit ? (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>{editingId ? 'Update Location' : 'Save Location'}</span>
                        </>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="text-center text-amber-500 font-bold text-[9px] uppercase tracking-widest bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    Read Only Mode
                  </div>
                )}
                
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setFormData({ collegeName: '', block: '', floor: '', room: '', brand: '', assignedTo: '' }); }}
                    className="w-full p-3 text-[9px] font-black uppercase tracking-widest text-secondary hover:text-white transition-all border border-white/5 rounded-xl"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right: Master Location Registry (8/12) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="glass-panel bg-panel border-main shadow-xl overflow-hidden h-full">
             <div className="p-8 border-b border-main flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center">
                  <LayoutGrid className="mr-3 text-blue-500" size={18} />
                  Master Location Registry
                </h3>
                <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-white/5 px-3 py-1 border border-white/10 rounded-full">
                  {allLocations.length} Records
                </span>
             </div>
             
             <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-20 bg-panel border-b border-main">
                    <tr className="text-main text-[9px] font-black uppercase tracking-widest">
                      <th className="p-6">College</th>
                      <th className="p-6">Block</th>
                      <th className="p-6">Floor</th>
                      <th className="p-6">Room</th>
                      <th className="p-6">Brand</th>
                      <th className="p-6">Responsibility</th>
                      <th className="p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allLocations.map((loc, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors group border-b border-white/5">
                        <td className="p-6">
                           <span className="px-3 py-1.5 text-[10px] font-black text-teal-400 bg-teal-500/10 rounded-lg uppercase tracking-wider border border-teal-500/20">
                             {loc.collegeName || 'N/A'}
                           </span>
                        </td>
                        <td className="p-6 text-xs font-bold text-secondary">{loc.block}</td>
                        <td className="p-6 text-xs font-bold text-secondary">{loc.floor || '—'}</td>
                        <td className="p-6 text-xs font-bold text-secondary">{loc.room || '—'}</td>
                        <td className="p-6">
                          <span className="text-xs font-black text-blue-400">{loc.brand || '—'}</span>
                        </td>
                        <td className="p-6">
                           <div className="flex items-center space-x-2">
                             <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[8px] font-bold text-blue-400">
                               {(loc.assignedTo?.name || 'U').charAt(0).toUpperCase()}
                             </div>
                             <span className="text-[10px] font-bold text-dim">{loc.assignedTo?.name || 'Unassigned'}</span>
                           </div>
                        </td>
                        <td className="p-6 text-right">
                          {canEdit && (
                            <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={() => handleSelectFromRegistry(loc)}
                                 className="p-2 hover:bg-blue-500/10 rounded-xl text-blue-400 transition-all border border-transparent hover:border-blue-500/30"
                               >
                                 <Edit2 size={14} />
                               </button>
                               <button 
                                 onClick={(e) => handleDeleteLocation(e, loc.id)}
                                 className="p-2 hover:bg-red-500/10 rounded-xl text-red-400 transition-all border border-transparent hover:border-red-500/30"
                                >
                                 <Trash2 size={14} />
                               </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {allLocations.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-20 text-center text-dim text-xs font-bold italic">No master locations registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
