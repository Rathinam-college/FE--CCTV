import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  Search, Filter, Plus, Server, Hash, Cpu, X,
  Edit2, Trash2, Building, Activity, ShieldCheck,
  ShieldAlert, Download, Network, Database, Upload,
  Info, ChevronRight, ChevronLeft, Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useSiteStore } from '../store/siteStore';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import ComboInput from '../components/ComboInput';

export default function NetworkSwitches() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, divisions, fetchDivisions, brands, fetchBrands } = useSiteStore();
  const [switches, setSwitches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  
  // Advanced Filter State
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL'); // Campus zone

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Network:EDIT');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    ipv4Gateway: '',
    subnetMask: '',
    macAddress: '',
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    brand: '',
    model: '',
    portCount: '',
    serialNumber: '',
    ethUplink: '',
    sfpUplink: '',
    status: 'Online',
    remarks: ''
  });


  useEffect(() => {
    fetchSwitches();
    fetchAllLocations();
    fetchDivisions();
    fetchBrands();
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

  useEffect(() => {
    if (showModal && !editingId) {
      localStorage.setItem('cctv_draft_switch', JSON.stringify(formData));
    }
  }, [formData, showModal, editingId]);

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

  const uniqueAssets = useMemo(() => {
    const assets = new Set();
    switches.forEach(sw => { if (sw.serialNumber) assets.add(sw.serialNumber.toUpperCase()); });
    return Array.from(assets).sort();
  }, [switches]);

  const filterCounts = useMemo(() => {
    const counts = { college: {}, block: {}, floor: {}, room: {}, asset: {} };
    switches.forEach(sw => {
      const college = String(sw.divisionName || '').toUpperCase();
      const block = String(sw.block || '').toUpperCase();
      const floor = String(sw.floor || '').toUpperCase();
      const room = String(sw.room || '').toUpperCase();
      const asset = String(sw.serialNumber || '').toUpperCase();

      counts.college[college] = (counts.college[college] || 0) + 1;
      counts.block[block] = (counts.block[block] || 0) + 1;
      counts.floor[floor] = (counts.floor[floor] || 0) + 1;
      counts.room[room] = (counts.room[room] || 0) + 1;
      if (asset) counts.asset[asset] = (counts.asset[asset] || 0) + 1;
    });
    return counts;
  }, [switches]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['email', 'password', 'username', 'remarks'].includes(name)) {
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
      const submitData = {
        ...formData,
        location: formData.room || formData.block || 'Unknown',
        gateway: formData.ipv4Gateway || '',
      };

      if (!submitData.serialNumber || submitData.serialNumber.trim() === '') {
        submitData.serialNumber = null;
      }

      if (editingId) {
        await api.put(`/cameras/switches/${editingId}/`, submitData);
        showNotification('Network switch updated');
      } else {
        await api.post('/cameras/switches/', submitData);
        showNotification('New switch registered successfully');
        try {
          localStorage.setItem('cctv_last_switch', JSON.stringify({
            name: formData.name,
            ipAddress: formData.ipAddress,
            ipv4Gateway: formData.ipv4Gateway,
            subnetMask: formData.subnetMask,
            macAddress: formData.macAddress,
            divisionName: formData.divisionName,
            block: formData.block,
            floor: formData.floor,
            room: formData.room,
            brand: formData.brand,
            model: formData.model,
            portCount: formData.portCount,
            ethUplink: formData.ethUplink,
            sfpUplink: formData.sfpUplink,
            status: formData.status,
            remarks: formData.remarks
          }));
          localStorage.removeItem('cctv_draft_switch');
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
      resetForm();
      fetchSwitches();
    } catch (err) {
      console.error("NetworkSwitch save error:", err);
      let errorMsg = 'Error saving switch detail.';
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
    resetForm();

    const college = currentSite?.divisionName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';


    setFormData(prev => ({
      ...prev,
      divisionName: college,
      block: block,
      floor: floor,
      room: room
    }));
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '', ipAddress: '', ipv4Gateway: '', subnetMask: '', macAddress: '', divisionName: '', block: '', floor: '', room: '', brand: '',
      model: '', portCount: '', serialNumber: '', ethUplink: '', sfpUplink: '', status: 'Online', remarks: ''
    });
  };

  const editSwitch = (sw) => {
    setFormData({
      name: sw.name || '',
      ipAddress: sw.ipAddress || '',
      ipv4Gateway: sw.gateway || '',
      subnetMask: sw.subnetMask || '',
      macAddress: sw.macAddress || '',
      divisionName: sw.divisionName || '',
      block: sw.block || '',
      floor: sw.floor || '',
      room: sw.room || '',
      brand: sw.brand || '',
      model: sw.model || '',
      portCount: sw.portCount || '',
      serialNumber: sw.serialNumber || '',
      ethUplink: sw.ethUplink || '',
      sfpUplink: sw.sfpUplink || '',
      status: sw.status || 'Online',
      remarks: sw.remarks || ''
    });
    setEditingId(sw._id || sw.id);
    setShowModal(true);
  };

  const deleteSwitch = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/switches/${id}/`);
        showNotification('Switch removed successfully');
        fetchSwitches();
      } catch (err) {
        console.error(err);
        showNotification('Failed to remove switch', 'error');
      }
    });
  };

  const baseFilteredSwitches = useMemo(() => {
    return switches.filter(sw => {
      if (collegeFilter !== 'ALL' && (sw.divisionName || '').toUpperCase() !== collegeFilter.toUpperCase()) return false;
      if (blockFilter !== 'ALL' && (sw.block || '').toUpperCase() !== blockFilter.toUpperCase()) return false;
      if (floorFilter !== 'ALL' && (sw.floor || '').toUpperCase() !== floorFilter.toUpperCase()) return false;
      if (roomFilter !== 'ALL' && (sw.room || '').toUpperCase() !== roomFilter.toUpperCase()) return false;
      if (assetFilter !== 'ALL' && (sw.serialNumber || '').toUpperCase() !== assetFilter) return false;
      
      const currentZone = sw.campusZone || 'INSIDE';
      if (filterType !== 'ALL' && currentZone !== filterType) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (sw.name || '').toLowerCase().includes(q) ||
        (sw.divisionName || '').toLowerCase().includes(q) ||
        (sw.block || '').toLowerCase().includes(q) ||
        (sw.room || '').toLowerCase().includes(q) ||
        (sw.brand || '').toLowerCase().includes(q) ||
        (sw.ipAddress || '').toLowerCase().includes(q) ||
        (sw.serialNumber || '').toLowerCase().includes(q)
      );
    });
  }, [switches, searchQuery, collegeFilter, blockFilter, floorFilter, roomFilter, assetFilter, filterType]);

  const filteredSwitches = useMemo(() => {
    return baseFilteredSwitches.filter(sw => {
      if (statusFilter !== 'ALL' && (sw.status || 'Online') !== statusFilter) return false;
      return true;
    });
  }, [baseFilteredSwitches, statusFilter]);

  const stats = useMemo(() => ({
    total: baseFilteredSwitches.length,
    online: baseFilteredSwitches.filter(s => s.status === 'Online').length,
    offline: baseFilteredSwitches.filter(s => s.status === 'Offline').length,
    maintenance: baseFilteredSwitches.filter(s => s.status === 'Maintenance').length
  }), [baseFilteredSwitches]);

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
      const res = await api.post('/cameras/switches/upload_excel/', formData);
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
      'Model', 'Ports', 'ETH Uplink', 'SFP Uplink', 'Assets numer', 'Status'
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
      escapeCSV(sw.divisionName || 'N/A'),
      escapeCSV(sw.block || 'N/A'),
      escapeCSV(sw.floor || 'N/A'),
      escapeCSV(sw.room || 'N/A'),
      escapeCSV(sw.brand || 'N/A'),
      escapeCSV(sw.model || 'N/A'),
      escapeCSV(sw.portCount || 'N/A'),
      escapeCSV(sw.ethUplink || 'N/A'),
      escapeCSV(sw.sfpUplink || 'N/A'),
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

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Network Switch Inventory Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 20px; text-align: center; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; color: #4b5563; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .status-online { background-color: #d1fae5; color: #047857; }
            .status-maintenance { background-color: #ffedd5; color: #c2410c; }
            .status-offline { background-color: #fee2e2; color: #b91c1c; }
            .footer { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Network Switch Inventory Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Asset Number</th>
                <th>Switch Name</th>
                <th>IP Address</th>
                <th>Ports</th>
                <th>ETH Uplink</th>
                <th>SFP Uplink</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSwitches.map((sw, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${sw.serialNumber || 'N/A'}</td>
                  <td>${sw.name || 'N/A'}</td>
                  <td>${sw.ipAddress || 'N/A'}</td>
                  <td>${sw.portCount || 'N/A'}</td>
                  <td>${sw.ethUplink || 'N/A'}</td>
                  <td>${sw.sfpUplink || 'N/A'}</td>
                  <td>${[sw.divisionName, sw.block, sw.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                  <td><span class="badge ${sw.status === 'Online' ? 'status-online' : sw.status === 'Maintenance' ? 'status-maintenance' : 'status-offline'}">${sw.status || 'N/A'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${filteredSwitches.length}
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
          <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-main flex items-center uppercase">
            <Network className="mr-3 text-blue-400" size={32} />
            Switches
          </h1>
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
          <button onClick={printToPDF} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all shadow-lg">
            <Printer size={18} className="mr-2" /> Print PDF
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
        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#3b82f6', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">[Total]</h3>
            <Database size={18} className="text-blue-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.6)' }}>{stats.total}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#10b981', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-emerald-500 tracking-widest uppercase">[Active]</h3>
            <ShieldCheck size={18} className="text-emerald-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.6)' }}>{stats.online}</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#ef4444', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-red-500 tracking-widest uppercase">[Offline]</h3>
            <ShieldAlert size={18} className="text-red-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.6)' }}>{stats.offline}</span>
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
          <div className="flex items-center space-x-4 w-full">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Deep search by Switch Name, Asset Number, Location, Brand..."
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
                <option value="ALL">ALL Occupation ({switches.length})</option>
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
                <option value="ALL">ALL BLOCKS ({switches.length})</option>
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
                <option value="ALL">ALL FLOORS ({switches.length})</option>
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
                <option value="ALL">ALL ROOMS ({switches.length})</option>
                {uniqueRooms.map(room => {
                  const count = filterCounts.room[room] || 0;
                  return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Asset Number Filter</label>
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[150px]"
              >
                <option value="ALL">ALL ASSETS ({switches.length})</option>
                {uniqueAssets.map(asset => {
                  const count = filterCounts.asset[asset] || 0;
                  return <option key={asset} value={asset}>{asset} ({count})</option>
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
              <button onClick={() => { setStatusFilter('ALL'); setAssetFilter('ALL'); setFilterType('ALL'); setSearchQuery(''); setCollegeFilter('ALL'); setBlockFilter('ALL'); setFloorFilter('ALL'); setRoomFilter('ALL'); }} className="text-xs font-black text-secondary hover:text-teal-600 transition-colors uppercase tracking-widest underline underline-offset-4 decoration-main">
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
                {filteredSwitches.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredSwitches.length)}-${Math.min(currentPage * itemsPerPage, filteredSwitches.length)} of ${filteredSwitches.length}`}
              </span>
              <button disabled={currentPage >= Math.ceil(filteredSwitches.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
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
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Asset Number</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Device Info</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Location & Model</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">Ports</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">ETH Uplink</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-center">SFP Uplink</th>
                <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-5 text-[10px] font-black text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSwitches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((sw, index) => (
                <tr
                  key={sw._id || sw.id}
                  className="hover:bg-white/5 transition-all group cursor-pointer"
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/devices/switches/${sw._id || sw.id}`);
                    }
                  }}
                >
                  <td className="p-5 text-center font-mono text-[10px] text-dim">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                  <td className="p-5">
                    <span className="text-sm font-mono text-blue-300 font-bold">{sw.serialNumber || '—'}</span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors shadow-lg">
                        <Server size={24} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-main">{sw.name}</div>
                        <div className="text-xs text-dim mt-0.5 font-mono">IP: <span className="text-blue-300">{sw.ipAddress || '—'}</span></div>
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
                        {sw.divisionName || '—'}
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
                  <td className="p-5 text-center">
                    <span className="px-3.5 py-1.5 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-xs font-black text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                      {sw.ethUplink || '—'}
                    </span>
                  </td>
                  <td className="p-5 text-center">
                    <span className="px-3.5 py-1.5 bg-fuchsia-500/10 rounded-full border border-fuchsia-500/20 text-xs font-black text-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.1)]">
                      {sw.sfpUplink || '—'}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${sw.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
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
                  <td colSpan="6" className="p-12 text-center text-dim">
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
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl">
                  <Network className="text-teal-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify Switch' : 'Switch'}
                  </h2>
                </div>
              </div>
              {!editingId && (
                <div className="flex items-center space-x-2 mr-4">
                  {localStorage.getItem('cctv_last_switch') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const last = JSON.parse(localStorage.getItem('cctv_last_switch'));
                          setFormData(prev => ({
                            ...prev,
                            ...last,
                            serialNumber: ''
                          }));
                          showNotification('Last switch entry loaded');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Reuse Last Data
                    </button>
                  )}
                  {localStorage.getItem('cctv_draft_switch') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const draft = JSON.parse(localStorage.getItem('cctv_draft_switch'));
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
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Switch Name</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. Core-Switch-01" />
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
                        Floor
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
                </div>

                {/* Column 2: Hardware & Status */}
                <div className="space-y-6">

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Network Brand</label>
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
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Model</label>
                      <input type="text" name="model" value={formData.model} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. C2960X" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Port Count</label>
                      <input type="text" name="portCount" value={formData.portCount} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. 24 / 48" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Asset Number</label>
                      </div>
                      <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner" placeholder="NETWORK/07" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">ETH Uplink</label>
                      <input type="text" name="ethUplink" value={formData.ethUplink} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. 1G / 10G" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">SFP Uplink</label>
                      <input type="text" name="sfpUplink" value={formData.sfpUplink} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner" placeholder="e.g. 10G" />
                    </div>
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
                    <input type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel shadow-inner" placeholder="192.168.1.100" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">MAC Interface</label>
                    <input type="text" name="macAddress" value={formData.macAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="00:1A:2B:3C:4D:5E" />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Remarks</label>
                  <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel shadow-inner border-main custom-scrollbar" rows="3" placeholder="Enter remarks..."></textarea>
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
