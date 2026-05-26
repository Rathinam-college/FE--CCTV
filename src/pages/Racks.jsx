import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  Search, Filter, Plus, Server, Hash, Cpu, X, 
  Edit2, Trash2, Building, Activity, ShieldCheck, 
  ShieldAlert, Download, Network, Database, Upload,
  Info, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useSiteStore } from '../store/siteStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import ComboInput from '../components/ComboInput';

export default function Racks() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, occupations, fetchOccupations } = useSiteStore();
  const [racks, setRacks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Network:EDIT');
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    model: '',
    uSpace: '',
    serialNumber: '',
    status: 'Online'
  });


  useEffect(() => {
    fetchRacks();
    fetchAllLocations();
    fetchOccupations();
  }, []);

  useEffect(() => {
    if (showModal && !editingId) {
      const prefix = 'RACK/';
      const existingNumbers = racks
        .filter(r => (r.serialNumber || '').startsWith(prefix))
        .map(r => {
            const parts = (r.serialNumber || '').split('/');
            return parseInt(parts[parts.length - 1]) || 0;
        });
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      setFormData(prev => ({ ...prev, serialNumber: `${prefix}${formattedNumber}` }));
    }
  }, [showModal, editingId, racks]);

  const fetchRacks = async () => {
    try {
      const res = await api.get('/cameras/racks/');
      setRacks(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Error fetching racks', 'error');
    }
  };

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    if (occupations) occupations.forEach(o => colleges.add(o.name));
    racks.forEach(r => { if (r.collegeName) colleges.add(r.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    if (currentSite?.collegeName) colleges.add(currentSite.collegeName);
    return Array.from(colleges).sort();
  }, [occupations, racks, currentSite, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    racks.forEach(r => { if (r.block) blocks.add(r.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    if (currentSite?.block) blocks.add(currentSite.block);
    return Array.from(blocks).sort();
  }, [racks, currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetBlock = String(formData.block || '');
    if (targetBlock) {
      racks.forEach(r => { if (String(r.block || '') === targetBlock && r.floor) floors.add(String(r.floor)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && loc.floor) floors.add(String(loc.floor)); });
      if (String(currentSite?.block || '') === targetBlock && currentSite?.floor) floors.add(String(currentSite.floor));
    } else {
      racks.forEach(r => { if (r.floor) floors.add(String(r.floor)); });
      allLocations.forEach(loc => { if (loc.floor) floors.add(String(loc.floor)); });
      if (currentSite?.floor) floors.add(String(currentSite.floor));
    }
    return Array.from(floors).sort();
  }, [racks, currentSite, allLocations, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetBlock = String(formData.block || '');
    const targetFloor = String(formData.floor || '');
    if (targetBlock && targetFloor) {
      racks.forEach(r => { if (String(r.block || '') === targetBlock && String(r.floor || '') === targetFloor && r.room) rooms.add(String(r.room)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && String(loc.floor || '') === targetFloor && loc.room) rooms.add(String(loc.room)); });
      if (String(currentSite?.block || '') === targetBlock && String(currentSite?.floor || '') === targetFloor && currentSite?.room) rooms.add(String(currentSite.room));
    } else {
      racks.forEach(r => { if (r.room) rooms.add(String(r.room)); });
      allLocations.forEach(loc => { if (loc.room) rooms.add(String(loc.room)); });
      if (currentSite?.room) rooms.add(String(currentSite.room));
    }
    return Array.from(rooms).sort();
  }, [racks, currentSite, allLocations, formData.block, formData.floor]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    racks.forEach(r => { if (r.brand) brands.add(r.brand); });
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    if (currentSite?.brand) brands.add(currentSite.brand);
    ['NETRACK', 'VALRACK', 'APC', 'D-LINK'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [racks, currentSite, allLocations]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => {
      const nextData = { ...prev, [name]: value };
      
      if (['collegeName', 'block', 'floor', 'room'].includes(name)) {
        const matchingLoc = allLocations.find(loc => 
          (loc.collegeName || '') === (name === 'collegeName' ? value : (prev.collegeName || '')) &&
          (loc.block || '') === (name === 'block' ? value : (prev.block || '')) &&
          (loc.floor || '') === (name === 'floor' ? value : (prev.floor || '')) &&
          (loc.room || '') === (name === 'room' ? value : (prev.room || ''))
        );
        if (matchingLoc && matchingLoc.brand) {
          nextData.brand = matchingLoc.brand;
        }
      }
      return nextData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        location: formData.room || formData.block || 'Unknown',
      };

      if (editingId) {
        await api.put(`/cameras/racks/${editingId}/`, submitData);
        showNotification('Rack updated successfully');
      } else {
        await api.post('/cameras/racks/', submitData);
        showNotification('New rack registered successfully');
      }
      
      await ensureLocationExists({
        collegeName: submitData.collegeName,
        block: submitData.block,
        floor: submitData.floor,
        room: submitData.room,
        brand: submitData.brand
      });
      
      setShowModal(false);
      resetForm();
      fetchRacks();
    } catch (err) {
      console.error(err);
      showNotification('Error saving rack detail.', 'error');
    }
  };

  const openNewModal = async () => {
    await fetchSite();
    resetForm();

    const college = currentSite?.collegeName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';


    setFormData(prev => ({
      ...prev,
      collegeName: college,
      block: block,
      floor: floor,
      room: room
    }));
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '', location: '', collegeName: '', block: '', floor: '', room: '', brand: '',
      model: '', uSpace: '', serialNumber: '', status: 'Online'
    });
  };

  const editRack = (rack) => {
    setFormData({
      name: rack.name || '',
      location: rack.location || '',
      collegeName: rack.collegeName || '',
      block: rack.block || '',
      floor: rack.floor || '',
      room: rack.room || '',
      brand: rack.brand || '',
      model: rack.model || '',
      uSpace: rack.uSpace || '',
      serialNumber: rack.serialNumber || '',
      status: rack.status || 'Online'
    });
    setEditingId(rack._id || rack.id);
    setShowModal(true);
  };

  const deleteRack = async (id) => {
    if (window.confirm('WARNING: Are you sure you want to remove this rack?')) {
      try {
        await api.delete(`/cameras/racks/${id}/`);
        showNotification('Rack removed successfully');
        fetchRacks();
      } catch (err) {
        console.error(err);
        showNotification('Error deleting rack', 'error');
      }
    }
  };

  const filteredRacks = useMemo(() => {
    return racks.filter(r => {
      const matchesSearch = !searchQuery || [
        r.name, r.collegeName, r.block, r.room, r.brand, r.model, r.serialNumber
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [racks, searchQuery, statusFilter]);

  const stats = {
    total: racks.length,
    online: racks.filter(r => r.status === 'Online').length,
    offline: racks.filter(r => r.status === 'Offline').length,
    maintenance: racks.filter(r => r.status === 'Maintenance').length
  };

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#10b981' },
    { name: 'OFFLINE', value: stats.offline, color: '#ef4444' },
    { name: 'MAINT.', value: stats.maintenance, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-main flex items-center">
            <Server className="mr-3 text-blue-400" size={32} />
            Racks
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.2em] mt-1">Manage infrastructure racks</p>
        </div>
        <div className="flex space-x-3">
          {canEdit && (
            <button onClick={openNewModal} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
              <Plus size={18} className="mr-2" />
              Add Rack
            </button>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 shadow-lg">
            <Database size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-main">{stats.total}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Total Units</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-lg">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-main">{stats.online}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Active Racks</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-red-500/10 rounded-2xl text-red-400 border border-red-500/20 shadow-lg">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-main">{stats.offline}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Offline Racks</p>
          </div>
        </div>

        <div className="glass-panel p-4 flex items-center justify-center min-h-[120px]">
          <div className="w-full h-full min-w-[150px] relative">
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie
                  data={chartData}
                  innerRadius={25}
                  outerRadius={35}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center text-[8px] font-bold text-dim uppercase tracking-tighter">
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: d.color }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden animate-slide-up delay-100">
        <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row gap-4 bg-white/5">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Rack Name, Location, Brand or Serial..."
              className="glass-input w-full !pl-12 pr-4 py-2.5 text-sm placeholder:text-slate-400"
            />
          </div>
          <div className="flex p-1 bg-black/20 rounded-xl border border-white/5">
            {['ALL', 'Online', 'Offline', 'Maintenance'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  statusFilter === status 
                    ? 'bg-blue-600 text-main shadow-lg' 
                    : 'text-dim hover:text-main hover:bg-white/5'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Info</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Location & Model</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">U Space</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRacks.map((r) => (
                <tr 
                  key={r._id || r.id} 
                  className="hover:bg-white/5 transition-all group cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/racks/${r._id || r.id}`);
                    }
                  }}
                >
                  <td className="p-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shadow-lg">
                        <Server size={24} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-main">{r.name}</div>
                        <div className="text-[10px] text-blue-400/80 mt-1 uppercase truncate max-w-[200px] border border-blue-500/10 inline-block px-2 py-0.5 rounded-md bg-blue-500/5 font-bold tracking-wider">
                          SN: {r.serialNumber || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2 text-sm font-bold text-main">
                        <Building size={14} className="text-blue-400" />
                        <span>{r.block || '—'}</span>
                      </div>
                      <div className="text-[10px] text-dim font-black uppercase tracking-widest pl-5">
                        {r.collegeName || '—'}
                      </div>
                      <div className="text-[10px] text-blue-300 font-bold pl-5">
                        {r.brand} {r.model ? `- ${r.model}` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <span className="px-3.5 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-xs font-black text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                      {r.uSpace || '—'}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      r.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                      r.status === 'Offline' ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' :
                      'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${r.status === 'Online' ? 'bg-emerald-400' : r.status === 'Offline' ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                      {r.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="p-5 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/devices/racks/${r._id || r.id}`)} className="p-2 text-dim hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/30">
                          <Info size={16} />
                        </button>
                        <button onClick={() => editRack(r)} className="p-2 text-dim hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all border border-transparent hover:border-blue-500/30">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteRack(r._id || r.id)} className="p-2 text-dim hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/30">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredRacks.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-dim">
                    <Server size={48} className="mx-auto text-dim mb-4 opacity-50" />
                    <p>No racks found matching this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center">
              <h2 className="text-xl font-bold text-main flex items-center">
                <Server className="mr-3 text-teal-500" /> {editingId ? 'Edit Rack' : 'Register New Rack'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-secondary hover:text-main transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Rack Name</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. Core-Rack-01" />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">College / Institution</label>
                      <ComboInput 
                        required 
                        name="collegeName" 
                        value={formData.collegeName} 
                        onChange={handleInputChange} 
                        options={uniqueColleges} 
                        placeholder="Select or Type College..." 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Block</label>
                        <ComboInput 
                          required 
                          name="block" 
                          value={formData.block} 
                          onChange={handleInputChange} 
                          options={uniqueBlocks} 
                          placeholder="Block name..." 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Floor</label>
                        <ComboInput 
                          required 
                          name="floor" 
                          value={formData.floor} 
                          onChange={handleInputChange} 
                          options={uniqueFloors} 
                          placeholder="Floor..." 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Room / specific location</label>
                      <ComboInput 
                        name="room" 
                        value={formData.room} 
                        onChange={handleInputChange} 
                        options={uniqueRooms} 
                        placeholder="Select or Type Room..." 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] border-b border-main pb-2">Hardware Info</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Name</label>
                      <ComboInput 
                        name="brand" 
                        value={formData.brand} 
                        onChange={handleInputChange} 
                        options={uniqueBrands} 
                        placeholder="Select or Type Brand..." 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model</label>
                      <input type="text" name="model" value={formData.model} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. NRS" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">U Space (Size)</label>
                      <input type="text" name="uSpace" value={formData.uSpace} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. 42U" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Serial Number</label>
                      </div>
                      <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono bg-panel border-main" placeholder="RACK/01" />
                    </div>
                  </div>

                  {editingId && (
                    <div className="space-y-4 pt-4 border-t border-main">
                      <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Health Status</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {['Online', 'Offline', 'Maintenance'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({...formData, status: s})}
                            className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg border transition-all ${
                              formData.status === s 
                                ? 'bg-teal-600/20 border-teal-500/50 text-teal-400 shadow-[0_0_10px_rgba(13,148,136,0.2)]' 
                                : 'border-main text-secondary hover:text-main hover:bg-white/5'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-8 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-[10px] font-black tracking-widest text-secondary hover:text-main uppercase transition-colors">
                  Cancel
                </button>
                <button type="submit" className="neon-button min-w-[180px]">
                  {editingId ? 'Save Changes' : 'Register Rack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
