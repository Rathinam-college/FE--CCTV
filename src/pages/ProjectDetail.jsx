import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { 
  Briefcase, 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle, 
  AlertTriangle,
  ChevronRight,
  FileText,
  Activity,
  ListTodo,
  CalendarPlus,
  X,
  Hash,
  File,
  Upload,
  Eye,
  Trash2
} from 'lucide-react';

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

const getFileName = (path) => {
  if (!path) return '';
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return name.length > 20 ? name.substring(0, 10) + '...' + name.substring(name.length - 7) : name;
};
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendData, setExtendData] = useState({ newDate: '', reason: '' });
  const [formData, setFormData] = useState({
    new_bill: { number: '', amount: '', file: null },
    new_po: { number: '', amount: '', file: null }
  });

  const [docFormData, setDocFormData] = useState({ name: '', file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const handleAddBillingRecord = async (type) => {
    if (!project) return;
    const isBill = type === 'Bill';
    const data = isBill ? formData.new_bill : formData.new_po;
    if (!data.number && !data.file) return;

    const formDataToSend = new FormData();
    formDataToSend.append('project', project.id || project._id);
    formDataToSend.append('record_type', type);
    if (data.number) formDataToSend.append('number', data.number);
    if (data.amount) formDataToSend.append('amount', data.amount);
    if (data.file) formDataToSend.append('file', data.file);

    try {
      setExtending(true);
      await api.post('/tickets/project-billing-records/', formDataToSend);
      showNotification(`${type} added successfully`, 'success');
      setFormData(prev => ({
        ...prev,
        [isBill ? 'new_bill' : 'new_po']: { number: '', amount: '', file: null }
      }));
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification(`Failed to add ${type}`, 'error');
    } finally {
      setExtending(false);
    }
  };

  const handleDeleteBillingRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      setExtending(true);
      await api.delete(`/tickets/project-billing-records/${recordId}/`);
      showNotification('Record deleted successfully', 'success');
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete record', 'error');
    } finally {
      setExtending(false);
    }
  };

  const handleAddDocument = async (e) => {
    if (e) e.preventDefault();
    if (!docFormData.name || !docFormData.file || !project) return;

    const formDataToSend = new FormData();
    formDataToSend.append('project', project.id || project._id);
    formDataToSend.append('name', docFormData.name);
    formDataToSend.append('file', docFormData.file);

    try {
      setUploadingDoc(true);
      await api.post('/tickets/project-documents/', formDataToSend);
      showNotification('Document uploaded successfully', 'success');
      setDocFormData({ name: '', file: null });
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteGeneralDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      setUploadingDoc(true);
      await api.delete(`/tickets/project-documents/${docId}/`);
      showNotification('Document deleted successfully', 'success');
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [id]);

  const fetchProjectDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tickets/projects/${id}/`);
      setProject(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      try {
         const allRes = await api.get('/tickets/projects/');
         const found = allRes.data.find(p => String(p.id || p._id) === String(id));
         if (found) {
           setProject(found);
         } else {
           setError('Project not found.');
         }
      } catch (fallbackErr) {
         setError('Failed to fetch project details.');
      }
      setLoading(false);
    }
  };

  const handleExtendDeadline = async (e) => {
    e.preventDefault();
    if (!extendData.newDate || !extendData.reason) {
      showNotification('Please provide both a new date and a reason.', 'error');
      return;
    }
    setExtending(true);
    try {
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const extensionLog = `\n\n--- Target Date Extended on ${timestamp} ---\nNew Target Date: ${extendData.newDate}\nReason: ${extendData.reason}`;
      const updatedDescription = (project.description || '') + extensionLog;

      await api.patch(`/tickets/projects/${id}/`, {
        end_date: extendData.newDate,
        description: updatedDescription
      });

      showNotification('Project deadline extended successfully');
      setShowExtendModal(false);
      setExtendData({ newDate: '', reason: '' });
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to extend deadline', 'error');
    } finally {
      setExtending(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'Completed': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'On Hold': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-panel p-8 text-center border-red-500/20">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-bold text-main mb-2">Error Loading Project</h3>
        <p className="text-dim text-sm mb-8">{error || 'Project not found.'}</p>
        <button onClick={() => navigate('/projects')} className="w-full glass-button py-3 flex items-center justify-center">
          <ArrowLeft size={18} className="mr-2" /> Back to Projects
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-dim">
            <button onClick={() => navigate('/dashboard')} className="hover:text-teal-500 transition-colors">DASHBOARD</button>
            <ChevronRight size={10} />
            <button onClick={() => navigate('/projects')} className="hover:text-teal-500 transition-colors">PROJECTS</button>
            <ChevronRight size={10} />
            <span className="text-teal-500">DETAIL VIEW</span>
          </nav>
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-black text-main uppercase tracking-tight">{project.name}</h1>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${getStatusColor(project.status)}`}>
              {project.status}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <button 
             onClick={() => setShowExtendModal(true)}
             className="glass-panel border-amber-500/30 text-amber-500 hover:bg-amber-500/10 flex items-center px-6 py-3 font-bold text-xs uppercase tracking-widest transition-all"
           >
             <CalendarPlus size={16} className="mr-2" />
             Extend Deadline
           </button>
           <button 
             onClick={() => navigate(`/projects/${encodeURIComponent(project.name)}/${project.id || project._id}/tickets`)}
             className="glass-button flex items-center px-6 py-3 font-bold text-xs uppercase tracking-widest"
           >
             <ListTodo size={16} className="mr-2" />
             View Active Tickets
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-8 border-t-4 border-t-teal-500 bg-card">
            <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-6">Project Overview</h3>
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-dim uppercase tracking-widest block mb-2">Scope & Description</label>
                <div className="text-sm text-main leading-relaxed bg-panel p-4 rounded-xl border border-main whitespace-pre-wrap">
                  {project.description || 'No detailed description provided for this project.'}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-main">
                <div>
                  <label className="text-[10px] font-black text-dim uppercase tracking-widest flex items-center mb-1">
                    <User size={12} className="mr-1" /> Client Entity
                  </label>
                  <p className="text-base font-bold text-main">{project.client_name || 'Internal / N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-dim uppercase tracking-widest flex items-center mb-1">
                    <CheckCircle size={12} className="mr-1" /> Instruction By
                  </label>
                  <p className="text-base font-bold text-main">{project.instructionBy || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-dim uppercase tracking-widest flex items-center mb-1">
                    <Activity size={12} className="mr-1" /> Active Tickets
                  </label>
                  <p className="text-base font-bold text-teal-600">{project.ticket_count || 0} Open Tickets</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-8 border-t-4 border-t-emerald-500 bg-card relative">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Billing & PO Records</h3>
               <button 
                 onClick={() => {
                   setFormData({
                     new_bill: { number: '', amount: '', file: null },
                     new_po: { number: '', amount: '', file: null }
                   });
                   setShowBillingModal(true);
                 }}
                 className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/20 flex items-center"
               >
                 <Upload size={12} className="mr-1.5" />
                 {(project.bill_number || project.po_number || project.bill_document || project.po_document) ? 'Update Docs' : 'Attach Docs'}
               </button>
             </div>
             
             {(project.bill_number || project.po_number || project.bill_document || project.po_document) ? (
               <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/20 space-y-5">
                  {(project.bill_number || project.bill_document) && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                      <span className="text-emerald-400 font-bold uppercase tracking-widest flex items-center text-xs"><Hash size={14} className="mr-2"/> Bill Record</span>
                      <div className="flex items-center space-x-3">
                        {project.bill_number && <span className="text-emerald-300 font-mono font-black bg-emerald-500/10 px-3 py-1 rounded text-sm">{project.bill_number}</span>}
                        {project.bill_document && (
                          <a href={getImageUrl(project.bill_document)} target="_blank" rel="noopener noreferrer" className="flex items-center p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors" title="View Document">
                            <File size={16} className="mr-2" />
                            <span className="text-xs font-bold truncate max-w-[150px]">{getFileName(project.bill_document)}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {(project.bill_number || project.bill_document) && (project.po_number || project.po_document) && <div className="h-px bg-emerald-500/20"></div>}
                  {(project.po_number || project.po_document) && (
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                      <span className="text-purple-400 font-bold uppercase tracking-widest flex items-center text-xs"><Hash size={14} className="mr-2"/> PO Record</span>
                      <div className="flex items-center space-x-3">
                        {project.po_number && <span className="text-purple-300 font-mono font-black bg-purple-500/10 px-3 py-1 rounded text-sm">{project.po_number}</span>}
                        {project.po_document && (
                          <a href={getImageUrl(project.po_document)} target="_blank" rel="noopener noreferrer" className="flex items-center p-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors" title="View Document">
                            <File size={16} className="mr-2" />
                            <span className="text-xs font-bold truncate max-w-[150px]">{getFileName(project.po_document)}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
               </div>
             ) : (
               <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/20 flex items-center justify-center text-center">
                 <p className="text-xs font-black text-emerald-500/50 uppercase tracking-[0.2em]">No Billing Records Attached</p>
               </div>
             )}
          </div>

          <div className="glass-panel p-8 border-t-4 border-t-blue-500 bg-card relative">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Project Documents</h3>
               <button 
                 onClick={() => {
                   setDocFormData({ name: '', file: null });
                   setShowDocModal(true);
                 }}
                 className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20 flex items-center"
               >
                 <Upload size={12} className="mr-1.5" />
                 Upload Doc
               </button>
             </div>
             
             {project.documents && project.documents.length > 0 ? (
               <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/20 space-y-3">
                 {project.documents.map((doc, idx) => (
                    <div key={doc.id || idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-panel border border-blue-500/10 rounded-xl hover:border-blue-500/30 transition-all">
                      <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                        <FileText size={16} className="text-blue-400" />
                        <div>
                          <p className="text-xs font-bold text-main">{doc.name}</p>
                          <p className="text-[9px] font-black text-dim uppercase tracking-widest mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <a href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="View Document">
                          <Eye size={14} />
                        </a>
                        <button type="button" onClick={() => deleteProjectDocument(doc.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                 ))}
               </div>
             ) : (
               <div className="bg-blue-500/5 p-5 rounded-2xl border border-blue-500/20 flex items-center justify-center text-center">
                 <p className="text-xs font-black text-blue-500/50 uppercase tracking-[0.2em]">No Documents Attached</p>
               </div>
             )}
          </div>
        </div>

        {/* Timeline & Metadata */}
        <div className="space-y-6">
          <div className="glass-panel p-6 border-main bg-card">
             <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-6">Timeline Details</h3>
             <div className="space-y-6 relative">
               <div className="absolute top-4 bottom-4 left-[11px] w-px bg-main"></div>
               
               <div className="flex items-start space-x-4 relative">
                 <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shrink-0 z-10">
                   <Calendar size={10} className="text-emerald-500" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-dim uppercase tracking-widest">Initialization Date</p>
                   <p className="text-sm font-bold text-main mt-1">{project.start_date || 'N/A'}</p>
                 </div>
               </div>

               <div className="flex items-start space-x-4 relative">
                 <div className="w-6 h-6 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center shrink-0 z-10">
                   <CheckCircle size={10} className="text-blue-500" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-dim uppercase tracking-widest">Target Completion</p>
                   <p className="text-sm font-bold text-main mt-1">{project.end_date || 'Open Ended'}</p>
                 </div>
               </div>
             </div>
          </div>

          <div className="glass-panel p-6 border-main bg-card">
            <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-4">Quick Actions</h3>
            <button 
              onClick={() => navigate('/projects')}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-panel border border-transparent hover:border-main transition-all group"
            >
              <div className="flex items-center space-x-3 text-secondary group-hover:text-main">
                <ArrowLeft size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Return to Projects</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Billing Modal */}
      {showBillingModal && project && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !extending && setShowBillingModal(false)}></div>
          
          <div className="bg-panel rounded-[2.5rem] w-full max-w-4xl overflow-hidden border border-emerald-500/30 shadow-2xl relative z-10 animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-emerald-500/20 flex justify-between items-center bg-emerald-500/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                  <Upload className="mr-3 text-emerald-400" size={24} />
                  Manage Billing & PO
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 mt-2">
                  Project: {project.name}
                </p>
              </div>
              <button onClick={() => !extending && setShowBillingModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              {/* Bills Section */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Bills
                </h3>

                {project.billing_records && project.billing_records.filter(r => r.record_type === 'Bill').length > 0 && (
                  <div className="space-y-2 mb-4">
                    {project.billing_records.filter(r => r.record_type === 'Bill').map(record => (
                      <div key={record.id} className="p-3 bg-panel rounded-xl border border-blue-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[300px]">
                          <CheckCircle size={14} className="text-blue-400 mr-2 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate">
                              {record.number || 'No Number'}
                            </span>
                            {record.amount && <span className="text-[9px] text-blue-400/70 font-mono mt-0.5">{record.amount}</span>}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {record.file && (
                            <>
                              <a href={getImageUrl(record.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="View">
                                <Eye size={14} />
                              </a>
                            </>
                          )}
                          <button type="button" onClick={() => handleDeleteBillingRecord(record.id)} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={extending}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-blue-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Add New Bill</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Bill Number</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, number: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-black/40 border-blue-500/20 text-white focus:border-blue-500" 
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, amount: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-black/40 border-blue-500/20 text-white focus:border-blue-500" 
                        placeholder="e.g. $1,250"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload Bill PDF/Image</label>
                    <input 
                      type="file" 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, file: e.target.files[0] } }))}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 cursor-pointer" 
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => handleAddBillingRecord('Bill')}
                      disabled={extending || (!formData.new_bill.number && !formData.new_bill.file)}
                      className="bg-blue-500 text-white hover:bg-blue-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
                    >
                      {extending ? 'Saving...' : 'Save New Bill'}
                    </button>
                  </div>
                </div>
              </div>

              {/* POs Section */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Purchase Orders (PO)
                </h3>

                {project.billing_records && project.billing_records.filter(r => r.record_type === 'PO').length > 0 && (
                  <div className="space-y-2 mb-4">
                    {project.billing_records.filter(r => r.record_type === 'PO').map(record => (
                      <div key={record.id} className="p-3 bg-panel rounded-xl border border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[300px]">
                          <CheckCircle size={14} className="text-purple-400 mr-2 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate">
                              {record.number || 'No Number'}
                            </span>
                            {record.amount && <span className="text-[9px] text-purple-400/70 font-mono mt-0.5">{record.amount}</span>}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          {record.file && (
                            <>
                              <a href={getImageUrl(record.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors" title="View">
                                <Eye size={14} />
                              </a>
                            </>
                          )}
                          <button type="button" onClick={() => handleDeleteBillingRecord(record.id)} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={extending}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-purple-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Add New PO</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">PO Number</label>
                      <input 
                        type="text" 
                        value={formData.new_po.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, number: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-black/40 border-purple-500/20 text-white focus:border-purple-500" 
                        placeholder="e.g. PO-998877"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_po.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, amount: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-black/40 border-purple-500/20 text-white focus:border-purple-500" 
                        placeholder="e.g. $5,000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload PO Document</label>
                    <input 
                      type="file" 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, file: e.target.files[0] } }))}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 cursor-pointer" 
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => handleAddBillingRecord('PO')}
                      disabled={extending || (!formData.new_po.number && !formData.new_po.file)}
                      className="bg-purple-500 text-white hover:bg-purple-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50"
                    >
                      {extending ? 'Saving...' : 'Save New PO'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={() => setShowBillingModal(false)}
                  className="bg-slate-700 text-white hover:bg-slate-600 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Document Upload Modal */}
      {showDocModal && project && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploadingDoc && setShowDocModal(false)}></div>
          
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-blue-500/30 shadow-2xl relative z-10 animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-blue-500/20 flex justify-between items-center bg-blue-500/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                  <File className="mr-3 text-blue-400" size={24} />
                  Manage General Documents
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500/70 mt-2">
                  Project: {project.name}
                </p>
              </div>
              <button onClick={() => !uploadingDoc && setShowDocModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Attached Documents
                </h3>

                {project.documents && project.documents.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {project.documents.map(doc => (
                      <div key={doc.id} className="p-3 bg-panel rounded-xl border border-blue-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[250px]">
                          <CheckCircle size={14} className="text-blue-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate">
                            {doc.name}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {doc.file && (
                            <>
                              <a href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="View">
                                <Eye size={14} />
                              </a>
                            </>
                          )}
                          <button type="button" onClick={() => handleDeleteGeneralDocument(doc.id)} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={uploadingDoc}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-blue-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Upload New Document</h4>
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Document Name</label>
                      <input 
                        type="text" 
                        value={docFormData.name} 
                        onChange={(e) => setDocFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="glass-input w-full p-2.5 text-xs bg-black/40 border-blue-500/20 text-white focus:border-blue-500" 
                        placeholder="e.g. Site Plan, Vendor Invoice..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload File</label>
                    <input 
                      type="file" 
                      onChange={(e) => setDocFormData(prev => ({ ...prev, file: e.target.files[0] }))}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 cursor-pointer" 
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button" 
                      onClick={handleAddDocument}
                      disabled={uploadingDoc || !docFormData.name || !docFormData.file}
                      className="bg-blue-500 text-white hover:bg-blue-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
                    >
                      {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <button 
                  type="button" 
                  onClick={() => setShowDocModal(false)}
                  className="bg-slate-700 text-white hover:bg-slate-600 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
