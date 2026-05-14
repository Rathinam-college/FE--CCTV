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
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';

export default function NetworkSwitches() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations } = useSiteStore();
  const [switches, setSwitches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Network:EDIT');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    model: '',
    portCount: '',
    serialNumber: '',
    status: 'Online'
  });

  const [isAddingNewCollege, setIsAddingNewCollege] = useState(false);
  const [isAddingNewBlock, setIsAddingNewBlock] = useState(false);
  const [isAddingNewFloor, setIsAddingNewFloor] = useState(false);
  const [isAddingNewRoom, setIsAddingNewRoom] = useState(false);
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);

  useEffect(() => {
    fetchSwitches();
    fetchAllLocations();
  }, []);

  useEffect(() => {
    if (showModal && !editingId) {
      const prefix = 'NETWORK/';
      const existingNumbers = switches
        .filter(s => (s.serialNumber || '').startsWith(prefix))
        .map(s => {
            const parts = (s.serialNumber || '').split('/');
            return parseInt(parts[parts.length - 1]) || 0;
        });
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      setFormData(prev => ({ ...prev, serialNumber: `${prefix}${formattedNumber}` }));
    }
  }, [showModal, editingId, switches]);

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${user.token}` }
  });

  const fetchSwitches = async () => {
    try {
      const res = await api.get('/cameras/switches/');
      setSwitches(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Error fetching switches', 'error');
    }
  };

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    switches.forEach(s => { if (s.collegeName) colleges.add(s.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    if (currentSite?.collegeName) colleges.add(currentSite.collegeName);
    return Array.from(colleges).sort();
  }, [switches, currentSite, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    switches.forEach(s => { if (s.block) blocks.add(s.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    if (currentSite?.block) blocks.add(currentSite.block);
    return Array.from(blocks).sort();
  }, [switches, currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    switches.forEach(s => { if (s.floor) floors.add(s.floor); });
    allLocations.forEach(loc => { if (loc.floor) floors.add(loc.floor); });
    if (currentSite?.floor) floors.add(currentSite.floor);
    return Array.from(floors).sort();
  }, [switches, currentSite, allLocations]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    switches.forEach(s => { if (s.room) rooms.add(s.room); });
    allLocations.forEach(loc => { if (loc.room) rooms.add(loc.room); });
    if (currentSite?.room) rooms.add(currentSite.room);
    return Array.from(rooms).sort();
  }, [switches, currentSite, allLocations]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    switches.forEach(s => { if (s.brand) brands.add(s.brand); });
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    if (currentSite?.brand) brands.add(currentSite.brand);
    // Common default brands
    ['CISCO', 'TP-LINK', 'D-LINK', 'NETGEAR', 'TANDA'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [switches, currentSite, allLocations]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'brand' && value === 'NEW') {
      setIsAddingNewBrand(true);
      setFormData(prev => ({ ...prev, brand: '' }));
      return;
    }

    let newValue = value;

    if (name === 'ipAddress') {
      const cleaned = value.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts[parts.length - 1].length === 3 && parts.length < 4 && !value.endsWith('.')) {
        newValue = cleaned + '.';
      } else {
        newValue = cleaned;
      }
    }

    setFormData(prev => {
      const nextData = { ...prev, [name]: newValue };
      
      // Auto-populate brand if location is found in Master Registry
      if (['collegeName', 'block', 'floor', 'room'].includes(name)) {
        const matchingLoc = allLocations.find(loc => 
          (loc.collegeName || '') === (name === 'collegeName' ? newValue : (prev.collegeName || '')) &&
          (loc.block || '') === (name === 'block' ? newValue : (prev.block || '')) &&
          (loc.floor || '') === (name === 'floor' ? newValue : (prev.floor || '')) &&
          (loc.room || '') === (name === 'room' ? newValue : (prev.room || ''))
        );
        if (matchingLoc && matchingLoc.brand) {
          nextData.brand = matchingLoc.brand;
          setIsAddingNewBrand(false);
        }
      }
      return nextData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/cameras/switches/${editingId}/`, formData);
        showNotification('Switch updated successfully');
      } else {
        await api.post('/cameras/switches/', formData);
        showNotification('New switch registered successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchSwitches();
    } catch (err) {
      console.error(err);
      showNotification('Error saving switch detail. Check if Serial Number already exists.', 'error');
    }
  };

  const openNewModal = async () => {
    await fetchSite();
    resetForm();

    const college = currentSite?.collegeName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';

    setIsAddingNewCollege(college && !uniqueColleges.includes(college));
    setIsAddingNewBlock(block && !uniqueBlocks.includes(block));
    setIsAddingNewFloor(floor && !uniqueFloors.includes(floor));
    setIsAddingNewRoom(room && !uniqueRooms.includes(room));

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
      name: '', ipAddress: '', collegeName: '', block: '', floor: '', room: '', brand: '',
      model: '', portCount: '', serialNumber: '', status: 'Online'
    });
    setIsAddingNewCollege(false);
    setIsAddingNewBlock(false);
    setIsAddingNewFloor(false);
    setIsAddingNewRoom(false);
  };

  const editSwitch = (sw) => {
    setFormData({
      name: sw.name || '',
      ipAddress: sw.ipAddress || '',
      collegeName: sw.collegeName || '',
      block: sw.block || '',
      floor: sw.floor || '',
      room: sw.room || '',
      brand: sw.brand || '',
      model: sw.model || '',
      portCount: sw.portCount || '',
      serialNumber: sw.serialNumber || '',
      status: sw.status || 'Online'
    });
    setEditingId(sw._id || sw.id);
    setShowModal(true);
  };

  const deleteSwitch = async (id) => {
    if (window.confirm('WARNING: Are you sure you want to remove this network switch?')) {
      try {
        await api.delete(`/cameras/switches/${id}/`);
        showNotification('Switch removed successfully');
        fetchSwitches();
      } catch (err) {
        console.error(err);
        showNotification('Error deleting switch', 'error');
      }
    }
  };

  const filteredSwitches = useMemo(() => {
    return switches.filter(sw => {
      const matchesSearch = !searchQuery || [
        sw.name, sw.ipAddress, sw.collegeName, sw.block, sw.room, sw.brand, sw.model, sw.serialNumber
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'ALL' || sw.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [switches, searchQuery, statusFilter]);

  const stats = {
    total: switches.length,
    online: switches.filter(s => s.status === 'Online').length,
    offline: switches.filter(s => s.status === 'Offline').length,
    maintenance: switches.filter(s => s.status === 'Maintenance').length
  };

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#10b981' },
    { name: 'OFFLINE', value: stats.offline, color: '#ef4444' },
    { name: 'MAINT.', value: stats.maintenance, color: '#f59e0b' }
  ];

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/cameras/switches/upload_excel/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showNotification(`Import Complete: ${res.data.created} Added, ${res.data.updated} Updated`);
      fetchSwitches();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to import data.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const exportToExcel = () => {
    const headers = [
      'S.No', 'Switch Name', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Brand', 
      'Model', 'Ports', 'Serial Number', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = filteredSwitches.map((sw, idx) => [
      idx + 1,
      escapeCSV(sw.name || 'N/A'),
      escapeCSV(sw.ipAddress || 'N/A'),
      escapeCSV(sw.collegeName || 'N/A'),
      escapeCSV(sw.block || 'N/A'),
      escapeCSV(sw.floor || 'N/A'),
      escapeCSV(sw.room || 'N/A'),
      escapeCSV(sw.brand || 'N/A'),
      escapeCSV(sw.model || 'N/A'),
      escapeCSV(sw.portCount || 'N/A'),
      escapeCSV(sw.serialNumber || 'N/A'),
      escapeCSV(sw.status || 'N/A')
    ]);

    const csvContent = "\uFEFF" + [ 
      headers.join(","), 
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Network_Switches_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${filteredSwitches.length} switches successfully`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-main flex items-center">
            <Network className="mr-3 text-blue-400" size={32} />
            Switches
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.2em] mt-1">Manage network switches and core infrastructure</p>
        </div>
        <div className="flex space-x-3">
          {canEdit && (
            <>
              <input 
                type="file" 
                id="csv-upload" 
                className="hidden" 
                accept=".csv" 
                onChange={handleFileUpload} 
              />
              <label htmlFor="csv-upload" className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg cursor-pointer">
                <Upload size={18} className="mr-2" /> Upload CSV
              </label>
            </>
          )}
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg">
            <Download size={18} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button onClick={openNewModal} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
              <Plus size={18} className="mr-2" />
              Add Switch
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
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Active Nodes</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-red-500/10 rounded-2xl text-red-400 border border-red-500/20 shadow-lg">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-main">{stats.offline}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Offline Nodes</p>
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
              placeholder="Search by Switch Name, IP, Location, Brand or Serial..."
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
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">Ports</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSwitches.map((sw) => (
                <tr 
                  key={sw._id || sw.id} 
                  className="hover:bg-white/5 transition-all group cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/switches/${sw._id || sw.id}`);
                    }
                  }}
                >
                  <td className="p-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shadow-lg">
                        <Server size={24} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-main">{sw.name}</div>
                        <div className="text-xs text-dim mt-0.5 font-mono">IP: <span className="text-blue-300">{sw.ipAddress || '—'}</span></div>
                        <div className="text-[10px] text-blue-400/80 mt-1 uppercase truncate max-w-[200px] border border-blue-500/10 inline-block px-2 py-0.5 rounded-md bg-blue-500/5 font-bold tracking-wider">
                          SN: {sw.serialNumber || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2 text-sm font-bold text-main">
                        <Building size={14} className="text-blue-400" />
                        <span>{sw.block || '—'}</span>
                      </div>
                      <div className="text-[10px] text-dim font-black uppercase tracking-widest pl-5">
                        {sw.collegeName || '—'}
                      </div>
                      <div className="text-[10px] text-blue-300 font-bold pl-5">
                        {sw.brand} {sw.model ? `- ${sw.model}` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <span className="px-3.5 py-1.5 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-xs font-black text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                      {sw.portCount || '—'}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      sw.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                      sw.status === 'Offline' ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' :
                      'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${sw.status === 'Online' ? 'bg-emerald-400' : sw.status === 'Offline' ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                      {sw.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="p-5 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/devices/switches/${sw._id || sw.id}`)} className="p-2 text-dim hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all border border-transparent hover:border-emerald-500/30">
                          <Info size={16} />
                        </button>
                        <button onClick={() => editSwitch(sw)} className="p-2 text-dim hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all border border-transparent hover:border-blue-500/30">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteSwitch(sw._id || sw.id)} className="p-2 text-dim hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/30">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSwitches.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-dim">
                    <Network size={48} className="mx-auto text-dim mb-4 opacity-50" />
                    <p>No network switches found matching this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Switch Modal (Add / Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center">
              <h2 className="text-xl font-bold text-main flex items-center">
                <Network className="mr-3 text-teal-500" /> {editingId ? 'Edit Switch' : 'Register New Infrastructure'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-secondary hover:text-main transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Identity & Location */}
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Switch Name</label>
                      <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. Core-Switch-01" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IP Address</label>
                      <input required type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono text-teal-500 bg-panel border-main" placeholder="192.168.1.1" />
                    </div>
                  </div>

                  {/* Location Intelligence Fields */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        College / Institution
                      </label>
                      {isAddingNewCollege ? (
                        <div className="relative">
                          <input required type="text" name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-teal-500/30 bg-panel" placeholder="Type new college..." />
                          <button type="button" onClick={() => setIsAddingNewCollege(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main"><X size={14} /></button>
                        </div>
                      ) : (
                        <select required name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer bg-panel border-main">
                          <option value="">Select Existing College</option>
                          {uniqueColleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                          Block
                        </label>
                        {isAddingNewBlock ? (
                          <div className="relative">
                            <input required type="text" name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-blue-500/30" placeholder="Block name..." />
                            <button type="button" onClick={() => setIsAddingNewBlock(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                          </div>
                        ) : (
                          <select required name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer bg-panel border-main">
                            <option value="">Select Block</option>
                            {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex justify-between">
                          Floor
                          {!isAddingNewFloor && (
                            <button type="button" onClick={() => setIsAddingNewFloor(true)} className="text-[9px] text-teal-600 hover:text-teal-500 transition-colors underline">NEW</button>
                          )}
                        </label>
                        {isAddingNewFloor ? (
                          <div className="relative">
                            <input required type="text" name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-blue-500/30" placeholder="Floor..." />
                            <button type="button" onClick={() => setIsAddingNewFloor(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                          </div>
                        ) : (
                          <select required name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer bg-panel border-main">
                            <option value="">Select Floor</option>
                            {uniqueFloors.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        Room / specific location
                      </label>
                      {isAddingNewRoom ? (
                        <div className="relative">
                          <input required type="text" name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-main bg-panel" placeholder="Type new room..." />
                          <button type="button" onClick={() => setIsAddingNewRoom(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-main"><X size={14} /></button>
                        </div>
                      ) : (
                        <select required name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer bg-panel border-main text-secondary">
                          <option value="">Select Room</option>
                          {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Hardware & Status */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] border-b border-main pb-2">Hardware & Vendor</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Name</label>
                      <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. Cisco" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model</label>
                      <input type="text" name="model" value={formData.model} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. C2960X" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Port Count</label>
                      <input type="text" name="portCount" value={formData.portCount} onChange={handleInputChange} className="glass-input w-full p-3 text-sm bg-panel border-main" placeholder="e.g. 24 / 48" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Serial Number</label>
                      </div>
                      <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono bg-panel border-main" placeholder="SWI/01" />
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
                  {editingId ? 'Save Changes' : 'Register Switch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
