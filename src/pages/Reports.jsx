import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import {
  FileText, Download, PieChart, TrendingUp, Calendar,
  CheckCircle, Clock, AlertCircle, FileDown, ShieldCheck, Database,
  Cctv, Zap, Server, Fingerprint, LayoutGrid, Radio
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function Reports() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [tickets, setTickets] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [nvrs, setNvrs] = useState([]);
  const [switches, setSwitches] = useState([]);
  const [biometrics, setBiometrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportType, setReportType] = useState('Ticket'); // Ticket, Camera, NVR, Switch, Biometric

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [ticketRes, camRes, nvrRes, swRes, bioRes] = await Promise.all([
        api.get('/tickets/'),
        api.get('/cameras/'),
        api.get('/cameras/nvrs/'),
        api.get('/cameras/switches/'),
        api.get('/cameras/biometrics/')
      ]);
      setTickets(Array.isArray(ticketRes.data) ? ticketRes.data : []);
      setCameras(Array.isArray(camRes.data) ? camRes.data : []);
      setNvrs(Array.isArray(nvrRes.data) ? nvrRes.data : []);
      setSwitches(Array.isArray(swRes.data) ? swRes.data : []);
      setBiometrics(Array.isArray(bioRes.data) ? bioRes.data : []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      showNotification('Failed to load report data', 'error');
      // Set empty arrays on error to prevent crashes
      setTickets([]); setCameras([]); setNvrs([]); setSwitches([]); setBiometrics([]);
    } finally {
      setLoading(false);
    }
  };

  const dynamicStats = useMemo(() => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeCameras = Array.isArray(cameras) ? cameras : [];
    const safeNvrs = Array.isArray(nvrs) ? nvrs : [];
    const safeSwitches = Array.isArray(switches) ? switches : [];
    const safeBiometrics = Array.isArray(biometrics) ? biometrics : [];

    if (reportType === 'Ticket') {
      const total = safeTickets.length;
      const open = safeTickets.filter(t => t.status === 'Open').length;
      const active = safeTickets.filter(t => t.status === 'In Progress').length;
      const verified = total > 0 ? Math.round((safeTickets.filter(t => t.status === 'Completed').length / total) * 100) : 0;
      return [
        { label: 'Total Logs', value: total, sub: 'Entries', icon: Database, color: 'blue' },
        { label: 'Critical Issues', value: open, sub: 'OPEN', icon: AlertCircle, color: 'red' },
        { label: 'In Pipeline', value: active, sub: 'ACTIVE', icon: Clock, color: 'amber' },
        { label: 'Resolution Rate', value: `${verified}%`, sub: 'VERIFIED', icon: ShieldCheck, color: 'emerald' }
      ];
    } else if (reportType === 'Camera') {
      const total = safeCameras.length;
      const active = safeCameras.filter(c => c.status === 'Active' || !c.status || c.status === 'Online').length;
      const down = total - active;
      return [
        { label: 'Total Nodes', value: total, sub: 'CAMERAS', icon: Cctv, color: 'blue' },
        { label: 'Operational', value: active, sub: 'ONLINE', icon: ShieldCheck, color: 'emerald' },
        { label: 'Node Failure', value: down, sub: 'OFFLINE', icon: AlertCircle, color: 'red' },
        { label: 'Health Index', value: total > 0 ? `${Math.round((active / total) * 100)}%` : '0%', sub: 'STABLE', icon: TrendingUp, color: 'indigo' }
      ];
    } else if (reportType === 'NVR') {
      const total = safeNvrs.length;
      const totalChannels = safeNvrs.reduce((acc, n) => acc + (parseInt(n.channel) || 0), 0);
      return [
        { label: 'Storage Units', value: total, sub: 'NVRs', icon: Server, color: 'blue' },
        { label: 'Channel Load', value: totalChannels, sub: 'SLOTS', icon: LayoutGrid, color: 'amber' },
        { label: 'Data Hubs', value: total, sub: 'ACTIVE', icon: Database, color: 'indigo' },
        { label: 'System Reach', value: '100%', sub: 'SYNCED', icon: ShieldCheck, color: 'emerald' }
      ];
    } else if (reportType === 'Switch') {
      const total = safeSwitches.length;
      const totalPorts = safeSwitches.reduce((acc, s) => acc + (parseInt(s.portCount) || 0), 0);
      return [
        { label: 'Network Units', value: total, sub: 'SWITCHES', icon: Zap, color: 'blue' },
        { label: 'Port Velocity', value: totalPorts, sub: 'PORTS', icon: Radio, color: 'amber' },
        { label: 'Core Backbone', value: total, sub: 'ACTIVE', icon: Database, color: 'indigo' },
        { label: 'Uptime', value: '99.9%', sub: 'STABLE', icon: ShieldCheck, color: 'emerald' }
      ];
    } else if (reportType === 'Biometric') {
      const total = safeBiometrics.length;
      const active = safeBiometrics.filter(b => b.status === 'Online' || !b.status || b.status === 'Active').length;
      return [
        { label: 'Access Points', value: total, sub: 'UNITS', icon: Fingerprint, color: 'blue' },
        { label: 'Identity Auth', value: active, sub: 'ACTIVE', icon: ShieldCheck, color: 'emerald' },
        { label: 'Auth Failures', value: total - active, sub: 'OFFLINE', icon: AlertCircle, color: 'red' },
        { label: 'Security Index', value: 'HIGH', sub: 'SECURE', icon: ShieldCheck, color: 'indigo' }
      ];
    }
    return [];
  }, [reportType, tickets, cameras, nvrs, switches, biometrics]);

  const handleExport = () => {
    let dataToExport = [];
    let headers = [];
    let fileName = `Report_${reportType}_${new Date().toISOString().split('T')[0]}.csv`;

    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeCameras = Array.isArray(cameras) ? cameras : [];
    const safeNvrs = Array.isArray(nvrs) ? nvrs : [];
    const safeSwitches = Array.isArray(switches) ? switches : [];
    const safeBiometrics = Array.isArray(biometrics) ? biometrics : [];

    if (reportType === 'Ticket') {
      const filtered = selectedMonth
        ? safeTickets.filter(t => (t.operationDate || t.createdAt || '').startsWith(selectedMonth))
        : safeTickets;

      if (filtered.length === 0) return showNotification('No data for selected period', 'info');

      headers = [
        'Date', 'College', 'Block', 'Floor', 'Room', 'Category',
        'Issue Description', 'Action Taken', 'Responsible Admin',
        'Technicians', 'Start Time', 'End Time', 'Total Time', 'Status'
      ];
      dataToExport = filtered.map(t => {
        const technicians = (t.assignedStaff || []).map(s => s.name).join(' & ');
        return [
          t.operationDate || t.createdAt?.split('T')[0] || 'N/A',
          t.collegeName || 'N/A', t.block || 'N/A', t.floor || 'N/A', t.room || 'N/A',
          t.category || 'CCTV', `"${(t.issueDescription || '').replace(/"/g, '""')}"`,
          `"${(t.actionTaken || '').replace(/"/g, '""')}"`, t.assignedTo?.name || 'Unassigned',
          technicians || 'None', t.receivedTime || '', t.endTime || '', t.totalTime || '', t.status
        ];
      });
    } else if (reportType === 'Camera') {
      headers = ['Camera ID', 'Model', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Status', 'Last Checked'];
      dataToExport = safeCameras.map(c => [
        c.cameraId, c.model || 'N/A', c.ipAddress || 'N/A',
        c.collegeName || 'N/A', c.block || 'N/A', c.floor || 'N/A', c.room || 'N/A',
        c.status || 'Active', c.updatedAt?.split('T')[0] || 'N/A'
      ]);
    } else if (reportType === 'NVR') {
      headers = ['NVR Name', 'IP Address', 'Brand', 'Total Channels', 'Storage Capacity', 'Location'];
      dataToExport = safeNvrs.map(n => [
        n.nvrName, n.ipAddress || 'N/A', n.brand || 'N/A',
        n.channel || 'N/A', n.hardDisk || 'N/A',
        `${n.collegeName || ''} ${n.block || ''}`
      ]);
    } else if (reportType === 'Switch') {
      headers = ['Switch Name', 'IP Address', 'Ports', 'Brand', 'Location'];
      dataToExport = safeSwitches.map(s => [
        s.name, s.ipAddress || 'N/A', s.portCount || 'N/A', s.brand || 'N/A',
        `${s.collegeName || ''} ${s.block || ''}`
      ]);
    } else if (reportType === 'Biometric') {
      headers = ['Unit ID', 'Model', 'IP Address', 'College', 'Block', 'Floor', 'Room', 'Status'];
      dataToExport = safeBiometrics.map(b => [
        b.serialNumber || 'N/A', b.model || 'N/A', b.ipAddress || 'N/A',
        b.collegeName || 'N/A', b.block || 'N/A', b.floor || 'N/A', b.room || 'N/A',
        b.status || 'Active'
      ]);
    }
    const csvContent = [headers.join(','), ...dataToExport.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = fileName;
    link.click();
    document.body.removeChild(link);
    showNotification(`${reportType} report generated`, 'success');
  };

  const getFilteredData = () => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeCameras = Array.isArray(cameras) ? cameras : [];
    const safeNvrs = Array.isArray(nvrs) ? nvrs : [];
    const safeSwitches = Array.isArray(switches) ? switches : [];
    const safeBiometrics = Array.isArray(biometrics) ? biometrics : [];

    switch (reportType) {
      case 'Ticket':
        return selectedMonth ? safeTickets.filter(t => (t.operationDate || t.createdAt || '').startsWith(selectedMonth)) : safeTickets;
      case 'Camera': return safeCameras;
      case 'NVR': return safeNvrs;
      case 'Switch': return safeSwitches;
      case 'Biometric': return safeBiometrics;
      default: return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-panel">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-dim font-black uppercase tracking-[0.4em] animate-pulse">Syncing Telemetry...</p>
        </div>
      </div>
    );
  }

  const filteredData = getFilteredData();

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in px-4 relative">
      {/* Formal Letterhead (Visible in PDF only) */}
      <div className="hidden print-only-header">
        <div className="letter-branding text-black">Starlight Cyber Infrastructure</div>
        <div className="letter-sub text-black">Analytics & Infrastructure Audit Report</div>
        <div className="text-[10px] mt-4 font-bold text-black uppercase tracking-widest">
          Generation Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-white/10 pb-8 gap-6 no-print">
        <div>
          <h1 className="text-5xl font-black font-['Space_Grotesk'] tracking-tighter text-white italic">
            REPORTS
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.4em] mt-2">Data Analytics & Audit Center</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {reportType === 'Ticket' && (
            <div className="space-y-1">
              <label className="text-[9px] font-black text-secondary uppercase tracking-widest block ml-1">Period Filter</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass-input px-4 py-3 text-xs bg-panel border-white/10 text-white cursor-pointer"
              />
            </div>
          )}
          <button
            onClick={handleExport}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 rounded-xl flex items-center space-x-3 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-auto"
          >
            <FileDown size={20} className="text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Download {reportType} Report</span>
          </button>
        </div>
      </div>

      {/* Category Selection Bar */}
      <div className="flex flex-wrap items-center gap-3 p-2 bg-white rounded-2xl border border-slate-100 shadow-sm no-print">
        {[
          { id: 'Ticket', label: 'Maintenance Logs', icon: FileText },
          { id: 'Camera', label: 'Camera Registry', icon: Cctv },
          { id: 'NVR', label: 'Storage (NVR)', icon: Server },
          { id: 'Switch', label: 'Network Units', icon: Zap },
          { id: 'Biometric', label: 'Biometric Identity', icon: Fingerprint }
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`flex items-center space-x-3 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${reportType === type.id
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
          >
            <type.icon size={16} />
            <span>{type.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dynamicStats.map((stat, idx) => {
          const colors = {
            blue: 'bg-blue-50 border-blue-100 text-blue-500',
            red: 'bg-red-50 border-red-100 text-red-500',
            amber: 'bg-amber-50 border-amber-100 text-amber-500',
            emerald: 'bg-emerald-50 border-emerald-100 text-emerald-500',
            indigo: 'bg-indigo-50 border-indigo-100 text-indigo-500'
          };
          const colorClass = colors[stat.color] || colors.blue;

          return (
            <div key={idx} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] relative group transition-all hover:translate-y-[-4px]">
              <div className="flex items-center space-x-4 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-sm ${colorClass.split(' ').slice(0, 2).join(' ')}`}>
                  <stat.icon size={24} className={colorClass.split(' ').pop()} />
                </div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.1em]">{stat.label}</span>
              </div>
              <div className="flex flex-col items-center justify-center py-4">
                <span className="text-6xl font-black text-slate-900 tracking-tighter">{stat.value}</span>
              </div>
              <div className="flex justify-end mt-4">
                <span className={`text-[11px] font-black italic tracking-widest uppercase ${stat.color === 'blue' ? 'text-slate-400' : colorClass.split(' ').pop()}`}>{stat.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dynamic Data Preview Table */}
      <div className="glass-panel overflow-hidden border-main shadow-2xl animate-slide-up bg-white rounded-[2rem]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Database size={18} />
            </div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Registry Preview</h3>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1 bg-white rounded-full border border-slate-200">
            {filteredData.length} Records Found
          </span>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-white border-b border-slate-200">
              <tr>
                {reportType === 'Ticket' ? (
                  <>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket ID</th>
                    <th className="p-5 text-[10px] font-black text-slate-900 uppercase tracking-widest">Subject</th>
                    <th className="p-5 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Status</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Registered</th>
                  </>
                ) : (
                  <>
                    <th className="p-5 text-[10px] font-black text-slate-900 uppercase tracking-widest">Device Name</th>
                    <th className="p-5 text-[10px] font-black text-slate-900 uppercase tracking-widest">IP Address</th>
                    <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity / Brand</th>
                    <th className="p-5 text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Operational State</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic">
                    No matching records found in this category.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const id = item?._id || item?.id || Math.random().toString(36).substr(2, 9);
                  if (reportType === 'Ticket') {
                    return (
                      <tr key={id} className="hover:bg-slate-50 transition-all group">
                        <td className="p-5 text-xs font-mono text-slate-400">#{ String(id).slice(-6).toUpperCase() }</td>
                        <td className="p-5 text-xs font-bold text-slate-900">{item.issueDescription || 'No Description'}</td>
                        <td className="p-5 text-center">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                            item.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            item.status === 'In Progress' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {item.status || 'Open'}
                          </span>
                        </td>
                        <td className="p-5 text-right text-[10px] font-bold text-slate-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
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
                      <tr key={id} className="hover:bg-slate-50 transition-all group">
                        <td className="p-5 text-xs font-bold text-slate-900">{name}</td>
                        <td className="p-5 text-xs font-mono text-blue-600">{item.ipAddress || '0.0.0.0'}</td>
                        <td className="p-5 text-xs font-bold text-slate-500 uppercase">{sub}</td>
                        <td className="p-5 text-center">
                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${
                            isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {item.status || (reportType === 'Camera' ? 'Active' : 'Online')}
                          </span>
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
        <p>© 2026 STARLIGHT CYBER | RATHINAM GROUP OF INSTITUTIONS | INFRASTRUCTURE AUDIT DIVISION</p>
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
