import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Plus, Clock, CheckCircle, AlertCircle, Wrench, Edit2, X, 
  LayoutList, LayoutGrid, MapPin, Tag, Calendar, User, Upload
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';

export default function Maintenance() {
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
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionTicket, setCompletionTicket] = useState(null);
  const [completionData, setCompletionData] = useState({
    remark: '',
    endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0],
    image: null
  });
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    location: '',
    category: 'Assets',
    issueDescription: '',
    actionTaken: '',
    instructionBy: '',
    receivedTime: '',
    endTime: '',
    assignedTo: '',
    status: 'Open'
  });

  useEffect(() => {
    fetchData();
  }, []);



  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, userRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/users/')
      ]);
      setTickets((ticketRes.data || []).filter(t => !t.projectId && !t.project));
      setUsers(userRes.data || []);
    } catch (err) {
      console.error(err);
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
        category: 'Assets',
        actionTaken: '',
        instructionBy: '',
        receivedTime: '',
        endTime: '',
        totalTime: '',
        manualDate: ''
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEdit = (ticket) => {
    const meta = parseMetadata(ticket.remarks);
    setFormData({
      date: ticket.operationDate || meta.manualDate || (ticket.createdAt ? ticket.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
      location: ticket.location || meta.location || '',
      category: ticket.category || meta.category || 'Assets',
      issueDescription: ticket.issueDescription || '',
      actionTaken: ticket.actionTaken || meta.actionTaken || '',
      instructionBy: ticket.instructionBy || meta.instructionBy || '',
      receivedTime: ticket.receivedTime || meta.receivedTime || '',
      endTime: ticket.endTime || meta.endTime || '',
      assignedTo: ticket.assignedTo?.id || ticket.assignedTo?._id || ticket.assignedTo || '',
      status: ticket.status || 'Open'
    });
    setEditingId(ticket.id || ticket._id);
    setCurrentTicket(ticket);
    setShowModal(true);
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
        location: formData.location,
        category: formData.category,
        actionTaken: formData.actionTaken,
        instructionBy: formData.instructionBy,
        receivedTime: formData.receivedTime,
        endTime: formData.endTime,
        totalTime: calculateTotalTime(formData.receivedTime, formData.endTime),
        remarks: formData.remarks || '', // Keep remarks for any other notes
        raisedBy: user._id || user.id,
      };

      if (editingId) {
        payload.cameraId = currentTicket?.cameraId?.id || currentTicket?.cameraId;
        payload.raisedBy = currentTicket?.raisedBy?.id || currentTicket?.raisedBy || user._id || user.id;
        await api.put(`/tickets/${editingId}/`, payload);
        showNotification('Ticket updated successfully');
      } else {
        const camRes = await api.get('/cameras/');
        const cameras = Array.isArray(camRes.data) ? camRes.data : [];
        if (cameras.length > 0) {
          payload.cameraId = cameras[0].id || cameras[0]._id;
        } else {
          showNotification('Error: No cameras found', 'error');
          return;
        }
        await api.post('/tickets/', payload);
        showNotification('New ticket created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to save ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      location: '',
      category: 'Assets',
      issueDescription: '',
      actionTaken: '',
      instructionBy: '',
      receivedTime: '',
      endTime: '',
      assignedTo: '',
      status: 'Open'
    });
    setEditingId(null);
    setCurrentTicket(null);
  };

  const [draggingId, setDraggingId] = useState(null);

  const onDragStart = (e, ticketId) => {
    e.dataTransfer.setData('ticketId', ticketId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(ticketId);
    // Create a ghost image or just set style
    e.currentTarget.style.opacity = '0.5';
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggingId(null);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = async (e, newStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    setDraggingId(null);
    
    if (!ticketId) return;

    const ticket = tickets.find(t => (t.id || t._id || '').toString() === ticketId.toString());
    
    if (ticket && ticket.status !== newStatus) {
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
        await api.patch(`/tickets/${ticketId}/`, { status: newStatus });
        showNotification(`Ticket moved to ${newStatus}`);
        fetchData();
      } catch (err) {
        console.error('Error updating status:', err);
        showNotification('Failed to update status', 'error');
      }
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-main pb-8">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-teal-500 uppercase tracking-[0.4em]">Service Pipeline</span>
          </div>
          <h1 className="text-4xl font-black text-main tracking-tighter flex items-center">
            <Wrench className="mr-4 text-teal-600" size={36} />
            Maintenance Board
          </h1>
          <p className="text-xs text-secondary mt-2 font-bold uppercase tracking-[0.2em]">
            Real-time Hardware Resolution Protocol
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/tickets')}
            className="px-6 py-3 text-[10px] font-black text-secondary hover:text-main transition-all flex items-center bg-panel rounded-2xl border border-main uppercase tracking-widest hover:border-teal-500/30"
          >
            <LayoutList size={14} className="mr-2" />
            Audit Logs
          </button>
          {canEdit && (
            <button 
              onClick={() => { resetForm(); setShowModal(true); }}
              className="glass-button flex items-center px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl"
            >
              <Plus size={16} className="mr-2" />
              Raise Ticket
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { status: 'Open', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
          { status: 'In Progress', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
          { status: 'Completed', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' }
        ].map(({ status, icon: Icon, color, bg }, index) => (
          <div 
            key={status} 
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
            className={`glass-panel p-5 min-h-[400px] md:min-h-[600px] flex flex-col animate-slide-up delay-${(index + 1) * 100} transition-all duration-300 ${
              draggingId ? 'border-dashed border-white/20 bg-white/5' : ''
            }`}
          >
            <div className={`flex items-center justify-between p-4 rounded-2xl border border-main ${bg} mb-8 shadow-sm`}>
              <div className="flex items-center space-x-3">
                <Icon size={16} className={color} strokeWidth={2.5} />
                <h2 className="font-black text-[11px] text-main tracking-[0.2em] uppercase">{status}</h2>
              </div>
              <span className="px-3 py-1 rounded-xl bg-card border border-main text-[10px] font-black text-main shadow-inner">
                {tickets.filter(t => t.status === status).length}
              </span>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              {tickets.filter(t => t.status === status).map((ticket) => (
                <div 
                  key={ticket._id || ticket.id} 
                  draggable={canEdit && (ticket.status !== 'Completed' || user?.role === 'Super Admin')}
                  onDragStart={(e) => canEdit && onDragStart(e, ticket._id || ticket.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => {
                    handleEdit(ticket);
                    if (ticket.status === 'Completed' && user?.role !== 'Super Admin') {
                      showNotification('Viewing completed ticket (Read-only)', 'info');
                    }
                  }}
                  className="bg-panel border border-main p-6 rounded-[2rem] hover:border-teal-500/50 transition-all group relative overflow-hidden active:scale-[0.98] shadow-lg cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-2 py-1 bg-teal-500/10 text-teal-600 border border-teal-500/20 rounded-md text-[9px] font-bold tracking-widest uppercase">
                      TKT-{String(ticket._id || ticket.id).slice(-4)}
                    </span>
                    {canEdit && (
                      <button className="opacity-0 group-hover:opacity-100 p-1.5 text-secondary hover:text-main transition-all bg-panel rounded-lg">
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-main text-[13px] mb-1 leading-relaxed line-clamp-2">
                    {ticket.issueDescription}
                  </h3>
                  
                  {ticket.project?.name && (
                    <div className="flex items-center space-x-1.5 mb-3">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-bold uppercase tracking-widest">
                        {ticket.project.name}
                      </span>
                    </div>
                  )}
                  
                  {(ticket.location || parseMetadata(ticket.remarks).location) && (
                    <div className="flex items-center space-x-2 mb-3 text-[10px] text-secondary">
                      <MapPin size={10} className="text-teal-500" />
                      <span>{ticket.location || parseMetadata(ticket.remarks).location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-4 border-t border-main mt-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-teal-500/10 flex items-center justify-center text-[10px] font-bold text-teal-600 border border-teal-500/20">
                        {(ticket.assignedTo?.name || 'U').charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-secondary">
                        {ticket.assignedTo?.name || 'Unassigned'}
                      </span>
                    </div>
                    <span className="text-[9px] text-secondary font-mono">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              
              {tickets.filter(t => t.status === status).length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-dim py-10 opacity-30">
                  <Icon size={40} className="mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No entries</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-4xl overflow-hidden border border-main shadow-2xl my-8">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-main uppercase tracking-tight">
                  {editingId ? 'Modify Operation Ticket' : 'Create New Service Ticket'}
                </h2>
                <p className="text-[10px] text-secondary mt-1 uppercase tracking-[0.3em] font-black">Asset Maintenance Protocol</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full text-dim hover:text-main transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              {currentTicket?.status === 'Completed' && user?.role !== 'Super Admin' && (
                <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="text-emerald-400" size={24} />
                    <div>
                      <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Maintenance Complete</p>
                      <p className="text-[10px] text-dim uppercase">This record is finalized and locked</p>
                    </div>
                  </div>
                  {(() => {
                    const completionMsg = (currentTicket.message_history || [])
                      .filter(m => m.device_status === 'Completed')
                      .pop();
                    if (completionMsg) {
                      return (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-main">Resolved by {completionMsg.user_name}</p>
                          <p className="text-[9px] text-dim italic">"{completionMsg.remark}"</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              
              <fieldset disabled={currentTicket?.status === 'Completed' && user?.role !== 'Super Admin'} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Operation Date</label>
                      <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Location / Asset Zone</label>
                      <input required type="text" name="location" value={formData.location} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. Block A, 1st Floor" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Asset Category</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer [&>option]:bg-[#1a1d27]">
                        <option value="Assets">Assets / Infrastructure</option>
                        <option value="Storage">Storage Units</option>
                        <option value="Identity">Identity Access</option>
                        <option value="Network">Network Nodes</option>
                        <option value="Other">Other Hardware</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Nature of Problem (Detailed)</label>
                      <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-sm min-h-[90px] resize-none" placeholder="Describe the technical failure or issue..." />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Action Taken / Resolution</label>
                      <textarea name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-sm min-h-[90px] resize-none" placeholder="Describe steps taken for repair..." />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Instruction By</label>
                      <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="Name of authorize officer" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Responsibility</label>
                      <select name="assignedTo" value={formData.assignedTo} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer [&>option]:bg-[#1a1d27]">
                        <option value="">Select Technician</option>
                        {users.map(u => (
                          <option key={u.id || u._id} value={u.id || u._id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Received Time</label>
                      <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">End Time</label>
                      <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Total Time</label>
                      <div className="glass-input w-full p-3 text-sm bg-black/40 text-dim font-bold border-dashed flex items-center justify-center">
                        {calculateTotalTime(formData.receivedTime, formData.endTime) || '0h 0m'}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Execution Status</label>
                      <div className="flex space-x-3">
                        {['Open', 'In Progress', 'Completed'].map(status => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              if (status === 'Completed') {
                                setCompletionTicket(currentTicket || formData);
                                setCompletionData({
                                  remark: '',
                                  endTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                                  date: new Date().toISOString().split('T')[0]
                                });
                                setShowCompletionModal(true);
                                return;
                              }
                              setFormData({...formData, status});
                            }}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                              formData.status === status 
                                ? 'bg-teal-600 text-white border-teal-500 shadow-lg shadow-teal-500/20' 
                                : 'bg-panel text-secondary border-main hover:bg-card hover:text-main'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              <div className="flex justify-end space-x-4 mt-10 pt-6 border-t border-white/5">
                <button type="button" onClick={() => setShowModal(false)} className="px-8 py-3 text-xs font-bold tracking-widest text-dim hover:text-main hover:bg-white/5 rounded-2xl transition-all">
                  {currentTicket?.status === 'Completed' && user?.role !== 'Super Admin' ? 'CLOSE DETAILS' : 'ABORT MISSION'}
                </button>
                {!(currentTicket?.status === 'Completed' && user?.role !== 'Super Admin') && (
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className={`glass-button px-10 py-3 text-xs font-bold tracking-widest transition-all ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {submitting ? 'PROCESSING...' : (editingId ? 'COMMIT CHANGES' : 'INITIALIZE TICKET')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
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
                  placeholder="Describe the final action taken to resolve this ticket..."
                  className="glass-input w-full p-4 text-sm min-h-[120px] resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Service Image (Max 2MB)</label>
                <div className="mt-2">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-[2rem] cursor-pointer hover:bg-panel border-main transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload size={32} className="text-secondary group-hover:text-teal-500 mb-3 transition-colors" />
                        <p className="mb-2 text-xs text-secondary font-bold uppercase tracking-widest"><span className="text-main">Click to upload</span> or drag and drop</p>
                        <p className="text-[10px] text-dim font-medium">PNG, JPG or JPEG (MAX. 2MB)</p>
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

              <div className="bg-panel p-5 rounded-3xl border border-main">
                <div className="flex items-center space-x-3 text-[10px] text-secondary uppercase font-black tracking-widest">
                  <User size={14} className="text-teal-500" />
                  <span>Closing Technician: <span className="text-main">{user?.name}</span></span>
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button 
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-dim hover:text-main hover:bg-white/5 rounded-2xl transition-all"
                >
                  CANCEL
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

                      // 2. Prepare FormData for multipart submission
                      const formData = new FormData();
                      formData.append('status', 'Completed');
                      formData.append('endTime', completionData.endTime);
                      formData.append('operationDate', completionData.date);
                      formData.append('totalTime', calculateTotalTime(completionTicket.receivedTime || meta.receivedTime, completionData.endTime));
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-main py-3 rounded-2xl text-xs font-bold tracking-widest transition-all shadow-lg shadow-emerald-600/20"
                >
                  COMPLETE TICKET
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
