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
    const headers = ['S.No', 'Asset Number', 'Serial Number', 'Usage', 'Brand', 'Model', 'College', 'Block', 'Floor', 'Room', 'IP Address', 'MAC Address', 'Type', 'Status', 'Date Added'];

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
      escapeCSV(d.hardwareSerial || 'N/A'),
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
      escapeCSV(d.status || 'N/A'),
      escapeCSV(d.createdAt?.split('T')[0] || '')
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Fingerprint className="mr-3 text-orange-500" size={28} />
            Biometric
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button onClick={exportToExcel} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          <button onClick={printToPDF} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <Printer size={14} className="mr-2" /> Print PDF
          </button>
          {canEdit && (
            <>
              <label className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer">
                <Upload size={14} className="mr-2" />
                Bulk Import
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={openNewModal} className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2">
                <Plus size={16} className="mr-2" />
                Register Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Dashboard */}
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-slide-up delay-100">
        <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ring-1 ring-cyan-500/50">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL ASSETS]</h3>
              <Fingerprint size={18} className="text-slate-500" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-cyan-400">{stats.total}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: '30%' }}></div>
          </button>
 
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-green-500/30">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-green-500 tracking-widest uppercase">[ONLINE UNITS]</h3>
              <Building size={18} className="text-slate-500" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-white">{stats.online}</span>
            </div>
          </button>
 
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-orange-500/30">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-orange-500 tracking-widest uppercase">[OFFLINE UNITS]</h3>
              <Users size={18} className="text-slate-500" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-white">{stats.offline}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" style={{ width: '30%' }}></div>
          </button>

          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-purple-500/30">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-purple-500 tracking-widest uppercase">[TYPES]</h3>
              <Fingerprint size={18} className="text-slate-500" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-white">{stats.types}</span>
            </div>
          </button>
        </div>

        <div className="bg-panel rounded-md p-4 flex items-center justify-center relative">
          <div className="w-24 h-24 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={40} paddingAngle={2} dataKey="value" stroke="none">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[12px] font-bold text-white leading-none text-center mt-1">100%<br/><span className="text-[7px] text-slate-400">DIST.</span></span>
            </div>
          </div>
          <div className="absolute right-2 flex flex-col space-y-2">
            {chartData.map(d => (
              <div key={d.name} className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-[9px] text-slate-300 font-bold uppercase">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Deep search by Biometric Name, Asset Number, Location, IP..."
            className="bg-panel text-sm text-slate-200 border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="flex items-center px-6 py-3 rounded-md bg-panel border border-main text-sm font-bold text-slate-300 hover:text-white transition-colors uppercase tracking-wide shrink-0"
        >
          <Filter size={16} className="mr-2" />
          {showFilterPanel ? 'HIDE FILTERS' : 'SHOW ADVANCED FILTERS'}
        </button>
      </div>

      {showFilterPanel && (
        <div className="bg-panel border border-main rounded-md p-6 mb-6 flex flex-wrap gap-8 animate-slide-up">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occupation</label>
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL Occupation ({devices.length})</option>
              {uniqueColleges.map(college => {
                const count = filterCounts.college[college] || 0;
                return <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Block</label>
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL BLOCKS ({devices.length})</option>
              {uniqueBlocks.map(block => {
                const count = filterCounts.block[block] || 0;
                return <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Floor</label>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 min-w-[150px]"
            >
              <option value="ALL">ALL FLOORS ({devices.length})</option>
              {uniqueFloors.map(floor => {
                const count = filterCounts.floor[floor] || 0;
                return <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Room</label>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL ROOMS ({devices.length})</option>
              {uniqueRooms.map(room => {
                const count = filterCounts.room[room] || 0;
                return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Device Status</label>
            <div className="flex gap-2">
              {['ALL', 'Online', 'Offline', 'Maintenance'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${statusFilter === s ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Biometric Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL TYPES ({devices.length})</option>
              {uniqueTypes.map(t => {
                const count = filterCounts.type[t] || 0;
                return <option key={t} value={t}>{t} ({count})</option>
              })}
            </select>
          </div>

          <div className="flex-1 flex justify-end items-end space-x-4">
            <button onClick={exportToExcel} className="flex items-center px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all text-xs font-bold uppercase tracking-widest">
              <Download size={14} className="mr-2" />
              Export
            </button>
            <button onClick={() => { setStatusFilter('ALL'); setTypeFilter('ALL'); setFilterType('ALL'); setSearchQuery(''); setCollegeFilter('ALL'); setBlockFilter('ALL'); setFloorFilter('ALL'); setRoomFilter('ALL'); }} className="text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors uppercase tracking-widest underline underline-offset-4">
              Reset Filters
            </button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="p-4 border-b border-main flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rows per page</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-slate-300 outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
              {filteredDevices.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredDevices.length)}-${Math.min(currentPage * itemsPerPage, filteredDevices.length)} of ${filteredDevices.length}`}
            </span>
            <div className="flex space-x-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors bg-slate-800 rounded">
                <ChevronLeft size={14} />
              </button>
              <button disabled={currentPage >= Math.ceil(filteredDevices.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors bg-slate-800 rounded">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-panel border-b border-main">
              <tr className="text-slate-400">
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center w-12">S.No</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Device Details</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Location</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Network</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main">
              {filteredDevices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((device, index) => (
                <tr
                  key={device.id || device._id}
                  className="hover:bg-slate-700/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/devices/biometrics/${device.id || device._id}`)}
                >
                  <td className="px-5 py-4 text-[11px] font-bold text-slate-400 text-center">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                        <Fingerprint size={16} className="text-yellow-500" />
                      </div>
                      <div className="flex flex-col space-y-0.5">
                        <div className="text-[12px] font-bold text-slate-200">{device.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{device.serialNumber || '—'}</div>
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{device.type || 'FINGERPRINT'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2 text-[11px] text-slate-200 font-bold">
                        <Building size={12} className="text-cyan-500" />
                        <span>{device.block || '—'}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider pl-5">
                        {device.divisionName || '—'}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold pl-5">
                        {device.brand || '—'} {device.model ? `(${device.model})` : ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col space-y-1">
                      <span className="text-[11px] font-mono text-cyan-400 font-bold">{device.ipAddress || '—'}</span>
                      <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">{device.macAddress || 'NO MAC'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                      device.status === 'Online' ? 'text-green-500 border-green-500/50' : 
                      device.status === 'Offline' ? 'text-red-500 border-red-500/50' :
                      'text-amber-500 border-amber-500/50'}`}>
                      {device.status}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/devices/biometrics/${device.id || device._id}`) }} className="text-slate-400 hover:text-cyan-400 transition-colors">
                          <Info size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); editDevice(device) }} className="text-slate-400 hover:text-cyan-400 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteDevice(device.id || device._id) }} className="text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-8 text-center text-slate-500">
                    <Fingerprint size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-[12px] font-bold">No biometrics found matching this filter.</p>
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
