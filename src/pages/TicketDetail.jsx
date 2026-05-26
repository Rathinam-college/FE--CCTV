import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Info, MessageSquare, Clock, CheckCircle, 
  Send, Shield, Activity, X, Upload, FileText, Hash, File, Eye, Trash2
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

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

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRemark, setNewRemark] = useState('');
  const [newRemarkDate, setNewRemarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRemarkTime, setNewRemarkTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docData, setDocData] = useState({ name: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [completionStep, setCompletionStep] = useState(1);
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

  const [billingData, setBillingData] = useState({
    bill_number: '',
    po_number: '',
    bill_document: null,
    po_document: null
  });

  useEffect(() => {
    fetchTicketData();
  }, [id]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tickets/${id}/`);
      setTicket(res.data);
    } catch (err) {
      console.error('Error fetching ticket:', err);
      showNotification('Failed to load ticket details', 'error');
      navigate('/tickets');
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

  const addRemark = async (e) => {
    e.preventDefault();
    if (!newRemark.trim() || !ticket) return;

    const formattedRemark = `[${newRemarkDate} ${newRemarkTime}] ${newRemark}`;

    try {
      await api.post(`/tickets/${ticket.id || ticket._id}/add_remark/`, {
        remark: formattedRemark
      });
      setNewRemark('');
      fetchTicketData();
      showNotification('Remark added successfully');
    } catch (err) {
      console.error('Error adding remark:', err);
      showNotification('Failed to add remark', 'error');
    }
  };

  const finalizeTicket = async () => {
    if (!completionData.remark.trim()) {
      showNotification('Please provide a completion remark', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const meta = parseMetadata(ticket.remarks);
      
      const updatedMeta = {
        ...meta,
        endTime: completionData.endTime,
        manualDate: completionData.date,
        totalTime: calculateTotalTime(ticket.projectId ? meta.workStartTime : completionData.beforeTime, completionData.endTime),
        workRemarks: ticket.projectId ? meta.workRemarks : completionData.beforeRemark,
        workStartTime: ticket.projectId ? meta.workStartTime : completionData.beforeTime,
        workStartDate: ticket.projectId ? meta.workStartDate : completionData.beforeDate
      };

      const formDataToSend = new FormData();
      formDataToSend.append('status', 'Completed');
      formDataToSend.append('remarks', JSON.stringify(updatedMeta));
      formDataToSend.append('remark', ticket.projectId ? `Final Resolution: ${completionData.remark}` : `Final: ${completionData.remark} | Before: ${completionData.beforeRemark}`);
      
      if (!ticket.projectId) {
        formDataToSend.append('workRemarks', completionData.beforeRemark);
        if (completionData.beforeImage) {
          formDataToSend.append('workImage', completionData.beforeImage);
        }
      }
      if (completionData.afterImage) {
        formDataToSend.append('serviceImage', completionData.afterImage);
      }

      await api.patch(`/tickets/${ticket.id || ticket._id}/`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showNotification('Ticket finalized with before/after records', 'success');
      setShowCompletionModal(false);
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to finalize ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBillingDocs = async (e) => {
    e.preventDefault();
    if (!ticket) return;

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
      setSubmitting(true);
      await api.patch(`/tickets/${ticket.id || ticket._id}/`, formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Billing documents uploaded successfully', 'success');
      setShowBillingModal(false);
      fetchTicketData(); // Refresh ticket data
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload billing documents', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBillingFileChange = (e, field) => {
    setBillingData(prev => ({ ...prev, [field]: e.target.files[0] }));
  };

  const handleDeleteBillingDocument = async (field) => {
    if (!ticket || !window.confirm(`Are you sure you want to remove this ${field === 'bill_document' ? 'Bill' : 'PO'}? This will delete the file and clear the number.`)) return;

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
      setSubmitting(true);
      await api.patch(`/tickets/${ticket.id || ticket._id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Document removed successfully', 'success');
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to remove document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTicketDocument = async (e) => {
    e.preventDefault();
    if (!docData.name || !docData.file || !ticket) return;

    const data = new FormData();
    data.append('ticket', ticket.id || ticket._id);
    data.append('name', docData.name);
    data.append('file', docData.file);

    try {
      setUploadingDoc(true);
      await api.post('/tickets/ticket-documents/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Document uploaded successfully', 'success');
      setShowDocModal(false);
      setDocData({ name: '', file: null });
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const deleteTicketDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      setUploadingDoc(true);
      await api.delete(`/tickets/ticket-documents/${docId}/`);
      showNotification('Document deleted successfully', 'success');
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete document', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading || !ticket) {
    return <div className="flex justify-center items-center h-64 text-dim">Loading ticket details...</div>;
  }

  const meta = parseMetadata(ticket.remarks);

  return (
    <div className="space-y-6 animate-fade-in pb-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/10 pb-6">
        <div className="flex items-center space-x-4">
          <button onClick={() => {
            if (ticket.category === 'Upgrade' || meta.category === 'Upgrade') {
              navigate('/upgrades');
            } else if (ticket.projectId || ticket.project) {
              const pId = ticket.projectId?.id || ticket.projectId || ticket.project?.id || ticket.project;
              navigate(`/projects/${pId}`);
            } else {
              navigate('/tickets');
            }
          }} className="p-2 hover:bg-panel rounded-xl text-dim hover:text-main transition-all border border-transparent hover:border-white/10">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
              {ticket.category === 'Upgrade' || meta.category === 'Upgrade' ? 'Upgrade Details' : (ticket.projectId || ticket.project ? 'Log Details' : 'Ticket Details')}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[10px] font-black text-dim uppercase tracking-[0.3em] bg-panel px-2 py-0.5 rounded">Trace: #{ticket.id || ticket._id}</span>
              <div className="w-1 h-1 rounded-full bg-dim/30"></div>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{ticket.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-panel p-6 space-y-6 bg-gradient-to-br from-blue-500/[0.03] to-indigo-500/[0.03] border-blue-500/10">
            <div className="flex justify-between items-center">
              <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] shadow-sm border ${
                ticket.status === 'Completed' ? 'bg-emerald-500 text-white border-emerald-400' :
                ticket.status === 'In Progress' ? 'bg-orange-500 text-white border-orange-400' :
                'bg-red-500 text-white border-red-400'
              }`}>
                {ticket.status}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-dim uppercase tracking-widest">Received Date</span>
                <span className="text-xs font-bold text-main">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-main to-transparent opacity-10"></div>

            <div className="space-y-3">
              <h4 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em]">Issue Description</h4>
              <div className="bg-panel/50 p-5 rounded-2xl border border-main shadow-inner">
                <p className="text-sm text-main leading-relaxed font-bold italic opacity-90">
                  "{ticket.issueDescription}"
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-card rounded-2xl border border-main">
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Module</span>
                <p className="text-sm text-main font-black uppercase tracking-wider">{ticket.category || meta.category || 'N/A'}</p>
              </div>
              <div className="p-4 bg-card rounded-2xl border border-main">
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Point</span>
                <p className="text-sm text-main font-black uppercase tracking-wider">{ticket.location || meta.location || 'N/A'}</p>
              </div>
            </div>

            {(ticket.workImage || ticket.serviceImage) && (
              <div className="space-y-4 animate-slide-up">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] pl-2">Service Artifacts (Evidence)</h4>
                 <div className="grid grid-cols-2 gap-4">
                    {ticket.workImage && (
                      <div className="group relative">
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">Before Work</span>
                        <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 bg-panel shadow-inner">
                          <img src={getImageUrl(ticket.workImage)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Before" />
                        </div>
                      </div>
                    )}
                    {ticket.serviceImage && (
                      <div className="group relative">
                        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-emerald-500/80 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">After Work</span>
                        <div className="aspect-video rounded-2xl overflow-hidden border border-white/5 bg-panel shadow-inner">
                          <img src={getImageUrl(ticket.serviceImage)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="After" />
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {meta.workStartTime && (
              <div className="space-y-4 animate-slide-up">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] pl-2">Service Timeline</h4>
                 <div className="bg-card p-4 rounded-2xl border border-main space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dim font-bold uppercase tracking-widest">Execution Start</span>
                      <span className="text-main font-black">
                        {meta.workStartDate} <span className="text-blue-500 font-mono ml-2">{meta.workStartTime}</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-dim font-bold uppercase tracking-widest">Completion</span>
                      <span className="text-main font-black">
                        {meta.manualDate} <span className="text-emerald-500 font-mono ml-2">{meta.endTime}</span>
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
                    <span className="text-main font-black">{ticket.raisedByName || 'Authorized Staff'}</span>
                  </div>
                  <div className="h-px bg-main opacity-5"></div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-dim font-bold uppercase tracking-widest">Last Update</span>
                    <span className="text-main font-black">{ticket.message_history?.[0]?.date || 'Today'}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-4 animate-slide-up relative">
               <div className="flex justify-between items-center pl-2">
                 <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Billing & PO Records</h4>
                 <button 
                   onClick={() => {
                     setBillingData({
                       bill_number: ticket.bill_number || '',
                       po_number: ticket.po_number || '',
                       bill_document: null,
                       po_document: null
                     });
                     setShowBillingModal(true);
                   }}
                   className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 px-3 py-1 rounded-lg transition-colors border border-emerald-500/20 flex items-center"
                 >
                   <Upload size={10} className="mr-1" />
                   {(ticket.bill_number || ticket.po_number || ticket.bill_document || ticket.po_document) ? 'Update Docs' : 'Attach Docs'}
                 </button>
               </div>
               {(ticket.bill_number || ticket.po_number || ticket.bill_document || ticket.po_document) ? (
                 <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 space-y-4">
                    {(ticket.bill_number || ticket.bill_document) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-emerald-400 font-bold uppercase tracking-widest flex items-center"><Hash size={12} className="mr-1"/> Bill Record</span>
                        <div className="flex items-center space-x-2">
                          {ticket.bill_number && <span className="text-emerald-300 font-mono font-black bg-emerald-500/10 px-2 py-0.5 rounded">{ticket.bill_number}</span>}
                          {ticket.bill_document && (
                            <a href={getImageUrl(ticket.bill_document)} target="_blank" rel="noopener noreferrer" className="flex items-center px-2 py-0.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors" title="View Document">
                              <File size={12} className="mr-1.5" />
                              <span className="text-[10px] font-bold truncate max-w-[120px]">{getFileName(ticket.bill_document)}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {(ticket.bill_number || ticket.bill_document) && (ticket.po_number || ticket.po_document) && <div className="h-px bg-emerald-500/20"></div>}
                    {(ticket.po_number || ticket.po_document) && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-purple-400 font-bold uppercase tracking-widest flex items-center"><Hash size={12} className="mr-1"/> PO Record</span>
                        <div className="flex items-center space-x-2">
                          {ticket.po_number && <span className="text-purple-300 font-mono font-black bg-purple-500/10 px-2 py-0.5 rounded">{ticket.po_number}</span>}
                          {ticket.po_document && (
                            <a href={getImageUrl(ticket.po_document)} target="_blank" rel="noopener noreferrer" className="flex items-center px-2 py-0.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors" title="View Document">
                              <File size={12} className="mr-1.5" />
                              <span className="text-[10px] font-bold truncate max-w-[120px]">{getFileName(ticket.po_document)}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 flex items-center justify-center text-center">
                   <p className="text-[10px] font-black text-emerald-500/50 uppercase tracking-[0.2em]">No Billing Records Attached</p>
                 </div>
               )}
            </div>

            <div className="space-y-4 animate-slide-up relative mt-6">
               <div className="flex justify-between items-center pl-2">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Ticket Documents</h4>
                 <button 
                   onClick={() => {
                     setDocData({ name: '', file: null });
                     setShowDocModal(true);
                   }}
                   className="text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 px-3 py-1 rounded-lg transition-colors border border-blue-500/20 flex items-center"
                 >
                   <Upload size={10} className="mr-1" />
                   Upload Doc
                 </button>
               </div>
               {ticket.documents && ticket.documents.length > 0 ? (
                 <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 space-y-3">
                   {ticket.documents.map((doc, idx) => (
                      <div key={doc.id || idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-panel border border-blue-500/10 rounded-xl hover:border-blue-500/30 transition-all">
                        <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                          <FileText size={16} className="text-blue-400" />
                          <div>
                            <p className="text-xs font-bold text-main truncate max-w-[150px]">{doc.name}</p>
                            <p className="text-[9px] font-black text-dim uppercase tracking-widest mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="View Document">
                            <Eye size={12} />
                          </a>
                          <button type="button" onClick={() => deleteTicketDocument(doc.id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                   ))}
                 </div>
               ) : (
                 <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 flex items-center justify-center text-center">
                   <p className="text-[10px] font-black text-blue-500/50 uppercase tracking-[0.2em]">No Documents Attached</p>
                 </div>
               )}
            </div>
            
            {ticket.status !== 'Completed' && (
              <div className="pt-6 mt-6 border-t border-main">
                <button
                  onClick={() => {
                    setCompletionStep(ticket.projectId || ticket.project ? 2 : 1);
                    setShowCompletionModal(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg uppercase"
                >
                  Mark as Complete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-main pb-4">
            <h4 className="text-sm font-black text-main uppercase tracking-[0.3em] flex items-center">
              <MessageSquare size={18} className="mr-3 text-teal-500" />
              Operational Activity Log
            </h4>
            <div className="bg-teal-500/10 text-teal-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
              {(ticket.message_history || []).length} Points Recorded
            </div>
          </div>

          <div className="p-8 mb-8 border border-main bg-card/80 backdrop-blur-md rounded-3xl">
            {ticket.status === 'Completed' && user?.role !== 'Super Admin' ? (
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
                <form onSubmit={addRemark} className="relative group space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[9px] font-black text-dim uppercase tracking-widest mb-1 pl-2">Log Date</label>
                      <input 
                        type="date" 
                        value={newRemarkDate}
                        onChange={(e) => setNewRemarkDate(e.target.value)}
                        className="glass-input w-full p-3 text-xs bg-panel border-main rounded-xl"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[9px] font-black text-dim uppercase tracking-widest mb-1 pl-2">Log Time</label>
                      <input 
                        type="time" 
                        value={newRemarkTime}
                        onChange={(e) => setNewRemarkTime(e.target.value)}
                        className="glass-input w-full p-3 text-xs bg-panel border-main rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="relative">
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
                  </div>
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
          
          <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-main before:opacity-10">
            {(ticket.message_history || []).length === 0 ? (
              <div className="text-center py-20 bg-panel/30 rounded-[2.5rem] border-2 border-dashed border-main">
                <div className="w-16 h-16 bg-panel rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <MessageSquare size={28} className="text-dim opacity-20" />
                </div>
                <p className="text-sm text-dim font-black uppercase tracking-[0.2em]">Zero Activity Logs Detected</p>
                <p className="text-[10px] text-dim/50 uppercase tracking-widest mt-2">Initialize communication below</p>
              </div>
            ) : (
              ticket.message_history.map((msg, idx) => {
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
                    {(!ticket.projectId && !ticket.project) && (
                      <button onClick={() => setCompletionStep(1)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Back</button>
                    )}
                    {!ticket.projectId && !ticket.project && (
                      <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
                    )}
                    {(ticket.projectId || ticket.project) && (
                      <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
                    )}
                    <button 
                      onClick={finalizeTicket}
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

      {showBillingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[250] animate-fade-in overflow-y-auto">
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-emerald-500/30 shadow-2xl flex flex-col my-8">
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
              <button onClick={() => setShowBillingModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
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
                    {ticket.bill_document && !billingData.bill_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-emerald-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate" title={getFileName(ticket.bill_document)}>
                            {getFileName(ticket.bill_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getImageUrl(ticket.bill_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors">
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
                    {ticket.po_document && !billingData.po_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-purple-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate" title={getFileName(ticket.po_document)}>
                            {getFileName(ticket.po_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getImageUrl(ticket.po_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors">
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
                <button type="button" onClick={() => setShowBillingModal(false)} className="flex-1 py-3 text-xs font-black text-secondary uppercase tracking-widest hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? 'UPLOADING...' : 'SAVE & SYNC TO BILLING'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-card rounded-[2.5rem] w-full max-w-lg border border-main shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <Upload className="text-blue-500" size={32} />
                <div>
                  <h2 className="text-2xl font-black text-main tracking-tight uppercase">Upload Document</h2>
                  <p className="text-[10px] text-dim font-black uppercase tracking-[0.2em]">Attach file to this ticket</p>
                </div>
              </div>
              <button onClick={() => !uploadingDoc && setShowDocModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={submitTicketDocument} className="p-8 space-y-6">
              <div>
                <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Document Title</label>
                <input 
                  type="text" 
                  required
                  value={docData.name} 
                  onChange={(e) => setDocData(prev => ({ ...prev, name: e.target.value }))}
                  className="glass-input w-full p-3 text-xs bg-panel border-main focus:border-blue-500" 
                  placeholder="e.g. Service Report"
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

              <div className="flex justify-end pt-6 border-t border-main">
                <button 
                  type="submit" 
                  disabled={uploadingDoc || !docData.name || !docData.file}
                  className="glass-button px-12 py-3 disabled:opacity-50"
                >
                  {uploadingDoc ? 'UPLOADING...' : 'UPLOAD DOCUMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
