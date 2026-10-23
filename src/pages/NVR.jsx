import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { Search, Filter, Plus, Server, HardDrive, Cpu, X, Edit2, Trash2, Building, Activity, ShieldCheck, ShieldAlert, Download, Upload, Info, ChevronRight, ChevronLeft, Network, Printer, RefreshCw, FileText, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
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

  const [viewMode, setViewMode] = useState('registry'); // 'registry' or 'report'
  const [reportTab, setReportTab] = useState('modified_only'); // 'modified_only' or 'all_units'
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Storage:EDIT');
  
  // Status Change Modal State
  const [statusModalNvr, setStatusModalNvr] = useState(null);
  const [statusFormData, setStatusFormData] = useState({ status: 'Online', remark: '' });
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [backendRemarksLog, setBackendRemarksLog] = useState([]);

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
    fetchRemarksLog();
  }, []);

  const fetchRemarksLog = async () => {
    try {
      const res = await api.get('/cameras/nvrs/all_remarks/');
      if (Array.isArray(res.data)) {
        setBackendRemarksLog(res.data);
      }
    } catch (err) {
      console.warn("NVR all_remarks fetch failed, fallback to embedded message_history", err);
    }
  };

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
      if (statusFilter !== 'ALL' && (nvr.status || 'Online').toUpperCase() !== statusFilter.toUpperCase()) return false;
      return true;
    });
  }, [baseFilteredNVRs, statusFilter]);

  // Combine status change remarks from API and embedded message_history
  const statusChangeLogs = useMemo(() => {
    const map = new Map();

    const parseStatusFromRemark = (remarkText, fallbackStatus) => {
      if (!remarkText) return fallbackStatus || 'Online';
      const matchTo = remarkText.match(/Status changed (?:from .* )?to "?(Online|Offline|Maintenance|Scrap)"?/i);
      if (matchTo && matchTo[1]) {
        const parsed = matchTo[1];
        return parsed.charAt(0).toUpperCase() + parsed.slice(1).toLowerCase();
      }
      return fallbackStatus || 'Online';
    };

    // 1. From backend all_remarks
    backendRemarksLog.forEach(item => {
      const key = `remark_${item.id || item._id}`;
      const status = item.device_status || parseStatusFromRemark(item.remark, null);
      map.set(key, {
        id: item.id || item._id,
        nvrId: item.nvr,
        nvrName: item.nvr_name || 'Storage Unit',
        serialNumber: item.nvr_serial || '—',
        ipAddress: item.nvr_ip || '—',
        divisionName: item.nvr_division || '—',
        block: item.nvr_block || '—',
        floor: item.nvr_floor || '—',
        room: item.nvr_room || '—',
        remark: item.remark || 'Status updated',
        device_status: status || 'Online',
        userName: item.userName || 'System Admin',
        date: item.date,
        time: item.time,
        createdAt: item.createdAt || new Date().toISOString()
      });
    });

    // 2. From embedded message_history of NVRs
    nvrs.forEach(nvr => {
      if (Array.isArray(nvr.message_history)) {
        nvr.message_history.forEach(m => {
          const key = `remark_${m.id || m._id}`;
          if (!map.has(key)) {
            const status = m.device_status || parseStatusFromRemark(m.remark, nvr.status);
            map.set(key, {
              id: m.id || m._id,
              nvrId: nvr.id || nvr._id,
              nvrName: nvr.nvrName,
              serialNumber: nvr.serialNumber,
              ipAddress: nvr.ipAddress,
              divisionName: nvr.divisionName,
              block: nvr.block,
              floor: nvr.floor,
              room: nvr.room,
              remark: m.remark,
              device_status: status || 'Online',
              userName: m.userName || 'System Admin',
              date: m.date,
              time: m.time,
              createdAt: m.createdAt || new Date().toISOString()
            });
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [backendRemarksLog, nvrs]);

  const filteredStatusLogs = useMemo(() => {
    return statusChangeLogs.filter(log => {
      if (statusFilter !== 'ALL' && (log.device_status || 'Online').toUpperCase() !== statusFilter.toUpperCase()) return false;
      if (collegeFilter !== 'ALL' && (log.divisionName || '').toUpperCase() !== collegeFilter.toUpperCase()) return false;
      if (blockFilter !== 'ALL' && (log.block || '').toUpperCase() !== blockFilter.toUpperCase()) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        (log.nvrName || '').toLowerCase().includes(q) ||
        (log.serialNumber || '').toLowerCase().includes(q) ||
        (log.ipAddress || '').toLowerCase().includes(q) ||
        (log.remark || '').toLowerCase().includes(q) ||
        (log.divisionName || '').toLowerCase().includes(q) ||
        (log.block || '').toLowerCase().includes(q) ||
        (log.userName || '').toLowerCase().includes(q)
      );
    });
  }, [statusChangeLogs, searchQuery, statusFilter, collegeFilter, blockFilter]);

  const openStatusModal = (nvr) => {
    setStatusModalNvr(nvr);
    setStatusFormData({
      status: nvr.status || 'Online',
      remark: ''
    });
  };

  const handleSaveStatusChange = async (e) => {
    e.preventDefault();
    if (!statusModalNvr || statusSubmitting) return;

    if (!statusFormData.remark.trim()) {
      showNotification('Please enter a remark / reason for the status change.', 'error');
      return;
    }

    setStatusSubmitting(true);
    try {
      const id = statusModalNvr._id || statusModalNvr.id;

      // Update NVR status and save remark
      await api.patch(`/cameras/nvrs/${id}/`, {
        status: statusFormData.status,
        remark: statusFormData.remark
      });

      await api.post(`/cameras/nvrs/${id}/add_remark/`, {
        remark: statusFormData.remark,
        device_status: statusFormData.status
      });

      showNotification(`NVR Status updated to "${statusFormData.status}" & remark saved.`);
      setStatusModalNvr(null);
      fetchNVRs();
      fetchRemarksLog();
    } catch (err) {
      console.error("Status change error:", err);
      showNotification(err.response?.data?.message || 'Failed to update status & save remark.', 'error');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (viewMode === 'report' && reportTab === 'modified_only') {
      const headers = ['S.No', 'Date & Time', 'Asset Number', 'Device Name', 'IP Address', 'Location', 'Status', 'Remark / Reason Saved', 'Updated By'];
      const dataRows = filteredStatusLogs.map((log, idx) => [
        idx + 1,
        escapeCSV(log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'),
        escapeCSV(log.serialNumber || 'N/A'),
        escapeCSV(log.nvrName || 'N/A'),
        escapeCSV(log.ipAddress || 'N/A'),
        escapeCSV([log.divisionName, log.block, log.floor, log.room].filter(Boolean).join(' / ') || 'N/A'),
        escapeCSV(log.device_status || 'N/A'),
        escapeCSV(log.remark || 'N/A'),
        escapeCSV(log.userName || 'N/A')
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...dataRows.map(row => row.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      let fileName = 'NVR_Status_Changes_Report';
      if (statusFilter !== 'ALL') fileName += `_${statusFilter}`;
      fileName += `_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification(`Exported ${filteredStatusLogs.length} status change records (${statusFilter === 'ALL' ? 'All Statuses' : statusFilter})`);
      return;
    }

    const headers = [
      'S.No', 'NVR Name', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Brand', 'Model/Serial number',
      'Hard Disk', 'Channels', 'Asset Number', 'Status', 'Date Added'
    ];

    const dataRows = filteredNVRs.map((nvr, idx) => [
      idx + 1,
      escapeCSV(nvr.nvrName || 'N/A'),
      escapeCSV(nvr.ipAddress || 'N/A'),
      escapeCSV(nvr.divisionName || 'N/A'),
      escapeCSV(nvr.block || 'N/A'),
      escapeCSV(nvr.floor || 'N/A'),
      escapeCSV(nvr.room || 'N/A'),
      escapeCSV(nvr.brand || 'N/A'),
      escapeCSV(`${nvr.model || 'N/A'} / ${nvr.serialNumber || 'N/A'}`),
      escapeCSV(nvr.hardDisk || 'N/A'),
      escapeCSV(nvr.channel || 'N/A'),
      escapeCSV(nvr.serialNumber || 'N/A'),
      escapeCSV(nvr.status || 'N/A'),
      escapeCSV(nvr.createdAt?.split('T')[0] || '')
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
    const isStatusReport = viewMode === 'report' && reportTab === 'modified_only';
    
    const htmlContent = `
      <html>
        <head>
          <title>${isStatusReport ? 'NVR Status Changes & Remarks Report' : 'NVR Inventory Export'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 18px; text-align: center; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; color: #4b5563; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
            .status-online { background-color: #d1fae5; color: #047857; }
            .status-offline { background-color: #fee2e2; color: #b91c1c; }
            .status-maint { background-color: #fef3c7; color: #b45309; }
            .footer { margin-top: 25px; font-size: 10px; color: #9ca3af; text-align: center; }
            .remark-box { background: #f8fafc; border-left: 3px solid #0284c7; padding: 4px 8px; font-style: italic; }
          </style>
        </head>
        <body>
          <h1>${isStatusReport ? 'NVR Status Changes & Saved Remarks Audit Report' : 'NVR Storage Units Inventory Report'}</h1>
          <table>
            <thead>
              ${isStatusReport ? `
                <tr>
                  <th>#</th>
                  <th>Date & Time</th>
                  <th>Asset #</th>
                  <th>Device Designation</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Saved Remark / Reason</th>
                  <th>Changed By</th>
                </tr>
              ` : `
                <tr>
                  <th>S.No</th>
                  <th>Asset Number</th>
                  <th>NVR Name</th>
                  <th>IP Address</th>
                  <th>Location</th>
                  <th>Specs (Disk/Chan)</th>
                  <th>Status</th>
                </tr>
              `}
            </thead>
            <tbody>
              ${isStatusReport ? (
                filteredStatusLogs.length === 0 ? '<tr><td colSpan="8" style="text-align:center;">No status change logs found.</td></tr>' :
                filteredStatusLogs.map((log, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}</td>
                    <td><b>${log.serialNumber || 'N/A'}</b></td>
                    <td>${log.nvrName || 'N/A'}</td>
                    <td>${[log.divisionName, log.block, log.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                    <td><span class="badge ${log.device_status === 'Online' ? 'status-online' : log.device_status === 'Offline' ? 'status-offline' : 'status-maint'}">${log.device_status || 'N/A'}</span></td>
                    <td><div class="remark-box">${log.remark || '—'}</div></td>
                    <td>${log.userName || 'System'}</td>
                  </tr>
                `).join('')
              ) : (
                filteredNVRs.map((nvr, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${nvr.serialNumber || 'N/A'}</td>
                    <td>${nvr.nvrName || 'N/A'}</td>
                    <td>${nvr.ipAddress || 'N/A'}</td>
                    <td>${[nvr.divisionName, nvr.block, nvr.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                    <td>${nvr.hardDisk || 'N/A'} / ${nvr.channel || 'N/A'} Ch</td>
                    <td><span class="badge ${nvr.status === 'Online' ? 'status-online' : 'status-offline'}">${nvr.status || 'N/A'}</span></td>
                  </tr>
                `).join('')
              )}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${isStatusReport ? filteredStatusLogs.length : filteredNVRs.length}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <HardDrive className="mr-3 text-emerald-500" size={28} />
            Storage Units
          </h1>
          <div className="flex bg-panel border border-main rounded-xl p-0.5 self-center">
            <button
              onClick={() => setViewMode('registry')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'registry'
                  ? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/20'
                  : 'text-slate-400 hover:text-main'
              }`}
            >
              Device List
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'report'
                  ? 'bg-purple-500 text-main shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-main'
              }`}
            >
              Report View
            </button>
          </div>
        </div>
        <div className="flex space-x-4 items-center">
          <button onClick={() => navigate('/nvr-mapping')} className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors">
            <Network size={14} className="mr-2" /> Camera Mapping
          </button>
          <button onClick={exportToExcel} className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          <button onClick={printToPDF} className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors">
            <Printer size={14} className="mr-2" /> Print PDF
          </button>
          {canEdit && (
            <>
              <label className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors cursor-pointer">
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

      {viewMode === 'registry' ? (
        <>
          {/* Stats Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-slide-up delay-100">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ring-1 ring-cyan-500/50">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL ASSETS]</h3>
              <Server size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-cyan-400">{stats.total}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: '30%' }}></div>
          </button>
 
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-green-500/30">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-green-500 tracking-widest uppercase">[ONLINE UNITS]</h3>
              <ShieldCheck size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-main">{stats.online}</span>
            </div>
          </button>
 
          <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-orange-500/30">
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-orange-500 tracking-widest uppercase">[OFFLINE UNITS]</h3>
              <ShieldAlert size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-main">{stats.offline}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" style={{ width: '30%' }}></div>
          </button>
        </div>

        <div className="bg-panel rounded-md p-4 flex items-center justify-between gap-3 w-full">
          <div className="w-20 h-20 relative flex items-center justify-center flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={38} paddingAngle={2} dataKey="value" stroke="none" label={false} labelLine={false}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-bold text-main leading-none text-center mt-1">100%<br/><span className="text-[6px] text-dim">DIST.</span></span>
            </div>
          </div>
          <div className="flex flex-col space-y-1.5 flex-1 min-w-[70px] justify-center">
            {chartData.map(d => (
              <div key={d.name} className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                <span className="text-[9px] text-secondary font-bold uppercase truncate">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Deep search by NVR name, IP, location..."
            className="bg-panel text-sm text-main border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => setShowFilterPanel(!showFilterPanel)}
          className="flex items-center px-6 py-3 rounded-md bg-panel border border-main text-sm font-bold text-secondary hover:text-main transition-colors uppercase tracking-wide shrink-0"
        >
          <Filter size={16} className="mr-2" />
          {showFilterPanel ? 'HIDE FILTERS' : 'SHOW ADVANCED FILTERS'}
        </button>
      </div>

      {showFilterPanel && (
        <div className="bg-panel border border-main rounded-md p-6 mb-6 flex flex-wrap gap-8 animate-slide-up">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Occupation Filter</label>
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL Occupation ({nvrs.length})</option>
              {uniqueColleges.map(college => {
                const count = filterCounts.college[college] || 0;
                return <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Block Filter</label>
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL BLOCKS ({nvrs.length})</option>
              {uniqueBlocks.map(block => {
                const count = filterCounts.block[block] || 0;
                return <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Floor Filter</label>
            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 min-w-[150px]"
            >
              <option value="ALL">ALL FLOORS ({nvrs.length})</option>
              {uniqueFloors.map(floor => {
                const count = filterCounts.floor[floor] || 0;
                return <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Room Filter</label>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 min-w-[180px]"
            >
              <option value="ALL">ALL ROOMS ({nvrs.length})</option>
              {uniqueRooms.map(room => {
                const count = filterCounts.room[room] || 0;
                return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
              })}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Device Status</label>
            <div className="flex gap-2">
              {['ALL', 'Online', 'Offline', 'Maintenance'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${statusFilter === s ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50' : 'bg-panel text-secondary border border-main hover:border-cyan-500/30'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">Campus Zone</label>
            <div className="flex gap-2">
              {['ALL', 'INSIDE', 'OUTSIDE'].map((z) => (
                <button
                  key={z}
                  onClick={() => setFilterType(z)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${filterType === z ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50' : 'bg-panel text-secondary border border-main hover:border-cyan-500/30'}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex justify-end items-end space-x-4">
            <button onClick={exportToExcel} className="flex items-center px-4 py-2 rounded bg-panel border border-main hover:bg-panel/85 text-secondary transition-all text-xs font-bold uppercase tracking-widest">
              <Download size={14} className="mr-2" />
              Export
            </button>
            <button onClick={() => { setStatusFilter('ALL'); setFilterType('ALL'); setSearchQuery(''); setCollegeFilter('ALL'); setBlockFilter('ALL'); setFloorFilter('ALL'); setRoomFilter('ALL'); }} className="text-xs font-bold text-secondary hover:text-cyan-400 transition-colors uppercase tracking-widest underline underline-offset-4">
              Reset Filters
            </button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="p-4 border-b border-main flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-dim uppercase tracking-widest">Rows per page</span>
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-panel border border-main rounded px-2 py-1 text-[11px] font-bold text-main outline-none focus:border-cyan-500 transition-colors"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-bold text-secondary uppercase tracking-tighter">
              {filteredNVRs.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredNVRs.length)}-${Math.min(currentPage * itemsPerPage, filteredNVRs.length)} of ${filteredNVRs.length}`}
            </span>
            <div className="flex space-x-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1 text-secondary hover:text-main disabled:opacity-30 transition-colors bg-panel rounded">
                <ChevronLeft size={14} />
              </button>
              <button disabled={currentPage >= Math.ceil(filteredNVRs.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-secondary hover:text-main disabled:opacity-30 transition-colors bg-panel rounded">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-panel border-b border-main">
              <tr className="text-secondary">
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center w-12">S.No</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Device Asset Number</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Device Info</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Location</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Specs</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main">
              {filteredNVRs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((nvr, index) => (
                <tr 
                  key={nvr._id || nvr.id} 
                  className="hover:bg-slate-700/30 transition-colors group cursor-pointer text-main"
                  onClick={() => navigate(`/devices/nvr/${nvr._id || nvr.id}`)}
                >
                  <td className="px-5 py-4 text-[11px] font-bold text-secondary text-center">{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-mono text-cyan-400 font-bold">{nvr.serialNumber || '—'}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
                        <Server size={16} className="text-yellow-500" />
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-main">{nvr.nvrName}</div>
                        <div className="text-[11px] text-dim mt-0.5 font-mono">IP: <span className="text-cyan-400">{nvr.ipAddress || '—'}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2 text-[11px] text-main font-bold">
                        <Building size={12} className="text-cyan-500" />
                        <span>{nvr.block || '—'}</span>
                      </div>
                      <div className="text-[9px] text-dim font-bold uppercase tracking-wider pl-5">
                        {nvr.divisionName || '—'}
                      </div>
                      <div className="text-[9px] text-dim font-bold pl-5">
                        {nvr.brand || '—'} {nvr.model ? `(${nvr.model})` : ''}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider pl-5 mt-0.5 ${nvr.campusZone === 'OUTSIDE' ? 'text-orange-500' : 'text-green-500'}`}>
                        [{nvr.campusZone || 'INSIDE'}]
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col space-y-1.5">
                      <div className="flex items-center space-x-2 text-[11px] text-main font-bold">
                        <HardDrive size={12} className="text-cyan-400" />
                        <span>{calculateTotalStorage(nvr.hardDisk)}</span>
                      </div>
                      <div className="text-[9px] text-dim font-bold uppercase tracking-widest pl-5">
                        {nvr.hardDisk || 'No Storage'}
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-dim font-bold mt-1">
                        <Cpu size={12} className="text-dim" />
                        <span>{nvr.channel ? `${nvr.channel} Channels` : '—'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        nvr.status === 'Online' ? 'text-green-500 border-green-500/50 bg-green-500/10' : 
                        nvr.status === 'Offline' ? 'text-red-500 border-red-500/50 bg-red-500/10' :
                        'text-amber-500 border-amber-500/50 bg-amber-500/10'}`}>
                        {nvr.status}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openStatusModal(nvr); }}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded transition-all flex items-center shadow-sm"
                        >
                          <RefreshCw size={10} className="mr-1" />
                          Status Change
                        </button>
                      )}
                    </div>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); openStatusModal(nvr); }} title="Status Change & Remark" className="text-secondary hover:text-cyan-400 transition-colors p-1 bg-cyan-500/10 rounded">
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/devices/nvr/${nvr._id || nvr.id}`) }} title="View Details" className="text-secondary hover:text-cyan-400 transition-colors">
                          <Info size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); editNVR(nvr) }} title="Edit Asset" className="text-secondary hover:text-cyan-400 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteNVR(nvr._id || nvr.id) }} title="Delete Asset" className="text-secondary hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredNVRs.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-5 py-8 text-center text-dim">
                    <Server size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-[12px] font-bold">No NVRs found matching this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        /* NVR Status & Remarks History Log Report View */
        <div className="space-y-6 animate-fade-in">
          {/* Remarks Table & Audit Log */}
          <div className="glass-panel overflow-hidden bg-panel border border-main rounded-2xl shadow-2xl">
            <div className="p-6 border-b border-main flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40">
              <div className="flex items-center space-x-3">
                {reportTab === 'modified_only' ? (
                  <MessageSquare className="text-cyan-400" size={20} />
                ) : (
                  <Server className="text-purple-400" size={20} />
                )}
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-main">
                    {reportTab === 'modified_only' 
                      ? 'NVR Status Changes & Saved Remarks Audit Report (Changed & Saved Only)' 
                      : 'All Registered NVR Storage Units Summary Report'}
                  </h3>
                  <p className="text-[10px] text-dim">
                    {reportTab === 'modified_only'
                      ? 'Showing records where status was changed and remarks saved'
                      : 'Complete list of all registered storage devices'}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button onClick={exportToExcel} className="flex items-center px-4 py-2 bg-panel border border-main text-secondary rounded-xl text-xs font-bold uppercase tracking-wider hover:text-main transition-all">
                  <Download size={14} className="mr-2" /> Export CSV
                </button>
                <button onClick={printToPDF} className="flex items-center px-4 py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-purple-500/30 transition-all">
                  <Printer size={14} className="mr-2" /> Print PDF Report
                </button>
              </div>
            </div>

            {reportTab === 'modified_only' && (
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-card/60 border-b border-main">
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest mr-2">Filter Log By Status:</span>
                  {['ALL', 'Online', 'Offline', 'Maintenance', 'Scrap'].map((st) => {
                    const count = st === 'ALL'
                      ? statusChangeLogs.length
                      : statusChangeLogs.filter(l => (l.device_status || 'Online').toUpperCase() === st.toUpperCase()).length;
                    const isActive = statusFilter.toUpperCase() === st.toUpperCase();
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                          isActive
                            ? st.toUpperCase() === 'ONLINE' ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-sm' :
                              st.toUpperCase() === 'OFFLINE' ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-sm' :
                              st.toUpperCase() === 'MAINTENANCE' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-sm' :
                              'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-sm'
                            : 'bg-panel text-secondary border border-main hover:border-cyan-500/30'
                        }`}
                      >
                        {st} ({count})
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] font-bold text-cyan-400">
                  Showing {filteredStatusLogs.length} of {statusChangeLogs.length} Status Logs
                </div>
              </div>
            )}

            {reportTab === 'modified_only' ? (
              /* Modified & Saved Remarks Only Table */
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-card border-b border-main text-[10px] font-bold text-dim uppercase tracking-widest">
                      <th className="p-4 text-center">#</th>
                      <th className="p-4">Date & Time</th>
                      <th className="p-4">Asset Number</th>
                      <th className="p-4">Device Designation</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Location</th>
                      <th className="p-4 text-center">Status Changed To</th>
                      <th className="p-4">Saved Remark / Reason</th>
                      <th className="p-4">Changed By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-main text-xs font-medium">
                    {filteredStatusLogs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-12 text-center text-dim">
                          <AlertCircle size={32} className="mx-auto mb-3 opacity-40 text-cyan-400" />
                          <p className="text-sm font-bold text-main">No status changes or remarks recorded yet.</p>
                          <p className="text-xs text-dim mt-1">Use the "Status Change" button on any device row in the Device List tab to modify status and save remarks.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStatusLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-700/20 transition-colors">
                          <td className="p-4 text-center font-mono text-[10px] text-dim">{idx + 1}</td>
                          <td className="p-4 font-mono text-[11px] text-dim">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : (log.date || '—')}
                          </td>
                          <td className="p-4 font-mono text-xs text-cyan-400 font-bold">{log.serialNumber || '—'}</td>
                          <td className="p-4 font-bold text-main">{log.nvrName || '—'}</td>
                          <td className="p-4 font-mono text-cyan-300">{log.ipAddress || '—'}</td>
                          <td className="p-4 text-slate-300">
                            <div className="font-bold">{log.divisionName || '—'}</div>
                            <div className="text-[10px] text-dim">{[log.block, log.floor, log.room].filter(Boolean).join(' / ')}</div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              (log.device_status || '').toUpperCase() === 'ONLINE' ? 'text-green-400 border-green-500/50 bg-green-500/10' :
                              (log.device_status || '').toUpperCase() === 'OFFLINE' ? 'text-red-400 border-red-500/50 bg-red-500/10' :
                              (log.device_status || '').toUpperCase() === 'MAINTENANCE' ? 'text-amber-400 border-amber-500/50 bg-amber-500/10' :
                              'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'
                            }`}>
                              {log.device_status || 'Online'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="p-2.5 bg-slate-900/60 border border-main rounded-lg text-slate-200 text-xs shadow-inner">
                              <span className="text-cyan-400 font-mono text-[10px] block mb-0.5 font-bold">[REMARK SAVED]</span>
                              {log.remark}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-bold text-secondary">{log.userName || 'System Admin'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* All Units Registry Table */
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-card border-b border-main text-[10px] font-bold text-dim uppercase tracking-widest">
                      <th className="p-4 text-center">#</th>
                      <th className="p-4">NVR Designation</th>
                      <th className="p-4">Asset Number</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Specs (Disk / Channels)</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-main text-xs font-medium">
                    {filteredNVRs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-dim">
                          No NVR records found.
                        </td>
                      </tr>
                    ) : (
                      filteredNVRs.map((nvr, idx) => (
                        <tr key={nvr.id || nvr._id || idx} className="hover:bg-slate-700/20 transition-colors">
                          <td className="p-4 text-center font-mono text-[10px] text-dim">{idx + 1}</td>
                          <td className="p-4 font-bold text-main">{nvr.nvrName || '—'}</td>
                          <td className="p-4 font-mono text-xs text-amber-400">{nvr.serialNumber || '—'}</td>
                          <td className="p-4 font-mono text-cyan-400">{nvr.ipAddress || '—'}</td>
                          <td className="p-4 text-slate-300">
                            <div>{nvr.divisionName || '—'}</div>
                            <div className="text-[10px] text-dim">{[nvr.block, nvr.floor, nvr.room].filter(Boolean).join(' / ')}</div>
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {nvr.hardDisk || '—'} / {nvr.channel || '—'} Ch
                          </td>
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              nvr.status === 'Online' ? 'text-green-400 border-green-500/50 bg-green-500/10' :
                              'text-red-400 border-red-500/50 bg-red-500/10'
                            }`}>
                              {nvr.status || 'Online'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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

      {/* STATUS CHANGE & REMARK MODAL */}
      {statusModalNvr && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-card rounded-[2rem] w-full max-w-lg overflow-hidden border border-main shadow-2xl relative my-8">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/30">
                  <RefreshCw className="text-cyan-400" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-main uppercase tracking-tight">
                    Update NVR Status & Remark
                  </h2>
                  <p className="text-[11px] text-dim font-mono">
                    {statusModalNvr.nvrName} ({statusModalNvr.serialNumber || 'No Asset #'})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setStatusModalNvr(null)}
                className="p-2 hover:bg-panel rounded-xl text-secondary hover:text-main transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveStatusChange} className="p-6 space-y-6">
              {/* Target Device Summary */}
              <div className="p-4 bg-panel border border-main rounded-xl flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-main">{statusModalNvr.nvrName}</div>
                  <div className="text-[11px] text-dim font-mono">IP: {statusModalNvr.ipAddress || '—'} | Loc: {[statusModalNvr.divisionName, statusModalNvr.block].filter(Boolean).join(' / ')}</div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                  statusModalNvr.status === 'Online' ? 'text-green-400 border-green-500/50 bg-green-500/10' :
                  statusModalNvr.status === 'Offline' ? 'text-red-400 border-red-500/50 bg-red-500/10' :
                  'text-amber-400 border-amber-500/50 bg-amber-500/10'
                }`}>
                  Current: {statusModalNvr.status || 'Online'}
                </span>
              </div>

              {/* Status Select */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                  Select New Status *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFormData({ ...statusFormData, status: s })}
                      className={`py-2.5 px-2 text-[10px] font-black uppercase rounded-xl border transition-all ${
                        statusFormData.status === s
                          ? s === 'Online' ? 'bg-green-500/20 border-green-500/60 text-green-400 shadow-md' :
                            s === 'Offline' ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-md' :
                            s === 'Maintenance' ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-md' :
                            'bg-slate-500/20 border-slate-500/60 text-slate-300 shadow-md'
                          : 'border-main text-secondary hover:text-main hover:bg-white/5'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Remark Chips */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                  Quick Reason Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Power Failure / Outage",
                    "Network Switch Fault",
                    "HDD Capacity Full",
                    "Scheduled Maintenance",
                    "Hardware Replacement",
                    "Device Relocated",
                    "Firmware Upgrade"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStatusFormData({ ...statusFormData, remark: preset })}
                      className="px-2.5 py-1 bg-panel border border-main hover:border-cyan-500/40 text-secondary hover:text-cyan-400 text-[10px] font-bold rounded-lg transition-all"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandatory Remark Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">
                  Remark / Reason for Change *
                </label>
                <textarea
                  required
                  rows={3}
                  value={statusFormData.remark}
                  onChange={(e) => setStatusFormData({ ...statusFormData, remark: e.target.value })}
                  placeholder="Enter specific remark or reason for changing status (e.g., Power supply issue fixed, scheduled restart...)"
                  className="glass-input w-full p-3.5 text-xs bg-panel border-main rounded-xl shadow-inner outline-none focus:ring-1 focus:ring-cyan-500 text-main"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-main">
                <button
                  type="button"
                  onClick={() => setStatusModalNvr(null)}
                  className="px-5 py-2.5 text-xs font-bold text-secondary hover:text-main uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="px-6 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-slate-900 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-400/20 transition-all disabled:opacity-50 flex items-center font-bold"
                >
                  {statusSubmitting ? 'Saving Status...' : 'Save Status & Remark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
