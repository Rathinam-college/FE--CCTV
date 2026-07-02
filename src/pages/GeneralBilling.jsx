import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  FileText, Search, Plus, X, Upload, CheckCircle, Trash2, Eye, File, Download, Calendar
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';

export default function GeneralBilling() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFromMonth, setFilterFromMonth] = useState('');
  const [filterToMonth, setFilterToMonth] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    work: '', location: '', area_budget: '', vendor_name: '',
    bill_no: '', bill_date: '', amount: '', bill_status: '',
    pr_no: '', po_no: '', po_value: '',
    opex_no: '', opex_value: '', opex_status: '',
    payment_status: '', handover_to: '',
    bill_document: null, po_document: null,
    new_documents: []
  };

  const [formData, setFormData] = useState(initialFormState);

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets/general-billing/');
      setRecords(res.data || []);
    } catch (err) {
      console.error('Error fetching general billing data:', err);
      showNotification('Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    // Month filter based on bill_date or createdAt
    if (filterFromMonth || filterToMonth) {
      const recordDateRaw = r.bill_date || r.createdAt;
      if (!recordDateRaw) return false;
      
      const recordMonth = recordDateRaw.substring(0, 7); // Extract YYYY-MM
      
      if (filterFromMonth && recordMonth < filterFromMonth) {
        return false;
      }
      if (filterToMonth && recordMonth > filterToMonth) {
        return false;
      }
    }
    
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.work || '').toLowerCase().includes(q) ||
      (r.location || '').toLowerCase().includes(q) ||
      (r.vendor_name || '').toLowerCase().includes(q) ||
      (r.bill_no || '').toLowerCase().includes(q) ||
      (r.po_no || '').toLowerCase().includes(q) ||
      (r.opex_no || '').toLowerCase().includes(q) ||
      (r.pr_no || '').toLowerCase().includes(q)
    );
  });

  const handleDownloadCSV = () => {
    const headers = ['Work', 'Location', 'Area Budget', 'Vendor Name', 'Bill No', 'Bill Date', 'Amount', 'Bill Status', 'PR No', 'PO No', 'PO Value', 'OPEX No', 'OPEX Value', 'OPEX Status', 'Payment Status', 'Handover To', 'Date Added'];
    
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(r => [
        `"${(r.work || '').replace(/"/g, '""')}"`,
        `"${(r.location || '').replace(/"/g, '""')}"`,
        `"${(r.area_budget || '').replace(/"/g, '""')}"`,
        `"${(r.vendor_name || '').replace(/"/g, '""')}"`,
        `"${(r.bill_no || '').replace(/"/g, '""')}"`,
        `"${r.bill_date || ''}"`,
        `"${(r.amount || '').replace(/"/g, '""')}"`,
        `"${(r.bill_status || '').replace(/"/g, '""')}"`,
        `"${(r.pr_no || '').replace(/"/g, '""')}"`,
        `"${(r.po_no || '').replace(/"/g, '""')}"`,
        `"${(r.po_value || '').replace(/"/g, '""')}"`,
        `"${(r.opex_no || '').replace(/"/g, '""')}"`,
        `"${(r.opex_value || '').replace(/"/g, '""')}"`,
        `"${(r.opex_status || '').replace(/"/g, '""')}"`,
        `"${(r.payment_status || '').replace(/"/g, '""')}"`,
        `"${(r.handover_to || '').replace(/"/g, '""')}"`,
        `"${new Date(r.createdAt || Date.now()).toLocaleDateString()}"`
      ].join(','))
    ];
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    
    let dateRangeStr = 'All';
    if (filterFromMonth && filterToMonth) dateRangeStr = `${filterFromMonth}_to_${filterToMonth}`;
    else if (filterFromMonth) dateRangeStr = `From_${filterFromMonth}`;
    else if (filterToMonth) dateRangeStr = `To_${filterToMonth}`;

    a.setAttribute('download', `MasterBilling_Records_${dateRangeStr}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id || item._id);
      setFormData({
        work: item.work || '',
        location: item.location || '',
        area_budget: item.area_budget || '',
        vendor_name: item.vendor_name || '',
        bill_no: item.bill_no || '',
        bill_date: item.bill_date || '',
        amount: item.amount || '',
        bill_status: item.bill_status || '',
        pr_no: item.pr_no || '',
        po_no: item.po_no || '',
        po_value: item.po_value || '',
        opex_no: item.opex_no || '',
        opex_value: item.opex_value || '',
        opex_status: item.opex_status || '',
        payment_status: item.payment_status || '',
        handover_to: item.handover_to || '',
        bill_document: null,
        po_document: null,
        new_documents: []
      });
    } else {
      setEditingId(null);
      setFormData(initialFormState);
    }
    setShowModal(true);
  };

  const handleAddDocument = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        new_documents: [...(prev.new_documents || []), { name: file.name, file }]
      }));
    }
    e.target.value = null; // reset input
  };

  const handleRemoveNewDocument = (index) => {
    setFormData(prev => {
      const docs = [...(prev.new_documents || [])];
      docs.splice(index, 1);
      return { ...prev, new_documents: docs };
    });
  };

  const handleDeleteExistingDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/tickets/general-billing-documents/${docId}/`);
      showNotification('Document deleted', 'success');
      fetchData();
    } catch (e) {
      console.error(e);
      showNotification('Failed to delete document', 'error');
    }
  };

  const handleFileChange = (e, field) => {
    setFormData(prev => ({ ...prev, [field]: e.target.files[0] }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['date', 'status', 'receivedTime', 'endTime', 'bill_date'].includes(name)) {
      newValue = newValue.toUpperCase();
    }
    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.work) {
      showNotification('Work description is required', 'error');
      return;
    }

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (key !== 'bill_document' && key !== 'po_document' && key !== 'new_documents') {
        data.append(key, formData[key] || '');
      }
    });
    
    if (formData.bill_document) data.append('bill_document', formData.bill_document);
    if (formData.po_document) data.append('po_document', formData.po_document);

    try {
      setSubmitting(true);
      let recordId = editingId;
      if (editingId) {
        await api.patch(`/tickets/general-billing/${editingId}/`, data);
        showNotification('Record updated successfully', 'success');
      } else {
        const response = await api.post('/tickets/general-billing/', data);
        recordId = response.data.id || response.data._id;
        showNotification('Record created successfully', 'success');
      }

      // Upload additional documents if any
      if (formData.new_documents && formData.new_documents.length > 0 && recordId) {
        for (let doc of formData.new_documents) {
          const docData = new FormData();
          docData.append('general_billing', recordId);
          docData.append('name', doc.name);
          docData.append('file', doc.file);
          await api.post('/tickets/general-billing-documents/', docData);
        }
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to save record', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    showConfirm('Are you sure you want to delete this record?', async () => {
      try {
        await api.delete(`/tickets/general-billing/${id}/`);
        showNotification('Record deleted successfully');
        fetchData();
      } catch (err) {
        console.error(err);
        showNotification('Failed to delete record', 'error');
      }
    });
  };

  const handlePaymentStatusChange = async (id, newStatus) => {
    try {
      const data = new FormData();
      data.append('payment_status', newStatus);
      
      await api.patch(`/tickets/general-billing/${id}/`, data);
      showNotification('Payment status updated', 'success');
      
      // Update local state to avoid full refetch
      setRecords(prev => prev.map(record => {
        if (record.id === id || record._id === id) {
          return { ...record, payment_status: newStatus };
        }
        return record;
      }));
    } catch (err) {
      console.error(err);
      showNotification('Failed to update status', 'error');
    }
  };

  const getFullUrl = (path) => {
    if (!path) return null;
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch (e) {}
    
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('cctv/')) cleanPath = cleanPath.substring(5);
    if (!cleanPath.startsWith('media/') && !cleanPath.startsWith('api/')) cleanPath = 'media/' + cleanPath;
    
    const baseUrl = import.meta.env.BASE_URL || '/cctv/';
    return `${baseUrl}${cleanPath}`;
  };

  const getFileName = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    return name.length > 20 ? name.substring(0, 10) + '...' + name.substring(name.length - 7) : name;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-main pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <FileText className="mr-3 text-emerald-500" size={28} />
            Master Billing & OPEX Records
          </h1>
          <p className="text-xs text-secondary mt-2">Manage standalone billing, PO, OPEX, and payment tracking.</p>
        </div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full !pl-10 pr-4 py-2 text-sm bg-panel border-main text-main"
              />
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative md:w-40">
                <input 
                  type="month" 
                  value={filterFromMonth}
                  onChange={(e) => setFilterFromMonth(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-xs bg-panel border-main text-main cursor-pointer uppercase tracking-widest font-bold"
                  title="From Month"
                />
              </div>
              
              <span className="text-dim text-[10px] font-black tracking-widest">TO</span>

              <div className="relative md:w-40">
                <input 
                  type="month" 
                  value={filterToMonth}
                  onChange={(e) => setFilterToMonth(e.target.value)}
                  className="glass-input w-full px-3 py-2 text-xs bg-panel border-main text-main cursor-pointer uppercase tracking-widest font-bold"
                  title="To Month"
                />
              </div>
            </div>
            
            <button 
              onClick={handleDownloadCSV} 
              className="glass-panel flex items-center px-4 py-2 text-sm font-bold bg-panel border border-main text-main hover:bg-card transition-all shadow-lg whitespace-nowrap"
            >
              <Download size={16} className="mr-2 text-blue-500" />
              CSV
            </button>
            
            {canEdit && (
              <button onClick={() => handleOpenModal()} className="glass-panel flex items-center px-4 py-2 text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 whitespace-nowrap">
                <Plus size={16} className="mr-2" />
                Add
              </button>
            )}
          </div>
      </div>

      <div className="glass-panel overflow-hidden border border-main shadow-2xl bg-panel rounded-[2rem]">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-card border-b border-main text-[10px] font-black text-secondary uppercase tracking-widest">
                <th className="p-4">Work / Location</th>
                <th className="p-4">Vendor & Amount</th>
                <th className="p-4">Bill Info</th>
                <th className="p-4">PO Info</th>
                <th className="p-4">OPEX Info</th>
                <th className="p-4">Status & Handover</th>
                {canEdit && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-main text-main">
              {loading ? (
                <tr><td colSpan="7" className="p-10 text-center text-dim font-bold tracking-widest uppercase text-xs">Loading data...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="7" className="p-10 text-center text-dim font-bold tracking-widest uppercase text-xs">No records found.</td></tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id || record._id} className="hover:bg-card transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-sm text-main max-w-xs truncate" title={record.work}>{record.work}</div>
                      <div className="text-xs text-secondary mt-1 flex space-x-2">
                        <span className="font-bold text-blue-500">{record.location || '—'}</span>
                        <span className="text-dim border-l border-main pl-2">{record.area_budget || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-xs text-main">{record.vendor_name || '—'}</div>
                      <div className="text-xs font-mono text-emerald-500 mt-1 font-bold">
                        {record.amount ? `₹${record.amount}` : '—'}
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-dim w-10">No:</span>
                        <span className="font-bold text-main">{record.bill_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-dim w-10">Date:</span>
                        <span className="font-mono text-secondary">{record.bill_date || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-dim w-10">Status:</span>
                        <span className="font-bold text-blue-500 uppercase tracking-widest text-[9px] bg-blue-500/10 px-2 py-0.5 rounded">{record.bill_status || '—'}</span>
                      </div>
                      {record.bill_document && (
                        <div className="mt-2">
                          <a href={getFullUrl(record.bill_document)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-[10px] font-bold" title="View Bill">
                            <File size={12} className="mr-1" /> View Document
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-dim w-10">PR:</span>
                        <span className="font-bold text-main">{record.pr_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-dim w-10">PO:</span>
                        <span className="font-bold text-purple-500">{record.po_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-dim w-10">Val:</span>
                        <span className="font-mono text-secondary">{record.po_value || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-dim w-12">OPEX:</span>
                        <span className="font-bold text-orange-500">{record.opex_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-dim w-12">Val:</span>
                        <span className="font-mono text-secondary">{record.opex_value || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1 mb-2">
                        <span className="text-dim w-12">Status:</span>
                        <span className="font-bold text-orange-500 uppercase tracking-widest text-[9px] bg-orange-500/10 px-2 py-0.5 rounded">{record.opex_status || '—'}</span>
                      </div>
                      {record.documents && record.documents.length > 0 && (
                        <div className="mt-2 flex flex-col space-y-1 border-t border-main/50 pt-2">
                          <span className="text-[9px] text-dim font-bold uppercase tracking-widest mb-1">Documents</span>
                          {record.documents.map(doc => (
                            <div key={doc.id} className="flex items-center space-x-2">
                              <a href={getFullUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-500 hover:text-blue-400 bg-blue-500/10 px-2 py-1 rounded text-[10px] font-bold truncate max-w-[150px]" title={doc.name}>
                                <File size={12} className="mr-1 flex-shrink-0" /> {getFileName(doc.file) || doc.name}
                              </a>
                              <a href={getFullUrl(doc.file)} download target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400" title="Download">
                                <Download size={14} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex flex-col space-y-2">
                        <div>
                          <span className="text-[9px] text-dim block uppercase tracking-widest mb-0.5">Payment</span>
                          {canEdit ? (
                            <select 
                              value={record.payment_status || ''} 
                              onChange={(e) => handlePaymentStatusChange(record.id || record._id, e.target.value)}
                              className={`glass-input px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded cursor-pointer border-main
                                ${record.payment_status?.toLowerCase().includes('settled') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'}
                              `}
                            >
                              <option value="" className="bg-panel text-main">PENDING</option>
                              <option value="WAITING APPROVAL" className="bg-panel text-main">WAITING APPROVAL</option>
                              <option value="PARTIAL" className="bg-panel text-main">PARTIAL</option>
                              <option value="SETTLED" className="bg-panel text-main">SETTLED</option>
                            </select>
                          ) : (
                            <span className={`font-bold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded ${record.payment_status?.toLowerCase().includes('settled') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                              {record.payment_status || 'PENDING'}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] text-dim block uppercase tracking-widest mb-0.5">Handover To</span>
                          <span className="font-bold text-main">{record.handover_to || '—'}</span>
                        </div>
                      </div>
                    </td>
                    {canEdit && (
                      <td className="p-4 text-right space-x-2">
                        <button onClick={() => handleOpenModal(record)} className="p-2 text-dim hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(record.id || record._id)} className="p-2 text-dim hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                          Delete
                        </button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-panel rounded-[2.5rem] w-full max-w-4xl overflow-hidden border border-main shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-main flex justify-between items-center bg-card shrink-0">
              <h2 className="text-xl font-black text-main tracking-tight uppercase flex items-center">
                <FileText className="mr-3 text-emerald-500" size={24} />
                {editingId ? 'Edit Master Record' : 'Add Master Record'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* General Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Work Description <span className="text-red-500">*</span></label>
                  <input required type="text" name="work" value={formData.work} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main text-main" placeholder="e.g. CAMERA INSTALLATION" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main text-main" placeholder="e.g. HOSTELS" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Area Budget</label>
                  <input type="text" name="area_budget" value={formData.area_budget} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main text-main" placeholder="e.g. KPM" />
                </div>
              </div>

              {/* Bill Details */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Bill Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Vendor Name</label>
                    <input type="text" name="vendor_name" value={formData.vendor_name} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Bill No</label>
                    <input type="text" name="bill_no" value={formData.bill_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Bill Date</label>
                    <input type="date" name="bill_date" value={formData.bill_date} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Amount</label>
                    <input type="text" name="amount" value={formData.amount} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" placeholder="₹" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Bill Status</label>
                    <input type="text" name="bill_status" value={formData.bill_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" placeholder="e.g. HANDOVERED" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Upload Bill Document</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'bill_document')} className="w-full text-xs text-dim file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-blue-500/20 file:text-blue-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* PR / PO / OPEX Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-purple-500 uppercase tracking-widest">PR & PO Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">PR No</label>
                      <input type="text" name="pr_no" value={formData.pr_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">PO No</label>
                      <input type="text" name="po_no" value={formData.po_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">PO Value</label>
                      <input type="text" name="po_value" value={formData.po_value} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Upload PO Doc</label>
                      <input type="file" onChange={(e) => handleFileChange(e, 'po_document')} className="w-full text-xs text-dim file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-purple-500/20 file:text-purple-500 cursor-pointer" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest">OPEX Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">OPEX No</label>
                      <input type="text" name="opex_no" value={formData.opex_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">OPEX Value</label>
                      <input type="text" name="opex_value" value={formData.opex_value} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">OPEX Status</label>
                      <input type="text" name="opex_status" value={formData.opex_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Documents */}
              <div className="bg-slate-500/5 border border-slate-500/20 rounded-2xl p-5 space-y-4 col-span-1 md:col-span-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Additional Documents</h3>
                
                {/* Existing Documents */}
                {editingId && records.find(r => (r.id || r._id) === editingId)?.documents?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {records.find(r => (r.id || r._id) === editingId)?.documents?.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-card rounded-lg border border-main">
                        <span className="text-xs font-bold text-main truncate max-w-sm" title={doc.name}>{doc.name}</span>
                        <div className="flex space-x-2">
                          <a href={getFullUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/40" title="View">
                            <Eye size={14} />
                          </a>
                          <a href={getFullUrl(doc.file)} download target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/40" title="Download">
                            <Download size={14} />
                          </a>
                          <button type="button" onClick={() => handleDeleteExistingDocument(doc.id)} className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload New Documents */}
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-secondary uppercase tracking-widest ml-1">Upload New Document</label>
                  <input type="file" onChange={handleAddDocument} className="w-full text-xs text-dim file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-slate-500/20 file:text-slate-500 cursor-pointer" />
                </div>
                
                {/* List New Documents to be uploaded */}
                {formData.new_documents?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-[10px] font-bold text-dim uppercase tracking-widest">Files to Upload:</h4>
                    {formData.new_documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-500/10 rounded-lg border border-slate-500/20">
                        <span className="text-xs text-secondary truncate max-w-sm">{doc.name}</span>
                        <button type="button" onClick={() => handleRemoveNewDocument(idx)} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Handover & Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Payment Status</label>
                  <select name="payment_status" value={formData.payment_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main focus:border-emerald-500">
                    <option value="">PENDING</option>
                    <option value="WAITING APPROVAL">WAITING APPROVAL</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="SETTLED">SETTLED</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-widest ml-1">Handover To</label>
                  <input type="text" name="handover_to" value={formData.handover_to} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-card border-main focus:border-emerald-500" placeholder="e.g. Mrs UMA" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end shrink-0">
                <button type="submit" disabled={submitting} className="bg-emerald-500 text-white hover:bg-emerald-600 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50">
                  {submitting ? 'SAVING...' : 'SAVE RECORD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
