import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { 
  Folder, Plus, Search, Filter, MoreHorizontal, 
  Calendar, User, CheckCircle, Clock, AlertCircle, Activity,
  ChevronRight, X, Edit2, Trash2, LayoutGrid, Briefcase, Download, Upload, ChevronLeft
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Projects:EDIT');

  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: 'Active',
    instructionBy: ''
  });





  const fetchData = async () => {
    try {
      const [pRes] = await Promise.all([
        api.get('/tickets/projects/')
      ]);
      setProjects(Array.isArray(pRes.data) ? pRes.data : []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const submissionData = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        client_name: formData.client_name || null,
        description: formData.description || null,
        instructionBy: formData.instructionBy || null
      };

      if (editingId) {
        await api.put(`/tickets/projects/${editingId}/`, submissionData);
        showNotification('Project updated successfully');
      } else {
        await api.post('/tickets/projects/', submissionData);
        showNotification('New project created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving project:', err);
      showNotification('Failed to save project', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/tickets/projects/${id}/`);
        showNotification('Project deleted successfully');
        fetchData();
      } catch (err) {
        console.error('Error deleting project:', err);
        showNotification('Failed to delete project', 'error');
      }
    });
  };


  const handleEdit = (project) => {
    setEditingId(project.id || project._id);
    setFormData({
      name: project.name,
      client_name: project.client_name || '',
      description: project.description || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      status: project.status || 'Active',
      instructionBy: project.instructionBy || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      client_name: '',
      description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      status: 'Active',
      instructionBy: ''
    });
  };

  const handleViewTickets = (project) => {
    navigate(`/projects/${encodeURIComponent(project.name)}/${project.id || project._id}/tickets`);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (startMonth || endMonth) {
        const pDate = p.start_date || '';
        if (!pDate) return false;
        const pMonth = pDate.substring(0, 7);
        if (startMonth && pMonth < startMonth) return false;
        if (endMonth && pMonth > endMonth) return false;
      }
      
      return p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             (p.client_name && p.client_name.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [projects, startMonth, endMonth, searchQuery]);

  const summaryStats = useMemo(() => ({
    total: filteredProjects.length,
    active: filteredProjects.filter(p => p.status === 'Active').length,
    onHold: filteredProjects.filter(p => p.status === 'On Hold').length,
    completed: filteredProjects.filter(p => p.status === 'Completed').length
  }), [filteredProjects]);

  const handleDownload = () => {
    if (filteredProjects.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'S.No', 'Project Name', 'Client Name', 'Description', 
      'Start Date', 'End Date', 'Status', 'Tickets'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredProjects.map((p, i) => [
      i + 1,
      escapeCSV(p.name),
      escapeCSV(p.client_name || 'N/A'),
      escapeCSV(p.description || ''),
      escapeCSV(p.start_date || 'N/A'),
      escapeCSV(p.end_date || 'Open Ended'),
      escapeCSV(p.status),
      escapeCSV(p.ticket_count || 0)
    ]);

    const csvContent = "\uFEFF" + [ 
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Projects_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Project inventory exported successfully');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
      case 'Completed': return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
      case 'On Hold': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      default: return 'text-gray-400 border-gray-500/20 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-main pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Briefcase className="mr-3 text-teal-500" size={28} />
            Project
          </h1>
        </div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-dim" />
            <input 
              type="month" 
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="glass-input px-3 py-2 text-xs w-36 cursor-pointer"
              title="From Month"
            />
            <span className="text-secondary text-xs">to</span>
            <input 
              type="month" 
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="glass-input px-3 py-2 text-xs w-36 cursor-pointer"
              title="To Month"
            />
          </div>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full !pl-14 pr-4 py-2 text-sm"
            />
          </div>
          <button 
            onClick={handleDownload}
            className="glass-panel flex items-center px-4 py-2 text-xs font-bold uppercase tracking-widest bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 transition-all"
          >
            <Download size={16} className="mr-2" />
            Download
          </button>
          <div className="flex space-x-3">
          {canEdit && (
              <button onClick={() => { setEditingId(null); resetForm(); setShowModal(true); }} className="glass-button flex items-center px-5 py-2.5 text-sm">
                <Plus size={18} className="mr-2" />
                New Project
              </button>
          )}
        </div>
      </div>
    </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-6">
        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#10b981', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-emerald-500 tracking-[0.2em] uppercase">[Active Projects]</h3>
            <Activity size={18} className="text-emerald-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3 mt-4 text-left">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(16, 185, 129, 0.6)' }}>{summaryStats.active}</span>
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest pb-1">In Progress</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#f59e0b', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-amber-500 tracking-[0.2em] uppercase">[On Hold]</h3>
            <AlertCircle size={18} className="text-amber-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3 mt-4 text-left">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(245, 158, 11, 0.6)' }}>{summaryStats.onHold}</span>
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest pb-1">Paused</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#3b82f6', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-blue-500 tracking-[0.2em] uppercase">[Completed]</h3>
            <CheckCircle size={18} className="text-blue-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3 mt-4 text-left">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(59, 130, 246, 0.6)' }}>{summaryStats.completed}</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pb-1">Finished</span>
            </div>
          </div>
        </div>

        <div className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 relative group">
          <div className="hud-corner-tr"></div>
          <div className="hud-corner-bl"></div>
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: '#8b5cf6', opacity: 0.1, filter: 'blur(20px)' }}></div>
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] font-bold text-purple-500 tracking-[0.2em] uppercase">[Total Projects]</h3>
            <Briefcase size={18} className="text-purple-500 opacity-50 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex flex-col space-y-3 mt-4 text-left">
            <div className="flex items-end space-x-2 font-mono">
              <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px rgba(139, 92, 246, 0.6)' }}>{summaryStats.total}</span>
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest pb-1">All Projects</span>
            </div>
          </div>
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
              {filteredProjects.length === 0 ? '0-0 of 0' : `${Math.min((currentPage - 1) * itemsPerPage + 1, filteredProjects.length)}-${Math.min(currentPage * itemsPerPage, filteredProjects.length)} of ${filteredProjects.length}`}
            </span>
            <button disabled={currentPage >= Math.ceil(filteredProjects.length / itemsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)} className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((project, index) => (
          <div 
            key={project.id || project._id} 
            className="hud-panel p-6 hover:border-teal-500/30 transition-all group animate-slide-up relative overflow-hidden"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <div className="flex justify-between items-start mb-4">
              <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(project.status)}`}>
                {project.status}
              </div>
              {canEdit && (
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(project)} className="p-1.5 hover:bg-white/10 rounded-lg text-dim hover:text-main transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(project.id || project._id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-dim hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-main mb-2 group-hover:text-teal-500 transition-colors flex items-center space-x-2">
              <span className="text-sm text-dim bg-panel px-2 py-0.5 rounded-md border border-main">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
              <span>{project.name}</span>
            </h3>
            <p className="text-sm text-secondary line-clamp-2 mb-6 h-10">
              {project.description || 'No description provided.'}
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-secondary uppercase tracking-wider">Client</span>
                <span className="text-main">{project.client_name || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium mt-2">
                <span className="text-secondary uppercase tracking-wider">Instruction By</span>
                <span className="text-main">{project.instructionBy || 'N/A'}</span>
              </div>
              <button 
                onClick={() => navigate(`/projects/${project.id || project._id}`)}
                className="w-full flex items-center justify-between text-xs font-bold hover:bg-teal-500/10 text-teal-600 p-2 rounded-lg transition-colors border border-teal-500/20 mt-2"
              >
                <span className="uppercase tracking-wider">View Full Details</span>
                <ChevronRight size={14} />
              </button>
              
              <button 
                onClick={() => handleViewTickets(project)}
                className="w-full flex items-center justify-between text-xs font-medium hover:bg-panel p-2 rounded-lg transition-colors"
              >
                <span className="text-secondary uppercase tracking-wider">Active Tickets</span>
                <div className="flex items-center space-x-1 text-teal-600 font-bold">
                  <span>{project.ticket_count || 0}</span>
                  <ChevronRight size={12} />
                </div>
              </button>
              
              <div className="pt-4 border-t border-main flex items-center justify-between">
                <div className="flex items-center text-[10px] text-secondary font-bold uppercase tracking-widest">
                  <Calendar size={12} className="mr-1.5" />
                  {project.start_date || 'N/A'}
                </div>
                <div className="flex items-center text-[10px] text-secondary font-bold uppercase tracking-widest">
                  <Clock size={12} className="mr-1.5" />
                  {project.end_date || 'Open Ended'}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {filteredProjects.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-dim">
            <Briefcase size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">No projects found</p>
            <p className="text-sm">Create your first project to start grouping tickets.</p>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowModal(false)}></div>
          
          <div className="bg-card rounded-[2.5rem] w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden border border-main shadow-2xl animate-scale-in my-8 relative z-10">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-main tracking-tight uppercase">
                  {editingId ? 'Modify Project' : 'Project'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Project Designation (Name)</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main"
                    placeholder="e.g. Block A Annual Maintenance"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Client Entity</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main"
                    placeholder="e.g. Rathinam College"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Contract Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                  <input
                    type="text"
                    value={formData.instructionBy}
                    onChange={(e) => setFormData({...formData, instructionBy: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main"
                    placeholder="Name of authorize officer"
                  />
                </div>


                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Scope of Operations (Description)</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main resize-none"
                    placeholder="Brief overview of project goals..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Activation Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Target Completion</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="glass-input w-full p-3 bg-panel border-main cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="glass-button px-12 py-3"
                >
                  {submitting ? 'PROCESSING...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
