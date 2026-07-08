import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, CheckCircle, Shield, ChevronLeft, ChevronRight, Printer
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useSiteStore } from '../store/siteStore';
import { useNavigate } from 'react-router-dom';
import ComboInput from '../components/ComboInput';

export default function Upgrades() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { allLocations, fetchAllLocations, divisions, fetchDivisions } = useSiteStore();
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  // Filter for upgrades category or metadata
  const upgradeTickets = useMemo(() => {
    return tickets.filter(t => {
      try {
        const meta = JSON.parse(t.remarks || '{}');
        return t.category === 'Upgrade' || meta.category === 'Upgrade' || t.issueDescription?.toLowerCase().includes('upgrade');
      } catch(e) {
        return t.category === 'Upgrade' || t.issueDescription?.toLowerCase().includes('upgrade');
      }
    });
  }, [tickets]);

  const baseFilteredTickets = useMemo(() => {
    return upgradeTickets.filter(ticket => {
      const ticketDate = ticket.operationDate || '';
      
      if (startMonth || endMonth) {
        if (!ticketDate) return false;
        const tMonth = ticketDate.substring(0, 7); // 'YYYY-MM'
        if (startMonth && tMonth < startMonth) return false;
        if (endMonth && tMonth > endMonth) return false;
      }
      
      const searchStr = `${ticket.issueDescription} ${ticket.location}`.toLowerCase();
      if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) return false;
      
      return true;
    });
  }, [upgradeTickets, startMonth, endMonth, searchQuery]);

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
    assignedTo: '',
    location: '',
    category: 'Upgrade',
    issueDescription: '',
    instructionBy: '',
    assignedStaff: [],
    receivedTime: '',
    endTime: '',
    status: 'Open'
  });

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    if (divisions) divisions.forEach(o => o.name && colleges.add(o.name.toUpperCase()));
    return Array.from(colleges).sort();
  }, [divisions]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    tickets.forEach(t => { if (t.block) blocks.add(t.block.toUpperCase()); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block.toUpperCase()); });
    return Array.from(blocks).sort();
  }, [tickets, allLocations]);

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
      const allTickets = ticketRes.data || [];
      const sortedTickets = [...allTickets].sort((a, b) => (b.id || 0) - (a.id || 0));
      setTickets(sortedTickets);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
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
    const { name, value } = e.target;
    const shouldUppercase = typeof value === 'string' && !['date', 'status', 'receivedTime', 'endTime'].includes(name);
    const finalValue = shouldUppercase ? value.toUpperCase() : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: finalValue };
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
        operationDate: formData.date,
        divisionName: formData.divisionName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.divisionName} | ${formData.block} | ${formData.floor} | ${formData.room}`,
        category: 'Upgrade',
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        assignedStaff: formData.assignedStaff || [],
        receivedTime: formData.receivedTime || '',
        endTime: formData.endTime || '',
        totalTime: calculateTotalTime(formData.receivedTime, formData.endTime),
        remarks: JSON.stringify({ category: 'Upgrade', isUpgrade: true, receivedTime: formData.receivedTime, endTime: formData.endTime, totalTime: calculateTotalTime(formData.receivedTime, formData.endTime) }),
        raisedBy: user._id || user.id,
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
      showNotification('Failed to save upgrade record', 'error');
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
      status: 'Open'
    });
    setEditingId(null);
  };

  const handleEdit = (ticket) => {
    setFormData({
      date: ticket.operationDate || new Date().toISOString().split('T')[0],
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
      assignedStaff: ticket.assignedStaff ? ticket.assignedStaff.map(s => s.id || s._id || s) : [],
      receivedTime: ticket.receivedTime || '',
      endTime: ticket.endTime || '',
      status: ticket.status || 'Open'
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTickets.map((ticket, idx) => {
                return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${ticket.operationDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : 'N/A')}</td>
                  <td>${ticket.divisionName || 'N/A'} - ${ticket.block || ''}</td>
                  <td>${ticket.issueDescription || 'N/A'}</td>
                  <td>${ticket.actionTaken || 'Pending'}</td>
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
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Shield className="mr-3 text-cyan-400" size={28} />
            Upgrades
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button onClick={handleDownload} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          <button onClick={printToPDF} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
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

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 animate-slide-up delay-100">
        <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-red-500/30 text-left">
          <div className="flex justify-between items-start w-full">
            <h3 className="text-[11px] font-bold text-rose-500 tracking-widest uppercase">[OPEN UPGRADES]</h3>
            <Clock size={18} className="text-slate-500" />
          </div>
          <div className="flex items-end mt-4">
            <span className="text-4xl font-bold text-white">{summaryStats.open}</span>
          </div>
        </button>

        <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-amber-500/30 text-left">
          <div className="flex justify-between items-start w-full">
            <h3 className="text-[11px] font-bold text-amber-500 tracking-widest uppercase">[IN PROGRESS]</h3>
            <Shield size={18} className="text-slate-500" />
          </div>
          <div className="flex items-end mt-4">
            <span className="text-4xl font-bold text-white">{summaryStats.inProgress}</span>
          </div>
        </button>

        <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group hover:ring-1 hover:ring-green-500/30 text-left">
          <div className="flex justify-between items-start w-full">
            <h3 className="text-[11px] font-bold text-green-500 tracking-widest uppercase">[COMPLETED]</h3>
            <CheckCircle size={18} className="text-slate-500" />
          </div>
          <div className="flex items-end mt-4">
            <span className="text-4xl font-bold text-white">{summaryStats.completed}</span>
          </div>
        </button>

        <button className="bg-panel rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group ring-1 ring-cyan-500/50 text-left">
          <div className="flex justify-between items-start w-full">
            <h3 className="text-[11px] font-bold text-cyan-400 tracking-widest uppercase">[TOTAL UPGRADES]</h3>
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
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
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

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-12">S.No</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upgrade Description</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action Taken</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instruction By</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Time (R/E/T)</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
              {loading ? (
                <tr><td colSpan="9" className="p-10 text-center text-dim">Loading upgrades...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan="9" className="p-10 text-center text-dim">No upgrades found.</td></tr>
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
                    <td className="p-4 text-center font-mono text-[10px] text-dim">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className="p-4 text-xs font-mono text-slate-300">{ticket.operationDate || new Date().toISOString().split('T')[0]}</td>
                    <td className="p-4 text-xs font-semibold text-main uppercase">{ticket.divisionName || 'N/A'} - {ticket.block}</td>
                    <td className="p-4 text-xs text-slate-400 uppercase">{ticket.issueDescription}</td>
                    <td className="p-4 text-xs text-slate-400 uppercase">{ticket.actionTaken || 'Pending'}</td>
                    <td className="p-4 text-xs text-main uppercase">{ticket.instructionBy || 'N/A'}</td>
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
                  <ComboInput 
                    required 
                    name="divisionName" 
                    value={formData.divisionName} 
                    onChange={handleInputChange} 
                    options={uniqueColleges} 
                    placeholder="Select or Type Division..." 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Block/Location</label>
                  <ComboInput 
                    required 
                    name="block" 
                    value={formData.block} 
                    onChange={handleInputChange} 
                    options={uniqueBlocks} 
                    placeholder="Select or Type Block..." 
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upgrade Description</label>
                <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[90px] bg-panel border-main" placeholder="Hardware to be upgraded..." />
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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                  <input type="text" name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                  <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Authorized by..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Assigned Staff</label>
                  <select 
                    multiple 
                    name="assignedStaff" 
                    value={formData.assignedStaff || []} 
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setFormData(prev => ({ ...prev, assignedStaff: values }));
                    }} 
                    className="glass-input w-full p-3 text-xs bg-panel border-main cursor-pointer"
                    style={{ minHeight: '80px' }}
                  >
                    {users.map(s => (
                      <option key={s.id || s._id} value={s.id || s._id}>{s.name || s.username}</option>
                    ))}
                  </select>
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
