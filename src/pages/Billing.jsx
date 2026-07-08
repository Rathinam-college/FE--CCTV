import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  FileText, Search, Plus, Upload, X, Shield, Home, FileBarChart,
  Download, File, Hash, CheckCircle, Trash2, Eye, Calendar
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function Billing() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Billing & PO'); // 'Billing & PO', 'Ticket Documents', 'Project Documents'
  const [billingFilter, setBillingFilter] = useState('All'); // 'All', 'Tickets', 'Upgrades', 'Projects'
  const [searchQuery, setSearchQuery] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // The record we are adding bills/docs to
  const [submitting, setSubmitting] = useState(false);
  const [docFormData, setDocFormData] = useState({ name: '', file: null });

  const [formData, setFormData] = useState({
    new_bill: { number: '', amount: '', file: null },
    new_po: { number: '', amount: '', file: null }
  });

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Maintenance:EDIT');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketRes, projectRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/tickets/projects/')
      ]);
      const allTickets = ticketRes.data || [];
      const sortedTickets = [...allTickets].sort((a, b) => (b.id || 0) - (a.id || 0));
      setTickets(sortedTickets);
      setProjects(projectRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      showNotification('Failed to load records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const categorizedData = useMemo(() => {
    const billingAndPo = [];
    const ticketDocs = [];
    const upgradeDocs = [];
    const projectDocs = [];

    tickets.forEach(t => {
      let isUpgrade = false;
      try {
        const meta = JSON.parse(t.remarks || '{}');
        if (t.category === 'Upgrade' || meta.category === 'Upgrade' || t.issueDescription?.toLowerCase().includes('upgrade')) {
          isUpgrade = true;
        }
      } catch(e) {
        if (t.category === 'Upgrade' || t.issueDescription?.toLowerCase().includes('upgrade')) {
          isUpgrade = true;
        }
      }
      
      const isProjectLog = !!(t.project || t.projectId);

      const isReadyForBilling = t.status === 'Completed' || t.bill_number || t.po_number || t.bill_document || t.po_document;
      if (isReadyForBilling) {
        billingAndPo.push({
          ...t,
          billingCategory: isUpgrade ? 'Upgrades' : (isProjectLog ? 'Project Logs' : 'Tickets')
        });
      }
      
      if (isUpgrade) {
        upgradeDocs.push(t);
      } else {
        ticketDocs.push(t);
      }
    });

    projects.forEach(p => {
      billingAndPo.push({ ...p, billingCategory: 'Projects', isMasterProject: true });
      projectDocs.push({ ...p, isMasterProject: true });
    });

    return {
      'Billing & PO': billingAndPo,
      'Ticket Documents': ticketDocs,
      'Upgrade Documents': upgradeDocs,
      'Project Documents': projectDocs
    };
  }, [tickets, projects]);

  const filteredRecords = useMemo(() => {
    let records = categorizedData[activeTab] || [];
    
    if (activeTab === 'Billing & PO' && billingFilter !== 'All') {
      records = records.filter(r => r.billingCategory === billingFilter);
    }
    
    if (startMonth || endMonth) {
      records = records.filter(r => {
        let rDate = '';
        if (activeTab === 'Billing & PO') {
           rDate = r.isMasterProject ? (r.start_date || '') : (r.operationDate || r.createdAt?.split('T')[0] || '');
        } else {
           rDate = r.uploadedAt?.split('T')[0] || r.created_at?.split('T')[0] || '';
        }
        
        if (!rDate) return false;
        const rMonth = rDate.substring(0, 7);
        if (startMonth && rMonth < startMonth) return false;
        if (endMonth && rMonth > endMonth) return false;
        return true;
      });
    }
    
    if (!searchQuery) return records;
    
    return records.filter(r => {
      if (activeTab === 'Billing & PO') {
        const searchStr = `${r.issueDescription || r.name || ''} ${r.location || ''} ${r.divisionName || ''} ${r.client_name || ''} ${r.bill_number || ''} ${r.po_number || ''}`.toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
      } else {
        const searchStr = `${r.name} ${r.parentTicket?.issueDescription || r.parentProject?.name || ''}`.toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
      }
    });
  }, [categorizedData, activeTab, searchQuery, billingFilter, startMonth, endMonth]);

  const handleOpenDocModal = (item) => {
    setSelectedItem(item);
    setDocFormData({ name: '', file: null });
    setShowDocModal(true);
  };

  const handleOpenModal = (item) => {
    setSelectedItem(item);
    setFormData({
      new_bill: { number: '', amount: '', file: null },
      new_po: { number: '', amount: '', file: null }
    });
    setShowModal(true);
  };

  const handleAddBillingRecord = async (type) => {
    const dataObj = type === 'Bill' ? formData.new_bill : formData.new_po;
    if (!dataObj.number && !dataObj.file) {
      showNotification(`Please provide a number or file for the ${type}`, 'error');
      return;
    }

    const data = new FormData();
    data.append('record_type', type);
    data.append('number', dataObj.number || 'N/A');
    if (dataObj.amount) data.append('amount', dataObj.amount);
    if (dataObj.file) data.append('file', dataObj.file);
    data.append(selectedItem.isMasterProject ? 'project' : 'ticket', selectedItem.id || selectedItem._id);

    try {
      setSubmitting(true);
      const endpoint = selectedItem.isMasterProject ? '/tickets/project-billing-records/' : '/tickets/ticket-billing-records/';
      await api.post(endpoint, data);
      showNotification(`${type} added successfully`, 'success');
      
      // Clear form
      setFormData(prev => ({
        ...prev,
        [type === 'Bill' ? 'new_bill' : 'new_po']: { number: '', amount: '', file: null }
      }));
      
      // Refresh
      fetchData();
      
      // Update local state for immediate UI update
      // Since fetchData runs asynchronously, we might just rely on it, but modal stays open
    } catch (err) {
      console.error(err);
      showNotification(`Failed to add ${type}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBillingRecord = async (recordId, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      setSubmitting(true);
      const endpoint = selectedItem.isMasterProject ? `/tickets/project-billing-records/${recordId}/` : `/tickets/ticket-billing-records/${recordId}/`;
      await api.delete(endpoint);
      showNotification(`${type} deleted successfully`, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification(`Failed to delete ${type}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDocument = async (e) => {
    e.preventDefault();
    if (!docFormData.name || !docFormData.file) {
      showNotification('Please provide a document name and file', 'error');
      return;
    }

    const data = new FormData();
    data.append('name', docFormData.name);
    data.append('file', docFormData.file);
    data.append(selectedItem.isMasterProject ? 'project' : 'ticket', selectedItem.id || selectedItem._id);

    try {
      setSubmitting(true);
      const endpoint = selectedItem.isMasterProject ? '/tickets/project-documents/' : '/tickets/ticket-documents/';
      await api.post(endpoint, data);
      showNotification('Document uploaded successfully', 'success');
      setDocFormData({ name: '', file: null });
      fetchData();
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
      const endpoint = selectedItem.isMasterProject ? `/tickets/project-documents/${docId}/` : `/tickets/ticket-documents/${docId}/`;
      await api.delete(endpoint);
      showNotification('Document deleted successfully', 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getFullUrl = (path) => {
    if (!path) return null;
    
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch (e) {}
    
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

  const handleDownload = () => {
    if (filteredRecords.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'Category', 'Name/Description', 'College/Client', 'Location',
      'Bill Number', 'PO Number', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredRecords.map(r => {
      let category = r.billingCategory || activeTab;
      let nameDesc = r.isMasterProject ? r.name : r.issueDescription || r.name;
      let collegeClient = r.isMasterProject ? r.client_name : r.divisionName;
      let location = r.location || '';
      let billNum = r.bill_number || '';
      let poNum = r.po_number || '';
      let status = r.status || '';

      if (activeTab !== 'Billing & PO') {
         nameDesc = r.name || '';
         const parent = r.parentTicket || r.parentProject || {};
         collegeClient = parent.divisionName || parent.client_name || '';
         location = parent.location || '';
         status = 'Document';
      }

      return [
        escapeCSV(category),
        escapeCSV(nameDesc),
        escapeCSV(collegeClient),
        escapeCSV(location),
        escapeCSV(billNum),
        escapeCSV(poNum),
        escapeCSV(status)
      ];
    });

    const csvContent = "\uFEFF" + [ 
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Billing_${activeTab.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Export successful');
  };

  const handleDownloadPDF = () => {
    if (filteredRecords.length === 0) {
      showNotification('No data available to export', 'error');
      return;
    }

    const headers = [
      'Category', 'Name/Description', 'College/Client', 'Location',
      'Bill Number', 'PO Number', 'Status'
    ];

    const rows = filteredRecords.map(r => {
      let category = r.billingCategory || activeTab;
      let nameDesc = r.isMasterProject ? r.name : r.issueDescription || r.name;
      let collegeClient = r.isMasterProject ? r.client_name : r.divisionName;
      let location = r.location || '';
      let billNum = r.bill_number || '';
      let poNum = r.po_number || '';
      let status = r.status || '';

      if (activeTab !== 'Billing & PO') {
         nameDesc = r.name || '';
         const parent = r.parentTicket || r.parentProject || {};
         collegeClient = parent.divisionName || parent.client_name || '';
         location = parent.location || '';
         status = 'Document';
      }

      return [category, nameDesc, collegeClient, location, billNum, poNum, status];
    });

    const printWindow = window.open('', '_blank');
    
    let html = `
      <html>
        <head>
          <title>Billing Report - ${activeTab}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h2 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Billing & PO Report - ${activeTab}</h2>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map(row => `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <FileText className="mr-3 text-cyan-400" size={28} />
            Billing & PO Tracking
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button onClick={handleDownload} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          <button onClick={handleDownloadPDF} className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors">
            <FileText size={14} className="mr-2" /> Export PDF
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search descriptions, numbers..."
            className="bg-panel text-sm text-slate-200 border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center space-x-2 bg-panel px-4 py-3 rounded-md border border-main">
          <Calendar size={16} className="text-slate-400" />
          <input 
            type="month" 
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="From Month"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input 
            type="month" 
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-1.5 outline-none border border-slate-700 focus:border-cyan-500 w-36 cursor-pointer"
            title="To Month"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-main mb-6 bg-slate-900/40 p-1 rounded-lg">
        {[
          { id: 'Billing & PO', icon: FileBarChart },
          { id: 'Ticket Documents', icon: FileText },
          { id: 'Upgrade Documents', icon: Shield },
          { id: 'Project Documents', icon: File }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-md font-bold text-xs uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <tab.icon size={14} />
            <span>{tab.id}</span>
          </button>
        ))}
      </div>

      {activeTab === 'Billing & PO' && (
        <div className="flex flex-wrap gap-2 mb-6">
          {['All', 'Tickets', 'Upgrades', 'Projects', 'Project Logs'].map(filter => (
            <button
              key={filter}
              onClick={() => setBillingFilter(filter)}
              className={`px-4 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                billingFilter === filter
                  ? 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/50'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date / ID</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location / Details</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {activeTab === 'Billing & PO' ? 'Billing Info' : 'Documents'}
                </th>
                {canEdit && <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-main">
              {loading ? (
                <tr><td colSpan="5" className="p-10 text-center text-slate-500 font-bold tracking-widest uppercase text-xs">Loading data...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-slate-500 font-bold tracking-widest uppercase text-xs">No records found.</td></tr>
              ) : (
                filteredRecords.map(record => {
                  if (activeTab === 'Billing & PO') {
                    return (
                      <tr key={record.id || record._id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4 text-xs font-mono text-slate-400">
                          {record.isMasterProject ? (record.start_date || 'N/A') : (record.operationDate || new Date(record.createdAt || Date.now()).toISOString().split('T')[0])}
                        </td>
                        <td className="p-4 text-xs font-bold text-slate-200">
                          {record.isMasterProject ? record.name : record.issueDescription}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {record.billingCategory === 'Project Logs' && (
                              <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Project Log</span>
                            )}
                            {record.billingCategory === 'Upgrades' && (
                              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Upgrade</span>
                            )}
                            {record.isMasterProject && (
                              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Master Project</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          {record.isMasterProject ? record.client_name : (
                            (record.project?.name || (record.remarks && record.remarks.includes('projectName') ? JSON.parse(record.remarks).projectName : null)) || 
                            `${record.divisionName || ''} ${record.block || ''} ${record.room || ''}`
                          )}
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            {record.billing_records?.filter(b => b.record_type === 'Bill').map(bill => (
                              <div key={bill.id} className="flex items-center space-x-2 text-xs">
                                <Hash size={12} className="text-emerald-500 flex-shrink-0" />
                                <span className="text-slate-500 flex-shrink-0">Bill:</span>
                                <span className="font-mono text-emerald-400">{bill.number}</span>
                                {bill.amount && <span className="text-slate-500">({bill.amount})</span>}
                                {bill.file && (
                                  <a href={getFullUrl(bill.file)} target="_blank" rel="noopener noreferrer" className="flex items-center text-cyan-400 hover:text-cyan-300 ml-2" title="View Bill">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(bill.file)}</span>
                                  </a>
                                )}
                              </div>
                            ))}
                            {record.billing_records?.filter(p => p.record_type === 'PO').map(po => (
                              <div key={po.id} className="flex items-center space-x-2 text-xs mt-1">
                                <Hash size={12} className="text-purple-500 flex-shrink-0" />
                                <span className="text-slate-500 flex-shrink-0">PO:</span>
                                <span className="font-mono text-purple-400">{po.number}</span>
                                {po.amount && <span className="text-slate-500">({po.amount})</span>}
                                {po.file && (
                                  <a href={getFullUrl(po.file)} target="_blank" rel="noopener noreferrer" className="flex items-center text-cyan-400 hover:text-cyan-300 ml-2" title="View PO">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(po.file)}</span>
                                  </a>
                                )}
                              </div>
                            ))}

                            {/* Legacy Single Record Support */}
                            {(record.bill_number || record.bill_document) && (
                              <div className="flex items-center space-x-2 text-xs">
                                <Hash size={12} className="text-emerald-500" />
                                <span className="text-slate-500 flex-shrink-0">Bill:</span>
                                {record.bill_number && <span className="font-mono text-emerald-400">{record.bill_number}</span>}
                                {record.bill_document && (
                                  <a href={getFullUrl(record.bill_document)} target="_blank" rel="noopener noreferrer" className="flex items-center text-cyan-400 hover:text-cyan-300 ml-2" title="View Bill">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(record.bill_document)}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {(record.po_number || record.po_document) && (
                              <div className="flex items-center space-x-2 text-xs mt-1">
                                <Hash size={12} className="text-purple-500" />
                                <span className="text-slate-500 flex-shrink-0">PO:</span>
                                {record.po_number && <span className="font-mono text-purple-400">{record.po_number}</span>}
                                {record.po_document && (
                                  <a href={getFullUrl(record.po_document)} target="_blank" rel="noopener noreferrer" className="flex items-center text-cyan-400 hover:text-cyan-300 ml-2" title="View PO">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(record.po_document)}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {(!record.billing_records?.length && !record.bill_number && !record.po_number && !record.bill_document && !record.po_document) && (
                              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">No Billing Attached</span>
                            )}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleOpenModal(record)} 
                              className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-cyan-500/20"
                            >
                              Manage Billing
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  // Render Documents Tabs
                  return (
                    <tr key={record.id || record._id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 text-xs font-mono text-slate-400">
                        {record.isMasterProject ? (record.start_date || 'N/A') : (record.operationDate || new Date(record.createdAt || Date.now()).toISOString().split('T')[0])}
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-200">
                        {record.isMasterProject ? record.name : record.issueDescription}
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {record.isMasterProject ? record.client_name : (
                          (record.project?.name || (record.remarks && record.remarks.includes('projectName') ? JSON.parse(record.remarks).projectName : null)) || 
                          `${record.divisionName || ''} ${record.block || ''} ${record.room || ''}`
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-2">
                          {record.documents && record.documents.length > 0 ? (
                            record.documents.map(doc => (
                              <div key={doc.id} className="flex items-center space-x-2 text-xs">
                                <File size={12} className="text-cyan-500 flex-shrink-0" />
                                <span className="text-slate-500 flex-shrink-0">Doc:</span>
                                <span className="font-mono text-cyan-400">{doc.name}</span>
                                {doc.file && (
                                  <a href={getFullUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="flex items-center text-cyan-400 hover:text-cyan-300 ml-2" title="View Document">
                                    <Eye size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">View</span>
                                  </a>
                                )}
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">No Documents Attached</span>
                          )}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleOpenDocModal(record)} 
                            className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all border border-cyan-500/20"
                          >
                            Manage Documents
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-main shadow-2xl flex flex-col">
            <div className="p-8 border-b border-main flex justify-between items-center bg-card">
              <div>
                <h2 className="text-xl font-black text-main tracking-tight uppercase flex items-center">
                  <Upload className="mr-3 text-blue-400" size={24} />
                  Attach Billing Documents
                </h2>
                <p className="text-xs text-dim mt-2 max-w-md truncate">
                  {selectedItem.isMasterProject ? selectedItem.name : selectedItem.issueDescription}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              
              {/* BILL DETAILS SECTION */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Bill Details
                </h3>

                {/* List Existing Bills */}
                {(() => {
                  const currentRecord = tickets.find(t => t.id === selectedItem.id) || projects.find(p => p.id === selectedItem.id) || selectedItem;
                  const bills = currentRecord.billing_records?.filter(r => r.record_type === 'Bill') || [];
                  if (bills.length > 0) {
                    return (
                      <div className="space-y-2 mb-4">
                        {bills.map(bill => (
                          <div key={bill.id} className="p-3 bg-panel rounded-xl border border-emerald-500/20 flex items-center justify-between">
                            <div className="flex items-center w-full max-w-[250px]">
                              <CheckCircle size={14} className="text-emerald-400 mr-2 flex-shrink-0" />
                              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate">
                                {bill.number} {bill.amount ? `(${bill.amount})` : ''}
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              {bill.file && (
                                <>
                                  <a href={getFullUrl(bill.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors" title="View">
                                    <Eye size={14} />
                                  </a>
                                  <a href={getFullUrl(bill.file)} download target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="Download">
                                    <Download size={14} />
                                  </a>
                                </>
                              )}
                              <button type="button" onClick={() => handleDeleteBillingRecord(bill.id, 'Bill')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={submitting}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Add New Bill */}
                <div className="pt-4 border-t border-emerald-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Add New Bill</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Bill Number</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, number: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-card border-emerald-500/20 text-main focus:border-emerald-500" 
                        placeholder="e.g. INV-2026-001"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_bill.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, amount: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-card border-emerald-500/20 text-main focus:border-emerald-500" 
                        placeholder="e.g. $5,000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload Bill PDF/Image</label>
                    <input 
                      type="file" 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_bill: { ...prev.new_bill, file: e.target.files[0] } }))}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer" 
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => handleAddBillingRecord('Bill')}
                      disabled={submitting || (!formData.new_bill.number && !formData.new_bill.file)}
                      className="bg-emerald-500 text-white hover:bg-emerald-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : 'Save New Bill'}
                    </button>
                  </div>
                </div>
              </div>

              {/* PO DETAILS SECTION */}
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Purchase Order (PO) Details
                </h3>

                {/* List Existing POs */}
                {(() => {
                  const currentRecord = tickets.find(t => t.id === selectedItem.id) || projects.find(p => p.id === selectedItem.id) || selectedItem;
                  const pos = currentRecord.billing_records?.filter(r => r.record_type === 'PO') || [];
                  if (pos.length > 0) {
                    return (
                      <div className="space-y-2 mb-4">
                        {pos.map(po => (
                          <div key={po.id} className="p-3 bg-panel rounded-xl border border-purple-500/20 flex items-center justify-between">
                            <div className="flex items-center w-full max-w-[250px]">
                              <CheckCircle size={14} className="text-purple-400 mr-2 flex-shrink-0" />
                              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate">
                                {po.number} {po.amount ? `(${po.amount})` : ''}
                              </span>
                            </div>
                            <div className="flex space-x-2">
                              {po.file && (
                                <>
                                  <a href={getFullUrl(po.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors" title="View">
                                    <Eye size={14} />
                                  </a>
                                  <a href={getFullUrl(po.file)} download target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="Download">
                                    <Download size={14} />
                                  </a>
                                </>
                              )}
                              <button type="button" onClick={() => handleDeleteBillingRecord(po.id, 'PO')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={submitting}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Add New PO */}
                <div className="pt-4 border-t border-purple-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Add New PO</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">PO Number</label>
                      <input 
                        type="text" 
                        value={formData.new_po.number} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, number: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-card border-purple-500/20 text-main focus:border-purple-500" 
                        placeholder="e.g. PO-998877"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Amount / Details</label>
                      <input 
                        type="text" 
                        value={formData.new_po.amount} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_po: { ...prev.new_po, amount: e.target.value } }))}
                        className="glass-input w-full p-2.5 text-xs bg-card border-purple-500/20 text-main focus:border-purple-500" 
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
                      disabled={submitting || (!formData.new_po.number && !formData.new_po.file)}
                      className="bg-purple-500 text-white hover:bg-purple-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-500/30 disabled:opacity-50"
                    >
                      {submitting ? 'Saving...' : 'Save New PO'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-main">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="bg-slate-700 text-white hover:bg-slate-600 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDocModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in">
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-main shadow-2xl flex flex-col">
            <div className="p-8 border-b border-main flex justify-between items-center bg-card">
              <div>
                <h2 className="text-xl font-black text-main tracking-tight uppercase flex items-center">
                  <File className="mr-3 text-purple-400" size={24} />
                  Manage General Documents
                </h2>
                <p className="text-xs text-dim mt-2 max-w-md truncate">
                  {selectedItem.isMasterProject ? selectedItem.name : selectedItem.issueDescription}
                </p>
              </div>
              <button onClick={() => setShowDocModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center">
                  <FileText size={16} className="mr-2" />
                  Attached Documents
                </h3>

                {(() => {
                  const currentRecord = tickets.find(t => t.id === selectedItem.id) || projects.find(p => p.id === selectedItem.id) || selectedItem;
                  const docs = currentRecord.documents || [];
                  if (docs.length > 0) {
                    return (
                      <div className="space-y-2 mb-4">
                        {docs.map(doc => (
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
                                  <a href={getFullUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="View">
                                    <Eye size={14} />
                                  </a>
                                  <a href={getFullUrl(doc.file)} download target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-lg transition-colors" title="Download">
                                    <Download size={14} />
                                  </a>
                                </>
                              )}
                              <button type="button" onClick={() => handleDeleteGeneralDocument(doc.id)} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors" title="Delete" disabled={submitting}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="pt-4 border-t border-blue-500/20">
                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Upload New Document</h4>
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Document Name</label>
                      <input 
                        type="text" 
                        value={docFormData.name} 
                        onChange={(e) => setDocFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="glass-input w-full p-2.5 text-xs bg-card border-blue-500/20 text-main focus:border-blue-500" 
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
                      disabled={submitting || !docFormData.name || !docFormData.file}
                      className="bg-blue-500 text-white hover:bg-blue-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
                    >
                      {submitting ? 'Uploading...' : 'Upload Document'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-main">
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
        </div>
      )}
    </div>
  );
}
