// Structure verified: all JSX blocks are properly balanced.
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Search, Filter, Plus, Cctv as CctvIcon, Map, Building, Shield, X, Edit2, Trash2, Download, Upload, ChevronLeft, ChevronRight, Server, Save, RefreshCw, Printer, Video } from 'lucide-react';
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
  const { currentSite, fetchSite, allLocations, fetchAllLocations, ensureLocationExists, divisions, fetchDivisions, brands, fetchBrands } = useSiteStore();
  useActivityLogger('Assets');
  const [submitting, setSubmitting] = useState(false);
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Assets:EDIT');

  const parseLocation = (camera) => {
    if (!camera) return { college: '—', block: '—', floor: '—', room: '—' };

    let college = camera.divisionName || '';
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
    if (!camera) return { ipv4Gateway: '', subnetMask: '', macAddress: '', portNumber: '', divisionName: '' };

    return {
      ipv4Gateway: camera.gateway || '',
      subnetMask: camera.subnetMask || '',
      macAddress: camera.macAddress || '',
      portNumber: camera.portNumber || '',
      divisionName: loc.college !== '—' ? loc.college : (camera.divisionName || '')
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
  const [nvrSearchQuery, setNvrSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    block: '',
    floor: '',
    room: '',
    deviceType: '',
    ipAddress: '',
    ipv4Gateway: '',
    portNumber: '',
    deviceSerialNumber: '', // This is the auto-generated ID (cameraId)
    serialNumber: '', // This is the actual hardware manufacturer serial
    subnetMask: '',
    macAddress: '',
    status: 'Online',
    campusZone: 'INSIDE',
    divisionName: '',
    brand: '',
    model: '',
    dvrNvrDetails: '',
    remarks: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Quick Edit Modal State
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [quickEditTab, setQuickEditTab] = useState('status');
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [quickEditCamera, setQuickEditCamera] = useState(null);
  const [quickFormData, setQuickFormData] = useState({
    name: '', block: '', floor: '', room: '', divisionName: '',
    brand: '', ipAddress: '', ipv4Gateway: '', subnetMask: '', portNumber: '',
    macAddress: '', campusZone: 'INSIDE'
  });
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
    cameras.forEach(c => {
      const loc = parseLocation(c);
      const college = String(loc.college).toUpperCase();
      const block = String(loc.block).toUpperCase();
      const floor = String(loc.floor).toUpperCase();
      const room = String(loc.room).toUpperCase();
      
      counts.college[college] = (counts.college[college] || 0) + 1;
      counts.block[block] = (counts.block[block] || 0) + 1;
      counts.floor[floor] = (counts.floor[floor] || 0) + 1;
      counts.room[room] = (counts.room[room] || 0) + 1;
    });
    return counts;
  }, [cameras]);

  useEffect(() => {
    fetchCameras();
    fetchNvrs();
    fetchSite();
    fetchAllLocations();
    fetchDivisions();
    fetchBrands();

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
      const type = formData.deviceType || 'Bullet';
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
  }, [showModal, editingId, cameras, formData.deviceType]);

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

  useEffect(() => {
    if (showModal && !editingId) {
      localStorage.setItem('cctv_draft_camera', JSON.stringify(formData));
    }
  }, [formData, showModal, editingId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['email', 'password', 'username', 'deviceType'].includes(name)) {
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

      // Auto-update Serial Number format when Camera Type changes (only for new assets)
      if (name === 'deviceType' && !editingId) {
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
      if (['divisionName', 'block', 'floor', 'room'].includes(name)) {
        const matchingLoc = allLocations.find(loc =>
          (loc.divisionName || '') === (name === 'divisionName' ? newValue : (prev.divisionName || '')) &&
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
    if (submitting) return;
    setSubmitting(true);
    const payload = {
      name: formData.name || formData.deviceType || 'Unknown Device',
      siteName: formData.room || formData.block || 'Unknown',
      ipAddress: formData.ipAddress || '',
      gateway: formData.ipv4Gateway || '',
      subnetMask: formData.subnetMask || '',
      macAddress: formData.macAddress || '',
      portNumber: formData.portNumber || '',
      divisionName: formData.divisionName || '',
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

    // Auto-generate Asset Number if left blank
    let finalCameraId = formData.deviceSerialNumber?.trim();
    if (!finalCameraId) {
      const type = formData.deviceType || 'Bullet';
      const prefix = type === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
      const existingNumbers = cameras
        .filter(c => String(c.cameraId || '').startsWith(prefix))
        .map(c => parseInt(String(c.cameraId || '').split('/').pop()) || 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      finalCameraId = `${prefix}${nextNumber.toString().padStart(2, '0')}`;
    }
    payload.cameraId = finalCameraId;

    try {
      if (editingId) {
        await api.put(`/cameras/${editingId}/`, payload);
        showNotification('Camera configuration updated');
      } else {
        await api.post('/cameras/', payload);
        showNotification('New asset registered successfully');
        try {
          localStorage.setItem('cctv_last_camera', JSON.stringify({
            name: formData.name,
            block: formData.block,
            floor: formData.floor,
            room: formData.room,
            deviceType: formData.deviceType,
            ipAddress: formData.ipAddress,
            ipv4Gateway: formData.ipv4Gateway,
            portNumber: formData.portNumber,
            subnetMask: formData.subnetMask,
            divisionName: formData.divisionName,
            brand: formData.brand,
            model: formData.model,
            dvrNvrDetails: formData.dvrNvrDetails,
            remarks: formData.remarks,
            campusZone: formData.campusZone
          }));
          localStorage.removeItem('cctv_draft_camera');
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
        name: '', block: '', floor: '', room: '', deviceType: '', ipAddress: '',
        ipv4Gateway: '', portNumber: '', deviceSerialNumber: '', serialNumber: '', subnetMask: '', macAddress: '', status: 'Online',
        divisionName: '', brand: '', model: '', dvrNvrDetails: '', remarks: ''
      });
      fetchCameras();
    } catch (err) {
      console.error("Camera save error:", err);
      let errorMsg = 'Error saving camera detail.';
      if (err.response) {
        if (err.response.status >= 500) {
          errorMsg = `Server Error (${err.response.status}). Please check backend logs.`;
        } else if (err.response.data) {
          if (typeof err.response.data === 'object') {
            errorMsg = Object.entries(err.response.data).map(([k, v]) => {
              const cleanKey = k.replace(/cameraId/gi, 'Device ID').toUpperCase();
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

  const editCamera = (camera) => {
    const loc = parseLocation(camera);
    const { ipv4Gateway, subnetMask, macAddress, portNumber, divisionName } = parseNetworkDetails(camera);

    setFormData({
      block: loc.block !== '—' ? loc.block : '',
      floor: loc.floor !== '—' ? loc.floor : '',
      name: camera.name || '',
      deviceType: camera.deviceType || 'Bullet',
      ipAddress: camera.ipAddress || '',
      ipv4Gateway,
      portNumber,
      deviceSerialNumber: camera.cameraId || '',
      serialNumber: camera.serialNumber || '',
      room: camera.room || '',
      subnetMask,
      macAddress,
      status: camera.status || 'Online',
      campusZone: camera.campusZone || (isOutside(camera.siteName) ? 'OUTSIDE' : 'INSIDE'),
      divisionName: divisionName || '',
      brand: camera.brand || '',
      model: camera.model || '',
      dvrNvrDetails: camera.dvrNvrDetails || '',
      remarks: camera.remarks || ''
    });
    setEditingId(camera._id || camera.id);
    setShowModal(true);
  };

  const openQuickEditModal = (camera) => {
    setQuickEditCamera(camera);
    const loc = parseLocation(camera);
    const net = parseNetworkDetails(camera);
    setQuickFormData({
      name: camera.name || '',
      cameraId: camera.cameraId || '',
      block: loc.block !== '—' ? loc.block : '',
      floor: loc.floor !== '—' ? loc.floor : '',
      room: loc.room !== '—' ? loc.room : '',
      divisionName: net.divisionName || '',
      brand: camera.brand || '',
      ipAddress: camera.ipAddress || '',
      ipv4Gateway: net.ipv4Gateway || '',
      subnetMask: net.subnetMask || '',
      macAddress: net.macAddress || '',
      portNumber: net.portNumber || '',
      campusZone: camera.campusZone || 'INSIDE',
      deviceType: camera.deviceType || 'Bullet',
      dvrNvrDetails: camera.dvrNvrDetails || ''
    });
    setQuickEditTab('status');
    setConfirmStatus(null);
    setShowQuickEditModal(true);
  };

  const handleStatusChange = async (newStatus) => {
    if (!quickEditCamera) return;
    try {
      setUpdatingStatus(true);
      await api.patch(`/cameras/${quickEditCamera._id || quickEditCamera.id}/`, { status: newStatus });
      showNotification(`Asset status changed to ${newStatus}`);
      setConfirmStatus(null);
      setShowQuickEditModal(false);
      fetchCameras();
    } catch (err) {
      console.error(err);
      showNotification('Failed to update asset status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveRelocation = async () => {
    if (!quickEditCamera) return;
    try {
      setIsSaving(true);
      const oldLoc = parseLocation(quickEditCamera);
      const oldBlock = oldLoc.block;
      const oldFloor = oldLoc.floor;
      const oldIp = quickEditCamera.ipAddress;

      const payload = {
        name: quickFormData.name,
        cameraId: quickFormData.cameraId,
        siteName: `${quickFormData.block} - ${quickFormData.floor}${quickFormData.room ? ` - ${quickFormData.room}` : ''}`,
        ipAddress: quickFormData.ipAddress,
        dvrNvrDetails: quickFormData.dvrNvrDetails,
        deviceType: quickFormData.deviceType,
        gateway: quickFormData.ipv4Gateway,
        subnetMask: quickFormData.subnetMask,
        macAddress: quickFormData.macAddress,
        portNumber: quickFormData.portNumber,
        block: quickFormData.block,
        floor: quickFormData.floor,
        room: quickFormData.room,
        divisionName: quickFormData.divisionName,
        brand: quickFormData.brand,
        campusZone: quickFormData.campusZone
      };

      await api.patch(`/cameras/${quickEditCamera._id || quickEditCamera.id}/`, payload);

      let moveLog = `Asset Relocated/Updated. `;
      if (oldBlock !== quickFormData.block || oldFloor !== quickFormData.floor) {
        moveLog += `Moved from ${oldBlock}/${oldFloor} to ${quickFormData.block}/${quickFormData.floor}. `;
      }
      if (oldIp !== quickFormData.ipAddress) {
        moveLog += `IP changed from ${oldIp} to ${quickFormData.ipAddress}. `;
      }

      await api.post(`/cameras/${quickEditCamera._id || quickEditCamera.id}/add_relocation/`, {
        old_location: `${oldBlock} - ${oldFloor}${oldLoc.room && oldLoc.room !== '—' ? ` - ${oldLoc.room}` : ''}`,
        new_location: `${quickFormData.block} - ${quickFormData.floor}${quickFormData.room ? ` - ${quickFormData.room}` : ''}`,
        old_ip: oldIp,
        new_ip: quickFormData.ipAddress,
        remark: moveLog
      });

      showNotification('Asset successfully relocated and logs updated');
      setShowQuickEditModal(false);
      fetchCameras();
    } catch (err) {
      console.error(err);
      showNotification('Failed to relocate asset', 'error');
    } finally {
      setIsSaving(false);
    }
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
    const college = currentSite?.divisionName || '';
    const block = currentSite?.block || '';
    const floor = currentSite?.floor || '';
    const room = currentSite?.room || '';

    setFormData({
      name: '',
      block: block,
      floor: floor,
      room: room,
      deviceType: 'Bullet',
      ipAddress: '',
      ipv4Gateway: '',
      portNumber: '',
      deviceSerialNumber: '',
      subnetMask: '',
      macAddress: '',
      status: 'Online',
      campusZone: 'INSIDE',
      divisionName: college,
      brand: '',
      dvrNvrDetails: '',
      remarks: ''
    });
    setShowModal(true);
  };

  const generateSerialNumber = () => {
    const type = formData.deviceType;
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
      const res = await api.post('/cameras/upload_excel/', formData);
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
      'S.No', 'Division Name', 'Block', 'Floor', 'Room', 'Campus Zone',
      'Device Type', 'Model', 'IP Address', 'IPv4 Gateway', 'Port Number',
      'Device ID', 'Hardware Serial', 'Subnet Mask', 'MAC Address', 'Status', 'Date Added'
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
      const { ipv4Gateway, subnetMask, macAddress, portNumber } = parseNetworkDetails(camera);
      const zone = camera.campusZone || (isOutside(camera.siteName) ? 'OUTSIDE' : 'INSIDE');

      return [
        idx + 1,
        escapeCSV(loc.college),
        escapeCSV(loc.block),
        escapeCSV(loc.floor),
        escapeCSV(loc.room),
        escapeCSV(zone),
        escapeCSV(camera.name || 'N/A'),
        escapeCSV(camera.model || 'N/A'),
        escapeCSV(camera.ipAddress || ''),
        escapeCSV(ipv4Gateway || ''),
        escapeCSV(portNumber || ''),
        escapeCSV(camera.cameraId || ''),
        escapeCSV(camera.serialNumber || ''),
        escapeCSV(subnetMask || ''),
        escapeCSV(macAddress || ''),
        escapeCSV(camera.status || ''),
        escapeCSV(camera.createdAt?.split('T')[0] || '')
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

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Camera Inventory Export</title>
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
          <h1>Camera Inventory Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Device ID</th>
                <th>Hardware Serial</th>
                <th>Name</th>
                <th>Type</th>
                <th>IP Address</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCameras.map((camera, idx) => {
                const loc = parseLocation(camera);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${camera.cameraId || 'N/A'}</td>
                  <td>${camera.serialNumber || 'N/A'}</td>
                  <td>${camera.name || 'N/A'}</td>
                  <td>${camera.deviceType || 'N/A'}</td>
                  <td>${camera.ipAddress || 'N/A'}</td>
                  <td>${[loc.college, loc.block, loc.room].filter(Boolean).join(' / ') || 'N/A'}</td>
                  <td><span class="badge ${camera.status === 'Online' ? 'status-online' : 'status-offline'}">${camera.status || 'N/A'}</span></td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${filteredCameras.length}
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

  const isOutside = (site, zone) => {
    if (zone) return zone === 'OUTSIDE';
    if (!site) return false;
    const s = site.toLowerCase();
    return s.includes('gate') || s.includes('outside') || s.includes('perimeter') || s.includes('road') || s.includes('external') || s.includes('parking') || s.includes('boundary');
  };

  const baseFilteredCameras = useMemo(() => {
    let filtered = cameras;

    if (collegeFilter !== 'ALL') {
      filtered = filtered.filter(c => (parseLocation(c).college || '').toUpperCase() === collegeFilter.toUpperCase());
    }
    if (blockFilter !== 'ALL') {
      filtered = filtered.filter(c => (parseLocation(c).block || '').toUpperCase() === blockFilter.toUpperCase());
    }
    if (floorFilter !== 'ALL') {
      filtered = filtered.filter(c => (parseLocation(c).floor || '').toUpperCase() === floorFilter.toUpperCase());
    }
    if (roomFilter !== 'ALL') {
      filtered = filtered.filter(c => (parseLocation(c).room || '').toUpperCase() === roomFilter.toUpperCase());
    }
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const { divisionName } = parseNetworkDetails(c);
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.cameraId || '').toLowerCase().includes(q) ||
          (c.siteName || '').toLowerCase().includes(q) ||
          (c.ipAddress || '').toLowerCase().includes(q) ||
          (c.dvrNvrDetails || '').toLowerCase().includes(q) ||
          (divisionName || '').toLowerCase().includes(q)
        );
      });
    }
    return filtered;
  }, [cameras, collegeFilter, blockFilter, floorFilter, roomFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const inside = baseFilteredCameras.filter(c => !isOutside(c.siteName || c.site, c.campusZone)).length;
    const outside = baseFilteredCameras.filter(c => isOutside(c.siteName || c.site, c.campusZone)).length;
    const locations = new Set(baseFilteredCameras.map(c => c.siteName)).size;
    return { total: baseFilteredCameras.length, inside, outside, locations };
  }, [baseFilteredCameras]);

  const filteredCameras = useMemo(() => {
    let filtered = baseFilteredCameras;
    if (filterType === 'INSIDE') filtered = filtered.filter(c => !isOutside(c.siteName || c.site, c.campusZone));
    if (filterType === 'OUTSIDE') filtered = filtered.filter(c => isOutside(c.siteName || c.site, c.campusZone));
    return filtered;
  }, [baseFilteredCameras, filterType]);

  const pieData = [
    { name: 'Inside Campus', value: stats.inside },
    { name: 'Outside Campus', value: stats.outside },
  ];
  const COLORS = ['#3b82f6', '#f59e0b'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Video className="mr-3 text-blue-500" size={28} />
            Cameras
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
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
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
              <button onClick={openNewModal} className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2">
                <Plus size={16} className="mr-2" />
                Register Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* View Switcher Tabs & Quick Building Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
      </div>

      {/* Top Stats & Chart Row (Visible for all views) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-slide-up delay-100">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => { setActiveView('LIST'); setFilterType('ALL'); }} className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ${activeView === 'LIST' && filterType === 'ALL' ? 'ring-1 ring-cyan-500/50' : 'hover:ring-1 hover:ring-cyan-500/30'}`}>
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL ASSETS]</h3>
              <Video size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-cyan-400">{stats.total}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: '30%' }}></div>
          </button>
 
          <button onClick={() => setFilterType('INSIDE')} className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ${filterType === 'INSIDE' ? 'ring-1 ring-yellow-500/50' : 'hover:ring-1 hover:ring-yellow-500/30'}`}>
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-yellow-500 tracking-widest uppercase">[INSIDE CAMPUS]</h3>
              <Building size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-main">{stats.inside}</span>
            </div>
          </button>
 
          <button onClick={() => setFilterType('OUTSIDE')} className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ${filterType === 'OUTSIDE' ? 'ring-1 ring-orange-500/50' : 'hover:ring-1 hover:ring-orange-500/30'}`}>
            <div className="flex justify-between items-start w-full">
              <h3 className="text-[11px] font-bold text-orange-500 tracking-widest uppercase">[OUTSIDE CAMPUS]</h3>
              <Map size={18} className="text-dim" />
            </div>
            <div className="flex items-end mt-4">
              <span className="text-4xl font-bold text-main">{stats.outside}</span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" style={{ width: '30%' }}></div>
          </button>
        </div>

        <div className="bg-panel rounded-md p-4 flex items-center justify-between gap-3 w-full">
          <div className="w-20 h-20 relative flex items-center justify-center flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={38} paddingAngle={2} dataKey="value" stroke="none" label={false} labelLine={false}>
                  <Cell key="cell-0" fill="#475569" />
                  <Cell key="cell-1" fill="#22d3ee" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-bold text-main leading-none text-center mt-1">100%<br/><span className="text-[6px] text-dim">DIST.</span></span>
            </div>
          </div>
          <div className="flex flex-col space-y-1.5 flex-1 min-w-[70px] justify-center">
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-600 flex-shrink-0"></div>
              <span className="text-[9px] text-secondary font-bold uppercase truncate">Inside</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0"></div>
              <span className="text-[9px] text-secondary font-bold uppercase truncate">Outside</span>
            </div>
          </div>
        </div>
      </div>

      {activeView === 'LIST' && (
        <div className="space-y-6">

          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Deep search by camera name, asset number, location, IP..."
                className="bg-panel text-sm text-main border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center px-6 py-3 rounded-md bg-panel border border-main text-sm font-bold text-secondary hover:text-main transition-colors uppercase tracking-wide"
            >
              <Filter size={16} className="mr-2" />
              {showFilterPanel ? 'HIDE FILTERS' : 'SHOW ADVANCED FILTERS'}
            </button>
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
                    <option value="ALL">ALL Occupation ({cameras.length})</option>
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
                    <option value="ALL">ALL BLOCKS ({cameras.length})</option>
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
                    <option value="ALL">ALL FLOORS ({cameras.length})</option>
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
                    <option value="ALL">ALL ROOMS ({cameras.length})</option>
                    {uniqueRooms.map(room => {
                      const count = filterCounts.room[room] || 0;
                      return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                    })}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest">Device Status</label>
                  <div className="flex gap-2">
                    {['ALL', 'Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
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

            <div className="bg-panel rounded-md overflow-hidden border border-main mt-4">
            <div className="p-4 flex justify-between items-center border-b border-main">
              <div className="flex items-center space-x-2">
                <Video size={16} className="text-cyan-400" />
                <span className="text-[12px] font-bold text-main uppercase tracking-wider">Device Inventory <span className="text-dim font-normal">({filteredCameras.length} Assets)</span></span>
              </div>
 
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 mr-2">
                  <span className="text-[10px] font-bold text-dim uppercase tracking-widest">Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-panel border border-main text-main text-[10px] font-bold rounded px-2 py-0.5 outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2 text-[10px] font-bold text-secondary uppercase tracking-widest">
                  <span>{Math.min((currentPage - 1) * itemsPerPage + 1, filteredCameras.length)}-{Math.min(currentPage * itemsPerPage, filteredCameras.length)} OF {filteredCameras.length}</span>
                  <div className="flex items-center ml-2 space-x-1">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1 hover:text-main disabled:opacity-30"><ChevronLeft size={14}/></button>
                    <button disabled={currentPage >= Math.ceil(filteredCameras.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 hover:text-main disabled:opacity-30"><ChevronRight size={14}/></button>
                  </div>
                </div>
              </div>
            </div>
 
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-panel border-b border-main">
                  <tr className="text-secondary">
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider w-16">S.No</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Device Identity</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Location & Brand</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Specifications</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider">Network Logic</th>
                    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
                    {canEdit && <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-main">
                  {filteredCameras.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((camera, index) => {
                    const loc = parseLocation(camera);
                    const isExt = isOutside(camera.siteName, camera.campusZone);
                    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr key={camera._id || camera.id} onClick={() => navigate(`/devices/cameras/${camera._id || camera.id}`)} className="hover:bg-slate-700/30 cursor-pointer transition-colors group text-main">
                        <td className="p-4 text-[10px] font-bold text-secondary">
                          {serialNumber}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-[11px] font-bold text-cyan-400 tracking-wider">{camera.cameraId || '—'}</span>
                            <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Asset ID</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-main uppercase tracking-wider">
                              <Building size={12} className="text-cyan-400" />
                              <span>{loc.block || '—'}</span>
                            </div>
                            <div className="text-[9px] text-dim font-bold uppercase tracking-wider pl-4">
                              {loc.college || '—'} {loc.floor && loc.floor !== '—' ? `| Floor ${loc.floor}` : ''} {loc.room && loc.room !== '—' ? `| ${loc.room}` : ''}
                            </div>
                            <div className={`text-[8px] font-bold uppercase tracking-wider pl-4 ${isExt ? 'text-cyan-400' : 'text-dim'}`}>
                              [{camera.campusZone || (isExt ? 'OUTSIDE' : 'INSIDE')}]
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col space-y-1">
                            <span className="text-[11px] font-bold text-main uppercase tracking-wider">{camera.name || '—'}</span>
                            {camera.dvrNvrDetails && (
                              <div className="flex flex-wrap gap-1 mt-1 max-w-[150px]">
                                {String(camera.dvrNvrDetails).split(',').filter(Boolean).map((nvr, idx) => {
                                  const nvrRaw = nvr.trim();
                                  const actualNvr = nvrs.find(n => n.nvrName === nvrRaw || String(n.sNo) === nvrRaw || String(n._id) === nvrRaw || String(n.id) === nvrRaw || String(n.serialNumber) === nvrRaw);
                                  const nvrName = actualNvr ? actualNvr.nvrName : nvrRaw;
                                  const displayText = nvrName.toUpperCase().startsWith('NVR') ? nvrName : `NVR - ${nvrName}`;
                                  return (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-panel border border-main rounded text-[8px] font-bold text-secondary uppercase tracking-wider w-fit">
                                      {displayText}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="text-[11px] font-bold text-main">{camera.ipAddress || '—'}</span>
                            <div className="flex flex-col space-y-0.5 mt-1">
                              <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest">MFR SN:</span>
                              <span className="text-[9px] text-secondary tracking-wider">{camera.serialNumber || '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                            camera.status === 'Online' ? 'text-green-500 border-green-500/50' :
                            camera.status === 'Offline' ? 'text-red-500 border-red-500/50' :
                            camera.status === 'Maintenance' ? 'text-amber-500 border-amber-500/50' :
                            camera.status === 'Scrap' ? 'text-red-500 border-red-500/50' :
                            'text-amber-500 border-amber-500/50'
                          }`}>
                            {camera.status}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); openQuickEditModal(camera); }} className="p-1.5 text-dim hover:text-blue-400 rounded-lg">
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
                      <td colSpan="12" className="p-12 text-center text-dim">
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
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Division</label>
              <select
                value={collegeFilter}
                onChange={(e) => setCollegeFilter(e.target.value)}
                className="glass-input w-full p-2.5 text-xs font-bold"
              >
                <option value="ALL">ALL COLLEGES ({cameras.length})</option>
                {uniqueColleges.map(college => {
                  const count = filterCounts.college[college] || 0;
                  return <option key={college} value={college}>{college?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Block</label>
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="glass-input w-full p-2.5 text-xs font-bold"
              >
                <option value="ALL">ALL BLOCKS ({cameras.length})</option>
                {uniqueBlocks.map(block => {
                  const count = filterCounts.block[block] || 0;
                  return <option key={block} value={block}>{block?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Floor</label>
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="glass-input w-full p-2.5 text-xs font-bold"
              >
                <option value="ALL">ALL FLOORS ({cameras.length})</option>
                {uniqueFloors.map(floor => {
                  const count = filterCounts.floor[floor] || 0;
                  return <option key={floor} value={floor}>{floor?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
              </select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Filter by Room</label>
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="glass-input w-full p-2.5 text-xs font-bold"
              >
                <option value="ALL">ALL ROOMS ({cameras.length})</option>
                {uniqueRooms.map(room => {
                  const count = filterCounts.room[room] || 0;
                  return <option key={room} value={room}>{room?.toUpperCase() || 'UNKNOWN'} ({count})</option>
                })}
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
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">S.No</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Device ID</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Name</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Division</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Block</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Floor</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Room</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">IP Address</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Manufacturer SN</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main">
                  {filteredCameras.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((camera, index) => {
                    const loc = parseLocation(camera);
                    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr key={camera._id || camera.id} className="hover:bg-panel transition-colors group cursor-pointer" onClick={() => navigate(`/devices/cameras/${camera._id || camera.id}`)}>
                        <td className="p-4 text-[10px] font-black text-dim uppercase tracking-widest">{serialNumber}</td>
                        <td className="p-4 text-xs font-mono font-bold text-teal-600">{camera.cameraId || '—'}</td>
                        <td className="p-4 text-[10px] font-black text-main uppercase tracking-tight">{camera.name || '—'}</td>
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
                      <td colSpan="10" className="p-10 text-center text-dim text-xs font-bold uppercase tracking-widest">No assets found in selected location parameters</td>
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
                        <span className="text-sm font-mono text-main">{build.count} Assets</span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center items-center space-x-3">
                          <span className="text-[10px] font-bold text-emerald-600">{build.online} UP</span>
                          <div className="w-16 h-1.5 bg-panel rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(build.online / build.count) * 100}%` }}></div>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-teal-500/10 rounded-2xl">
                  <CctvIcon className="text-teal-400" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                    {editingId ? 'Modify Camera' : 'Camera'}
                  </h2>
                </div>
              </div>
              {!editingId && (
                <div className="flex items-center space-x-2 mr-4">
                  {localStorage.getItem('cctv_last_camera') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const last = JSON.parse(localStorage.getItem('cctv_last_camera'));
                          setFormData(prev => ({
                            ...prev,
                            ...last,
                            deviceSerialNumber: '',
                            serialNumber: ''
                          }));
                          showNotification('Last camera entry loaded');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                    >
                      Reuse Last Data
                    </button>
                  )}
                  {localStorage.getItem('cctv_draft_camera') && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const draft = JSON.parse(localStorage.getItem('cctv_draft_camera'));
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
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Camera Designation (Name)</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-sm bg-panel border-main shadow-inner"
                      placeholder="e.g. Front Gate Entry Camera"
                    />
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
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Campus Zone</label>
                    <div className="grid grid-cols-2 gap-3 p-1 bg-black/20 rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, campusZone: 'INSIDE' })}
                        className={`flex items-center justify-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.campusZone === 'INSIDE' ? 'bg-teal-600 text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                      >
                        <Building size={14} className="mr-2" /> INSIDE
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, campusZone: 'OUTSIDE' })}
                        className={`flex items-center justify-center py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${formData.campusZone === 'OUTSIDE' ? 'bg-amber-600 text-white shadow-lg' : 'text-secondary hover:text-main'}`}
                      >
                        <Map size={14} className="mr-2" /> OUTSIDE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Column 2: Specs & Hardware */}
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
                        placeholder="e.g. DS-2CD2043G2"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1 flex justify-between">
                      Asset Number
                      <button type="button" onClick={generateSerialNumber} className="text-[9px] text-teal-600 font-black tracking-widest hover:text-teal-500 transition-colors uppercase">AUTO GENERATE</button>
                    </label>
                    <input type="text" name="deviceSerialNumber" value={formData.deviceSerialNumber} readOnly className="glass-input w-full p-4 text-sm font-mono text-teal-400 bg-panel border-main cursor-not-allowed opacity-80 shadow-inner" placeholder="Auto-generated on save" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Hardware Logic (Camera Type)</label>
                    <select
                      name="deviceType"
                      value={formData.deviceType}
                      onChange={handleInputChange}
                      className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer"
                    >
                      <option value="Bullet">Bullet Camera</option>
                      <option value="Dome">Dome Camera</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Manufacturer Serial Number</label>
                    <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel border-main shadow-inner" placeholder="e.g. SN123456789" />
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
                    <label className="text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Port Number</label>
                    <input type="text" name="portNumber" value={formData.portNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-secondary bg-panel shadow-inner" placeholder="8000" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
                              setFormData({ ...formData, dvrNvrDetails: updated.join(', ') });
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
                    className={`glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer flex justify-between items-center transition-colors ${showNvrDropdown ? 'border-teal-500/50 text-white' : 'text-dim hover:text-white'}`}
                  >
                    <span>Click to assign an NVR...</span>
                    <ChevronRight className={`transition-transform duration-300 ${showNvrDropdown ? 'rotate-90 text-teal-400' : ''}`} size={16} />
                  </div>

                  {/* Dropdown Menu */}
                  {showNvrDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-[#0f0f13] border border-white/10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] max-h-60 overflow-y-auto custom-scrollbar">
                      <div className="sticky top-0 bg-[#0f0f13] p-2 border-b border-white/10 z-10">
                        <input
                          type="text"
                          placeholder="Search NVRs..."
                          value={nvrSearchQuery}
                          onChange={(e) => setNvrSearchQuery(e.target.value)}
                          className="w-full bg-panel text-white text-xs p-2 rounded-lg border border-white/10 outline-none focus:border-teal-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {nvrs.length === 0 ? (
                        <div className="p-4 text-xs text-dim italic text-center">No NVRs registered yet.</div>
                      ) : (
                        nvrs.filter(nvr => {
                          const currentNvrs = String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean);
                          const isSelected = currentNvrs.includes(nvr.nvrName);
                          if (isSelected) return false;
                          if (nvrSearchQuery) {
                            return nvr.nvrName.toLowerCase().includes(nvrSearchQuery.toLowerCase());
                          }
                          return true;
                        }).length === 0 ? (
                          <div className="p-4 text-xs text-dim italic text-center">No unselected NVRs match your search.</div>
                        ) : (
                          nvrs.filter(nvr => {
                            const currentNvrs = String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean);
                            const isSelected = currentNvrs.includes(nvr.nvrName);
                            if (isSelected) return false;
                            if (nvrSearchQuery) {
                              return nvr.nvrName.toLowerCase().includes(nvrSearchQuery.toLowerCase());
                            }
                            return true;
                          }).map(nvr => {
                            return (
                              <button
                                key={nvr._id || nvr.id}
                                type="button"
                                onClick={() => {
                                  const currentNvrs = String(formData.dvrNvrDetails || '').split(',').map(s => s.trim()).filter(Boolean);
                                  let updated = [...currentNvrs];
                                  updated.push(nvr.nvrName);
                                  setFormData({ ...formData, dvrNvrDetails: updated.join(', ') });
                                  setNvrSearchQuery(''); // clear search on select
                                }}
                                className={`w-full text-left px-4 py-3 text-xs font-bold transition-all flex items-center justify-between border-b border-white/5 last:border-0 text-secondary hover:bg-white/5 hover:text-white`}
                              >
                                <div className="flex items-center">
                                  <Server size={14} className="mr-2 text-dim" />
                                  {nvr.nvrName} {nvr.ipAddress ? <span className="opacity-40 ml-1 text-[10px] font-mono font-normal">({nvr.ipAddress})</span> : ''}
                                </div>
                              </button>
                            );
                          })
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

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
                  className={`glass-button px-12 py-4 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {submitting ? 'Saving...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Edit Modal (Status / Location) */}
      {showQuickEditModal && quickEditCamera && (
        <div className="fixed inset-0 modal-overlay z-[120] flex items-center justify-center p-4 animate-fade-in overflow-y-auto" onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setShowQuickEditModal(false); }}>
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/10 rounded-2xl">
                  <Edit2 className="text-sky-500" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-main uppercase tracking-tight">
                    Edit Camera Details
                  </h2>
                </div>
              </div>
              <button onClick={() => setShowQuickEditModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-secondary hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-main bg-card shrink-0">
              <button
                onClick={() => { setQuickEditTab('status'); setConfirmStatus(null); }}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${quickEditTab === 'status' ? 'text-sky-500 border-b-2 border-sky-500 bg-sky-500/5' : 'text-dim hover:bg-panel hover:text-main'}`}
              >
                Change Status
              </button>
              <button
                onClick={() => setQuickEditTab('location')}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${quickEditTab === 'location' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-dim hover:bg-panel hover:text-main'}`}
              >
                Change Location / Info
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-card custom-scrollbar">
              {quickEditTab === 'status' && (
                <div className="space-y-6">
                  <p className="text-sm font-bold text-dim mb-4">Select the new operational status for this asset:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {['Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setConfirmStatus(s)}
                        disabled={quickEditCamera.status === s}
                        className={`py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all border ${quickEditCamera.status === s
                            ? 'bg-sky-500/10 text-sky-600 border-sky-500/30 shadow-lg cursor-not-allowed'
                            : confirmStatus === s
                              ? 'bg-sky-500 text-white border-sky-500 shadow-lg scale-105'
                              : 'bg-panel text-main border-main hover:border-sky-500/50 hover:text-sky-500 shadow-sm'
                          }`}
                      >
                        {s} {quickEditCamera.status === s && '(Current)'}
                      </button>
                    ))}
                  </div>

                  {confirmStatus && (
                    <div className="mt-8 p-6 bg-sky-50 border border-sky-200 rounded-2xl animate-fade-in">
                      <h4 className="text-sky-800 font-bold mb-2">Confirm Status Change</h4>
                      <p className="text-sky-600 text-sm mb-6">Are you sure you want to change the status of {quickEditCamera.name} to <strong>{confirmStatus}</strong>?</p>
                      <div className="flex space-x-4">
                        <button
                          onClick={() => setConfirmStatus(null)}
                          className="flex-1 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleStatusChange(confirmStatus)}
                          disabled={updatingStatus}
                          className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-sky-500 transition-all shadow-md flex items-center justify-center space-x-2"
                        >
                          {updatingStatus ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                          <span>Confirm & Save</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {quickEditTab === 'location' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Asset Name</label>
                        <input
                          type="text"
                          value={quickFormData.name}
                          onChange={(e) => setQuickFormData({ ...quickFormData, name: e.target.value })}
                          className="glass-input w-full p-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Target Division</label>
                        <select
                          value={quickFormData.divisionName}
                          onChange={(e) => setQuickFormData({ ...quickFormData, divisionName: e.target.value })}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="">Select Division</option>
                          {divisions && Array.from(new Set(divisions.map(d => d.name))).filter(Boolean).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Block Designation</label>
                        <select
                          value={quickFormData.block}
                          onChange={(e) => setQuickFormData({ ...quickFormData, block: e.target.value })}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="">Select Block</option>
                          {Array.from(new Set(allLocations.filter(l => l.divisionName === quickFormData.divisionName).map(l => l.block))).map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Camera Type</label>
                          <select
                            value={quickFormData.deviceType}
                            onChange={(e) => {
                              const newType = e.target.value;
                              const currentId = quickFormData.cameraId || '';
                              const parts = currentId.split('/');
                              const numStr = parts[parts.length - 1]; // "05"
                              const prefix = newType === 'Dome' ? 'CCTV/DE/' : 'CCTV/BT/';
                              const newId = numStr && !isNaN(parseInt(numStr)) ? `${prefix}${numStr}` : currentId;
                              setQuickFormData({ ...quickFormData, deviceType: newType, cameraId: newId });
                            }}
                            className="glass-input w-full p-3 text-sm cursor-pointer"
                          >
                            <option value="Bullet">Bullet</option>
                            <option value="Dome">Dome</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Asset ID</label>
                          <input
                            type="text"
                            value={quickFormData.cameraId}
                            disabled
                            className="glass-input w-full p-3 text-sm font-mono opacity-60 cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Floor</label>
                          <select
                            value={quickFormData.floor}
                            onChange={(e) => setQuickFormData({ ...quickFormData, floor: e.target.value })}
                            className="glass-input w-full p-3 text-sm cursor-pointer"
                          >
                            <option value="">Select Floor</option>
                            {Array.from(new Set(allLocations.filter(l => l.block === quickFormData.block).map(l => l.floor))).map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Room / Area</label>
                          <select
                            value={quickFormData.room}
                            onChange={(e) => setQuickFormData({ ...quickFormData, room: e.target.value })}
                            className="glass-input w-full p-3 text-sm cursor-pointer"
                          >
                            <option value="">Select Room</option>
                            {Array.from(new Set(allLocations.filter(l => l.floor === quickFormData.floor).map(l => l.room))).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Campus Zone</label>
                        <select
                          value={quickFormData.campusZone}
                          onChange={(e) => setQuickFormData({ ...quickFormData, campusZone: e.target.value })}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="INSIDE">INSIDE</option>
                          <option value="OUTSIDE">OUTSIDE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">IPv4 Address Assignment</label>
                        <input
                          type="text"
                          value={quickFormData.ipAddress}
                          onChange={(e) => setQuickFormData({ ...quickFormData, ipAddress: e.target.value })}
                          className="glass-input w-full p-3 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">NVR Assignment</label>
                        <input
                          type="text"
                          value={quickFormData.dvrNvrDetails}
                          onChange={(e) => setQuickFormData({ ...quickFormData, dvrNvrDetails: e.target.value })}
                          className="glass-input w-full p-3 text-sm"
                          placeholder="e.g. NVR 1, NVR 2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
                    <h4 className="text-amber-800 font-bold mb-2">Confirm Modifications</h4>
                    <p className="text-amber-600 text-sm mb-6">Review the changes above. This will update the asset's registry and record a relocation log if the block, floor, or IP address has changed.</p>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => setShowQuickEditModal(false)}
                        className="flex-1 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveRelocation}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-bold text-xs uppercase hover:bg-amber-400 transition-all shadow-md flex items-center justify-center space-x-2"
                      >
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Confirm Relocation & Save</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

