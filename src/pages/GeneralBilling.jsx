import { useState, useEffect, useMemo } from 'react';
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
  const [filterVendor, setFilterVendor] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const uniqueVendors = useMemo(() => {
    return [...new Set(records.map(r => r.vendor_name).filter(Boolean))].sort();
  }, [records]);

  const uniqueLocations = useMemo(() => {
    return [...new Set(records.map(r => r.location).filter(Boolean))].sort();
  }, [records]);
  
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
    
    // Vendor filter
    if (filterVendor && r.vendor_name !== filterVendor) {
      return false;
    }

    // Location filter
    if (filterLocation && r.location !== filterLocation) {
      return false;
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
    const headers = ['S.No', 'Work', 'Location', 'Area Budget', 'Vendor Name', 'Bill No', 'Bill Date', 'Amount', 'Bill Status', 'PR No', 'PO No', 'PO Value', 'OPEX No', 'OPEX Value', 'OPEX Status', 'Payment Status', 'Handover To', 'Date Added'];
    
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map((r, index) => [
        index + 1,
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

  const stats = {
    total: filteredRecords.length,
    pending: filteredRecords.filter(r => !r.payment_status || r.payment_status === '').length,
    waitingApproval: filteredRecords.filter(r => r.payment_status === 'WAITING APPROVAL').length,
    advance: filteredRecords.filter(r => r.payment_status === 'PARTIAL' || r.payment_status === 'ADVANCE').length,
    settled: filteredRecords.filter(r => r.payment_status === 'SETTLED').length,
    totalAmount: filteredRecords.reduce((sum, r) => sum + (parseFloat(String(r.amount).replace(/[^0-9.]/g, '')) || 0), 0),
    settledAmount: filteredRecords.filter(r => r.payment_status === 'SETTLED').reduce((sum, r) => sum + (parseFloat(String(r.amount).replace(/[^0-9.]/g, '')) || 0), 0),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <FileText className="mr-3 text-cyan-400" size={28} />
            Master Billing & OPEX Records
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors"
          >
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button 
              onClick={() => handleOpenModal()} 
              className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2"
            >
              <Plus size={16} className="mr-2" /> Add Record
            </button>
          )}
        </div>
      </div>

      {/* Premium Dashboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-slide-up">
        {/* Total Payments Card */}
        <div className="bg-panel border border-main rounded-xl p-5 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Payments</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white">{stats.total}</span>
            <span className="text-xs font-mono text-cyan-400 font-bold">₹{stats.totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-panel border border-main rounded-xl p-5 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 to-pink-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Pending</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-red-400">{stats.pending}</span>
            <span className="text-[10px] text-red-500/80 font-bold uppercase tracking-wider">Unpaid</span>
          </div>
        </div>

        {/* Waiting Approval Card */}
        <div className="bg-panel border border-main rounded-xl p-5 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Waiting Approval</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-400">{stats.waitingApproval}</span>
            <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">In Review</span>
          </div>
        </div>

        {/* Advance Payments Card */}
        <div className="bg-panel border border-main rounded-xl p-5 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Advance</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-purple-400">{stats.advance}</span>
            <span className="text-[10px] text-purple-500/80 font-bold uppercase tracking-wider">Partial</span>
          </div>
        </div>

        {/* Settled Payments Card */}
        <div className="bg-panel border border-main rounded-xl p-5 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Settled</p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-400">{stats.settled}</span>
            <span className="text-xs font-mono text-emerald-400 font-bold">₹{stats.settledAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Query Filter row */}
      <div className="flex flex-col lg:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search billing by Work, Location, Vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-panel text-sm text-slate-200 border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        
        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-4 bg-panel px-4 py-3 rounded-md border border-main">
          {/* Month Range */}
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-slate-400" />
            <input 
              type="month" 
              value={filterFromMonth}
              onChange={(e) => setFilterFromMonth(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-32 cursor-pointer"
              title="From Month"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input 
              type="month" 
              value={filterToMonth}
              onChange={(e) => setFilterToMonth(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-32 cursor-pointer"
              title="To Month"
            />
          </div>

          <div className="h-6 w-[1px] bg-slate-700/60 hidden md:block"></div>

          {/* Vendor Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Vendor:</span>
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 min-w-[120px] max-w-[200px] cursor-pointer"
            >
              <option value="">All Vendors</option>
              {uniqueVendors.map(vendor => (
                <option key={vendor} value={vendor}>{vendor}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-[1px] bg-slate-700/60 hidden md:block"></div>

          {/* Location Dropdown */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Location:</span>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 min-w-[120px] max-w-[200px] cursor-pointer"
            >
              <option value="">All Locations</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          
          {(filterFromMonth || filterToMonth || filterVendor || filterLocation || searchQuery) && (
            <button
              onClick={() => {
                setFilterFromMonth('');
                setFilterToMonth('');
                setFilterVendor('');
                setFilterLocation('');
                setSearchQuery('');
              }}
              className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors ml-auto lg:ml-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-panel border-b border-main text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="p-4 text-center w-12">S.No</th>
                <th className="p-4">Work / Location</th>
                <th className="p-4">Vendor & Amount</th>
                <th className="p-4">Bill Info</th>
                <th className="p-4">PO Info</th>
                <th className="p-4">OPEX Info</th>
                <th className="p-4">Status & Handover</th>
                {canEdit && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {loading ? (
                <tr><td colSpan="8" className="p-10 text-center text-slate-500 font-bold tracking-widest uppercase text-xs">Loading data...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="8" className="p-10 text-center text-slate-500 font-bold tracking-widest uppercase text-xs">No records found.</td></tr>
              ) : (
                filteredRecords.map((record, index) => (
                  <tr key={record.id || record._id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="p-4 text-center text-xs font-mono text-slate-400">
                      {index + 1}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-white max-w-xs truncate" title={record.work}>{record.work}</div>
                      <div className="text-xs text-slate-400 mt-1 flex space-x-2">
                        <span className="font-bold text-blue-400">{record.location || '—'}</span>
                        <span className="text-slate-500 border-l border-slate-700 pl-2">{record.area_budget || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-xs text-slate-200">{record.vendor_name || '—'}</div>
                      <div className="text-xs font-mono text-emerald-400 mt-1 font-bold">
                        {record.amount ? `₹${record.amount}` : '—'}
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-10">No:</span>
                        <span className="font-bold text-slate-300">{record.bill_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-slate-500 w-10">Date:</span>
                        <span className="font-mono text-slate-400">{record.bill_date || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-slate-500 w-10">Status:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-blue-500/30 text-blue-400 bg-blue-500/10 tracking-wider">{record.bill_status || '—'}</span>
                      </div>
                      {record.bill_document && (
                        <div className="mt-2">
                          <a href={getFullUrl(record.bill_document)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded text-[10px] font-bold" title="View Bill">
                            <File size={12} className="mr-1" /> View Document
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-10">PR:</span>
                        <span className="font-bold text-slate-300">{record.pr_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-slate-500 w-10">PO:</span>
                        <span className="font-bold text-purple-400">{record.po_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-slate-500 w-10">Val:</span>
                        <span className="font-mono text-slate-400">{record.po_value || '—'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500 w-12">OPEX:</span>
                        <span className="font-bold text-orange-400">{record.opex_no || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-slate-500 w-12">Val:</span>
                        <span className="font-mono text-slate-400">{record.opex_value || '—'}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1 mb-2">
                        <span className="text-slate-500 w-12">Status:</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-orange-500/30 text-orange-400 bg-orange-500/10 tracking-wider">{record.opex_status || '—'}</span>
                      </div>
                      {record.documents && record.documents.length > 0 && (
                        <div className="mt-2 flex flex-col space-y-1 border-t border-slate-700 pt-2">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Documents</span>
                          {record.documents.map(doc => (
                            <div key={doc.id} className="flex items-center space-x-2">
                              <a href={getFullUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-1 rounded text-[10px] font-bold truncate max-w-[150px]" title={doc.name}>
                                <File size={12} className="mr-1 flex-shrink-0" /> {getFileName(doc.file) || doc.name}
                              </a>
                              <a href={getFullUrl(doc.file)} download target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-355" title="Download">
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
                          <span className="text-[9px] text-slate-500 block uppercase tracking-widest mb-0.5">Payment</span>
                          {canEdit ? (
                            <select 
                              value={record.payment_status === 'PARTIAL' ? 'ADVANCE' : (record.payment_status || '')} 
                              onChange={(e) => handlePaymentStatusChange(record.id || record._id, e.target.value)}
                              className={`bg-slate-800 text-slate-200 text-[10px] font-bold uppercase tracking-widest rounded px-2.5 py-1 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer
                                ${record.payment_status?.toLowerCase().includes('settled') ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}
                              `}
                            >
                              <option value="" className="bg-slate-900 text-slate-300">PENDING</option>
                              <option value="WAITING APPROVAL" className="bg-slate-900 text-slate-300">WAITING APPROVAL</option>
                              <option value="ADVANCE" className="bg-slate-900 text-slate-300">ADVANCE</option>
                              <option value="SETTLED" className="bg-slate-900 text-slate-300">SETTLED</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${record.payment_status?.toLowerCase().includes('settled') ? 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10' : 'text-amber-500 border-amber-500/50 bg-amber-500/10'}`}>
                              {record.payment_status === 'PARTIAL' ? 'ADVANCE' : (record.payment_status || 'PENDING')}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase tracking-widest mb-0.5">Handover To</span>
                          <span className="font-bold text-slate-300">{record.handover_to || '—'}</span>
                        </div>
                      </div>
                    </td>
                    {canEdit && (
                      <td className="p-4 text-right">
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(record)} className="text-slate-400 hover:text-cyan-400 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(record.id || record._id)} className="text-slate-400 hover:text-red-500 transition-colors">
                            Delete
                          </button>
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
          <div className="bg-card rounded-[2.5rem] w-full max-w-4xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-main tracking-tight uppercase flex items-center">
                <FileText className="mr-3 text-cyan-400" size={24} />
                {editingId ? 'Edit Master Record' : 'Add Master Record'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* General Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Work Description <span className="text-red-500">*</span></label>
                  <input required type="text" name="work" value={formData.work} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" placeholder="e.g. CAMERA INSTALLATION" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
                  <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" placeholder="e.g. HOSTELS" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Area Budget</label>
                  <input type="text" name="area_budget" value={formData.area_budget} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" placeholder="e.g. KPM" />
                </div>
              </div>

              {/* Bill Details */}
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Bill Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Vendor Name</label>
                    <input type="text" name="vendor_name" value={formData.vendor_name} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bill No</label>
                    <input type="text" name="bill_no" value={formData.bill_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bill Date</label>
                    <input type="date" name="bill_date" value={formData.bill_date} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main cursor-pointer" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                    <input type="text" name="amount" value={formData.amount} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" placeholder="₹" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bill Status</label>
                    <input type="text" name="bill_status" value={formData.bill_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" placeholder="e.g. HANDOVERED" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Upload Bill Document</label>
                    <input type="file" onChange={(e) => handleFileChange(e, 'bill_document')} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-cyan-500/20 file:text-cyan-400 cursor-pointer" />
                  </div>
                </div>
              </div>

              {/* PR / PO / OPEX Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">PR & PO Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">PR No</label>
                      <input type="text" name="pr_no" value={formData.pr_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">PO No</label>
                      <input type="text" name="po_no" value={formData.po_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">PO Value</label>
                      <input type="text" name="po_value" value={formData.po_value} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Upload PO Doc</label>
                      <input type="file" onChange={(e) => handleFileChange(e, 'po_document')} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-purple-500/20 file:text-purple-400 cursor-pointer" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest">OPEX Info</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">OPEX No</label>
                      <input type="text" name="opex_no" value={formData.opex_no} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">OPEX Value</label>
                      <input type="text" name="opex_value" value={formData.opex_value} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">OPEX Status</label>
                      <input type="text" name="opex_status" value={formData.opex_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main text-main" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Documents */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4 col-span-1 md:col-span-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Additional Documents</h3>
                
                {/* Existing Documents */}
                {editingId && records.find(r => (r.id || r._id) === editingId)?.documents?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {records.find(r => (r.id || r._id) === editingId)?.documents?.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-2 bg-panel rounded border border-main">
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
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Upload New Document</label>
                  <input type="file" onChange={handleAddDocument} className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-slate-500/20 file:text-slate-400 cursor-pointer" />
                </div>
                
                {/* List New Documents to be uploaded */}
                {formData.new_documents?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Files to Upload:</h4>
                    {formData.new_documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-800 border border-slate-700/60 rounded">
                        <span className="text-xs text-slate-300 truncate max-w-sm">{doc.name}</span>
                        <button type="button" onClick={() => handleRemoveNewDocument(idx)} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Handover & Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Payment Status</label>
                  <select name="payment_status" value={formData.payment_status === 'PARTIAL' ? 'ADVANCE' : formData.payment_status} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main focus:border-cyan-500 text-main">
                    <option value="" className="bg-slate-950 text-slate-300">PENDING</option>
                    <option value="WAITING APPROVAL" className="bg-slate-950 text-slate-300">WAITING APPROVAL</option>
                    <option value="ADVANCE" className="bg-slate-950 text-slate-300">ADVANCE</option>
                    <option value="SETTLED" className="bg-slate-950 text-slate-300">SETTLED</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Handover To</label>
                  <input type="text" name="handover_to" value={formData.handover_to} onChange={handleInputChange} className="glass-input w-full p-2 text-xs bg-panel border-main focus:border-cyan-500 text-main" placeholder="e.g. Mrs UMA" />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end shrink-0">
                <button type="submit" disabled={submitting} className="bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 font-bold">
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
