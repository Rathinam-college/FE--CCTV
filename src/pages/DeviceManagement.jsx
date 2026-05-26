import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, Plus, Camera as CameraIcon, Server, Fingerprint, Lock, Shield, X, Edit2, Trash2, HardDrive, Cpu, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSiteStore } from '../store/siteStore';

export default function DeviceManagement() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('CAMERAS'); // 'CAMERAS', 'STORAGE', 'IDENTITY', 'NETWORK'
  const [searchQuery, setSearchQuery] = useState('');

  // Data States
  const [cameras, setCameras] = useState([]);
  const [nvrs, setNvrs] = useState([]);
  const [biometrics, setBiometrics] = useState([
    { id: 1, name: 'Staff Attendance Machine', location: 'HR Office', type: 'Fingerprint', brand: 'ZKTeco', ipAddress: '192.168.2.10', syncStatus: 'In Sync', lastCheckIn: '10 mins ago', status: 'Online' },
    { id: 2, name: 'Student Face Access', location: 'Main Library', type: 'Face', brand: 'ZKTeco', ipAddress: '192.168.2.11', syncStatus: 'Syncing...', lastCheckIn: '2 mins ago', status: 'Online' }
  ]);
  const [barriers, setBarriers] = useState([
    { id: 1, name: 'Parking Boom Barrier', location: 'Main Entrance', type: 'Boom Barrier', gateStatus: 'Closed', controller: 'FAAC-X80', lastUsed: '5 mins ago', status: 'Online' },
    { id: 2, name: 'Hostel Flap Barrier', location: 'Girls Hostel', type: 'Flap Barrier', gateStatus: 'Open', controller: 'FAAC-F10', lastUsed: '1 min ago', status: 'Online' }
  ]);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Unified Form State for Adding/Editing
  const [formData, setFormData] = useState({
    name: '', 
    collegeName: '',
    block: '', 
    floor: '', 
    room: '',
    ipAddress: '', brand: '', status: 'Online',
    recordingStatus: 'Recording', lastActive: 'Just Now',
    channels: '16', hardDisk: '8TB', connectedCameras: '12', storageStatus: 'Healthy',
    type: 'Fingerprint', syncStatus: 'In Sync', lastCheckIn: 'Just Now',
    gateStatus: 'Closed', controller: '', lastUsed: 'Just Now',
    deviceType: '', ipv4Gateway: '',
    deviceSerialNumber: '', subnetMask: '', macAddress: ''
  });

  const { allLocations, fetchAllLocations } = useSiteStore();

  useEffect(() => {
    fetchCameras();
    fetchNVRs();
    fetchBiometrics();
    fetchBarriers();
    fetchAllLocations();
  }, []);


  const fetchCameras = async () => {
    try {
      const res = await api.get('/cameras/');
      setCameras(res.data.map(c => ({
        id: c.id,
        name: c.deviceType || c.name || `CAM-${c.id}`,
        cameraId: c.cameraId || c.serialNumber || `CAM-${c.id}`,
        location: c.siteName || `${c.collegeName} | ${c.block} | ${c.floor} | ${c.room}` || 'Unknown',
        ipAddress: c.ipAddress || '—',
        brand: c.brand || 'Hikvision',
        recordingStatus: c.recordingStatus || 'Recording',
        lastActive: c.lastActive || '2 mins ago',
        status: c.status || 'Online',
        block: c.block || '',
        floor: c.floor || '',
        deviceType: c.deviceType || '',
        ipv4Gateway: c.gateway || '',
        deviceSerialNumber: c.serialNumber || '',
        subnetMask: c.subnetMask || '',
        macAddress: c.macAddress || '',
        campusZone: c.campusZone || ''
      })));
    } catch (err) { console.error(err); }
  };

  const fetchNVRs = async () => {
    try {
      const res = await api.get('/cameras/nvrs/');
      setNvrs(res.data.map(n => ({
        id: n.id,
        name: n.nvrName || `NVR-${n.id}`,
        location: n.location || `${n.collegeName} | ${n.block} | ${n.floor} | ${n.room}` || 'Unknown',
        ipAddress: n.ipAddress || '—',
        channels: n.channel || '16ch',
        hardDisk: n.hardDisk || '4TB',
        connectedCameras: n.connectedCameras || '8',
        storageStatus: n.storageStatus || 'Healthy',
        status: n.status || 'Online'
      })));
    } catch (err) { console.error(err); }
  };

  const fetchBiometrics = async () => {
    try {
      const res = await api.get('/cameras/biometrics/');
      setBiometrics(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchBarriers = async () => {
    try {
      const res = await api.get('/cameras/barriers/');
      setBarriers(res.data);
    } catch (err) { console.error(err); }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({
      name: '', collegeName: '', block: '', floor: '', room: '',
      ipAddress: '', brand: 'Hikvision', status: 'Online',
      recordingStatus: 'Recording', lastActive: 'Just Now',
      channels: '16', hardDisk: '8TB', connectedCameras: '12', storageStatus: 'Healthy',
      type: 'Fingerprint', syncStatus: 'In Sync', lastCheckIn: 'Just Now',
      gateStatus: 'Closed', controller: '', lastUsed: 'Just Now',
      deviceType: '', ipv4Gateway: '',
      deviceSerialNumber: '', subnetMask: '', macAddress: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'CAMERAS') {
      const payload = {
        cameraId: formData.deviceSerialNumber || `CAM-${Date.now()}`,
        name: formData.deviceType || formData.name || 'Unknown Device',
        siteName: `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room}`,
        collegeName: formData.collegeName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        ipAddress: formData.ipAddress,
        status: formData.status,
        deviceType: formData.deviceType,
        gateway: formData.ipv4Gateway,
        serialNumber: formData.deviceSerialNumber,
        subnetMask: formData.subnetMask,
        macAddress: formData.macAddress
      };
      try {
        if (editingId) await api.put(`/cameras/${editingId}/`, payload);
        else await api.post('/cameras/', payload);
        fetchCameras();
      } catch (e) { alert('Error saving camera.'); }
    } 
    else if (activeTab === 'STORAGE') {
      const payload = {
        ipAddress: formData.ipAddress,
        nvrName: formData.name,
        collegeName: formData.collegeName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room}`,
        channel: formData.channels,
        hardDisk: formData.hardDisk,
        status: formData.status,
        serialNumber: `SN-${Date.now()}`
      };
      try {
        if (editingId) await api.put(`/cameras/nvrs/${editingId}/`, payload);
        else await api.post('/cameras/nvrs/', payload);
        fetchNVRs();
      } catch (e) { alert('Error saving NVR.'); }
    } 
    else if (activeTab === 'IDENTITY') {
      const payload = {
        name: formData.name,
        collegeName: formData.collegeName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room}`,
        type: formData.type,
        brand: formData.brand,
        ipAddress: formData.ipAddress,
        syncStatus: formData.syncStatus,
        lastCheckIn: formData.lastCheckIn,
        status: formData.status
      };
      try {
        if (editingId) await api.put(`/cameras/biometrics/${editingId}/`, payload);
        else await api.post('/cameras/biometrics/', payload);
        fetchBiometrics();
      } catch (e) { alert('Error saving biometric device.'); }
    } 
    else if (activeTab === 'NETWORK') {
      const payload = {
        name: formData.name,
        location: formData.location,
        type: formData.type,
        gateStatus: formData.gateStatus,
        controller: formData.controller,
        lastUsed: formData.lastUsed,
        status: formData.status
      };
      try {
        if (editingId) await api.put(`/cameras/barriers/${editingId}/`, payload);
        else await api.post('/cameras/barriers/', payload);
        fetchBarriers();
      } catch (e) { alert('Error saving gate barrier.'); }
    }
    setShowModal(false);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to remove this device?')) return;
    if (activeTab === 'CAMERAS') {
      await api.delete(`/cameras/${id}/`);
      fetchCameras();
    } else if (activeTab === 'STORAGE') {
      await api.delete(`/cameras/nvrs/${id}/`);
      fetchNVRs();
    } else if (activeTab === 'IDENTITY') {
      await api.delete(`/cameras/biometrics/${id}/`);
      fetchBiometrics();
    } else if (activeTab === 'NETWORK') {
      await api.delete(`/cameras/barriers/${id}/`);
      fetchBarriers();
    }
  };

  const editItem = (item) => {
    setFormData({ ...formData, ...item });
    setEditingId(item.id);
    setShowModal(true);
  };

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === 'CAMERAS') return cameras.filter(c => c.name.toLowerCase().includes(query) || c.location.toLowerCase().includes(query));
    if (activeTab === 'STORAGE') return nvrs.filter(n => n.name.toLowerCase().includes(query) || n.location.toLowerCase().includes(query));
    if (activeTab === 'IDENTITY') return biometrics.filter(b => b.name.toLowerCase().includes(query) || b.location.toLowerCase().includes(query));
    if (activeTab === 'NETWORK') return barriers.filter(b => b.name.toLowerCase().includes(query) || b.location.toLowerCase().includes(query));
    return [];
  }, [activeTab, cameras, nvrs, biometrics, barriers, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold text-main tracking-tight">Device Management</h1>
        <p className="text-sm text-dim mt-1">Track, configure, and organize deployment assets.</p>
      </div>

      {/* Top Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
        <button onClick={() => setActiveTab('CAMERAS')} className={`glass-panel p-5 flex flex-col items-center justify-center text-center transition-all ${activeTab === 'CAMERAS' ? 'ring-2 ring-blue-500 bg-blue-500/10' : 'hover:bg-white/5'}`}>
          <CameraIcon size={28} className={`${activeTab === 'CAMERAS' ? 'text-blue-400' : 'text-dim'}`} strokeWidth={1.5} />
          <span className={`mt-3 font-bold text-[13px] ${activeTab === 'CAMERAS' ? 'text-blue-400' : 'text-dim'}`}>Assets</span>
          <div className="mt-2 flex space-x-3 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-dim">TOTAL: {cameras.length}</span>
            <span className="text-emerald-500">LIVE: {cameras.filter(c => c.status === 'Online').length}</span>
            <span className="text-red-500">DOWN: {cameras.filter(c => c.status !== 'Online').length}</span>
          </div>
        </button>

        <button onClick={() => setActiveTab('STORAGE')} className={`glass-panel p-5 flex flex-col items-center justify-center text-center transition-all ${activeTab === 'STORAGE' ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:bg-white/5'}`}>
          <Server size={28} className={`${activeTab === 'STORAGE' ? 'text-indigo-400' : 'text-dim'}`} strokeWidth={1.5} />
          <span className={`mt-3 font-bold text-[13px] ${activeTab === 'STORAGE' ? 'text-indigo-400' : 'text-dim'}`}>Storage Units</span>
          <div className="mt-2 flex space-x-3 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-dim">TOTAL: {nvrs.length}</span>
            <span className="text-emerald-500">LIVE: {nvrs.filter(n => n.status === 'Online').length}</span>
            <span className="text-red-500">DOWN: {nvrs.filter(n => n.status !== 'Online').length}</span>
          </div>
        </button>

        <button onClick={() => setActiveTab('IDENTITY')} className={`glass-panel p-5 flex flex-col items-center justify-center text-center transition-all ${activeTab === 'IDENTITY' ? 'ring-2 ring-purple-500 bg-purple-500/10' : 'hover:bg-white/5'}`}>
          <Fingerprint size={28} className={`${activeTab === 'IDENTITY' ? 'text-purple-400' : 'text-dim'}`} strokeWidth={1.5} />
          <span className={`mt-3 font-bold text-[13px] ${activeTab === 'IDENTITY' ? 'text-purple-400' : 'text-dim'}`}>Identity Access</span>
          <div className="mt-2 flex space-x-3 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-dim">TOTAL: {biometrics.length}</span>
            <span className="text-emerald-500">LIVE: {biometrics.filter(b => b.status === 'Online').length}</span>
            <span className="text-red-500">DOWN: {biometrics.filter(b => b.status !== 'Online').length}</span>
          </div>
        </button>

        <button onClick={() => setActiveTab('NETWORK')} className={`glass-panel p-5 flex flex-col items-center justify-center text-center transition-all ${activeTab === 'NETWORK' ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : 'hover:bg-white/5'}`}>
          <Lock size={28} className={`${activeTab === 'NETWORK' ? 'text-emerald-400' : 'text-dim'}`} strokeWidth={1.5} />
          <span className={`mt-3 font-bold text-[13px] ${activeTab === 'NETWORK' ? 'text-emerald-400' : 'text-dim'}`}>Network Nodes</span>
          <div className="mt-2 flex space-x-3 text-[10px] font-bold uppercase tracking-widest">
            <span className="text-dim">TOTAL: {barriers.length}</span>
            <span className="text-emerald-500">LIVE: {barriers.filter(b => b.status === 'Online').length}</span>
            <span className="text-red-500">DOWN: {barriers.filter(b => b.status !== 'Online').length}</span>
          </div>
        </button>
      </div>

      {/* Search Bar & Action */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row gap-4 items-center animate-slide-up delay-100 mt-6">
        <div className="relative flex-1 w-full flex items-center bg-black/20 rounded-xl border border-white/5">
          <Search className="absolute left-4 text-dim" size={18} />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder={`Search ${activeTab.toLowerCase()} devices...`} 
            className="w-full !pl-14 pr-4 py-3 bg-transparent text-[13px] text-main placeholder-dim focus:outline-none" 
          />
        </div>
        <button onClick={openNewModal} className="glass-button flex items-center px-6 py-3 text-[13px] shrink-0">
          <Plus size={16} className="mr-2" /> Add Device
        </button>
      </div>

      {/* Grid Container */}
      <div className="animate-slide-up delay-100 mt-6">
        {activeTab === 'CAMERAS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredData.map((item) => (
              <div key={item.id} onClick={() => navigate(`/devices/cameras/${item.id}`)} className="glass-panel p-5 hover:border-blue-500/50 cursor-pointer relative group transition-all flex flex-col hover:bg-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                      <CameraIcon size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-main tracking-wide">{item.name}</h4>
                      <p className="text-[11px] text-dim mt-0.5">{item.location}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold tracking-wider border ${item.status === 'Online' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                    {item.status}
                  </span>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">IP Address</span>
                    <p className="text-[12px] font-mono text-blue-400 mt-1">{item.ipAddress}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">Recording</span>
                    <p className="text-[12px] text-dim mt-1">{item.recordingStatus}</p>
                  </div>
                </div>

                <div className="absolute top-4 right-20 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); editItem(item); }} className="p-1.5 text-dim hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-1.5 text-dim hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'STORAGE' && (
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold text-dim uppercase tracking-widest bg-black/20">
                    <th className="p-4 pl-6">Storage Identification</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">Channels</th>
                    <th className="p-4">Capacity</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[13px] text-gray-300">
                  {filteredData.map((item) => (
                    <tr key={item.id} onClick={() => navigate(`/devices/nvr/${item.id}`)} className="hover:bg-white/5 cursor-pointer transition-colors group">
                      <td className="p-4 pl-6 font-bold text-main flex items-center space-x-3">
                        <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
                          <Server size={14} className="text-indigo-400" />
                        </div>
                        <span>{item.name}</span>
                      </td>
                      <td className="p-4 text-dim text-[12px]">{item.location}</td>
                      <td className="p-4 font-mono text-blue-400 text-[12px]">{item.ipAddress}</td>
                      <td className="p-4 text-dim text-[12px]">{item.channels}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-[12px] text-main">{item.hardDisk}</span>
                          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">{item.storageStatus}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider border ${item.status === 'Online' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); editItem(item); }} className="text-dim hover:text-indigo-400"><Edit2 size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="text-dim hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'IDENTITY' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredData.map((item) => (
              <div key={item.id} onClick={() => navigate(`/devices/biometrics/${item.id}`)} className="glass-panel p-5 hover:border-purple-500/50 cursor-pointer relative group transition-all flex flex-col hover:bg-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/30">
                      <Fingerprint size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-main tracking-wide">{item.name}</h4>
                      <p className="text-[11px] text-dim mt-0.5">{item.location}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold tracking-wider border ${item.status === 'Online' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                    {item.status}
                  </span>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">Type / IP Address</span>
                    <p className="text-[12px] font-mono text-blue-400 mt-1">{item.type} <span className="text-dim">•</span> {item.ipAddress}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">Sync Status</span>
                    <p className="text-[12px] text-dim mt-1">{item.syncStatus}</p>
                  </div>
                </div>

                <div className="absolute top-4 right-20 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); editItem(item); }} className="p-1.5 text-dim hover:text-purple-400 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-1.5 text-dim hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'NETWORK' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData.map((item) => (
              <div key={item.id} onClick={() => navigate(`/devices/switches/${item.id}`)} className="glass-panel p-5 hover:border-emerald-500/50 cursor-pointer relative group transition-all flex flex-col hover:bg-white/5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                      <Lock size={20} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-main tracking-wide">{item.name}</h4>
                      <p className="text-[11px] text-dim mt-0.5">{item.location}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold tracking-wider border ${item.gateStatus === 'Open' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'}`}>
                    {item.gateStatus}
                  </span>
                </div>
                
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">Controller ID</span>
                    <p className="text-[12px] font-mono text-dim mt-1">{item.controller}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-dim uppercase font-bold tracking-widest">Last Used</span>
                    <p className="text-[12px] text-dim mt-1">{item.lastUsed}</p>
                  </div>
                </div>

                <div className="absolute top-4 right-20 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); editItem(item); }} className="p-1.5 text-dim hover:text-emerald-400 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-1.5 text-dim hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Simple Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-xl overflow-hidden p-6 space-y-4 border-white/20 shadow-2xl">
            <h2 className="text-lg font-bold text-main flex items-center space-x-2">
              <Shield className="text-blue-600" /> <span>{editingId ? 'Modify Device' : 'Register New Device'}</span>
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 col-span-2">
                  <div>
                    <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">COLLEGE</label>
                    <select 
                      name="collegeName" 
                      value={formData.collegeName} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-2 text-sm"
                    >
                      <option value="">Select College</option>
                      {Array.from(new Set(allLocations.map(l => l.collegeName))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">BLOCK</label>
                    <select 
                      name="block" 
                      value={formData.block} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-2 text-sm"
                    >
                      <option value="">Select Block</option>
                      {Array.from(new Set(allLocations.filter(l => l.collegeName === formData.collegeName).map(l => l.block))).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">FLOOR</label>
                    <select 
                      name="floor" 
                      value={formData.floor} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-2 text-sm"
                    >
                      <option value="">Select Floor</option>
                      {Array.from(new Set(allLocations.filter(l => l.block === formData.block).map(l => l.floor))).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">ROOM</label>
                    <select 
                      name="room" 
                      value={formData.room} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-2 text-sm"
                    >
                      <option value="">Select Room</option>
                      {Array.from(new Set(allLocations.filter(l => l.floor === formData.floor).map(l => l.room))).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {activeTab === 'CAMERAS' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">DEVICE TYPE</label>
                      <input required name="deviceType" value={formData.deviceType || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">IP ADDRESS</label>
                      <input required name="ipAddress" value={formData.ipAddress || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">IPv4 GATE WAY</label>
                      <input name="ipv4Gateway" value={formData.ipv4Gateway || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">DEVICE SERIAL NUMBER</label>
                      <input required name="deviceSerialNumber" value={formData.deviceSerialNumber || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">SUBNET MASK</label>
                      <input name="subnetMask" value={formData.subnetMask || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">MAC ADDRESS</label>
                      <input name="macAddress" value={formData.macAddress || ''} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Device Name</label>
                      <input required name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">IP Address</label>
                      <input required name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                  </>
                )}

                {activeTab === 'NVR' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Channels</label>
                      <input name="channels" value={formData.channels} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Hard Disk Size</label>
                      <input name="hardDisk" value={formData.hardDisk} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                  </>
                )}

                {activeTab === 'BIOMETRIC' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Type</label>
                      <select name="type" value={formData.type} onChange={handleInputChange} className="glass-input w-full p-2 text-sm [&>option]:bg-gray-900 [&>option]:text-main cursor-pointer">
                        <option value="Fingerprint">Fingerprint</option>
                        <option value="Face">Face</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Brand</label>
                      <input name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                  </>
                )}

                {activeTab === 'BARRIERS' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Barrier Type</label>
                      <input name="type" value={formData.type} onChange={handleInputChange} className="glass-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Gate Status</label>
                      <select name="gateStatus" value={formData.gateStatus} onChange={handleInputChange} className="glass-input w-full p-2 text-sm [&>option]:bg-gray-900 [&>option]:text-main cursor-pointer">
                        <option value="Closed">Closed</option>
                        <option value="Open">Open</option>
                        <option value="Fault">Fault</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-dim uppercase tracking-wider mb-1">Operational Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="glass-input w-full p-2 text-sm [&>option]:bg-gray-900 [&>option]:text-main cursor-pointer">
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-dim hover:text-main transition-colors">Cancel</button>
                <button type="submit" className="glass-button px-5 py-2 text-xs font-bold">Save Device</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Details Modal */}
      {showDetailsModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-2xl overflow-hidden animate-scale-up border-white/20">
            {/* Header */}
            <div className="p-6 bg-white/5 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                {activeTab === 'CAMERAS' && <CameraIcon className="text-blue-400 w-6 h-6" />}
                {activeTab === 'NVR' && <Server className="text-indigo-400 w-6 h-6" />}
                {activeTab === 'BIOMETRIC' && <Fingerprint className="text-purple-400 w-6 h-6" />}
                {activeTab === 'BARRIERS' && <Lock className="text-emerald-400 w-6 h-6" />}
                <div>
                  <h3 className="text-xl font-bold text-main leading-tight">{selectedDevice.name}</h3>
                  <span className="text-xs text-dim font-mono">{selectedDevice.ipAddress}</span>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 text-dim hover:text-main hover:bg-white/10 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Main Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <span className="text-xs text-dim uppercase font-bold tracking-wide">Deployment Site</span>
                  <p className="text-main font-semibold text-base mt-1">{selectedDevice.location}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <span className="text-xs text-dim uppercase font-bold tracking-wide">Hardware Status</span>
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${selectedDevice.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {selectedDevice.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {activeTab === 'CAMERAS' && (
                  <>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Brand / Model</span>
                      <p className="text-main font-semibold mt-1">{selectedDevice.brand}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Recording Stream</span>
                      <p className="text-blue-400 font-semibold mt-1 flex items-center"><Database size={16} className="mr-1.5" /> {selectedDevice.recordingStatus}</p>
                    </div>
                  </>
                )}

                {activeTab === 'NVR' && (
                  <>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Connected Channels</span>
                      <p className="text-main font-semibold mt-1">{selectedDevice.channels} (Total) | {selectedDevice.connectedCameras} Cameras</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Storage Capacity</span>
                      <p className="text-indigo-400 font-semibold mt-1 flex items-center"><HardDrive size={16} className="mr-1.5" /> {selectedDevice.hardDisk} ({selectedDevice.storageStatus})</p>
                    </div>
                  </>
                )}

                {activeTab === 'BIOMETRIC' && (
                  <>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Authentication Type</span>
                      <p className="text-main font-semibold mt-1">{selectedDevice.type} ({selectedDevice.brand})</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Sync State</span>
                      <p className="text-purple-400 font-semibold mt-1 flex items-center"><Cpu size={16} className="mr-1.5" /> {selectedDevice.syncStatus}</p>
                    </div>
                  </>
                )}

                {activeTab === 'BARRIERS' && (
                  <>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Barrier Controller ID</span>
                      <p className="text-main font-mono mt-1">{selectedDevice.controller || 'UNKNOWN_SERIAL'}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-xs text-dim uppercase font-bold tracking-wide">Gate Status</span>
                      <p className="text-emerald-400 font-semibold mt-1">{selectedDevice.gateStatus}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end space-x-3">
              <button onClick={() => setShowDetailsModal(false)} className="glass-panel px-6 py-2.5 text-sm font-bold transition-colors">
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
