import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Search, Plus, Fingerprint, MapPin, Shield, X, Edit2, Trash2, Download, Activity, Building, Users, Upload, Info, ChevronRight, ChevronLeft, Filter, Printer } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useSiteStore } from '../store/siteStore';
import ComboInput from '../components/ComboInput';

export default function Biometrics() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, divisions, fetchDivisions, brands, fetchBrands } = useSiteStore();
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  
  // Advanced Filter State
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL'); // Campus zone
  const [typeFilter, setTypeFilter] = useState('ALL');

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Biometric:EDIT');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    type: 'Fingerprint',
    brand: '',
    model: '',
    ipAddress: '',
    serverIp: '',
    serialNumber: '',
    macAddress: '',
    usage: '',
    status: 'Online'
  });


  useEffect(() => {
    fetchDevices();
    fetchAllLocations();
    fetchDivisions();
    fetchBrands();
  }, []);

  useEffect(() => {
    if (showModal && !editingId) {
      localStorage.setItem('cctv_draft_biometric', JSON.stringify(formData));
    }
  }, [formData, showModal, editingId]);

  // Auto-generation logic moved to openNewModal to prevent stale state issues

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
    if (divisions) divisions.forEach(o => o.name && colleges.add(o.name.toUpperCase()));
    return Array.from(colleges).sort();
  }, [divisions]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    allLocations.forEach(loc => { 
      if (loc.block) blocks.add(String(loc.block).toUpperCase().trim()); 
    });
    if (currentSite?.block) blocks.add(String(currentSite.block).toUpperCase().trim());
    return Array.from(blocks).sort();
  }, [currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetBlock = String(formData.block || '').trim();
    allLocations.forEach(loc => { 
      const matchBlock = !targetBlock || String(loc.block || '').toUpperCase().trim() === targetBlock.toUpperCase();
      if (matchBlock && loc.floor) floors.add(String(loc.floor).toUpperCase().trim()); 
    });
    if (!targetBlock && currentSite?.floor) floors.add(String(currentSite.floor).toUpperCase().trim());
    return Array.from(floors).sort();
  }, [currentSite, allLocations, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetBlock = String(formData.block || '').trim();
    const targetFloor = String(formData.floor || '').trim();
    
    allLocations.forEach(loc => {
      const matchBlock = !targetBlock || String(loc.block || '').toUpperCase().trim() === targetBlock.toUpperCase();
      const matchFloor = !targetFloor || String(loc.floor || '').toUpperCase().trim() === targetFloor.toUpperCase();
      
      if (matchBlock && matchFloor && loc.room) {
        rooms.add(String(loc.room).toUpperCase().trim());
      }
    });
    
    return Array.from(rooms).sort();
  }, [allLocations, formData.block, formData.floor]);

  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set();
    if (brands) brands.forEach(b => b.name && brandsSet.add(b.name.toUpperCase()));
    return Array.from(brandsSet).sort();
  }, [brands]);

  const uniqueTypes = useMemo(() => {
    const types = new Set();
    devices.forEach(d => { if (d.type) types.add(d.type); });
    return Array.from(types).sort();
  }, [devices]);

  const filterCounts = useMemo(() => {
    const counts = { college: {}, block: {}, floor: {}, room: {}, type: {} };
    devices.forEach(d => {
      const college = String(d.divisionName || '').toUpperCase();
      const block = String(d.block || '').toUpperCase();
      const floor = String(d.floor || '').toUpperCase();
      const room = String(d.room || '').toUpperCase();
      const type = String(d.type || '');

      counts.college[college] = (counts.college[college] || 0) + 1;
      counts.block[block] = (counts.block[block] || 0) + 1;
      counts.floor[floor] = (counts.floor[floor] || 0) + 1;
      counts.room[room] = (counts.room[room] || 0) + 1;
      counts.type[type] = (counts.type[type] || 0) + 1;
    });
    return counts;
  }, [devices]);


  const handleInputChange = (e) => {
    const { name, value, type } = e.target;

    let newValue = value;
    if (type === 'text') {
      newValue = value.toUpperCase();
    }
    // Helper for IP Formatting (Dots) - strictly manual entry
    const applyIPMask = (val) => {
      let cleaned = val.replace(/[^0-9.]/g, '');
      cleaned = cleaned.replace(/\.+/g, '.');
      let parts = cleaned.split('.');
      if (parts.length > 4) parts = parts.slice(0, 4);
      parts = parts.map(part => part.slice(0, 3));
      return parts.join('.');
    };

    // Helper for MAC Formatting (Colons) - strictly manual entry
    const applyMACMask = (val) => {
      let cleaned = val.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      let parts = [];
      for (let i = 0; i < cleaned.length; i += 2) {
        parts.push(cleaned.substring(i, i + 2));
      }
      return parts.slice(0, 6).join(':');
    };

    if (['ipAddress', 'serverIp', 'ipv4Gateway', 'subnetMask'].includes(name)) {
      newValue = applyIPMask(value);
    } else if (name === 'macAddress') {
      newValue = applyMACMask(value);
    }
    setFormData(prev => {
      const nextData = { ...prev, [name]: newValue };

      // Auto-populate brand if location is found in Master Registry
      if (['divisionName', 'block', 'floor', 'room'].includes(name)) {
        const matchingLoc = allLocations.find(loc =>
          (loc.divisionName || '').toUpperCase() === (name === 'divisionName' ? newValue : (prev.divisionName || '')).toUpperCase() &&
          (loc.block || '').toUpperCase() === (name === 'block' ? newValue : (prev.block || '')).toUpperCase() &&
          (loc.floor || '').toUpperCase() === (name === 'floor' ? newValue : (prev.floor || '')).toUpperCase() &&
          (loc.room || '').toUpperCase() === (name === 'room' ? newValue : (prev.room || '')).toUpperCase()
        );
        if (matchingLoc && matchingLoc.brand) {
          nextData.brand = matchingLoc.brand.toUpperCase();
        }
      }
      return nextData;
    });
  };

  const openNewModal = async () => {
    await fetchSite();
    
    // Fetch fresh devices list to guarantee accurate serial number generation
    let currentDevices = devices;
    try {
      const res = await api.get('/cameras/biometrics/', { params: { t: new Date().getTime() } });
      currentDevices = res.data;
      setDevices(res.data);
    } catch (err) {
      console.error('Failed to fetch fresh devices for serial generation:', err);
    }

    setEditingId(null);

    const college = currentSite?.divisionName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';

    const prefix = 'IDENTITY/';
    const existingNumbers = currentDevices
      .filter(d => (d.serialNumber || '').toUpperCase().startsWith(prefix))
      .map(d => {
        const parts = (d.serialNumber || '').split('/');
        return parseInt(parts[parts.length - 1]) || 0;
      });
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const formattedNumber = nextNumber.toString().padStart(2, '0');

    setFormData({
      name: '', divisionName: college, block: block, floor: floor, room: room,
      type: 'Fingerprint', brand: '', model: '', ipAddress: '', ipv4Gateway: '', subnetMask: '', serverIp: '', serialNumber: `${prefix}${formattedNumber}`, hardwareSerial: '', macAddress: '', status: 'Online'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const submitData = {
        ...formData,
        name: formData.name?.trim() || formData.type || 'Unknown Biometric',
        location: formData.room || formData.block || 'Unknown',
        gateway: formData.ipv4Gateway || '',
      };

      if (!submitData.serialNumber || submitData.serialNumber.trim() === '') {
        submitData.serialNumber = null;
      }

      if (editingId) {
        await api.put(`/cameras/biometrics/${editingId}/`, submitData);
        showNotification('Identity device updated');
      } else {
        await api.post('/cameras/biometrics/', submitData);
        showNotification('New identity device registered');
        try {
          localStorage.setItem('cctv_last_biometric', JSON.stringify({
            name: formData.name,
            divisionName: formData.divisionName,
            block: formData.block,
            floor: formData.floor,
            room: formData.room,
            type: formData.type,
            brand: formData.brand,
            model: formData.model,
            ipAddress: formData.ipAddress,
            ipv4Gateway: formData.ipv4Gateway,
            subnetMask: formData.subnetMask,
            serverIp: formData.serverIp,
            hardwareSerial: formData.hardwareSerial,
            macAddress: formData.macAddress,
            status: formData.status
          }));
          localStorage.removeItem('cctv_draft_biometric');
        } catch (e) {
          console.error(e);
        }
      }

      await ensureLocationExists({
        divisionName: submitData.divisionName,
        block: submitData.block,
        floor: submitData.floor,
        room: submitData.room,
        brand: submitData.brand
      });

      setShowModal(false);
      setEditingId(null);
      setFormData({
        name: '', divisionName: '', block: '', floor: '', room: '',
        type: 'Fingerprint', brand: '', model: '', ipAddress: '', ipv4Gateway: '', subnetMask: '', serverIp: '', serialNumber: '', hardwareSerial: '', macAddress: '', status: 'Online'
      });
      fetchDevices();
    } catch (err) {
      console.error("Biometric save error:", err);
      let errorMsg = 'Error saving biometric asset.';
      if (err.response) {
        if (err.response.status >= 500) {
          errorMsg = `Server Error (${err.response.status}). Please check backend logs.`;
        } else if (err.response.data) {
          if (typeof err.response.data === 'object') {
            errorMsg = Object.entries(err.response.data).map(([k, v]) => {
              const cleanKey = k.replace(/serialNumber/gi, 'Asset Number').toUpperCase();
              const cleanVal = Array.isArray(v) ? v.join(' ') : v;
              return `${cleanKey}: ${cleanVal}`;
            }).join(' | ');
          } else if (typeof err.response.data === 'string' && err.response.data.includes('<html')) {
            errorMsg = `Server returned an HTML error page (${err.response.status}).`;
          } else {
            errorMsg = err.response.data;
          }
        }
      } else if (err.request) {
        errorMsg = 'Network Error: No response from server. Check if backend is running.';
      } else {
        errorMsg = err.message;
      }
      
      showNotification(`Failed: ${errorMsg}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const editDevice = (device) => {
    setFormData({
      name: device.name,
      divisionName: device.divisionName || '',
      block: device.block || '',
      floor: device.floor || '',
      room: device.room || '',
      type: device.type,
      brand: device.brand,
      model: device.model || '',
      ipAddress: device.ipAddress || '',
      ipv4Gateway: device.gateway || '',
      subnetMask: device.subnetMask || '',
      serverIp: device.serverIp || '',
      serialNumber: device.serialNumber,
      hardwareSerial: device.hardwareSerial || '',
      macAddress: device.macAddress || '',
      usage: device.usage || '',
      status: device.status
    });
    setEditingId(device.id || device._id);
    setShowModal(true);
  };

  const deleteDevice = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/biometrics/${id}/`);
        showNotification('Identity asset purged');
        fetchDevices();
      } catch (error) {
        console.error('Error deleting device:', error);
        showNotification('Failed to purge asset', 'error');
      }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/cameras/biometrics/upload_excel/', formData);
      showNotification(`Import Complete: ${res.data.created} Added, ${res.data.updated} Updated`);
      fetchDevices();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to import data.', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const baseFilteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (collegeFilter !== 'ALL' && (d.divisionName || '').toUpperCase() !== collegeFilter.toUpperCase()) return false;
      if (blockFilter !== 'ALL' && (d.block || '').toUpperCase() !== blockFilter.toUpperCase()) return false;
      if (floorFilter !== 'ALL' && (d.floor || '').toUpperCase() !== floorFilter.toUpperCase()) return false;
      if (roomFilter !== 'ALL' && (d.room || '').toUpperCase() !== roomFilter.toUpperCase()) return false;
      
      const currentZone = d.campusZone || 'INSIDE';
      if (filterType !== 'ALL' && currentZone !== filterType) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (d.name || '').toLowerCase().includes(q) ||
        (d.divisionName || '').toLowerCase().includes(q) ||
        (d.block || '').toLowerCase().includes(q) ||
        (d.room || '').toLowerCase().includes(q) ||
        (d.brand || '').toLowerCase().includes(q) ||
        (d.ipAddress || '').toLowerCase().includes(q) ||
        (d.macAddress || '').toLowerCase().includes(q) ||
        (d.serialNumber || '').toLowerCase().includes(q)
      );
    });
  }, [devices, searchQuery, collegeFilter, blockFilter, floorFilter, roomFilter, filterType]);

  const filteredDevices = useMemo(() => {
    return baseFilteredDevices.filter(d => {
      if (statusFilter !== 'ALL' && (d.status || 'Online') !== statusFilter) return false;
      if (typeFilter !== 'ALL' && (d.type || '') !== typeFilter) return false;
      return true;
    });
  }, [baseFilteredDevices, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: baseFilteredDevices.length,
    online: baseFilteredDevices.filter(d => d.status === 'Online').length,
    offline: baseFilteredDevices.filter(d => d.status === 'Offline').length,
    types: new Set(baseFilteredDevices.map(d => d.type).filter(Boolean)).size
  }), [baseFilteredDevices]);

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#3b82f6' },
    { name: 'OFFLINE', value: stats.offline, color: '#f59e0b' }
  ];

  const exportToExcel = () => {
    const headers = ['S.No', 'Asset Number', 'Usage', 'Brand', 'Model', 'College', 'Block', 'Floor', 'Room', 'IP Address', 'MAC Address', 'Type', 'Status'];

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
      escapeCSV(d.model || 'N/A'),
      escapeCSV(d.divisionName || 'N/A'),
      escapeCSV(d.block || 'N/A'),
      escapeCSV(d.floor || 'N/A'),
      escapeCSV(d.room || 'N/A'),
      escapeCSV(d.ipAddress || 'N/A'),
      escapeCSV(d.macAddress || 'N/A'),
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

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Biometric Inventory Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 20px; text-align: center; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; color: #4b5563; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .status-online { background-color: #d1fae5; color: #047857; }
            .status-offline { background-color: #fee2e2; color: #b91c1c; }
            .footer { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Biometric Inventory Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Asset Number</th>
                <th>Designation</th>
                <th>Type</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDevices.map((d, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${d.serialNumber || 'N/A'}</td>
                  <td>${d.name || 'N/A'}</td>
                  <td>${d.type || 'N/A'}</td>
                  <td>${d.ipAddress || 'N/A'}</td>
                  <td>${[d.divisionName, d.block, d.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                  <td><span class="badge ${d.status === 'Online' ? 'status-online' : 'status-offline'}">${d.status || 'N/A'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${filteredDevices.length}
          </div>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Fingerprint className="mr-3 text-purple-500" size={28} />
            Biometric
          </h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg">
            <Download size={18} className="mr-2" />
            Export CSV
          </button>
          <button onClick={printToPDF} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all shadow-lg">
            <Printer size={18} className="mr-2" />
            Print PDF
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-slide-up delay-100">
        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#0d9488', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-teal-500 tracking-widest uppercase">[Total]</h3>
            <Fingerprint size={18} className="text-teal-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(13, 148, 136, 0.6)' }}>{stats.total}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#059669', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">[Active]</h3>
            <Building size={18} className="text-emerald-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(5, 150, 105, 0.6)' }}>{stats.online}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#ea580c', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-orange-500 tracking-widest uppercase">[Offline]</h3>
            <Users size={18} className="text-orange-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(234, 88, 12, 0.6)' }}>{stats.offline}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#8b5cf6', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-purple-500 tracking-widest uppercase">[Types]</h3>
            <Fingerprint size={18} className="text-purple-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(139, 92, 246, 0.6)' }}>{stats.types}</span>
            </div>
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

      <div className="animate-slide-up delay-200">
        {/* Search & Actions Area */}
        <div className="bg-card border border-main rounded-2xl flex flex-col justify-center p-8 space-y-6 shadow-sm">
            <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row gap-4 bg-white/5 rounded-t-2xl">
              <div className="flex items-center space-x-4 w-full">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Deep search by Biometric Name, Asset Number, Location, IP..."
                    className="glass-input w-full !pl-12 pr-4 py-2.5 text-sm placeholder:text-slate-400"
                  />
                </div>
                <button
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className={`flex items-center px-5 py-2.5 rounded-xl border transition-all text-sm font-black uppercase tracking-widest ${showFilterPanel ? 'bg-teal-500/10 border-teal-500/30 text-teal-600' : 'border-white/10 text-dim hover:text-teal-600 hover:bg-white/10'}`}
                >
                  <Filter size={18} className="mr-2" />
                  {showFilterPanel ? 'Hide Filters' : 'Show Advanced Filters'}
                </button>
              </div>
            </div>
            
            {showFilterPanel && (
              <div className="pt-4 border-t border-main flex flex-wrap gap-4 animate-slide-up">
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Occupation</label>
                  <select value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL ({devices.length})</option>
                    {uniqueColleges.map(college => <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'} ({filterCounts.college[college] || 0})</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Block</label>
                  <select value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL ({devices.length})</option>
                    {uniqueBlocks.map(block => <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'} ({filterCounts.block[block] || 0})</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[120px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Floor</label>
                  <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL ({devices.length})</option>
                    {uniqueFloors.map(floor => <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'} ({filterCounts.floor[floor] || 0})</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Room</label>
                  <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL ({devices.length})</option>
                    {uniqueRooms.map(room => <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({filterCounts.room[room] || 0})</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Status</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL</option>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Biometric Type</label>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 w-full">
                    <option value="ALL">ALL ({devices.length})</option>
                    {uniqueTypes.map(t => <option key={t} value={t}>{t} ({filterCounts.type[t] || 0})</option>)}
                  </select>
                </div>
                
                <div className="w-full flex justify-end items-center mt-2">
                  <button onClick={() => { setStatusFilter('ALL'); setTypeFilter('ALL'); setFilterType('ALL'); setCollegeFilter('ALL'); setBlockFilter('ALL'); setFloorFilter('ALL'); setRoomFilter('ALL'); }} className="text-xs font-black text-secondary hover:text-teal-600 transition-colors uppercase tracking-widest underline underline-offset-4 decoration-main">
                    Reset All Filters
                  </button>
                </div>
              </div>
            )}

            {!showFilterPanel && (
              <div className="flex items-center justify-between text-[10px] text-secondary px-2 font-black uppercase tracking-[0.15em]">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
                  System Status: <span className="text-emerald-600 ml-1">Active</span>
                </div>
                <span>Last Synchronized: Just now</span>
              </div>
            )}
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
            {filteredDevices.length} Assets Found
          </div>
        </div>

        <div className="p-4 border-b border-main flex justify-end items-center bg-card/40 rounded-t-2xl mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 mr-2">
              <span className="text-[10px] font-black text-dim uppercase tracking-widest">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-panel border border-white/10 rounded px-2 py-0.5 text-[10px] font-black text-main outline-none focus:border-teal-500 transition-colors"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center space-x-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                {filteredDevices.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredDevices.length)}-${Math.min(currentPage * itemsPerPage, filteredDevices.length)} of ${filteredDevices.length}`}
              </span>
              <button disabled={currentPage >= Math.ceil(filteredDevices.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-panel border-b border-main text-main">
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-center w-12">S.No</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Asset Number</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Device Identity</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Hardware Vendor</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Geographic Asset</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest">Network Endpoint</th>
                <th className="p-5 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black uppercase tracking-widest text-right">Protocol</th>}
              </tr>
            </thead>
            <tbody className="divide-y border-main">
              {filteredDevices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((device, index) => (
                <tr
                  key={device.id || device._id}
                  className="hover:bg-panel group transition-all cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/biometrics/${device.id || device._id}`);
                    }
                  }}
                >
                  <td className="p-5 text-center font-mono text-[10px] text-dim">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-0.5">
                      <span className="text-xs font-mono text-secondary tracking-tighter">{device.serialNumber || '—'}</span>
                      {device.hardwareSerial && (
                        <span className="text-[9px] font-mono text-dim/60 font-semibold tracking-tighter">S/N: {device.hardwareSerial}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center">
                      <div className="p-3 bg-panel border border-main rounded-xl mr-4 text-secondary group-hover:text-teal-500 transition-colors">
                        <Fingerprint size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-main">{device.name}</span>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{device.type || 'Fingerprint'}</span>
                          {device.usage && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 text-[8px] font-black uppercase tracking-tighter">
                              {device.usage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-secondary uppercase tracking-widest">{device.brand}</span>
                      {device.model && <span className="text-[9px] font-mono text-dim/60 font-semibold mt-0.5">{device.model}</span>}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center text-xs font-black text-main uppercase tracking-tight">
                        <Building size={14} className="mr-2 text-teal-600" />
                        {device.block || '—'}
                      </div>
                      <div className="text-[9px] text-secondary font-black uppercase tracking-[0.15em] pl-6">
                        {device.divisionName || '—'}
                      </div>
                    </div>
                  </td>
                  <td className="p-5 flex flex-col space-y-1">
                    <span className="text-xs font-mono text-teal-600 font-bold">{device.ipAddress || '—'}</span>
                    <span className="text-[9px] text-secondary font-mono tracking-widest uppercase">{device.macAddress || 'NO MAC'}</span>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${device.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
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
                  <td colSpan="7" className="p-12 text-center text-dim">
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
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl">
                  <Fingerprint className="text-teal-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify Biometric' : 'Biometric'}
                  </h2>
                </div>
              </div>
              {!editingId && (
                <div className="flex items-center space-x-2 mr-4">
                  {localStorage.getItem('cctv_last_biometric') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const last = JSON.parse(localStorage.getItem('cctv_last_biometric'));
                          setFormData(prev => ({
                            ...prev,
                            ...last,
                            serialNumber: ''
                          }));
                          showNotification('Last biometric entry loaded');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Reuse Last Data
                    </button>
                  )}
                  {localStorage.getItem('cctv_draft_biometric') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const draft = JSON.parse(localStorage.getItem('cctv_draft_biometric'));
                          setFormData(prev => ({ ...prev, ...draft }));
                          showNotification('Draft restored');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Restore Draft
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-secondary hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Column 1: Identity & Location */}
                <div className="space-y-6">

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Device Designation (Name)</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. Main Entry Gate" />
                  </div>

                  {/* Location Intelligence Fields */}
                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                      Division Name
                    </label>
                    <select
                      required
                      name="divisionName"
                      value={formData.divisionName}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                    >
                      <option value="">Select Division...</option>
                      {uniqueColleges.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        Block
                      </label>
                      <select
                        required
                        name="block"
                        value={formData.block}
                        onChange={handleInputChange}
                        className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                      >
                        <option value="">Select Block...</option>
                        {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                        Floor Level
                      </label>
                      <select
                        required
                        name="floor"
                        value={formData.floor}
                        onChange={handleInputChange}
                        className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                      >
                        <option value="">Select Floor...</option>
                        {uniqueFloors.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                      Room / Specific Location
                    </label>
                    <select
                      name="room"
                      value={formData.room}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                    >
                      <option value="">Select Room...</option>
                      {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                {/* Column 2: Specs & Hardware */}
                <div className="space-y-6">

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Name</label>
                      <select
                        name="brand"
                        value={formData.brand}
                        onChange={handleInputChange}
                        className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                      >
                        <option value="">Select Brand...</option>
                        {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model</label>
                      <input type="text" name="model" value={formData.model} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. F22" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Asset Number</label>
                      </div>
                      <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="BIO/01" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Serial Number</label>
                      <input type="text" name="hardwareSerial" value={formData.hardwareSerial} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. 20230916AAWR..." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Biometric Type</label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                    >
                      <option value="Fingerprint">Fingerprint</option>
                      <option value="Face">Face</option>
                      <option value="Palm">Palm</option>
                      <option value="Card">Card</option>
                      <option value="Face + Fingerprint">Face + Fingerprint</option>
                      <option value="Face + Palm">Face + Palm</option>
                      <option value="Fingerprint + Palm">Fingerprint + Palm</option>
                      <option value="Card + Face">Card + Face</option>
                      <option value="Card + Fingerprint">Card + Fingerprint</option>
                      <option value="Card + Palm">Card + Palm</option>
                      <option value="Face + Fingerprint + Palm">Face + Fingerprint + Palm</option>
                      <option value="Card + Face + Fingerprint">Card + Face + Fingerprint</option>
                      <option value="Card + Face + Palm">Card + Face + Palm</option>
                      <option value="Card + Fingerprint + Palm">Card + Fingerprint + Palm</option>
                      <option value="Card + Face + Fingerprint + Palm">Card + Face + Fingerprint + Palm</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Device Usage / Demographics</label>
                    <input 
                      type="text" 
                      name="usage" 
                      value={formData.usage} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" 
                      placeholder="e.g. Staff, Students, Kitchen..." 
                    />
                  </div>

                  {editingId && (
                    <div className="space-y-4 pt-4 border-t border-main">
                      <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Health Status</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {['Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFormData({ ...formData, status: s })}
                            className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg border transition-all ${formData.status === s
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

              {/* Network Information */}
              <div className="space-y-6 mt-10">

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IP Protocol</label>
                    <input required type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel shadow-inner" placeholder="192.168.1.100" />
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
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Server IP Address</label>
                    </div>
                    <input type="text" name="serverIp" value={formData.serverIp} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="192.168.1.200" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">MAC Interface</label>
                    <input type="text" name="macAddress" value={formData.macAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="00:1A:2B:3C:4D:5E" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-6 pt-10 border-t border-main shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black tracking-[0.2em] text-secondary hover:text-main uppercase transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`glass-button px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
