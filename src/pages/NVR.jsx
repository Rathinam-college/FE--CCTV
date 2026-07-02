import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Search, Filter, Plus, Server, HardDrive, Cpu, X, Edit2, Trash2, Building, Activity, ShieldCheck, ShieldAlert, Download, Upload, Info, ChevronRight, ChevronLeft, Network, Printer } from 'lucide-react';
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
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, divisions, fetchDivisions, brands, fetchBrands } = useSiteStore();
  const [nvrs, setNvrs] = useState([]);
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

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Storage:EDIT');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    ipAddress: '',
    ipv4Gateway: '',
    subnetMask: '',
    macAddress: '',
    nvrName: '',
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    model: '',
    portNumber: '',
    hardDisk: '',
    storageList: [{ size: '', unit: 'TB' }],
    channel: '',
    serialNumber: '',
    status: 'Online',
    campusZone: 'INSIDE'
  });


  useEffect(() => {
    fetchNVRs();
    fetchAllLocations();
    fetchDivisions();
    fetchBrands();
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

  useEffect(() => {
    if (showModal && !editingId) {
      localStorage.setItem('cctv_draft_nvr', JSON.stringify(formData));
    }
  }, [formData, showModal, editingId]);

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
    if (divisions) divisions.forEach(o => o.name && colleges.add(o.name.toUpperCase()));
    return Array.from(colleges).sort();
  }, [divisions]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block.toUpperCase()); });
    if (currentSite?.block) blocks.add(currentSite.block.toUpperCase());
    return Array.from(blocks).sort();
  }, [currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetBlock = String(formData.block || '');
    if (targetBlock) {
      allLocations.forEach(loc => { if (String(loc.block || '').toUpperCase() === targetBlock.toUpperCase() && loc.floor) floors.add(String(loc.floor).toUpperCase()); });
      if (String(currentSite?.block || '').toUpperCase() === targetBlock.toUpperCase() && currentSite?.floor) floors.add(String(currentSite.floor).toUpperCase());
    } else {
      allLocations.forEach(loc => { if (loc.floor) floors.add(String(loc.floor).toUpperCase()); });
      if (currentSite?.floor) floors.add(String(currentSite.floor).toUpperCase());
    }
    return Array.from(floors).sort();
  }, [currentSite, allLocations, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetBlock = String(formData.block || '');
    const targetFloor = String(formData.floor || '');
    if (targetBlock && targetFloor) {
      allLocations.forEach(loc => { if (String(loc.block || '').toUpperCase() === targetBlock.toUpperCase() && String(loc.floor || '').toUpperCase() === targetFloor.toUpperCase() && loc.room) rooms.add(String(loc.room).toUpperCase()); });
      if (String(currentSite?.block || '').toUpperCase() === targetBlock.toUpperCase() && String(currentSite?.floor || '').toUpperCase() === targetFloor.toUpperCase() && currentSite?.room) rooms.add(String(currentSite.room).toUpperCase());
    } else {
      allLocations.forEach(loc => { if (loc.room) rooms.add(String(loc.room).toUpperCase()); });
      if (currentSite?.room) rooms.add(String(currentSite.room).toUpperCase());
    }
    return Array.from(rooms).sort();
  }, [currentSite, allLocations, formData.block, formData.floor]);

  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set();
    if (brands) brands.forEach(b => b.name && brandsSet.add(b.name.toUpperCase()));
    return Array.from(brandsSet).sort();
  }, [brands]);

  const filterCounts = useMemo(() => {
    const counts = { college: {}, block: {}, floor: {}, room: {} };
    nvrs.forEach(nvr => {
      const college = String(nvr.divisionName || '').toUpperCase();
      const block = String(nvr.block || '').toUpperCase();
      const floor = String(nvr.floor || '').toUpperCase();
      const room = String(nvr.room || '').toUpperCase();
      
      counts.college[college] = (counts.college[college] || 0) + 1;
      counts.block[block] = (counts.block[block] || 0) + 1;
      counts.floor[floor] = (counts.floor[floor] || 0) + 1;
      counts.room[room] = (counts.room[room] || 0) + 1;
    });
    return counts;
  }, [nvrs]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['email', 'password', 'username'].includes(name)) {
      newValue = newValue.toUpperCase();
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

    if (['ipAddress', 'ipv4Gateway', 'subnetMask'].includes(name)) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
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
        try {
          localStorage.setItem('cctv_last_nvr', JSON.stringify({
            ipAddress: formData.ipAddress,
            ipv4Gateway: formData.ipv4Gateway,
            subnetMask: formData.subnetMask,
            macAddress: formData.macAddress,
            portNumber: formData.portNumber,
            nvrName: formData.nvrName,
            divisionName: formData.divisionName,
            block: formData.block,
            floor: formData.floor,
            room: formData.room,
            brand: formData.brand,
            model: formData.model,
            hardDisk: formData.hardDisk,
            storageList: formData.storageList,
            channel: formData.channel,
            status: formData.status,
            campusZone: formData.campusZone
          }));
          localStorage.removeItem('cctv_draft_nvr');
        } catch (e) {
          console.error(e);
        }
      }
      
      await ensureLocationExists({
        divisionName: payload.divisionName,
        block: payload.block,
        floor: payload.floor,
        room: payload.room,
        brand: payload.brand
      });
      
      setShowModal(false);
      setEditingId(null);
      setFormData({ 
        ipAddress: '', ipv4Gateway: '', subnetMask: '', macAddress: '', portNumber: '', nvrName: '', divisionName: '', block: '', floor: '', room: '', 
        brand: '', model: '', hardDisk: '', storageList: [{ size: '', unit: 'TB' }], channel: '', serialNumber: '', status: 'Online', campusZone: 'INSIDE' 
      });
      fetchNVRs();
    } catch (err) {
      console.error("NVR save error:", err);
      let errorMsg = 'Error saving NVR asset.';
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

  const openNewModal = async () => {
    await fetchSite();
    setEditingId(null);

    const college = currentSite?.divisionName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';


    setFormData({ 
      ipAddress: '', ipv4Gateway: '', subnetMask: '', macAddress: '', portNumber: '', nvrName: '', divisionName: college, block: block, floor: floor, room: room, 
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
      divisionName: nvr.divisionName || '',
      block: nvr.block || '',
      floor: nvr.floor || '',
      room: nvr.room || '',
      brand: nvr.brand || '',
      model: nvr.model || '',
      portNumber: nvr.portNumber || '',
      hardDisk: nvr.hardDisk || '',
      storageList: nvr.hardDisk ? nvr.hardDisk.split('+').map(s => {
        const match = s.trim().match(/^(\d+)\s*(TB|GB)$/i);
        return match ? { size: match[1], unit: match[2].toUpperCase() } : { size: s.trim(), unit: 'TB' };
      }) : [{ size: '', unit: 'TB' }],
      channel: nvr.channel || '',
      serialNumber: nvr.serialNumber || '',
      status: nvr.status || 'Online',
      campusZone: nvr.campusZone || 'INSIDE'
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
      const res = await api.post('/cameras/nvrs/upload_excel/', formData);
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

  const baseFilteredNVRs = useMemo(() => {
    return nvrs.filter(nvr => {
      if (collegeFilter !== 'ALL' && (nvr.divisionName || '').toUpperCase() !== collegeFilter.toUpperCase()) return false;
      if (blockFilter !== 'ALL' && (nvr.block || '').toUpperCase() !== blockFilter.toUpperCase()) return false;
      if (floorFilter !== 'ALL' && (nvr.floor || '').toUpperCase() !== floorFilter.toUpperCase()) return false;
      if (roomFilter !== 'ALL' && (nvr.room || '').toUpperCase() !== roomFilter.toUpperCase()) return false;
      
      const currentZone = nvr.campusZone || 'INSIDE';
      if (filterType !== 'ALL' && currentZone !== filterType) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (nvr.nvrName || '').toLowerCase().includes(q) ||
        (nvr.serialNumber || '').toLowerCase().includes(q) ||
        (nvr.divisionName || '').toLowerCase().includes(q) ||
        (nvr.block || '').toLowerCase().includes(q) ||
        (nvr.room || '').toLowerCase().includes(q) ||
        (nvr.ipAddress || '').toLowerCase().includes(q) ||
        (nvr.brand || '').toLowerCase().includes(q) ||
        (nvr.model || '').toLowerCase().includes(q)
      );
    });
  }, [nvrs, collegeFilter, blockFilter, floorFilter, roomFilter, filterType, searchQuery]);

  const filteredNVRs = useMemo(() => {
    return baseFilteredNVRs.filter(nvr => {
      if (statusFilter !== 'ALL' && (nvr.status || 'Online') !== statusFilter) return false;
      return true;
    });
  }, [baseFilteredNVRs, statusFilter]);

  const exportToExcel = () => {
    const headers = [
      'S.No', 'Asset Name', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Brand', 'Model',
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
      escapeCSV(nvr.divisionName || 'N/A'),
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

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>NVR Inventory Export</title>
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
          <h1>NVR Inventory Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Asset Number</th>
                <th>NVR Name</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Specs (Disk/Chan)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredNVRs.map((nvr, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${nvr.serialNumber || 'N/A'}</td>
                  <td>${nvr.nvrName || 'N/A'}</td>
                  <td>${nvr.ipAddress || 'N/A'}</td>
                  <td>${[nvr.divisionName, nvr.block, nvr.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                  <td>${nvr.hardDisk || 'N/A'} / ${nvr.channel || 'N/A'} Ch</td>
                  <td><span class="badge ${nvr.status === 'Online' ? 'status-online' : 'status-offline'}">${nvr.status || 'N/A'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${filteredNVRs.length}
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

  const stats = useMemo(() => ({
    total: baseFilteredNVRs.length,
    online: baseFilteredNVRs.filter(n => n.status === 'Online').length,
    offline: baseFilteredNVRs.filter(n => n.status === 'Offline').length
  }), [baseFilteredNVRs]);

  const chartData = [
    { name: 'ONLINE', value: stats.online, color: '#3b82f6' },
    { name: 'OFFLINE', value: stats.offline, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <HardDrive className="mr-3 text-emerald-500" size={28} />
            NVR
          </h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={() => navigate('/nvr-mapping')} className="glass-panel flex items-center px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg">
            <Network size={16} className="mr-2" /> Camera Mapping
          </button>
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all shadow-lg">
            <Download size={16} className="mr-2" /> Export CSV
          </button>
          <button onClick={printToPDF} className="glass-panel flex items-center px-5 py-2.5 text-[10px] font-black uppercase tracking-widest bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all shadow-lg">
            <Printer size={16} className="mr-2" /> Print PDF
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
        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#818cf8', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-indigo-400 tracking-widest uppercase">[Total Assets]</h3>
            <Server size={18} className="text-indigo-400 opacity-50" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(129, 140, 248, 0.6)' }}>{stats.total}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#34d399', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">[Online NVRs]</h3>
            <ShieldCheck size={18} className="text-emerald-400 opacity-50" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(52, 211, 153, 0.6)' }}>{stats.online}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#fb923c', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-orange-400 tracking-widest uppercase">[Offline NVRs]</h3>
            <ShieldAlert size={18} className="text-orange-400 opacity-50" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(251, 146, 60, 0.6)' }}>{stats.offline}</span>
            </div>
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
          <div className="flex items-center space-x-4">
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
          <div className="px-5 py-6 border-b border-main bg-panel flex flex-wrap gap-8 animate-slide-up">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Occupation Filter</label>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL Occupation ({nvrs.length})</option>
                {uniqueColleges.map(college => {
                  const count = filterCounts.college[college] || 0;
                  return <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Block Filter</label>
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL BLOCKS ({nvrs.length})</option>
                {uniqueBlocks.map(block => {
                  const count = filterCounts.block[block] || 0;
                  return <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Floor Filter</label>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[150px]"
              >
                <option value="ALL">ALL FLOORS ({nvrs.length})</option>
                {uniqueFloors.map(floor => {
                  const count = filterCounts.floor[floor] || 0;
                  return <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Room Filter</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL ROOMS ({nvrs.length})</option>
                {uniqueRooms.map(room => {
                  const count = filterCounts.room[room] || 0;
                  return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Device Status</label>
              <div className="flex gap-2">
                {['ALL', 'Online', 'Offline', 'Maintenance'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${statusFilter === s ? 'bg-teal-500/10 border-teal-500/30 text-teal-600' : 'bg-card border-main text-secondary hover:border-teal-500/30 hover:text-teal-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Campus Zone</label>
              <div className="flex gap-2">
                {['ALL', 'INSIDE', 'OUTSIDE'].map((z) => (
                  <button
                    key={z}
                    onClick={() => setFilterType(z)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${filterType === z ? 'bg-teal-500/10 border-teal-500/30 text-teal-600' : 'bg-card border-main text-secondary hover:border-teal-500/30 hover:text-teal-600'}`}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex justify-end items-end space-x-4">
              <button onClick={exportToExcel} className="flex items-center px-5 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-600 hover:bg-teal-500/20 transition-all text-xs font-black uppercase tracking-widest">
                <Download size={14} className="mr-2" />
                Export CSV
              </button>
              <button onClick={() => { setStatusFilter('ALL'); setFilterType('ALL'); setSearchQuery(''); setCollegeFilter('ALL'); setBlockFilter('ALL'); setFloorFilter('ALL'); setRoomFilter('ALL'); }} className="text-xs font-black text-secondary hover:text-teal-600 transition-colors uppercase tracking-widest underline underline-offset-4 decoration-main">
                Reset All Filters
              </button>
            </div>
          </div>
        )}

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
                {filteredNVRs.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredNVRs.length)}-${Math.min(currentPage * itemsPerPage, filteredNVRs.length)} of ${filteredNVRs.length}`}
              </span>
              <button disabled={currentPage >= Math.ceil(filteredNVRs.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center w-12">S.No</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Asset Number</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Info</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Location & Brand</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Specs (Disk/Chan)</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredNVRs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((nvr, index) => (
                <tr 
                  key={nvr._id || nvr.id} 
                  className="group hover:bg-white/5 transition-all cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/nvr/${nvr._id || nvr.id}`);
                    }
                  }}
                >
                  <td className="p-5 text-center font-mono text-[10px] text-dim">{(currentPage - 1) * itemsPerPage + index + 1}</td>
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
                        {nvr.divisionName || '—'}
                      </div>
                      <div className="text-[10px] text-indigo-400 font-bold pl-5">
                        {nvr.brand || '—'} {nvr.model ? `(${nvr.model})` : ''}
                      </div>
                      <div className={`text-[9px] font-black uppercase tracking-widest pl-5 mt-1 ${nvr.campusZone === 'OUTSIDE' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        [{nvr.campusZone || 'INSIDE'}]
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
                  <td colSpan="7" className="p-12 text-center text-dim">
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
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
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
              {!editingId && (
                <div className="flex items-center space-x-2 mr-4">
                  {localStorage.getItem('cctv_last_nvr') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const last = JSON.parse(localStorage.getItem('cctv_last_nvr'));
                          setFormData(prev => ({
                            ...prev,
                            ...last,
                            serialNumber: ''
                          }));
                          showNotification('Last NVR entry loaded');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Reuse Last Data
                    </button>
                  )}
                  {localStorage.getItem('cctv_draft_nvr') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const draft = JSON.parse(localStorage.getItem('cctv_draft_nvr'));
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
                    <input required type="text" name="nvrName" value={formData.nvrName} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. Main Control NVR" />
                  </div>

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
                      {uniqueColleges.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
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
                        {uniqueBlocks.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
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
                        {uniqueFloors.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
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
                      {uniqueRooms.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                      Campus Zone (Type)
                    </label>
                    <select 
                      required
                      name="campusZone" 
                      value={formData.campusZone} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                    >
                      <option value="INSIDE">Inside Campus</option>
                      <option value="OUTSIDE">Outside Campus</option>
                    </select>
                  </div>
                </div>

                {/* Column 2: Specs & Vendor */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Brand Designation</label>
                      <select 
                        name="brand" 
                        value={formData.brand} 
                        onChange={handleInputChange} 
                        className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                      >
                        <option value="">Select Brand...</option>
                        {uniqueBrands.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model Number</label>
                      <input 
                        type="text" 
                        name="model" 
                        value={formData.model} 
                        onChange={handleInputChange} 
                        className="glass-input w-full p-4 text-sm bg-panel border-main" 
                        placeholder="e.g. DS-7616NI-K2" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex justify-between">
                      Asset Number
                      <button type="button" onClick={generateSerialNumber} className="text-[9px] text-teal-600 font-black tracking-widest hover:text-teal-500 transition-colors uppercase">AUTO GENERATE</button>
                    </label>
                    <input type="text" name="serialNumber" value={formData.serialNumber} readOnly className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main cursor-not-allowed opacity-80 shadow-inner" placeholder="Auto-generated on save" />
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
                            <button type="button" onClick={() => removeStorageField(idx)} className="p-4 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/30">
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

                  {editingId && (
                    <div className="space-y-4 pt-4 border-t border-main">
                      <h3 className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Health Status</h3>
                      <div className="grid grid-cols-4 gap-2">
                        {['Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
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
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Port Number</label>
                    <input type="text" name="portNumber" value={formData.portNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="e.g. 8080" />
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
