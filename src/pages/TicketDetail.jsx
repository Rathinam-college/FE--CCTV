import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Info, MessageSquare, Clock, CheckCircle, 
  Send, Shield, Activity, X, Upload, FileText, Hash, File, Eye, Trash2, Plus, Camera, Image as ImageIcon, Printer
} from 'lucide-react';
import api from '../services/api';
import { compressImage } from '../utils/imageCompression';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

const getImageUrl = (path) => {
  if (!path) return '';
  
  try {
    const url = new URL(path);
    path = url.pathname;
  } catch (e) {
    // Relative path
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
  
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRemark, setNewRemark] = useState('');
  const [newRemarkDate, setNewRemarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRemarkTime, setNewRemarkTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const [newRemarkImage, setNewRemarkImage] = useState(null);
  
  const [showInProgressModal, setShowInProgressModal] = useState(false);
  const [inProgressData, setInProgressData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    image: null,
    video: null
  });

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [formData, setFormData] = useState({
    new_bill: { number: '', amount: '', file: null },
    new_po: { number: '', amount: '', file: null }
  });
  const [docFormData, setDocFormData] = useState({ name: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [completionData, setCompletionData] = useState({
    remark: '',
    endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    images: [],
    video: null
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

  const cleanRemarkText = (text) => {
    if (!text) return '';
    return text.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '');
  };

  const calculateAdvancedTimeDiff = (sDate, sTime, eDate, eTime) => {
    if (!sDate || !sTime || !eDate || !eTime) return 'N/A';
    try {
      const start = new Date(`${sDate}T${sTime}`);
      const end = new Date(`${eDate}T${eTime}`);
      if (isNaN(start) || isNaN(end)) return 'N/A';
      
      let diffMs = end - start;
      if (diffMs < 0) return 'N/A';
      
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
      
      return parts.join(' ');
    } catch (e) {
      return 'N/A';
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

  const addRemark = async (e) => {
    e.preventDefault();
    if (!newRemark.trim() || !ticket) return;

    const formattedRemark = `[${newRemarkDate} ${newRemarkTime}] ${newRemark}`;
    
    const formData = new FormData();
    formData.append('remark', formattedRemark);
    if (newRemarkImage) {
      formData.append('image', newRemarkImage);
    }

    try {
      await api.post(`/tickets/${ticket.id || ticket._id}/add_remark/`, formData);
      setNewRemark('');
      setNewRemarkImage(null);
      fetchTicketData();
      showNotification('Remark added successfully');
    } catch (err) {
      console.error('Error adding remark:', err);
      showNotification('Failed to add remark', 'error');
    }
  };

  const transitionToInProgress = async () => {
    try {
      setSubmitting(true);
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

      await api.patch(`/tickets/${ticket.id || ticket._id}/`, formDataToSend);

      showNotification('Ticket status changed to In Progress', 'success');
      setShowInProgressModal(false);
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to update ticket status', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const finalizeTicket = async () => {
    if (!completionData.remark.trim()) {
      showNotification('Please provide a completion remark', 'error');
      return;
    }
    try {
      setSubmitting(true);
      const formDataToSend = new FormData();
      formDataToSend.append('status', 'Completed');
      formDataToSend.append('completedDate', completionData.date);
      formDataToSend.append('completedTime', completionData.endTime);
      formDataToSend.append('actionTaken', completionData.remark);
      formDataToSend.append('endTime', completionData.endTime);
      const startDate = ticket.receivedDate || ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : null);
      const startTime = ticket.receivedTime || ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null);
      formDataToSend.append('totalTime', calculateAdvancedTimeDiff(startDate, startTime, completionData.date, completionData.endTime));
      formDataToSend.append('remark', `Completed: ${completionData.remark}`);
      if (completionData.images && completionData.images.length > 0) {
        completionData.images.forEach(img => {
          formDataToSend.append('completedImages', img);
        });
      }
      if (completionData.video) {
        formDataToSend.append('completedVideo', completionData.video);
      }

      await api.patch(`/tickets/${ticket.id || ticket._id}/`, formDataToSend);

      showNotification('Ticket status changed to Completed', 'success');
      setShowCompletionModal(false);
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to complete ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBillingRecord = async (type) => {
    if (!ticket) return;
    const isBill = type === 'Bill';
    const data = isBill ? formData.new_bill : formData.new_po;
    if (!data.number && !data.file) return;

    const formDataToSend = new FormData();
    formDataToSend.append('ticket', ticket.id || ticket._id);
    formDataToSend.append('record_type', type);
    if (data.number) formDataToSend.append('number', data.number);
    if (data.amount) formDataToSend.append('amount', data.amount);
    if (data.file) formDataToSend.append('file', data.file);

    try {
      setSubmitting(true);
      await api.post('/tickets/ticket-billing-records/', formDataToSend);
      showNotification(`${type} added successfully`, 'success');
      setFormData(prev => ({
        ...prev,
        [isBill ? 'new_bill' : 'new_po']: { number: '', amount: '', file: null }
      }));
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification(`Failed to add ${type}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBillingRecord = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      setSubmitting(true);
      await api.delete(`/tickets/ticket-billing-records/${recordId}/`);
      showNotification('Record deleted successfully', 'success');
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDocument = async (e) => {
    if (e) e.preventDefault();
    if (!docFormData.name || !docFormData.file || !ticket) return;

    const formDataToSend = new FormData();
    formDataToSend.append('ticket', ticket.id || ticket._id);
    formDataToSend.append('name', docFormData.name);
    formDataToSend.append('file', docFormData.file);

    try {
      setSubmitting(true);
      await api.post('/tickets/ticket-documents/', formDataToSend);
      showNotification('Document uploaded successfully', 'success');
      setDocFormData({ name: '', file: null });
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGeneralDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      setSubmitting(true);
      await api.delete(`/tickets/ticket-documents/${docId}/`);
      showNotification('Document deleted successfully', 'success');
      fetchTicketData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !ticket) {
    return <div className="flex justify-center items-center h-64 text-dim">Loading ticket details...</div>;
  }

  const meta = parseMetadata(ticket.remarks);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Ticket Details - #${ticket.id || ticket._id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #0f172a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; font-size: 20px; text-align: center; text-transform: uppercase; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            .grid { display: flex; flex-wrap: wrap; margin: -10px; }
            .grid-item { flex: 1 1 45%; padding: 10px; }
            .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: bold; }
            .value { font-size: 15px; font-weight: bold; color: #111827; }
            .badge { padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            .status-completed { background-color: #d1fae5; color: #047857; }
            .status-progress { background-color: #fef3c7; color: #d97706; }
            .status-open { background-color: #fee2e2; color: #b91c1c; }
            .footer { margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Ticket Details - #${ticket.id || ticket._id}</h1>
          
          <div class="section">
            <div class="grid">
              <div class="grid-item">
                <div class="label">Status</div>
                <div class="value">
                  <span class="badge ${ticket.status === 'Completed' ? 'status-completed' : ticket.status === 'In Progress' ? 'status-progress' : 'status-open'}">
                    ${ticket.status}
                  </span>
                </div>
              </div>
              <div class="grid-item">
                <div class="label">Received Date</div>
                <div class="value">${ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Issue Description</div>
            <p><strong>"${ticket.issueDescription}"</strong></p>
          </div>

          <div class="section">
            <div class="grid">
              <div class="grid-item">
                <div class="label">Ticket Category</div>
                <div class="value">${ticket.category || meta.category || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Point (Location)</div>
                <div class="value">${ticket.location || meta.location || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Raised By</div>
                <div class="value">${ticket.raisedByName || 'Authorized Staff'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Total Resolution Time</div>
                <div class="value">
                   ${calculateAdvancedTimeDiff(
                     ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : null), 
                     ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null), 
                     ticket.completedDate || meta.manualDate, 
                     ticket.completedTime || meta.endTime
                   )}
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Timeline</div>
            <div class="grid">
              <div class="grid-item">
                <div class="label">Created At</div>
                <div class="value">${ticket.createdDate || (ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : 'N/A')} ${ticket.createdTime || ''}</div>
              </div>
              <div class="grid-item">
                <div class="label">In Progress (On Site)</div>
                <div class="value">${ticket.inProgressDate || 'N/A'} ${ticket.inProgressTime || ''}</div>
              </div>
              <div class="grid-item">
                <div class="label">Completed At</div>
                <div class="value">${ticket.completedDate || 'N/A'} ${ticket.completedTime || ''}</div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            Generated from CCTV System on ${new Date().toLocaleString()}
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
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 border-b border-main pb-6">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => {
              if (ticket.category === 'Upgrade' || meta.category === 'Upgrade') {
                navigate('/upgrades');
              } else if (ticket.projectId || ticket.project) {
                const pId = ticket.projectId?.id || ticket.projectId || ticket.project?.id || ticket.project;
                navigate(`/projects/${pId}`);
              } else {
                navigate('/tickets');
              }
            }} 
            className="p-3 bg-panel hover:bg-white/10 rounded-2xl text-secondary hover:text-main transition-all border border-main"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-main tracking-tight uppercase flex items-center">
              {ticket.category === 'Upgrade' || meta.category === 'Upgrade' ? 'Upgrade details' : (ticket.projectId || ticket.project ? 'Log details' : 'Ticket details')}
            </h1>
            <div className="flex items-center space-x-3 mt-1.5">
              <span className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] bg-panel border border-main px-2.5 py-0.5 rounded-lg">Ticket ID: #{ticket.id || ticket._id}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-main/20"></span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                ticket.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                ticket.status === 'In Progress' ? 'bg-orange-500/10 text-orange-500 animate-pulse' :
                'bg-red-500/10 text-red-500'
              }`}>
                {ticket.status}
              </span>
            </div>
          </div>
        </div>
        <div>
          <button 
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all border border-blue-500/20 shadow-md shadow-blue-500/5"
          >
            <Printer size={14} />
            <span>Export / Print</span>
          </button>
        </div>
      </div>

      {/* Full-width Ticket Status Timeline Card at the Top */}
      <div className="hud-panel p-6">
        <div className="hud-corner-tr"></div>
        <div className="hud-corner-bl"></div>
        <h4 className="text-xs font-black text-main uppercase tracking-[0.25em] flex items-center mb-6">
          <Activity size={16} className="mr-2 text-blue-500 animate-pulse" />
          Ticket Status Timeline
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector Line */}
          <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-[2px] bg-main z-0">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-orange-500 to-emerald-500 transition-all duration-700" 
              style={{
                width: ticket.status === 'Completed' ? '100%' : ticket.status === 'In Progress' ? '50%' : '0%'
              }}
            ></div>
          </div>

          {/* Step 1: Logged */}
          <div className="relative z-10 flex flex-col items-center md:items-start bg-panel p-4 rounded-2xl border border-main">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 border-2 shadow-md ${
              ticket.status === 'Open' ? 'bg-blue-500/10 text-blue-400 border-blue-500 animate-pulse' :
              (ticket.status === 'In Progress' || ticket.status === 'Completed') ? 'bg-blue-600 text-white border-blue-500' : 'bg-panel text-dim border-main'
            }`}>
              <Plus size={18} />
            </div>
            <h5 className="text-[10px] font-black uppercase tracking-wider text-main mb-1">1. Logged / Opened</h5>
            <span className="text-[9px] text-dim font-bold">
              {ticket.createdDate || (ticket.createdAt ? new Date(ticket.createdAt).toISOString().split('T')[0] : 'N/A')}
            </span>
            <span className="text-[9px] text-dim font-mono mt-0.5">
              {ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')}
            </span>
            
            {ticket.createdImage && (
              <div className="mt-3 group relative w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                <img src={getImageUrl(ticket.createdImage)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Created" />
                <a href={getImageUrl(ticket.createdImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white bg-black/60 px-2 py-1 rounded-lg flex items-center"><Eye size={10} className="mr-1"/> View</span>
                </a>
              </div>
            )}
            {ticket.createdVideo && (
              <div className="mt-3 w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                <video src={getImageUrl(ticket.createdVideo)} className="w-full h-full object-cover" controls />
              </div>
            )}
          </div>

          {/* Step 2: In Progress */}
          <div className="relative z-10 flex flex-col items-center md:items-start bg-panel p-4 rounded-2xl border border-main">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 border-2 shadow-md ${
              ticket.status === 'In Progress' ? 'bg-orange-500/10 text-orange-400 border-orange-500 animate-pulse' :
              ticket.status === 'Completed' ? 'bg-orange-600 text-white border-orange-500' : 'bg-panel text-dim border-main'
            }`}>
              <Clock size={18} />
            </div>
            <h5 className="text-[10px] font-black uppercase tracking-wider text-main mb-1">2. In Progress</h5>
            {ticket.status === 'Open' ? (
              <div className="mt-2 w-full">
                {canEdit ? (
                  <button 
                    onClick={() => {
                      setInProgressData({
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                        image: null
                      });
                      setShowInProgressModal(true);
                    }}
                    className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
                  >
                    Start Work
                  </button>
                ) : (
                  <span className="text-[8px] text-dim uppercase tracking-widest font-black block mt-2">Awaiting Crew</span>
                )}
              </div>
            ) : (
              <>
                <span className="text-[9px] text-dim font-bold">{ticket.inProgressDate || 'Date N/A'}</span>
                <span className="text-[9px] text-dim font-mono mt-0.5">{ticket.inProgressTime || 'Time N/A'}</span>
                
                {ticket.inProgressImage && (
                  <div className="mt-3 group relative w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                    <img src={getImageUrl(ticket.inProgressImage)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="In Progress" />
                    <a href={getImageUrl(ticket.inProgressImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white bg-black/60 px-2 py-1 rounded-lg flex items-center"><Eye size={10} className="mr-1"/> View</span>
                    </a>
                  </div>
                )}
                {ticket.inProgressVideo && (
                  <div className="mt-3 w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                    <video src={getImageUrl(ticket.inProgressVideo)} className="w-full h-full object-cover" controls />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Step 3: Completed */}
          <div className="relative z-10 flex flex-col items-center md:items-start bg-panel p-4 rounded-2xl border border-main">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 border-2 shadow-md ${
              ticket.status === 'Completed' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-panel text-dim border-main'
            }`}>
              <CheckCircle size={18} />
            </div>
            <h5 className="text-[10px] font-black uppercase tracking-wider text-main mb-1">3. Completed / Closed</h5>
            {ticket.status !== 'Completed' ? (
              <div className="mt-2 w-full">
                {ticket.status === 'In Progress' ? (
                  canEdit ? (
                    <button 
                      onClick={() => {
                        setCompletionData({
                          remark: '',
                          endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                          date: new Date().toISOString().split('T')[0],
                          images: []
                        });
                        setShowCompletionModal(true);
                      }}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
                    >
                      Complete Work
                    </button>
                  ) : (
                    <span className="text-[8px] text-dim uppercase tracking-widest font-black block mt-2">Active</span>
                  )
                ) : (
                  <span className="text-[8px] text-dim uppercase tracking-widest font-black block mt-2">Waiting...</span>
                )}
              </div>
            ) : (
              <>
                <span className="text-[9px] text-dim font-bold">{ticket.completedDate || 'Date N/A'}</span>
                <span className="text-[9px] text-dim font-mono mt-0.5">{ticket.completedTime || 'Time N/A'}</span>
                
                {ticket.completed_images && Array.isArray(ticket.completed_images) && ticket.completed_images.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 w-full">
                    {ticket.completed_images.slice(0, 2).map((imgObj, idx) => (
                      <div key={idx} className="group relative w-full aspect-square rounded-xl overflow-hidden border border-main bg-card">
                        <img src={getImageUrl(imgObj?.image)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt={`Evidence ${idx + 1}`} />
                        <a href={getImageUrl(imgObj?.image)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white bg-black/60 px-2 py-1 rounded-lg flex items-center"><Eye size={10} className="mr-1"/> View</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : ticket.completedImage ? (
                  <div className="mt-3 group relative w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                    <img src={getImageUrl(ticket.completedImage)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Completed" />
                    <a href={getImageUrl(ticket.completedImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[8px] font-black uppercase tracking-widest text-white bg-black/60 px-2 py-1 rounded-lg flex items-center"><Eye size={10} className="mr-1"/> View</span>
                    </a>
                  </div>
                ) : null}

                {ticket.completedVideo && (
                  <div className="mt-3 w-full aspect-video rounded-xl overflow-hidden border border-main bg-card">
                    <video src={getImageUrl(ticket.completedVideo)} className="w-full h-full object-cover" controls />
                  </div>
                )}
                {canEdit && (
                  <label className="mt-3 w-full cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest text-center border border-emerald-500/20 transition-all flex items-center justify-center">
                    <Upload size={10} className="mr-1" /> Add Files
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        if (files.length > 0) {
                          try {
                            setUploadingDoc(true);
                            const compressedPromises = files.map(f => compressImage(f, 50));
                            const compressedFiles = await Promise.all(compressedPromises);
                            
                            const formDataToSend = new FormData();
                            compressedFiles.forEach(img => {
                              formDataToSend.append('completedImages', img);
                            });
                            await api.patch(`/tickets/${ticket.id || ticket._id}/`, formDataToSend);
                            showNotification('Images uploaded successfully', 'success');
                            fetchTicketData();
                          } catch (err) {
                            console.error(err);
                            showNotification('Failed to upload images', 'error');
                          } finally {
                            setUploadingDoc(false);
                          }
                        }
                      }}
                    />
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (Main conversation, updates, gallery) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Issue Description Card */}
          <div className="hud-panel p-6 space-y-4">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] pl-1">Issue Description</h4>
            <div className="bg-panel p-5 rounded-2xl border border-main relative overflow-hidden group">
              <p className="text-sm text-main leading-relaxed font-bold italic opacity-95">
                "{ticket.issueDescription}"
              </p>
            </div>
          </div>

          {/* Service Evidence (Before / After Gallery) */}
          {(ticket.workImage || ticket.serviceImage) && (
            <div className="hud-panel p-6 space-y-4">
              <div className="hud-corner-tr"></div>
              <div className="hud-corner-bl"></div>
              <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] pl-1">Service Evidence (Before & After)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ticket.workImage && (
                  <div className="group relative">
                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">Before Work</span>
                    <a href={getImageUrl(ticket.workImage)} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-2xl overflow-hidden border border-main bg-panel shadow-inner relative">
                      <img src={getImageUrl(ticket.workImage)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Before" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-xl text-[9px] font-bold text-white flex items-center uppercase tracking-widest border border-white/20">
                          <Eye size={12} className="mr-1.5" /> View
                        </div>
                      </div>
                    </a>
                  </div>
                )}
                {ticket.serviceImage && (
                  <div className="group relative">
                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-emerald-500/80 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10">After Work</span>
                    <a href={getImageUrl(ticket.serviceImage)} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-2xl overflow-hidden border border-main bg-panel shadow-inner relative">
                      <img src={getImageUrl(ticket.serviceImage)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="After" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="px-3 py-1.5 bg-emerald-600/80 backdrop-blur-md rounded-xl text-[9px] font-bold text-white flex items-center uppercase tracking-widest border border-white/20">
                          <Eye size={12} className="mr-1.5" /> View
                        </div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat & Logs Section */}
          <div className="hud-panel p-6 space-y-6">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>

            <div className="flex justify-between items-center border-b border-main pb-4">
              <h4 className="text-xs font-black text-main uppercase tracking-[0.25em] flex items-center">
                <MessageSquare size={16} className="mr-2 text-teal-400" />
                Activity History & Comments
              </h4>
              <div className="bg-panel border border-main text-secondary px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider">
                {(ticket.message_history || []).length} Log Entries
              </div>
            </div>

            {/* Remark Submission Form */}
            {!(ticket.status === 'Completed' && user?.role !== 'Super Admin') && (
              <div className="bg-panel p-5 rounded-2xl border border-main space-y-4">
                <form onSubmit={addRemark} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-black text-dim uppercase tracking-widest mb-1.5 pl-1">Record Date</label>
                      <input 
                        type="date" 
                        value={newRemarkDate}
                        onChange={(e) => setNewRemarkDate(e.target.value)}
                        className="glass-input w-full p-2.5 text-xs bg-card"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-dim uppercase tracking-widest mb-1.5 pl-1">Record Time</label>
                      <input 
                        type="time" 
                        value={newRemarkTime}
                        onChange={(e) => setNewRemarkTime(e.target.value)}
                        className="glass-input w-full p-2.5 text-xs bg-card font-mono"
                      />
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      placeholder="Add technical update or operational observation..."
                      className="glass-input w-full p-4 pr-16 text-xs min-h-[90px] resize-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-dim/40 font-bold bg-card"
                    />
                    <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                      {newRemarkImage && (
                        <div className="text-[8px] bg-panel/90 px-2 py-1 rounded-lg text-blue-400 truncate max-w-[100px] border border-blue-500/20 flex items-center backdrop-blur-md">
                          <span className="truncate mr-1 font-bold">{newRemarkImage.name}</span>
                          <button type="button" onClick={() => setNewRemarkImage(null)} className="text-blue-400 hover:text-red-400"><X size={10} /></button>
                        </div>
                      )}
                      <label className="p-2 bg-panel hover:bg-white/10 text-secondary hover:text-blue-400 rounded-xl transition-all cursor-pointer border border-main">
                        <Upload size={14} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (file) {
                              try {
                                const compressedFile = await compressImage(file, 50);
                                setNewRemarkImage(compressedFile);
                              } catch (err) {
                                showNotification('Failed to process image', 'error');
                              }
                            }
                          }}
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={!newRemark.trim()}
                        className="p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white rounded-xl transition-all shadow-md shadow-blue-600/10 hover:scale-105 active:scale-95 flex items-center justify-center"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Feed History with vertical timeline */}
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-main before:opacity-10">
              {(ticket.message_history || []).length === 0 ? (
                <div className="text-center py-16 bg-panel/50 rounded-2xl border border-dashed border-main">
                  <MessageSquare size={24} className="mx-auto text-dim/30 mb-3" />
                  <p className="text-xs text-dim font-black uppercase tracking-[0.15em]">No activity logs recorded</p>
                </div>
              ) : (
                ticket.message_history.map((msg, idx) => {
                  const isSystem = msg.remark?.toLowerCase().includes('status updated') || msg.remark?.toLowerCase().includes('initial ticket');
                  return (
                    <div key={idx} className="relative pl-8 animate-fade-in group" style={{ animationDelay: `${idx * 40}ms` }}>
                      {/* Timeline Node */}
                      <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 border-main z-10 flex items-center justify-center transition-transform group-hover:scale-110 bg-panel shadow-sm ${
                        isSystem ? 'border-slate-500' : 'border-blue-500'
                      }`}>
                        {isSystem ? <Activity size={10} className="text-slate-500" /> : <Shield size={10} className="text-blue-500" />}
                      </div>
                      
                      {/* Message Card */}
                      <div className={`rounded-2xl p-4 border transition-all duration-300 ${
                        isSystem 
                          ? 'bg-panel/30 border-main hover:bg-panel/50' 
                          : 'bg-panel/80 border-main hover:bg-panel hover:border-blue-500/20 shadow-sm'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${isSystem ? 'text-secondary' : 'text-blue-500'}`}>
                              {isSystem ? 'System Protocol' : (msg.user_name || 'Technician Agent')}
                            </span>
                            <span className="text-[8px] text-dim font-bold mt-0.5 uppercase tracking-wider flex items-center font-mono">
                              <Clock size={10} className="mr-1 opacity-50" />
                              {msg.date} | {msg.time}
                            </span>
                          </div>
                          {msg.device_status && (
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                              msg.device_status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              msg.device_status === 'In Progress' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                              'bg-red-500/10 text-red-500 border-red-500/20'
                            }`}>
                              {msg.device_status}
                            </span>
                          )}
                        </div>
                        <div className="h-px bg-main opacity-5 mb-2"></div>
                        <p className={`text-xs leading-relaxed ${isSystem ? 'text-dim italic font-medium opacity-80' : 'text-main font-bold'}`}>
                          {cleanRemarkText(msg.remark)}
                        </p>
                        {msg.image && (
                          <div className="mt-3">
                            <a href={getImageUrl(msg.image)} target="_blank" rel="noopener noreferrer" className="block w-full max-w-sm rounded-xl overflow-hidden border border-main bg-card shadow-inner relative group/img">
                              <img src={getImageUrl(msg.image)} className="w-full object-cover group-hover/img:scale-103 transition-transform duration-300 max-h-48" alt="Attachment" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="px-2 py-1 bg-blue-600/80 backdrop-blur-md rounded-lg text-[9px] font-bold text-white flex items-center uppercase tracking-widest border border-white/25">
                                  <Eye size={11} className="mr-1.5" /> View
                                </div>
                              </div>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Sidebar containing properties, bills, documents, action buttons) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Action Buttons Panel */}
          {ticket.status !== 'Completed' && (
            <div className="hud-panel p-6 space-y-4">
              <div className="hud-corner-tr"></div>
              <div className="hud-corner-bl"></div>
              <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] pl-1">Actions</h4>
              {ticket.status === 'Open' ? (
                <button
                  onClick={() => {
                    setInProgressData({
                      date: new Date().toISOString().split('T')[0],
                      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                      image: null
                    });
                    setShowInProgressModal(true);
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg hover:shadow-orange-500/20 active:scale-[0.99] uppercase"
                >
                  Start Work
                </button>
              ) : (
                <button
                  onClick={() => {
                    setCompletionData({
                      remark: '',
                      endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                      date: new Date().toISOString().split('T')[0],
                      image: null
                    });
                    setShowCompletionModal(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl text-xs font-black tracking-widest transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.99] uppercase"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          )}

          {/* Ticket Properties Card */}
          <div className="hud-panel p-6 space-y-4">
            <div className="hud-corner-tr"></div>
            <div className="hud-corner-bl"></div>
            <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] pl-1">Ticket Properties</h4>
            
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Ticket Category</span>
                <p className="text-sm text-main font-black uppercase tracking-wider">{ticket.category || meta.category || 'N/A'}</p>
              </div>
              <div className="h-px bg-main opacity-5"></div>
              <div>
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Point / Location</span>
                <p className="text-sm text-main font-black uppercase tracking-wider">{ticket.location || meta.location || 'N/A'}</p>
              </div>
              <div className="h-px bg-main opacity-5"></div>
              <div>
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Raised By</span>
                <p className="text-sm text-main font-bold">{ticket.raisedByName || 'Authorized Staff'}</p>
              </div>
              <div className="h-px bg-main opacity-5"></div>
              <div>
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Logged Date</span>
                <p className="text-sm text-main font-bold">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A'}</p>
              </div>
              
              <div className="h-px bg-main opacity-5"></div>
              
              {/* Resolution Metrics Panel */}
              <div className="space-y-2 pt-2">
                <span className="text-[9px] text-dim uppercase font-black tracking-widest block mb-1">Resolution Metrics</span>
                <div className="flex justify-between items-center">
                  <span className="text-secondary font-bold uppercase tracking-widest text-[9px]">Reaction Time</span>
                  <span className="text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 text-[10px]">
                    {calculateAdvancedTimeDiff(
                      ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : null), 
                      ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null), 
                      ticket.inProgressDate || meta.workStartDate, 
                      ticket.inProgressTime || meta.workStartTime
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary font-bold uppercase tracking-widest text-[9px]">Execution Time</span>
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
                    {calculateAdvancedTimeDiff(
                      ticket.inProgressDate || meta.workStartDate, 
                      ticket.inProgressTime || meta.workStartTime, 
                      ticket.completedDate || meta.manualDate, 
                      ticket.completedTime || meta.endTime
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary font-bold uppercase tracking-widest text-[9px]">Total Resolution</span>
                  <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[10px]">
                    {calculateAdvancedTimeDiff(
                      ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : null), 
                      ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null), 
                      ticket.completedDate || meta.manualDate, 
                      ticket.completedTime || meta.endTime
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing & PO Card */}
          <div className="hud-panel p-6 space-y-4">
             <div className="hud-corner-tr"></div>
             <div className="hud-corner-bl"></div>
             <div className="flex justify-between items-center">
               <h4 className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">Billing & PO Documents</h4>
               <button 
                 onClick={() => {
                   setFormData({
                     new_bill: { number: '', amount: '', file: null },
                     new_po: { number: '', amount: '', file: null }
                   });
                   setShowBillingModal(true);
                 }}
                 className="text-[8px] font-black uppercase tracking-widest text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors border border-emerald-500/20 flex items-center"
               >
                 <Upload size={10} className="mr-1" />
                 Manage
               </button>
             </div>
             {(ticket.bill_number || ticket.po_number || ticket.bill_document || ticket.po_document) ? (
               <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 space-y-3">
                  {(ticket.bill_number || ticket.bill_document) && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-400 font-bold uppercase tracking-widest text-[9px] flex items-center"><Hash size={10} className="mr-1"/> Bill</span>
                      <div className="flex items-center space-x-2">
                        {ticket.bill_number && <span className="text-emerald-300 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">{ticket.bill_number}</span>}
                        {ticket.bill_document && (
                          <a href={getImageUrl(ticket.bill_document)} target="_blank" rel="noopener noreferrer" className="flex items-center px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors border border-emerald-500/30" title="View Document">
                            <File size={10} className="mr-1" />
                            <span className="text-[8px] font-bold truncate max-w-[80px]">{getFileName(ticket.bill_document)}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {(ticket.bill_number || ticket.bill_document) && (ticket.po_number || ticket.po_document) && <div className="h-px bg-emerald-500/20"></div>}
                  {(ticket.po_number || ticket.po_document) && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-400 font-bold uppercase tracking-widest text-[9px] flex items-center"><Hash size={10} className="mr-1"/> PO</span>
                      <div className="flex items-center space-x-2">
                        {ticket.po_number && <span className="text-purple-300 font-mono font-bold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 text-[10px]">{ticket.po_number}</span>}
                        {ticket.po_document && (
                          <a href={getImageUrl(ticket.po_document)} target="_blank" rel="noopener noreferrer" className="flex items-center px-1.5 py-0.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors border border-purple-500/30" title="View Document">
                            <File size={10} className="mr-1" />
                            <span className="text-[8px] font-bold truncate max-w-[80px]">{getFileName(ticket.po_document)}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
               </div>
             ) : (
               <div className="bg-panel p-4 rounded-2xl border border-main flex items-center justify-center text-center">
                 <p className="text-[10px] font-black text-dim/60 uppercase tracking-[0.2em]">No financial docs</p>
               </div>
             )}
          </div>

          {/* Document Vault Card */}
          <div className="hud-panel p-6 space-y-4">
             <div className="hud-corner-tr"></div>
             <div className="hud-corner-bl"></div>
             <div className="flex justify-between items-center">
               <h4 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em]">General Documents</h4>
               <button 
                 onClick={() => {
                   setDocFormData({ name: '', file: null });
                   setShowDocModal(true);
                 }}
                 className="text-[8px] font-black uppercase tracking-widest text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-500/30 px-2.5 py-1 rounded-lg transition-colors border border-blue-500/20 flex items-center"
               >
                 <Upload size={10} className="mr-1" />
                 Manage
               </button>
             </div>
             {ticket.documents && ticket.documents.length > 0 ? (
               <div className="bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20 space-y-3">
                 {ticket.documents.map((doc, idx) => (
                    <div key={doc.id || idx} className="flex justify-between items-center p-2.5 bg-panel border border-blue-500/10 rounded-xl hover:border-blue-500/30 transition-all">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText size={12} className="text-blue-400 flex-shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-main truncate max-w-[120px]">{doc.name}</p>
                        </div>
                      </div>
                      <div className="flex space-x-1 flex-shrink-0">
                        <a href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="View Document">
                          <Eye size={10} />
                        </a>
                        <button type="button" onClick={() => handleDeleteGeneralDocument(doc.id)} className="p-1 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                 ))}
               </div>
             ) : (
               <div className="bg-panel p-4 rounded-2xl border border-main flex items-center justify-center text-center">
                 <p className="text-[10px] font-black text-dim/60 uppercase tracking-[0.2em]">No files attached</p>
               </div>
             )}
          </div>

        </div>
      </div>

      {/* Modals & Dialogs */}
      {/* 1. Staff On Site (In Progress) Modal */}
      {showInProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in overflow-y-auto">
          <div className="bg-panel rounded-[2rem] w-full max-w-lg border border-main shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-main bg-card flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Clock className="text-orange-500 animate-pulse" size={24} />
                <div>
                  <h3 className="text-lg font-black text-main uppercase tracking-tight">Staff On Site</h3>
                  <p className="text-[8px] text-secondary mt-0.5 uppercase tracking-[0.25em] font-black">Transition to In Progress</p>
                </div>
              </div>
              <button onClick={() => setShowInProgressModal(false)} className="text-secondary hover:text-main p-1.5 hover:bg-panel rounded-xl transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">On Site Date</label>
                  <input 
                    type="date" 
                    value={inProgressData.date}
                    onChange={(e) => setInProgressData({...inProgressData, date: e.target.value})}
                    className="glass-input w-full p-2.5 text-xs bg-card"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">On Site Time</label>
                  <input 
                    type="time" 
                    value={inProgressData.time}
                    onChange={(e) => setInProgressData({...inProgressData, time: e.target.value})}
                    className="glass-input w-full p-2.5 text-xs font-mono bg-card"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Evidence Photo (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <ImageIcon size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Gallery</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const compressedFile = await compressImage(file, 50);
                            setInProgressData({...inProgressData, image: compressedFile});
                          } catch (err) {
                            showNotification('Failed to process image', 'error');
                          }
                        }
                      }}
                    />
                  </label>
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <Camera size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Camera</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const compressedFile = await compressImage(file, 50);
                            setInProgressData({...inProgressData, image: compressedFile});
                          } catch (err) {
                            showNotification('Failed to process image', 'error');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                {inProgressData.image && (
                  <div className="mt-2 flex items-center justify-between p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <span className="text-[9px] text-blue-400 font-bold truncate">{inProgressData.image.name}</span>
                    <button onClick={() => setInProgressData({...inProgressData, image: null})} className="text-blue-400"><X size={12} /></button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Evidence Video (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <ImageIcon size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Video Gallery</span>
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
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <Camera size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Record Video</span>
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
                    <span className="text-[9px] text-blue-400 font-bold truncate">{inProgressData.video.name}</span>
                    <button onClick={() => setInProgressData({...inProgressData, video: null})} className="text-blue-400"><X size={12} /></button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-card border-t border-main flex space-x-3">
              <button onClick={() => setShowInProgressModal(false)} className="flex-1 py-2.5 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
              <button 
                disabled={submitting}
                onClick={transitionToInProgress}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-md uppercase"
              >
                {submitting ? 'Updating...' : 'Start Work'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Service Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in overflow-y-auto">
          <div className="bg-panel rounded-[2rem] w-full max-w-lg border border-main shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-main bg-card flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-emerald-500" size={24} />
                <div>
                  <h3 className="text-lg font-black text-main uppercase tracking-tight">Finalize Work</h3>
                  <p className="text-[8px] text-secondary mt-0.5 uppercase tracking-[0.25em] font-black">Service Completion Protocol</p>
                </div>
              </div>
              <button onClick={() => setShowCompletionModal(false)} className="text-secondary hover:text-main p-1.5 hover:bg-panel rounded-xl transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Completion Date</label>
                  <input 
                    type="date" 
                    value={completionData.date}
                    onChange={(e) => setCompletionData({...completionData, date: e.target.value})}
                    className="glass-input w-full p-2.5 text-xs bg-card"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Completion Time</label>
                  <input 
                    type="time" 
                    value={completionData.endTime}
                    onChange={(e) => setCompletionData({...completionData, endTime: e.target.value})}
                    className="glass-input w-full p-2.5 text-xs font-mono bg-card"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1.5">Final Resolution Remark</label>
                <textarea 
                  required
                  value={completionData.remark}
                  onChange={(e) => setCompletionData({...completionData, remark: e.target.value})}
                  placeholder="Describe the final action taken to resolve this ticket..."
                  className="glass-input w-full p-3 text-xs min-h-[90px] resize-none bg-card"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center">
                  <Camera size={12} className="mr-1.5" /> Upload Evidence Files
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <ImageIcon size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Gallery</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        try {
                          const compressedPromises = files.map(f => compressImage(f, 50));
                          const compressedFiles = await Promise.all(compressedPromises);
                          setCompletionData(prev => ({
                            ...prev, 
                            images: [...(prev.images || []), ...compressedFiles]
                          }));
                        } catch (err) {
                          showNotification('Failed to process images', 'error');
                        }
                      }}
                    />
                  </label>
                  <label className="flex flex-col items-center justify-center h-24 border border-dashed rounded-xl cursor-pointer hover:bg-white/5 border-main transition-all bg-card">
                    <Camera size={18} className="text-dim mb-1" />
                    <span className="text-[9px] text-dim font-bold uppercase tracking-wider">Camera</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        try {
                          const compressedPromises = files.map(f => compressImage(f, 50));
                          const compressedFiles = await Promise.all(compressedPromises);
                          setCompletionData(prev => ({
                            ...prev, 
                            images: [...(prev.images || []), ...compressedFiles]
                          }));
                        } catch (err) {
                          showNotification('Failed to process image', 'error');
                        }
                      }}
                    />
                  </label>
                </div>
                {completionData.images && completionData.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {completionData.images.map((img, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-xl">
                        <span className="text-[9px] text-emerald-400 font-bold truncate max-w-[120px]">{img.name}</span>
                        <button type="button" onClick={() => {
                          const newImages = [...completionData.images];
                          newImages.splice(idx, 1);
                          setCompletionData({...completionData, images: newImages});
                        }} className="text-emerald-400 hover:text-red-400 p-0.5"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-card border-t border-main flex space-x-3">
              <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-2.5 text-xs font-black text-secondary uppercase tracking-widest">Cancel</button>
              <button 
                disabled={submitting || !completionData.remark.trim()}
                onClick={finalizeTicket}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-black tracking-widest transition-all shadow-md uppercase disabled:opacity-50"
              >
                {submitting ? 'Completing...' : 'Close Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Billing & PO Management Modal */}
      {showBillingModal && ticket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-panel rounded-[2rem] w-full max-w-4xl border border-main shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-main flex justify-between items-center bg-card">
              <div>
                <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                  <Upload className="mr-2.5 text-emerald-400" size={20} />
                  Billing & PO Management
                </h2>
                <p className="text-[10px] text-secondary mt-1 font-bold">
                  Ticket #{ticket.id} - {ticket.issueDescription}
                </p>
              </div>
              <button onClick={() => setShowBillingModal(false)} className="p-1.5 hover:bg-panel rounded-xl text-secondary hover:text-main transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center">
                  <FileText size={14} className="mr-1.5" />
                  Bill Records
                </h3>

                {ticket.billing_records && ticket.billing_records.filter(r => r.record_type === 'Bill').length > 0 && (
                  <div className="space-y-2">
                    {ticket.billing_records.filter(r => r.record_type === 'Bill').map(record => (
                      <div key={record.id} className="p-3 bg-panel rounded-xl border border-blue-500/10 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CheckCircle size={14} className="text-blue-400 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                              {record.number || 'No Number'}
                            </span>
                            {record.amount && <span className="text-[9px] text-blue-400/70 font-mono mt-0.5">{record.amount}</span>}
                          </div>
                        </div>
                        <div className="flex space-x-1.5">
                          {record.file && (
                            <a href={getImageUrl(record.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="View">
                              <Eye size={12} />
                            </a>
                          )}
                          <button type="button" onClick={() => handleDeleteBillingRecord(record.id)} className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors" disabled={submitting}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-blue-500/15">
                  <h4 className="text-[9px] font-black text-secondary uppercase tracking-widest mb-3">Add Bill Document</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[8px] font-black text-secondary uppercase tracking-widest mb-1.5 pl-1">Bill Reference Number</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, number: e.target.value } }))}
                        className="glass-input w-full p-2 text-xs bg-card" 
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-secondary uppercase tracking-widest mb-1.5 pl-1">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, amount: e.target.value } }))}
                        className="glass-input w-full p-2 text-xs bg-card" 
                        placeholder="e.g. $1,250"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <input 
                      type="file" 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, file: e.target.files[0] } }))}
                      className="text-xs text-dim file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/25 cursor-pointer" 
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddBillingRecord('Bill')}
                      disabled={submitting || (!formData.new_bill.number && !formData.new_bill.file)}
                      className="bg-blue-600 text-white hover:bg-blue-500 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      Save Bill
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-purple-500/5 p-5 border border-purple-500/20 rounded-2xl space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest flex items-center">
                  <FileText size={14} className="mr-1.5" />
                  Purchase Orders (PO)
                </h3>

                {ticket.billing_records && ticket.billing_records.filter(r => r.record_type === 'PO').length > 0 && (
                  <div className="space-y-2">
                    {ticket.billing_records.filter(r => r.record_type === 'PO').map(record => (
                      <div key={record.id} className="p-3 bg-panel rounded-xl border border-purple-500/10 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CheckCircle size={14} className="text-purple-400 flex-shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
                              {record.number || 'No Number'}
                            </span>
                            {record.amount && <span className="text-[9px] text-purple-400/70 font-mono mt-0.5">{record.amount}</span>}
                          </div>
                        </div>
                        <div className="flex space-x-1.5">
                          {record.file && (
                            <a href={getImageUrl(record.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors" title="View">
                              <Eye size={12} />
                            </a>
                          )}
                          <button type="button" onClick={() => handleDeleteBillingRecord(record.id)} className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors" disabled={submitting}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-purple-500/15">
                  <h4 className="text-[9px] font-black text-secondary uppercase tracking-widest mb-3">Add PO Document</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[8px] font-black text-secondary uppercase tracking-widest mb-1.5 pl-1">PO Reference Number</label>
                      <input 
                        type="text" 
                        value={formData.new_po.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, number: e.target.value } }))}
                        className="glass-input w-full p-2 text-xs bg-card" 
                        placeholder="e.g. PO-998877"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-secondary uppercase tracking-widest mb-1.5 pl-1">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_po.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, amount: e.target.value } }))}
                        className="glass-input w-full p-2 text-xs bg-card" 
                        placeholder="e.g. $5,000"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <input 
                      type="file" 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, file: e.target.files[0] } }))}
                      className="text-xs text-dim file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-purple-500/10 file:text-purple-400 hover:file:bg-purple-500/25 cursor-pointer" 
                    />
                    <button 
                      type="button" 
                      onClick={() => handleAddBillingRecord('PO')}
                      disabled={submitting || (!formData.new_po.number && !formData.new_po.file)}
                      className="bg-purple-600 text-white hover:bg-purple-500 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      Save PO
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-card border-t border-main flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowBillingModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. General Document Management Modal */}
      {showDocModal && ticket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-panel rounded-[2rem] w-full max-w-2xl border border-main shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-main flex justify-between items-center bg-card">
              <div>
                <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                  <File className="mr-2.5 text-blue-400" size={20} />
                  General Documents
                </h2>
                <p className="text-[10px] text-secondary mt-1 font-bold">
                  Ticket #{ticket.id} - {ticket.issueDescription}
                </p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="p-1.5 hover:bg-panel rounded-xl text-secondary hover:text-main transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center">
                  <FileText size={14} className="mr-1.5" />
                  Vault Documents
                </h3>

                {ticket.documents && ticket.documents.length > 0 && (
                  <div className="space-y-2">
                    {ticket.documents.map(doc => (
                      <div key={doc.id} className="p-3 bg-panel rounded-xl border border-blue-500/10 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CheckCircle size={14} className="text-blue-400 flex-shrink-0" />
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
                            {doc.name}
                          </span>
                        </div>
                        <div className="flex space-x-1.5">
                          {doc.file && (
                            <a href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors" title="View">
                              <Eye size={12} />
                            </a>
                          )}
                          <button type="button" onClick={() => handleDeleteGeneralDocument(doc.id)} className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors" disabled={submitting}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t border-blue-500/15">
                  <h4 className="text-[9px] font-black text-secondary uppercase tracking-widest mb-3">Upload New Document</h4>
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <label className="block text-[8px] font-black text-secondary uppercase tracking-widest mb-1.5 pl-1">Document Title / Tag</label>
                      <input 
                        type="text" 
                        value={docFormData.name} 
                        onChange={(e) => setDocFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="glass-input w-full p-2 text-xs bg-card" 
                        placeholder="e.g. Site Plan, Vendor Invoice..."
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <input 
                      type="file" 
                      onChange={(e) => setDocFormData(prev => ({ ...prev, file: e.target.files[0] }))}
                      className="text-xs text-dim file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-wider file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/25 cursor-pointer" 
                    />
                    <button 
                      type="button" 
                      onClick={handleAddDocument}
                      disabled={submitting || !docFormData.name || !docFormData.file}
                      className="bg-blue-600 text-white hover:bg-blue-500 px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      Upload File
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-card border-t border-main flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowDocModal(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
