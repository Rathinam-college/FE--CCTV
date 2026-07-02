import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Camera, 
  Shield, 
  ArrowLeft, 
  MapPin, 
  Database, 
  Wifi, 
  HardDrive, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Clock, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Zap,
  Globe,
  FileText,
  FileJson,
  Download,
  Send,
  MessageSquare,
  ArrowRightLeft,
  Settings2,
  Save,
  XCircle,
  History,
  Plus
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';
import RemarkModal from '../components/RemarkModal';

export default function CameraDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [camera, setCamera] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTab, setEditTab] = useState('status'); // 'status' or 'location'
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { allLocations, fetchAllLocations, divisions, fetchDivisions } = useSiteStore();

  const unifiedActivity = useMemo(() => {
    if (!camera) return [];
    
    const logs = (camera.message_history || []).map(log => ({
      ...log,
      type: 'log',
      timestamp: new Date(`${log.date} ${log.time || '00:00'}`).getTime()
    }));

    const moves = (camera.relocations || []).map(move => ({
      ...move,
      type: 'move',
      remark: `Asset relocated from ${move.old_location} to ${move.new_location}`,
      timestamp: new Date(`${move.date} 00:00`).getTime()
    }));

    return [...logs, ...moves].sort((a, b) => b.timestamp - a.timestamp);
  }, [camera]);

  const [formData, setFormData] = useState({
    name: '',
    block: '',
    floor: '',
    room: '',
    divisionName: '',
    brand: '',
    ipAddress: '',
    ipv4Gateway: '',
    subnetMask: '',
    macAddress: '',
    campusZone: 'INSIDE'
  });

  useEffect(() => {
    fetchCameraDetails();
    fetchAllLocations();
    fetchDivisions();
  }, [id]);

  const fetchCameraDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cameras/${id}/`);
      setCamera(res.data);
      const { block: parsedBlock, floor: parsedFloor } = parseSiteName(res.data.siteName);
      setFormData({
        name: res.data.name || '',
        block: res.data.block || parsedBlock || '',
        floor: res.data.floor || parsedFloor || '',
        room: res.data.room || '',
        divisionName: res.data.divisionName || '',
        brand: res.data.brand || '',
        ipAddress: res.data.ipAddress || '',
        ipv4Gateway: res.data.gateway || '',
        subnetMask: res.data.subnetMask || '',
        macAddress: res.data.macAddress || '',
        campusZone: res.data.campusZone || 'INSIDE'
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch camera details.');
      setLoading(false);
    }
  };
  

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      await api.patch(`/cameras/${id}/`, { status: newStatus });
      setCamera({ ...camera, status: newStatus });
      showNotification(`Asset status changed to ${newStatus}`);
      setConfirmStatus(null);
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      showNotification('Failed to update asset status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveRelocation = async () => {
    try {
      setIsSaving(true);
      const oldBlock = parseSiteName(camera.siteName).block;
      const oldFloor = parseSiteName(camera.siteName).floor;
      const oldIp = camera.ipAddress;

      const payload = {
        name: formData.name,
        siteName: `${formData.block} - ${formData.floor}${formData.room ? ` - ${formData.room}` : ''}`,
        ipAddress: formData.ipAddress,
        gateway: formData.ipv4Gateway,
        subnetMask: formData.subnetMask,
        macAddress: formData.macAddress,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        divisionName: formData.divisionName,
        brand: formData.brand,
        campusZone: formData.campusZone
      };

      await api.patch(`/cameras/${id}/`, payload);

      let moveLog = `Asset Relocated/Updated. `;
      if (oldBlock !== formData.block || oldFloor !== formData.floor) {
        moveLog += `Moved from ${oldBlock}/${oldFloor} to ${formData.block}/${formData.floor}. `;
      }
      if (oldIp !== formData.ipAddress) {
        moveLog += `IP changed from ${oldIp} to ${formData.ipAddress}. `;
      }

      await api.post(`/cameras/${id}/add_relocation/`, {
        old_location: `${oldBlock} - ${oldFloor}${camera.room ? ` - ${camera.room}` : ''}`,
        new_location: `${formData.block} - ${formData.floor}${formData.room ? ` - ${formData.room}` : ''}`,
        old_ip: oldIp,
        new_ip: formData.ipAddress,
        remark: moveLog
      });

      showNotification('Asset successfully relocated and logs updated');
      setShowEditModal(false);
      fetchCameraDetails();
    } catch (err) {
      console.error(err);
      showNotification('Failed to relocate asset', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const downloadExcel = () => {
    const filename = `ASSET_${camera.cameraId || 'Export'}_${new Date().toISOString().split('T')[0]}.csv`;
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const details = [
      ['ASSET REPORT'],
      ['Generated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
      [''],
      ['HARDWARE SPECIFICATIONS'],
      ['IP Address', camera.ipAddress],
      ['Status', camera.status],
      ['Serial Number', camera.cameraId],
      ['Model Name', camera.name],
      ['Campus Zone', camera.campusZone],
      ['Block', camera.block || parseSiteName(camera.siteName).block],
      ['Floor', camera.floor || parseSiteName(camera.siteName).floor],
      ['Room', camera.room || '—'],
      ['College', camera.divisionName || '—'],
      [''],
      ['NETWORK CONFIGURATION'],
      ['Gateway', netInfo.gateway],
      ['Subnet Mask', netInfo.subnet],
      ['MAC Address', netInfo.mac],
      ['Device Index', netInfo.index],
      [''],
      ['COMPLETE MAINTENANCE HISTORY'],
      ['DATE', 'TIME', 'USER', 'REMARK']
    ];

    // Add all historical logs
    if (camera.message_history && camera.message_history.length > 0) {
      camera.message_history.forEach(msg => {
        const formattedTime = msg.time ? (msg.time.length > 5 ? msg.time.substring(0, 5) : msg.time) : '—';
        details.push([msg.date, formattedTime, msg.userName, msg.remark]);
      });
    } else {
      details.push(['No maintenance entries found']);
    }

    const csvContent = "\uFEFF" + details.map(row => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Detailed audit report generated');
  };

  const downloadPDF = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = `
      <html>
        <head>
          <title>Camera Details - ${camera.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            h1 { color: #1a56db; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 14px; font-weight: bold; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            .grid { display: flex; flex-wrap: wrap; margin: -10px; }
            .grid-item { flex: 1 1 45%; padding: 10px; }
            .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: bold; }
            .value { font-size: 15px; font-weight: bold; color: #111827; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-online { background-color: #d1fae5; color: #047857; }
            .status-maintenance { background-color: #ffedd5; color: #c2410c; }
            .status-offline { background-color: #fee2e2; color: #b91c1c; }
          </style>
        </head>
        <body>
          <h1>Camera Details - ${camera.name || 'N/A'}</h1>
          
          <div class="section">
            <div class="grid">
              <div class="grid-item">
                <div class="label">Status</div>
                <div class="value">
                  <span class="badge ${camera.status === 'Online' ? 'status-online' : camera.status === 'Maintenance' ? 'status-maintenance' : 'status-offline'}">
                    ${camera.status || 'N/A'}
                  </span>
                </div>
              </div>
              <div class="grid-item">
                <div class="label">System ID / Serial</div>
                <div class="value">${camera.cameraId || 'N/A'} <br/> ${camera.serialNumber || ''}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Deployment Context</div>
            <div class="grid">
              <div class="grid-item">
                <div class="label">Division</div>
                <div class="value">${camera.divisionName || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Block Assignment</div>
                <div class="value">${camera.block || parseSiteName(camera.siteName).block || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Level / Floor</div>
                <div class="value">${camera.floor || parseSiteName(camera.siteName).floor || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Room / Area</div>
                <div class="value">${camera.room || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Campus Zone</div>
                <div class="value">${camera.campusZone || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Hardware Specifications</div>
            <div class="grid">
              <div class="grid-item">
                <div class="label">Hardware Brand</div>
                <div class="value">${camera.brand || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Network Configuration</div>
            <div class="grid">
              <div class="grid-item">
                <div class="label">Static IPv4</div>
                <div class="value">${camera.ipAddress || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">IPv4 Gateway</div>
                <div class="value">${netInfo.gateway || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Subnet Mask</div>
                <div class="value">${netInfo.subnet || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">MAC Physical</div>
                <div class="value">${netInfo.mac || 'N/A'}</div>
              </div>
              <div class="grid-item">
                <div class="label">Port Number</div>
                <div class="value">${netInfo.portNumber || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 50px; font-size: 12px; color: #9ca3af; text-align: center;">
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

  const parseNetworkDetails = (camera) => {
    if (!camera) return { gateway: '—', subnet: '—', mac: '—', index: '—', divisionName: '' };
    return {
      gateway: camera.gateway || '—',
      subnet: camera.subnetMask || '—',
      mac: camera.macAddress || '—',
      portNumber: camera.portNumber || '—',
      divisionName: camera.divisionName || ''
    };
  };

  const parseSiteName = (siteName) => {
    if (!siteName) return { block: '', floor: '' };
    const parts = siteName.split(' - ');
    return { block: parts[0] || '', floor: parts[1] || '' };
  };

  const netInfo = useMemo(() => camera ? parseNetworkDetails(camera) : null, [camera]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute top-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-dim font-bold animate-pulse text-xs uppercase tracking-widest">Encrypting Feed Connection...</p>
      </div>
    );
  }

  if (error || !camera) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-panel p-8 text-center border-red-500/20">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-bold text-main mb-2">Protocol Failure</h3>
        <p className="text-dim text-sm mb-8 leading-relaxed">{error || 'Target asset not found in database.'}</p>
        <button onClick={() => navigate('/cameras')} className="w-full glass-button py-3 flex items-center justify-center">
          <ArrowLeft size={18} className="mr-2" /> Return to Command Hub
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12 relative">
      {/* Formal Letterhead (Visible in PDF only) */}
      <div className="hidden print-only-header">
        <div className="letter-branding text-black">RATHINAM GLOBAL UNIVERSITY</div>
        <div className="letter-sub text-black">Asset Report</div>
        <div className="report-title text-black hidden">OFFICIAL ASSET AUDIT REPORT</div>
        <div className="text-[10px] mt-6 font-bold text-black uppercase tracking-widest text-left flex justify-between border-t border-black pt-2">
          <span>Asset Designation: {camera.name} ({camera.cameraId || 'N/A'})</span>
          <span>Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Action Ribbon & Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div className="space-y-1">
          <nav className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-dim">
            <button onClick={() => navigate('/dashboard')} className="hover:text-blue-400 transition-colors">COMMAND</button>
            <ChevronRight size={10} />
            <button onClick={() => navigate('/cameras')} className="hover:text-blue-400 transition-colors">ASSETS</button>
            <ChevronRight size={10} />
            <span className="text-blue-400">DETAIL VIEW</span>
          </nav>
          <div className="flex items-center space-x-4">
             <h1 className="text-3xl font-black text-main uppercase tracking-tight">{camera.name}</h1>
             <div className={`px-3 py-1 rounded-full text-[10px] font-black border flex items-center space-x-2 ${
               camera.status === 'Online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
               camera.status === 'Offline' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
               'bg-amber-500/10 text-amber-500 border-amber-500/20'
             }`}>
               <div className={`w-1.5 h-1.5 rounded-full ${camera.status === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-current'}`}></div>
               <span>{camera.status.toUpperCase()}</span>
             </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-panel/50 border border-main p-1 rounded-xl">
            <button 
              onClick={downloadExcel}
              className="p-2.5 rounded-lg text-secondary hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
              title="Export Excel"
            >
              <Download size={20} />
            </button>
            <button 
              onClick={downloadPDF}
              className="p-2.5 rounded-lg text-secondary hover:text-blue-400 hover:bg-blue-500/10 transition-all"
              title="Export PDF"
            >
              <FileText size={20} />
            </button>
            <div className="w-px h-6 bg-white/10 mx-1"></div>
            <button 
              onClick={fetchCameraDetails}
              className="p-2.5 rounded-lg text-secondary hover:text-main hover:bg-white/5 transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <button 
            onClick={() => { setShowEditModal(true); setConfirmStatus(null); }} 
            className="flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl bg-sky-600 text-white hover:bg-sky-500 border-t border-white/20"
          >
            <Settings2 size={18} />
            <span>Edit Camera</span>
          </button>
        </div>
      </div>

      {/* Top Intelligence Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <IntelligenceCard 
          icon={Globe} 
          label="IP Address" 
          value={camera.ipAddress} 
          color="blue"
          action={() => {
            navigator.clipboard.writeText(camera.ipAddress);
            showNotification('IP Address copied to clipboard');
          }}
        />
        <IntelligenceCard 
          icon={ShieldCheck} 
          label="Secure ID" 
          value={camera.cameraId} 
          color="purple" 
          mono
        />
        <IntelligenceCard 
          icon={MapPin} 
          label="Deployment" 
          value={camera.block || '—'} 
          color="emerald" 
        />
        <IntelligenceCard 
          icon={Clock} 
          label="Last Update" 
          value={camera.message_history?.[0]?.date || 'Today'} 
          color="amber" 
        />
      </div>
      
      {/* Latest Directives Section */}
      {camera.remarks && (
        <div className="glass-panel p-5 border-l-4 border-amber-500 bg-amber-500/5 border-main shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <MessageSquare size={80} />
          </div>
          <div className="flex items-start space-x-4 relative z-10">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20">
              <Zap size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Active Asset Directive</p>
              <p className="text-main font-medium leading-relaxed italic">"{camera.remarks}"</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
        
        {/* Left Section: Core Intelligence */}
        <div className="lg:col-span-2 space-y-6 print:w-full">
          
            <div className="glass-panel overflow-hidden border-main shadow-2xl bg-card/30">
              <div className="p-5 bg-panel border-b border-main flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-main uppercase tracking-widest">Asset Intelligence Registry</h3>
                    <p className="text-[9px] text-dim uppercase tracking-[0.3em] font-bold">Deep Hardware & Network Signature</p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-12">
                <section>
                  <div className="flex items-center space-x-4 mb-6">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] whitespace-nowrap">Hardware Identity</p>
                    <div className="h-px bg-blue-500/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailRow label="Asset Designation" value={camera.name} />
                    <DetailRow label="Hardware Brand" value={camera.brand} />
                    <DetailRow label="System ID" value={camera.cameraId} mono />
                    <DetailRow label="Serial Number" value={camera.serialNumber} mono />
                    <DetailRow label="Campus Zone" value={camera.campusZone} />
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-4 mb-6">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] whitespace-nowrap">Deployment Context</p>
                    <div className="h-px bg-emerald-500/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailRow label="Division" value={camera.divisionName} />
                    <DetailRow label="Block Assignment" value={camera.block} />
                    <DetailRow label="Level / Floor" value={camera.floor} />
                    <DetailRow label="Room / Area" value={camera.room} />
                  </div>
                </section>

                <section>
                  <div className="flex items-center space-x-4 mb-6">
                    <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.3em] whitespace-nowrap">Network Architecture</p>
                    <div className="h-px bg-purple-500/10 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DetailRow label="Static IPv4" value={camera.ipAddress} mono />
                    <DetailRow label="IPv4 Gateway" value={netInfo.gateway} mono />
                    <DetailRow label="Subnet Mask" value={netInfo.subnet} mono />
                    <DetailRow label="Port Number" value={netInfo.portNumber} mono />
                    <DetailRow label="MAC Physical" value={netInfo.mac} mono />
                  </div>
                </section>
              </div>
            </div>
        </div>

        {/* Right Section: Administrative Hub */}
        <div className="space-y-6 no-print">
          

          {/* Activity Timeline Hub */}
          <div className="glass-panel overflow-hidden border-blue-500/20 shadow-xl flex flex-col bg-blue-500/5">
            <div className="p-5 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
               <div className="flex items-center space-x-3 text-blue-400 font-black text-[10px] uppercase tracking-widest">
                  <History size={16} />
                  <span>Asset Timeline</span>
               </div>
            </div>
            <div className="p-5 space-y-6">
               {unifiedActivity.length > 0 ? (
                 <div className="space-y-6 relative">
                   <div className="absolute top-2 bottom-2 left-[11px] w-px bg-blue-500/20"></div>
                   {unifiedActivity.slice(0, 3).map((log, i) => (
                     <div key={i} className="flex items-start space-x-4 relative group/item">
                        <div className={`w-6 h-6 rounded-full bg-panel border-2 ${
                          log.type === 'move' ? 'border-emerald-500' : 
                          log.remark?.includes('Status changed') ? 'border-amber-500' : 'border-blue-500'
                        } flex-shrink-0 z-10 flex items-center justify-center shadow-lg transition-transform group-hover/item:scale-110`}>
                           {log.type === 'move' ? <MapPin size={10} className="text-emerald-500" /> : 
                            log.remark?.includes('Status changed') ? <Activity size={10} className="text-amber-500" /> : 
                            <MessageSquare size={10} className="text-blue-500" />}
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex justify-between items-start">
                              <div className="flex items-center space-x-2">
                                <p className="text-[10px] font-black text-main uppercase">{log.userName || 'System'}</p>
                                {log.type === 'move' && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter">Relocation</span>
                                )}
                              </div>
                              <p className="text-[9px] text-dim font-bold">{log.date}</p>
                           </div>
                           <p className="text-xs text-dim leading-relaxed">{log.remark}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center py-8">
                    <Activity size={32} className="mx-auto text-dim/20 mb-3" />
                    <p className="text-xs text-dim font-medium uppercase tracking-widest">No Recent Logs</p>
                 </div>
               )}
               
               {unifiedActivity.length > 0 && (
                 <button 
                   onClick={() => navigate(`/devices/history/camera/${id}`)}
                   className="w-full py-3.5 mt-4 rounded-xl bg-white/5 border border-white/10 text-dim hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center space-x-2"
                 >
                   <span>View Full Audit Hub</span>
                   <ChevronRight size={14} />
                 </button>
               )}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="glass-panel p-5 border-white/5 bg-white/[0.02] space-y-4">
             <h4 className="text-[10px] font-black text-dim uppercase tracking-[0.2em] mb-2">Shortcuts</h4>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => navigate('/cameras')}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center space-y-2 hover:bg-white/10 transition-all"
                >
                   <ArrowLeft size={16} className="text-dim" />
                   <span className="text-[9px] font-bold text-dim uppercase">Back</span>
                </button>
                <button 
                  onClick={downloadPDF}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center space-y-2 hover:bg-white/10 transition-all"
                >
                   <FileText size={16} className="text-blue-400" />
                   <span className="text-[9px] font-bold text-dim uppercase">Report</span>
                </button>
             </div>
          </div>
        </div>
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
              
              /* Formal Letterhead */
              .print-only-header {
                display: block !important;
                border-bottom: 3px double #000 !important;
                padding-bottom: 10px !important;
                margin-bottom: 30px !important;
                text-align: center;
              }
              .letter-branding {
                font-family: 'Times New Roman', Times, serif !important;
                font-size: 26px !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
                color: #000 !important;
              }
              .letter-sub {
                font-family: 'Arial', sans-serif !important;
                font-size: 12px !important;
                font-weight: bold !important;
                letter-spacing: 2px !important;
                margin-top: 5px !important;
                color: #333 !important;
              }
              .report-title {
                display: block !important;
                font-family: 'Arial', sans-serif !important;
                font-size: 16px !important;
                font-weight: bold !important;
                margin-top: 15px !important;
                text-decoration: underline !important;
              }

              /* Hide all UI controls */
              .no-print, button, select, input, textarea, nav, .hero-actions, .quick-nav, .danger-zone, .breadcrumb { 
                display: none !important; 
              }
              
              /* Reset container */
              .max-w-7xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
              
              /* Content Blocks */
              .glass-panel { 
                border: none !important;
                background: white !important; 
                box-shadow: none !important; 
                color: black !important; 
                margin-bottom: 30px !important; 
                padding: 0 !important; 
                border-radius: 0 !important;
                page-break-inside: avoid;
              }
              
              .glass-panel > div:first-child {
                border-bottom: 2px solid #000 !important;
                padding: 5px 0 !important;
                margin-bottom: 15px !important;
                background-color: transparent !important;
                border-radius: 0 !important;
              }
              
              .glass-panel h3 {
                font-size: 14px !important;
                font-weight: 900 !important;
                text-transform: uppercase !important;
                color: #000 !important;
              }
              
              .p-8 { padding: 20px !important; }
              
              .text-main, .text-dim, .text-blue-500, .text-secondary { 
                color: #000 !important; 
              }
              
              .border-blue-500\\/10, .border-emerald-500\\/10, .border-purple-500\\/10 { 
                border-color: #000 !important; 
                margin-top: 20px !important;
                margin-bottom: 10px !important;
                border-top: 1px solid #000 !important;
              }
              
              /* Section Headers */
              .text-\\[10px\\].font-black.uppercase.tracking-\\[0\\.3em\\] {
                font-size: 12px !important;
                font-weight: 900 !important;
                color: #000 !important;
                text-decoration: underline !important;
                letter-spacing: 1px !important;
              }
              
              /* Intelligence Cards Grid */
              .grid-cols-1.md\\:grid-cols-4 {
                display: block !important;
              }
              
              .glass-panel {
                border-bottom: 1px solid #ddd !important;
                padding: 12px 5px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
              }
              
              /* Detail Rows Grid */
              .grid-cols-2.md\\:grid-cols-3 {
                display: block !important;
              }

              /* Detail Row Formatting (Line by Line) */
              .bg-panel\\/40 {
                background: transparent !important;
                border: none !important;
                border-bottom: 1px solid #ddd !important;
                padding: 12px 5px !important;
                border-radius: 0 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin: 0 !important;
              }
              
              .bg-panel\\/40:last-child {
                border-bottom: 1px solid #ddd !important;
              }
              
              .mb-1\\.5 { margin-bottom: 0 !important; }
              
              /* Professional Spacing for 'Letter Type' */
              .space-y-12 > * { margin-bottom: 25px !important; }
              
              .text-dim { 
                font-size: 11px !important;
                text-transform: uppercase !important;
                font-weight: 800 !important; 
                color: #333 !important;
              }
              .font-bold { font-weight: 700 !important; font-size: 13px !important; color: #000 !important; }
              .font-mono { font-family: 'SFMono-Regular', Consolas, monospace !important; font-size: 12px !important; color: #000 !important; }
              
              /* Official Footer */
              .print-only-footer {
                display: block !important;
                position: fixed;
                bottom: 10mm;
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

      {/* Official Footer (Visible in PDF only) */}
      <div className="hidden print-only-footer">
        <p>© 2026 RATHINAM GLOBAL UNIVERSITY</p>
        <p className="mt-1">This is a system-generated document. Unauthorized alteration is prohibited.</p>
      </div>

      {/* Edit Modal Overlay */}
      {showEditModal && (
        <div className="fixed inset-0 modal-overlay z-[120] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-3xl overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-sky-500/10 rounded-2xl">
                  <Settings2 className="text-sky-500" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-main uppercase tracking-tight">
                    Edit Camera Details
                  </h2>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-xl text-secondary hover:text-main transition-all">
                <XCircle size={24} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-main bg-card shrink-0">
              <button 
                onClick={() => { setEditTab('status'); setConfirmStatus(null); }}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${editTab === 'status' ? 'text-sky-500 border-b-2 border-sky-500 bg-sky-500/5' : 'text-dim hover:bg-panel hover:text-main'}`}
              >
                Change Status
              </button>
              <button 
                onClick={() => setEditTab('location')}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${editTab === 'location' ? 'text-amber-500 border-b-2 border-amber-500 bg-amber-500/5' : 'text-dim hover:bg-panel hover:text-main'}`}
              >
                Change Location / Info
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-card custom-scrollbar">
              {editTab === 'status' && (
                <div className="space-y-6">
                  <p className="text-sm font-bold text-dim mb-4">Select the new operational status for this asset:</p>
                  <div className="grid grid-cols-2 gap-4">
                    {['Online', 'Offline', 'Maintenance', 'Scrap'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setConfirmStatus(s)}
                        disabled={camera.status === s}
                        className={`py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all border ${
                          camera.status === s 
                            ? 'bg-sky-500/10 text-sky-600 border-sky-500/30 shadow-lg cursor-not-allowed' 
                            : confirmStatus === s
                              ? 'bg-sky-500 text-white border-sky-500 shadow-lg scale-105'
                              : 'bg-panel text-main border-main hover:border-sky-500/50 hover:text-sky-500 shadow-sm'
                        }`}
                      >
                        {s} {camera.status === s && '(Current)'}
                      </button>
                    ))}
                  </div>
                  
                  {confirmStatus && (
                    <div className="mt-8 p-6 bg-sky-50 border border-sky-200 rounded-2xl animate-fade-in">
                      <h4 className="text-sky-800 font-bold mb-2">Confirm Status Change</h4>
                      <p className="text-sky-600 text-sm mb-6">Are you sure you want to change the status of {camera.name} to <strong>{confirmStatus}</strong>?</p>
                      <div className="flex space-x-4">
                        <button 
                          onClick={() => setConfirmStatus(null)}
                          className="flex-1 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleStatusChange(confirmStatus)}
                          disabled={updatingStatus}
                          className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-sky-500 transition-all shadow-md flex items-center justify-center space-x-2"
                        >
                          {updatingStatus ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                          <span>Confirm & Save</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {editTab === 'location' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Asset Name</label>
                        <input 
                          type="text" 
                          value={formData.name} 
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="glass-input w-full p-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Target Division</label>
                        <select 
                          value={formData.divisionName} 
                          onChange={(e) => setFormData({...formData, divisionName: e.target.value})}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="">Select Division</option>
                          {divisions && Array.from(new Set(divisions.map(d => d.name))).filter(Boolean).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Block Designation</label>
                        <select 
                          value={formData.block} 
                          onChange={(e) => setFormData({...formData, block: e.target.value})}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="">Select Block</option>
                          {Array.from(new Set(allLocations.filter(l => l.divisionName === formData.divisionName).map(l => l.block))).map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Floor</label>
                          <select 
                            value={formData.floor} 
                            onChange={(e) => setFormData({...formData, floor: e.target.value})}
                            className="glass-input w-full p-3 text-sm cursor-pointer"
                          >
                            <option value="">Select Floor</option>
                            {Array.from(new Set(allLocations.filter(l => l.block === formData.block).map(l => l.floor))).map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Room / Area</label>
                          <select 
                            value={formData.room} 
                            onChange={(e) => setFormData({...formData, room: e.target.value})}
                            className="glass-input w-full p-3 text-sm cursor-pointer"
                          >
                            <option value="">Select Room</option>
                            {Array.from(new Set(allLocations.filter(l => l.floor === formData.floor).map(l => l.room))).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">Campus Zone</label>
                        <select 
                          value={formData.campusZone} 
                          onChange={(e) => setFormData({...formData, campusZone: e.target.value})}
                          className="glass-input w-full p-3 text-sm cursor-pointer"
                        >
                          <option value="INSIDE">INSIDE</option>
                          <option value="OUTSIDE">OUTSIDE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-1.5">IPv4 Address Assignment</label>
                        <input 
                          type="text" 
                          value={formData.ipAddress} 
                          onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                          className="glass-input w-full p-3 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
                    <h4 className="text-amber-800 font-bold mb-2">Confirm Modifications</h4>
                    <p className="text-amber-600 text-sm mb-6">Review the changes above. This will update the asset's registry and record a relocation log if the block, floor, or IP address has changed.</p>
                    <div className="flex space-x-4">
                      <button 
                        onClick={() => setShowEditModal(false)}
                        className="flex-1 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveRelocation}
                        disabled={isSaving}
                        className="flex-1 py-3 bg-amber-500 text-black rounded-xl font-bold text-xs uppercase hover:bg-amber-400 transition-all shadow-md flex items-center justify-center space-x-2"
                      >
                        {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                        <span>Confirm Relocation & Save</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="bg-panel/40 border border-white/5 p-4 rounded-2xl hover:bg-panel/60 transition-all group">
      <p className="text-[10px] font-black text-dim uppercase tracking-widest mb-1.5 group-hover:text-dim/80">{label}</p>
      <p className={`text-sm font-bold ${mono ? 'font-mono text-blue-300' : 'text-main'} truncate`}>{value || '—'}</p>
    </div>
  );
}

function IntelligenceCard({ icon: Icon, label, value, color = "blue", mono = false, action = null }) {
  const colorMap = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div 
      onClick={action}
      className={`glass-panel p-5 border-l-4 ${color === 'blue' ? 'border-blue-500' : color === 'emerald' ? 'border-emerald-500' : color === 'amber' ? 'border-amber-500' : 'border-purple-500'} bg-card border-main shadow-lg hover:translate-y-[-4px] transition-all ${action ? 'cursor-pointer hover:bg-panel' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-[9px] font-black text-dim uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-lg font-black tracking-tight text-main ${mono ? 'font-mono' : ''} truncate`}>
        {value || '—'}
      </p>
    </div>
  );
}
