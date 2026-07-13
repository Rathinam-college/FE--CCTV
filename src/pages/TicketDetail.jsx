import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Info, MessageSquare, Clock, CheckCircle, 
  Send, Shield, Activity, X, Upload, FileText, Hash, File, Eye, Trash2, Plus, Camera, Image as ImageIcon, Printer, MapPin, User
} from 'lucide-react';
import api from '../services/api';
import { compressImage } from '../utils/imageCompression';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import pptxgen from 'pptxgenjs';

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
    if ((!newRemark.trim() && !newRemarkImage) || !ticket) return;

    const formattedRemark = `[${newRemarkDate} ${newRemarkTime}] ${newRemark || 'Uploaded an image'}`;
    
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
    const getAbsoluteUrl = (path) => {
      if (!path) return '';
      const rel = getImageUrl(path);
      if (rel.startsWith('http')) return rel;
      return window.location.origin + rel;
    };

    const openImage = getAbsoluteUrl(ticket.createdImage);
    const inProgressImage = getAbsoluteUrl(ticket.inProgressImage);
    const completedImage = getAbsoluteUrl(
      ticket.completedImage || (ticket.completed_images && ticket.completed_images[0]?.image)
    );

    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Ticket Details - #${ticket.id || ticket._id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
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
            .image-grid { display: flex; gap: 15px; margin-top: 10px; }
            .image-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; background-color: #f9fafb; display: flex; flex-direction: column; }
            .evidence-img { width: 100%; height: 180px; object-fit: cover; border-radius: 6px; margin-top: 8px; border: 1px solid #d1d5db; }
            .no-img { height: 180px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; font-style: italic; background-color: #f3f4f6; border-radius: 6px; margin-top: 8px; border: 1px dashed #d1d5db; }
          </style>
        </head>
        <body>
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
            </div>
          </div>

          <div class="section">
            <div class="section-title">Ticket Evidence Images</div>
            <div class="image-grid">
              <div class="image-card">
                <div class="label">Open Image</div>
                ${openImage ? `<img src="${openImage}" class="evidence-img" />` : '<div class="no-img">No Image Available</div>'}
              </div>
              <div class="image-card">
                <div class="label">In Process Image</div>
                ${inProgressImage ? `<img src="${inProgressImage}" class="evidence-img" />` : '<div class="no-img">No Image Available</div>'}
              </div>
              <div class="image-card">
                <div class="label">Completed Image</div>
                ${completedImage ? `<img src="${completedImage}" class="evidence-img" />` : '<div class="no-img">No Image Available</div>'}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const loadImage = (url) => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const generateTicketCanvas = async () => {
    const getAbsoluteUrl = (path) => {
      if (!path) return '';
      const rel = getImageUrl(path);
      if (rel.startsWith('http')) return rel;
      return window.location.origin + rel;
    };

    const openUrl = getAbsoluteUrl(ticket.createdImage);
    const inProgressUrl = getAbsoluteUrl(ticket.inProgressImage);
    const completedUrl = getAbsoluteUrl(
      ticket.completedImage || (ticket.completed_images && ticket.completed_images[0]?.image)
    );

    const [openImg, inProgressImg, completedImg] = await Promise.all([
      loadImage(openUrl),
      loadImage(inProgressUrl),
      loadImage(completedUrl)
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 760;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 760);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 900, 760);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 740);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`TICKET #${ticket.id || ticket._id}`, 40, 60);

    const isCompleted = ticket.status === 'Completed';
    const badgeColor = isCompleted ? '#10b981' : (ticket.status === 'In Progress' ? '#f97316' : '#ef4444');
    ctx.fillStyle = badgeColor;
    ctx.fillRect(40, 85, 120, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(ticket.status.toUpperCase(), 100, 105);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px Arial';
    ctx.fillText('CATEGORY', 40, 160);
    ctx.fillText('WORK BY', 240, 160);
    ctx.fillText('LOGGED DATE', 40, 230);
    ctx.fillText('LOCATION', 40, 300);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px Arial';
    ctx.fillText(ticket.category || meta.category || 'N/A', 40, 185);
    
    // Determine worker name
    let workerName = 'Unassigned';
    if (ticket.assignedTo && ticket.assignedTo.name) {
      workerName = ticket.assignedTo.name;
    } else if (ticket.assignedStaff && ticket.assignedStaff.length > 0 && ticket.assignedStaff[0].name) {
      workerName = ticket.assignedStaff[0].name;
    } else if (ticket.raisedByName) {
      workerName = ticket.raisedByName; // Fallback to raisedBy if no worker
    }
    ctx.fillText(workerName, 240, 185);
    ctx.fillText(ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A', 40, 255);
    
    const locText = ticket.location || meta.location || 'N/A';
    ctx.fillText(locText, 40, 325);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(460, 140, 400, 200);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('ISSUE DESCRIPTION', 480, 170);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'italic 13px Arial';
    
    const words = (ticket.issueDescription || '').split(' ');
    let line = '';
    let y = 195;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 360 && n > 0) {
        ctx.fillText(line, 480, y);
        line = words[n] + ' ';
        y += 20;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 480, y);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('EVIDENCE GALLERY', 40, 390);

    const imgWidth = 260;
    const imgHeight = 180;
    const imgY = 410;

    // Open Image
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, imgY, imgWidth, imgHeight);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(40, imgY, imgWidth, imgHeight);
    if (openImg) {
      ctx.drawImage(openImg, 40, imgY, imgWidth, imgHeight);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 12px Arial';
      ctx.fillText('Open Image Not Available', 80, imgY + 95);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('OPEN IMAGE', 40, imgY + imgHeight + 20);

    // In Progress Image
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(320, imgY, imgWidth, imgHeight);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(320, imgY, imgWidth, imgHeight);
    if (inProgressImg) {
      ctx.drawImage(inProgressImg, 320, imgY, imgWidth, imgHeight);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 12px Arial';
      ctx.fillText('In Progress Image Not Available', 345, imgY + 95);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('IN PROGRESS IMAGE', 320, imgY + imgHeight + 20);

    // Completed Image
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(600, imgY, imgWidth, imgHeight);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(600, imgY, imgWidth, imgHeight);
    if (completedImg) {
      ctx.drawImage(completedImg, 600, imgY, imgWidth, imgHeight);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 12px Arial';
      ctx.fillText('Completed Image Not Available', 635, imgY + 95);
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('COMPLETED IMAGE', 600, imgY + imgHeight + 20);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('GENERATED FROM CCTV SECURITY MANAGEMENT SYSTEM', 40, 710);

    return canvas;
  };

  const handleExportPPT = async () => {
    try {
      const canvas = await generateTicketCanvas();
      const imgDataUrl = canvas.toDataURL('image/png');

      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      const slide = pptx.addSlide();
      slide.background = { color: '0F172A' };
      
      slide.addImage({ 
        data: imgDataUrl, 
        x: 0, 
        y: 0, 
        w: 13.33,
        h: 7.5
      });

      pptx.writeFile({ fileName: `ticket_${ticket.id || ticket._id}_presentation.pptx` });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportImage = async () => {
    try {
      const canvas = await generateTicketCanvas();
      const link = document.createElement('a');
      link.download = `ticket_${ticket.id || ticket._id}_card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Back Button */}
      <div className="flex items-center space-x-4 border-b border-main pb-4">
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
        <h1 className="text-xl font-black text-main tracking-tight uppercase">
          Back to Tickets
        </h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Export PDF Button */}
          <button 
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all border border-blue-500/20 shadow-md shadow-blue-500/5"
            title="Export to PDF Format"
          >
            <Printer size={12} />
            <span>PDF</span>
          </button>

          {/* Export Image Button */}
          <button 
            onClick={handleExportImage}
            className="flex items-center space-x-2 px-4 py-2.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all border border-purple-500/20 shadow-md shadow-purple-500/5"
            title="Export to Image (PNG) Format"
          >
            <ImageIcon size={12} />
            <span>Image</span>
          </button>

          {/* Export PPT Button */}
          <button 
            onClick={handleExportPPT}
            className="flex items-center space-x-2 px-4 py-2.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all border border-orange-500/20 shadow-md shadow-orange-500/5"
            title="Export to PowerPoint (PPTX) Format"
          >
            <FileText size={12} />
            <span>PPTX</span>
          </button>
        </div>
      </div>

      {/* 2-Column Premium Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-auto">
        
        {/* Left Column: Core Info & Evidence (Spans 2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Issue Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Activity size={120} />
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="margin-0 text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Ticket #{ticket.id || ticket._id}</p>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase max-w-xl leading-tight">
                  {ticket.category === 'Upgrade' || meta.category === 'Upgrade' ? 'Upgrade details' : (ticket.projectId || ticket.project ? 'Log details' : 'Ticket details')}
                </h2>
              </div>
              <span className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg ${
                ticket.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/20' :
                ticket.status === 'In Progress' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-orange-500/20 animate-pulse' :
                'bg-red-500/20 text-red-400 border border-red-500/30 shadow-red-500/20'
              }`}>
                {ticket.status}
              </span>
            </div>

            <div className="bg-black/20 rounded-2xl p-6 border border-white/5 mb-6 relative z-10">
              <p className="margin-0 text-[10px] font-black text-dim uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><Info size={14} className="text-blue-400"/> Issue description</p>
              <p className="margin-0 text-base leading-relaxed text-slate-200 font-medium">"{ticket.issueDescription}"</p>
            </div>

            {ticket.status === 'Completed' && ticket.actionTaken && (
              <div className="bg-emerald-900/20 rounded-2xl p-6 border border-emerald-500/20 relative z-10">
                <p className="margin-0 text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><CheckCircle size={14} /> Resolution / Action Taken</p>
                <p className="margin-0 text-sm leading-relaxed text-emerald-200 font-medium">"{ticket.actionTaken}"</p>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <p className="margin-0 text-[9px] font-black text-dim uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><MapPin size={12}/> Location</p>
              <p className="margin-0 text-sm font-bold text-white truncate" title={ticket.location || meta.location || 'N/A'}>{ticket.location || meta.location || 'N/A'}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <p className="margin-0 text-[9px] font-black text-dim uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Shield size={12}/> Category</p>
              <p className="margin-0 text-sm font-bold text-white truncate">{ticket.category || meta.category || 'N/A'}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <p className="margin-0 text-[9px] font-black text-dim uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><User size={12}/> Work By</p>
              <p className="margin-0 text-sm font-bold text-white truncate">
                {ticket.assignedTo?.name || (ticket.assignedStaff?.[0]?.name) || ticket.raisedByName || 'Authorized Staff'}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
              <p className="margin-0 text-[9px] font-black text-dim uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><Clock size={12}/> Time Elapsed</p>
              <p className="margin-0 text-sm font-black text-orange-400">
                {calculateAdvancedTimeDiff(
                  ticket.createdDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : null), 
                  ticket.createdTime || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null), 
                  ticket.inProgressDate || meta.workStartDate, 
                  ticket.inProgressTime || meta.workStartTime
                )}
              </p>
            </div>
          </div>

          {/* Evidence Gallery */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5 px-2">
              <p className="margin-0 text-[10px] font-black text-dim uppercase tracking-[0.2em] flex items-center gap-2"><ImageIcon size={14} className="text-blue-400"/> Evidence Gallery</p>
              {/* Horizontal Status Timeline */}
              <div className="hidden sm:flex items-center gap-2 text-dim font-bold text-[9px] uppercase tracking-wider">
                <div className={`w-2 h-2 rounded-full ${ticket.status === 'Open' || ticket.status === 'In Progress' || ticket.status === 'Completed' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-white/10'}`}></div>
                <div className="w-8 h-[1px] bg-white/20"></div>
                <div className={`w-2 h-2 rounded-full ${ticket.status === 'In Progress' || ticket.status === 'Completed' ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.8)] animate-pulse' : 'bg-white/10'}`}></div>
                <div className="w-8 h-[1px] bg-white/20"></div>
                <div className={`w-2 h-2 rounded-full ${ticket.status === 'Completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/10'}`}></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Open Image */}
              <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex flex-col items-center justify-center cursor-pointer">
                {ticket.createdImage ? (
                  <>
                    <img src={getImageUrl(ticket.createdImage)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Open" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    <a href={getImageUrl(ticket.createdImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/10 backdrop-blur-md p-3 rounded-full"><Eye size={20} className="text-white" /></div>
                    </a>
                  </>
                ) : (
                  <ImageIcon size={24} className="text-white/10 mb-2" />
                )}
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-white/10 tracking-widest">1. Logged</span>
              </div>
              
              {/* In Progress Image */}
              <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex flex-col items-center justify-center cursor-pointer">
                {ticket.inProgressImage || ticket.workImage ? (
                  <>
                    <img src={getImageUrl(ticket.inProgressImage || ticket.workImage)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="In Progress" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    <a href={getImageUrl(ticket.inProgressImage || ticket.workImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/10 backdrop-blur-md p-3 rounded-full"><Eye size={20} className="text-white" /></div>
                    </a>
                  </>
                ) : (
                  <ImageIcon size={24} className="text-white/10 mb-2" />
                )}
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-white/10 tracking-widest">2. Active</span>
              </div>

              {/* Completed Image */}
              <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex flex-col items-center justify-center cursor-pointer">
                {ticket.completedImage || (ticket.completed_images && ticket.completed_images[0]?.image) || ticket.serviceImage ? (
                  <>
                    <img src={getImageUrl(ticket.completedImage || ticket.completed_images[0]?.image || ticket.serviceImage)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Completed" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                    <a href={getImageUrl(ticket.completedImage || ticket.completed_images[0]?.image || ticket.serviceImage)} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-white/10 backdrop-blur-md p-3 rounded-full"><Eye size={20} className="text-white" /></div>
                    </a>
                  </>
                ) : (
                  <ImageIcon size={24} className="text-white/10 mb-2" />
                )}
                <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-white/10 tracking-widest">3. Completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Activity & Actions */}
        <div className="space-y-6">
          
          {/* Action Buttons Container */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-xl flex flex-col gap-3">
            <p className="margin-0 text-[10px] font-black text-dim uppercase tracking-[0.2em] flex items-center gap-2 mb-1"><Hash size={14}/> Ticket Actions</p>
            
            {ticket.status !== 'Completed' && (
              <>
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
                    className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white py-4 rounded-2xl text-xs font-black tracking-widest transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] flex items-center justify-center gap-2 uppercase"
                  >
                    <Clock size={16} /> Start Work Protocol
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
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 rounded-2xl text-xs font-black tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 uppercase"
                  >
                    <CheckCircle size={16} /> Mark as Completed
                  </button>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button 
                onClick={() => setShowDocModal(true)}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1.5 uppercase"
              >
                <File size={14} /> Vault Docs
              </button>
              <button 
                onClick={() => setShowBillingModal(true)}
                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center justify-center gap-1.5 uppercase"
              >
                <FileText size={14} /> Bills & POs
              </button>
            </div>
          </div>

          {/* Activity / Remarks Feed */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] shadow-xl flex flex-col h-[500px]">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20 rounded-t-[2rem]">
              <p className="margin-0 text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2"><MessageSquare size={14} className="text-blue-400"/> Activity Feed</p>
              <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 font-bold text-[9px] px-2.5 py-1 rounded-lg tracking-wider">{(ticket.message_history || []).length} updates</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {ticket.message_history && ticket.message_history.length > 0 ? (
                ticket.message_history.map((msg, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-black text-xs shadow-lg">
                      {(msg.user_name || 'P')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 bg-black/30 border border-white/5 rounded-2xl rounded-tl-none p-4 relative group">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="font-black text-white text-xs">{msg.user_name || 'Protocol System'}</span>
                        <span className="text-[9px] text-dim font-mono tracking-wider">{msg.time}</span>
                      </div>
                      <p className="margin-0 text-sm text-slate-300 leading-relaxed">{cleanRemarkText(msg.remark)}</p>
                      {msg.image && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-white/10 max-w-[200px]">
                          <a href={getImageUrl(msg.image)} target="_blank" rel="noopener noreferrer">
                            <img src={getImageUrl(msg.image)} alt="attached" className="w-full h-auto object-cover hover:scale-105 transition-transform" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-dim opacity-50">
                  <MessageSquare size={32} className="mb-3" />
                  <p className="text-xs font-bold uppercase tracking-widest">No activity yet</p>
                </div>
              )}
            </div>

            {/* Chat Input */}
            {!(ticket.status === 'Completed' && user?.role !== 'Super Admin') && (
              <div className="p-4 border-t border-white/10 bg-black/20 rounded-b-[2rem]">
                <form onSubmit={addRemark} className="flex flex-col gap-2">
                  {newRemarkImage && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/20 bg-black/50 ml-2 mt-1">
                       <img src={URL.createObjectURL(newRemarkImage)} alt="preview" className="w-full h-full object-cover" />
                       <button 
                         type="button" 
                         onClick={() => setNewRemarkImage(null)}
                         className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 text-white"
                       >
                         <X size={12} />
                       </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        placeholder="Type an update..." 
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-dim rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      />
                      <label className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white transition-colors cursor-pointer">
                        <ImageIcon size={16} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            if (e.target.files[0]) {
                               try {
                                 const compressed = await compressImage(e.target.files[0], 50);
                                 setNewRemarkImage(compressed);
                               } catch (err) {
                                 setNewRemarkImage(e.target.files[0]);
                               }
                            }
                          }}
                        />
                      </label>
                    </div>
                    <button 
                      type="submit"
                      disabled={!newRemark.trim() && !newRemarkImage}
                      className="w-12 h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-blue-600 flex-shrink-0 shadow-lg"
                    >
                      <Send size={18} className="ml-1" />
                    </button>
                  </div>
                </form>
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
