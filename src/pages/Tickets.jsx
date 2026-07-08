import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import api from '../services/api';
import { compressImage } from '../utils/imageCompression';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, User as UserIcon, CheckCircle,
  Maximize2, Minimize2, Activity, Shield, Camera, Image as ImageIcon, AlertCircle, ChevronLeft, ChevronRight, Printer, Settings
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useSiteStore } from '../store/siteStore';
import { useNavigate } from 'react-router-dom';
const getImageUrl = (path) => {
  if (!path) return '';
  try {
    const url = new URL(path);
    path = url.pathname;
  } catch (e) {
  }
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  if (cleanPath.startsWith('cctv/')) {
    cleanPath = cleanPath.substring(5);
  }
  if (!cleanPath.startsWith('media/') && !cleanPath.startsWith('api/')) {
    cleanPath = 'media/' + cleanPath;
  }
  const baseUrl = import.meta.env.BASE_URL || '/cctv/';
  return `${baseUrl}${cleanPath}`;
};

const getFileName = (path) => {
  if (!path) return '';
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return name.length > 20 ? name.substring(0, 10) + '...' + name.substring(name.length - 7) : name;
};

export default function Tickets() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const parseMetadata = (remarks) => {
    try {
      const parsed = JSON.parse(remarks);
      if (parsed && typeof parsed === 'object') return parsed;
      throw new Error("Not an object");
    } catch (e) {
      return {
        location: '',
        category: 'CCTV',
        actionTaken: '',
        instructionBy: '',
        receivedTime: '',
        endTime: '',
        totalTime: ''
      };
    }
  };

  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const [tickets, setTickets] = useState([]);
  const [viewMode, setViewMode] = useState('registry'); // 'registry' or 'report'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [knownLocations, setKnownLocations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [filterProject, setFilterProject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [projects, setProjects] = useState([]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [expandedSidePanel, setExpandedSidePanel] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newRemark, setNewRemark] = useState('');
  const [showVisualAnalytics, setShowVisualAnalytics] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    sno: true,
    date: true,
    receivedAt: true,
    division: true,
    blockLocation: true,
    category: true,
    project: true,
    instructionBy: true,
    timeRET: true,
    responsibility: true,
    status: true,
    actions: true
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  const availableMonths = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    const months = tickets.map(ticket => {
      const meta = parseMetadata(ticket.remarks);
      const ticketDate = meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : '');
      return ticketDate ? ticketDate.substring(0, 7) : null;
    }).filter(Boolean);
    return Array.from(new Set(months)).sort().reverse();
  }, [tickets]);

  const formatMonthLabel = (ym) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };

  // Simplified Completion Modal States
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTicket, setCompletionTicket] = useState(null);
  const [completionData, setCompletionData] = useState({
    remark: '',
    endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    image: null,
    video: null
  });

  // In Progress Modal States
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [inProgressTicket, setInProgressTicket] = useState(null);
  const [inProgressData, setInProgressData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    image: null,
    video: null
  });

  const { allLocations, fetchAllLocations, divisions, fetchDivisions } = useSiteStore();
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  const baseFilteredTickets = useMemo(() => {
    return Array.isArray(tickets) ? tickets.filter(ticket => {
      const meta = parseMetadata(ticket.remarks);
      const ticketDate = meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : '');
      
      // Month range filter
      if (startMonth || endMonth) {
        if (!ticketDate) return false;
        const tMonth = String(ticketDate).substring(0, 7); // 'YYYY-MM'
        if (startMonth && tMonth < startMonth) return false;
        if (endMonth && tMonth > endMonth) return false;
      }

      // Advanced Filters
      if (filterProject && String(ticket.projectId?.id || ticket.projectId || ticket.project?.id || '') !== String(filterProject)) return false;
      if (filterCategory && (ticket.category || meta.category) !== filterCategory) return false;
      if (filterDevice && (ticket.ticketDevice || meta.ticketDevice) !== filterDevice) return false;
      if (filterDivision && ticket.divisionName !== filterDivision) return false;

      // Search filter
      const searchStr = `${ticket.issueDescription} ${meta.location} ${meta.category} ${ticket.project?.name || ''}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;

      return true;
    }) : [];
  }, [tickets, startMonth, endMonth, filterProject, filterCategory, filterDevice, filterDivision, searchQuery]);

  const filteredTickets = useMemo(() => {
    return baseFilteredTickets.filter(ticket => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
      return true;
    });
  }, [baseFilteredTickets, statusFilter]);

  const summaryStats = useMemo(() => ({
    total: baseFilteredTickets.length,
    open: baseFilteredTickets.filter(t => t.status === 'Open').length,
    inProgress: baseFilteredTickets.filter(t => t.status === 'In Progress').length,
    completed: baseFilteredTickets.filter(t => t.status === 'Completed').length
  }), [baseFilteredTickets]);

  const filterCounts = useMemo(() => {
    const counts = { division: {}, category: {}, device: {} };
    (Array.isArray(tickets) ? tickets : []).forEach(ticket => {
      const meta = parseMetadata(ticket.remarks);
      const division = String(ticket.divisionName || '');
      const category = String(ticket.category || meta.category || '');
      const device = String(ticket.ticketDevice || meta.ticketDevice || '');

      if (division) counts.division[division] = (counts.division[division] || 0) + 1;
      if (category) counts.category[category] = (counts.category[category] || 0) + 1;
      if (device) counts.device[device] = (counts.device[device] || 0) + 1;
    });
    return counts;
  }, [tickets]);

  const chartData = useMemo(() => [
    { name: 'Open', value: summaryStats.open, color: '#f43f5e' },
    { name: 'In Progress', value: summaryStats.inProgress, color: '#f59e0b' },
    { name: 'Completed', value: summaryStats.completed, color: '#10b981' }
  ].filter(d => d.value > 0), [summaryStats]);

  const categoryStats = useMemo(() => {
    const stats = {};
    baseFilteredTickets.forEach(t => {
      const meta = parseMetadata(t.remarks);
      const cat = t.category || meta.category || 'CCTV';
      if (!stats[cat]) {
        stats[cat] = { count: 0, spend: 0 };
      }
      stats[cat].count += 1;
      
      const bills = t.billing_records || [];
      const billSpend = bills
        .filter(b => b.record_type === 'Bill')
        .reduce((sum, b) => {
          const val = parseFloat(String(b.amount || '0').replace(/[^0-9.-]/g, ''));
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      stats[cat].spend += billSpend;
    });

    return Object.entries(stats).map(([name, val]) => ({
      name,
      count: val.count,
      spend: val.spend
    }));
  }, [baseFilteredTickets]);

  const CATEGORY_COLORS = {
    'Camera': '#3b82f6',
    'CCTV': '#3b82f6',
    'NVR': '#8b5cf6',
    'Storage': '#8b5cf6',
    'Biometric': '#ec4899',
    'Biometrics': '#ec4899',
    'Identity': '#ec4899',
    'Switch': '#f59e0b',
    'Network': '#f59e0b',
    'Upgrade': '#10b981',
    'Flap Barrier': '#f43f5e',
    'Default': '#64748b'
  };

  const getCategoryColor = (name) => {
    return CATEGORY_COLORS[name] || CATEGORY_COLORS['Default'];
  };

  const uniqueDivisions = useMemo(() => {
    const storeDivs = Array.isArray(divisions) ? divisions.map(d => String(d.name || '').toUpperCase()) : [];
    return Array.from(new Set(storeDivs)).filter(Boolean).sort();
  }, [divisions]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    raisedBy: '',
    assignedTo: '',
    assignedStaff: [],
    location: '',
    category: 'Issue',
    ticketDevice: 'Camera',
    issueDescription: '',
    actionTaken: '',
    instructionBy: '',
    receivedTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    receivedDate: new Date().toISOString().split('T')[0],
    endTime: '',
    projectId: '',
    status: 'Open',
    
    // Workflow tracking fields
    createdImage: null,
    createdDate: new Date().toISOString().split('T')[0],
    createdTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    createdVideo: null,
    inProgressImage: null,
    inProgressVideo: null,
    inProgressDate: '',
    inProgressTime: '',
    completedImage: null,
    completedVideo: null,
    completedDate: '',
    completedTime: ''
  });

  const allAvailableLocations = useMemo(() => {
    return [...(Array.isArray(knownLocations) ? knownLocations : []), ...(Array.isArray(allLocations) ? allLocations : [])];
  }, [knownLocations, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    const targetDivision = String(formData.divisionName || '').trim().toUpperCase();
    allAvailableLocations.forEach(l => {
      const div = String(l.divisionName || '').trim().toUpperCase();
      const matchDiv = !targetDivision || div === targetDivision || !div;
      if (matchDiv && l.block) blocks.add(String(l.block).toUpperCase().trim());
    });
    return Array.from(blocks).filter(Boolean).sort();
  }, [allAvailableLocations, formData.divisionName]);

  const uniqueFloors = useMemo(() => {
    const floors = new Set();
    const targetDivision = String(formData.divisionName || '').trim().toUpperCase();
    const targetBlock = String(formData.block || '').trim().toUpperCase();
    allAvailableLocations.forEach(l => {
      const div = String(l.divisionName || '').trim().toUpperCase();
      const blk = String(l.block || '').trim().toUpperCase();
      const matchDiv = !targetDivision || div === targetDivision || !div;
      const matchBlk = !targetBlock || blk === targetBlock;
      if (matchDiv && matchBlk && l.floor) floors.add(String(l.floor).toUpperCase().trim());
    });
    return Array.from(floors).filter(Boolean).sort();
  }, [allAvailableLocations, formData.divisionName, formData.block]);

  const uniqueRooms = useMemo(() => {
    const rooms = new Set();
    const targetDivision = String(formData.divisionName || '').trim().toUpperCase();
    const targetBlock = String(formData.block || '').trim().toUpperCase();
    const targetFloor = String(formData.floor || '').trim().toUpperCase();
    allAvailableLocations.forEach(l => {
      const div = String(l.divisionName || '').trim().toUpperCase();
      const blk = String(l.block || '').trim().toUpperCase();
      const flr = String(l.floor || '').trim().toUpperCase();
      const matchDiv = !targetDivision || div === targetDivision || !div;
      const matchBlk = !targetBlock || blk === targetBlock;
      const matchFlr = !targetFloor || flr === targetFloor;
      if (matchDiv && matchBlk && matchFlr && l.room) rooms.add(String(l.room).toUpperCase().trim());
    });
    return Array.from(rooms).filter(Boolean).sort();
  }, [allAvailableLocations, formData.divisionName, formData.block, formData.floor]);

  useEffect(() => {
    fetchData();
    fetchAllLocations();
    fetchDivisions();
    fetchStaff();
    fetchExistingLocations();
  }, []);

  const fetchExistingLocations = async () => {
    try {
      const res = await api.get('/cameras/');
      const locations = [];
      const camData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      camData.forEach(c => {
        if (c.divisionName || c.block || c.floor || c.room) {
          locations.push({
            divisionName: String(c.divisionName || '').toUpperCase(),
            block: String(c.block || '').toUpperCase(),
            floor: String(c.floor || '').toUpperCase(),
            room: String(c.room || '').toUpperCase()
          });
        }
        if (c.siteName) {
          const parts = String(c.siteName).split('|').map(p => p.trim().toUpperCase());
          locations.push({
            divisionName: parts[0] || '',
            block: parts[1] || '',
            floor: parts[2] || '',
            room: parts[3] || ''
          });
        }
      });
      setKnownLocations(locations);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchStaff = async () => {
    // Staff are now populated directly from users during fetchData to avoid 404 error since the endpoint was removed
    return;
  };

  const handleEditStaff = async (e, s) => {
    e.stopPropagation();
    const newName = prompt('Enter new name for staff member:', s.name);
    if (!newName) return;
    const newEmail = prompt('Enter email address:', s.email || '');
    if (newName === s.name && newEmail === (s.email || '')) return;
    try {
      const res = await api.patch(`/users/${s.id || s._id}/`, { name: newName.trim(), email: newEmail ? newEmail.trim() : s.email });
      const updatedStaff = staff.map(item => (item.id || item._id) === (s.id || s._id) ? { ...item, ...res.data } : item);
      setStaff(updatedStaff);
      setUsers(updatedStaff);
      showNotification('Staff member updated', 'success');
    } catch (err) {
      showNotification('Failed to update staff member', 'error');
    }
  };

  const handleDeleteStaff = async (e, id) => {
    e.stopPropagation();
    showConfirm('Are you sure you want to delete this user entirely?', async () => {
      try {
        await api.delete(`/users/${id}/`);
        const updatedStaff = staff.filter(s => (s.id || s._id) !== id);
        setStaff(updatedStaff);
        setUsers(updatedStaff);
        setFormData(prev => ({
          ...prev,
          assignedStaff: (prev.assignedStaff || []).filter(sId => sId !== id)
        }));
        showNotification('User removed', 'success');
      } catch (err) {
        showNotification('Failed to delete user', 'error');
      }
    });
  };

  const handleAddQuickStaff = async () => {
    if (!newStaffName.trim()) return;
    try {
      const emailToUse = newStaffEmail.trim() || `staff_${Date.now()}@cctv.local`;
      const res = await api.post('/users/', { 
        name: newStaffName.trim(), 
        email: emailToUse,
        password: 'password123',
        role: 'Staff'
      });
      
      const newStaffList = [...staff, res.data];
      setStaff(newStaffList);
      setUsers(newStaffList); // sync with users array
      setFormData(prev => ({
        ...prev,
        assignedStaff: [...(prev.assignedStaff || []), res.data.id || res.data._id]
      }));
      setNewStaffName('');
      setNewStaffEmail('');
      setIsAddingStaff(false);
      showNotification('New staff user added with default password "password123"', 'success');
    } catch (err) {
      showNotification(err.response?.data?.email ? 'Email already exists' : 'Failed to add staff member', 'error');
    }
  };

  const toggleStaffSelection = (id) => {
    setFormData(prev => {
      const current = prev.assignedStaff || [];
      if (current.includes(id)) {
        return { ...prev, assignedStaff: current.filter(s => s !== id) };
      } else {
        return { ...prev, assignedStaff: [...current, id] };
      }
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes, projectRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/'),
        api.get('/tickets/projects/')
      ]);
      const tData = Array.isArray(ticketRes.data) ? ticketRes.data : (ticketRes.data?.results || []);
      const sortedTData = [...tData].sort((a, b) => (b.id || 0) - (a.id || 0));
      setTickets(sortedTData.filter(t => {
        if (!t) return false;
        if (t.projectId || t.project) return false;
        
        let isUpgrade = false;
        try {
          const meta = parseMetadata(t.remarks);
          if (t.category === 'Upgrade' || meta.category === 'Upgrade' || String(t.issueDescription || '').toLowerCase().includes('upgrade')) {
            isUpgrade = true;
          }
        } catch(e) {
          if (t.category === 'Upgrade' || String(t.issueDescription || '').toLowerCase().includes('upgrade')) {
            isUpgrade = true;
          }
        }
        return !isUpgrade;
      }));
      const fetchedUsers = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.results || []);
      setUsers(fetchedUsers);
      setStaff(fetchedUsers);
      setProjects(Array.isArray(projectRes.data) ? projectRes.data : (projectRes.data?.results || []));
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response && err.response.data && err.response.data.error_debug) {
        console.error("BACKEND CRASH TRACEBACK:\n", err.response.data.error_debug);
      }
    } finally {
      setLoading(false);
    }
  };



  const calculateTotalTime = (start, end) => {
    if (!start || !end) return '';
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 24 * 60; // Handle overnight
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    let newValue = value;
    if (type === 'text') {
      newValue = value.toUpperCase();
    }
    
    setFormData(prev => {
      const newData = { ...prev, [name]: newValue };
      
      // Cascading resets for division/block/floor/room
      if (name === 'divisionName' || name === 'block' || name === 'floor' || name === 'room') {
        if (name === 'divisionName') {
          newData.block = '';
          newData.floor = '';
          newData.room = '';
        } else if (name === 'block') {
          newData.floor = '';
          newData.room = '';
        } else if (name === 'floor') {
          newData.room = '';
        }

        // Auto-assign site responsibility from registry
        const matchingLoc = allLocations.find(l => 
          String(l.divisionName || '').toUpperCase() === String(name === 'divisionName' ? value : newData.divisionName || '').toUpperCase() &&
          String(l.block || '').toUpperCase() === String(name === 'block' ? value : newData.block || '').toUpperCase() &&
          String(l.floor || '').toUpperCase() === String(name === 'floor' ? value : newData.floor || '').toUpperCase() &&
          String(l.room || '').toUpperCase() === String(name === 'room' ? value : newData.room || '').toUpperCase()
        );

        if (matchingLoc && matchingLoc.assignedTo) {
          newData.assignedTo = matchingLoc.assignedTo.id || matchingLoc.assignedTo;
        }
      }

      if (name === 'receivedTime' || name === 'endTime') {
        newData.totalTime = calculateTotalTime(newData.receivedTime, newData.endTime);
      }
      return newData;
    });
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const formDataToSend = new FormData();
      formDataToSend.append('issueDescription', formData.issueDescription);
      formDataToSend.append('status', formData.status);
      if (formData.assignedTo) formDataToSend.append('assignedTo', formData.assignedTo);
      if (formData.operationDate || formData.date) formDataToSend.append('operationDate', formData.operationDate || formData.date);
      formDataToSend.append('divisionName', formData.divisionName);
      formDataToSend.append('block', formData.block);
      formDataToSend.append('floor', formData.floor);
      formDataToSend.append('room', formData.room);
      formDataToSend.append('location', `${formData.divisionName} | ${formData.block} | ${formData.floor} | ${formData.room}` || formData.location);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('ticketDevice', formData.ticketDevice || '');
      formDataToSend.append('actionTaken', formData.actionTaken || '');
      formDataToSend.append('instructionBy', formData.instructionBy || '');
      formDataToSend.append('receivedTime', formData.receivedTime || '');
      if (formData.receivedDate || formData.createdDate) formDataToSend.append('receivedDate', formData.receivedDate || formData.createdDate);
      formDataToSend.append('endTime', formData.endTime || '');
      formDataToSend.append('totalTime', calculateTotalTime(formData.receivedTime, formData.endTime));
      formDataToSend.append('remarks', formData.remarks || '');
      if (formData.projectId) formDataToSend.append('projectId', formData.projectId);

      // Append assignedStaff individually
      if (formData.assignedStaff && formData.assignedStaff.length > 0) {
        formData.assignedStaff.forEach(staffId => {
          formDataToSend.append('assignedStaff', staffId);
        });
      }

      // Handle Image Fields
      // If it's a File object, append it. If it is null or empty, don't append (or append empty string if cleared)
      if (formData.createdImage instanceof File) {
        formDataToSend.append('createdImage', formData.createdImage);
      } else if (!formData.createdImage) {
        formDataToSend.append('createdImage', '');
      }

      if (formData.createdVideo instanceof File) {
        formDataToSend.append('createdVideo', formData.createdVideo);
      } else if (!formData.createdVideo) {
        formDataToSend.append('createdVideo', '');
      }

      if (formData.inProgressImage instanceof File) {
        formDataToSend.append('inProgressImage', formData.inProgressImage);
      } else if (!formData.inProgressImage) {
        formDataToSend.append('inProgressImage', '');
      }

      if (formData.inProgressVideo instanceof File) {
        formDataToSend.append('inProgressVideo', formData.inProgressVideo);
      } else if (!formData.inProgressVideo) {
        formDataToSend.append('inProgressVideo', '');
      }

      if (formData.completedImage instanceof File) {
        formDataToSend.append('completedImage', formData.completedImage);
      } else if (!formData.completedImage) {
        formDataToSend.append('completedImage', '');
      }

      if (formData.completedVideo instanceof File) {
        formDataToSend.append('completedVideo', formData.completedVideo);
      } else if (!formData.completedVideo) {
        formDataToSend.append('completedVideo', '');
      }

      // Append Dates and Times
      if (!editingId) {
        formDataToSend.append('createdDate', new Date().toISOString().split('T')[0]);
        formDataToSend.append('createdTime', new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      } else {
        formDataToSend.append('createdDate', formData.createdDate || '');
        formDataToSend.append('createdTime', formData.createdTime || '');
      }
      formDataToSend.append('inProgressDate', formData.inProgressDate || '');
      formDataToSend.append('inProgressTime', formData.inProgressTime || '');
      formDataToSend.append('completedDate', formData.completedDate || '');
      formDataToSend.append('completedTime', formData.completedTime || '');

      if (editingId) {
        const camId = currentTicket?.cameraId?._id || currentTicket?.cameraId?.id || (typeof currentTicket?.cameraId !== 'object' ? currentTicket?.cameraId : null);
        if (camId) formDataToSend.append('cameraId', camId);
        
        const raisedId = currentTicket?.raisedBy?._id || currentTicket?.raisedBy?.id || (typeof currentTicket?.raisedBy !== 'object' ? currentTicket?.raisedBy : null) || user?._id || user?.id;
        if (raisedId) formDataToSend.append('raisedBy', raisedId);
        
        await api.put(`/tickets/${editingId}/`, formDataToSend);
        showNotification('Ticket updated successfully');
      } else {
        if (user._id || user.id) formDataToSend.append('raisedBy', user._id || user.id);
        
        await api.post('/tickets/', formDataToSend);
        showNotification('New ticket created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchData();
      if (selectedTicket) {
        const updatedTickets = await api.get('/tickets/');
        const fresh = updatedTickets.data.find(t => (t.id || t._id) === (selectedTicket.id || selectedTicket._id));
        if (fresh) setSelectedTicket(fresh);
      }
    } catch (err) {
      console.error('Error saving ticket:', err);
      showNotification('Failed to save ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const addRemark = async (e) => {
    e.preventDefault();
    if (!newRemark.trim() || !selectedTicket) return;

    try {
      await api.post(`/tickets/${selectedTicket.id || selectedTicket._id}/add_remark/`, {
        remark: newRemark
      });
      
      setNewRemark('');
      const res = await api.get(`/tickets/${selectedTicket.id || selectedTicket._id}/`);
      setSelectedTicket(res.data);
      fetchData();
      showNotification('Remark added successfully');
    } catch (err) {
      console.error('Error adding remark:', err);
      showNotification('Failed to add remark', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      divisionName: '',
      block: '',
      floor: '',
      room: '',
      location: '',
      category: 'Issue',
      ticketDevice: 'Camera',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      receivedTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      receivedDate: new Date().toISOString().split('T')[0],
      endTime: '',
      assignedTo: '',
      assignedStaff: [],
      projectId: '',
      status: 'Open',
      
      createdImage: null,
      createdVideo: null,
      createdDate: new Date().toISOString().split('T')[0],
      createdTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      inProgressImage: null,
      inProgressVideo: null,
      inProgressDate: '',
      inProgressTime: '',
      completedImage: null,
      completedVideo: null,
      completedDate: '',
      completedTime: ''
    });
    setEditingId(null);
    setCurrentTicket(null);
  };

  const handleEdit = (ticket) => {
    if (ticket.status === 'Completed' && user?.role !== 'Super Admin') {
      showNotification('Only Super Admin can edit completed tickets', 'error');
      return;
    }
    const meta = parseMetadata(ticket.remarks);
    setFormData({
      date: ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      divisionName: ticket.divisionName || '',
      block: ticket.block || '',
      floor: ticket.floor || '',
      room: ticket.room || '',
      location: ticket.location || meta.location || '',
      category: ticket.category || meta.category || 'Issue',
      ticketDevice: ticket.ticketDevice || meta.ticketDevice || 'Camera',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || meta.actionTaken || '',
      instructionBy: ticket.instructionBy || meta.instructionBy || '',
      receivedDate: ticket.receivedDate || (ticket.createdDate ? ticket.createdDate : (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])),
      receivedTime: ticket.receivedTime || meta.receivedTime || '',
      endTime: ticket.endTime || meta.endTime || '',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo || '',
      assignedStaff: ticket.assignedStaff ? ticket.assignedStaff.map(s => s.id || s._id) : [],
      projectId: ticket.projectId?.id || ticket.projectId || '',
      status: ticket.status || 'Open',
      
      createdImage: ticket.createdImage || null,
      createdVideo: ticket.createdVideo || null,
      createdDate: ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      createdTime: ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
      inProgressImage: ticket.inProgressImage || null,
      inProgressVideo: ticket.inProgressVideo || null,
      inProgressDate: ticket.inProgressDate || '',
      inProgressTime: ticket.inProgressTime || '',
      completedImage: ticket.completedImage || null,
      completedVideo: ticket.completedVideo || null,
      completedDate: ticket.completedDate || '',
      completedTime: ticket.completedTime || ''
    });
    setEditingId(ticket.id || ticket._id);
    setCurrentTicket(ticket);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/tickets/${id}/`);
        showNotification('Ticket deleted successfully');
        fetchData();
      } catch (err) {
        console.error('Error deleting ticket:', err);
        showNotification('Failed to delete ticket', 'error');
      }
    });
  };



  const handleDownload = () => {
    if (filteredTickets.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'S.No', 'Date', 'Division', 'Block', 'Floor', 'Room', 'Location String', 'Category', 'Device', 'Project', 'Issue Description', 
      'Action Taken', 'Instruction By', 'Received Time', 
      'End Time', 'Total Time', 'Assigned To', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredTickets.map((ticket, index) => {
      const meta = parseMetadata(ticket.remarks);
      const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
      const assignedUser = users.find(u => (u.id || u._id) === assignedId);
      
      return [
        index + 1,
        escapeCSV(` ${ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')}`.trim()),
        escapeCSV(ticket.divisionName || ''),
        escapeCSV(ticket.block || ''),
        escapeCSV(ticket.floor || ''),
        escapeCSV(ticket.room || ''),
        escapeCSV(ticket.location || meta.location || 'N/A'),
        escapeCSV(ticket.category || meta.category || 'Issue'),
        escapeCSV(ticket.ticketDevice || meta.ticketDevice || 'None'),
        escapeCSV(ticket.project?.name || 'Independent'),
        escapeCSV(ticket.issueDescription || ''),
        escapeCSV(ticket.actionTaken || meta.actionTaken || ''),
        escapeCSV(ticket.instructionBy || meta.instructionBy || 'N/A'),
        escapeCSV(ticket.receivedTime || meta.receivedTime || '--:--'),
        escapeCSV(ticket.endTime || meta.endTime || '--:--'),
        escapeCSV(ticket.totalTime || meta.totalTime || '0h 0m'),
        escapeCSV(assignedUser?.name || 'Unassigned'),
        escapeCSV(ticket.status)
      ];
    });

    const csvContent = "\uFEFF" + [ // BOM for Excel
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `CCTV_Tickets_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Export successful');
  };

  const exportExcelReport = () => {
    const dateRangeLabel = startMonth || endMonth 
      ? `(${startMonth ? formatMonthLabel(startMonth) : ''} to ${endMonth ? formatMonthLabel(endMonth) : ''})`
      : '';

    const breakdownMap = {};
    filteredTickets.forEach(t => {
      const meta = parseMetadata(t.remarks);
      const cat = t.category || meta.category || 'Issue';
      const dev = t.ticketDevice || meta.ticketDevice || 'None';
      const key = `${cat}||${dev}`;
      
      if (!breakdownMap[key]) {
        breakdownMap[key] = { category: cat, device: dev, open: 0, inProgress: 0, completed: 0, total: 0 };
      }
      
      if (t.status === 'Open') breakdownMap[key].open++;
      else if (t.status === 'In Progress') breakdownMap[key].inProgress++;
      else if (t.status === 'Completed') breakdownMap[key].completed++;
      
      breakdownMap[key].total++;
    });

    const breakdown = Object.values(breakdownMap).sort((a, b) => a.category.localeCompare(b.category) || a.device.localeCompare(b.device));

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>CCTV System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="12" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="BoldText">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
`;

    xml += ` <Worksheet ss:Name="Report Summary">
  <Table>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="5" ss:StyleID="Title"><Data ss:Type="String">Report Summary ${dateRangeLabel}</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Ticket Category</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Ticket Device</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Open</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">In Progress</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Completed</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total</Data></Cell>
   </Row>
`;
    breakdown.forEach(row => {
      xml += `   <Row>
    <Cell><Data ss:Type="String">${row.category}</Data></Cell>
    <Cell><Data ss:Type="String">${row.device}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.open}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.inProgress}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.completed}</Data></Cell>
    <Cell><Data ss:Type="Number">${row.total}</Data></Cell>
   </Row>
`;
    });
    
    const grandOpen = breakdown.reduce((sum, r) => sum + r.open, 0);
    const grandInProgress = breakdown.reduce((sum, r) => sum + r.inProgress, 0);
    const grandCompleted = breakdown.reduce((sum, r) => sum + r.completed, 0);
    const grandTotal = breakdown.reduce((sum, r) => sum + r.total, 0);
    
    xml += `   <Row>
    <Cell ss:MergeAcross="1" ss:StyleID="BoldText"><Data ss:Type="String">Grand Total</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="Number">${grandOpen}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="Number">${grandInProgress}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="Number">${grandCompleted}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="Number">${grandTotal}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
`;

    const renderCategorySheet = (catName) => {
      const list = filteredTickets.filter(t => {
        const meta = parseMetadata(t.remarks);
        const tCat = t.category || meta.category || 'CCTV';
        return tCat.toLowerCase() === catName.toLowerCase();
      });

      let sheetXml = ` <Worksheet ss:Name="${catName}">
  <Table ss:DefaultColumnWidth="120">
   <Row ss:Height="20">
    <Cell ss:StyleID="Header"><Data ss:Type="String">S.No</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Division</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Ticket Device</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Instruction By</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Nature of Problem</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Assigned To</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Remarks</Data></Cell>
   </Row>
`;
      if (list.length === 0) {
        sheetXml += `   <Row>
    <Cell ss:MergeAcross="7"><Data ss:Type="String">No tickets for category ${catName}.</Data></Cell>
   </Row>
`;
      } else {
        list.forEach((t, idx) => {
          const meta = parseMetadata(t.remarks);
          const tDate = t.operationDate || meta.manualDate || (t.createdAt ? String(t.createdAt).split('T')[0] : 'N/A');
          const tDiv = t.divisionName || 'N/A';
          const tStatus = t.status || 'Open';
          const tInst = t.instructionBy || meta.instructionBy || 'N/A';
          const tDesc = t.issueDescription || '';
          const tAssign = t.assignedTo?.name || t.assignedTo?.username || t.assignedTo || 'Unassigned';
          const tRemarks = t.actionTaken || meta.actionTaken || '';
          const tDevice = t.ticketDevice || meta.ticketDevice || 'None';
          
          sheetXml += `   <Row>
    <Cell><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tDate)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tDiv)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tDevice)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tStatus)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tInst)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tDesc)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tAssign)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(tRemarks)}</Data></Cell>
   </Row>
`;
        });
      }
      sheetXml += `  </Table>
 </Worksheet>
`;
      return sheetXml;
    };

    const escapeXml = (unsafe) => {
      return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const activeCategories = Array.from(new Set(breakdown.map(b => b.category)));
    activeCategories.forEach(cat => {
      xml += renderCategorySheet(cat);
    });

    xml += `</Workbook>`;

    const fileDateLabel = startMonth || endMonth
      ? `${startMonth || ''}_to_${endMonth || ''}`
      : new Date().toISOString().split('T')[0];
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Category_Breakdown_Report_${fileDateLabel}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Excel Export successful');
  };

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Tickets Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 20px; text-align: center; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: bold; text-transform: uppercase; color: #4b5563; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .status-open { background-color: #fee2e2; color: #b91c1c; }
            .status-inprogress { background-color: #fef3c7; color: #d97706; }
            .status-completed { background-color: #d1fae5; color: #047857; }
            .footer { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Tickets Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Category</th>
                <th>Location</th>
                <th>Issue Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTickets.map((ticket, idx) => {
                const meta = parseMetadata(ticket.remarks);
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')}</td>
                  <td>${ticket.category || meta.category || 'CCTV'}</td>
                  <td>${[ticket.divisionName, ticket.block, ticket.room].filter(Boolean).join(' / ') || ticket.location || meta.location || 'N/A'}</td>
                  <td>${ticket.issueDescription || 'N/A'}</td>
                  <td><span class="badge ${ticket.status === 'Completed' ? 'status-completed' : ticket.status === 'In Progress' ? 'status-inprogress' : 'status-open'}">${ticket.status || 'N/A'}</span></td>
                </tr>
                `
              }).join('')}
            </tbody>
          </table>
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()} &bull; Total Records: ${filteredTickets.length}
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
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Tag className="mr-3 text-cyan-400" size={28} />
            Ticket Management
          </h1>
          <div className="flex bg-panel border border-main rounded-xl p-0.5 sm:ml-4 self-start">
            <button
              onClick={() => setViewMode('registry')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'registry'
                  ? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ticket List
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'report'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Report View
            </button>
          </div>
        </div>
        <div className="flex space-x-4 items-center">
          <button onClick={handleDownload} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2">
              <Plus size={16} className="mr-2" />
              Raise Ticket
            </button>
          )}
        </div>
      </div>

      {/* Search & Month Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by Description, Location..."
            className="bg-panel text-sm text-slate-200 border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center space-x-2 bg-panel px-4 py-3 rounded-md border border-main">
          <Calendar size={16} className="text-slate-400" />
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="From Month"
          >
            <option value="">From Month</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
          <span className="text-slate-400 text-xs">to</span>
          <select
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="To Month"
          >
            <option value="">To Month</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {viewMode === 'registry' ? (
        <>
          {/* Summary Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-slide-up delay-100">
            <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-rose-500/30 text-left" onClick={() => setStatusFilter(statusFilter === 'Open' ? 'ALL' : 'Open')}>
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-rose-500 tracking-widest uppercase">[OPEN TICKETS]</h3>
                <AlertCircle size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-white">{summaryStats.open}</span>
              </div>
            </button>

            <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-amber-500/30 text-left" onClick={() => setStatusFilter(statusFilter === 'In Progress' ? 'ALL' : 'In Progress')}>
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-amber-500 tracking-widest uppercase">[IN PROGRESS]</h3>
                <Activity size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-white">{summaryStats.inProgress}</span>
              </div>
            </button>

            <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-green-500/30 text-left" onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'ALL' : 'Completed')}>
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-green-500 tracking-widest uppercase">[COMPLETED]</h3>
                <CheckCircle size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-white">{summaryStats.completed}</span>
              </div>
            </button>

            <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ring-1 ring-cyan-500/50 text-left" onClick={() => setStatusFilter('ALL')}>
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL MANAGED]</h3>
                <Briefcase size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-cyan-400">{summaryStats.total}</span>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: '30%' }}></div>
            </button>

            <div className="bg-panel rounded-md p-4 flex items-center justify-center relative">
              <div className="w-24 h-24 relative flex items-center justify-center">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={40} paddingAngle={2} dataKey="value" stroke="none">
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold uppercase">No Data</span>
                )}
                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[12px] font-bold text-white leading-none text-center mt-1">100%<br/><span className="text-[7px] text-slate-400">DIST.</span></span>
                </div>
              </div>
              <div className="absolute right-2 flex flex-col space-y-1">
                {chartData.map(d => (
                  <div key={d.name} className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                    <span className="text-[9px] text-slate-300 font-bold uppercase">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-md border border-main mt-6 mb-6">
            <div className="flex p-1 bg-slate-800 rounded-lg border border-slate-700">
              {['ALL', 'Open', 'In Progress', 'Completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                    statusFilter === status 
                      ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 ml-auto">
              <select 
                value={filterDivision} 
                onChange={(e) => setFilterDivision(e.target.value)} 
                className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer min-w-[150px]"
              >
                <option value="">All Divisions ({Array.isArray(tickets) ? tickets.length : 0})</option>
                {Array.isArray(divisions) && Array.from(new Set(divisions.map(d => d.name))).filter(Boolean).map(d => (
                  <option key={d} value={d}>{d} ({filterCounts.division[d] || 0})</option>
                ))}
              </select>
              <select 
                value={filterCategory} 
                onChange={(e) => setFilterCategory(e.target.value)} 
                className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer min-w-[150px]"
              >
                <option value="">All Categories ({Array.isArray(tickets) ? tickets.length : 0})</option>
                <option value="Issue">Issue ({filterCounts.category['Issue'] || 0})</option>
                <option value="Service">Service ({filterCounts.category['Service'] || 0})</option>
                <option value="Maintenance">Maintenance ({filterCounts.category['Maintenance'] || 0})</option>
                <option value="Installation">Installation ({filterCounts.category['Installation'] || 0})</option>
                <option value="Other">Other ({filterCounts.category['Other'] || 0})</option>
              </select>
              <select 
                value={filterDevice} 
                onChange={(e) => setFilterDevice(e.target.value)} 
                className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer min-w-[150px]"
              >
                <option value="">All Devices ({Array.isArray(tickets) ? tickets.length : 0})</option>
                <option value="Camera">Camera ({filterCounts.device['Camera'] || 0})</option>
                <option value="Biometrics">Biometrics ({filterCounts.device['Biometrics'] || 0})</option>
                <option value="Flap Barrier">Flap Barrier ({filterCounts.device['Flap Barrier'] || 0})</option>
              </select>
              <button 
                onClick={handleDownload}
                className="flex items-center text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
              >
                <Download size={12} className="mr-1.5" />
                CSV
              </button>
              <button 
                onClick={printToPDF}
                className="flex items-center text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
              >
                <Printer size={12} className="mr-1.5" />
                PDF
              </button>
            </div>
          </div>

      {/* Main Content Table */}
        <div className="p-4 border-b border-main flex justify-end items-center bg-card/40 rounded-t-2xl mb-4 relative">
          <div className="flex items-center space-x-4">
            
            <div className="relative">
              <button 
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded flex items-center border border-slate-700 transition-colors"
              >
                <Settings size={12} className="mr-1.5" /> Columns
              </button>
              
              {showColumnDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-2 animate-fade-in">
                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 px-2">Visible Columns</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {Object.keys(columnVisibility).map(key => (
                      <label key={key} className="flex items-center p-1.5 hover:bg-slate-700/50 rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={columnVisibility[key]}
                          onChange={() => setColumnVisibility(prev => ({...prev, [key]: !prev[key]}))}
                          className="mr-2 accent-cyan-500"
                        />
                        <span className="text-[10px] font-bold text-slate-300 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
                {filteredTickets.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredTickets.length)}-${Math.min(currentPage * itemsPerPage, filteredTickets.length)} of ${filteredTickets.length}`}
              </span>
              <button disabled={currentPage >= Math.ceil(filteredTickets.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>


<div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                {columnVisibility.sno && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-12">S.No</th>}
                {columnVisibility.date && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>}
                {columnVisibility.receivedAt && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received At</th>}
                {columnVisibility.division && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Division</th>}
                {columnVisibility.blockLocation && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Block / Location</th>}
                {columnVisibility.category && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>}
                {columnVisibility.project && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</th>}
                {columnVisibility.instructionBy && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instruction By</th>}
                {columnVisibility.timeRET && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Time (R/E/T)</th>}
                {columnVisibility.responsibility && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsibility</th>}
                {columnVisibility.status && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>}
                {columnVisibility.actions && canEdit && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
               {loading ? (
                <tr>
                  <td colSpan="14" className="p-20 text-center text-dim">
                    Loading tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="14" className="p-20 text-center text-dim">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((ticket, index) => {
                  const meta = parseMetadata(ticket.remarks);
                  const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
                  const assignedUser = ticket.assignedTo && typeof ticket.assignedTo === 'object'
                    ? ticket.assignedTo
                    : (Array.isArray(users) ? users.find(u => (u.id || u._id) === assignedId) : null);
                  
                  return (
                      <tr 
                        key={ticket.id || ticket._id} 
                        className="hover:bg-slate-700/30 transition-colors group cursor-pointer"
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('select')) return;
                          navigate(`/tickets/${ticket.id || ticket._id}`);
                        }}
                      >
                      {columnVisibility.sno && <td className="p-4 text-center font-mono text-[10px] text-slate-400">{(currentPage - 1) * itemsPerPage + index + 1}</td>}
                      
                      {columnVisibility.date && (
                        <td className="p-4">
                          <div className="flex items-center text-slate-400 font-mono text-xs">
                            <Calendar size={12} className="mr-2 text-slate-500" />
                            {ticket.operationDate || meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}
                          </div>
                        </td>
                      )}

                      {columnVisibility.receivedAt && (
                        <td className="p-4">
                          <div className="flex flex-col text-slate-400 font-mono text-[10px] space-y-0.5">
                            <div className="flex items-center text-cyan-400">
                              <Calendar size={10} className="mr-1" />
                              {ticket.receivedDate || ticket.createdDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}
                            </div>
                            <div className="flex items-center text-cyan-400/80">
                              <Clock size={10} className="mr-1" />
                              {ticket.receivedTime || '--:--'}
                            </div>
                          </div>
                        </td>
                      )}

                      {columnVisibility.division && (
                        <td className="p-4">
                          <div className="flex items-center text-blue-400 font-semibold text-[10px]">
                             <MapPin size={10} className="mr-1" />
                             {ticket.divisionName || 'N/A'}
                          </div>
                        </td>
                      )}

                      {columnVisibility.blockLocation && (
                        <td className="p-4">
                          <div className="text-slate-400 font-medium text-[10px]">
                             {[ticket.block, ticket.floor, ticket.room].filter(Boolean).join(' | ') || 'N/A'}
                          </div>
                        </td>
                      )}

                      {columnVisibility.category && (
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border border-blue-500/50 text-blue-400 bg-blue-500/10">
                            {ticket.category || meta.category || 'Issue'}
                          </span>
                        </td>
                      )}

                      {columnVisibility.project && (
                        <td className="p-4">
                          <div className="flex items-center text-xs text-slate-400 font-medium">
                            <Briefcase size={12} className="mr-2 text-cyan-400" />
                            {ticket.project?.name || 'Independent'}
                          </div>
                        </td>
                      )}

                      {columnVisibility.instructionBy && (
                        <td className="p-4 text-xs text-slate-200 font-medium">
                          {ticket.instructionBy || meta.instructionBy || 'N/A'}
                        </td>
                      )}

                      {columnVisibility.timeRET && (
                        <td className="p-4">
                          <div className="flex flex-col items-center space-y-1">
                            <span className="text-[10px] text-emerald-400 font-mono">{ticket.receivedTime || meta.receivedTime || '--:--'}</span>
                            <span className="text-[10px] text-red-400 font-mono">{ticket.endTime || meta.endTime || '--:--'}</span>
                            <div className="h-[1px] w-8 bg-slate-700"></div>
                            <span className="text-[10px] text-slate-200 font-bold">{ticket.totalTime || meta.totalTime || '0h 0m'}</span>
                          </div>
                        </td>
                      )}

                      {columnVisibility.responsibility && (
                        <td className="p-4">
                          <div className="flex flex-col space-y-1">
                            {Array.isArray(ticket.assignedStaff) && ticket.assignedStaff.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {ticket.assignedStaff.map(s => (
                                  <span key={s.id || s._id} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-blue-500/30 text-blue-400 bg-blue-500/10">
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                {(() => {
                                  const displayUser = assignedUser || ticket.raisedBy;
                                  return (
                                    <>
                                      <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                                        {String(displayUser?.name || 'U').charAt(0)?.toUpperCase() || 'U'}
                                      </div>
                                      <span className="text-[11px] text-slate-400 font-medium">
                                        {displayUser?.name || 'Unassigned'}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {columnVisibility.status && (
                        <td className="p-4">
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              ticket.status === 'Completed' ? 'text-green-500 border-green-500/50' :
                              ticket.status === 'In Progress' ? 'text-amber-500 border-amber-500/50' :
                              'text-red-500 border-red-500/50'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                        </td>
                      )}

                      {columnVisibility.actions && canEdit && (
                        <td className="p-4 text-right">
                          <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                              <button onClick={() => handleEdit(ticket)} className="text-slate-400 hover:text-cyan-400 transition-colors">
                                <Edit2 size={14} />
                              </button>
                            )}
                            {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                              <button onClick={() => handleDelete(ticket.id || ticket._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>
      </div>
    </>
  ) : (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-10">
      {/* Detailed Ticket Report View */}
      <div className="bg-panel border border-main rounded-md p-8 flex flex-col justify-between overflow-hidden relative transition-all group shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-xl font-bold text-main tracking-wider uppercase mb-1">Ticket Operations & Performance Report</h2>
            <p className="text-xs text-dim font-medium">
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold uppercase tracking-widest text-slate-300">
                Period: {startMonth || 'ALL'} to {endMonth || 'ALL'}
              </span>
              <span className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-bold uppercase tracking-widest text-cyan-400">
                Division: {filterDivision || 'ALL DIVISIONS'}
              </span>
              <span className="px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold uppercase tracking-widest text-purple-400">
                Category: {filterCategory || 'ALL CATEGORIES'}
              </span>
              <span className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold uppercase tracking-widest text-amber-400">
                Project: {filterProject ? (projects.find(p => String(p.id || p._id) === String(filterProject))?.name || 'SPECIFIC') : 'ALL PROJECTS'}
              </span>
              <span className="px-2.5 py-1 rounded bg-teal-500/10 border border-teal-500/20 text-[9px] font-bold uppercase tracking-widest text-teal-400">
                Status Filter: {statusFilter}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
            <button
              onClick={exportExcelReport}
              className="flex items-center text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
            >
              <Download size={12} className="mr-2" />
              Export Excel Report
            </button>
            <button
              onClick={printToPDF}
              className="flex items-center text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
            >
              <Printer size={12} className="mr-2" />
              Print PDF Report
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
            >
              <Download size={12} className="mr-2" />
              Export CSV Data
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Tickets</span>
          <span className="text-3xl font-bold font-mono text-white mt-2">{filteredTickets.length}</span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
        </div>
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Open Queue</span>
          <span className="text-3xl font-bold font-mono text-rose-400 mt-2">{filteredTickets.filter(t => t.status === 'Open').length}</span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50"></div>
        </div>
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">In Progress</span>
          <span className="text-3xl font-bold font-mono text-amber-400 mt-2">{filteredTickets.filter(t => t.status === 'In Progress').length}</span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
        </div>
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Completed</span>
          <span className="text-3xl font-bold font-mono text-green-400 mt-2">{filteredTickets.filter(t => t.status === 'Completed').length}</span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
        </div>
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Resolution Rate</span>
          <span className="text-3xl font-bold font-mono text-cyan-400 mt-2">
            {((filteredTickets.filter(t => t.status === 'Completed').length / (filteredTickets.length || 1)) * 100).toFixed(0)}%
          </span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
        </div>
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
          <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Billing Records</span>
          <span className="text-3xl font-bold font-mono text-purple-400 mt-2">
            {filteredTickets.filter(t => t.billing_records?.length > 0).length}
          </span>
          <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Category Breakdown</h3>
          <div className="h-64 flex items-center justify-center">
            {categoryStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryStats} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={60} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      fontSize: '10px'
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {categoryStats.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={getCategoryColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Category Data</p>
            )}
          </div>
        </div>

        <div className="bg-panel border border-main rounded-md p-6 flex flex-col lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Tickets by Division</h3>
          <div className="h-64 flex items-center justify-center">
            {(() => {
              const divDataMap = {};
              filteredTickets.forEach(t => {
                const name = t.divisionName || 'Unassigned';
                divDataMap[name] = (divDataMap[name] || 0) + 1;
              });
              const data = Object.entries(divDataMap).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 10);
              if (data.length === 0) return <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Division Data</p>;
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} interval={0} angle={-30} textAnchor="end" height={40} />
                    <YAxis stroke="#94a3b8" fontSize={9} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        fontSize: '10px'
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-main rounded-md p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Technician Load & Productivity Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</th>
                <th className="p-4 text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Open</th>
                <th className="p-4 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center">In Progress</th>
                <th className="p-4 text-[10px] font-bold text-green-500 uppercase tracking-widest text-center">Completed</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Total Assigned</th>
                <th className="p-4 text-[10px] font-bold text-cyan-400 uppercase tracking-widest text-center">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-400">
              {(() => {
                const techReportMap = {};
                filteredTickets.forEach(t => {
                  const name = t.assignedTo?.name || t.assignedTo?.username || t.assignedTo || 'Unassigned';
                  if (!techReportMap[name]) techReportMap[name] = { Open: 0, 'In Progress': 0, Completed: 0 };
                  if (techReportMap[name][t.status] !== undefined) {
                    techReportMap[name][t.status]++;
                  }
                });
                const data = Object.entries(techReportMap).sort((a,b) => {
                  const sumA = a[1].Open + a[1]['In Progress'] + a[1].Completed;
                  const sumB = b[1].Open + b[1]['In Progress'] + b[1].Completed;
                  return sumB - sumA;
                });
                if (data.length === 0) {
                  return (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs">No technician load data found.</td>
                    </tr>
                  );
                }
                return data.map(([name, counts]) => {
                  const total = counts.Open + counts['In Progress'] + counts.Completed;
                  const rate = total > 0 ? ((counts.Completed / total) * 100).toFixed(0) : 0;
                  return (
                    <tr key={name} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 text-xs font-bold text-white flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span>{name}</span>
                      </td>
                      <td className="p-4 font-mono text-center text-rose-400 font-bold">{counts.Open}</td>
                      <td className="p-4 font-mono text-center text-amber-400 font-bold">{counts['In Progress']}</td>
                      <td className="p-4 font-mono text-center text-green-400 font-bold">{counts.Completed}</td>
                      <td className="p-4 font-mono text-center text-white font-bold">{total}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 font-mono">
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="p-4 bg-panel border-b border-main flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Registry ({filteredTickets.length} Records)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main text-slate-400">
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-center w-12">S.No</th>
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Date</th>
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Division</th>
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Category</th>
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Instruction By</th>
                <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
              {filteredTickets.map((ticket, idx) => {
                const meta = parseMetadata(ticket.remarks);
                return (
                  <tr key={ticket.id || ticket._id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="p-4 text-center font-mono text-[10px] text-slate-500">{idx + 1}</td>
                    <td className="p-4 font-mono text-[10px] text-slate-400">
                      {ticket.operationDate || meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}
                    </td>
                    <td className="p-4 text-xs font-bold text-blue-400">
                      {ticket.divisionName || 'N/A'}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border border-blue-500/50 text-blue-400 bg-blue-500/10">
                        {ticket.category || meta.category || 'Issue'}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {ticket.instructionBy || meta.instructionBy || 'N/A'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        ticket.status === 'Completed' ? 'text-green-500 border-green-500/50' :
                        ticket.status === 'In Progress' ? 'text-amber-500 border-amber-500/50' :
                        'text-red-500 border-red-500/50'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-main tracking-tight uppercase">
                  {editingId ? 'Modify Ticket' : 'Ticket'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
              {/* Section 1: Location Intelligence */}
              <div className="space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-panel/30 rounded-3xl border border-main">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Division</label>
                    <select name="divisionName" value={formData.divisionName} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Division</option>
                      {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Block</label>
                    <select name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Block</option>
                      {uniqueBlocks.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Floor</label>
                    <select name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Floor</option>
                      {uniqueFloors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Room</label>
                    <select name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Room</option>
                      {uniqueRooms.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Logistical Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Operation Date</label>
                      <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Start Time</label>
                        <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">End Time</label>
                        <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Ticket Category</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-3 text-xs cursor-pointer bg-panel border-main">
                        <option value="Issue">Issue</option>
                        <option value="Service">Service</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Installation">Installation</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Ticket Device</label>
                      <select name="ticketDevice" value={formData.ticketDevice} onChange={handleInputChange} className="glass-input w-full p-3 text-xs cursor-pointer bg-panel border-main">
                        <option value="">None</option>
                        <option value="Camera">Camera</option>
                        <option value="Biometrics">Biometrics</option>
                        <option value="Flap Barrier">Flap Barrier</option>
                      </select>
                    </div>
                    <div>
                       <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                       <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Name of authorize officer" />
                     </div>
                     <div>
                       <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Initial Issue Image (Optional)</label>
                       {formData.createdImage && typeof formData.createdImage === 'string' ? (
                         <div className="relative group rounded-xl overflow-hidden border border-main bg-panel p-2">
                           <img src={getImageUrl(formData.createdImage)} className="w-full h-24 object-cover rounded-lg" alt="Initial Issue" />
                           <button 
                             type="button" 
                             onClick={() => setFormData(prev => ({ ...prev, createdImage: null }))}
                             className="absolute top-3 right-3 p-1.5 bg-red-600/80 hover:bg-red-700 rounded-lg text-white transition-colors"
                           >
                             <Trash2 size={12} />
                           </button>
                         </div>
                       ) : formData.createdImage instanceof File ? (
                         <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                           <span className="text-[10px] text-blue-400 font-bold truncate max-w-[200px]">{formData.createdImage.name}</span>
                           <button type="button" onClick={() => setFormData(prev => ({ ...prev, createdImage: null }))} className="text-blue-400"><X size={14} /></button>
                         </div>
                       ) : (
                         <div className="flex space-x-2 w-full">
                           <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                             <div className="flex flex-col items-center justify-center pt-2 pb-3">
                               <ImageIcon size={18} className="text-dim mb-1" />
                               <p className="text-[10px] text-dim font-bold">Gallery</p>
                             </div>
                             <input 
                               type="file" 
                               className="hidden" 
                               accept="image/*"
                               onChange={async (e) => {
                                 const file = e.target.files[0];
                                 if (file) {
                                   try {
                                     const compressedFile = await compressImage(file, 50);
                                     setFormData(prev => ({ ...prev, createdImage: compressedFile }));
                                   } catch (err) {
                                     showNotification('Failed to process image', 'error');
                                   }
                                 }
                               }}
                             />
                           </label>
                           <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                             <div className="flex flex-col items-center justify-center pt-2 pb-3">
                               <Camera size={18} className="text-dim mb-1" />
                               <p className="text-[10px] text-dim font-bold">Camera</p>
                             </div>
                             <input 
                               type="file" 
                               className="hidden" 
                               accept="image/*"
                               capture="environment"
                               onChange={async (e) => {
                                 const file = e.target.files[0];
                                 if (file) {
                                   try {
                                     const compressedFile = await compressImage(file, 50);
                                     setFormData(prev => ({ ...prev, createdImage: compressedFile }));
                                   } catch (err) {
                                     showNotification('Failed to process image', 'error');
                                   }
                                 }
                               }}
                             />
                           </label>
                         </div>
                       )}
                     </div>
                     <div className="mt-4">
                       <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Initial Issue Video (Optional)</label>
                       {formData.createdVideo && typeof formData.createdVideo === 'string' ? (
                         <div className="relative group rounded-xl overflow-hidden border border-main bg-panel p-2">
                           <video src={getImageUrl(formData.createdVideo)} className="w-full h-24 object-cover rounded-lg" controls />
                           <button 
                             type="button" 
                             onClick={() => setFormData(prev => ({ ...prev, createdVideo: null }))}
                             className="absolute top-3 right-3 p-1.5 bg-red-600/80 hover:bg-red-700 rounded-lg text-white transition-colors"
                           >
                             <Trash2 size={12} />
                           </button>
                         </div>
                       ) : formData.createdVideo instanceof File ? (
                         <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                           <span className="text-[10px] text-blue-400 font-bold truncate max-w-[200px]">{formData.createdVideo.name}</span>
                           <button type="button" onClick={() => setFormData(prev => ({ ...prev, createdVideo: null }))} className="text-blue-400"><X size={14} /></button>
                         </div>
                       ) : (
                         <div className="flex space-x-2 w-full">
                           <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                             <div className="flex flex-col items-center justify-center pt-2 pb-3">
                               <ImageIcon size={18} className="text-dim mb-1" />
                               <p className="text-[10px] text-dim font-bold">Video Gallery</p>
                             </div>
                             <input 
                               type="file" 
                               className="hidden" 
                               accept="video/*"
                               onChange={(e) => {
                                 const file = e.target.files[0];
                                 if (file && file.size <= 5 * 1024 * 1024) {
                                   setFormData(prev => ({ ...prev, createdVideo: file }));
                                 } else if (file) {
                                   showNotification('Video exceeds 5MB limit', 'error');
                                 }
                               }}
                             />
                           </label>
                           <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                             <div className="flex flex-col items-center justify-center pt-2 pb-3">
                               <Camera size={18} className="text-dim mb-1" />
                               <p className="text-[10px] text-dim font-bold">Record Video</p>
                             </div>
                             <input 
                               type="file" 
                               className="hidden" 
                               accept="video/*"
                               capture="environment"
                               onChange={(e) => {
                                 const file = e.target.files[0];
                                 if (file && file.size <= 5 * 1024 * 1024) {
                                   setFormData(prev => ({ ...prev, createdVideo: file }));
                                 } else if (file) {
                                   showNotification('Video exceeds 5MB limit', 'error');
                                 }
                               }}
                             />
                           </label>
                         </div>
                       )}
                     </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">

                  <div className="space-y-4">

                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Nature of Problem</label>
                      <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] resize-none bg-panel border-main" placeholder="Describe the technical failure..." />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                      <textarea name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] resize-none bg-panel border-main" placeholder="Repair steps..." />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Personnel & Execution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-main">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <Shield size={16} className="text-teal-500" />
                      <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Responsibility</h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setIsAddingStaff(!isAddingStaff)}
                      className="flex items-center space-x-2 px-3 py-1 bg-teal-500/10 text-teal-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-teal-500/20 transition-all"
                    >
                      <Plus size={12} />
                      <span>Quick Add Staff</span>
                    </button>
                  </div>

                  {isAddingStaff && (
                    <div className="flex flex-col space-y-2 animate-slide-down bg-panel p-4 rounded-2xl border border-teal-500/30">
                      <input 
                        autoFocus
                        type="text" 
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="glass-input w-full p-2 text-xs bg-panel border-main"
                        placeholder="Staff Name..."
                      />
                      <div className="flex space-x-2">
                        <input 
                          type="email" 
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="glass-input flex-1 p-2 text-xs bg-panel border-main"
                          placeholder="Email (Optional)..."
                        />
                        <button type="button" onClick={handleAddQuickStaff} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors">Save</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 p-4 bg-panel rounded-2xl border border-main min-h-[50px]">
                      {formData.assignedStaff.length === 0 ? (
                        <span className="text-[9px] text-dim italic opacity-50 uppercase tracking-widest">No staff assigned yet</span>
                      ) : (
                        formData.assignedStaff.map(id => {
                          const member = staff.find(s => (s.id || s._id) === id);
                          return (
                            <div key={id} className="flex items-center bg-teal-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-teal-500/20">
                              {member?.name || 'Staff'}
                              <button type="button" onClick={() => toggleStaffSelection(id)} className="ml-2 hover:opacity-70"><X size={12} /></button>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {staff.map(s => (
                        <div key={s.id || s._id} className="group/staff relative">
                          <button
                            type="button"
                            onClick={() => toggleStaffSelection(s.id || s._id)}
                            className={`w-full px-4 py-2.5 rounded-xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${
                              formData.assignedStaff.includes(s.id || s._id)
                                ? 'bg-teal-600 text-white border-teal-500'
                                : 'bg-panel text-secondary border-main hover:border-teal-500/30'
                            }`}
                          >
                            {s.name}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover/staff:opacity-100 transition-opacity">
                            <button 
                              type="button" 
                              onClick={(e) => handleEditStaff(e, s)}
                              className="p-1 hover:text-blue-400 bg-black/20 rounded backdrop-blur-sm"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => handleDeleteStaff(e, s.id || s._id)}
                              className="p-1 hover:text-red-400 bg-black/20 rounded backdrop-blur-sm"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center space-x-3">
                    <Clock size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Timeline & Status</h3>
                  </div>
                  
                  <div className="bg-panel p-6 rounded-[2.5rem] border border-main space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-secondary uppercase tracking-widest">Date Received</label>
                        <input type="date" name="receivedDate" value={formData.receivedDate || formData.createdDate || ''} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-secondary uppercase tracking-widest">Time Received / Logged</label>
                        <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main font-mono" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-secondary uppercase tracking-widest pl-2">Current Lifecycle State</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Open', 'In Progress', 'Completed'].map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            if (status === 'In Progress') {
                              setInProgressTicket(editingId ? currentTicket : formData);
                              setInProgressData({
                                date: new Date().toISOString().split('T')[0],
                                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                image: null
                              });
                              setShowInProgressModal(true);
                              return;
                            }
                            if (status === 'Completed') {
                              setCompletionTicket(editingId ? currentTicket : formData);
                              setCompletionData({
                                remark: '',
                                endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                date: new Date().toISOString().split('T')[0],
                                image: null
                              });
                              setShowCompletionModal(true);
                              return;
                            }
                            setFormData({...formData, status});
                          }}
                          className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            formData.status === status 
                              ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20' 
                              : 'bg-panel text-secondary border-main hover:bg-card'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    {/* Conditional workflow stage details inside edit modal */}
                    {formData.status === 'In Progress' && (
                      <div className="bg-panel p-4 rounded-2xl border border-main space-y-4 animate-slide-up mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-secondary uppercase">In Progress Date</label>
                            <input 
                              type="date" 
                              value={formData.inProgressDate} 
                              onChange={(e) => setFormData(prev => ({ ...prev, inProgressDate: e.target.value }))}
                              className="glass-input w-full p-2 text-xs bg-card border-main"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-secondary uppercase">In Progress Time</label>
                            <input 
                              type="time" 
                              value={formData.inProgressTime} 
                              onChange={(e) => setFormData(prev => ({ ...prev, inProgressTime: e.target.value }))}
                              className="glass-input w-full p-2 text-xs font-mono bg-card border-main"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-secondary uppercase mb-2">Staff On Site Image</label>
                          {formData.inProgressImage && typeof formData.inProgressImage === 'string' ? (
                            <div className="relative group rounded-xl overflow-hidden border border-main bg-panel p-2">
                              <img src={getImageUrl(formData.inProgressImage)} className="w-full h-24 object-cover rounded-lg" alt="On Site" />
                              <button 
                                type="button" 
                                onClick={() => setFormData(prev => ({ ...prev, inProgressImage: null }))}
                                className="absolute top-3 right-3 p-1.5 bg-red-600/80 hover:bg-red-700 rounded-lg text-white transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : formData.inProgressImage instanceof File ? (
                            <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                              <span className="text-[10px] text-blue-400 font-bold truncate max-w-[200px]">{formData.inProgressImage.name}</span>
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, inProgressImage: null }))} className="text-blue-400"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex space-x-2 w-full">
                              <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                  <ImageIcon size={18} className="text-dim mb-1" />
                                  <p className="text-[10px] text-dim font-bold">Gallery</p>
                                </div>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      try {
                                        const compressedFile = await compressImage(file, 50);
                                        setFormData(prev => ({ ...prev, inProgressImage: compressedFile }));
                                      } catch (err) {
                                        showNotification('Failed to process image', 'error');
                                      }
                                    }
                                  }}
                                />
                              </label>
                              <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                  <Camera size={18} className="text-dim mb-1" />
                                  <p className="text-[10px] text-dim font-bold">Camera</p>
                                </div>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  capture="environment"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      try {
                                        const compressedFile = await compressImage(file, 50);
                                        setFormData(prev => ({ ...prev, inProgressImage: compressedFile }));
                                      } catch (err) {
                                        showNotification('Failed to process image', 'error');
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {formData.status === 'Completed' && (
                      <div className="bg-panel p-4 rounded-2xl border border-main space-y-4 animate-slide-up mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[9px] font-bold text-secondary uppercase">Completion Date</label>
                            <input 
                              type="date" 
                              value={formData.completedDate} 
                              onChange={(e) => setFormData(prev => ({ ...prev, completedDate: e.target.value }))}
                              className="glass-input w-full p-2 text-xs bg-card border-main"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-secondary uppercase">Completion Time</label>
                            <input 
                              type="time" 
                              value={formData.completedTime} 
                              onChange={(e) => setFormData(prev => ({ ...prev, completedTime: e.target.value }))}
                              className="glass-input w-full p-2 text-xs font-mono bg-card border-main"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-secondary uppercase mb-2">Completed Image</label>
                          {formData.completedImage && typeof formData.completedImage === 'string' ? (
                            <div className="relative group rounded-xl overflow-hidden border border-main bg-panel p-2">
                              <img src={getImageUrl(formData.completedImage)} className="w-full h-24 object-cover rounded-lg" alt="Completed" />
                              <button 
                                type="button" 
                                onClick={() => setFormData(prev => ({ ...prev, completedImage: null }))}
                                className="absolute top-3 right-3 p-1.5 bg-red-600/80 hover:bg-red-700 rounded-lg text-white transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : formData.completedImage instanceof File ? (
                            <div className="mt-2 flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                              <span className="text-[10px] text-emerald-400 font-bold truncate max-w-[200px]">{formData.completedImage.name}</span>
                              <button type="button" onClick={() => setFormData(prev => ({ ...prev, completedImage: null }))} className="text-emerald-400"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex space-x-2 w-full">
                              <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                  <ImageIcon size={18} className="text-dim mb-1" />
                                  <p className="text-[10px] text-dim font-bold">Gallery</p>
                                </div>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      try {
                                        const compressedFile = await compressImage(file, 50);
                                        setFormData(prev => ({ ...prev, completedImage: compressedFile }));
                                      } catch (err) {
                                        showNotification('Failed to process image', 'error');
                                      }
                                    }
                                  }}
                                />
                              </label>
                              <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                  <Camera size={18} className="text-dim mb-1" />
                                  <p className="text-[10px] text-dim font-bold">Camera</p>
                                </div>
                                <input 
                                  type="file" 
                                  className="hidden" 
                                  accept="image/*"
                                  capture="environment"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      try {
                                        const compressedFile = await compressImage(file, 50);
                                        setFormData(prev => ({ ...prev, completedImage: compressedFile }));
                                      } catch (err) {
                                        showNotification('Failed to process image', 'error');
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center space-x-6 mt-10 pt-8 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black text-secondary hover:text-main uppercase tracking-[0.2em] transition-colors">Cancel</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="glass-button px-16 py-4"
                >
                  {submitting ? 'PROCESSING...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {showInProgressModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-xl border border-main shadow-2xl my-8 overflow-hidden">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <Clock className="text-orange-500" size={32} />
                <div>
                  <h3 className="text-2xl font-black text-main uppercase tracking-tight">Staff On Site</h3>
                  <p className="text-[10px] text-secondary mt-1 uppercase tracking-[0.3em] font-black">Transition to In Progress</p>
                </div>
              </div>
              <button onClick={() => setShowInProgressModal(false)} className="text-secondary hover:text-main p-2 hover:bg-panel rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">On Site Date</label>
                  <input 
                    type="date" 
                    value={inProgressData.date}
                    onChange={(e) => setInProgressData({...inProgressData, date: e.target.value})}
                    className="glass-input w-full p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">On Site Time</label>
                  <input 
                    type="time" 
                    value={inProgressData.time}
                    onChange={(e) => setInProgressData({...inProgressData, time: e.target.value})}
                    className="glass-input w-full p-3 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Staff On Site Image (Optional)</label>
                <div className="mt-2">
                  <div className="flex space-x-2 w-full">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Gallery</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const compressedFile = await compressImage(file, 50);
                              setInProgressData({...inProgressData, image: compressedFile});
                            } catch (err) {
                              showNotification('Failed to process image', 'error');
                            }
                          }
                        }}
                      />
                    </label>
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Camera</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const compressedFile = await compressImage(file, 50);
                              setInProgressData({...inProgressData, image: compressedFile});
                            } catch (err) {
                              showNotification('Failed to process image', 'error');
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  {inProgressData.image && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <span className="text-[10px] text-blue-400 font-bold truncate">{inProgressData.image.name}</span>
                      <button onClick={() => setInProgressData({...inProgressData, image: null})} className="text-blue-400"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Staff On Site Video (Optional)</label>
                <div className="mt-2">
                  <div className="flex space-x-2 w-full">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Video Gallery</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 5 * 1024 * 1024) {
                            setInProgressData({...inProgressData, video: file});
                          } else if (file) {
                            showNotification('Video exceeds 5MB limit', 'error');
                          }
                        }}
                      />
                    </label>
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Record Video</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 5 * 1024 * 1024) {
                            setInProgressData({...inProgressData, video: file});
                          } else if (file) {
                            showNotification('Video exceeds 5MB limit', 'error');
                          }
                        }}
                      />
                    </label>
                  </div>
                  {inProgressData.video && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <span className="text-[10px] text-blue-400 font-bold truncate">{inProgressData.video.name}</span>
                      <button onClick={() => setInProgressData({...inProgressData, video: null})} className="text-blue-400"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-4">
                <button onClick={() => setShowInProgressModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
                <button 
                  disabled={submitting}
                  onClick={async () => {
                    try {
                      setSubmitting(true);
                      const id = inProgressTicket.id || inProgressTicket._id;
                      
                      const formDataToSend = new FormData();
                      formDataToSend.append('status', 'In Progress');
                      formDataToSend.append('inProgressDate', inProgressData.date);
                      formDataToSend.append('inProgressTime', inProgressData.time);
                      
                      if (inProgressData.image) {
                        formDataToSend.append('inProgressImage', inProgressData.image);
                      }
                      if (inProgressData.video) {
                        formDataToSend.append('inProgressVideo', inProgressData.video);
                      }

                      await api.patch(`/tickets/${id}/`, formDataToSend);

                      showNotification('Ticket status changed to In Progress', 'success');
                      setShowInProgressModal(false);
                      if (showModal) setShowModal(false);
                      fetchData();
                    } catch (err) {
                      console.error(err);
                      showNotification('Failed to update ticket status', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg uppercase"
                >
                  {submitting ? 'PROCESSING...' : 'START WORK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-xl border border-main shadow-2xl my-8 overflow-hidden">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <CheckCircle className="text-emerald-500" size={32} />
                <div>
                  <h3 className="text-2xl font-black text-main uppercase tracking-tight">Finalize Maintenance</h3>
                  <p className="text-[10px] text-secondary mt-1 uppercase tracking-[0.3em] font-black">Service Completion Protocol</p>
                </div>
              </div>
              <button onClick={() => setShowCompletionModal(false)} className="text-secondary hover:text-main p-2 hover:bg-panel rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Completion Date</label>
                  <input 
                    type="date" 
                    value={completionData.date}
                    onChange={(e) => setCompletionData({...completionData, date: e.target.value})}
                    className="glass-input w-full p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Completion Time</label>
                  <input 
                    type="time" 
                    value={completionData.endTime}
                    onChange={(e) => setCompletionData({...completionData, endTime: e.target.value})}
                    className="glass-input w-full p-3 text-sm font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Resolution Remark</label>
                <textarea 
                  required
                  value={completionData.remark}
                  onChange={(e) => setCompletionData({...completionData, remark: e.target.value})}
                  placeholder="Describe the final action taken..."
                  className="glass-input w-full p-4 text-sm min-h-[120px] resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Service Image (Completed Image)</label>
                <div className="mt-2">
                  <div className="flex space-x-2 w-full">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Gallery</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const compressedFile = await compressImage(file, 50);
                              setCompletionData({...completionData, image: compressedFile});
                            } catch (err) {
                              showNotification('Failed to process image', 'error');
                            }
                          }
                        }}
                      />
                    </label>
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Camera</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const compressedFile = await compressImage(file, 50);
                              setCompletionData({...completionData, image: compressedFile});
                            } catch (err) {
                              showNotification('Failed to process image', 'error');
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  {completionData.image && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <span className="text-[10px] text-emerald-400 font-bold truncate">{completionData.image.name}</span>
                      <button onClick={() => setCompletionData({...completionData, image: null})} className="text-emerald-400"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Service Video (Optional)</label>
                <div className="mt-2">
                  <div className="flex space-x-2 w-full">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImageIcon size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Video Gallery</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 5 * 1024 * 1024) {
                            setCompletionData({...completionData, video: file});
                          } else if (file) {
                            showNotification('Video exceeds 5MB limit', 'error');
                          }
                        }}
                      />
                    </label>
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Camera size={24} className="text-dim mb-2" />
                        <p className="mb-2 text-xs text-dim font-bold">Record Video</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="video/*"
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 5 * 1024 * 1024) {
                            setCompletionData({...completionData, video: file});
                          } else if (file) {
                            showNotification('Video exceeds 5MB limit', 'error');
                          }
                        }}
                      />
                    </label>
                  </div>
                  {completionData.video && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <span className="text-[10px] text-emerald-400 font-bold truncate">{completionData.video.name}</span>
                      <button onClick={() => setCompletionData({...completionData, video: null})} className="text-emerald-400"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-4">
                <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
                <button 
                  disabled={submitting}
                  onClick={async () => {
                    if (!completionData.remark.trim()) {
                      showNotification('Please provide a completion remark', 'error');
                      return;
                    }
                    try {
                      setSubmitting(true);
                      const id = completionTicket.id || completionTicket._id;
                      
                      const formDataToSend = new FormData();
                      formDataToSend.append('status', 'Completed');
                      formDataToSend.append('completedDate', completionData.date);
                      formDataToSend.append('completedTime', completionData.endTime);
                      formDataToSend.append('actionTaken', completionData.remark);
                      formDataToSend.append('endTime', completionData.endTime);
                      formDataToSend.append('totalTime', calculateTotalTime(completionTicket.receivedTime || completionTicket.createdTime || '09:00', completionData.endTime));
                      
                      if (completionData.image) {
                        formDataToSend.append('completedImage', completionData.image);
                      }
                      if (completionData.video) {
                        formDataToSend.append('completedVideo', completionData.video);
                      }

                      await api.patch(`/tickets/${id}/`, formDataToSend);

                      showNotification('Ticket status changed to Completed', 'success');
                      setShowCompletionModal(false);
                      if (showModal) setShowModal(false);
                      fetchData();
                    } catch (err) {
                      console.error(err);
                      showNotification('Failed to complete ticket', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg uppercase"
                >
                  {submitting ? 'PROCESSING...' : 'COMPLETE TICKET'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
