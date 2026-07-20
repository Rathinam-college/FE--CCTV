import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, User as UserIcon, CheckCircle,
  Maximize2, Minimize2, Activity, Shield, ChevronLeft, ChevronRight, Printer
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useNavigate, useParams } from 'react-router-dom';
import { useSiteStore } from '../store/siteStore';
import ComboInput from '../components/ComboInput';

const getImageUrl = (path) => {
  if (!path) return '';
  
  // Remove internal docker/local backend hosts to force it through the Vite proxy
  if (path.includes('backend:5000')) {
    path = path.replace(/https?:\/\/backend:5000/, '');
  } else if (path.includes('localhost:5000')) {
    path = path.replace(/https?:\/\/localhost:5000/, '');
  }
  
  if (path.startsWith('http')) return path;
  
  const baseUrl = import.meta.env.BASE_URL || '/cctv/';
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  if (cleanPath.startsWith('cctv/')) {
    return `/${cleanPath}`;
  }
  
  return `${baseUrl}${cleanPath}`;
};

export default function ProjectTickets() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { projectId, projectName } = useParams();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const { divisions, fetchDivisions } = useSiteStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [inProgressTicket, setInProgressTicket] = useState(null);
  const [inProgressData, setInProgressData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    image: null,
    video: null
  });

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTicket, setCompletionTicket] = useState(null);
  const [completionData, setCompletionData] = useState({
    remark: '',
    endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    image: null,
    video: null
  });
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Projects:EDIT');

  const summaryStats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    completed: tickets.filter(t => t.status === 'Completed').length
  }), [tickets]);

  const chartData = useMemo(() => [
    { name: 'Open', value: summaryStats.open, color: '#f43f5e' },
    { name: 'In Progress', value: summaryStats.inProgress, color: '#f59e0b' },
    { name: 'Completed', value: summaryStats.completed, color: '#10b981' }
  ].filter(d => d.value > 0), [summaryStats]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    category: 'CCTV',
    issueDescription: '',
    actionTaken: '',
    instructionBy: '',
    receivedTime: '',
    endTime: '',
    totalTime: '0h 0m',
    assignedTo: '',
    assignedStaff: [],
    projectId: projectId,
    status: 'Open',
    workImage: null,
    raisedBy: '',
    raisedByName: ''
  });

  const [allLocations, setAllLocations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [showStaffAdd, setShowStaffAdd] = useState(false);

  useEffect(() => {
    fetchData();
    fetchDivisions();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes, locRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/'),
        api.get('/cameras/master_locations/')
      ]);
      
      const allTickets = ticketRes.data || [];
      const sortedTickets = [...allTickets].sort((a, b) => (b.id || 0) - (a.id || 0));
      const projectTickets = sortedTickets.filter(t => 
        (t.projectId?.id || t.projectId || t.project?.id)?.toString() === projectId.toString()
      );
      
      setTickets(projectTickets);
      setUsers(userRes.data);
      setAllLocations(locRes.data);
      setStaff(userRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStaff = async (e, s) => {
    e.stopPropagation();
    const newName = prompt('Enter new name for staff member:', s.name);
    if (!newName || newName === s.name) return;
    try {
      const res = await api.patch(`/users/${s.id || s._id}/`, { name: newName.trim(), email: s.email });
      setStaff(staff.map(item => (item.id || item._id) === (s.id || s._id) ? { ...item, ...res.data } : item));
      showNotification('Staff member updated', 'success');
    } catch (err) {
      showNotification('Failed to update staff member', 'error');
    }
  };

  const handleDeleteStaff = async (e, id) => {
    e.stopPropagation();
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/users/${id}/`);
        setStaff(staff.filter(s => (s.id || s._id) !== id));
        setFormData(prev => ({
          ...prev,
          assignedStaff: prev.assignedStaff.filter(sId => sId !== id)
        }));
        showNotification('Staff member removed', 'success');
      } catch (err) {
        showNotification('Failed to delete staff member', 'error');
      }
    });
  };

  const handleAddQuickStaff = async () => {
    if (!newStaffName.trim()) return;
    try {
      const emailToUse = `staff_${Date.now()}@cctv.local`;
      const res = await api.post('/users/', { 
        name: newStaffName.trim(), 
        email: emailToUse,
        password: 'password123',
        role: 'Staff'
      });
      const newStaffList = [...staff, res.data];
      setStaff(newStaffList);
      setUsers(newStaffList);
      setFormData(prev => ({ ...prev, assignedStaff: [...prev.assignedStaff, res.data.id || res.data._id] }));
      setNewStaffName('');
      setShowStaffAdd(false);
      showNotification('Staff added and selected', 'success');
    } catch (err) {
      showNotification('Failed to add staff', 'error');
    }
  };

  const toggleStaffSelection = (id) => {
    setFormData(prev => ({
      ...prev,
      assignedStaff: prev.assignedStaff.includes(id)
        ? prev.assignedStaff.filter(sId => sId !== id)
        : [...prev.assignedStaff, id]
    }));
  };

  const parseMetadata = (remarks) => {
    try {
      if (!remarks) throw new Error('Empty');
      const parsed = JSON.parse(remarks);
      return parsed && typeof parsed === 'object' ? parsed : {
        location: '', category: 'CCTV', actionTaken: '', instructionBy: '', receivedTime: '', endTime: '', totalTime: ''
      };
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

  const calculateTotalTime = (start, end) => {
    if (!start || !end) return '';
    try {
      const [sH, sM] = start.split(':').map(Number);
      const [eH, eM] = end.split(':').map(Number);
      let diff = (eH * 60 + eM) - (sH * 60 + sM);
      if (diff < 0) diff += 24 * 60;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return `${h}h ${m}m`;
    } catch (err) {
      return '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['date', 'status', 'receivedTime', 'endTime'].includes(name)) {
      newValue = newValue.toUpperCase();
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: newValue };
      
      if (name === 'divisionName' || name === 'block' || name === 'floor' || name === 'room') {
        if (name === 'divisionName') {
          newData.block = ''; newData.floor = ''; newData.room = '';
        } else if (name === 'block') {
          newData.floor = ''; newData.room = '';
        } else if (name === 'floor') {
          newData.room = '';
        }

        const matchingLoc = allLocations.find(l => 
          l.divisionName === (name === 'divisionName' ? value : newData.divisionName) &&
          l.block === (name === 'block' ? value : newData.block) &&
          l.floor === (name === 'floor' ? value : newData.floor) &&
          l.room === (name === 'room' ? value : newData.room)
        );

        if (matchingLoc && matchingLoc.assignedTo) {
          const respId = matchingLoc.assignedTo.id || matchingLoc.assignedTo;
          newData.assignedTo = respId;
          // Auto-select site responsibility in assignedStaff
          if (respId && !newData.assignedStaff.includes(respId)) {
            newData.assignedStaff = [...newData.assignedStaff, respId];
          }
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
      const payload = {
        issueDescription: formData.issueDescription,
        status: formData.status,
        assignedTo: formData.assignedTo || null,
        assignedStaff: formData.assignedStaff || [],
        projectId: projectId, 
        operationDate: formData.date,
        divisionName: formData.divisionName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        category: formData.category,
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        receivedTime: formData.receivedTime,
        endTime: formData.endTime,
        totalTime: formData.totalTime,
        remarks: formData.remarks || '',
        raisedBy: user._id || user.id,
        raisedByName: formData.raisedByName || '',
      };

      if (!editingId) {
        payload.createdDate = new Date().toISOString().split('T')[0];
        payload.createdTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }

      if (editingId) {
        payload.cameraId = currentTicket?.cameraId?._id || currentTicket?.cameraId?.id || (typeof currentTicket?.cameraId !== 'object' ? currentTicket?.cameraId : null);
        payload.raisedBy = currentTicket?.raisedBy?._id || currentTicket?.raisedBy?.id || (typeof currentTicket?.raisedBy !== 'object' ? currentTicket?.raisedBy : null) || user?._id || user?.id;
        payload.raisedByName = formData.raisedByName || '';
      } else {
        payload.cameraId = null;
      }
      
      const formToSend = new FormData();
      Object.keys(payload).forEach(key => {
        if (key === 'assignedStaff' && Array.isArray(payload[key])) {
          payload[key].forEach(val => formToSend.append('assignedStaff', val));
        } else if (payload[key] !== null && payload[key] !== undefined) {
          formToSend.append(key, payload[key]);
        }
      });

      if (formData.workImage) {
        formToSend.append('workImage', formData.workImage);
      }

      const config = {};

      if (editingId) {
        await api.patch(`/tickets/${editingId}/`, formToSend, config);
        showNotification('Log updated successfully');
      } else {
        await api.post('/tickets/', formToSend, config);
        showNotification('New log created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving ticket:', err);
      showNotification('Failed to save ticket', 'error');
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
      category: 'CCTV',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      receivedTime: '',
      endTime: '',
      totalTime: '0h 0m',
      assignedTo: '',
      assignedStaff: [],
      projectId: projectId,
      status: 'Open',
      workImage: null,
      raisedBy: user?._id || user?.id || '',
      raisedByName: ''
    });
    setEditingId(null);
    setCurrentTicket(null);
  };

  const handleEdit = (ticket) => {
    if (ticket.status === 'Completed' && user?.role !== 'Super Admin') {
      showNotification('Only Super Admin can edit completed tickets', 'error');
      return;
    }
    setFormData({
      date: ticket.operationDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      divisionName: ticket.divisionName || '',
      block: ticket.block || '',
      floor: ticket.floor || '',
      room: ticket.room || '',
      category: ticket.category || 'CCTV',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || '',
      instructionBy: ticket.instructionBy || '',
      receivedTime: ticket.receivedTime || '',
      endTime: ticket.endTime || '',
      totalTime: ticket.totalTime || '0h 0m',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo || '',
      assignedStaff: (() => {
        const respId = ticket.assignedTo?.id || ticket.assignedTo || '';
        const staffIds = (ticket.assignedStaff || []).map(s => s.id || s._id || s);
        if (respId && !staffIds.includes(respId)) {
          staffIds.push(respId);
        }
        return staffIds;
      })(),
      projectId: projectId,
      status: ticket.status || 'Open',
      workImage: null,
      raisedBy: ticket.raisedBy?.id || ticket.raisedBy?._id || (typeof ticket.raisedBy !== 'object' ? ticket.raisedBy : '') || '',
      raisedByName: ticket.raisedByName || ''
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

  const filteredTickets = Array.isArray(tickets) ? tickets.filter(ticket => {
    const meta = parseMetadata(ticket.remarks);
    const ticketDate = meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : '');
    if (startMonth || endMonth) {
      if (!ticketDate) return false;
      const tMonth = ticketDate.substring(0, 7); // 'YYYY-MM'
      if (startMonth && tMonth < startMonth) return false;
      if (endMonth && tMonth > endMonth) return false;
    }
    const searchStr = `${ticket.issueDescription} ${meta.location} ${meta.category}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  }) : [];

  const handleDownload = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['S.No', 'Date', 'Location', 'Category', 'Issue', 'Action Taken', 'Instruction By', 'Received', 'End', 'Total', 'Responsibility', 'Status'];
    const rows = filteredTickets.map((t, index) => {
      const meta = parseMetadata(t.remarks);
      return [
        index + 1,
        escapeCSV(` ${t.operationDate || meta.manualDate || t.createdAt?.split('T')[0]}`.trim()),
        t.location || meta.location, t.category || meta.category, t.issueDescription,
        t.actionTaken || meta.actionTaken, t.instructionBy || meta.instructionBy, t.receivedTime || meta.receivedTime,
        t.endTime || meta.endTime, t.totalTime || meta.totalTime, t.assignedTo?.name || 'Unassigned', t.status
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName}_tickets_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const printToPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>${projectName} Logs Export</title>
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
          <h1>${projectName} Logs Report</h1>
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
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-main pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Briefcase className="mr-3 text-teal-500" size={28} />
            {projectName} - Maintenance Logs
          </h1>
          <p className="text-sm text-secondary mt-1 uppercase tracking-widest">Project-Specific Operations</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button onClick={() => navigate('/projects')} className="px-4 py-2 text-xs font-bold text-secondary hover:text-main transition-colors bg-panel rounded-xl border border-main">
            Back to Projects
          </button>
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-dim" />
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="glass-input px-3 py-2 text-xs w-36 cursor-pointer" title="From Month" />
            <span className="text-secondary text-xs">to</span>
            <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="glass-input px-3 py-2 text-xs w-36 cursor-pointer" title="To Month" />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
            <input type="text" placeholder="Search project tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="glass-input w-full !pl-10 pr-4 py-2 text-sm" />
          </div>
          <button onClick={handleDownload} className="p-2 text-dim hover:text-main hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10" title="Download CSV">
            <Download size={18} />
          </button>
          <button onClick={printToPDF} className="p-2 text-dim hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all border border-transparent hover:border-purple-500/30" title="Print PDF">
            <Printer size={18} />
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowModal(true); }} className="glass-button flex items-center px-5 py-2 text-sm shrink-0">
              <Plus size={18} className="mr-2" />
              New Daily Log
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#f59e0b', opacity: 0.1, filter: 'blur(20px)' }}></div>
            <div className="flex justify-between items-start">
              <h3 className="text-[10px] font-bold text-amber-500 tracking-[0.2em] uppercase">[Project Pipeline]</h3>
              <Activity size={18} className="text-amber-500 opacity-50 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col space-y-3 mt-4 text-left">
              <div className="flex items-end space-x-2 font-mono">
                <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.6)' }}>{summaryStats.open + summaryStats.inProgress}</span>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pb-1">Open Issues</span>
              </div>
            </div>
          </div>

          <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#10b981', opacity: 0.1, filter: 'blur(20px)' }}></div>
            <div className="flex justify-between items-start">
              <h3 className="text-[10px] font-bold text-emerald-500 tracking-[0.2em] uppercase">[Site Resolution]</h3>
              <CheckCircle size={18} className="text-emerald-500 opacity-50 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col space-y-3 mt-4 text-left">
              <div className="flex items-end space-x-2 font-mono">
                <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.6)' }}>
                  {summaryStats.total > 0 ? Math.round((summaryStats.completed / summaryStats.total) * 100) : 0}%
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest pb-1">Completed</span>
              </div>
            </div>
          </div>

          <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#3b82f6', opacity: 0.1, filter: 'blur(20px)' }}></div>
            <div className="flex justify-between items-start">
              <h3 className="text-[10px] font-bold text-blue-500 tracking-[0.2em] uppercase">[Total Activity]</h3>
              <Briefcase size={18} className="text-blue-500 opacity-50 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex flex-col space-y-3 mt-4 text-left">
              <div className="flex items-end space-x-2 font-mono">
                <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.6)' }}>{summaryStats.total}</span>
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pb-1">Logs Recorded</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="glass-panel p-6 bg-card border-main shadow-sm flex items-center justify-center min-h-[140px]">
          {chartData.length > 0 ? (
            <div className="w-full h-full">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={35}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--glass-border)', 
                      borderRadius: '8px', 
                      fontSize: '10px',
                      padding: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest text-center">No Data Available</p>
          )}
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
              {filteredTickets.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredTickets.length)}-${Math.min(currentPage * itemsPerPage, filteredTickets.length)} of ${filteredTickets.length}`}
            </span>
            <button disabled={currentPage >= Math.ceil(filteredTickets.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>


      <div className="glass-panel overflow-hidden border border-main shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest text-center w-12">S.No</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Date</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Type of Work</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest w-[40%]">Working Details / Progress</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest text-center">Time (Start/End/Total)</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Done By</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y border-main text-main">
              {loading ? (
                <tr><td colSpan="10" className="p-20 text-center text-dim">Loading project tickets...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan="10" className="p-20 text-center text-dim">No tickets found for this project.</td></tr>
              ) : filteredTickets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((ticket, index) => {
                const meta = parseMetadata(ticket.remarks);
                const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
                const assignedUser = ticket.assignedTo && typeof ticket.assignedTo === 'object'
                  ? ticket.assignedTo
                  : users.find(u => (u.id || u._id) === assignedId);
                return (
                  <tr 
                    key={ticket.id || ticket._id} 
                    className="hover:bg-panel transition-colors group cursor-pointer"
                    onClick={() => navigate(`/tickets/${ticket.id || ticket._id}`)}
                  >
                    <td className="p-4 text-center font-mono text-[10px] text-dim">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className="p-4 text-[11px] text-secondary font-mono">
                      {ticket.operationDate || meta.manualDate || ticket.createdAt?.split('T')[0]}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 border border-teal-500/20 text-[9px] font-bold uppercase tracking-wider">
                        {ticket.category || 'Installation'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-[12px] text-white line-clamp-3 leading-relaxed">{ticket.issueDescription}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-center space-y-0.5">
                        <span className="text-[9px] text-emerald-500 font-mono" title="Start Time">{ticket.receivedTime || meta.receivedTime || '--:--'}</span>
                        <span className="text-[9px] text-red-500 font-mono" title="End Time">{ticket.endTime || meta.endTime || '--:--'}</span>
                        <div className="h-[1px] w-6 bg-main"></div>
                        <span className="text-[9px] text-main font-bold" title="Total Duration">{ticket.totalTime || meta.totalTime || '0h 0m'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col space-y-1">
                        {Array.isArray(ticket.assignedStaff) && ticket.assignedStaff.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {ticket.assignedStaff.map(s => {
                              const nameStr = typeof s === 'object' ? s.name : (users.find(u => (u.id || u._id) === s)?.name || 'Staff');
                              return (
                                <span key={typeof s === 'object' ? (s.id || s._id) : s} className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-blue-500/30 text-blue-400 bg-blue-500/10">
                                  {nameStr}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 text-[11px] text-secondary">
                            {(() => {
                              const displayUser = assignedUser || ticket.raisedBy;
                              return (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[8px] font-bold text-blue-400">
                                    {String(displayUser?.name || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-white">
                                    {displayUser?.name || 'Unassigned'}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                        ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/20' :
                        ticket.status === 'In Progress' ? 'text-orange-400 border-orange-500/20' :
                        'text-red-400 border-red-500/20'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end space-x-1">
                          {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                            <button onClick={() => handleEdit(ticket)} className="p-1 hover:text-blue-400 transition-all"><Edit2 size={12} /></button>
                          )}
                          {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                            <button onClick={() => handleDelete(ticket.id || ticket._id)} className="p-1 hover:text-red-400 transition-all"><Trash2 size={12} /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-card rounded-[2.5rem] w-full max-w-4xl border border-main shadow-2xl my-8 overflow-hidden">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
              <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                {editingId ? 'Modify Project Log' : `New Log for ${projectName}`}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-dim hover:text-main p-2 hover:bg-card rounded-xl transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Ref ID</label>
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl text-xs font-mono text-dim">
                    {editingId ? `LOG-TRK-${editingId}` : 'AUTO-GEN-UID'}
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Operation Date</label>
                  <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="glass-input w-full p-4 text-xs bg-panel border-main font-bold" />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Type of Work</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-4 text-xs bg-panel border-main cursor-pointer font-bold">
                    <option value="Installation">Installation</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Testing">Testing</option>
                    <option value="Cabling">Cabling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Site Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="glass-input w-full p-4 text-xs bg-panel border-main cursor-pointer font-bold">
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                  <MapPin size={16} className="text-teal-500" />
                  <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Location Intelligence</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-panel/30 rounded-3xl border border-main">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">College</label>
                    <ComboInput 
                      required 
                      name="divisionName" 
                      value={formData.divisionName} 
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, block: '', floor: '', room: '' }));
                      }}
                      options={Array.from(new Set([
                        ...(divisions ? divisions.map(o => o.name) : [])
                      ])).filter(Boolean).sort()}
                      placeholder="Select or Type Division..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Block</label>
                    <ComboInput 
                      required 
                      name="block" 
                      value={formData.block} 
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, floor: '', room: '' }));
                      }}
                      options={(() => {
                        const filtered = allLocations.filter(l => !formData.divisionName || String(l.divisionName || '').toUpperCase() === String(formData.divisionName || '').toUpperCase()).map(l => l.block);
                        const unique = Array.from(new Set(filtered)).filter(Boolean).sort();
                        if (unique.length > 0) return unique;
                        return Array.from(new Set(allLocations.map(l => l.block))).filter(Boolean).sort();
                      })()}
                      placeholder="Block name..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Floor</label>
                    <ComboInput 
                      required 
                      name="floor" 
                      value={formData.floor} 
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({ ...prev, room: '' }));
                      }}
                      options={(() => {
                        const filtered = allLocations.filter(l => (!formData.divisionName || String(l.divisionName || '').toUpperCase() === String(formData.divisionName || '').toUpperCase()) && (!formData.block || String(l.block || '').toUpperCase() === String(formData.block || '').toUpperCase())).map(l => l.floor);
                        const unique = Array.from(new Set(filtered)).filter(Boolean).sort();
                        if (unique.length > 0) return unique;
                        const filteredBlockOnly = allLocations.filter(l => !formData.block || String(l.block || '').toUpperCase() === String(formData.block || '').toUpperCase()).map(l => l.floor);
                        const uniqueBlockOnly = Array.from(new Set(filteredBlockOnly)).filter(Boolean).sort();
                        return uniqueBlockOnly;
                      })()}
                      placeholder="Floor..." 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Room</label>
                    <ComboInput 
                      name="room" 
                      value={formData.room} 
                      onChange={handleInputChange} 
                      options={(() => {
                        const filtered = allLocations.filter(l => (!formData.divisionName || String(l.divisionName || '').toUpperCase() === String(formData.divisionName || '').toUpperCase()) && (!formData.block || String(l.block || '').toUpperCase() === String(formData.block || '').toUpperCase()) && (!formData.floor || String(l.floor || '').toUpperCase() === String(formData.floor || '').toUpperCase())).map(l => l.room);
                        const unique = Array.from(new Set(filtered)).filter(Boolean).sort();
                        if (unique.length > 0) return unique;
                        const filteredBlockFloor = allLocations.filter(l => (!formData.block || String(l.block || '').toUpperCase() === String(formData.block || '').toUpperCase()) && (!formData.floor || String(l.floor || '').toUpperCase() === String(formData.floor || '').toUpperCase())).map(l => l.room);
                        const uniqueBlockFloor = Array.from(new Set(filteredBlockFloor)).filter(Boolean).sort();
                        return uniqueBlockFloor;
                      })()}
                      placeholder="Select or Type Room..." 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-teal-500 mb-4">
                    <Activity size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Work Log Details</span>
                  </div>
                  
                  <div className="space-y-4">

                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Raised By</label>
                      <input type="text" name="raisedByName" value={formData.raisedByName} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Name of person raising ticket" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Done By (Responsible Manager)</label>
                      <select name="assignedTo" value={formData.assignedTo} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer">
                        <option value="">Select Manager / Admin</option>
                        {users.map(u => <option key={u.id || u._id} value={u.id || u._id}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Working Details / Progress</label>
                      <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[140px] resize-none bg-panel border-main text-white" placeholder="Describe the work done today..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between text-blue-500 mb-4">
                    <div className="flex items-center space-x-2">
                      <Shield size={16} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Responsibility & Logistics</span>
                    </div>
                    <button type="button" onClick={() => setShowStaffAdd(!showStaffAdd)} className="text-[9px] font-black text-teal-500 hover:text-teal-400 uppercase tracking-widest flex items-center">
                      <Plus size={14} className="mr-1" /> Quick Add Staff
                    </button>
                  </div>

                  {formData.assignedTo && (
                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 rounded-xl max-w-max animate-fade-in mt-2">
                      <span className="text-[8px] font-black text-teal-400 uppercase tracking-widest">Site Responsibility:</span>
                      <span className="text-[10px] font-bold text-white">
                        {staff.find(s => (s.id || s._id) === formData.assignedTo)?.name || 'Loading...'}
                      </span>
                    </div>
                  )}

                  <div className="space-y-6">
                    {showStaffAdd && (
                      <div className="flex items-center space-x-2 animate-slide-down">
                        <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="glass-input flex-1 p-2 text-xs" placeholder="Staff Name" />
                        <button type="button" onClick={handleAddQuickStaff} className="p-2 bg-teal-600 rounded-lg text-white"><CheckCircle size={16} /></button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                      {staff.map(s => (
                        <div key={s.id || s._id} className="group/staff relative">
                          <button type="button" onClick={() => toggleStaffSelection(s.id || s._id)} className={`w-full px-4 py-2.5 rounded-xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${formData.assignedStaff.includes(s.id || s._id) ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20' : 'bg-panel text-secondary border-main hover:border-teal-500/30'}`}>
                            {s.name}
                            {(s.id || s._id) === formData.assignedTo && (
                              <span className="ml-1.5 text-[8px] font-bold text-teal-300 uppercase tracking-wider">
                                (Responsibility)
                              </span>
                            )}
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover/staff:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => handleEditStaff(e, s)} className="p-1 hover:text-blue-400 bg-black/20 rounded backdrop-blur-sm"><Edit2 size={10} /></button>
                            <button type="button" onClick={(e) => handleDeleteStaff(e, s.id || s._id)} className="p-1 hover:text-red-400 bg-black/20 rounded backdrop-blur-sm"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-dim uppercase tracking-widest">Start Time</label>
                          <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-2 text-xs font-mono bg-panel border-main" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-10 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-3 text-[10px] font-black text-dim hover:text-main uppercase tracking-[0.2em] transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="w-64 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                  {submitting ? 'PROCESSING...' : (editingId ? 'COMMIT CHANGES' : 'INITIALIZE PROJECT LOG')}
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
                    className="glass-input w-full p-3 text-sm bg-panel border-main"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">On Site Time</label>
                  <input 
                    type="time" 
                    value={inProgressData.time}
                    onChange={(e) => setInProgressData({...inProgressData, time: e.target.value})}
                    className="glass-input w-full p-3 text-sm font-mono bg-panel border-main"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Staff On Site Image (Optional)</label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload size={18} className="text-dim mb-1" />
                        <p className="text-[10px] text-dim font-bold">Upload Site Image</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 2 * 1024 * 1024) {
                            setInProgressData({...inProgressData, image: file});
                          } else if (file) {
                            showNotification('Image exceeds 2MB', 'error');
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
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload size={18} className="text-dim mb-1" />
                        <p className="text-[10px] text-dim font-bold">Upload Site Video</p>
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
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
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
                      formDataToSend.append('remark', 'Status updated to In Progress (Staff on Site)');

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
              <button onClick={() => setShowCompletionModal(false)} className="text-dim hover:text-main p-2 hover:bg-card rounded-xl transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Completion Date</label>
                  <input 
                    type="date" 
                    value={completionData.date}
                    onChange={(e) => setCompletionData({...completionData, date: e.target.value})}
                    className="glass-input w-full p-3 text-sm bg-panel border-main font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Completion Time</label>
                  <input 
                    type="time" 
                    value={completionData.endTime}
                    onChange={(e) => setCompletionData({...completionData, endTime: e.target.value})}
                    className="glass-input w-full p-3 text-sm font-mono bg-panel border-main font-bold"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Resolution Remark</label>
                <textarea 
                  required
                  value={completionData.remark}
                  onChange={(e) => setCompletionData({...completionData, remark: e.target.value})}
                  placeholder="Describe the final action taken to resolve this log..."
                  className="glass-input w-full p-4 text-sm min-h-[120px] resize-none bg-panel border-main font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Service Image (Completed Image)</label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload size={18} className="text-dim mb-1" />
                        <p className="text-[10px] text-dim font-bold">Upload Completed Image</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file && file.size <= 2 * 1024 * 1024) {
                            setCompletionData({...completionData, image: file});
                          } else if (file) {
                            showNotification('Image exceeds 2MB', 'error');
                          }
                        }}
                      />
                    </label>
                  </div>
                  {completionData.image && (
                    <div className="mt-2 flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <span className="text-[10px] text-emerald-400 font-bold truncate max-w-[200px]">{completionData.image.name}</span>
                      <button onClick={() => setCompletionData({...completionData, image: null})} className="text-emerald-400"><X size={14} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Service Video (Optional)</label>
                <div className="mt-2">
                  <div className="flex space-x-2 w-full">
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
                      <div className="flex flex-col items-center justify-center pt-2 pb-3">
                        <Upload size={18} className="text-dim mb-1" />
                        <p className="text-[10px] text-dim font-bold">Upload Completed Video</p>
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
                    <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all animate-fade-in">
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

              <div className="flex space-x-4 pt-4">
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
                      const meta = parseMetadata(completionTicket.remarks);

                      const formData = new FormData();
                      formData.append('status', 'Completed');
                      formData.append('completedDate', completionData.date);
                      formData.append('completedTime', completionData.endTime);
                      formData.append('actionTaken', completionData.remark);
                      formData.append('endTime', completionData.endTime);
                      formData.append('totalTime', calculateTotalTime(completionTicket.receivedTime || meta.receivedTime || '09:00', completionData.endTime));
                      formData.append('remark', `Completed: ${completionData.remark}`);
                      if (completionData.image) {
                        formData.append('completedImage', completionData.image);
                      }
                      if (completionData.video) {
                        formData.append('completedVideo', completionData.video);
                      }

                      await api.patch(`/tickets/${id}/`, formData);

                      showNotification('Log finalized and completed', 'success');
                      setShowCompletionModal(false);
                      if (showModal) setShowModal(false);
                      fetchData();
                    } catch (err) {
                      console.error(err);
                      showNotification('Failed to finalize log', 'error');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg uppercase"
                >
                  {submitting ? 'PROCESSING...' : 'COMPLETE WORK LOG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
