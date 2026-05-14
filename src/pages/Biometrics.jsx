import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, Plus, Fingerprint, MapPin, Shield, X, Edit2, Trash2, Download, Activity, Building, Users, Upload, Info, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';

export default function Biometrics() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations } = useSiteStore();
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Identity:EDIT');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    type: 'Fingerprint',
    brand: 'ZKTECO',
    ipAddress: '',
    serverIp: '',
    serialNumber: '',
    status: 'Online'
  });

  const [isAddingNewCollege, setIsAddingNewCollege] = useState(false);
  const [isAddingNewBlock, setIsAddingNewBlock] = useState(false);
  const [isAddingNewFloor, setIsAddingNewFloor] = useState(false);
  const [isAddingNewRoom, setIsAddingNewRoom] = useState(false);
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);

  useEffect(() => {
    fetchDevices();
    fetchAllLocations();
  }, []);

  useEffect(() => {
    if (showModal && !editingId) {
      const prefix = 'IDENTITY/';
      const existingNumbers = devices
        .filter(d => (d.serialNumber || '').startsWith(prefix))
        .map(d => {
            const parts = (d.serialNumber || '').split('/');
            return parseInt(parts[parts.length - 1]) || 0;
        });
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      setFormData(prev => ({ ...prev, serialNumber: `${prefix}${formattedNumber}` }));
    }
  }, [showModal, editingId, devices]);

  const fetchDevices = async () => {
    try {
      const res = await api.get('/cameras/biometrics/');
      setDevices(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    devices.forEach(d => { if (d.collegeName) colleges.add(d.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    if (currentSite?.collegeName) colleges.add(currentSite.collegeName);
    return Array.from(colleges).sort();
  }, [devices, currentSite, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    devices.forEach(d => { if (d.block) blocks.add(d.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    if (currentSite?.block) blocks.add(currentSite.block);
    return Array.from(blocks).sort();
  }, [devices, currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    devices.forEach(d => { if (d.floor) floors.add(d.floor); });
    allLocations.forEach(loc => { if (loc.floor) floors.add(loc.floor); });
    if (currentSite?.floor) floors.add(currentSite.floor);
    return Array.from(floors).sort();
  }, [devices, currentSite, allLocations]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    devices.forEach(d => { if (d.room) rooms.add(d.room); });
    allLocations.forEach(loc => { if (loc.room) rooms.add(loc.room); });
    if (currentSite?.room) rooms.add(currentSite.room);
    return Array.from(rooms).sort();
  }, [devices, currentSite, allLocations]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    devices.forEach(d => { if (d.brand) brands.add(d.brand); });
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    if (currentSite?.brand) brands.add(currentSite.brand);
    // Common default brands
    ['ZKTECO', 'HIKVISION', 'DAHUA', 'ESL', 'MATRIX'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [devices, currentSite, allLocations]);

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

  const openNewModal = async () => {
    await fetchSite();
    setEditingId(null);

    const college = currentSite?.collegeName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';

    setIsAddingNewCollege(college && !uniqueColleges.includes(college));
    setIsAddingNewBlock(block && !uniqueBlocks.includes(block));
    setIsAddingNewFloor(floor && !uniqueFloors.includes(floor));
    setIsAddingNewRoom(room && !uniqueRooms.includes(room));

    setFormData({ 
      name: '', collegeName: college, block: block, floor: floor, room: room, 
      type: 'Fingerprint', brand: 'ZKTECO', ipAddress: '', serverIp: '', serialNumber: '', status: 'Online' 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/cameras/biometrics/${editingId}/`, formData);
        showNotification('Identity device updated');
      } else {
        await api.post('/cameras/biometrics/', formData);
        showNotification('New identity device registered');
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ 
        name: '', collegeName: '', block: '', floor: '', room: '', 
        type: 'Fingerprint', brand: 'ZKTECO', ipAddress: '', serverIp: '', serialNumber: '', status: 'Online' 
      });
      setIsAddingNewCollege(false);
      setIsAddingNewBlock(false);
      setIsAddingNewFloor(false);
      setIsAddingNewRoom(false);
      fetchDevices();
    } catch (err) {
      console.error(err);
      alert('Error saving biometric asset.');
    }
  };

  const editDevice = (device) => {
    setFormData({
      name: device.name,
      collegeName: device.collegeName || '',
      block: device.block || '',
      floor: device.floor || '',
      room: device.room || '',
      type: device.type,
      brand: device.brand,
      ipAddress: device.ipAddress,
      serverIp: device.serverIp || '',
      serialNumber: device.serialNumber,
      status: device.status
    });
    setEditingId(device.id || device._id);
    setShowModal(true);
  };

  const deleteDevice = async (id) => {
    if (window.confirm('WARNING: Securely purge this biometric identity node?')) {
      try {
        await api.delete(`/cameras/biometrics/${id}/`);
        showNotification('Identity node purged');
        fetchDevices();
      } catch (err) {
        console.error(err);
        alert('Error removing asset');
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/cameras/biometrics/upload_excel/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showNotification(`Import Complete: ${res.data.created} Added, ${res.data.updated} Updated`);
      fetchDevices();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to import data.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter(d => 
      (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.collegeName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.block || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.room || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.ipAddress || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [devices, searchQuery]);

  // Aggregated data for the summary table (Matching the User's Image)
  const summaryData = useMemo(() => {
    const summary = {};
    devices.forEach(d => {
      const key = `${d.name} - ${d.brand}`;
      if (!summary[key]) {
        summary[key] = { usage: d.name, brand: d.brand, count: 0 };
      }
      summary[key].count += 1;
    });
    return Object.values(summary);
  }, [devices]);

  const totalCount = useMemo(() => devices.length, [devices]);

  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'Online').length,
    offline: devices.filter(d => d.status === 'Offline').length
  };

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#3b82f6' },
    { name: 'OFFLINE', value: stats.offline, color: '#f59e0b' }
  ];

  const exportToExcel = () => {
    const headers = ['S.No', 'Serial Number', 'Usage', 'Brand', 'College', 'Block', 'Floor', 'Room', 'IP Address', 'Type', 'Status'];
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = filteredDevices.map((d, i) => [
      i + 1,
      escapeCSV(d.serialNumber || 'N/A'),
      escapeCSV(d.name || 'N/A'),
      escapeCSV(d.brand || 'N/A'),
      escapeCSV(d.collegeName || 'N/A'),
      escapeCSV(d.block || 'N/A'),
      escapeCSV(d.floor || 'N/A'),
      escapeCSV(d.room || 'N/A'),
      escapeCSV(d.ipAddress || 'N/A'),
      escapeCSV(d.type || 'N/A'),
      escapeCSV(d.status || 'N/A')
    ]);

    const csvContent = "\uFEFF" + [ 
      headers.join(","), 
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Identity_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${filteredDevices.length} records successfully`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-main">
            Biometric Nodes
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.2em] mt-1">Manage attendance hardware and biometric devices</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg">
            <Download size={18} className="mr-2" />
            Export CSV
          </button>
          {canEdit && (
            <>
              <label className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg cursor-pointer">
                <Upload size={18} className="mr-2" /> Upload CSV
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={openNewModal} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
                <Plus size={18} className="mr-2" />
                Add Device
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up delay-100">
        <div className="bg-card border border-main rounded-2xl p-6 flex items-center space-x-4 shadow-sm hover:border-teal-500/30 transition-all group">
          <div className="p-4 bg-teal-500/10 rounded-2xl text-teal-600 border border-teal-500/20 group-hover:scale-110 transition-transform">
            <Fingerprint size={24} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-main tracking-tighter">{stats.total}</h3>
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Total Nodes</p>
          </div>
        </div>

        <div className="bg-card border border-main rounded-2xl p-6 flex items-center space-x-4 shadow-sm hover:border-emerald-500/30 transition-all group">
          <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-600 border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <Building size={24} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-main tracking-tighter">{stats.online}</h3>
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Operational</p>
          </div>
        </div>

        <div className="bg-card border border-main rounded-2xl p-6 flex items-center space-x-4 shadow-sm hover:border-orange-500/30 transition-all group">
          <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-600 border border-orange-500/20 group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-main tracking-tighter">{stats.offline}</h3>
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Down/Issues</p>
          </div>
        </div>

        <div className="bg-card border border-main rounded-2xl p-4 flex items-center justify-center min-h-[120px] shadow-sm">
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
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col space-y-1">
              {chartData.map(d => (
                <div key={d.name} className="flex items-center text-[8px] font-black text-secondary uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: d.color }}></span>
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up delay-200">
        <div className="lg:col-span-1">
          <div className="bg-card border border-main rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-teal-500/10 p-4 border-b border-main text-center">
              <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Biometric Asset Summary</h3>
            </div>
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="bg-panel border-b border-main text-secondary uppercase tracking-widest">
                  <th className="p-3 font-black">Device</th>
                  <th className="p-3 font-black">Brand</th>
                  <th className="p-3 font-black text-right">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y border-main">
                {summaryData.map((item, i) => (
                  <tr key={i} className="hover:bg-panel transition-colors">
                    <td className="p-3 text-secondary font-bold">{item.usage}</td>
                    <td className="p-3 text-secondary font-bold">{item.brand}</td>
                    <td className="p-3 text-main font-black text-right">{item.count}</td>
                  </tr>
                ))}
                <tr className="bg-teal-500/5 font-black border-t border-main">
                  <td colSpan="2" className="p-3 text-teal-600 uppercase tracking-widest">Global Aggregate</td>
                  <td className="p-3 text-teal-600 text-right">{totalCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Search & Actions Area */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-main rounded-2xl h-full flex flex-col justify-center p-8 space-y-6 shadow-sm">
            <div className="relative group w-full">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search size={20} className="text-secondary group-focus-within:text-teal-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, location, brand or IP..."
                className="glass-input w-full !pl-14 pr-6 py-4 text-sm bg-panel border-main focus:border-teal-500 transition-all placeholder:text-secondary shadow-inner"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-secondary px-2 font-black uppercase tracking-[0.15em]">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                  System Status: <span className="text-emerald-600 ml-1">Operational</span>
                </div>
                <span>Last Synchronized: Just now</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-card border border-main rounded-2xl overflow-hidden shadow-sm animate-slide-up delay-300">
        <div className="p-6 border-b border-main bg-panel flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Fingerprint className="text-teal-500" size={20} />
            <h2 className="text-sm font-black text-main uppercase tracking-widest">Asset Registry</h2>
          </div>
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest">
            {filteredDevices.length} Nodes Found
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-panel border-b border-main text-main">
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Device Identity</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Serial Key</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Hardware Vendor</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Geographic Node</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Network Endpoint</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black uppercase tracking-widest text-right">Protocol</th>}
              </tr>
            </thead>
            <tbody className="divide-y border-main">
              {filteredDevices.map((device) => (
                <tr 
                  key={device.id || device._id} 
                  className="hover:bg-panel group transition-all cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/biometrics/${device.id || device._id}`);
                    }
                  }}
                >
                  <td className="p-5">
                    <div className="flex items-center">
                      <div className="p-3 bg-panel border border-main rounded-xl mr-4 text-secondary group-hover:text-teal-500 transition-colors">
                        <Fingerprint size={18} />
                      </div>
                      <span className="text-sm font-bold text-main">{device.name}</span>
                    </div>
                  </td>
                  <td className="p-5 text-xs font-mono text-secondary tracking-tighter">{device.serialNumber || '—'}</td>
                  <td className="p-5 text-xs font-black text-secondary uppercase tracking-widest">{device.brand}</td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-xs font-black text-main uppercase tracking-tight">
                        <Building size={14} className="mr-2 text-teal-600" />
                        {device.block || '—'}
                      </div>
                      <div className="text-[9px] text-secondary font-black uppercase tracking-[0.15em] pl-6">
                        {device.collegeName || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="p-5 text-xs font-mono text-teal-600 font-bold">{device.ipAddress || '—'}</td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      device.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }`}>
                      {device.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="p-5 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button onClick={() => navigate(`/devices/biometrics/${device.id || device._id}`)} className="p-2.5 text-secondary hover:text-teal-600 bg-panel border border-main rounded-xl transition-all">
                          <Info size={16} />
                        </button>
                        <button onClick={() => editDevice(device)} className="p-2.5 text-secondary hover:text-blue-600 bg-panel border border-main rounded-xl transition-all">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteDevice(device.id || device._id)} className="p-2.5 text-secondary hover:text-rose-600 bg-panel border border-main rounded-xl transition-all">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-dim">
                    <p>No biometric assets found.</p>
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
                  <Fingerprint className="text-teal-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify Biometric Asset' : 'Register New Biometric'}
                  </h2>
                  <p className="text-[10px] text-secondary mt-1 uppercase tracking-[0.3em] font-black">Identity Verification Protocol</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-secondary hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Column 1: Identity & Location */}
                <div className="space-y-6">
                  <h3 className="text-[11px] font-black text-teal-500 uppercase tracking-[0.4em] border-b border-main pb-3">Location & Details</h3>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Device Designation (Name)</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. Main Entry Gate" />
                  </div>

                  {/* Location Intelligence Fields */}
                  <div className="space-y-6 pt-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        College / Institution
                      </label>
                      {isAddingNewCollege ? (
                        <div className="relative">
                          <input required type="text" name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-4 text-sm border-teal-500/30 bg-panel shadow-inner" placeholder="Type new college..." />
                          <button type="button" onClick={() => setIsAddingNewCollege(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-main transition-all"><X size={16} /></button>
                        </div>
                      ) : (
                        <select required name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-4 text-sm cursor-pointer bg-panel border-main shadow-inner">
                          <option value="">Select Existing College</option>
                          {uniqueColleges.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                          Block
                        </label>
                        {isAddingNewBlock ? (
                          <div className="relative">
                            <input required type="text" name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-4 text-sm border-blue-500/30 bg-panel shadow-inner" placeholder="Block name..." />
                            <button type="button" onClick={() => setIsAddingNewBlock(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-main transition-all"><X size={16} /></button>
                          </div>
                        ) : (
                          <select required name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-4 text-sm cursor-pointer bg-panel border-main shadow-inner">
                            <option value="">Select Block</option>
                            {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                          Floor Level
                        </label>
                        {isAddingNewFloor ? (
                          <div className="relative">
                            <input required type="text" name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-4 text-sm border-blue-500/30 bg-panel shadow-inner" placeholder="Floor level..." />
                            <button type="button" onClick={() => setIsAddingNewFloor(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-main transition-all"><X size={16} /></button>
                          </div>
                        ) : (
                          <select required name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-4 text-sm cursor-pointer bg-panel border-main shadow-inner">
                            <option value="">Select Floor</option>
                            {uniqueFloors.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                     <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        Room / Specific Location
                      </label>
                      {isAddingNewRoom ? (
                        <div className="relative">
                          <input required type="text" name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-4 text-sm border-main bg-panel shadow-inner" placeholder="Type new room..." />
                          <button type="button" onClick={() => setIsAddingNewRoom(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-main transition-all"><X size={16} /></button>
                        </div>
                      ) : (
                        <select required name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-4 text-sm cursor-pointer bg-panel border-main shadow-inner">
                          <option value="">Select Room</option>
                          {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column 2: Specs & Hardware */}
                <div className="space-y-6">
                  <h3 className="text-[11px] font-black text-teal-500 uppercase tracking-[0.4em] border-b border-main pb-3">Hardware & Status</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Name</label>
                      {isAddingNewBrand ? (
                        <div className="relative">
                          <input required type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-4 text-sm border-teal-500/30 bg-panel shadow-inner" placeholder="Type new brand..." />
                          <button type="button" onClick={() => setIsAddingNewBrand(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary hover:text-main"><X size={16} /></button>
                        </div>
                      ) : (
                        <select name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-4 text-sm cursor-pointer bg-panel border-main shadow-inner font-bold text-white">
                          <option value="">Select Brand</option>
                          {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                          <option value="NEW">+ Add New Brand</option>
                        </select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Device IP Protocol</label>
                      <input required type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="192.168.1.100" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Server IP Address</label>
                      <input type="text" name="serverIp" value={formData.serverIp} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-blue-500 bg-panel border-main shadow-inner" placeholder="192.168.1.200" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Serial Number</label>
                    </div>
                    <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="BIO/01" />
                  </div>

                  <div className="space-y-4 pt-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Operational Status</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Online', 'Offline', 'Maintenance'].map((s) => (
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

              <div className="flex justify-end space-x-6 mt-10 pt-8 border-t border-main shrink-0 px-2 pb-2">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black text-secondary hover:text-main uppercase tracking-[0.2em] transition-colors">Abort Protocol</button>
                <button 
                  type="submit" 
                  className="glass-button px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl"
                >
                  {editingId ? 'SAVE ASSET' : 'INITIALIZE ASSET'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
