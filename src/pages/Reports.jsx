import React, { useState, useEffect, useMemo, Fragment } from 'react';
import api from '../services/api';
import {
  FileText, Download, PieChart as PieChartIcon, TrendingUp, Calendar,
  CheckCircle, Clock, AlertCircle, FileDown, ShieldCheck, Database,
  Cctv, Zap, Server, Fingerprint, LayoutGrid, Radio, Briefcase, Activity
} from 'lucide-react';
// charts removed
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

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

export default function Reports() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [nvrs, setNvrs] = useState([]);
  const [switches, setSwitches] = useState([]);
  const [biometrics, setBiometrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentDate = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(currentDate);
  const [endDate, setEndDate] = useState(currentDate);
  const [reportType, setReportType] = useState('Camera'); // Camera, NVR, Switch, Biometric

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const results = await Promise.allSettled([
        api.get('/tickets/'),
        api.get('/tickets/projects/'),
        api.get('/cameras/'),
        api.get('/cameras/nvrs/'),
        api.get('/cameras/switches/'),
        api.get('/cameras/biometrics/')
      ]);
      
      const [ticketRes, projectRes, camRes, nvrRes, swRes, bioRes] = results;

      setTickets(ticketRes.status === 'fulfilled' && Array.isArray(ticketRes.value.data) ? ticketRes.value.data : []);
      setProjects(projectRes.status === 'fulfilled' && Array.isArray(projectRes.value.data) ? projectRes.value.data : []);
      setCameras(camRes.status === 'fulfilled' && Array.isArray(camRes.value.data) ? camRes.value.data : []);
      setNvrs(nvrRes.status === 'fulfilled' && Array.isArray(nvrRes.value.data) ? nvrRes.value.data : []);
      setSwitches(swRes.status === 'fulfilled' && Array.isArray(swRes.value.data) ? swRes.value.data : []);
      setBiometrics(bioRes.status === 'fulfilled' && Array.isArray(bioRes.value.data) ? bioRes.value.data : []);

      if (results.some(r => r.status === 'rejected')) {
        console.warn('Some data failed to load:', results.filter(r => r.status === 'rejected'));
        // We still consider this a partial success, so we don't necessarily show a full error banner
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
      showNotification('Failed to load report data', 'error');
      setTickets([]); setProjects([]); setCameras([]); setNvrs([]); setSwitches([]); setBiometrics([]);
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = (items) => {
    return items.filter(item => {
      const dateStr = item.operationDate || item.start_date || item.createdAt || item.updatedAt || '';
      if (!dateStr) return !startDate && !endDate;
      const dayStr = dateStr.substring(0, 10);
      if (startDate && endDate) return dayStr >= startDate && dayStr <= endDate;
      if (startDate) return dayStr >= startDate;
      if (endDate) return dayStr <= endDate;
      return true;
    });
  };

  const handleExport = (isFiltered = true) => {
    let xml = `<?xml version="1.0"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
     xmlns:o="urn:schemas-microsoft-com:office:office"
     xmlns:x="urn:schemas-microsoft-com:office:excel"
     xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
     xmlns:html="http://www.w3.org/TR/REC-html40">
      <Styles>
        <Style ss:ID="Header">
          <Font ss:Bold="1"/>
          <Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>
        </Style>
      </Styles>`;

    const getSafe = (arr) => Array.isArray(arr) ? arr : [];
    
    const safeTickets = isFiltered ? filterByDate(getSafe(tickets)) : getSafe(tickets);
    const safeProjects = isFiltered ? filterByDate(getSafe(projects)) : getSafe(projects);
    const safeCameras = isFiltered ? filterByDate(getSafe(cameras)) : getSafe(cameras);
    const safeNvrs = isFiltered ? filterByDate(getSafe(nvrs)) : getSafe(nvrs);
    const safeSwitches = isFiltered ? filterByDate(getSafe(switches)) : getSafe(switches);
    const safeBiometrics = isFiltered ? filterByDate(getSafe(biometrics)) : getSafe(biometrics);

    const sheets = [
      {
        name: 'Tickets',
        headers: ['Ticket ID', 'Date', 'College', 'Block', 'Floor', 'Room', 'Category', 'Issue Description', 'Action Taken', 'Responsible Admin', 'Technicians', 'Start Time', 'End Time', 'Total Time', 'Status'],
        data: safeTickets.map(t => [
          t.id || t._id,
          t.operationDate || t.createdAt?.split('T')[0] || 'N/A',
          t.collegeName, t.block, t.floor, t.room,
          t.category || 'CCTV', t.issueDescription, t.actionTaken,
          t.assignedTo?.name, (t.assignedStaff || []).map(s => s.name).join(' & '),
          t.receivedTime, t.endTime, t.totalTime, t.status
        ])
      },
      {
        name: 'Projects',
        headers: ['Project ID', 'Project Name', 'Client Name', 'Status', 'Start Date', 'End Date', 'Ticket Count', 'DB Store Date'],
        data: safeProjects.map(p => [
          p.id || p._id,
          p.name, p.client_name, p.status, p.start_date, p.end_date, p.ticket_count,
          p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'
        ])
      },
      {
        name: 'Cameras',
        headers: ['Camera ID', 'Name', 'Model', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Status', 'DB Store Date'],
        data: safeCameras.map(c => [
          c.cameraId || c.id || c._id,
          c.name, c.model, c.ipAddress, c.collegeName, c.block, c.floor, c.room, c.status,
          c.createdAt ? new Date(c.createdAt).toLocaleDateString() : (c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'N/A')
        ])
      },
      {
        name: 'NVRs',
        headers: ['NVR ID', 'NVR Name', 'IP Address', 'Brand', 'Total Channels', 'Storage Capacity', 'Location', 'Status', 'DB Store Date'],
        data: safeNvrs.map(n => [
          n.id || n._id, n.nvrName, n.ipAddress, n.brand, n.channel, n.hardDisk, `${n.collegeName || ''} ${n.block || ''}`,
          n.status, n.createdAt ? new Date(n.createdAt).toLocaleDateString() : (n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : 'N/A')
        ])
      },
      {
        name: 'Switches',
        headers: ['Switch ID', 'Switch Name', 'IP Address', 'Ports', 'Brand', 'Location', 'Status', 'DB Store Date'],
        data: safeSwitches.map(s => [
          s.id || s._id, s.name, s.ipAddress, s.portCount, s.brand, `${s.collegeName || ''} ${s.block || ''}`,
          s.status, s.createdAt ? new Date(s.createdAt).toLocaleDateString() : (s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : 'N/A')
        ])
      },
      {
        name: 'Biometrics',
        headers: ['Unit ID', 'Name', 'Model', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Status', 'DB Store Date'],
        data: safeBiometrics.map(b => [
          b.serialNumber || b.id || b._id, b.name, b.model, b.ipAddress, b.collegeName, b.block, b.floor, b.room, b.status,
          b.createdAt ? new Date(b.createdAt).toLocaleDateString() : (b.updatedAt ? new Date(b.updatedAt).toLocaleDateString() : 'N/A')
        ])
      }
    ];

    const exportSheets = isFiltered ? sheets.filter(s => {
      if (reportType === 'Ticket' && s.name === 'Tickets') return true;
      if (reportType === 'Project' && s.name === 'Projects') return true;
      if (reportType === 'Camera' && s.name === 'Cameras') return true;
      if (reportType === 'NVR' && s.name === 'NVRs') return true;
      if (reportType === 'Switch' && s.name === 'Switches') return true;
      if (reportType === 'Biometric' && s.name === 'Biometrics') return true;
      return false;
    }) : sheets;

    exportSheets.forEach(sheet => {
      xml += `\n<Worksheet ss:Name="${sheet.name}"><Table>`;
      
      xml += `\n<Row>`;
      sheet.headers.forEach(h => {
        xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${(h || '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
      });
      xml += `</Row>`;

      sheet.data.forEach(row => {
        xml += `\n<Row>`;
        row.forEach(cell => {
          const cellStr = (cell === null || cell === undefined) ? '' : String(cell);
          xml += `<Cell><Data ss:Type="String">${cellStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
        });
        xml += `</Row>`;
      });

      xml += `\n</Table></Worksheet>`;
    });

    xml += `\n</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isFiltered ? 'Filtered_' : 'Full_DB_'}Report_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`${isFiltered ? 'Filtered' : 'Full DB'} Reports downloaded successfully`, 'success');
  };

  const getFilteredData = () => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeCameras = Array.isArray(cameras) ? cameras : [];
    const safeNvrs = Array.isArray(nvrs) ? nvrs : [];
    const safeSwitches = Array.isArray(switches) ? switches : [];
    const safeBiometrics = Array.isArray(biometrics) ? biometrics : [];

    switch (reportType) {
      case 'Ticket': return filterByDate(safeTickets);
      case 'Project': return filterByDate(safeProjects);
      case 'Camera': return filterByDate(safeCameras);
      case 'NVR': return filterByDate(safeNvrs);
      case 'Switch': return filterByDate(safeSwitches);
      case 'Biometric': return filterByDate(safeBiometrics);
      default: return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-panel">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-dim font-black uppercase tracking-[0.4em] animate-pulse">Loading Data...</p>
        </div>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in px-4 relative">
      {/* Formal Letterhead (Visible in PDF only) */}
      <div className="hidden print-only-header">
        <div className="letter-branding text-black">RATHINAM GLOBAL UNIVERSITY</div>
        <div className="letter-sub text-black">CCTV Audit Report</div>
        <div className="text-[10px] mt-4 font-bold text-black uppercase tracking-widest">
          Generation Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-main pb-8 gap-6 no-print">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <FileText className="mr-3 text-blue-500" size={28} />
            Reports
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-secondary uppercase tracking-widest block ml-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="glass-input px-4 py-3 text-xs bg-panel border-main text-main cursor-pointer"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-secondary uppercase tracking-widest block ml-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="glass-input px-4 py-3 text-xs bg-panel border-main text-main cursor-pointer"
              />
            </div>
          </div>
          <button
            onClick={() => handleExport(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 rounded-xl flex items-center space-x-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto"
          >
            <FileDown size={20} className="text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Download {reportType}</span>
          </button>
          <button
            onClick={() => handleExport(false)}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-4 rounded-xl flex items-center space-x-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto"
          >
            <Database size={20} className="text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Download Full DB</span>
          </button>
        </div>
      </div>

      {/* Category Selection Bar */}
      <div className="flex flex-wrap items-center gap-3 p-2 bg-panel rounded-2xl border border-main shadow-sm no-print">
        {[
          { id: 'Ticket', label: 'Tickets', icon: FileText },
          { id: 'Project', label: 'Projects', icon: Briefcase },
          { id: 'Camera', label: 'Camera', icon: Cctv },
          { id: 'NVR', label: 'NVR', icon: Server },
          { id: 'Switch', label: 'Switch', icon: Zap },
          { id: 'Biometric', label: 'Biometric', icon: Fingerprint }
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${reportType === type.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-dim hover:bg-card hover:text-main'
              }`}
          >
            <type.icon size={16} />
            <span>{type.label}</span>
          </button>
        ))}
      </div>



      {/* Dynamic Data Preview Table */}
      <div className="glass-panel overflow-hidden border-main shadow-2xl animate-slide-up bg-panel rounded-[2rem]">
        <div className="p-6 border-b border-main bg-card flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Database size={18} />
            </div>
            <h3 className="text-sm font-black text-main uppercase tracking-widest">Live Preview</h3>
          </div>
          <span className="text-[10px] font-black text-secondary uppercase tracking-widest px-3 py-1 bg-card rounded-full border border-main">
            {filteredData.length} Records Found
          </span>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-panel border-b border-main">
              <tr>
                {reportType === 'Ticket' ? (
                  <>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest">Ticket ID</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest">Subject</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest text-center">Status</th>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest text-right">DB Store Date</th>
                  </>
                ) : reportType === 'Project' ? (
                  <>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest">Project Name</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest">Client</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest text-center">Status</th>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest text-right">DB Store Date</th>
                  </>
                ) : (
                  <>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest">Device Name</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest">IP Address</th>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest">Identity / Brand</th>
                    <th className="p-5 text-[10px] font-black text-secondary uppercase tracking-widest text-center">Operational State</th>
                    <th className="p-5 text-[10px] font-black text-dim uppercase tracking-widest text-right">DB Store Date</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-main">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-dim text-xs font-bold uppercase tracking-widest italic">
                    No matching records found in this category.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const id = item?._id || item?.id || Math.random().toString(36).substr(2, 9);
                  if (reportType === 'Ticket') {
                    return (
                      <React.Fragment key={id}>
                        <tr className="hover:bg-card transition-all group border-b border-main/50">
                          <td className="p-5 text-xs font-mono text-dim">#{ String(id).slice(-6).toUpperCase() }</td>
                          <td className="p-5 text-xs font-bold text-main">{item.issueDescription || 'No Description'}</td>
                          <td className="p-5 text-center">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                              item.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              item.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {item.status || 'Open'}
                            </span>
                          </td>
                          <td className="p-5 text-right text-[10px] font-bold text-dim">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                        {item.documents && item.documents.length > 0 && (
                          <tr className="bg-blue-500/[0.02]">
                            <td colSpan={4} className="p-4 pl-8 border-b border-main/50">
                              <div className="flex flex-col space-y-3">
                                <div className="flex items-center space-x-2">
                                  <FileText size={14} className="text-blue-500" />
                                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Ticket Documents</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {item.documents.map((doc, idx) => (
                                    <a key={doc.id || idx} href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 px-3 py-2 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-xl transition-all border border-blue-500/20 hover:border-blue-500/40 shadow-sm">
                                      <FileText size={12} />
                                      <span className="text-[10px] font-bold">{doc.name}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  } else if (reportType === 'Project') {
                    return (
                      <React.Fragment key={id}>
                        <tr className="hover:bg-card transition-all group border-b border-main/50">
                          <td className="p-5 text-xs font-bold text-main">{item.name || 'Untitled Project'}</td>
                          <td className="p-5 text-xs font-bold text-main">{item.client_name || 'Internal'}</td>
                          <td className="p-5 text-center">
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                              item.status === 'Completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              item.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {item.status || 'Active'}
                            </span>
                          </td>
                          <td className="p-5 text-right text-[10px] font-bold text-dim">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                        {item.documents && item.documents.length > 0 && (
                          <tr className="bg-blue-500/[0.02]">
                            <td colSpan={4} className="p-4 pl-8 border-b border-main/50">
                              <div className="flex flex-col space-y-3">
                                <div className="flex items-center space-x-2">
                                  <Briefcase size={14} className="text-blue-500" />
                                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Project Documents</h4>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {item.documents.map((doc, idx) => (
                                    <a key={doc.id || idx} href={getImageUrl(doc.file)} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 px-3 py-2 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-xl transition-all border border-blue-500/20 hover:border-blue-500/40 shadow-sm">
                                      <FileText size={12} />
                                      <span className="text-[10px] font-bold">{doc.name}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  } else {
                    let name = '';
                    let sub = '';
                    if (reportType === 'Camera') { name = item.name || 'Unknown Camera'; sub = item.brand || 'Generic'; }
                    else if (reportType === 'NVR') { name = item.nvrName || 'Unknown NVR'; sub = `${item.brand || 'Generic'} - ${item.channel || 0}CH`; }
                    else if (reportType === 'Switch') { name = item.name || 'Unknown Switch'; sub = `${item.brand || 'Generic'} - ${item.portCount || 0} Ports`; }
                    else if (reportType === 'Biometric') { name = item.name || 'Unknown Biometric'; sub = `${item.brand || 'Generic'} - ${item.type || 'Standard'}`; }

                    const isActive = item.status === 'Active' || item.status === 'Online' || !item.status;

                    return (
                      <tr key={id} className="hover:bg-card transition-all group">
                        <td className="p-5 text-xs font-bold text-main">{name}</td>
                        <td className="p-5 text-xs font-mono text-blue-400">{item.ipAddress || '0.0.0.0'}</td>
                        <td className="p-5 text-xs font-bold text-secondary uppercase">{sub}</td>
                        <td className="p-5 text-center">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                            isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {item.status || (reportType === 'Camera' ? 'Active' : 'Online')}
                          </span>
                        </td>
                        <td className="p-5 text-right text-[10px] font-bold text-dim">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : (item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'N/A')}
                        </td>
                      </tr>
                    );
                  }
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Footer (Visible in PDF only) */}
      <div className="hidden print-only-footer">
        <p>© 2026 RATHINAM GLOBAL UNIVERSITY</p>
        <p className="mt-1">This is a system-generated document. Unauthorized alteration is prohibited.</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 25mm; }
          body { 
            background: white !important; 
            color: black !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important;
            font-family: 'Inter', -apple-system, sans-serif !important;
            line-height: 1.6 !important;
          }
          
          .print-only-header {
            display: block !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 20px !important;
            margin-bottom: 40px !important;
            text-align: right;
          }
          .letter-branding {
            font-family: 'Space Grotesk', sans-serif !important;
            font-size: 24px !important;
            font-weight: 900 !important;
            letter-spacing: -1px !important;
            text-transform: uppercase !important;
          }
          .letter-sub {
            font-size: 10px !important;
            font-weight: 700 !important;
            letter-spacing: 2px !important;
            opacity: 0.6;
          }

          .no-print, button, input, select, .no-print { 
            display: none !important; 
          }
          
          .max-w-7xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          
          .bg-white { background: white !important; }
          .shadow-sm, .shadow-2xl, .shadow-lg { box-shadow: none !important; }
          .border-slate-100, .border-white\\/10 { border-color: #eee !important; }
          
          .text-white, .text-slate-900, .text-slate-500, .text-dim { 
            color: #000 !important; 
          }

          .print-only-footer {
            display: block !important;
            position: fixed;
            bottom: 20mm;
            left: 25mm;
            right: 25mm;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            font-size: 9px;
            color: #666;
            text-align: center;
          }
        }
      `}} />
    </div>
  );
}
