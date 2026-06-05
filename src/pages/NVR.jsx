import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Search, Filter, Plus, Server, HardDrive, Cpu, X, Edit2, Trash2, Building, Activity, ShieldCheck, ShieldAlert, Download, Upload, Info, ChevronRight, Network } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useSiteStore } from '../store/siteStore';
import ComboInput from '../components/ComboInput';

export default function NVR() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, occupations, fetchOccupations } = useSiteStore();
  const [nvrs, setNvrs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Storage:EDIT');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    ipAddress: '',
    ipv4Gateway: '',
    subnetMask: '',
    macAddress: '',
    nvrName: '',
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    model: '',
    hardDisk: '',
    storageList: [{ size: '', unit: 'TB' }],
    channel: '',
    serialNumber: '',
    status: 'Online'
  });


  useEffect(() => {
    fetchNVRs();
    fetchAllLocations();
    fetchOccupations();
  }, []);

  useEffect(() => {
    if (showModal && !editingId) {
      const prefix = 'CCTV/NVR/';
      const existingNumbers = nvrs
        .filter(n => (n.serialNumber || '').startsWith(prefix))
        .map(n => {
            const parts = (n.serialNumber || '').split('/');
            return parseInt(parts[parts.length - 1]) || 0;
        });
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      setFormData(prev => ({ ...prev, serialNumber: `${prefix}${formattedNumber}` }));
    }
  }, [showModal, editingId, nvrs]);



  const fetchNVRs = async () => {
    try {
      const res = await api.get('/cameras/nvrs/');
      setNvrs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    if (occupations) occupations.forEach(o => colleges.add(o.name));
    nvrs.forEach(n => { if (n.collegeName) colleges.add(n.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    if (currentSite?.collegeName) colleges.add(currentSite.collegeName);
    return Array.from(colleges).sort();
  }, [occupations, nvrs, currentSite, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    nvrs.forEach(n => { if (n.block) blocks.add(n.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    if (currentSite?.block) blocks.add(currentSite.block);
    return Array.from(blocks).sort();
  }, [nvrs, currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetBlock = String(formData.block || '');
    if (targetBlock) {
      nvrs.forEach(n => { if (String(n.block || '') === targetBlock && n.floor) floors.add(String(n.floor)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && loc.floor) floors.add(String(loc.floor)); });
      if (String(currentSite?.block || '') === targetBlock && currentSite?.floor) floors.add(String(currentSite.floor));
    } else {
      nvrs.forEach(n => { if (n.floor) floors.add(String(n.floor)); });
      allLocations.forEach(loc => { if (loc.floor) floors.add(String(loc.floor)); });
      if (currentSite?.floor) floors.add(String(currentSite.floor));
    }
    return Array.from(floors).sort();
  }, [nvrs, currentSite, allLocations, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetBlock = String(formData.block || '');
    const targetFloor = String(formData.floor || '');
    if (targetBlock && targetFloor) {
      nvrs.forEach(n => { if (String(n.block || '') === targetBlock && String(n.floor || '') === targetFloor && n.room) rooms.add(String(n.room)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && String(loc.floor || '') === targetFloor && loc.room) rooms.add(String(loc.room)); });
      if (String(currentSite?.block || '') === targetBlock && String(currentSite?.floor || '') === targetFloor && currentSite?.room) rooms.add(String(currentSite.room));
    } else {
      nvrs.forEach(n => { if (n.room) rooms.add(String(n.room)); });
      allLocations.forEach(loc => { if (loc.room) rooms.add(String(loc.room)); });
      if (currentSite?.room) rooms.add(String(currentSite.room));
    }
    return Array.from(rooms).sort();
  }, [nvrs, currentSite, allLocations, formData.block, formData.floor]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    nvrs.forEach(n => { if (n.brand) brands.add(n.brand); });
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    if (currentSite?.brand) brands.add(currentSite.brand);
    // Common default brands
    ['HIKVISION', 'DAHUA', 'CP PLUS', 'UNV', 'HONEYWELL'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [nvrs, currentSite, allLocations]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;


    const applyIPMask = (val) => {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts[parts.length - 1].length === 3 && parts.length < 4 && !val.endsWith('.')) {
        return cleaned + '.';
      }
      return cleaned;
    };

    const applyMACMask = (val) => {
      const cleaned = val.replace(/[^0-9A-Fa-f]/g, '')?.toUpperCase() || '';
      const parts = cleaned.match(/.{1,2}/g) || [];
      return parts.slice(0, 6).join(':');
    };

    if (['ipAddress', 'ipv4Gateway', 'subnetMask'].includes(name)) {
      newValue = applyIPMask(value);
    } else if (name === 'macAddress') {
      newValue = applyMACMask(value);
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
        }
      }
      return nextData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const finalHardDisk = formData.storageList
        .filter(s => s.size)
        .map(s => `${s.size} ${s.unit}`)
        .join(' + ');

      const payload = {
        ...formData,
        hardDisk: finalHardDisk,
        location: formData.room || formData.block || 'Unknown',
        gateway: formData.ipv4Gateway || '',
      };
      delete payload.storageList;
      
      if (!payload.serialNumber || payload.serialNumber.trim() === '') {
        delete payload.serialNumber;
      }

      if (editingId) {
        await api.put(`/cameras/nvrs/${editingId}/`, payload);
        showNotification('NVR asset updated');
      } else {
        await api.post('/cameras/nvrs/', payload);
        showNotification('New NVR asset registered');
      }
      
      await ensureLocationExists({
        collegeName: payload.collegeName,
        block: payload.block,
        floor: payload.floor,
        room: payload.room,
        brand: payload.brand
      });
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ 
        ipAddress: '', ipv4Gateway: '', subnetMask: '', macAddress: '', nvrName: '', collegeName: '', block: '', floor: '', room: '', 
        brand: '', model: '', hardDisk: '', storageList: [{ size: '', unit: 'TB' }], channel: '', serialNumber: '', status: 'Online' 
      });
      fetchNVRs();
    } catch (err) {
      console.error(err);
      alert('Error saving NVR asset.');
    }
  };

  const openNewModal = async () => {
    await fetchSite();
    setEditingId(null);

    const college = currentSite?.collegeName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';


    setFormData({ 
      ipAddress: '', ipv4Gateway: '', subnetMask: '', macAddress: '', nvrName: '', collegeName: college, block: block, floor: floor, room: room, 
      brand: '', model: '', hardDisk: '', storageList: [{ size: '', unit: 'TB' }], channel: '', serialNumber: '', status: 'Online' 
    });
    setShowModal(true);
  };

  const addStorageField = () => {
    setFormData(prev => ({
      ...prev,
      storageList: [...prev.storageList, { size: '', unit: 'TB' }]
    }));
  };

  const removeStorageField = (index) => {
    if (formData.storageList.length > 1) {
      setFormData(prev => ({
        ...prev,
        storageList: prev.storageList.filter((_, i) => i !== index)
      }));
    }
  };

  const handleStorageChange = (index, field, value) => {
    const newList = [...formData.storageList];
    newList[index][field] = value;
    setFormData(prev => ({ ...prev, storageList: newList }));
  };

  const calculateTotalStorage = (diskStr) => {
    if (!diskStr) return '0 TB';
    const parts = diskStr.split('+');
    let totalGB = 0;
    parts.forEach(p => {
      const match = p.trim().match(/^(\d+)\s*(TB|GB)$/i);
      if (match) {
        const val = parseInt(match[1]);
        const unit = match[2].toUpperCase();
        totalGB += unit === 'TB' ? val * 1024 : val;
      }
    });
    
    if (totalGB >= 1024) {
      return `${(totalGB / 1024).toFixed(1).replace(/\.0$/, '')} TB`;
    }
    return `${totalGB} GB`;
  };

  const editNVR = (nvr) => {
    setFormData({
      ipAddress: nvr.ipAddress || '',
      ipv4Gateway: nvr.gateway || '',
      subnetMask: nvr.subnetMask || '',
      macAddress: nvr.macAddress || '',
      nvrName: nvr.nvrName || '',
      collegeName: nvr.collegeName || '',
      block: nvr.block || '',
      floor: nvr.floor || '',
      room: nvr.room || '',
      brand: nvr.brand || '',
      model: nvr.model || '',
      hardDisk: nvr.hardDisk || '',
      storageList: nvr.hardDisk ? nvr.hardDisk.split('+').map(s => {
        const match = s.trim().match(/^(\d+)\s*(TB|GB)$/i);
        return match ? { size: match[1], unit: match[2].toUpperCase() } : { size: s.trim(), unit: 'TB' };
      }) : [{ size: '', unit: 'TB' }],
      channel: nvr.channel || '',
      serialNumber: nvr.serialNumber || '',
      status: nvr.status || 'Online'
    });
    setEditingId(nvr._id || nvr.id);
    setShowModal(true);
  };

  const deleteNVR = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/nvrs/${id}/`);
        fetchNVRs();
        showNotification('NVR purged from database');
      } catch (error) {
        console.error('Error deleting NVR:', error);
        showNotification('Failed to delete NVR', 'error');
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/cameras/nvrs/upload_excel/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showNotification(`Import Complete: ${res.data.created} Added, ${res.data.updated} Updated`);
      fetchNVRs();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to import data.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };


  const generateSerialNumber = () => {
    const prefix = 'STORAGE/';
    
    // Filter nvrs and extract numbers
    const existingNumbers = nvrs
      .filter(n => (n.serialNumber || '').startsWith(prefix))
      .map(n => {
        const parts = (n.serialNumber || '').split('/');
        return parseInt(parts[parts.length - 1]) || 0;
      });
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const formattedNumber = nextNumber.toString().padStart(2, '0');
    
    setFormData({ ...formData, serialNumber: `${prefix}${formattedNumber}` });
    showNotification(`Generated ID: ${prefix}${formattedNumber}`);
  };

  const filteredNVRs = nvrs.filter(nvr => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (nvr.nvrName || '').toLowerCase().includes(q) ||
      (nvr.serialNumber || '').toLowerCase().includes(q) ||
      (nvr.collegeName || '').toLowerCase().includes(q) ||
      (nvr.block || '').toLowerCase().includes(q) ||
      (nvr.room || '').toLowerCase().includes(q) ||
      (nvr.ipAddress || '').toLowerCase().includes(q) ||
      (nvr.brand || '').toLowerCase().includes(q) ||
      (nvr.model || '').toLowerCase().includes(q)
    );
  });

  const exportToExcel = () => {
    const headers = [
      'S.No', 'Node Name', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Brand', 'Model',
      'Hard Disk', 'Channels', 'Asset Number', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = filteredNVRs.map((nvr, idx) => [
      idx + 1,
      escapeCSV(nvr.nvrName || 'N/A'),
      escapeCSV(nvr.ipAddress || 'N/A'),
      escapeCSV(nvr.collegeName || 'N/A'),
      escapeCSV(nvr.block || 'N/A'),
      escapeCSV(nvr.floor || 'N/A'),
      escapeCSV(nvr.room || 'N/A'),
      escapeCSV(nvr.brand || 'N/A'),
      escapeCSV(nvr.model || 'N/A'),
      escapeCSV(nvr.hardDisk || 'N/A'),
      escapeCSV(nvr.channel || 'N/A'),
      escapeCSV(nvr.serialNumber || 'N/A'),
      escapeCSV(nvr.status || 'N/A')
    ]);

    const csvContent = "\uFEFF" + [ 
      headers.join(","), 
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Storage_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${filteredNVRs.length} records successfully`);
  };

  const stats = {
    total: nvrs.length,
    online: nvrs.filter(n => n.status === 'Online').length,
    offline: nvrs.filter(n => n.status === 'Offline').length
  };

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#3b82f6' },
    { name: 'OFFLINE', value: stats.offline, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <HardDrive className="mr-3 text-emerald-500" size={28} />
            NVR
          </h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => navigate('/nvr-mapping')} className="glass-panel flex items-center px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg">
            <Network size={16} className="mr-2" /> Camera Mapping
          </button>
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg">
            <Download size={18} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <>
              <label className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg cursor-pointer">
                <Upload size={18} className="mr-2" /> Upload CSV
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={openNewModal} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
                <Plus size={18} className="mr-2" />
                Add NVR
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-lg">
            <Server size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-indigo-400">{stats.total}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Total Assets</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20 shadow-lg">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-emerald-400">{stats.online}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Online NVRs</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-400 border border-orange-500/20 shadow-lg">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-orange-400">{stats.offline}</h3>
            <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Offline NVRs</p>
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
                  itemStyle={{ color: 'var(--text-main)' }}
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
              placeholder="Deep search by NVR Name, Asset Number, Location, Company or IP..."
              className="glass-input w-full !pl-12 pr-4 py-2.5 text-sm placeholder:text-slate-400"
            />
          </div>
          <button className="flex items-center px-5 py-2.5 rounded-xl border border-white/10 text-dim hover:text-main hover:bg-white/10 transition-all text-sm font-medium">
            <Filter size={18} className="mr-2" />
            Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Asset Number</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Info</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Location & Brand</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Specs (Disk/Chan)</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredNVRs.map((nvr, index) => (
                <tr 
                  key={nvr._id || nvr.id} 
                  className="group hover:bg-white/5 transition-all cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/nvr/${nvr._id || nvr.id}`);
                    }
                  }}
                >
                  <td className="p-5">
                    <span className="text-sm font-mono text-indigo-300 font-bold">{nvr.serialNumber || '—'}</span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors shadow-lg">
                        <Server size={24} className="text-indigo-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-main">{nvr.nvrName}</div>
                        <div className="text-xs text-dim mt-0.5 font-mono">IP: <span className="text-blue-300">{nvr.ipAddress || '—'}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center space-x-2 text-sm text-main font-bold">
                        <Building size={14} className="text-blue-400" />
                        <span>{nvr.block || '—'}</span>
                      </div>
                      <div className="text-[10px] text-dim font-black uppercase tracking-widest pl-5">
                        {nvr.collegeName || '—'}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-bold pl-5">
                        {nvr.brand || '—'} {nvr.model ? `(${nvr.model})` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-main font-bold">
                        <HardDrive size={14} className="text-teal-400" />
                        <span>{calculateTotalStorage(nvr.hardDisk)}</span>
                      </div>
                      <div className="text-[9px] text-dim font-black uppercase tracking-[0.2em]">
                        {nvr.hardDisk || 'No Storage'}
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-dim">
                        <Cpu size={14} className="text-dim/50" />
                        <span>{nvr.channel ? `${nvr.channel} Channels` : '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                      nvr.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                      nvr.status === 'Offline' ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' :
                      'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${nvr.status === 'Online' ? 'bg-emerald-400' : nvr.status === 'Offline' ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                      {nvr.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="p-5 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => navigate(`/devices/nvr/${nvr._id || nvr.id}`)} className="p-2 text-dim hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/30">
                          <Info size={16} />
                        </button>
                        <button onClick={() => editNVR(nvr)} className="p-2 text-dim hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all border border-transparent hover:border-blue-500/30">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteNVR(nvr._id || nvr.id)} className="p-2 text-dim hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/30">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredNVRs.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-dim">
                    <Server size={48} className="mx-auto text-dim mb-4 opacity-50" />
                    <p>No NVRs found matching this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl">
                  <Server className="text-teal-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify NVR' : 'NVR'}
                  </h2>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-secondary hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Identity & Location */}
                <div className="space-y-5">

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IP Protocol</label>
                      <input required type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="192.168.1.100" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IPv4 Gateway</label>
                      <input type="text" name="ipv4Gateway" value={formData.ipv4Gateway} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="192.168.1.1" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Subnet Mask</label>
                      <input type="text" name="subnetMask" value={formData.subnetMask} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="255.255.255.0" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">MAC Interface</label>
                      <input type="text" name="macAddress" value={formData.macAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="00:1A:2B:3C:4D:5E" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Name of the device</label>
                    <input required type="text" name="nvrName" value={formData.nvrName} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. Main Control NVR" />
                  </div>

                  {/* Location Intelligence Fields */}
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        College / Institution
                      </label>
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
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                          Block
                        </label>
                        <ComboInput 
                          required 
                          name="block" 
                          value={formData.block} 
                          onChange={handleInputChange} 
                          options={uniqueBlocks} 
                          placeholder="Block name..." 
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                          Floor Level
                        </label>
                        <ComboInput 
                          required 
                          name="floor" 
                          value={formData.floor} 
                          onChange={handleInputChange} 
                          options={uniqueFloors} 
                          placeholder="Floor level..." 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        Room / Specific Location
                      </label>
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

                {/* Column 2: Specs & Vendor */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Designation</label>
                      <ComboInput 
                        name="brand" 
                        value={formData.brand} 
                        onChange={handleInputChange} 
                        options={uniqueBrands} 
                        placeholder="Select or Type Brand..." 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model Number</label>
                      <input 
                        type="text" 
                        name="model" 
                        value={formData.model} 
                        onChange={handleInputChange} 
                        className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" 
                        placeholder="e.g. DS-7616NI-K2" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Hard Disk Configuration</label>
                      <button type="button" onClick={addStorageField} className="text-[9px] font-black text-teal-600 uppercase tracking-widest hover:text-teal-500 transition-all flex items-center">
                        <Plus size={10} className="mr-1" /> Add Disk
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {formData.storageList.map((disk, idx) => (
                        <div key={idx} className="flex space-x-3 animate-slide-in">
                          <input 
                            required
                            type="number" 
                            value={disk.size} 
                            onChange={(e) => handleStorageChange(idx, 'size', e.target.value)}
                            className="glass-input flex-1 p-4 text-sm bg-panel border-main shadow-inner" 
                            placeholder="Capacity" 
                          />
                          <select 
                            value={disk.unit} 
                            onChange={(e) => handleStorageChange(idx, 'unit', e.target.value)}
                            className="glass-input w-24 p-4 text-sm bg-panel border-main shadow-inner cursor-pointer"
                          >
                            <option value="TB">TB</option>
                            <option value="GB">GB</option>
                          </select>
                          {formData.storageList.length > 1 && (
                            <button type="button" onClick={() => removeStorageField(idx)} className="p-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl flex justify-between items-center">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Total Intelligence Storage:</span>
                      <span className="text-sm font-black text-teal-500">
                        {calculateTotalStorage(formData.storageList.filter(s => s.size).map(s => `${s.size} ${s.unit}`).join(' + '))}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Channel Logic</label>
                    <input type="text" name="channel" value={formData.channel} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. 32" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Asset Number</label>
                    </div>
                    <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="CCTV/NVR/01" />
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Operational Status</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Online', 'Offline'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, status: s})}
                          className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all ${
                            formData.status === s 
                              ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20' 
                              : 'bg-panel border-main text-secondary hover:text-main hover:bg-card shadow-inner'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-6 pt-10 border-t border-main shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black tracking-[0.2em] text-secondary hover:text-main uppercase transition-all">
                  Cancel
                </button>
                <button type="submit" className="glass-button px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl">
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
