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
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
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
  const [billingData, setBillingData] = useState({
    bill_number: '',
    po_number: '',
    bill_document: null,
    po_document: null
  });

  const [docData, setDocData] = useState({ name: '', file: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const handleBillingFileChange = (e, field) => {
    setBillingData(prev => ({ ...prev, [field]: e.target.files[0] }));
  };

  const submitBillingDocs = async (e) => {
    e.preventDefault();
    if (!project) return;

    const formDataToSend = new FormData();
    formDataToSend.append('bill_number', billingData.bill_number);
    formDataToSend.append('po_number', billingData.po_number);
    
    if (billingData.bill_document) {
      formDataToSend.append('bill_document', billingData.bill_document);
    }
    if (billingData.po_document) {
      formDataToSend.append('po_document', billingData.po_document);
    }

    try {
      setExtending(true); // Reusing submitting state
      await api.patch(`/tickets/projects/${project.id || project._id}/`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Billing documents uploaded successfully', 'success');
      setShowBillingModal(false);
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload billing documents', 'error');
    } finally {
      setExtending(false);
    }
  };

  const handleDeleteBillingDocument = async (field) => {
    if (!project || !window.confirm(`Are you sure you want to remove this ${field === 'bill_document' ? 'Bill' : 'PO'}? This will delete the file and clear the number.`)) return;

    const data = new FormData();
    data.append(field, ''); 
    
    if (field === 'bill_document') {
      data.append('bill_number', '');
      setBillingData(prev => ({ ...prev, bill_number: '', bill_document: null }));
    } else if (field === 'po_document') {
      data.append('po_number', '');
      setBillingData(prev => ({ ...prev, po_number: '', po_document: null }));
    }

    try {
      setExtending(true);
      await api.patch(`/tickets/projects/${project.id || project._id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Document removed successfully', 'success');
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to remove document', 'error');
    } finally {
      setExtending(false);
    }
  };

  const submitProjectDocument = async (e) => {
    e.preventDefault();
    if (!docData.name || !docData.file) return;

    const data = new FormData();
    data.append('project', project.id || project._id);
    data.append('name', docData.name);
    data.append('file', docData.file);

    try {
      setUploadingDoc(true);
      await api.post('/tickets/project-documents/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Document uploaded successfully', 'success');
      setShowDocModal(false);
      setDocData({ name: '', file: null });
      fetchProjectDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const deleteProjectDocument = async (docId) => {
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-main">
                <div>
                  <label className="text-[10px] font-black text-dim uppercase tracking-widest flex items-center mb-1">
                    <User size={12} className="mr-1" /> Client Entity
                  </label>
                  <p className="text-base font-bold text-main">{project.client_name || 'Internal / N/A'}</p>
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
                   setBillingData({
                     bill_number: project.bill_number || '',
                     po_number: project.po_number || '',
                     bill_document: null,
                     po_document: null
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
                   setDocData({ name: '', file: null });
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
      {showBillingModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !extending && setShowBillingModal(false)}></div>
          
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-emerald-500/30 shadow-2xl relative z-10 animate-scale-in">
            <div className="p-8 border-b border-emerald-500/20 flex justify-between items-center bg-emerald-500/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                  <Upload className="mr-3 text-emerald-400" size={24} />
                  Attach Billing Documents
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 mt-2">
                  Documents will sync to the main Billing Page
                </p>
              </div>
              <button onClick={() => !extending && setShowBillingModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={submitBillingDocs} className="p-8 space-y-6">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Bill Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Bill Number / Amount</label>
                    <input 
                      type="text" 
                      value={billingData.bill_number} 
                      onChange={(e) => setBillingData(prev => ({ ...prev, bill_number: e.target.value }))}
                      className="glass-input w-full p-3 text-xs bg-black/40 border-emerald-500/20 text-white focus:border-emerald-500" 
                      placeholder="e.g. INV-2026-001"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload Bill PDF/Image</label>
                    <input 
                      type="file" 
                      onChange={(e) => handleBillingFileChange(e, 'bill_document')}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer" 
                    />
                    {project.bill_document && !billingData.bill_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-emerald-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate" title={getFileName(project.bill_document)}>
                            {getFileName(project.bill_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getImageUrl(project.bill_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors">
                            <Eye size={14} />
                          </a>
                          <button type="button" onClick={() => handleDeleteBillingDocument('bill_document')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Purchase Order (PO) Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">PO Number</label>
                    <input 
                      type="text" 
                      value={billingData.po_number} 
                      onChange={(e) => setBillingData(prev => ({ ...prev, po_number: e.target.value }))}
                      className="glass-input w-full p-3 text-xs bg-black/40 border-purple-500/20 text-white focus:border-purple-500" 
                      placeholder="e.g. PO-998877"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload PO Document</label>
                    <input 
                      type="file" 
                      onChange={(e) => handleBillingFileChange(e, 'po_document')}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 cursor-pointer" 
                    />
                    {project.po_document && !billingData.po_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-purple-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate" title={getFileName(project.po_document)}>
                            {getFileName(project.po_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getImageUrl(project.po_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors">
                            <Eye size={14} />
                          </a>
                          <button type="button" onClick={() => handleDeleteBillingDocument('po_document')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowBillingModal(false)} disabled={extending} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                <button 
                  type="submit" 
                  disabled={extending}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center"
                >
                  {extending ? 'UPLOADING...' : 'SAVE & SYNC TO BILLING'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Extend Deadline Modal */}
      {showExtendModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => !extending && setShowExtendModal(false)}></div>
          
          <div className="bg-card rounded-[2rem] w-full max-w-md overflow-hidden border border-main shadow-2xl animate-scale-in relative z-10">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-main tracking-tight uppercase flex items-center">
                  <CalendarPlus className="mr-2 text-amber-500" size={20} />
                  Extend Target Date
                </h2>
                <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest font-black">Record Extension Reason</p>
              </div>
              <button onClick={() => !extending && setShowExtendModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExtendDeadline} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">New Target Completion Date</label>
                <input
                  required
                  type="date"
                  value={extendData.newDate}
                  min={project.end_date || ''}
                  onChange={(e) => setExtendData({...extendData, newDate: e.target.value})}
                  className="glass-input w-full p-3 bg-panel border-main cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">Reason for Extension</label>
                <textarea
                  required
                  rows={3}
                  value={extendData.reason}
                  onChange={(e) => setExtendData({...extendData, reason: e.target.value})}
                  className="glass-input w-full p-3 bg-panel border-main resize-none"
                  placeholder="Explain why the project deadline is being extended..."
                />
              </div>

              <div className="flex space-x-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExtendModal(false)}
                  disabled={extending}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main transition-all border border-main rounded-xl hover:bg-panel"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={extending}
                  className="flex-1 bg-amber-500 text-black rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center space-x-2 shadow-lg hover:bg-amber-400 transition-all disabled:opacity-50"
                >
                  {extending ? 'Updating...' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Document Upload Modal */}
      {showDocModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !uploadingDoc && setShowDocModal(false)}></div>
          
          <div className="bg-panel rounded-[2.5rem] w-full max-w-lg overflow-hidden border border-blue-500/30 shadow-2xl relative z-10 animate-scale-in">
            <div className="p-8 border-b border-blue-500/20 flex justify-between items-center bg-blue-500/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                  <Upload className="mr-3 text-blue-400" size={24} />
                  Upload Project Document
                </h2>
              </div>
              <button onClick={() => !uploadingDoc && setShowDocModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={submitProjectDocument} className="p-8 space-y-6">
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Document Title</label>
                <input 
                  type="text" 
                  required
                  value={docData.name} 
                  onChange={(e) => setDocData(prev => ({ ...prev, name: e.target.value }))}
                  className="glass-input w-full p-3 text-xs bg-black/40 border-blue-500/20 text-white focus:border-blue-500" 
                  placeholder="e.g. Architectural Blueprint"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload File</label>
                <input 
                  type="file" 
                  required
                  onChange={(e) => setDocData(prev => ({ ...prev, file: e.target.files[0] }))}
                  className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-blue-500/20 file:text-blue-400 hover:file:bg-blue-500/30 cursor-pointer" 
                />
              </div>

              <div className="flex space-x-4 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowDocModal(false)} disabled={uploadingDoc} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                <button 
                  type="submit" 
                  disabled={uploadingDoc || !docData.name || !docData.file}
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-500 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center justify-center"
                >
                  {uploadingDoc ? 'UPLOADING...' : 'UPLOAD DOCUMENT'}
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
