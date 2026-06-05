// Structure verified: all JSX blocks are properly balanced.
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Search, Filter, Plus, Cctv as CctvIcon, Map, Building, Shield, X, Edit2, Trash2, Download, Upload, ChevronLeft, ChevronRight, Server } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useActivityLogger } from '../hooks/useActivityLogger';
import { useSiteStore } from '../store/siteStore';
import ComboInput from '../components/ComboInput';

export default function Cameras() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, occupations, fetchOccupations } = useSiteStore();
  useActivityLogger('Assets');
  const [submitting, setSubmitting] = useState(false);
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Assets:EDIT');

  const parseLocation = (camera) => {
    if (!camera) return { college: '—', block: '—', floor: '—', room: '—' };
    
    let college = camera.collegeName || '';
    let block = camera.block || '';
    let floor = camera.floor || '';
    let room = camera.room || '';

    // Robust parsing for pipe-separated legacy or siteName strings
    const raw = (camera.siteName || (camera.block?.includes('|') ? camera.block : '')).trim();
    if (raw && raw.includes('|')) {
      const parts = raw.split('|').map(p => p.trim());
      college = parts[0] || college;
      block = parts[1] || block;
      floor = parts[2] || floor;
      room = parts[3] || room;
    }

    return {
      college: college || '—',
      block: block || '—',
      floor: floor || '—',
      room: room || '—'
    };
  };

  const parseNetworkDetails = (camera) => {
    const loc = parseLocation(camera);
    if (!camera) return { ipv4Gateway: '', subnetMask: '', macAddress: '', collegeName: '' };
    
    return {
      ipv4Gateway: camera.gateway || '',
      subnetMask: camera.subnetMask || '',
      macAddress: camera.macAddress || '',
      collegeName: loc.college !== '—' ? loc.college : (camera.collegeName || '')
    };
  };

  const [cameras, setCameras] = useState([]);
  const [nvrs, setNvrs] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'INSIDE', 'OUTSIDE'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeView, setActiveView] = useState('LIST'); // LIST or LOCATIONS
  const [blockFilter, setBlockFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [collegeFilter, setCollegeFilter] = useState('ALL');
  const [roomFilter, setRoomFilter] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showNvrDropdown, setShowNvrDropdown] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    block: '',
    floor: '',
    room: '',
    deviceType: '',
    ipAddress: '',
    ipv4Gateway: '',
    deviceSerialNumber: '', // This is the auto-generated ID (cameraId)
    serialNumber: '', // This is the actual hardware manufacturer serial
    subnetMask: '',
    macAddress: '',
    status: 'Online',
    campusZone: 'INSIDE',
    collegeName: '',
    brand: '',
    model: '',
    dvrNvrDetails: '',
    remarks: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  // Group cameras by site for the Locations view
  const camerasByLocation = useMemo(() => {
    let filtered = cameras;
    if (blockFilter !== 'ALL') {
      filtered = filtered.filter(c => {
        const { block } = parseLocation(c);
        return block === blockFilter;
      });
    }
    if (floorFilter !== 'ALL') {
      filtered = filtered.filter(c => {
        const { floor } = parseLocation(c);
        return floor === floorFilter;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.siteName || '').toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q)
      );
    }

    const groups = {};
    filtered.forEach(c => {
      const site = c.siteName || 'Unknown Location';
      if (!groups[site]) groups[site] = [];
      groups[site].push(c);
    });
    return Object.entries(groups).map(([name, items]) => ({
      name,
      count: items.length,
      online: items.filter(i => i.status === 'Online').length,
      offline: items.filter(i => i.status === 'Offline').length,
      cameras: items
    }));
  }, [cameras, blockFilter, floorFilter, searchQuery]);

  const camerasByBuilding = useMemo(() => {
    const groups = {};
    cameras.forEach(c => {
      const { block } = parseLocation(c);
      const building = block || 'Unassigned';
      if (!groups[building]) groups[building] = [];
      groups[building].push(c);
    });
    
    let buildingList = Object.entries(groups).map(([name, items]) => ({
      name,
      count: items.length,
      online: items.filter(i => i.status === 'Online').length,
      offline: items.filter(i => i.status === 'Offline').length,
      floors: new Set(items.map(i => parseLocation(i).floor)).size
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      buildingList = buildingList.filter(b => b.name.toLowerCase().includes(q));
    }

    return buildingList;
  }, [cameras, searchQuery]);

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    if (occupations) occupations.forEach(o => colleges.add(o.name));
    cameras.forEach(c => { if (c.collegeName) colleges.add(c.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    if (currentSite?.collegeName) colleges.add(currentSite.collegeName);
    return Array.from(colleges).sort();
  }, [occupations, cameras, currentSite, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    cameras.forEach(c => { if (c.block) blocks.add(c.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    if (currentSite?.block) blocks.add(currentSite.block);
    return Array.from(blocks).sort();
  }, [cameras, currentSite, allLocations]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetBlock = String(formData.block || '');
    if (targetBlock) {
      cameras.forEach(c => { if (String(c.block || '') === targetBlock && c.floor) floors.add(String(c.floor)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && loc.floor) floors.add(String(loc.floor)); });
      if (String(currentSite?.block || '') === targetBlock && currentSite?.floor) floors.add(String(currentSite.floor));
    } else {
      cameras.forEach(c => { if (c.floor) floors.add(String(c.floor)); });
      allLocations.forEach(loc => { if (loc.floor) floors.add(String(loc.floor)); });
      if (currentSite?.floor) floors.add(String(currentSite.floor));
    }
    return Array.from(floors).sort();
  }, [cameras, currentSite, allLocations, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetBlock = String(formData.block || '');
    const targetFloor = String(formData.floor || '');
    if (targetBlock && targetFloor) {
      cameras.forEach(c => { if (String(c.block || '') === targetBlock && String(c.floor || '') === targetFloor && c.room) rooms.add(String(c.room)); });
      allLocations.forEach(loc => { if (String(loc.block || '') === targetBlock && String(loc.floor || '') === targetFloor && loc.room) rooms.add(String(loc.room)); });
      if (String(currentSite?.block || '') === targetBlock && String(currentSite?.floor || '') === targetFloor && currentSite?.room) rooms.add(String(currentSite.room));
    } else {
      cameras.forEach(c => { if (c.room) rooms.add(String(c.room)); });
      allLocations.forEach(loc => { if (loc.room) rooms.add(String(loc.room)); });
      if (currentSite?.room) rooms.add(String(currentSite.room));
    }
    return Array.from(rooms).sort();
  }, [cameras, currentSite, allLocations, formData.block, formData.floor]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    cameras.forEach(c => { if (c.brand) brands.add(c.brand); });
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    if (currentSite?.brand) brands.add(currentSite.brand);
    // Common default brands
    ['HIKVISION', 'DAHUA', 'CP PLUS', 'UNV', 'HONEYWELL'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [cameras, currentSite, allLocations]);
  

  useEffect(() => {
    fetchCameras();
    fetchNvrs();
    fetchSite();
    fetchAllLocations();
    fetchOccupations();
    
    // Check for college filter in URL
    const collegeParam = searchParams.get('college');
    if (collegeParam) {
      setCollegeFilter(collegeParam);
      setShowFilterPanel(true);
    }
  }, [searchParams]);

  // Auto-generate serial number (for new assets)
  useEffect(() => {
    if (showModal && !editingId && cameras.length > 0) {
      const type = formData.cameraType || 'Bullet';
      const prefix = type === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
      
      const existingNumbers = cameras
        .filter(c => String(c.cameraId || '').startsWith(prefix))
        .map(c => {
          const parts = String(c.cameraId || '').split('/');
          const numStr = parts[parts.length - 1];
          return parseInt(numStr) || 0;
        });
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const formattedNumber = nextNumber.toString().padStart(2, '0');
      
      setFormData(prev => ({ ...prev, deviceSerialNumber: `${prefix}${formattedNumber}` }));
    }
  }, [showModal, editingId, cameras, formData.cameraType]);

  const fetchCameras = async () => {
    try {
      const res = await api.get('/cameras/');
      setCameras(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNvrs = async () => {
    try {
      const res = await api.get('/cameras/nvrs/');
      setNvrs(res.data);
    } catch (err) {
      console.error('Failed to fetch NVRs', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    // Helper for IP Formatting (Dots)
    const applyIPMask = (val) => {
      const cleaned = val.replace(/[^0-9.]/g, '');
      const parts = cleaned.split('.');
      if (parts[parts.length - 1].length === 3 && parts.length < 4 && !val.endsWith('.')) {
        return cleaned + '.';
      }
      return cleaned;
    };

    // Helper for MAC Formatting (Colons)
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
      
      // Auto-update Serial Number format when Camera Type changes (only for new assets)
      if (name === 'cameraType' && !editingId) {
        const prefix = newValue === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
        const existingNumbers = cameras
          .filter(c => (c.cameraId || '').startsWith(prefix))
          .map(c => {
            const parts = (c.cameraId || '').split('/');
            const numStr = parts[parts.length - 1];
            return parseInt(numStr) || 0;
          });
        
        const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        nextData.deviceSerialNumber = `${prefix}${nextNum.toString().padStart(2, '0')}`;
      }

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
    const payload = {
      name: formData.name || formData.deviceType || 'Unknown Device',
      siteName: formData.room || formData.block || 'Unknown',
      ipAddress: formData.ipAddress || '',
      gateway: formData.ipv4Gateway || '',
      subnetMask: formData.subnetMask || '',
      macAddress: formData.macAddress || '',
      collegeName: formData.collegeName || '',
      status: formData.status || 'Online',
      block: formData.block || '',
      floor: formData.floor || '',
      room: formData.room || '',
      deviceType: formData.deviceType || '',
      serialNumber: formData.serialNumber || '', // Use the hardware serial field
      campusZone: formData.campusZone || 'INSIDE',
      brand: formData.brand || '',
      model: formData.model || '',
      dvrNvrDetails: formData.dvrNvrDetails || '',
      remarks: formData.remarks || ''
    };

    // Auto-generate System Node ID if left blank
    let finalCameraId = formData.deviceSerialNumber?.trim();
    if (!finalCameraId) {
      const type = formData.cameraType || 'Bullet';
      const prefix = type === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
      const existingNumbers = cameras
        .filter(c => String(c.cameraId || '').startsWith(prefix))
        .map(c => parseInt(String(c.cameraId || '').split('/').pop()) || 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      finalCameraId = `${prefix}${nextNumber.toString().padStart(2, '0')}`;
    }
    payload.cameraId = finalCameraId;

    try {
      setSubmitting(true);
      if (editingId) {
        await api.put(`/cameras/${editingId}/`, payload);
        showNotification('Camera configuration updated');
      } else {
        await api.post('/cameras/', payload);
        showNotification('New asset registered successfully');
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
        block: '', floor: '', room: '', deviceType: '', ipAddress: '',
        ipv4Gateway: '', deviceSerialNumber: '', serialNumber: '', subnetMask: '', macAddress: '', status: 'Online',
        collegeName: '', brand: '', model: '', dvrNvrDetails: '', remarks: ''
      });
      fetchCameras();
    } catch (err) {
      console.error(err);
      showNotification('Error saving camera. Check Serial Number.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const editCamera = (camera) => {
    const loc = parseLocation(camera);
    const { ipv4Gateway, subnetMask, macAddress, collegeName } = parseNetworkDetails(camera);

    setFormData({
      block: loc.block !== '—' ? loc.block : '',
      floor: loc.floor !== '—' ? loc.floor : '',
      deviceType: camera.name || '',
      ipAddress: camera.ipAddress || '',
      ipv4Gateway,
      deviceSerialNumber: camera.cameraId || '',
      serialNumber: camera.serialNumber || '',
      room: camera.room || '',
      subnetMask,
      macAddress,
      status: camera.status || 'Online',
      campusZone: camera.campusZone || (isOutside(camera.siteName) ? 'OUTSIDE' : 'INSIDE'),
      collegeName: collegeName || '',
      brand: camera.brand || '',
      model: camera.model || '',
      dvrNvrDetails: camera.dvrNvrDetails || '',
      remarks: camera.remarks || ''
    });
    setEditingId(camera._id || camera.id);
    setShowModal(true);
  };

  const deleteCamera = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/${id}/`);
        showNotification('Asset purged from database');
        fetchCameras();
      } catch (err) {
        console.error(err);
        showNotification('Failed to delete asset', 'error');
      }
    });
  };

  const openNewModal = async () => {
    await fetchSite(); // Always get freshest DB data before opening
    setEditingId(null);
    
    // Determine if we should show the 'New' input fields based on global site
    const college = currentSite?.collegeName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';

    setFormData({
      block: block,
      floor: floor,
      room: room,
      deviceType: 'Bullet', 
      ipAddress: '',
      ipv4Gateway: '', 
      deviceSerialNumber: '', 
      subnetMask: '', 
      macAddress: '', 
      status: 'Online', 
      campusZone: 'INSIDE',
      collegeName: college, 
      brand: '', 
      dvrNvrDetails: '',
      remarks: ''
    });
    setShowModal(true);
  };

  const generateSerialNumber = () => {
    const type = formData.cameraType;
    const prefix = type === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
    
    // Filter cameras of the same type and extract numbers
    const existingNumbers = cameras
      .filter(c => {
        if (type === 'Dome') return String(c.cameraId || '').startsWith('CCTV/DE/');
        return String(c.cameraId || '').startsWith('CCTV/BT/');
      })
      .map(c => {
        const parts = String(c.cameraId || '').split('/');
        const numStr = parts[parts.length - 1];
        return parseInt(numStr) || 0;
      });
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    const formattedNumber = nextNumber.toString().padStart(2, '0');
    
    setFormData(prev => ({ ...prev, deviceSerialNumber: `${prefix}${formattedNumber}` }));
    showNotification(`Generated ID: ${prefix}${formattedNumber}`);
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setSubmitting(true);
      const res = await api.post('/cameras/upload_excel/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showNotification(`Import Complete: ${res.data.created} Added, ${res.data.updated} Updated`);
      fetchCameras();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to import data. Check file format.', 'error');
    } finally {
      setSubmitting(false);
      if (e.target) e.target.value = '';
    }
  };
  
  const exportToExcel = () => {
    const headers = [
      'S.No', 'College Name', 'Block', 'Floor', 'Room', 'Campus Zone', 
      'Device Type', 'IP Address', 'IPv4 Gateway', 
      'Device ID', 'Hardware Serial', 'Subnet Mask', 'MAC Address', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = filteredCameras.map((camera, idx) => {
      const loc = parseLocation(camera);
      const { ipv4Gateway, subnetMask, macAddress } = parseNetworkDetails(camera);
      const zone = camera.campusZone || (isOutside(camera.siteName) ? 'OUTSIDE' : 'INSIDE');
      
      return [
        idx + 1,
        escapeCSV(loc.college),
        escapeCSV(loc.block),
        escapeCSV(loc.floor),
        escapeCSV(loc.room),
        escapeCSV(zone),
        escapeCSV(camera.name || 'N/A'),
        escapeCSV(camera.ipAddress || ''),
        escapeCSV(ipv4Gateway || ''),
        escapeCSV(camera.cameraId || ''),
        escapeCSV(camera.serialNumber || ''),
        escapeCSV(subnetMask || ''),
        escapeCSV(macAddress || ''),
        escapeCSV(camera.status || '')
      ];
    });

    const csvContent = "\uFEFF" + [ 
      headers.join(","), 
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    let fileName = 'CCTV_Inventory';
    if (collegeFilter !== 'ALL') fileName += `_${collegeFilter.replace(/\s+/g, '_')}`;
    if (blockFilter !== 'ALL') fileName += `_Block_${blockFilter.replace(/\s+/g, '_')}`;
    if (floorFilter !== 'ALL') fileName += `_Floor_${floorFilter.replace(/\s+/g, '_')}`;
    if (statusFilter !== 'ALL') fileName += `_${statusFilter}`;
    fileName += `_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${filteredCameras.length} records successfully`);
  };

  const isOutside = (site, zone) => {
    if (zone) return zone === 'OUTSIDE';
    if (!site) return false;
    const s = site.toLowerCase();
    return s.includes('gate') || s.includes('outside') || s.includes('perimeter') || s.includes('road') || s.includes('external') || s.includes('parking') || s.includes('boundary');
  };

  const stats = useMemo(() => {
    const inside = cameras.filter(c => !isOutside(c.siteName || c.site, c.campusZone)).length;
    const outside = cameras.filter(c => isOutside(c.siteName || c.site, c.campusZone)).length;
    const locations = new Set(cameras.map(c => c.siteName)).size;
    return { total: cameras.length, inside, outside, locations };
  }, [cameras]);

  const filteredCameras = useMemo(() => {
    let filtered = cameras;

    // College Filter
    if (collegeFilter !== 'ALL') {
      filtered = filtered.filter(c => parseLocation(c).college === collegeFilter);
    }

    // Block Filter
    if (blockFilter !== 'ALL') {
      filtered = filtered.filter(c => parseLocation(c).block === blockFilter);
    }

    // Floor Filter
    if (floorFilter !== 'ALL') {
      filtered = filtered.filter(c => parseLocation(c).floor === floorFilter);
    }

    // Room Filter
    if (roomFilter !== 'ALL') {
      filtered = filtered.filter(c => parseLocation(c).room === roomFilter);
    }


    if (filterType === 'INSIDE') filtered = filtered.filter(c => !isOutside(c.siteName || c.site, c.campusZone));
    if (filterType === 'OUTSIDE') filtered = filtered.filter(c => isOutside(c.siteName || c.site, c.campusZone));
    
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const { collegeName } = parseNetworkDetails(c);
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.cameraId || '').toLowerCase().includes(q) ||
          (c.siteName || '').toLowerCase().includes(q) ||
          (c.ipAddress || '').toLowerCase().includes(q) ||
          (c.dvrNvrDetails || '').toLowerCase().includes(q) ||
          (collegeName || '').toLowerCase().includes(q)
        );
      });
    }
    return filtered;
  }, [cameras, filterType, statusFilter, searchQuery, collegeFilter, blockFilter, floorFilter]);

  const pieData = [
    { name: 'Inside Campus', value: stats.inside },
    { name: 'Outside Campus', value: stats.outside },
  ];
  const COLORS = ['#3b82f6', '#f59e0b'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <CctvIcon className="mr-3 text-blue-500" size={28} />
            Cameras
          </h1>
        </div>
        <div className="flex space-x-3">
          <button onClick={exportToExcel} className="glass-panel flex items-center px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all">
            <Download size={16} className="mr-2" />
            Export Data
          </button>
          {canEdit && (
            <>
              <label className="glass-panel flex items-center px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer">
                <Upload size={16} className="mr-2" />
                Bulk Import
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={openNewModal} className="neon-button px-8 py-2">
                <Plus size={16} className="mr-2" />
                Register Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Switcher Tabs & Quick Building Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex space-x-1 p-1 bg-panel border border-main rounded-xl w-fit shadow-sm">
          <button 
            onClick={() => setActiveView('LIST')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'LIST' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-secondary hover:text-teal-600 hover:bg-card'}`}
          >
            All Cameras
          </button>
          <button 
            onClick={() => setActiveView('LOCATIONS')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'LOCATIONS' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-secondary hover:text-teal-600 hover:bg-card'}`}
          >
            By Location
          </button>
          <button 
            onClick={() => setActiveView('BUILDINGS')}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeView === 'BUILDINGS' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-secondary hover:text-teal-600 hover:bg-card'}`}
          >
            By Building
          </button>
        </div>


      </div>
      
      {/* Top Stats & Chart Row (Visible for all views) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-slide-up delay-100">
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <button onClick={() => { setActiveView('LOCATIONS'); setFilterType('ALL'); }} className={`glass-panel p-5 text-left transition-all ${activeView === 'LOCATIONS' ? 'border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)] bg-purple-500/10' : 'hover:border-main'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/20 rounded-xl border border-purple-500/30 text-purple-600">
                <Map size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600 mb-1">{stats.locations}</p>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Total Locations</p>
          </button>

          <button onClick={() => { setActiveView('LIST'); setFilterType('ALL'); }} className={`glass-panel p-5 text-left transition-all ${activeView === 'LIST' && filterType === 'ALL' ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-blue-500/10' : 'hover:border-main'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/30 text-blue-600">
                <CctvIcon size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-1">{stats.total}</p>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Total Assets</p>
          </button>

          <button onClick={() => setFilterType('INSIDE')} className={`glass-panel p-5 text-left transition-all ${filterType === 'INSIDE' ? 'border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] bg-blue-500/10' : 'hover:border-main group'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border transition-colors ${filterType === 'INSIDE' ? 'bg-blue-500/20 border-blue-500/40 text-blue-500' : 'bg-panel border-main text-secondary group-hover:text-blue-500 group-hover:border-blue-500/30'}`}>
                <Building size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1 text-blue-500">{stats.inside}</p>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Inside Campus</p>
          </button>

          <button onClick={() => setFilterType('OUTSIDE')} className={`glass-panel p-5 text-left transition-all ${filterType === 'OUTSIDE' ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] bg-amber-500/10' : 'hover:border-main group'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border transition-colors ${filterType === 'OUTSIDE' ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-panel border-main text-secondary group-hover:text-amber-500 group-hover:border-amber-500/30'}`}>
                <Map size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1 text-amber-500">{stats.outside}</p>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Outside Campus</p>
          </button>
        </div>

        <div className="glass-panel p-5 flex items-center justify-center relative">
          <div className="w-full h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={5} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ filter: `drop-shadow(0px 0px 6px ${COLORS[index % COLORS.length]}80)` }} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '12px', 
                    fontSize: '12px', 
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--panel-shadow)',
                    padding: '12px'
                  }} 
                  itemStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute right-4 flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>
              <span className="text-[10px] text-dim font-medium uppercase tracking-wider">Inside</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]"></div>
              <span className="text-[10px] text-dim font-medium uppercase tracking-wider">Outside</span>
            </div>
          </div>
        </div>
      </div>

      {activeView === 'LIST' && (
        <div className="space-y-6">

      <div className="glass-panel overflow-hidden animate-slide-up delay-200">
        <div className="p-5 border-b border-main flex justify-between items-center bg-card/40">
          <div className="flex items-center space-x-2 text-xs font-black text-secondary uppercase tracking-widest">
            <Filter size={14} className="text-teal-500" />
            <span>Search Filters</span>
          </div>
          <button 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`flex items-center px-5 py-2.5 rounded-xl border transition-all text-sm font-black uppercase tracking-widest ${showFilterPanel ? 'bg-teal-500/10 border-teal-500/30 text-teal-600' : 'border-main text-secondary hover:text-teal-600 hover:bg-panel'}`}
          >
            {showFilterPanel ? 'Hide Filters' : 'Show Advanced Filters'}
          </button>
        </div>

        {showFilterPanel && (
          <div className="px-5 py-6 border-b border-main bg-panel flex flex-wrap gap-8 animate-slide-up">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">College Filter</label>
              <select 
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL COLLEGES</option>
                {uniqueColleges.map(college => (
                  <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Block Filter</label>
              <select 
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL BLOCKS</option>
                {uniqueBlocks.map(block => (
                  <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Floor Filter</label>
              <select 
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[150px]"
              >
                <option value="ALL">ALL FLOORS</option>
                {uniqueFloors.map(floor => (
                  <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Room Filter</label>
              <select 
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="glass-input !bg-card px-3 py-2 text-xs font-bold rounded-lg border-main outline-none focus:border-teal-500/50 min-w-[180px]"
              >
                <option value="ALL">ALL ROOMS</option>
                {uniqueRooms.map(room => (
                  <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'}</option>
                ))}
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

        <div className="p-5 border-b border-main flex justify-between items-center bg-card/40">
          <div className="flex items-center space-x-2 text-xs font-black text-secondary uppercase tracking-widest">
            <CctvIcon size={14} className="text-teal-500" />
            <span>Device Inventory</span>
            <span className="ml-2 text-dim font-bold text-[10px]">({filteredCameras.length} Assets)</span>
          </div>
          
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
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                {Math.min((currentPage - 1) * itemsPerPage + 1, filteredCameras.length)}-{Math.min(currentPage * itemsPerPage, filteredCameras.length)} of {filteredCameras.length}
              </span>
              <button 
                disabled={currentPage >= Math.ceil(filteredCameras.length / itemsPerPage)}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-panel border-b border-main">
              <tr className="text-main">
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Device Identity</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Location Protocol</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Specifications</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest">Network Logic</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                {canEdit && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCameras.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((camera) => {
                const loc = parseLocation(camera);
                const isExt = isOutside(camera.siteName, camera.campusZone);
                return (
                  <tr key={camera._id || camera.id} onClick={() => navigate(`/devices/cameras/${camera._id || camera.id}`)} className="hover:bg-white/5 cursor-pointer transition-colors group">
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-sm font-mono text-teal-500 font-black">{camera.cameraId || '—'}</span>
                        <span className="text-[9px] text-dim font-black uppercase tracking-widest">Node ID</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2 max-w-[300px]">
                        <span className="px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-lg text-[9px] font-black text-teal-400 uppercase tracking-widest">{loc.college}</span>
                        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center">
                          <div className={`w-1.5 h-1.5 rounded-full mr-2 ${isExt ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]'}`}></div>
                          {loc.block}
                        </span>
                        <span className="px-3 py-1 bg-panel border border-main rounded-lg text-[9px] font-black text-secondary uppercase tracking-widest">Floor {loc.floor}</span>
                        <span className="px-3 py-1 bg-panel border border-main rounded-lg text-[9px] font-black text-secondary uppercase tracking-widest">{loc.room}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-black text-main uppercase tracking-tight">{camera.name || '—'}</span>
                        <span className="text-[9px] text-dim font-black uppercase tracking-widest">{camera.brand || 'VENDOR'}</span>
                        {camera.dvrNvrDetails && (
                          <div className="flex flex-wrap gap-1 mt-1 max-w-[150px]">
                            {String(camera.dvrNvrDetails).split(',').filter(Boolean).map((nvr, idx) => {
                              const nvrRaw = nvr.trim();
                              const actualNvr = nvrs.find(n => n.nvrName === nvrRaw || String(n.sNo) === nvrRaw || String(n._id) === nvrRaw || String(n.id) === nvrRaw || String(n.serialNumber) === nvrRaw);
                              const nvrName = actualNvr ? actualNvr.nvrName : nvrRaw;
                              const displayText = nvrName.toUpperCase().startsWith('NVR') ? nvrName : `NVR: ${nvrName}`;
                              return (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-[8px] font-black text-purple-400 uppercase tracking-widest w-fit">
                                  {displayText}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-mono text-secondary font-bold">{camera.ipAddress || '—'}</span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter bg-blue-500/10 px-1 rounded">MFR SN</span>
                          <span className="text-[10px] font-mono text-main font-bold tracking-tight">{camera.serialNumber || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        camera.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                        camera.status === 'Offline' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                        'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      }`}>
                        {camera.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-3 text-right">
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); editCamera(camera); }} className="p-1.5 text-dim hover:text-blue-400 rounded-lg">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteCamera(camera._id || camera.id); }} className="p-1.5 text-dim hover:text-red-400 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredCameras.length === 0 && (
                <tr>
                  <td colSpan="11" className="p-12 text-center text-dim">
                    <Shield size={48} className="mx-auto text-dim mb-4 opacity-50" />
                    <p>No cameras found matching this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
        </div>
      )}

      {activeView === 'LOCATIONS' && (
        <div className="space-y-6 animate-fade-in">
      {/* Location Filters */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row gap-4 bg-panel border border-main rounded-2xl">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by College</label>
          <select 
            value={collegeFilter} 
            onChange={(e) => setCollegeFilter(e.target.value)}
            className="glass-input w-full p-2.5 text-xs font-bold"
          >
            <option value="ALL">ALL COLLEGES</option>
            {uniqueColleges.map(college => (
              <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Block</label>
          <select 
            value={blockFilter} 
            onChange={(e) => setBlockFilter(e.target.value)}
            className="glass-input w-full p-2.5 text-xs font-bold"
          >
            <option value="ALL">ALL BLOCKS</option>
            {uniqueBlocks.map(block => (
              <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Floor</label>
          <select 
            value={floorFilter} 
            onChange={(e) => setFloorFilter(e.target.value)}
            className="glass-input w-full p-2.5 text-xs font-bold"
          >
            <option value="ALL">ALL FLOORS</option>
            {uniqueFloors.map(floor => (
              <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Room</label>
          <select 
            value={roomFilter} 
            onChange={(e) => setRoomFilter(e.target.value)}
            className="glass-input w-full p-2.5 text-xs font-bold"
          >
            <option value="ALL">ALL ROOMS</option>
            {uniqueRooms.map(room => (
              <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end space-x-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold uppercase tracking-wider shadow-lg"
          >
            <Download size={16} className="mr-2" />
            Download
          </button>
          <button 
            onClick={() => { setBlockFilter('ALL'); setFloorFilter('ALL'); setCollegeFilter('ALL'); setRoomFilter('ALL'); }}
            className="px-4 py-2.5 text-[10px] font-bold text-dim hover:text-main transition-colors uppercase tracking-widest"
          >
            Reset
          </button>
        </div>
      </div>

        {/* Device Inventory Table in Locations View */}
        <div className="glass-panel overflow-hidden bg-panel border border-main rounded-2xl shadow-2xl">
          <div className="p-6 border-b border-main flex justify-between items-center bg-card/40">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center">
              <CctvIcon size={18} className="mr-3 text-blue-400" />
              Device Inventory <span className="ml-2 text-dim font-bold">({filteredCameras.length} Assets)</span>
            </h3>
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
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredCameras.length)}-{Math.min(currentPage * itemsPerPage, filteredCameras.length)} of {filteredCameras.length}
                </span>
                <button 
                  disabled={currentPage >= Math.ceil(filteredCameras.length / itemsPerPage)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-panel border-b border-white/10">
              <tr className="text-dim">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Device ID</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Institution</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Block</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Floor</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Room</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">IP Address</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest">Manufacturer SN</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-main">
                {filteredCameras.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((camera) => {
                  const loc = parseLocation(camera);
                  return (
                    <tr key={camera._id || camera.id} className="hover:bg-panel transition-colors group cursor-pointer" onClick={() => navigate(`/devices/cameras/${camera._id || camera.id}`)}>
                      <td className="p-4 text-xs font-mono font-bold text-teal-600">{camera.cameraId || '—'}</td>
                      <td className="p-4 text-[10px] font-black text-main uppercase tracking-tight">{loc.college}</td>
                      <td className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">{loc.block}</td>
                      <td className="p-4 text-xs text-main">{loc.floor}</td>
                      <td className="p-4 text-xs text-main">{loc.room}</td>
                      <td className="p-4 text-xs font-mono text-secondary">{camera.ipAddress || '—'}</td>
                      <td className="p-4 text-xs font-mono text-dim">{camera.serialNumber || '—'}</td>
                      <td className="p-4">
                        <div className="flex justify-center">
                          <span className={`w-2 h-2 rounded-full ${camera.status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCameras.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-dim text-xs font-bold uppercase tracking-widest">No assets found in selected location parameters</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Camera Modal (Add / Edit) */}

      {activeView === 'BUILDINGS' && (
        <div className="space-y-6 animate-fade-in">
          <div className="glass-panel overflow-hidden border border-main bg-card shadow-sm">
            <div className="p-5 border-b border-main bg-panel flex items-center justify-between">
              <h3 className="text-sm font-bold text-main uppercase tracking-widest flex items-center">
                <Building className="mr-2 text-teal-600" size={18} /> Building-Level Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-main">
                    <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest">Building / Block Name</th>
                    <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-center">Floors</th>
                    <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-center">Total Assets</th>
                    <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-center">Operational Status</th>
                    <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-right">Quick Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main">
                  {camerasByBuilding.map((build) => (
                    <tr key={build.name} className="hover:bg-panel transition-colors group">
                      <td className="p-4">
                        <span className="text-sm font-bold text-main group-hover:text-teal-600 transition-colors">{build.name}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-xs font-bold text-secondary">{build.floors} Floors</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-mono text-main">{build.count} Nodes</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center items-center space-x-3">
                          <span className="text-[10px] font-bold text-emerald-600">{build.online} UP</span>
                          <div className="w-16 h-1.5 bg-panel rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(build.online/build.count)*100}%` }}></div>
                          </div>
                          <span className="text-[10px] font-bold text-orange-600">{build.offline} DOWN</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => { setSearchQuery(build.name); setActiveView('LOCATIONS'); }}
                          className="px-4 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 hover:bg-teal-600 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm"
                        >
                          Show Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl">
                  <CctvIcon className="text-teal-500" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify Camera' : 'Camera'}
                  </h2>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-secondary hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Location Information */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                      College / Institution Name
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
                  <div className="grid grid-cols-2 gap-6">
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
                        className="glass-input w-full p-[14px] text-sm text-secondary bg-panel border-main shadow-inner" 
                        placeholder="e.g. DS-2CD2043G2" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
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
                        Floor
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Campus Zone</label>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-black/20 rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, campusZone: 'INSIDE'})}
                        className={`flex items-center justify-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.campusZone === 'INSIDE' ? 'bg-teal-600 text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                      >
                        <Building size={14} className="mr-2" /> INSIDE
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({...formData, campusZone: 'OUTSIDE'})}
                        className={`flex items-center justify-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.campusZone === 'OUTSIDE' ? 'bg-amber-600 text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                      >
                        <Map size={14} className="mr-2" /> OUTSIDE
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Hardware Logic (Camera Type)</label>
                    <select 
                      name="cameraType" 
                      value={formData.cameraType} 
                      onChange={handleInputChange} 
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer shadow-inner"
                    >
                      <option value="Bullet">Bullet Camera</option>
                      <option value="Dome">Dome Camera</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex justify-between">
                      System Node ID
                      <button type="button" onClick={generateSerialNumber} className="text-[9px] text-teal-600 font-black tracking-widest hover:text-teal-500 transition-colors uppercase">AUTO GENERATE</button>
                    </label>
                    <input type="text" name="deviceSerialNumber" value={formData.deviceSerialNumber} readOnly className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel border-main shadow-inner cursor-not-allowed opacity-80" placeholder="Auto-generated on save" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Manufacturer Serial Number</label>
                    <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel border-main shadow-inner" placeholder="e.g. SN123456789" />
                  </div>
                </div>
              </div>

              {/* Network Information */}
              <div className="space-y-6 mt-10">

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">IP Protocol</label>
                    <input required type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-teal-500 bg-panel shadow-inner" placeholder="192.168.1.x" />
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
                
                <div className="mt-6 space-y-2 relative">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex justify-between">
                    <span>Connected NVRs / Storage Servers</span>
                    <span className="text-teal-500">{(String(formData.dvrNvrDetails || '').split(',').filter(Boolean).length)} Selected</span>
                  </label>
                  
                  {/* Selected NVR Chips */}
                  {(String(formData.dvrNvrDetails || '').split(',').filter(Boolean).length > 0) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean).map(nvrName => (
                        <div key={nvrName} className="flex items-center px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                          <Server size={12} className="mr-2 opacity-70" />
                          {nvrName}
                          <button 
                            type="button" 
                            onClick={() => {
                              const updated = String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean).filter(n => n !== nvrName);
                              setFormData({...formData, dvrNvrDetails: updated.join(', ')});
                            }} 
                            className="ml-2 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dropdown Trigger */}
                  <div 
                    onClick={() => setShowNvrDropdown(!showNvrDropdown)}
                    className={`glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer shadow-inner flex justify-between items-center transition-colors ${showNvrDropdown ? 'border-teal-500/50 text-white' : 'text-dim hover:text-white'}`}
                  >
                    <span>Click to assign an NVR...</span>
                    <ChevronRight className={`transition-transform duration-300 ${showNvrDropdown ? 'rotate-90 text-teal-400' : ''}`} size={16} />
                  </div>

                  {/* Dropdown Menu */}
                  {showNvrDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-[#0f0f13] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-48 overflow-y-auto custom-scrollbar">
                      {nvrs.length === 0 ? (
                        <div className="p-4 text-xs text-dim italic text-center">No NVRs registered yet.</div>
                      ) : (
                        nvrs.map(nvr => {
                          const currentNvrs = String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean);
                          const isSelected = currentNvrs.includes(nvr.nvrName);
                          return (
                            <button
                              key={nvr._id || nvr.id}
                              type="button"
                              onClick={() => {
                                let updated = [...currentNvrs];
                                if (isSelected) {
                                  updated = updated.filter(name => name !== nvr.nvrName);
                                } else {
                                  updated.push(nvr.nvrName);
                                }
                                setFormData({...formData, dvrNvrDetails: updated.join(', ')});
                              }}
                              className={`w-full text-left px-4 py-3 text-xs font-bold transition-all flex items-center justify-between border-b border-white/5 last:border-0 ${
                                isSelected ? 'bg-teal-500/10 text-teal-400' : 'text-secondary hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center">
                                <Server size={14} className={`mr-2 ${isSelected ? 'text-teal-400' : 'text-dim'}`} />
                                {nvr.nvrName} {nvr.ipAddress ? <span className="opacity-40 ml-1 text-[10px] font-mono font-normal">({nvr.ipAddress})</span> : ''}
                              </div>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]"></div>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {editingId && (
                <div className="space-y-6 mt-10">
                  <h3 className="text-[11px] font-black text-teal-500 uppercase tracking-[0.4em] border-b border-main pb-3">Operational State</h3>
                  <div className="grid grid-cols-3 gap-3">
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
              )}

              {/* Maintenance History */}
              <div className="space-y-6 mt-10">

                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Document relocation, maintenance logs, or sensor diagnostics..."
                  className="glass-input w-full min-h-[120px] p-4 text-sm bg-panel border-main shadow-inner resize-none font-medium leading-relaxed"
                />
              </div>

              <div className="flex justify-end space-x-6 mt-10 pt-8 border-t border-main shrink-0 px-2 pb-2">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black text-secondary hover:text-main uppercase tracking-[0.2em] transition-colors">Cancel</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="glass-button px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl"
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

