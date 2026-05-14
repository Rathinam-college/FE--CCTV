import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, User as UserIcon, CheckCircle,
  Maximize2, Minimize2, Activity, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';
import { useNavigate } from 'react-router-dom';

export default function Tickets() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [projects, setProjects] = useState([]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [expandedSidePanel, setExpandedSidePanel] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newRemark, setNewRemark] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTicket, setCompletionTicket] = useState(null);
  const [completionData, setCompletionData] = useState({
    remark: '',
    endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    beforeImage: null,
    afterImage: null,
    beforeRemark: '',
    beforeDate: new Date().toISOString().split('T')[0],
    beforeTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  });
  const [completionStep, setCompletionStep] = useState(1);
  const { allLocations, fetchAllLocations } = useSiteStore();
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

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
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    raisedBy: '',
    assignedTo: '',
    assignedStaff: [],
    location: '',
    category: 'CCTV',
    issueDescription: '',
    actionTaken: '',
    instructionBy: '',
    receivedTime: '',
    endTime: '',
    projectId: '',
    status: 'Open'
  });

  useEffect(() => {
    fetchData();
    fetchStaff();
    fetchAllLocations();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/tickets/staff/');
      setStaff(res.data);
    } catch (err) {
      console.error('Error fetching staff:', err);
    }
  };

  const handleEditStaff = async (e, s) => {
    e.stopPropagation();
    const newName = prompt('Enter new name for staff member:', s.name);
    if (!newName || newName === s.name) return;
    try {
      const res = await api.put(`/tickets/staff/${s.id || s._id}/`, { name: newName.trim() });
      setStaff(staff.map(item => (item.id || item._id) === (s.id || s._id) ? res.data : item));
      showNotification('Staff member updated', 'success');
    } catch (err) {
      showNotification('Failed to update staff member', 'error');
    }
  };

  const handleDeleteStaff = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this staff member? This will remove them from all associated tickets.')) return;
    try {
      await api.delete(`/tickets/staff/${id}/`);
      setStaff(staff.filter(s => (s.id || s._id) !== id));
      setFormData(prev => ({
        ...prev,
        assignedStaff: prev.assignedStaff.filter(sId => sId !== id)
      }));
      showNotification('Staff member removed', 'success');
    } catch (err) {
      showNotification('Failed to delete staff member', 'error');
    }
  };

  const handleAddQuickStaff = async () => {
    if (!newStaffName.trim()) return;
    try {
      const res = await api.post('/tickets/staff/', { name: newStaffName.trim() });
      setStaff([...staff, res.data]);
      setFormData(prev => ({
        ...prev,
        assignedStaff: [...prev.assignedStaff, res.data.id || res.data._id]
      }));
      setNewStaffName('');
      setIsAddingStaff(false);
      showNotification('New staff member added', 'success');
    } catch (err) {
      showNotification('Failed to add staff member', 'error');
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
      setTickets((ticketRes.data || []).filter(t => !t.projectId && !t.project));
      setUsers(userRes.data);
      setProjects(projectRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const parseMetadata = (remarks) => {
    try {
      return JSON.parse(remarks);
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
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Cascading clear logic for location
      if (name === 'collegeName' || name === 'block' || name === 'floor' || name === 'room') {
        if (name === 'collegeName') {
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
          l.collegeName === (name === 'collegeName' ? value : newData.collegeName) &&
          l.block === (name === 'block' ? value : newData.block) &&
          l.floor === (name === 'floor' ? value : newData.floor) &&
          l.room === (name === 'room' ? value : newData.room)
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0].map(h => h.trim());
      const data = rows.slice(1).filter(row => row.length > 1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let val = row[index]?.trim() || '';
          if (header.toLowerCase() === 'date') obj['date'] = val;
          else if (header.toLowerCase() === 'location') obj['location'] = val;
          else if (header.toLowerCase() === 'category') obj['category'] = val || 'CCTV';
          else if (header.toLowerCase() === 'issue description') obj['issueDescription'] = val;
          else if (header.toLowerCase() === 'action taken') obj['actionTaken'] = val;
          else if (header.toLowerCase() === 'assigned to') obj['assignedTo'] = val;
          else if (header.toLowerCase() === 'status') obj['status'] = val || 'Open';
          else obj[header] = val;
        });
        if (!obj.date) obj.date = new Date().toISOString().split('T')[0];
        return obj;
      });

      try {
        await api.post('/tickets/bulk_create/', data);
        showNotification(`Successfully imported ${data.length} maintenance tickets`);
        fetchData();
      } catch (err) {
        console.error(err);
        showNotification('Failed to import data. Check CSV format.', 'error');
      }
    };
    reader.readAsText(file);
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
        projectId: formData.projectId || null,
        operationDate: formData.date,
        collegeName: formData.collegeName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room}` || formData.location,
        category: formData.category,
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        receivedTime: formData.receivedTime,
        endTime: formData.endTime,
        totalTime: calculateTotalTime(formData.receivedTime, formData.endTime),
        remarks: formData.remarks || '',
        raisedBy: user._id || user.id,
      };

      if (editingId) {
        payload.cameraId = currentTicket?.cameraId?.id || currentTicket?.cameraId;
        payload.raisedBy = currentTicket?.raisedBy?.id || currentTicket?.raisedBy || user._id || user.id;
        await api.put(`/tickets/${editingId}/`, payload);
        showNotification('Ticket updated successfully');
      } else {
        payload.cameraId = null;
        await api.post('/tickets/', payload);
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
      collegeName: '',
      block: '',
      floor: '',
      room: '',
      location: '',
      category: 'CCTV',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      receivedTime: '',
      endTime: '',
      assignedTo: '',
      assignedStaff: [],
      projectId: '',
      status: 'Open'
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
      collegeName: ticket.collegeName || '',
      block: ticket.block || '',
      floor: ticket.floor || '',
      room: ticket.room || '',
      location: ticket.location || meta.location || '',
      category: ticket.category || meta.category || 'CCTV',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || meta.actionTaken || '',
      instructionBy: ticket.instructionBy || meta.instructionBy || '',
      receivedTime: ticket.receivedTime || meta.receivedTime || '',
      endTime: ticket.endTime || meta.endTime || '',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo || '',
      assignedStaff: ticket.assignedStaff ? ticket.assignedStaff.map(s => s.id || s._id) : [],
      projectId: ticket.projectId?.id || ticket.projectId || '',
      status: ticket.status || 'Open'
    });
    setEditingId(ticket.id || ticket._id);
    setCurrentTicket(ticket);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      try {
        await api.delete(`/tickets/${id}/`);
        showNotification('Ticket deleted successfully');
        fetchData();
      } catch (err) {
        console.error('Error deleting ticket:', err);
        showNotification('Failed to delete ticket', 'error');
      }
    }
  };

  const filteredTickets = Array.isArray(tickets) ? tickets.filter(ticket => {
    const meta = parseMetadata(ticket.remarks);
    const ticketDate = meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : '');
    
    // Month filter
    if (selectedMonth && !ticketDate.startsWith(selectedMonth)) return false;

    // Status filter
    if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;

    // Search filter
    const searchStr = `${ticket.issueDescription} ${meta.location} ${meta.category} ${ticket.project?.name || ''}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  }) : [];

  const handleDownload = () => {
    if (filteredTickets.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'Date', 'College', 'Block', 'Floor', 'Room', 'Location String', 'Category', 'Project', 'Issue Description', 
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

    const rows = filteredTickets.map(ticket => {
      const meta = parseMetadata(ticket.remarks);
      const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
      const assignedUser = users.find(u => (u.id || u._id) === assignedId);
      
      return [
        escapeCSV(ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')),
        escapeCSV(ticket.collegeName || ''),
        escapeCSV(ticket.block || ''),
        escapeCSV(ticket.floor || ''),
        escapeCSV(ticket.room || ''),
        escapeCSV(ticket.location || meta.location || 'N/A'),
        escapeCSV(ticket.category || meta.category || 'CCTV'),
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

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Tag className="mr-3 text-blue-400" size={28} />
            Ticket Management
          </h1>
          <p className="text-sm text-dim mt-1">Operational maintenance logging and tracking system</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button 
            onClick={() => navigate('/maintenance')}
            className="px-4 py-2 text-xs font-bold text-dim hover:text-main transition-colors flex items-center bg-white/5 rounded-xl border border-white/10"
          >
            <LayoutGrid size={16} className="mr-2" />
            Board View
          </button>
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-dim" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="glass-input px-3 py-2 text-xs w-40 cursor-pointer"
              title="Filter by Month"
            />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
            <input 
              type="text" 
              placeholder="Search tickets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full !pl-14 pr-4 py-2 text-sm"
            />
          </div>
          <div className="flex space-x-3">
            <button onClick={handleDownload} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-teal-500/10 border-teal-500/30 text-teal-600 hover:bg-teal-500/20 transition-all">
              <Download size={18} className="mr-2" />
              Export CSV
            </button>
            {canEdit && (
              <>
                <label className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 transition-all cursor-pointer">
                  <Upload size={18} className="mr-2" /> Upload CSV
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                <button onClick={() => { resetForm(); setShowModal(true); }} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
                  <Plus size={18} className="mr-2" />
                  Raise Ticket
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Active Pipeline</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">{summaryStats.open + summaryStats.inProgress}</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pb-1">Requires Action</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Resolution Rate</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">
                {summaryStats.total > 0 ? Math.round((summaryStats.completed / summaryStats.total) * 100) : 0}%
              </span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest pb-1">Efficiency</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Total Managed</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">{summaryStats.total}</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pb-1">Log Entries</span>
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

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-2xl border border-main">
        <div className="flex p-1 bg-card rounded-xl border border-main">
          {['ALL', 'Open', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                statusFilter === status 
                  ? 'bg-teal-500 text-white shadow-lg' 
                  : 'text-secondary hover:text-main hover:bg-panel'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-main mx-2"></div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Displaying:</span>
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{filteredTickets.length} Records</span>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="glass-panel overflow-hidden border border-main shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Date</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Location</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Category</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Project</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest w-1/4">Nature of Problem</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest">Action Taken</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest">Instruction By</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest text-center">Time (R/E/T)</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest">Responsibility</th>
                <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-4 text-[11px] font-bold text-blue-300 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
              {loading ? (
                <tr>
                  <td colSpan="11" className="p-20 text-center text-dim">
                    Loading tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="11" className="p-20 text-center text-dim">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const meta = parseMetadata(ticket.remarks);
                  const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
                  const assignedUser = users.find(u => (u.id || u._id) === assignedId);
                  
                  return (
                    <tr 
                      key={ticket.id || ticket._id} 
                      className="hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={(e) => {
                        if (e.target.closest('button') || e.target.closest('select')) return;
                        setSelectedTicket(ticket);
                        setShowSidePanel(true);
                        if (ticket.status === 'Completed' && user?.role !== 'Super Admin') {
                          showNotification('Viewing completed ticket (Read-only)', 'info');
                        }
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center text-dim font-mono text-xs">
                          <Calendar size={12} className="mr-2 text-dim/50" />
                          {ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col text-main font-semibold text-[10px] space-y-0.5">
                          <div className="flex items-center text-blue-400">
                             <MapPin size={10} className="mr-1" />
                             {ticket.collegeName || 'N/A'}
                          </div>
                          <div className="pl-3.5 text-dim">
                             {ticket.block} | {ticket.floor} | {ticket.room}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                          {ticket.category || meta.category || 'CCTV'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center text-xs text-dim font-medium">
                          <Briefcase size={12} className="mr-2 text-blue-400" />
                          {ticket.project?.name || 'Independent'}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-xs text-dim line-clamp-2 leading-relaxed italic">
                          {ticket.issueDescription}
                        </p>
                      </td>
                      <td className="p-4 text-xs text-dim">
                        {ticket.actionTaken || meta.actionTaken || <span className="text-dim/40 italic">Pending...</span>}
                      </td>
                      <td className="p-4 text-xs text-main font-medium">
                        {ticket.instructionBy || meta.instructionBy || 'N/A'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-center space-y-1">
                          <span className="text-[10px] text-emerald-400 font-mono">{ticket.receivedTime || meta.receivedTime || '--:--'}</span>
                          <span className="text-[10px] text-red-400 font-mono">{ticket.endTime || meta.endTime || '--:--'}</span>
                          <div className="h-[1px] w-8 bg-white/10"></div>
                          <span className="text-[10px] text-main font-bold">{ticket.totalTime || meta.totalTime || '0h 0m'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col space-y-1">
                          {ticket.assignedStaff && ticket.assignedStaff.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {ticket.assignedStaff.map(s => (
                                <span key={s.id || s._id} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-black uppercase tracking-wider">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                                {(assignedUser?.name || 'U').charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <span className="text-[11px] text-dim font-medium">{assignedUser?.name || 'Unassigned'}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {canEdit && (ticket.status !== 'Completed' || user?.role === 'Super Admin') ? (
                          <select
                            value={ticket.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'Completed') {
                                setCompletionTicket(ticket);
                                setCompletionData({
                                  remark: '',
                                  endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                  date: new Date().toISOString().split('T')[0],
                                  beforeImage: null,
                                  afterImage: null,
                                  beforeRemark: '',
                                  beforeDate: new Date().toISOString().split('T')[0],
                                  beforeTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                });
                                setCompletionStep(1);
                                setShowCompletionModal(true);
                                return;
                              }
                              try {
                                await api.patch(`/tickets/${ticket.id || ticket._id}/`, { status: newStatus });
                                fetchData();
                              } catch (err) {
                                console.error('Error updating status:', err);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border bg-transparent cursor-pointer transition-all outline-none ${
                              ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10' :
                              ticket.status === 'In Progress' ? 'text-orange-400 border-orange-500/20 hover:bg-orange-500/10' :
                              'text-red-400 border-red-500/20 hover:bg-red-500/10'
                            }`}
                          >
                            <option value="Open" className="bg-card">Open</option>
                            <option value="In Progress" className="bg-card">In Progress</option>
                            <option value="Completed" className="bg-card">Completed</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                            ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/20' :
                            ticket.status === 'In Progress' ? 'text-orange-400 border-orange-500/20' :
                            'text-red-400 border-red-500/20'
                          }`}>
                            {ticket.status}
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="p-4 text-right">
                          <div className="flex justify-end space-x-1">
                            {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                              <button onClick={() => handleEdit(ticket)} className="p-1.5 text-dim hover:text-blue-400 hover:bg-blue-500/10 rounded transition-all">
                                <Edit2 size={14} />
                              </button>
                            )}
                            {(ticket.status !== 'Completed' || user?.role === 'Super Admin') && (
                              <button onClick={() => handleDelete(ticket.id || ticket._id)} className="p-1.5 text-dim hover:text-red-400 hover:bg-red-500/10 rounded transition-all">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-main tracking-tight uppercase">
                  {editingId ? 'Modify Ticket' : 'Initialize Ticket'}
                </h2>
                <p className="text-[10px] text-secondary mt-1 uppercase tracking-[0.3em] font-black">Service Protocol Node</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
              {/* Section 1: Location Intelligence */}
              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-2">
                  <MapPin size={16} className="text-teal-500" />
                  <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Location Intelligence</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-panel/30 rounded-3xl border border-main">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">College</label>
                    <select name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select College</option>
                      {Array.from(new Set(allLocations.map(l => l.collegeName))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Block</label>
                    <select name="block" value={formData.block} onChange={(e) => {
                      const { name, value } = e.target;
                      setFormData(prev => ({ ...prev, [name]: value, floor: '', room: '' }));
                    }} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Block</option>
                      {Array.from(new Set(
                        allLocations
                          .filter(l => !formData.collegeName || l.collegeName === formData.collegeName)
                          .map(l => l.block)
                      )).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Floor</label>
                    <select name="floor" value={formData.floor} onChange={(e) => {
                      const { name, value } = e.target;
                      setFormData(prev => ({ ...prev, [name]: value, room: '' }));
                    }} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Floor</option>
                      {Array.from(new Set(
                        allLocations
                          .filter(l => !formData.block || l.block === formData.block)
                          .map(l => l.floor)
                      )).map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Room</label>
                    <select name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-2.5 text-xs cursor-pointer bg-panel border-main">
                      <option value="">Select Room</option>
                      {Array.from(new Set(
                        allLocations
                          .filter(l => !formData.floor || l.floor === formData.floor)
                          .map(l => l.room)
                      )).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Logistical Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <Tag size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Logistics</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Operation Date</label>
                      <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Asset Category</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-3 text-xs cursor-pointer bg-panel border-main">
                        <option value="Assets">Assets / Infrastructure</option>
                        <option value="Storage">Storage Units</option>
                        <option value="Identity">Identity Access</option>
                        <option value="Network">Network Nodes</option>
                        <option value="Other">Other Hardware</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                      <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Name of authorize officer" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                   <div className="flex items-center space-x-3 mb-2">
                    <Briefcase size={16} className="text-amber-500" />
                    <h3 className="text-[10px] font-black text-main uppercase tracking-[0.4em]">Incident Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Site Administrator (Responsible)</label>
                      <select 
                        name="assignedTo" 
                        value={formData.assignedTo} 
                        onChange={handleInputChange} 
                        className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer"
                      >
                        <option value="">No Administrator Linked</option>
                        {users.map(u => (
                          <option key={u.id || u._id} value={u.id || u._id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                      {formData.assignedTo && (
                        <p className="text-[8px] text-teal-500 font-bold mt-1 uppercase tracking-widest">Linked from Location Registry</p>
                      )}
                    </div>
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
                    <div className="flex space-x-2 animate-slide-down bg-panel p-4 rounded-2xl border border-teal-500/30">
                      <input 
                        autoFocus
                        type="text" 
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="glass-input flex-1 p-2 text-xs bg-panel border-main"
                        placeholder="Staff Name..."
                      />
                      <button type="button" onClick={handleAddQuickStaff} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Save</button>
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
                  
                  <div className="grid grid-cols-2 gap-6 bg-panel p-6 rounded-[2.5rem] border border-main">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest">Received</label>
                      <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main font-mono" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest">End Time</label>
                      <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main font-mono" />
                    </div>
                    <div className="col-span-2 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex justify-between items-center">
                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Calculated Duration</span>
                      <span className="text-lg font-black text-blue-500">{calculateTotalTime(formData.receivedTime, formData.endTime) || '0h 0m'}</span>
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
                            if (status === 'Completed') {
                              setCompletionTicket(editingId ? currentTicket : formData);
                              setCompletionData({
                                remark: '',
                                endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                date: new Date().toISOString().split('T')[0],
                                beforeImage: null,
                                afterImage: null,
                                beforeRemark: '',
                                beforeDate: new Date().toISOString().split('T')[0],
                                beforeTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                              });
                              setCompletionStep(1);
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
                  </div>
                </div>
              </div>

              <div className="flex justify-end items-center space-x-6 mt-10 pt-8 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="text-xs font-black text-secondary hover:text-main uppercase tracking-[0.2em] transition-colors">Abort</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="glass-button px-16 py-4"
                >
                  {submitting ? 'PROCESSING...' : (editingId ? 'COMMIT CHANGES' : 'INITIALIZE TICKET')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Side Details Panel */}
      {showSidePanel && selectedTicket && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] transition-all" onClick={() => setShowSidePanel(false)}></div>
          <div className={`fixed right-0 top-0 h-full bg-main border-l border-main z-[70] shadow-[0_0_80px_rgba(0,0,0,0.4)] flex flex-col transition-all duration-500 ease-in-out ${
            expandedSidePanel ? 'w-full max-w-7xl' : 'w-full max-w-lg'
          }`}>
            <div className="p-8 border-b border-main bg-card/80 backdrop-blur-md flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <Info size={24} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-main tracking-tight uppercase">Ticket Overview</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[10px] font-black text-dim uppercase tracking-[0.3em] bg-panel px-2 py-0.5 rounded">Trace: #{selectedTicket.id || selectedTicket._id}</span>
                    <div className="w-1 h-1 rounded-full bg-dim/30"></div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{selectedTicket.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setExpandedSidePanel(!expandedSidePanel)}
                  className="p-3 hover:bg-panel rounded-2xl text-dim hover:text-blue-500 transition-all border border-transparent hover:border-blue-500/20"
                  title={expandedSidePanel ? "Collapse" : "Expand to Full View"}
                >
                  {expandedSidePanel ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button onClick={() => setShowSidePanel(false)} className="p-3 hover:bg-red-500/10 rounded-2xl text-dim hover:text-red-500 transition-all border border-transparent hover:border-red-500/20">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar ${expandedSidePanel ? 'grid grid-cols-1 lg:grid-cols-12 gap-10' : 'space-y-10'}`}>
              <div className={`${expandedSidePanel ? 'lg:col-span-4 space-y-8' : 'space-y-8'}`}>
                <div className="glass-panel p-6 space-y-6 bg-gradient-to-br from-blue-500/[0.03] to-indigo-500/[0.03] border-blue-500/10">
                  <div className="flex justify-between items-center">
                    <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-sm border ${
                      selectedTicket.status === 'Completed' ? 'bg-emerald-500 text-white border-emerald-400' :
                      selectedTicket.status === 'In Progress' ? 'bg-orange-500 text-white border-orange-400' :
                      'bg-red-500 text-white border-red-400'
                    }`}>
                      {selectedTicket.status}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-dim uppercase tracking-widest">Received Date</span>
                      <span className="text-xs font-bold text-main">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-main to-transparent opacity-10"></div>

                  <div className="space-y-3">
                    <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em]">Issue Description</h4>
                    <div className="bg-panel/50 p-5 rounded-2xl border border-main shadow-inner">
                      <p className="text-sm text-main leading-relaxed font-bold italic opacity-90">
                        "{selectedTicket.issueDescription}"
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-card rounded-2xl border border-main">
                      <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Module</span>
                      <p className="text-sm text-main font-black uppercase tracking-wider">{selectedTicket.category || parseMetadata(selectedTicket.remarks).category || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-card rounded-2xl border border-main">
                      <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Point</span>
                      <p className="text-sm text-main font-black uppercase tracking-wider">{selectedTicket.location || parseMetadata(selectedTicket.remarks).location || 'N/A'}</p>
                    </div>
                  </div>

                  {(selectedTicket.workImage || selectedTicket.serviceImage) && (
                    <div className="space-y-4 animate-slide-up">
                       <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] pl-2">Service Artifacts (Evidence)</h4>
                       <div className="grid grid-cols-2 gap-4">
                          {selectedTicket.workImage && (
                            <div className="group relative">
                              <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">Before Work</span>
                              <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 bg-panel shadow-inner">
                                <img src={`${api.defaults.baseURL}${selectedTicket.workImage}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Before" />
                              </div>
                            </div>
                          )}
                          {selectedTicket.serviceImage && (
                            <div className="group relative">
                              <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-emerald-500/80 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">After Work</span>
                              <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 bg-panel shadow-inner">
                                <img src={`${api.defaults.baseURL}${selectedTicket.serviceImage}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="After" />
                              </div>
                            </div>
                          )}
                       </div>
                    </div>
                  )}
                </div>

                  {parseMetadata(selectedTicket.remarks).workStartTime && (
                    <div className="space-y-4 animate-slide-up">
                       <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] pl-2">Service Timeline</h4>
                       <div className="bg-card p-4 rounded-2xl border border-main space-y-4">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-dim font-bold uppercase tracking-widest">Execution Start</span>
                            <span className="text-main font-black">
                              {parseMetadata(selectedTicket.remarks).workStartDate} <span className="text-blue-500 font-mono ml-2">{parseMetadata(selectedTicket.remarks).workStartTime}</span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-dim font-bold uppercase tracking-widest">Completion</span>
                            <span className="text-main font-black">
                              {parseMetadata(selectedTicket.remarks).manualDate} <span className="text-emerald-500 font-mono ml-2">{parseMetadata(selectedTicket.remarks).endTime}</span>
                            </span>
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-dim uppercase tracking-[0.3em] pl-2">System Metadata</h4>
                     <div className="bg-card p-4 rounded-2xl border border-main space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-dim font-bold uppercase tracking-widest">Raised By</span>
                          <span className="text-main font-black">{selectedTicket.raisedByName || 'Authorized Staff'}</span>
                        </div>
                        <div className="h-px bg-main opacity-5"></div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-dim font-bold uppercase tracking-widest">Last Update</span>
                          <span className="text-main font-black">{selectedTicket.message_history?.[0]?.date || 'Today'}</span>
                        </div>
                     </div>
                  </div>
                </div>

              <div className={`${expandedSidePanel ? 'lg:col-span-8 space-y-6' : 'space-y-6'}`}>
                <div className="flex items-center justify-between border-b border-main pb-4">
                  <h4 className="text-sm font-black text-main uppercase tracking-[0.3em] flex items-center">
                    <MessageSquare size={18} className="mr-3 text-teal-500" />
                    Operational Activity Log
                  </h4>
                  <div className="bg-teal-500/10 text-teal-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {(selectedTicket.message_history || []).length} Points Recorded
                  </div>
                </div>
                
                <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-main before:opacity-10">
                  {(selectedTicket.message_history || []).length === 0 ? (
                    <div className="text-center py-20 bg-panel/30 rounded-[2.5rem] border-2 border-dashed border-main">
                      <div className="w-16 h-16 bg-panel rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <MessageSquare size={28} className="text-dim opacity-20" />
                      </div>
                      <p className="text-sm text-dim font-black uppercase tracking-[0.2em]">Zero Activity Logs Detected</p>
                      <p className="text-[10px] text-dim/50 uppercase tracking-widest mt-2">Initialize communication below</p>
                    </div>
                  ) : (
                    selectedTicket.message_history.map((msg, idx) => {
                      const isSystem = msg.remark?.toLowerCase().includes('ticket updated') || msg.remark?.toLowerCase().includes('initial ticket');
                      return (
                        <div key={idx} className="relative pl-12 animate-fade-in group" style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className={`absolute left-0 top-1 w-8 h-8 rounded-2xl border-4 border-main z-10 flex items-center justify-center transition-transform group-hover:scale-110 ${
                            isSystem ? 'bg-slate-700 shadow-lg' : 'bg-blue-600 shadow-lg'
                          }`}>
                            {isSystem ? <Activity size={12} className="text-white" /> : <Shield size={12} className="text-white" />}
                          </div>
                          
                          <div className={`rounded-3xl p-6 border transition-all duration-300 ${
                            isSystem 
                              ? 'bg-slate-500/[0.03] border-slate-500/10 hover:bg-slate-500/[0.06]' 
                              : 'bg-blue-600/[0.04] border-blue-600/10 shadow-sm hover:bg-blue-600/[0.08] hover:border-blue-600/20'
                          }`}>
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex flex-col">
                                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isSystem ? 'text-slate-500' : 'text-blue-600'}`}>
                                  {isSystem ? 'Protocol System' : (msg.user_name || 'Admin Technician')}
                                </span>
                                <div className="flex items-center text-[10px] text-dim font-bold mt-1 uppercase tracking-wider">
                                  <Clock size={12} className="mr-1.5 opacity-50" />
                                  {msg.date} <span className="mx-2 opacity-30">|</span> {msg.time}
                                </div>
                              </div>
                              {msg.device_status && (
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border-2 ${
                                  msg.device_status === 'Completed' ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10' :
                                  msg.device_status === 'In Progress' ? 'bg-orange-500/5 text-orange-600 border-orange-400/10' :
                                  'bg-red-500/5 text-red-600 border-red-500/10'
                                }`}>
                                  {msg.device_status}
                                </span>
                              )}
                            </div>
                            <div className="h-px bg-main opacity-5 mb-4"></div>
                            <p className={`text-sm leading-relaxed ${isSystem ? 'text-dim italic font-bold opacity-80' : 'text-main font-black'}`}>
                              {msg.remark}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className={`p-8 border-t border-main bg-card/80 backdrop-blur-md ${expandedSidePanel ? 'flex justify-center' : ''}`}>
              <div className={`w-full ${expandedSidePanel ? 'max-w-4xl' : ''}`}>
              {selectedTicket.status === 'Completed' && user?.role !== 'Super Admin' ? (
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center justify-center py-10 bg-emerald-500/[0.03] border-2 border-dashed border-emerald-500/20 rounded-[2.5rem]">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-emerald-500/20 shadow-lg">
                        <CheckCircle size={32} className="text-emerald-500" />
                      </div>
                      <p className="text-lg font-black text-emerald-600 uppercase tracking-tight">Maintenance Cycle Complete</p>
                      <p className="text-[10px] text-dim font-black uppercase tracking-[0.3em] mt-1 opacity-60">Verified Operational Integrity</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={addRemark} className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                    <textarea
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      placeholder="Add technical update or observation..."
                      className="glass-input relative w-full p-6 pr-16 text-sm min-h-[120px] resize-none focus:ring-4 focus:ring-blue-500/10 border-main transition-all placeholder:text-dim/40 font-bold rounded-[2rem] bg-panel/50 shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!newRemark.trim()}
                      className="absolute right-4 bottom-4 p-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:grayscale text-white rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:scale-105 active:scale-95 group/btn"
                    >
                      <Send size={22} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                    </button>
                  </form>
                  <div className="flex items-center justify-center space-x-3">
                    <div className="h-px w-8 bg-main opacity-10"></div>
                    <p className="text-[10px] text-dim font-black uppercase tracking-[0.4em] opacity-40">
                      Enterprise Audit Logging Active
                    </p>
                    <div className="h-px w-8 bg-main opacity-10"></div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </>
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
              <div className="flex items-center space-x-2 mb-4">
                <div className={`flex-1 h-1.5 rounded-full transition-all ${completionStep >= 1 ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
                <div className={`flex-1 h-1.5 rounded-full transition-all ${completionStep >= 2 ? 'bg-emerald-500' : 'bg-white/10'}`}></div>
              </div>

              {completionStep === 1 ? (
                <div className="space-y-6 animate-slide-up">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Work Start Date</label>
                      <input 
                        type="date" 
                        value={completionData.beforeDate}
                        onChange={(e) => setCompletionData({...completionData, beforeDate: e.target.value})}
                        className="glass-input w-full p-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Work Start Time</label>
                      <input 
                        type="time" 
                        value={completionData.beforeTime}
                        onChange={(e) => setCompletionData({...completionData, beforeTime: e.target.value})}
                        className="glass-input w-full p-3 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Work In-Progress Details</label>
                    <textarea 
                      required
                      value={completionData.beforeRemark}
                      onChange={(e) => setCompletionData({...completionData, beforeRemark: e.target.value})}
                      placeholder="Describe the initial work details or observations..."
                      className="glass-input w-full p-4 text-sm min-h-[120px] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Work In-Progress Image (Before Work)</label>
                    <div className="mt-2">
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-dim mb-2" />
                            <p className="mb-2 text-xs text-dim font-bold">Upload Before Image</p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file && file.size <= 2 * 1024 * 1024) {
                                setCompletionData({...completionData, beforeImage: file});
                              } else if (file) {
                                showNotification('Image exceeds 2MB', 'error');
                              }
                            }}
                          />
                        </label>
                      </div>
                      {completionData.beforeImage && (
                        <div className="mt-2 flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                          <span className="text-[10px] text-blue-400 font-bold truncate">{completionData.beforeImage.name}</span>
                          <button onClick={() => setCompletionData({...completionData, beforeImage: null})} className="text-blue-400"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
                    <button 
                      onClick={() => {
                        if (!completionData.beforeRemark.trim()) {
                          showNotification('Please provide work details', 'error');
                          return;
                        }
                        setCompletionStep(2);
                      }} 
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg"
                    >
                      NEXT: FINALIZATION
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-slide-up">
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
                    <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Final Service Image (After Work)</label>
                    <div className="mt-2">
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-white/5 border-white/10 transition-all">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload size={24} className="text-dim mb-2" />
                            <p className="mb-2 text-xs text-dim font-bold">Upload After Image</p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file && file.size <= 2 * 1024 * 1024) {
                                setCompletionData({...completionData, afterImage: file});
                              } else if (file) {
                                showNotification('Image exceeds 2MB', 'error');
                              }
                            }}
                          />
                        </label>
                      </div>
                      {completionData.afterImage && (
                        <div className="mt-2 flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <span className="text-[10px] text-emerald-400 font-bold truncate">{completionData.afterImage.name}</span>
                          <button onClick={() => setCompletionData({...completionData, afterImage: null})} className="text-emerald-400"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button onClick={() => setCompletionStep(1)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Back</button>
                    <button 
                      onClick={async () => {
                        if (!completionData.remark.trim()) {
                          showNotification('Please provide a completion remark', 'error');
                          return;
                        }
                        try {
                          setSubmitting(true);
                          const id = completionTicket.id || completionTicket._id;
                          const meta = parseMetadata(completionTicket.remarks);
                          
                          const updatedMeta = {
                            ...meta,
                            endTime: completionData.endTime,
                            manualDate: completionData.date,
                            totalTime: calculateTotalTime(completionData.beforeTime, completionData.endTime),
                            workRemarks: completionData.beforeRemark,
                            workStartTime: completionData.beforeTime,
                            workStartDate: completionData.beforeDate
                          };

                        const formDataToSend = new FormData();
                        formDataToSend.append('status', 'Completed');
                        formDataToSend.append('remarks', JSON.stringify(updatedMeta));
                        formDataToSend.append('remark', `Final: ${completionData.remark} | Before: ${completionData.beforeRemark}`);
                        formDataToSend.append('workRemarks', completionData.beforeRemark);
                        
                        if (completionData.beforeImage) {
                          formDataToSend.append('workImage', completionData.beforeImage);
                        }
                        if (completionData.afterImage) {
                          formDataToSend.append('serviceImage', completionData.afterImage);
                        }

                        await api.patch(`/tickets/${id}/`, formDataToSend, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });

                          showNotification('Ticket finalized with before/after records', 'success');
                          setShowCompletionModal(false);
                          if (showModal) setShowModal(false);
                          fetchData();
                        } catch (err) {
                          console.error(err);
                          showNotification('Failed to finalize ticket', 'error');
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
