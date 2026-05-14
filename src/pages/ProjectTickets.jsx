import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase,
  MessageSquare, Send, Info, Clock, User as UserIcon, CheckCircle,
  Maximize2, Minimize2, Activity, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate, useParams } from 'react-router-dom';

export default function ProjectTickets() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { projectId, projectName } = useParams();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
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
    image: null
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
    collegeName: '',
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
    assignedTo: '', // For Site Administrator
    assignedStaff: [], // For Technicians (ManyToMany)
    projectId: projectId,
    status: 'Open'
  });

  const [allLocations, setAllLocations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [showStaffAdd, setShowStaffAdd] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId]);



  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes, locRes, staffRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/'),
        api.get('/cameras/master_locations/'),
        api.get('/tickets/staff/')
      ]);
      
      const projectTickets = (ticketRes.data || []).filter(t => 
        (t.projectId?.id || t.projectId || t.project?.id)?.toString() === projectId.toString()
      );
      
      setTickets(projectTickets);
      setUsers(userRes.data);
      setAllLocations(locRes.data);
      setStaff(staffRes.data);
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
      const res = await api.put(`/tickets/staff/${s.id || s._id}/`, { name: newName.trim() });
      setStaff(staff.map(item => (item.id || item._id) === (s.id || s._id) ? res.data : item));
      showNotification('Staff member updated', 'success');
    } catch (err) {
      showNotification('Failed to update staff member', 'error');
    }
  };

  const handleDeleteStaff = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
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
    if (diff < 0) diff += 24 * 60; 
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      if (name === 'collegeName' || name === 'block' || name === 'floor' || name === 'room') {
        if (name === 'collegeName') {
          newData.block = ''; newData.floor = ''; newData.room = '';
        } else if (name === 'block') {
          newData.floor = ''; newData.room = '';
        } else if (name === 'floor') {
          newData.room = '';
        }

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
        collegeName: formData.collegeName,
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
      };

      if (editingId) {
        payload.cameraId = currentTicket?.cameraId?.id || currentTicket?.cameraId;
        payload.raisedBy = currentTicket?.raisedBy?.id || currentTicket?.raisedBy || user._id || user.id;
        await api.put(`/tickets/${editingId}/`, payload);
        showNotification('Ticket updated successfully');
      } else {
        // cameraId is optional
        payload.cameraId = null;
        await api.post('/tickets/', payload);
        showNotification('New ticket created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchData();
      if (selectedTicket) {
        // Refresh selected ticket to show new message if panel is open
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
      // Refresh ticket data
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
      date: ticket.operationDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      collegeName: ticket.collegeName || '',
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
      assignedStaff: (ticket.assignedStaff || []).map(s => s.id || s._id || s),
      projectId: projectId,
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
    if (selectedMonth && !ticketDate.startsWith(selectedMonth)) return false;
    const searchStr = `${ticket.issueDescription} ${meta.location} ${meta.category}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  }) : [];

  const handleDownload = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['Date', 'Location', 'Category', 'Issue', 'Action Taken', 'Instruction By', 'Received', 'End', 'Total', 'Responsibility', 'Status'];
    const rows = filteredTickets.map(t => {
      const meta = parseMetadata(t.remarks);
      return [
        ticket.operationDate || meta.manualDate || t.createdAt?.split('T')[0],
        ticket.location || meta.location, ticket.category || meta.category, t.issueDescription,
        ticket.actionTaken || meta.actionTaken, ticket.instructionBy || meta.instructionBy, ticket.receivedTime || meta.receivedTime,
        ticket.endTime || meta.endTime, ticket.totalTime || meta.totalTime, t.assignedTo?.name || 'Unassigned', t.status
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName}_tickets_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="glass-input px-3 py-2 text-xs w-40 cursor-pointer" />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
            <input type="text" placeholder="Search project tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="glass-input w-full pl-10 pr-4 py-2 text-sm" />
          </div>
          <button onClick={handleDownload} className="p-2 text-dim hover:text-main hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/10" title="Download CSV">
            <Download size={18} />
          </button>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowModal(true); }} className="glass-button flex items-center px-5 py-2 text-sm shrink-0">
              <Plus size={18} className="mr-2" />
              New Project Ticket
            </button>
          )}
        </div>
      </div>

      {/* Project Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Project Pipeline</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">{summaryStats.open + summaryStats.inProgress}</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pb-1">Open Issues</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Site Resolution</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">
                {summaryStats.total > 0 ? Math.round((summaryStats.completed / summaryStats.total) * 100) : 0}%
              </span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest pb-1">Completed</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Total Activity</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-main leading-none">{summaryStats.total}</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pb-1">Logs Recorded</span>
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

      <div className="glass-panel overflow-hidden border border-main shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Date</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Location</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Category</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest w-1/3">Issue Description</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Instruction By</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest text-center">Time (R/E/T)</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Responsibility</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y border-main text-main">
              {loading ? (
                <tr><td colSpan="9" className="p-20 text-center text-dim">Loading project tickets...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan="9" className="p-20 text-center text-dim">No tickets found for this project.</td></tr>
              ) : filteredTickets.map((ticket) => {
                const meta = parseMetadata(ticket.remarks);
                const assignedId = ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo;
                const assignedUser = users.find(u => (u.id || u._id) === assignedId);
                return (
                  <tr 
                    key={ticket.id || ticket._id} 
                    className="hover:bg-panel transition-colors group cursor-pointer"
                    onClick={(e) => {
                      if (e.target.closest('button') || e.target.closest('select')) return;
                      setSelectedTicket(ticket);
                      setShowSidePanel(true);
                      if (ticket.status === 'Completed' && user?.role !== 'Super Admin') {
                        showNotification('Viewing completed ticket (Read-only)', 'info');
                      }
                    }}
                  >
                    <td className="p-4 text-[11px] text-secondary font-mono">
                      {ticket.operationDate || meta.manualDate || ticket.createdAt?.split('T')[0]}
                    </td>
                    <td className="p-4 text-[11px] text-main font-semibold">
                      {ticket.collegeName} {ticket.block} {ticket.floor} {ticket.room}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 border border-teal-500/20 text-[9px] font-bold uppercase tracking-wider">
                        {ticket.category || 'CCTV'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-[11px] text-secondary line-clamp-2 italic">{ticket.issueDescription}</p>
                    </td>
                    <td className="p-4 text-[11px] text-main font-medium">{ticket.instructionBy || meta.instructionBy || 'N/A'}</td>
                    <td className="p-4">
                      <div className="flex flex-col items-center space-y-0.5">
                        <span className="text-[9px] text-emerald-500 font-mono">{ticket.receivedTime || meta.receivedTime || '--:--'}</span>
                        <span className="text-[9px] text-red-500 font-mono">{ticket.endTime || meta.endTime || '--:--'}</span>
                        <div className="h-[1px] w-6 bg-main"></div>
                        <span className="text-[9px] text-main font-bold">{ticket.totalTime || meta.totalTime || '0h 0m'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-[11px] text-secondary">
                        <div className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center text-[8px] font-bold text-teal-600">
                          {(assignedUser?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span>{assignedUser?.name || 'Unassigned'}</span>
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
                                date: new Date().toISOString().split('T')[0]
                              });
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
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border bg-transparent cursor-pointer transition-all outline-none ${
                            ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10' :
                            ticket.status === 'In Progress' ? 'text-orange-400 border-orange-500/20 hover:bg-orange-500/10' :
                            'text-red-400 border-red-500/20 hover:bg-red-500/10'
                          }`}
                        >
                          <option value="Open" className="bg-[#1a1d27]">Open</option>
                          <option value="In Progress" className="bg-[#1a1d27]">In Progress</option>
                          <option value="Completed" className="bg-[#1a1d27]">Completed</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
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
              <p className="text-xs text-secondary mt-1 uppercase tracking-widest font-black">Project Maintenance Protocol</p>
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
                  <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Category</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-4 text-xs bg-panel border-main cursor-pointer font-bold">
                    <option value="CCTV">CCTV Surveillance</option>
                    <option value="NVR">NVR / Storage</option>
                    <option value="Biometric">Biometric Access</option>
                    <option value="Network">Network / Switches</option>
                    <option value="Other">Other Hardware</option>
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

              {/* Location Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">College</label>
                   <select required name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-3 text-[10px] bg-panel border-main font-bold">
                     <option value="">Select College</option>
                     {[...new Set(allLocations.map(l => l.collegeName))].map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Block</label>
                   <select required name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-3 text-[10px] bg-panel border-main font-bold">
                     <option value="">Select Block</option>
                     {[...new Set(allLocations.filter(l => l.collegeName === formData.collegeName).map(l => l.block))].map(b => <option key={b} value={b}>{b}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Floor</label>
                   <select name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-3 text-[10px] bg-panel border-main font-bold">
                     <option value="">Select Floor</option>
                     {[...new Set(allLocations.filter(l => l.collegeName === formData.collegeName && l.block === formData.block).map(l => l.floor))].map(f => <option key={f} value={f}>{f}</option>)}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Room</label>
                   <select name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-3 text-[10px] bg-panel border-main font-bold">
                     <option value="">Select Room</option>
                     {[...new Set(allLocations.filter(l => l.collegeName === formData.collegeName && l.block === formData.block && l.floor === formData.floor).map(l => l.room))].map(r => <option key={r} value={r}>{r}</option>)}
                   </select>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center space-x-2 text-teal-500 mb-4">
                    <Activity size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Incident Details</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Site Administrator (Responsible)</label>
                      <select name="assignedTo" value={formData.assignedTo} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer">
                        <option value="">No Administrator Linked</option>
                        {users.map(u => <option key={u.id || u._id} value={u.id || u._id}>{u.name} ({u.role})</option>)}
                      </select>
                      {formData.assignedTo && <p className="text-[8px] text-teal-500 font-bold mt-1 uppercase tracking-widest">Linked from Registry</p>}
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Nature of Problem</label>
                      <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] resize-none bg-panel border-main" placeholder="Describe the failure..." />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                      <textarea name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] resize-none bg-panel border-main" placeholder="Resolution details..." />
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
                          </button>
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1 opacity-0 group-hover/staff:opacity-100 transition-opacity">
                            <button type="button" onClick={(e) => handleEditStaff(e, s)} className="p-1 hover:text-blue-400 bg-black/20 rounded backdrop-blur-sm"><Edit2 size={10} /></button>
                            <button type="button" onClick={(e) => handleDeleteStaff(e, s.id || s._id)} className="p-1 hover:text-red-400 bg-black/20 rounded backdrop-blur-sm"><Trash2 size={10} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-dim uppercase tracking-widest">Received</label>
                          <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-2 text-xs font-mono bg-panel border-main" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-dim uppercase tracking-widest">End Time</label>
                          <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="glass-input w-full p-2 text-xs font-mono bg-panel border-main" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] font-black text-dim uppercase tracking-widest">Total Duration</span>
                        <span className="text-sm font-black text-main bg-white/5 px-4 py-1 rounded-full border border-white/5">{formData.totalTime}</span>
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
                  <h3 className="text-2xl font-black text-main tracking-tight uppercase">Log Analysis</h3>
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
                      <span className="text-[9px] font-black text-dim uppercase tracking-widest">Logged On</span>
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
                </div>

                <div className="space-y-4">
                   <h4 className="text-[10px] font-black text-dim uppercase tracking-[0.3em] pl-2">System Metadata</h4>
                   <div className="bg-card p-4 rounded-2xl border border-main space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dim font-bold uppercase tracking-widest">Project</span>
                        <span className="text-main font-black truncate max-w-[150px]">{projectName}</span>
                      </div>
                      <div className="h-px bg-main opacity-5"></div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-dim font-bold uppercase tracking-widest">Raised By</span>
                        <span className="text-main font-black">{selectedTicket.raisedByName || 'Technician'}</span>
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
)}

      {/* Completion Details Modal */}
    {showCompletionModal && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[200] flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-card border border-main rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-teal-500/10 rounded-2xl">
                <CheckCircle className="text-teal-500" size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-main tracking-tight uppercase">Finalize Maintenance</h3>
                <p className="text-[10px] text-secondary uppercase tracking-widest font-black">Service Completion Protocol</p>
              </div>
            </div>
            <button onClick={() => setShowCompletionModal(false)} className="text-dim hover:text-main p-2 hover:bg-card rounded-xl transition-all">
              <X size={24} />
            </button>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Completion Date</label>
                <input 
                  type="date" 
                  value={completionData.date}
                  onChange={(e) => setCompletionData({...completionData, date: e.target.value})}
                  className="glass-input w-full p-3 text-sm bg-panel border-main"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Completion Time</label>
                <input 
                  type="time" 
                  value={completionData.endTime}
                  onChange={(e) => setCompletionData({...completionData, endTime: e.target.value})}
                  className="glass-input w-full p-3 text-sm font-mono bg-panel border-main"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Final Resolution Remark</label>
              <textarea 
                required
                value={completionData.remark}
                onChange={(e) => setCompletionData({...completionData, remark: e.target.value})}
                placeholder="Describe the final action taken to resolve this ticket..."
                className="glass-input w-full p-4 text-sm min-h-[120px] resize-none bg-panel border-main"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Service Image (Max 2MB)</label>
              <div className="mt-2">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-panel border-main transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={24} className="text-dim mb-2" />
                      <p className="mb-2 text-xs text-dim"><span className="font-bold">Click to upload</span> or drag and drop</p>
                      <p className="text-[10px] text-dim/60">PNG, JPG or JPEG (MAX. 2MB)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            showNotification('Image size exceeds 2MB limit', 'error');
                            e.target.value = '';
                            return;
                          }
                          setCompletionData({...completionData, image: file});
                        }
                      }}
                    />
                  </label>
                </div>
                {completionData.image && (
                  <div className="mt-2 flex items-center justify-between p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <span className="text-[10px] text-emerald-400 font-bold truncate max-w-[200px]">{completionData.image.name}</span>
                    <button onClick={() => setCompletionData({...completionData, image: null})} className="text-emerald-400 hover:text-emerald-300">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-panel/50 p-4 rounded-2xl border border-main">
              <div className="flex items-center space-x-2 text-[10px] text-dim uppercase font-bold">
                <UserIcon size={12} />
                <span>Closing Technician: {user?.name}</span>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button 
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main transition-all"
              >
                Abort Finalization
              </button>
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

                    // 1. Prepare updated metadata with completion time/date
                    const updatedMeta = {
                      ...meta,
                      endTime: completionData.endTime,
                      manualDate: completionData.date,
                      totalTime: calculateTotalTime(meta.receivedTime || completionTicket.receivedTime, completionData.endTime)
                    };

                    // 2. Prepare FormData for multipart submission
                    const formData = new FormData();
                    formData.append('status', 'Completed');
                    formData.append('remarks', JSON.stringify(updatedMeta));
                    formData.append('remark', completionData.remark);
                    if (completionData.image) {
                      formData.append('serviceImage', completionData.image);
                    }

                    // 3. Single patch update
                    await api.patch(`/tickets/${id}/`, formData, {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                      },
                    });

                    showNotification('Ticket finalized and completed', 'success');
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
                className="flex-1 neon-button py-3 text-[10px] font-black tracking-[0.2em] uppercase"
              >
                Complete Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}

