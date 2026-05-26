import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  FileText, Search, Plus, Upload, X, Shield, Home, FileBarChart,
  Download, File, Hash, CheckCircle, Trash2, Eye
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
  
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // The record we are adding bills to
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    bill_number: '',
    po_number: '',
    bill_document: null,
    po_document: null
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
      setTickets(ticketRes.data || []);
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
      
      if (t.documents && t.documents.length > 0) {
        t.documents.forEach(d => {
          if (isUpgrade) {
            upgradeDocs.push({ ...d, parentTicket: t });
          } else {
            ticketDocs.push({ ...d, parentTicket: t });
          }
        });
      }
    });

    projects.forEach(p => {
      billingAndPo.push({ ...p, billingCategory: 'Projects', isMasterProject: true });

      if (p.documents && p.documents.length > 0) {
        p.documents.forEach(d => {
          projectDocs.push({ ...d, parentProject: p });
        });
      }
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
    
    if (!searchQuery) return records;
    
    return records.filter(r => {
      if (activeTab === 'Billing & PO') {
        const searchStr = `${r.issueDescription || r.name || ''} ${r.location || ''} ${r.collegeName || ''} ${r.client_name || ''} ${r.bill_number || ''} ${r.po_number || ''}`.toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
      } else {
        const searchStr = `${r.name} ${r.parentTicket?.issueDescription || r.parentProject?.name || ''}`.toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
      }
    });
  }, [categorizedData, activeTab, searchQuery, billingFilter]);

  const handleOpenModal = (item) => {
    setSelectedItem(item);
    setFormData({
      bill_number: item.bill_number || '',
      po_number: item.po_number || '',
      bill_document: null,
      po_document: null
    });
    setShowModal(true);
  };

  const handleFileChange = (e, field) => {
    setFormData(prev => ({ ...prev, [field]: e.target.files[0] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const data = new FormData();
    data.append('bill_number', formData.bill_number);
    data.append('po_number', formData.po_number);
    
    if (formData.bill_document) {
      data.append('bill_document', formData.bill_document);
    }
    if (formData.po_document) {
      data.append('po_document', formData.po_document);
    }

    try {
      setSubmitting(true);
      const endpoint = selectedItem.isMasterProject
        ? `/tickets/projects/${selectedItem.id || selectedItem._id}/`
        : `/tickets/${selectedItem.id || selectedItem._id}/`;
        
      await api.patch(endpoint, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      showNotification('Billing information updated successfully', 'success');
      setShowModal(false);
      fetchData(); // Refresh list to show new documents
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload billing documents', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (field) => {
    if (!selectedItem || !window.confirm(`Are you sure you want to remove this ${field === 'bill_document' ? 'Bill' : 'PO'}? This will delete the file and clear the number.`)) return;

    const data = new FormData();
    data.append(field, ''); // Empty string to clear the file
    
    if (field === 'bill_document') {
      data.append('bill_number', '');
      setFormData(prev => ({ ...prev, bill_number: '', bill_document: null }));
    } else if (field === 'po_document') {
      data.append('po_number', '');
      setFormData(prev => ({ ...prev, po_number: '', po_document: null }));
    }

    try {
      setSubmitting(true);
      const endpoint = selectedItem.isMasterProject
        ? `/tickets/projects/${selectedItem.id || selectedItem._id}/`
        : `/tickets/${selectedItem.id || selectedItem._id}/`;
        
      await api.patch(endpoint, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      showNotification('Document removed successfully', 'success');
      setSelectedItem(prev => ({ ...prev, [field]: null, [field === 'bill_document' ? 'bill_number' : 'po_number']: '' }));
      fetchData();
    } catch (err) {
      console.error(err);
      showNotification('Failed to remove document', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `http://localhost:5000${cleanPath}`;
  };

  const getFileName = (path) => {
    if (!path) return '';
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    return name.length > 20 ? name.substring(0, 10) + '...' + name.substring(name.length - 7) : name;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center">
            <FileText className="mr-3 text-blue-400" size={28} />
            Billing & PO Tracking
          </h1>
          <p className="text-sm text-dim mt-1">Manage purchase orders and bills across all maintenance sectors</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
          <input 
            type="text" 
            placeholder="Search descriptions, numbers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input w-full !pl-14 pr-4 py-2 text-sm bg-panel border-white/10 text-white"
          />
        </div>
      </div>

      <div className="flex space-x-2 border-b border-white/10 mb-4">
        {[
          { id: 'Billing & PO', icon: FileBarChart },
          { id: 'Ticket Documents', icon: FileText },
          { id: 'Upgrade Documents', icon: Shield },
          { id: 'Project Documents', icon: File }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-6 py-3 border-b-2 font-bold text-xs uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-dim hover:text-white hover:border-white/20'
            }`}
          >
            <tab.icon size={16} />
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
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                billingFilter === filter
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-white/5 text-dim hover:bg-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}

      <div className="glass-panel overflow-hidden border border-white/10 shadow-2xl bg-panel rounded-[2rem]">
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              {activeTab === 'Billing & PO' ? (
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Date / ID</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Description</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Location / Details</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Billing Info</th>
                  {canEdit && <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest text-right">Actions</th>}
                </tr>
              ) : (
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Uploaded Date</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Document Name</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest">Parent Details</th>
                  <th className="p-5 text-[11px] font-black text-secondary uppercase tracking-widest text-right">View</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {loading ? (
                <tr><td colSpan="5" className="p-10 text-center text-dim font-bold tracking-widest uppercase text-xs">Loading data...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="5" className="p-10 text-center text-dim font-bold tracking-widest uppercase text-xs">No records found.</td></tr>
              ) : (
                filteredRecords.map(record => {
                  if (activeTab === 'Billing & PO') {
                    return (
                      <tr key={record.id || record._id} className="hover:bg-white/5 transition-colors">
                        <td className="p-5 text-xs font-mono text-dim">
                          {record.isMasterProject ? (record.start_date || 'N/A') : (record.operationDate || new Date(record.createdAt || Date.now()).toISOString().split('T')[0])}
                        </td>
                        <td className="p-5 text-xs font-bold">
                          {record.isMasterProject ? record.name : record.issueDescription}
                          {record.billingCategory === 'Project Logs' && (
                            <span className="block mt-1 text-[9px] text-blue-400 font-black uppercase tracking-widest bg-blue-500/10 w-max px-2 py-0.5 rounded">Project Log</span>
                          )}
                          {record.billingCategory === 'Upgrades' && (
                            <span className="block mt-1 text-[9px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-500/10 w-max px-2 py-0.5 rounded">Upgrade</span>
                          )}
                          {record.isMasterProject && (
                            <span className="block mt-1 text-[9px] text-purple-400 font-black uppercase tracking-widest bg-purple-500/10 w-max px-2 py-0.5 rounded">Master Project</span>
                          )}
                        </td>
                        <td className="p-5 text-xs text-secondary">
                          {record.isMasterProject ? record.client_name : (
                            (record.project?.name || (record.remarks && record.remarks.includes('projectName') ? JSON.parse(record.remarks).projectName : null)) || 
                            `${record.collegeName || ''} ${record.block || ''} ${record.room || ''}`
                          )}
                        </td>
                        <td className="p-5">
                          <div className="space-y-2">
                            {(record.bill_number || record.bill_document) && (
                              <div className="flex items-center space-x-2 text-xs">
                                <Hash size={12} className="text-emerald-500" />
                                <span className="text-dim">Bill:</span>
                                {record.bill_number && <span className="font-mono text-emerald-400">{record.bill_number}</span>}
                                {record.bill_document && (
                                  <a href={getFullUrl(record.bill_document)} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-400 hover:text-blue-300 ml-2" title="View Bill">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(record.bill_document)}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {(record.po_number || record.po_document) && (
                              <div className="flex items-center space-x-2 text-xs mt-1">
                                <Hash size={12} className="text-purple-500" />
                                <span className="text-dim">PO:</span>
                                {record.po_number && <span className="font-mono text-purple-400">{record.po_number}</span>}
                                {record.po_document && (
                                  <a href={getFullUrl(record.po_document)} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-400 hover:text-blue-300 ml-2" title="View PO">
                                    <File size={12} className="mr-1" />
                                    <span className="text-[10px] font-bold truncate max-w-[100px]">{getFileName(record.po_document)}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            
                            {(!record.bill_number && !record.po_number && !record.bill_document && !record.po_document) && (
                              <span className="text-[10px] text-dim uppercase tracking-widest font-bold">No Billing Attached</span>
                            )}
                          </div>
                        </td>
                        {canEdit && (
                          <td className="p-5 text-right">
                            <button 
                              onClick={() => handleOpenModal(record)} 
                              className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
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
                    <tr key={record.id || record._id} className="hover:bg-white/5 transition-colors">
                      <td className="p-5 text-xs font-mono text-dim">
                        {new Date(record.uploaded_at).toISOString().split('T')[0]}
                      </td>
                      <td className="p-5 text-xs font-bold">
                        {record.name}
                      </td>
                      <td className="p-5 text-xs text-secondary max-w-[200px] truncate">
                        {record.parentTicket ? record.parentTicket.issueDescription : record.parentProject?.name}
                      </td>
                      <td className="p-5 text-right">
                        <a href={getFullUrl(record.file)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all">
                          <Eye size={14} className="mr-2" /> View
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-panel rounded-[2.5rem] w-full max-w-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                  <Upload className="mr-3 text-blue-400" size={24} />
                  Attach Billing Documents
                </h2>
                <p className="text-xs text-dim mt-2 max-w-md truncate">
                  {selectedItem.isMasterProject ? selectedItem.name : selectedItem.issueDescription}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-dim hover:text-white transition-all"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              
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
                      name="bill_number" 
                      value={formData.bill_number} 
                      onChange={(e) => setFormData(prev => ({ ...prev, bill_number: e.target.value }))}
                      className="glass-input w-full p-3 text-xs bg-black/40 border-emerald-500/20 text-white focus:border-emerald-500" 
                      placeholder="e.g. INV-2026-001"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload Bill PDF/Image</label>
                    <input 
                      type="file" 
                      onChange={(e) => handleFileChange(e, 'bill_document')}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-emerald-500/20 file:text-emerald-400 hover:file:bg-emerald-500/30 cursor-pointer" 
                    />
                    {selectedItem.bill_document && !formData.bill_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-emerald-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest truncate" title={getFileName(selectedItem.bill_document)}>
                            {getFileName(selectedItem.bill_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getFullUrl(selectedItem.bill_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 rounded-lg transition-colors">
                            <Eye size={14} />
                          </a>
                          <button type="button" onClick={() => handleDeleteDocument('bill_document')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors">
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
                      name="po_number" 
                      value={formData.po_number} 
                      onChange={(e) => setFormData(prev => ({ ...prev, po_number: e.target.value }))}
                      className="glass-input w-full p-3 text-xs bg-black/40 border-purple-500/20 text-white focus:border-purple-500" 
                      placeholder="e.g. PO-998877"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Upload PO Document</label>
                    <input 
                      type="file" 
                      onChange={(e) => handleFileChange(e, 'po_document')}
                      className="w-full text-xs text-dim file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-widest file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 cursor-pointer" 
                    />
                    {selectedItem.po_document && !formData.po_document && (
                      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-purple-500/20 flex items-center justify-between">
                        <div className="flex items-center w-full max-w-[200px]">
                          <CheckCircle size={14} className="text-purple-400 mr-2 flex-shrink-0" />
                          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate" title={getFileName(selectedItem.po_document)}>
                            {getFileName(selectedItem.po_document)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <a href={getFullUrl(selectedItem.po_document)} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/40 rounded-lg transition-colors">
                            <Eye size={14} />
                          </a>
                          <button type="button" onClick={() => handleDeleteDocument('po_document')} className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-blue-600 text-white hover:bg-blue-500 px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 flex items-center"
                >
                  {submitting ? 'UPLOADING...' : 'SAVE BILLING DOCUMENTS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
