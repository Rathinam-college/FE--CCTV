import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../services/api';
import { 
  Plus, Search, Download, Calendar, MapPin, Tag, 
  X, Edit2, Trash2, LayoutGrid, Briefcase, Upload,
  MessageSquare, Send, Info, Clock, CheckCircle, Shield
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';
import { useNavigate } from 'react-router-dom';
import ComboInput from '../components/ComboInput';

export default function Upgrades() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { allLocations, fetchAllLocations } = useSiteStore();
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

  const summaryStats = useMemo(() => ({
    total: upgradeTickets.length,
    open: upgradeTickets.filter(t => t.status === 'Open').length,
    inProgress: upgradeTickets.filter(t => t.status === 'In Progress').length,
    completed: upgradeTickets.filter(t => t.status === 'Completed').length
  }), [upgradeTickets]);

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
    assignedTo: '',
    location: '',
    category: 'Upgrade',
    issueDescription: '',
    actionTaken: '',
    instructionBy: '',
    status: 'Open'
  });

  const uniqueColleges = useMemo(() => {
    const colleges = new Set();
    tickets.forEach(t => { if (t.collegeName) colleges.add(t.collegeName); });
    allLocations.forEach(loc => { if (loc.collegeName) colleges.add(loc.collegeName); });
    return Array.from(colleges).sort();
  }, [tickets, allLocations]);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set();
    tickets.forEach(t => { if (t.block) blocks.add(t.block); });
    allLocations.forEach(loc => { if (loc.block) blocks.add(loc.block); });
    return Array.from(blocks).sort();
  }, [tickets, allLocations]);

  useEffect(() => {
    fetchData();
    fetchAllLocations();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/')
      ]);
      setTickets(ticketRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        collegeName: formData.collegeName,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        location: `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room}`,
        category: 'Upgrade',
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        remarks: JSON.stringify({ category: 'Upgrade', isUpgrade: true }),
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
      collegeName: '',
      block: '',
      floor: '',
      room: '',
      location: '',
      category: 'Upgrade',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      assignedTo: '',
      status: 'Open'
    });
    setEditingId(null);
  };

  const handleEdit = (ticket) => {
    setFormData({
      date: ticket.operationDate || new Date().toISOString().split('T')[0],
      collegeName: ticket.collegeName || '',
      block: ticket.block || '',
      floor: ticket.floor || '',
      room: ticket.room || '',
      location: ticket.location || '',
      category: 'Upgrade',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || '',
      instructionBy: ticket.instructionBy || '',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo || '',
      status: ticket.status || 'Open'
    });
    setEditingId(ticket.id || ticket._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this upgrade record?')) {
      try {
        await api.delete(`/tickets/${id}/`);
        showNotification('Record deleted');
        fetchData();
      } catch (err) {
        showNotification('Failed to delete', 'error');
      }
    }
  };

  const filteredTickets = upgradeTickets.filter(ticket => {
    const ticketDate = ticket.operationDate || '';
    if (selectedDate && !ticketDate.startsWith(selectedDate)) return false;
    if (statusFilter !== 'ALL' && ticket.status !== statusFilter) return false;
    const searchStr = `${ticket.issueDescription} ${ticket.location}`.toLowerCase();
    return searchStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Shield className="mr-3 text-purple-400" size={28} />
            Upgrades
          </h1>
          <p className="text-sm text-dim mt-1">Track hardware and software upgradations</p>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-dim" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="glass-input px-3 py-2 text-xs w-40 cursor-pointer"
            />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
            <input 
              type="text" 
              placeholder="Search upgrades..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full !pl-14 pr-4 py-2 text-sm"
            />
          </div>
          {canEdit && (
            <button onClick={() => { resetForm(); setShowModal(true); }} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
              <Plus size={18} className="mr-2" />
              Register Upgrade
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Pending Upgrades</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-amber-500 leading-none">{summaryStats.open + summaryStats.inProgress}</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pb-1">Requires Action</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Completion Rate</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-emerald-500 leading-none">
                {summaryStats.total > 0 ? Math.round((summaryStats.completed / summaryStats.total) * 100) : 0}%
              </span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest pb-1">Efficiency</span>
            </div>
          </div>
          <div className="glass-panel p-6 bg-card border-main shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Total Upgrades</p>
            <div className="flex items-end space-x-3">
              <span className="text-3xl font-black text-purple-500 leading-none">{summaryStats.total}</span>
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pb-1">Log Entries</span>
            </div>
          </div>
        </div>
        
        <div className="glass-panel p-6 bg-card border-main shadow-sm flex items-center justify-center min-h-[140px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie data={chartData} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-[10px] text-secondary font-black uppercase tracking-widest text-center">No Data</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-panel p-4 rounded-2xl border border-main">
        <div className="flex p-1 bg-card rounded-xl border border-main">
          {['ALL', 'Open', 'In Progress', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                statusFilter === status 
                  ? 'bg-purple-500 text-white shadow-lg' 
                  : 'text-secondary hover:text-main hover:bg-panel'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel overflow-hidden border border-main shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Date</th>
                <th className="p-4 text-[11px] font-bold text-main uppercase tracking-widest">Location</th>
                <th className="p-4 text-[11px] font-bold text-purple-300 uppercase tracking-widest">Upgrade Description</th>
                <th className="p-4 text-[11px] font-bold text-purple-300 uppercase tracking-widest">Action Taken</th>
                <th className="p-4 text-[11px] font-bold text-purple-300 uppercase tracking-widest">Instruction By</th>
                <th className="p-4 text-[11px] font-bold text-purple-300 uppercase tracking-widest">Status</th>
                {canEdit && <th className="p-4 text-[11px] font-bold text-purple-300 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
              {loading ? (
                <tr><td colSpan="7" className="p-10 text-center text-dim">Loading upgrades...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan="7" className="p-10 text-center text-dim">No upgrades found.</td></tr>
              ) : (
                filteredTickets.map(ticket => (
                  <tr 
                    key={ticket.id || ticket._id} 
                    className="hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      if (!e.target.closest('button')) {
                        navigate(`/tickets/${ticket.id || ticket._id}`);
                      }
                    }}
                  >
                    <td className="p-4 text-xs font-mono">{ticket.operationDate || new Date().toISOString().split('T')[0]}</td>
                    <td className="p-4 text-xs font-semibold text-main">{ticket.collegeName || 'N/A'} - {ticket.block}</td>
                    <td className="p-4 text-xs text-dim">{ticket.issueDescription}</td>
                    <td className="p-4 text-xs text-dim">{ticket.actionTaken || 'Pending'}</td>
                    <td className="p-4 text-xs text-main">{ticket.instructionBy || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                        ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/20' :
                        ticket.status === 'In Progress' ? 'text-orange-400 border-orange-500/20' :
                        'text-red-400 border-red-500/20'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => navigate(`/tickets/${ticket.id || ticket._id}`)} 
                          className="p-1.5 text-dim hover:text-emerald-400 transition-colors"
                          title="View Full Details"
                        >
                          <Info size={14} />
                        </button>
                        <button onClick={() => handleEdit(ticket)} className="p-1.5 text-dim hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(ticket.id || ticket._id)} className="p-1.5 text-dim hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
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
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">College</label>
                  <ComboInput 
                    required 
                    name="collegeName" 
                    value={formData.collegeName} 
                    onChange={handleInputChange} 
                    options={uniqueColleges} 
                    placeholder="Select or Type College..." 
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
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                  <input type="text" name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" />
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
              <div className="flex justify-end pt-6 border-t border-main">
                <button type="submit" className="glass-button px-12 py-3">{editingId ? 'SAVE CHANGES' : 'REGISTER UPGRADE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
