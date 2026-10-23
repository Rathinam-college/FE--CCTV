import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, CheckCircle, Shield, ChevronLeft, ChevronRight, Printer, AlertCircle, Activity
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useSiteStore } from '../store/siteStore';
import { useNavigate } from 'react-router-dom';
import ComboInput from '../components/ComboInput';
import { exportMonthlyPPT } from '../utils/pptExport';

export default function Upgrades() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('registry'); // 'registry' or 'report'

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

  const parseMetadata = (remarks) => {
    try {
      const parsed = JSON.parse(remarks);
      if (parsed && typeof parsed === 'object') return parsed;
      throw new Error("Not an object");
    } catch (e) {
      return {
        location: '',
        category: 'Upgrade',
        actionTaken: '',
        instructionBy: '',
        receivedTime: '',
        endTime: '',
        totalTime: ''
      };
    }
  };
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [reportCurrentPage, setReportCurrentPage] = useState(1);
  const [reportItemsPerPage, setReportItemsPerPage] = useState(10);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateSortOrder, setDateSortOrder] = useState('desc');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [staff, setStaff] = useState([]);
  const { allLocations, fetchAllLocations, divisions, fetchDivisions } = useSiteStore();
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  const isUpgradeTicket = (t) => {
    if (!t) return false;
    let meta = {};
    try {
      meta = typeof t.remarks === 'string' && t.remarks.startsWith('{') ? JSON.parse(t.remarks) : (typeof t.remarks === 'object' && t.remarks ? t.remarks : {});
    } catch(e) {}
    const cat = String(t.category || meta.category || '').toLowerCase();
    const desc = String(t.issueDescription || '').toLowerCase();
    return cat.includes('upgrade') || desc.includes('upgrade') || meta.isUpgrade === true || meta.category === 'Upgrade';
  };

  const getTicketSortTimestamp = (ticket) => {
    if (!ticket) return 0;
    let meta = {};
    try {
      if (typeof ticket.remarks === 'string' && ticket.remarks.startsWith('{')) {
        meta = JSON.parse(ticket.remarks);
      } else if (typeof ticket.remarks === 'object' && ticket.remarks) {
        meta = ticket.remarks;
      }
    } catch (e) {}

    const dateStr = ticket.operationDate || meta.manualDate || ticket.receivedDate || ticket.createdDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : '');
    let timeStr = ticket.receivedTime || meta.receivedTime || ticket.createdTime || '';
    if (!timeStr && ticket.createdAt && String(ticket.createdAt).includes('T')) {
      timeStr = String(ticket.createdAt).split('T')[1]?.substring(0, 5) || '';
    }

    let hour = 0;
    let minute = 0;
    if (timeStr) {
      const match24 = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
      if (match24) {
        hour = parseInt(match24[1], 10);
        minute = parseInt(match24[2], 10);
      }
    }

    if (!dateStr) return (ticket.id || 0);

    const dateParts = String(dateStr).split('-');
    if (dateParts.length === 3) {
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10) - 1;
      const d = parseInt(dateParts[2], 10);
      const dt = new Date(y, m, d, hour, minute, 0, 0);
      const timeMs = dt.getTime();
      if (!isNaN(timeMs)) return timeMs;
    }

    const fallback = new Date(dateStr).getTime();
    return isNaN(fallback) ? (ticket.id || 0) : fallback;
  };

  // Filter for upgrades category or metadata
  const upgradeTickets = useMemo(() => {
    return (Array.isArray(tickets) ? tickets : []).filter(t => isUpgradeTicket(t));
  }, [tickets]);

  const baseFilteredTickets = useMemo(() => {
    return upgradeTickets.filter(ticket => {
      const meta = parseMetadata(ticket.remarks);
      const ticketDate = ticket.operationDate || meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : '');
      
      if (startMonth || endMonth) {
        if (!ticketDate) return false;
        const tMonth = String(ticketDate).substring(0, 7); // 'YYYY-MM'
        const inRange = (!startMonth || tMonth >= startMonth) && (!endMonth || tMonth <= endMonth);
        const isOldUnresolved = startMonth && tMonth < startMonth && ticket.status !== 'Completed';
        if (!inRange && !isOldUnresolved) return false;
      }
      
      const searchStr = `${ticket.issueDescription} ${ticket.location || meta.location || ''} ${ticket.divisionName || ''} ${ticket.block || ''}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;
      
      return true;
    });
  }, [upgradeTickets, startMonth, endMonth, searchQuery]);

  const filteredTickets = useMemo(() => {
    const list = baseFilteredTickets.filter(ticket => {
      if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      const timeA = getTicketSortTimestamp(a);
      const timeB = getTicketSortTimestamp(b);
      if (timeA !== timeB) {
        return dateSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const idA = a.id || 0;
      const idB = b.id || 0;
      return dateSortOrder === 'asc' ? idA - idB : idB - idA;
    });
  }, [baseFilteredTickets, statusFilter, dateSortOrder]);

  const summaryStats = useMemo(() => ({
    total: baseFilteredTickets.length,
    open: baseFilteredTickets.filter(t => t.status === 'Open').length,
    inProgress: baseFilteredTickets.filter(t => t.status === 'In Progress').length,
    completed: baseFilteredTickets.filter(t => t.status === 'Completed').length
  }), [baseFilteredTickets]);

  const chartData = useMemo(() => [
    { name: 'Open', value: summaryStats.open, color: '#f43f5e' },
    { name: 'In Progress', value: summaryStats.inProgress, color: '#f59e0b' },
    { name: 'Completed', value: summaryStats.completed, color: '#10b981' }
  ].filter(d => d.value > 0), [summaryStats]);

  const divisionStats = useMemo(() => {
    const divDataMap = {};
    filteredTickets.forEach(t => {
      const name = t.divisionName || 'UNASSIGNED';
      divDataMap[name] = (divDataMap[name] || 0) + 1;
    });
    return Object.entries(divDataMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredTickets]);

  const blockStats = useMemo(() => {
    const blockDataMap = {};
    filteredTickets.forEach(t => {
      const name = t.block || 'UNASSIGNED';
      blockDataMap[name] = (blockDataMap[name] || 0) + 1;
    });
    return Object.entries(blockDataMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredTickets]);

  const uniqueAssignedStaffCount = useMemo(() => {
    const staffSet = new Set();
    filteredTickets.forEach(t => {
      if (t.assignedTo) {
        const name = typeof t.assignedTo === 'object' ? t.assignedTo.name : t.assignedTo;
        if (name) staffSet.add(name);
      }
      if (t.assignedStaff && Array.isArray(t.assignedStaff)) {
        t.assignedStaff.forEach(s => {
          const name = typeof s === 'object' ? s.name : s;
          if (name) staffSet.add(name);
        });
      }
    });
    return staffSet.size;
  }, [filteredTickets]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    assignedTo: '',
    location: '',
    category: 'Upgrade',
    issueDescription: '',
    instructionBy: '',
    assignedStaff: [],
    receivedTime: '',
    endTime: '',
    status: 'Open',
    raisedBy: '',
    raisedByName: ''
  });

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    if (divisions) divisions.forEach(o => o.name && colleges.add(o.name.toUpperCase()));
    return Array.from(colleges).sort();
  }, [divisions]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    const targetDivision = String(formData.divisionName || '').trim().toUpperCase();
    
    tickets.forEach(t => {
      const div = String(t.divisionName || '').trim().toUpperCase();
      const matchDiv = !targetDivision || div === targetDivision;
      if (matchDiv && t.block) {
        blocks.add(t.block.toUpperCase().trim());
      }
    });

    allLocations.forEach(loc => {
      const div = String(loc.divisionName || '').trim().toUpperCase();
      const matchDiv = !targetDivision || div === targetDivision;
      if (matchDiv && loc.block) {
        blocks.add(loc.block.toUpperCase().trim());
      }
    });

    if (blocks.size === 0) {
      tickets.forEach(t => {
        if (t.block) blocks.add(t.block.toUpperCase().trim());
      });
      allLocations.forEach(loc => {
        if (loc.block) blocks.add(loc.block.toUpperCase().trim());
      });
    }

    return Array.from(blocks).filter(Boolean).sort();
  }, [tickets, allLocations, formData.divisionName]);

  useEffect(() => {
    fetchData();
    fetchAllLocations();
    fetchDivisions();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/')
      ]);
      const allTickets = Array.isArray(ticketRes.data) ? ticketRes.data : (ticketRes.data?.results || []);
      const sortedTickets = [...allTickets].sort((a, b) => (b.id || 0) - (a.id || 0));
      setTickets(sortedTickets);
      const fetchedUsers = Array.isArray(userRes.data) ? userRes.data : (userRes.data?.results || []);
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = async (e, s) => {
    e.stopPropagation();
    const newName = prompt('Enter new name for staff member:', s.name);
    if (!newName) return;
    const newEmail = prompt('Enter email address:', s.email || '');
    if (newName === s.name && newEmail === (s.email || '')) return;
    try {
      const res = await api.patch(`/users/${s.id || s._id}/`, { name: newName.trim(), email: newEmail ? newEmail.trim() : s.email });
      const updatedUsers = users.map(item => (item.id || item._id) === (s.id || s._id) ? { ...item, ...res.data } : item);
      setUsers(updatedUsers);
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
        const updatedUsers = users.filter(s => (s.id || s._id) !== id);
        setUsers(updatedUsers);
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
      
      const newUsersList = [...users, res.data];
      setUsers(newUsersList);
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
    const { name, value } = e.target;
    const shouldUppercase = typeof value === 'string' && !['date', 'status', 'receivedTime', 'endTime', 'totalTime', 'raisedByName', 'instructionBy'].includes(name);
    const finalValue = shouldUppercase ? value.toUpperCase() : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: finalValue };
      if (name === 'divisionName') {
        newData.block = '';
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
      const computedTotal = calculateTotalTime(formData.receivedTime, formData.endTime) || formData.totalTime || '';
      const payload = {
        issueDescription: formData.issueDescription,
        status: formData.status,
        assignedTo: formData.assignedTo || null,
        operationDate: formData.date || new Date().toISOString().split('T')[0],
        divisionName: formData.divisionName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.divisionName || ''} | ${formData.block || ''} | ${formData.floor || ''} | ${formData.room || ''}`.trim(),
        category: 'Upgrade',
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        assignedStaff: formData.assignedStaff || [],
        receivedDate: formData.date || new Date().toISOString().split('T')[0],
        receivedTime: formData.receivedTime || '',
        endTime: formData.endTime || '',
        totalTime: computedTotal,
        remarks: JSON.stringify({ 
          category: 'Upgrade', 
          isUpgrade: true, 
          receivedTime: formData.receivedTime, 
          endTime: formData.endTime, 
          totalTime: computedTotal 
        }),
        raisedBy: user?._id || user?.id,
        raisedByName: formData.raisedByName || '',
      };

      if (editingId) {
        await api.put(`/tickets/${editingId}/`, payload);
        showNotification('Upgrade record updated');
      } else {
        await api.post('/tickets/', payload);
        showNotification('New upgrade registered');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      const serverMsg = err.response?.data ? (typeof err.response.data === 'object' ? JSON.stringify(err.response.data) : err.response.data) : '';
      showNotification(`Failed to save upgrade: ${serverMsg || err.message}`, 'error');
      console.error('Error saving upgrade record:', err);
    } finally {
      setSubmitting(false);
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
      category: 'Upgrade',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      assignedTo: '',
      assignedStaff: [],
      receivedTime: '',
      endTime: '',
      totalTime: '',
      status: 'Open',
      raisedBy: user?._id || user?.id || '',
      raisedByName: ''
    });
    setEditingId(null);
  };

  const handleEdit = (ticket) => {
    const rawDate = ticket.operationDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]);
    const computedTotal = ticket.totalTime || calculateTotalTime(ticket.receivedTime, ticket.endTime);
    setFormData({
      date: rawDate,
      divisionName: ticket.divisionName || '',
      block: ticket.block || '',
      floor: ticket.floor || '',
      room: ticket.room || '',
      location: ticket.location || '',
      category: 'Upgrade',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || '',
      instructionBy: ticket.instructionBy || '',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo || '',
      assignedStaff: (() => {
        const respId = ticket.assignedTo?.id || ticket.assignedTo || '';
        const staffIds = ticket.assignedStaff ? ticket.assignedStaff.map(s => s.id || s._id || s) : [];
        if (respId && !staffIds.includes(respId)) {
          staffIds.push(respId);
        }
        return staffIds;
      })(),
      receivedTime: ticket.receivedTime || '',
      endTime: ticket.endTime || '',
      totalTime: computedTotal || '',
      status: ticket.status || 'Open',
      raisedBy: ticket.raisedBy?.id || ticket.raisedBy?._id || (typeof ticket.raisedBy !== 'object' ? ticket.raisedBy : '') || '',
      raisedByName: ticket.raisedByName || ''
    });
    setEditingId(ticket.id || ticket._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/tickets/${id}/`);
        showNotification('Record deleted');
        fetchData();
      } catch (err) {
        showNotification('Failed to delete', 'error');
      }
    });
  };



  const handleDownload = () => {
    if (filteredTickets.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'S.No', 'Date', 'Division Name', 'Block', 'Floor', 'Room', 'Location',
      'Issue Description', 'Action Taken', 'Instruction By', 'Assigned To', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredTickets.map((t, index) => {
      const assignedId = t.assignedTo?.id || t.assignedTo?._id || t.assignedTo;
      // Depending on whether you have a users list in this component, you might not resolve the name
      // If you don't have users fetched, just output the raw ID or name if populated
      const assignedUser = typeof t.assignedTo === 'object' && t.assignedTo?.name ? t.assignedTo.name : assignedId;

      return [
        index + 1,
        escapeCSV(` ${t.operationDate || (t.createdAt ? t.createdAt.split('T')[0] : 'N/A')}`.trim()),
        escapeCSV(t.divisionName || ''),
        escapeCSV(t.block || ''),
        escapeCSV(t.floor || ''),
        escapeCSV(t.room || ''),
        escapeCSV(t.location || ''),
        escapeCSV(t.issueDescription || ''),
        escapeCSV(t.actionTaken || ''),
        escapeCSV(t.instructionBy || ''),
        escapeCSV(assignedUser || 'Unassigned'),
        escapeCSV(t.status || 'Open')
      ];
    });

    const csvContent = "\uFEFF" + [ 
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Upgrades_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Upgrades exported successfully');
  };

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Upgrades Export</title>
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
          <h1>Upgrades Report</h1>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Location</th>
                <th>Description</th>
                <th>Action Taken</th>
                <th>Responsibility</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTickets.map((ticket, idx) => {
                let staffNames = 'Unassigned';
                if (Array.isArray(ticket.assignedStaff) && ticket.assignedStaff.length > 0) {
                  staffNames = ticket.assignedStaff.map(s => s.name || s.username).filter(Boolean).join(', ');
                } else {
                  const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
                  const assignedUser = ticket.assignedTo && typeof ticket.assignedTo === 'object'
                    ? ticket.assignedTo
                    : (Array.isArray(users) ? users.find(u => (u.id || u._id) === assignedId) : null);
                  if (assignedUser?.name || assignedUser?.username) {
                    staffNames = assignedUser.name || assignedUser.username;
                  } else if (ticket.raisedBy && typeof ticket.raisedBy === 'object') {
                    staffNames = ticket.raisedBy.name || ticket.raisedBy.username || 'Unassigned';
                  }
                }

                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${ticket.operationDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')}</td>
                  <td>${ticket.divisionName || 'N/A'} - ${ticket.block || ''}</td>
                  <td>${ticket.issueDescription || 'N/A'}</td>
                  <td>${ticket.actionTaken || 'Pending'}</td>
                  <td>${staffNames}</td>
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

  const downloadStaffPDF = (staffTarget = 'ALL') => {
    const isUpgradeTicket = (t) => {
      let meta = {};
      try {
        meta = typeof t.remarks === 'string' && t.remarks.startsWith('{') ? JSON.parse(t.remarks) : {};
      } catch(e) {}
      const cat = String(t.category || meta.category || '').toLowerCase();
      const desc = String(t.issueDescription || '').toLowerCase();
      return cat.includes('upgrade') || desc.includes('upgrade') || meta.isUpgrade === true;
    };

    const getTicketAssignees = (t) => {
      let assignees = [];
      if (t.assignedStaff && Array.isArray(t.assignedStaff) && t.assignedStaff.length > 0) {
        assignees = t.assignedStaff.map(s => s.name || s.username || s).filter(Boolean);
      }
      if (assignees.length === 0) {
        const rawAssign = t.assignedTo?.name || t.assignedTo?.username || t.assignedTo || 'Unassigned';
        if (typeof rawAssign === 'string') {
          assignees = rawAssign.split(/[,&]/).map(s => s.trim()).filter(Boolean);
        } else {
          assignees = ['Unassigned'];
        }
      }
      return assignees.length > 0 ? assignees : ['Unassigned'];
    };

    const getTicketWorkMinutes = (t) => {
      if (t.totalTime && typeof t.totalTime === 'string') {
        const hMatch = t.totalTime.match(/(\d+)\s*h/i);
        const mMatch = t.totalTime.match(/(\d+)\s*m/i);
        if (hMatch || mMatch) {
          const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
          const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
          const total = hours * 60 + mins;
          if (total > 0) return total;
        }
      }

      if (t.receivedTime && t.endTime) {
        const [sH, sM] = String(t.receivedTime).split(':').map(Number);
        const [eH, eM] = String(t.endTime).split(':').map(Number);
        if (!isNaN(sH) && !isNaN(sM) && !isNaN(eH) && !isNaN(eM)) {
          let diff = (eH * 60 + eM) - (sH * 60 + sM);
          if (diff < 0) diff += 24 * 60;
          if (diff > 0) return diff;
        }
      }

      const sLow = String(t.status || '').toLowerCase();
      if ((sLow.includes('completed') || sLow.includes('finished')) && t.createdAt && t.updatedAt) {
        const s = new Date(t.createdAt);
        const e = new Date(t.updatedAt);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          const diff = Math.max(0, Math.floor((e - s) / 60000));
          if (diff > 0) return diff;
        }
      }

      return 0;
    };

    const formatTimeMins = (totalMins) => {
      if (!totalMins || totalMins <= 0) return '0m';
      const t = Math.floor(totalMins);
      if (t < 60) return `${t}m`;
      const h = Math.floor(t / 60);
      const m = t % 60;
      return `${h}h ${m}m`;
    };

    const sourceTickets = (tickets || []).filter(t => {
      const ticketDate = t.operationDate || (t.createdAt ? String(t.createdAt).split('T')[0] : '');
      if (startMonth || endMonth) {
        if (!ticketDate) return false;
        const tMonth = String(ticketDate).substring(0, 7);
        const inRange = (!startMonth || tMonth >= startMonth) && (!endMonth || tMonth <= endMonth);
        const isOldUnresolved = startMonth && tMonth < startMonth && t.status !== 'Completed';
        if (!inRange && !isOldUnresolved) return false;
      }
      if (staffTarget === 'ALL') return true;
      const assignees = getTicketAssignees(t);
      return assignees.some(a => a.toUpperCase() === staffTarget.toUpperCase());
    });

    const techMap = {};
    sourceTickets.forEach(t => {
      const assignees = getTicketAssignees(t);
      const isUp = isUpgradeTicket(t);
      const mins = getTicketWorkMinutes(t);
      const shareMins = mins > 0 ? mins / assignees.length : 0;
      const sLow = String(t.status || 'Open').toLowerCase();
      const normStatus = (sLow.includes('completed') || sLow.includes('finished')) ? 'Completed' : (sLow.includes('progress') ? 'In Progress' : 'Open');

      assignees.forEach(name => {
        if (staffTarget !== 'ALL' && name.toUpperCase() !== staffTarget.toUpperCase()) return;
        if (!techMap[name]) {
          techMap[name] = {
            name,
            tickets: [],
            upgrades: [],
            openCount: 0,
            inProgressCount: 0,
            completedCount: 0,
            ticketsTime: 0,
            upgradesTime: 0,
            totalTime: 0
          };
        }

        if (isUp) {
          techMap[name].upgrades.push(t);
          techMap[name].upgradesTime += shareMins;
        } else {
          techMap[name].tickets.push(t);
          techMap[name].ticketsTime += shareMins;
        }

        if (normStatus === 'Completed') techMap[name].completedCount++;
        else if (normStatus === 'In Progress') techMap[name].inProgressCount++;
        else techMap[name].openCount++;

        techMap[name].totalTime += shareMins;
      });
    });

    const technicianList = Object.values(techMap).sort((a, b) => {
      const sumA = a.tickets.length + a.upgrades.length;
      const sumB = b.tickets.length + b.upgrades.length;
      return sumB - sumA;
    });

    let totalAllTickets = 0;
    let totalAllUpgrades = 0;
    let totalAllOpen = 0;
    let totalAllInProgress = 0;
    let totalAllCompleted = 0;
    let totalAllTimeMins = 0;

    technicianList.forEach(tech => {
      totalAllTickets += tech.tickets.length;
      totalAllUpgrades += tech.upgrades.length;
      totalAllOpen += tech.openCount;
      totalAllInProgress += tech.inProgressCount;
      totalAllCompleted += tech.completedCount;
      totalAllTimeMins += tech.totalTime;
    });

    const totalAllWork = totalAllTickets + totalAllUpgrades;
    const overallRate = totalAllWork > 0 ? ((totalAllCompleted / totalAllWork) * 100).toFixed(0) : 0;
    const overallTimeStr = formatTimeMins(totalAllTimeMins);

    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Technician Load & Productivity Comparison Report - ${staffTarget}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 25px; color: #0f172a; line-height: 1.4; background: #ffffff; margin: 0; }
            .header-banner { border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header-title h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; font-weight: 900; }
            .header-title h2 { margin: 4px 0 0 0; font-size: 13px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
            .header-meta { text-align: right; font-size: 10px; color: #64748b; font-weight: 600; }
            
            .overview-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 25px; }
            .overview-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 10px; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
            .matrix-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
            .matrix-table th, .matrix-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; }
            .matrix-table th { background-color: #f1f5f9; font-weight: 800; text-transform: uppercase; color: #334155; }
            .matrix-table td.tech-name { text-align: left; font-weight: 800; color: #0f172a; }
            .matrix-table tr.total-row { background-color: #e2e8f0; font-weight: 900; }
            
            .tech-block { border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 30px; background: #ffffff; page-break-inside: avoid; }
            .tech-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px; }
            .tech-profile { display: flex; align-items: center; gap: 10px; }
            .tech-avatar { width: 32px; height: 32px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; }
            .tech-name-large { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; }
            .tech-pill { display: inline-block; padding: 3px 8px; background: #e0f2fe; color: #0369a1; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; }

            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
            .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; text-align: center; }
            .kpi-label { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
            .kpi-val { font-size: 15px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            .val-tickets { color: #0284c7; }
            .val-upgrades { color: #9333ea; }
            .val-completed { color: #16a34a; }
            .val-progress { color: #d97706; }
            .val-open { color: #e11d48; }

            .section-subhead { font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 16px 0 8px 0; display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 6px; }
            .subhead-tickets { background: #e0f2fe; color: #0369a1; border-left: 4px solid #0284c7; }
            .subhead-upgrades { background: #f3e8ff; color: #7e22ce; border-left: 4px solid #9333ea; }

            .data-table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 12px; }
            .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
            .data-table th { background-color: #f8fafc; font-weight: 800; text-transform: uppercase; color: #475569; font-size: 8.5px; }
            .data-table tr:nth-child(even) { background-color: #fafafa; }
            
            .badge { padding: 2px 6px; border-radius: 8px; font-size: 8px; font-weight: 800; text-transform: uppercase; display: inline-block; }
            .badge-open { background-color: #ffe4e6; color: #be123c; border: 1px solid #fda4af; }
            .badge-progress { background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
            .badge-completed { background-color: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .time-tag { font-family: monospace; font-weight: 700; font-size: 9px; }

            .footer-note { margin-top: 30px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }

            @media print {
              body { padding: 10px; font-size: 9px; }
              .tech-block { page-break-inside: avoid; margin-bottom: 20px; }
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div class="header-title">
              <h1>Rathinam Group of Institutions</h1>
              <h2>Technician Load, Productivity & Work Comparison Report</h2>
            </div>
            <div class="header-meta">
              <div>Target: <strong>${staffTarget === 'ALL' ? 'ALL TECHNICIANS' : staffTarget}</strong></div>
              <div>Generated: ${new Date().toLocaleString()}</div>
              <div>Period: ${startMonth || 'ALL'} to ${endMonth || 'ALL'}</div>
            </div>
          </div>

          <div class="overview-card">
            <div class="overview-title">
              <span>Executive Work Comparison Matrix (${technicianList.length} Technicians)</span>
              <span>Total Work Logged: <strong>${totalAllWork} Tasks</strong> &bull; Total Time: <strong>${overallTimeStr}</strong></span>
            </div>
            <table class="matrix-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Technician</th>
                  <th style="color: #0284c7;">Regular Tickets</th>
                  <th style="color: #0284c7;">Ticket Time</th>
                  <th style="color: #9333ea;">Upgrades</th>
                  <th style="color: #9333ea;">Upgrade Time</th>
                  <th style="color: #e11d48;">Open</th>
                  <th style="color: #d97706;">In Progress</th>
                  <th style="color: #16a34a;">Completed</th>
                  <th>Total Assigned</th>
                  <th>Completion Rate</th>
                  <th>Total Work Time</th>
                </tr>
              </thead>
              <tbody>
                ${technicianList.length === 0 ? `
                  <tr><td colspan="11" style="padding: 15px; color: #94a3b8;">No technician records found matching current filters.</td></tr>
                ` : technicianList.map(tech => {
                  const techTotal = tech.tickets.length + tech.upgrades.length;
                  const techRate = techTotal > 0 ? ((tech.completedCount / techTotal) * 100).toFixed(0) : 0;
                  return `
                    <tr>
                      <td class="tech-name">${tech.name}</td>
                      <td style="font-weight: 800; color: #0284c7;">${tech.tickets.length}</td>
                      <td class="time-tag">${formatTimeMins(tech.ticketsTime)}</td>
                      <td style="font-weight: 800; color: #9333ea;">${tech.upgrades.length}</td>
                      <td class="time-tag">${formatTimeMins(tech.upgradesTime)}</td>
                      <td style="color: #e11d48; font-weight: 700;">${tech.openCount}</td>
                      <td style="color: #d97706; font-weight: 700;">${tech.inProgressCount}</td>
                      <td style="color: #16a34a; font-weight: 700;">${tech.completedCount}</td>
                      <td style="font-weight: 900;">${techTotal}</td>
                      <td><strong>${techRate}%</strong></td>
                      <td class="time-tag" style="font-weight: 900; color: #7e22ce;">${formatTimeMins(tech.totalTime)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr class="total-row">
                  <td style="text-align: left;">OVERALL TOTAL</td>
                  <td style="color: #0284c7;">${totalAllTickets}</td>
                  <td>${formatTimeMins(technicianList.reduce((acc, t) => acc + t.ticketsTime, 0))}</td>
                  <td style="color: #9333ea;">${totalAllUpgrades}</td>
                  <td>${formatTimeMins(technicianList.reduce((acc, t) => acc + t.upgradesTime, 0))}</td>
                  <td style="color: #e11d48;">${totalAllOpen}</td>
                  <td style="color: #d97706;">${totalAllInProgress}</td>
                  <td style="color: #16a34a;">${totalAllCompleted}</td>
                  <td>${totalAllWork}</td>
                  <td>${overallRate}%</td>
                  <td style="color: #7e22ce;">${overallTimeStr}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${technicianList.map((tech, techIdx) => {
            const techTotalAssigned = tech.tickets.length + tech.upgrades.length;
            const techRate = techTotalAssigned > 0 ? ((tech.completedCount / techTotalAssigned) * 100).toFixed(0) : 0;
            const techAvgMins = tech.completedCount > 0 ? tech.totalTime / tech.completedCount : 0;

            return `
              <div class="tech-block ${techIdx > 0 && staffTarget === 'ALL' ? 'page-break' : ''}">
                <div class="tech-header">
                  <div class="tech-profile">
                    <div class="tech-avatar">${tech.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <h3 class="tech-name-large">${tech.name}</h3>
                      <span class="tech-pill">Technician Productivity Profile</span>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Completion Rate: <span style="color: #0284c7;">${techRate}%</span></div>
                    <div style="font-size: 10px; font-weight: 700; color: #64748b;">Total Work Time: <span style="color: #7e22ce;" class="time-tag">${formatTimeMins(tech.totalTime)}</span></div>
                  </div>
                </div>

                <div class="kpi-grid">
                  <div class="kpi-box">
                    <div class="kpi-label">Total Assigned</div>
                    <div class="kpi-val">${techTotalAssigned}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">Regular Tickets</div>
                    <div class="kpi-val val-tickets">${tech.tickets.length} <span style="font-size: 10px; font-weight: normal;">(${formatTimeMins(tech.ticketsTime)})</span></div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">CCTV Upgrades</div>
                    <div class="kpi-val val-upgrades">${tech.upgrades.length} <span style="font-size: 10px; font-weight: normal;">(${formatTimeMins(tech.upgradesTime)})</span></div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">Completed</div>
                    <div class="kpi-val val-completed">${tech.completedCount}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">In Progress</div>
                    <div class="kpi-val val-progress">${tech.inProgressCount}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">Open Tasks</div>
                    <div class="kpi-val val-open">${tech.openCount}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">Avg Time / Task</div>
                    <div class="kpi-val">${formatTimeMins(techAvgMins)}</div>
                  </div>
                  <div class="kpi-box">
                    <div class="kpi-label">Total Logged Time</div>
                    <div class="kpi-val" style="color: #7e22ce;">${formatTimeMins(tech.totalTime)}</div>
                  </div>
                </div>

                <!-- Section 1: Regular Maintenance & Service Tickets -->
                <div class="section-subhead subhead-tickets">
                  <span>🔧 Regular Maintenance, Service & Issue Tickets (${tech.tickets.length} Tasks)</span>
                  <span class="time-tag">Time: ${formatTimeMins(tech.ticketsTime)}</span>
                </div>
                ${tech.tickets.length === 0 ? `
                  <div style="padding: 10px; text-align: center; font-size: 10px; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; margin-bottom: 12px;">No regular tickets assigned to ${tech.name}.</div>
                ` : `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th style="width: 25px; text-align: center;">#</th>
                        <th>Date</th>
                        <th>Division / Location</th>
                        <th>Category</th>
                        <th>Issue Description</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th>Instruction By</th>
                        <th>Raised By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tech.tickets.map((t, idx) => {
                        const meta = parseMetadata(t.remarks);
                        const tDate = t.operationDate || meta.manualDate || (t.createdAt ? String(t.createdAt).split('T')[0] : 'N/A');
                        const locStr = [t.divisionName, t.block, t.room || meta.location].filter(Boolean).join(' / ') || 'N/A';
                        const catStr = t.category || meta.category || 'Issue';
                        const st = t.status || 'Open';
                        const badgeClass = st === 'Completed' ? 'badge-completed' : (st === 'In Progress' ? 'badge-progress' : 'badge-open');
                        const durationStr = t.totalTime || formatTimeMins(getTicketWorkMinutes(t)) || '--';
                        return `
                          <tr>
                            <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                            <td class="time-tag">${tDate}</td>
                            <td><strong>${locStr}</strong></td>
                            <td>${catStr}</td>
                            <td>${t.issueDescription || 'N/A'}</td>
                            <td class="time-tag">${t.receivedTime || '--:--'}</td>
                            <td class="time-tag">${t.endTime || '--:--'}</td>
                            <td class="time-tag" style="font-weight: 800; color: #0284c7;">${durationStr}</td>
                            <td>${t.instructionBy || meta.instructionBy || 'N/A'}</td>
                            <td>${t.raisedByName || (t.raisedBy && (t.raisedBy.name || t.raisedBy.username)) || 'N/A'}</td>
                            <td><span class="badge ${badgeClass}">${st}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `}

                <!-- Section 2: CCTV & Hardware Upgrades -->
                <div class="section-subhead subhead-upgrades">
                  <span>🛡️ CCTV & Hardware Upgrades (${tech.upgrades.length} Tasks)</span>
                  <span class="time-tag">Time: ${formatTimeMins(tech.upgradesTime)}</span>
                </div>
                ${tech.upgrades.length === 0 ? `
                  <div style="padding: 10px; text-align: center; font-size: 10px; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; margin-bottom: 12px;">No CCTV upgrades assigned to ${tech.name}.</div>
                ` : `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th style="width: 25px; text-align: center;">#</th>
                        <th>Date</th>
                        <th>Division / Location</th>
                        <th>Upgrade Description</th>
                        <th>Action Taken</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th>Instruction By</th>
                        <th>Raised By</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${tech.upgrades.map((t, idx) => {
                        const meta = parseMetadata(t.remarks);
                        const tDate = t.operationDate || meta.manualDate || (t.createdAt ? String(t.createdAt).split('T')[0] : 'N/A');
                        const locStr = [t.divisionName, t.block, t.room || meta.location].filter(Boolean).join(' / ') || 'N/A';
                        const st = t.status || 'Open';
                        const badgeClass = st === 'Completed' ? 'badge-completed' : (st === 'In Progress' ? 'badge-progress' : 'badge-open');
                        const durationStr = t.totalTime || formatTimeMins(getTicketWorkMinutes(t)) || '--';
                        return `
                          <tr>
                            <td style="text-align: center; color: #64748b;">${idx + 1}</td>
                            <td class="time-tag">${tDate}</td>
                            <td><strong>${locStr}</strong></td>
                            <td>${t.issueDescription || 'N/A'}</td>
                            <td>${t.actionTaken || 'N/A'}</td>
                            <td class="time-tag">${t.receivedTime || '--:--'}</td>
                            <td class="time-tag">${t.endTime || '--:--'}</td>
                            <td class="time-tag" style="font-weight: 800; color: #9333ea;">${durationStr}</td>
                            <td>${t.instructionBy || meta.instructionBy || 'N/A'}</td>
                            <td>${t.raisedByName || (t.raisedBy && (t.raisedBy.name || t.raisedBy.username)) || 'N/A'}</td>
                            <td><span class="badge ${badgeClass}">${st}</span></td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            `;
          }).join('')}

          <div class="footer-note">
            Rathinam CCTV Management & Surveillance System &bull; Confidential Performance Report &bull; Page Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Shield className="mr-3 text-cyan-400" size={28} />
            Upgrades
          </h1>
          <div className="flex bg-panel border border-main rounded-xl p-0.5 sm:ml-4 self-start">
            <button
              onClick={() => setViewMode('registry')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'registry'
                  ? 'bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/20'
                  : 'text-slate-400 hover:text-main'
              }`}
            >
              Upgrade List
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
          <button onClick={handleDownload} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-main transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          <button onClick={printToPDF} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-main transition-colors">
            <Printer size={14} className="mr-2" /> Print PDF
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2">
              <Plus size={16} className="mr-2" />
              Register Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search upgrades by Description, Location..."
            className="bg-panel text-sm text-slate-200 border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center space-x-2 bg-panel px-4 py-3 rounded-md border border-main">
          <Calendar size={16} className="text-slate-400" />
          <input 
            type="month" 
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="From Month"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input 
            type="month" 
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="To Month"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-md border border-main mb-6">
        <div className="flex p-1 bg-slate-800 rounded-lg border border-slate-700">
          {['ALL', 'Open', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                statusFilter === status 
                  ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50' 
                  : 'text-slate-400 hover:text-main'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'registry' ? (
        <>
          {/* Summary Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-slide-up delay-100">
            <button 
              className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group text-left cursor-pointer ${
                statusFilter === 'Open' ? 'ring-2 ring-rose-500 bg-rose-500/10' : 'hover:ring-1 hover:ring-rose-500/30'
              }`}
              onClick={() => setStatusFilter(statusFilter === 'Open' ? 'ALL' : 'Open')}
            >
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-rose-500 tracking-widest uppercase">[OPEN UPGRADES]</h3>
                <Clock size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-main">{summaryStats.open}</span>
              </div>
            </button>

            <button 
              className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group text-left cursor-pointer ${
                statusFilter === 'In Progress' ? 'ring-2 ring-amber-500 bg-amber-500/10' : 'hover:ring-1 hover:ring-amber-500/30'
              }`}
              onClick={() => setStatusFilter(statusFilter === 'In Progress' ? 'ALL' : 'In Progress')}
            >
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-amber-500 tracking-widest uppercase">[IN PROGRESS]</h3>
                <Shield size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-main">{summaryStats.inProgress}</span>
              </div>
            </button>

            <button 
              className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group text-left cursor-pointer ${
                statusFilter === 'Completed' ? 'ring-2 ring-green-500 bg-green-500/10' : 'hover:ring-1 hover:ring-green-500/30'
              }`}
              onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'ALL' : 'Completed')}
            >
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-green-500 tracking-widest uppercase">[COMPLETED]</h3>
                <CheckCircle size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-main">{summaryStats.completed}</span>
              </div>
            </button>

            <button 
              className={`bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group text-left cursor-pointer ${
                statusFilter === 'ALL' ? 'ring-2 ring-cyan-500/80 bg-cyan-500/10' : 'hover:ring-1 hover:ring-cyan-500/30'
              }`}
              onClick={() => setStatusFilter('ALL')}
            >
              <div className="flex justify-between items-start w-full">
                <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL UPGRADES]</h3>
                <Briefcase size={18} className="text-slate-500" />
              </div>
              <div className="flex items-end mt-4">
                <span className="text-4xl font-bold text-cyan-400">{summaryStats.total}</span>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" style={{ width: '30%' }}></div>
            </button>

            <div className="bg-panel rounded-md p-4 flex items-center justify-between gap-3 w-full">
              <div className="w-20 h-20 relative flex items-center justify-center flex-shrink-0">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={38} paddingAngle={2} dataKey="value" stroke="none" label={false} labelLine={false}>
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
                  <span className="text-[11px] font-bold text-main leading-none text-center mt-1">100%<br/><span className="text-[6px] text-slate-400">DIST.</span></span>
                </div>
              </div>
              <div className="flex flex-col space-y-1.5 flex-1 min-w-[70px] justify-center">
                {chartData.map(d => (
                  <div key={d.name} className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                    <span className="text-[9px] text-slate-300 font-bold uppercase truncate">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-main flex justify-end items-center bg-card/40 rounded-t-2xl mb-4 mt-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 mr-2">
                <span className="text-[10px] font-black text-dim uppercase tracking-widest">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-panel border border-white/10 rounded px-2 py-0.5 text-[10px] font-black text-main outline-none focus:border-teal-500 transition-colors"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center space-x-1">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="p-1 text-dim hover:text-main disabled:opacity-30 transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                  {filteredTickets.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredTickets.length)}-${Math.min(currentPage * itemsPerPage, filteredTickets.length)} of ${filteredTickets.length}`}
                </span>
                <button disabled={currentPage >= Math.ceil(filteredTickets.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-main disabled:opacity-30 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-panel border-b border-main">
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-12 whitespace-nowrap">S.No</th>
                    <th 
                      className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-cyan-400 transition-colors whitespace-nowrap"
                      onClick={() => setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      title={`Click to sort by Date (${dateSortOrder === 'desc' ? 'Newest First' : 'Oldest First'})`}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        <span className="text-cyan-400 text-xs font-mono font-bold">
                          {dateSortOrder === 'desc' ? '↓' : '↑'}
                        </span>
                      </div>
                    </th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Location</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upgrade Description</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Action Taken</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Instruction By</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Work By</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Time (R/E/T)</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                    {canEdit && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-main">
                  {loading ? (
                    <tr><td colSpan="10" className="p-10 text-center text-dim">Loading upgrades...</td></tr>
                  ) : filteredTickets.length === 0 ? (
                    <tr><td colSpan="10" className="p-10 text-center text-dim">No upgrades found.</td></tr>
                  ) : (
                    filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((ticket, index) => (
                      <tr 
                        key={ticket.id || ticket._id} 
                        className="hover:bg-slate-700/30 transition-colors cursor-pointer group"
                        onClick={(e) => {
                          if (!e.target.closest('button')) {
                            navigate(`/tickets/${ticket.id || ticket._id}`);
                          }
                        }}
                      >
                        <td className="p-4 text-center font-mono text-[10px] text-dim whitespace-nowrap">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                        <td className="p-4 text-xs font-mono text-slate-300 whitespace-nowrap">{ticket.operationDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}</td>
                        <td className="p-4 text-xs font-semibold text-main uppercase">{ticket.divisionName || 'N/A'} - {ticket.block}</td>
                        <td className="p-4 text-xs text-slate-400 uppercase">{ticket.issueDescription}</td>
                        <td className="p-4 text-xs text-slate-400 uppercase">{ticket.actionTaken || 'Pending'}</td>
                        <td className="p-4 text-xs text-main uppercase">{ticket.instructionBy || 'N/A'}</td>
                        <td className="p-4 text-xs text-main uppercase">
                          {ticket.assignedTo?.name || (ticket.assignedStaff && ticket.assignedStaff.length > 0 ? ticket.assignedStaff.map(s => s.name || s.username).filter(Boolean).join(', ') : '') || ticket.raisedByName || 'Authorized Staff'}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-center space-y-1">
                            <span className="text-[10px] text-emerald-400 font-mono">{ticket.receivedTime || '--:--'}</span>
                            <span className="text-[10px] text-red-400 font-mono">{ticket.endTime || '--:--'}</span>
                            <div className="h-[1px] w-8 bg-slate-700"></div>
                            <span className="text-[10px] text-main font-bold">{ticket.totalTime || '0h 0m'}</span>
                          </div>
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
                        {canEdit && (
                          <td className="p-4 text-right">
                            <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => navigate(`/tickets/${ticket.id || ticket._id}`)} 
                                className="text-slate-400 hover:text-cyan-400 transition-colors"
                                title="View Full Details"
                              >
                                <Info size={14} />
                              </button>
                              <button onClick={() => handleEdit(ticket)} className="text-slate-400 hover:text-cyan-400 transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(ticket.id || ticket._id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-10">
          {/* Detailed Upgrade Report View */}
          <div className="bg-panel border border-main rounded-md p-8 flex flex-col justify-between overflow-hidden relative transition-all group shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-xl font-bold text-main tracking-wider uppercase mb-1">Upgrade Operations & Performance Report</h2>
                <p className="text-xs text-dim font-medium">
                  Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[9px] font-bold uppercase tracking-widest text-slate-300">
                    Period: {startMonth || 'ALL'} to {endMonth || 'ALL'}
                  </span>
                  <span className="px-2.5 py-1 rounded bg-teal-500/10 border border-teal-500/20 text-[9px] font-bold uppercase tracking-widest text-teal-400">
                    Status Filter: {statusFilter}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                <button
                  onClick={async () => {
                    showNotification('Generating PPT, this may take a moment...', 'info');
                    try {
                      const monthName = startMonth || endMonth ? `${startMonth || 'All'}_to_${endMonth || 'All'}` : 'All_Time';
                      await exportMonthlyPPT(filteredTickets, getImageUrl, monthName, 'Upgrade');
                      showNotification('PPT generated successfully!', 'success');
                    } catch (e) {
                      console.error('PPT Error:', e);
                      showNotification('Failed to generate PPT: ' + (e.message || 'Unknown error'), 'error');
                    }
                  }}
                  className="flex items-center text-[11px] font-bold text-slate-300 hover:text-main border border-indigo-700 px-3 py-2 bg-indigo-900/50 hover:bg-indigo-800/80 rounded transition-colors"
                >
                  <Download size={12} className="mr-2 text-indigo-400" />
                  Download PPT
                </button>
                <button
                  onClick={printToPDF}
                  className="flex items-center text-[11px] font-bold text-slate-300 hover:text-main border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
                >
                  <Printer size={12} className="mr-2" />
                  Print PDF Report
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center text-[11px] font-bold text-slate-300 hover:text-main border border-slate-700 px-3 py-2 bg-slate-800 rounded transition-colors"
                >
                  <Download size={12} className="mr-2" />
                  Export CSV Data
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Upgrades</span>
              <span className="text-3xl font-bold font-mono text-main mt-2">{filteredTickets.length}</span>
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
              <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Assigned Staff</span>
              <span className="text-3xl font-bold font-mono text-purple-400 mt-2">{uniqueAssignedStaffCount}</span>
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Upgrades by Division</h3>
              <div className="h-64 flex items-center justify-center">
                {divisionStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={divisionStats} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
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
                ) : (
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Division Data</p>
                )}
              </div>
            </div>

            <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Upgrades by Block</h3>
              <div className="h-64 flex items-center justify-center">
                {blockStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={blockStats} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
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
                      <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Block Data</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-panel border border-main rounded-md p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Technician Load & Productivity Matrix</h3>
              <button
                type="button"
                onClick={() => downloadStaffPDF('ALL')}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-bold uppercase transition-all flex items-center space-x-2 shadow-sm"
              >
                <Printer size={14} />
                <span>Print All Staff PDF</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-main">
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Work Split</th>
                    <th className="p-4 text-[10px] font-bold text-rose-500 uppercase tracking-widest text-center">Open</th>
                    <th className="p-4 text-[10px] font-bold text-amber-500 uppercase tracking-widest text-center">In Progress</th>
                    <th className="p-4 text-[10px] font-bold text-green-500 uppercase tracking-widest text-center">Completed</th>
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Total Assigned</th>
                    <th className="p-4 text-[10px] font-bold text-cyan-400 uppercase tracking-widest text-center">Completion Rate</th>
                    <th className="p-4 text-[10px] font-bold text-indigo-400 uppercase tracking-widest text-center">Avg Time</th>
                    <th className="p-4 text-[10px] font-bold text-purple-400 uppercase tracking-widest text-center">Total Time</th>
                    <th className="p-4 text-[10px] font-bold text-purple-400 uppercase tracking-widest text-center">Export PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-400">
                  {(() => {
                    const formatTime = (totalMins) => {
                      if (!totalMins || totalMins <= 0) return '0m';
                      const t = Math.floor(totalMins);
                      if (t < 60) return `${t}m`;
                      const h = Math.floor(t / 60);
                      const m = t % 60;
                      return `${h}h ${m}m`;
                    };

                    const isUpgradeTicket = (t) => {
                      let meta = {};
                      try {
                        meta = typeof t.remarks === 'string' && t.remarks.startsWith('{') ? JSON.parse(t.remarks) : {};
                      } catch(e) {}
                      const cat = String(t.category || meta.category || '').toLowerCase();
                      const desc = String(t.issueDescription || '').toLowerCase();
                      return cat.includes('upgrade') || desc.includes('upgrade') || meta.isUpgrade === true;
                    };

                    const getTicketAssignees = (t) => {
                      let assignees = [];
                      if (t.assignedStaff && Array.isArray(t.assignedStaff) && t.assignedStaff.length > 0) {
                        assignees = t.assignedStaff.map(s => s.name || s.username || s).filter(Boolean);
                      }
                      if (assignees.length === 0) {
                        const rawAssign = t.assignedTo?.name || t.assignedTo?.username || t.assignedTo || 'Unassigned';
                        if (typeof rawAssign === 'string') {
                          assignees = rawAssign.split(/[,&]/).map(s => s.trim()).filter(Boolean);
                        } else {
                          assignees = ['Unassigned'];
                        }
                      }
                      return assignees.length > 0 ? assignees : ['Unassigned'];
                    };

                    const techReportMap = {};
                    filteredTickets.forEach(t => {
                      const assignees = getTicketAssignees(t);
                      const isUp = isUpgradeTicket(t);
                      let timeTaken = 0;
                      let normalizedStatus = 'Open';
                      const sLow = String(t.status || 'Open').toLowerCase();
                      
                      if (sLow.includes('completed') || sLow.includes('finished')) {
                         normalizedStatus = 'Completed';
                         if (t.createdAt && t.updatedAt) {
                            const s = new Date(t.createdAt);
                            const e = new Date(t.updatedAt);
                            if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                               timeTaken = Math.max(0, Math.floor((e - s) / 60000));
                            }
                         }
                      } else if (sLow.includes('progress')) {
                         normalizedStatus = 'In Progress';
                      }

                      assignees.forEach(name => {
                        if (!techReportMap[name]) {
                           techReportMap[name] = { 
                             Open: 0, 
                             'In Progress': 0, 
                             Completed: 0, 
                             totalTime: 0,
                             ticketsCount: 0,
                             upgradesCount: 0
                           };
                        }
                        if (isUp) {
                          techReportMap[name].upgradesCount++;
                        } else {
                          techReportMap[name].ticketsCount++;
                        }
                        techReportMap[name][normalizedStatus]++;
                        if (timeTaken > 0) {
                           techReportMap[name].totalTime += (timeTaken / assignees.length);
                        }
                      });
                    });

                    const data = Object.entries(techReportMap).sort((a,b) => {
                      const sumA = a[1].Open + a[1]['In Progress'] + a[1].Completed;
                      const sumB = b[1].Open + b[1]['In Progress'] + b[1].Completed;
                      return sumB - sumA;
                    });
                    
                    if (data.length === 0) {
                      return (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-xs">No technician load data found.</td>
                        </tr>
                      );
                    }
                    
                    return data.map(([name, counts]) => {
                      const total = counts.Open + counts['In Progress'] + counts.Completed;
                      const rate = total > 0 ? ((counts.Completed / total) * 100).toFixed(0) : 0;
                      const avgMins = counts.Completed > 0 ? counts.totalTime / counts.Completed : 0;
                      const avgTimeStr = formatTime(avgMins);
                      const totalTimeStr = formatTime(counts.totalTime);
                      
                      return (
                        <tr key={name} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 text-xs font-bold text-main flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span>{name}</span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 whitespace-nowrap" title="Regular Tickets">
                                Tickets: {counts.ticketsCount}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 whitespace-nowrap" title="Upgrades">
                                Upgrades: {counts.upgradesCount}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-center text-rose-400 font-bold">{counts.Open}</td>
                          <td className="p-4 font-mono text-center text-amber-400 font-bold">{counts['In Progress']}</td>
                          <td className="p-4 font-mono text-center text-green-400 font-bold">{counts.Completed}</td>
                          <td className="p-4 font-mono text-center text-main font-bold">{total}</td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 font-mono">
                              {rate}%
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-mono">
                              {avgTimeStr}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border border-purple-500/30 text-purple-400 bg-purple-500/10 font-mono">
                              {totalTimeStr}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => downloadStaffPDF(name)}
                              className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 rounded text-[9px] font-bold uppercase transition-all flex items-center justify-center mx-auto"
                              title={`Download PDF Report for ${name}`}
                            >
                              <Printer size={10} className="mr-1" />
                              <span>PDF</span>
                            </button>
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
            <div className="p-4 bg-panel border-b border-main flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Registry ({filteredTickets.length} Records)</span>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-black text-dim uppercase tracking-widest">Show</span>
                  <select
                    value={reportItemsPerPage}
                    onChange={(e) => { setReportItemsPerPage(Number(e.target.value)); setReportCurrentPage(1); }}
                    className="bg-panel border border-white/10 rounded px-2 py-0.5 text-[10px] font-black text-main outline-none focus:border-teal-500 transition-colors cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    disabled={reportCurrentPage === 1}
                    onClick={() => setReportCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1 text-dim hover:text-main disabled:opacity-30 transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                    {filteredTickets.length === 0
                      ? '0-0 of 0'
                      : `${Math.min((reportCurrentPage - 1) * reportItemsPerPage + 1, filteredTickets.length)}-${Math.min(reportCurrentPage * reportItemsPerPage, filteredTickets.length)} of ${filteredTickets.length}`
                    }
                  </span>
                  <button
                    disabled={reportCurrentPage >= Math.ceil(filteredTickets.length / reportItemsPerPage)}
                    onClick={() => setReportCurrentPage(prev => prev + 1)}
                    className="p-1 text-dim hover:text-main disabled:opacity-30 transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-panel border-b border-main text-slate-400">
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest text-center w-12">S.No</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Location</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Upgrade Description</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Action Taken</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Instruction By</th>
                    <th className="p-4 text-[9px] font-bold uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-main">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-xs text-slate-500">No records found.</td>
                    </tr>
                  ) : (
                    filteredTickets
                      .slice((reportCurrentPage - 1) * reportItemsPerPage, reportCurrentPage * reportItemsPerPage)
                      .map((ticket, idx) => {
                        const sNo = (reportCurrentPage - 1) * reportItemsPerPage + idx + 1;
                        return (
                          <tr key={ticket.id || ticket._id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="p-4 text-center font-mono text-[10px] text-slate-500">{sNo}</td>
                            <td className="p-4 font-mono text-[10px] text-slate-400">
                              {ticket.operationDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}
                            </td>
                            <td className="p-4 text-xs font-bold text-blue-400">
                              {ticket.divisionName || 'N/A'} - {ticket.block || ''}
                            </td>
                            <td className="p-4 text-xs text-slate-200">
                              {ticket.issueDescription || 'N/A'}
                            </td>
                            <td className="p-4 text-xs text-slate-400">
                              {ticket.actionTaken || 'N/A'}
                            </td>
                            <td className="p-4 text-xs text-slate-400">
                              {ticket.instructionBy || 'N/A'}
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
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8 flex flex-col">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <h2 className="text-2xl font-black text-main tracking-tight uppercase">
                {editingId ? 'Modify Upgrade' : 'Register Upgrade'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Division</label>
                  <select 
                    required 
                    name="divisionName" 
                    value={formData.divisionName} 
                    onChange={handleInputChange} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer"
                  >
                    <option value="">SELECT DIVISION</option>
                    {uniqueColleges.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Block/Location</label>
                  <select 
                    required 
                    name="block" 
                    value={formData.block} 
                    onChange={handleInputChange} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer"
                  >
                    <option value="">SELECT BLOCK</option>
                    {uniqueBlocks.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upgrade Description</label>
                <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] bg-panel border-main" placeholder="Hardware to be upgraded..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Date</label>
                  <input 
                    required 
                    type="date" 
                    name="date" 
                    value={formData.date} 
                    onChange={handleInputChange} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Start Time</label>
                  <input 
                    type="time" 
                    name="receivedTime" 
                    value={formData.receivedTime} 
                    onChange={handleInputChange} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">End Time</label>
                  <input 
                    type="time" 
                    name="endTime" 
                    value={formData.endTime} 
                    onChange={handleInputChange} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Total Time</label>
                  <input 
                    type="text" 
                    readOnly 
                    name="totalTime" 
                    value={formData.totalTime || calculateTotalTime(formData.receivedTime, formData.endTime) || '--'} 
                    className="glass-input w-full p-3 text-xs bg-panel/50 border-main text-cyan-400 font-mono font-bold cursor-not-allowed" 
                    placeholder="--:--" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                  <input type="text" name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Raised By</label>
                  <input type="text" name="raisedByName" value={formData.raisedByName} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Name of person raising upgrade" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                  <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Authorized by..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest flex items-center gap-1">
                      <Shield size={10} className="text-cyan-400" />
                      Responsibility
                    </label>
                    <button 
                      type="button" 
                      onClick={() => setIsAddingStaff(!isAddingStaff)}
                      className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-cyan-500/20 transition-all"
                    >
                      <Plus size={10} />
                      <span>Quick Add Staff</span>
                    </button>
                  </div>

                  {formData.assignedTo && (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl max-w-max animate-fade-in mb-3">
                      <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Site Responsibility:</span>
                      <span className="text-[10px] font-bold text-white">
                        {users.find(u => String(u.id || u._id) === String(formData.assignedTo))?.name || 'Loading...'}
                      </span>
                    </div>
                  )}
                  
                  {isAddingStaff && (
                    <div className="flex flex-col space-y-2 animate-slide-down bg-panel p-3 rounded-xl border border-cyan-500/30 mb-3">
                      <input 
                        autoFocus
                        type="text" 
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="glass-input w-full p-2 text-xs bg-panel border-main text-white"
                        placeholder="Staff Name..."
                      />
                      <div className="flex space-x-2">
                        <input 
                          type="email" 
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          className="glass-input flex-1 p-2 text-xs bg-panel border-main text-white"
                          placeholder="Email (Optional)..."
                        />
                        <button type="button" onClick={handleAddQuickStaff} className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">Save</button>
                      </div>
                    </div>
                  )}

                  {/* Selected staff container */}
                  <div className="bg-panel/40 border border-main rounded-xl p-3 min-h-[50px] flex flex-wrap gap-2 items-center justify-center text-center mb-3">
                    {formData.assignedStaff && formData.assignedStaff.length > 0 ? (
                      formData.assignedStaff.map(staffId => {
                        const staff = users.find(u => String(u.id || u._id) === String(staffId));
                        return (
                          <span key={staffId} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-fade-in">
                            {staff?.name || staff?.username || 'Unknown'}
                            <button 
                              type="button" 
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  assignedStaff: (prev.assignedStaff || []).filter(id => String(id) !== String(staffId))
                                }));
                              }}
                              className="hover:text-red-400 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[9px] font-black text-dim uppercase tracking-widest italic">NO STAFF ASSIGNED YET</span>
                    )}
                  </div>

                  {/* Toggle buttons for each staff with edit/delete icons on hover */}
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                    {users.map(s => {
                      const isSelected = (formData.assignedStaff || []).some(id => String(id) === String(s.id || s._id));
                      return (
                        <div key={s.id || s._id} className="group/staff relative">
                          <button
                            type="button"
                            onClick={() => {
                              const id = s.id || s._id;
                              setFormData(prev => {
                                const current = prev.assignedStaff || [];
                                const hasIt = current.some(item => String(item) === String(id));
                                const next = hasIt 
                                  ? current.filter(item => String(item) !== String(id)) 
                                  : [...current, id];
                                return { ...prev, assignedStaff: next };
                              });
                            }}
                            className={`w-full p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all text-left pr-10
                              ${isSelected 
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                                : 'bg-panel/30 border-main text-secondary hover:bg-panel hover:text-main'
                              }
                            `}
                          >
                            {s.name || s.username}
                            {String(s.id || s._id) === String(formData.assignedTo) && (
                              <span className="ml-1.5 text-[8px] font-bold text-cyan-300 uppercase tracking-wider">
                                (Responsibility)
                              </span>
                            )}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover/staff:opacity-100 transition-opacity">
                            <button 
                              type="button" 
                              onClick={(e) => handleEditStaff(e, s)}
                              className="p-1 hover:text-blue-400 bg-black/40 rounded text-slate-300"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button 
                              type="button" 
                              onClick={(e) => handleDeleteStaff(e, s.id || s._id)}
                              className="p-1 hover:text-red-400 bg-black/40 rounded text-slate-300"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer">
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end items-center space-x-6 pt-6 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black text-secondary hover:text-main uppercase tracking-[0.2em] transition-colors">Cancel</button>
                <button type="submit" className="glass-button px-12 py-3">{editingId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
