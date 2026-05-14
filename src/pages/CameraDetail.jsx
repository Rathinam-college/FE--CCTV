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
  const [remarks, setRemarks] = useState('');
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { allLocations, fetchAllLocations } = useSiteStore();

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
    collegeName: '',
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
  }, [id]);

  const fetchCameraDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/cameras/${id}/`);
      setCamera(res.data);
      setRemarks(res.data.remarks || '');
      const { block: parsedBlock, floor: parsedFloor } = parseSiteName(res.data.siteName);
      const net = parseNetworkDetails(res.data.dvrNvrDetails);
      setFormData({
        name: res.data.name || '',
        block: res.data.block || parsedBlock || '',
        floor: res.data.floor || parsedFloor || '',
        room: res.data.room || '',
        collegeName: res.data.collegeName || net.collegeName || '',
        brand: res.data.brand || '',
        ipAddress: res.data.ipAddress || '',
        ipv4Gateway: net.gateway || '',
        subnetMask: net.subnet || '',
        macAddress: net.mac || '',
        campusZone: res.data.campusZone || 'INSIDE'
      });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch camera details.');
      setLoading(false);
    }
  };
  
  const handleSaveRemarks = async (remarkText) => {
    const textToSave = typeof remarkText === 'string' ? remarkText : remarks;
    if (!textToSave.trim()) return;
    
    try {
      setSavingRemarks(true);
      const res = await api.post(`/cameras/${id}/add_remark/`, { remark: textToSave });
      setCamera({ 
        ...camera, 
        message_history: [res.data, ...(camera.message_history || [])] 
      });
      setRemarks('');
      showNotification('Message logged successfully');
      setIsRemarkModalOpen(false);
    } catch (err) {
      console.error(err);
      showNotification('Failed to log message', 'error');
    } finally {
      setSavingRemarks(false);
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      await api.patch(`/cameras/${id}/`, { status: newStatus });
      setCamera({ ...camera, status: newStatus });
      showNotification(`Asset status transitioned to ${newStatus}`);
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
        dvrNvrDetails: `Gateway: ${formData.ipv4Gateway} | Subnet: ${formData.subnetMask} | MAC: ${formData.macAddress} | College: ${formData.collegeName}`,
        block: formData.block,
        floor: formData.floor,
        room: formData.room,
        collegeName: formData.collegeName,
        brand: formData.brand,
        campusZone: formData.campusZone
      };

      await api.patch(`/cameras/${id}/`, payload);

      // Log the relocation
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
      setEditMode(false);
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
      ['College', camera.collegeName || '—'],
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
    window.print();
  };

  const parseNetworkDetails = (details) => {
    if (!details) return { gateway: '—', subnet: '—', mac: '—', index: '—', collegeName: '' };
    const gwMatch = details.match(/Gateway:\s*([^|]+)/);
    const subMatch = details.match(/Subnet:\s*([^|]+)/);
    const macMatch = details.match(/MAC:\s*([^|]+)/);
    const idxMatch = details.match(/Index:\s*([^|]+)/);
    const collMatch = details.match(/College:\s*([^|]+)/);
    return {
      gateway: gwMatch ? gwMatch[1].trim() : '—',
      subnet: subMatch ? subMatch[1].trim() : '—',
      mac: macMatch ? macMatch[1].trim() : '—',
      index: idxMatch ? idxMatch[1].trim() : '—',
      collegeName: collMatch ? collMatch[1].trim() : ''
    };
  };

  const parseSiteName = (siteName) => {
    if (!siteName) return { block: '', floor: '' };
    const parts = siteName.split(' - ');
    return { block: parts[0] || '', floor: parts[1] || '' };
  };

  const netInfo = useMemo(() => camera ? parseNetworkDetails(camera.dvrNvrDetails) : null, [camera]);

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
        <div className="letter-branding text-black">Starlight Cyber Infrastructure</div>
        <div className="letter-sub text-black">Surveillance & Security Systems Protocol</div>
        <div className="text-[10px] mt-4 font-bold text-black uppercase tracking-widest">
          Generation Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
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
            onClick={() => setEditMode(!editMode)} 
            className={`flex items-center space-x-3 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
              editMode ? 'bg-amber-500 text-black border-amber-400' : 'bg-blue-600 text-white hover:bg-blue-500 border-blue-400/50'
            } border-t border-white/20`}
          >
            {editMode ? <XCircle size={18} /> : <ArrowRightLeft size={18} />}
            <span>{editMode ? 'Cancel Protocol' : 'Update Registry'}</span>
          </button>
        </div>
      </div>

      {/* Top Intelligence Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <IntelligenceCard 
          icon={Globe} 
          label="Network Node" 
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Section: Core Intelligence */}
        <div className="lg:col-span-2 space-y-6">
          
          {editMode ? (
            <div className="glass-panel overflow-hidden border-amber-500/30 shadow-2xl animate-slide-up">
              <div className="p-5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Settings2 size={20} className="text-amber-400" />
                  <div>
                    <h3 className="text-sm font-black text-main uppercase tracking-widest">Protocol Override</h3>
                    <p className="text-[9px] text-amber-400/60 uppercase font-bold tracking-widest">Relocation & Registry Update</p>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-2">Target Institution</label>
                      <select 
                        value={formData.collegeName} 
                        onChange={(e) => setFormData({...formData, collegeName: e.target.value})}
                        className="glass-input w-full p-3 text-sm"
                      >
                        <option value="">Select College</option>
                        {Array.from(new Set(allLocations.map(l => l.collegeName))).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-2">Block Designation</label>
                      <select 
                        value={formData.block} 
                        onChange={(e) => setFormData({...formData, block: e.target.value})}
                        className="glass-input w-full p-3 text-sm"
                      >
                        <option value="">Select Block</option>
                        {Array.from(new Set(allLocations.filter(l => l.collegeName === formData.collegeName).map(l => l.block))).map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-2">Floor</label>
                        <select 
                          value={formData.floor} 
                          onChange={(e) => setFormData({...formData, floor: e.target.value})}
                          className="glass-input w-full p-3 text-sm"
                        >
                          <option value="">Select Floor</option>
                          {Array.from(new Set(allLocations.filter(l => l.block === formData.block).map(l => l.floor))).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-2">Room / Area</label>
                        <select 
                          value={formData.room} 
                          onChange={(e) => setFormData({...formData, room: e.target.value})}
                          className="glass-input w-full p-3 text-sm"
                        >
                          <option value="">Select Room</option>
                          {Array.from(new Set(allLocations.filter(l => l.floor === formData.floor).map(l => l.room))).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-dim uppercase tracking-widest mb-2">IPv4 Address Assignment</label>
                      <input 
                        type="text" 
                        value={formData.ipAddress} 
                        onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                        className="glass-input w-full p-3 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveRelocation}
                  disabled={isSaving}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center space-x-3 transition-all shadow-2xl"
                >
                  {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                  <span>{isSaving ? 'Synchronizing Registry...' : 'Confirm Protocol Update'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden border-white/10 shadow-2xl bg-card/30">
              <div className="p-5 bg-panel border-b border-white/10 flex items-center justify-between">
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
                    <DetailRow label="Node Designation" value={camera.name} />
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
                    <DetailRow label="Institution" value={camera.collegeName} />
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
                    <DetailRow label="MAC Physical" value={netInfo.mac} mono />
                    <DetailRow label="Stream Index" value={netInfo.index} />
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Administrative Hub */}
        <div className="space-y-6">
          
          {/* Quick Command Box */}
          <div className="glass-panel overflow-hidden border-white/10 shadow-xl flex flex-col bg-panel/30">
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Send size={18} />
              </div>
              <h3 className="text-sm font-bold text-main tracking-wide uppercase">Registry Entry</h3>
            </div>
            <div className="p-5 space-y-4">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Log activity or maintenance..."
                className="glass-input w-full p-4 text-sm text-dim resize-none rounded-xl min-h-[100px] border-white/5 focus:border-blue-500/30 transition-all"
              />
              <button 
                onClick={handleSaveRemarks}
                disabled={savingRemarks || !remarks.trim()}
                className="w-full py-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 flex items-center justify-center space-x-2 font-bold text-xs uppercase tracking-widest"
              >
                {savingRemarks ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{savingRemarks ? 'Logging...' : 'Append to History'}</span>
              </button>
            </div>
          </div>

          {/* Quick Status Transition */}
          <div className="glass-panel overflow-hidden border-white/10 shadow-xl bg-panel/30">
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Zap size={18} />
              </div>
              <h3 className="text-sm font-bold text-main tracking-wide uppercase">Status Transition</h3>
            </div>
            <div className="p-5 grid grid-cols-3 gap-2">
              {['Online', 'Offline', 'Maintenance'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus || camera.status === s}
                  className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                    camera.status === s 
                      ? 'bg-amber-500 text-black border-amber-500 shadow-lg' 
                      : 'bg-white/5 text-dim border-white/5 hover:border-amber-500/30 hover:text-amber-400'
                  } disabled:opacity-50`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

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
                  onClick={() => window.print()}
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
                margin-bottom: 40px !important; 
                padding: 0 !important; 
                border-radius: 0 !important;
                page-break-inside: avoid;
              }
              
              .glass-panel > div:first-child {
                border-bottom: 1px solid #000 !important;
                padding: 10px 0 !important;
                margin-bottom: 20px !important;
                text-align: left;
              }
              
              .p-8 { padding: 0 !important; }
              
              .text-main, .text-dim, .text-blue-500, .text-secondary { 
                color: #000 !important; 
              }
              
              .border-blue-500\\/10 { 
                border-color: #000 !important; 
                margin-top: 30px !important;
                margin-bottom: 15px !important;
              }
              
              /* Professional Spacing for 'Letter Type' */
              .space-y-4 > * + * { margin-top: 12px !important; }
              
              .text-dim { 
                font-size: 11px !important;
                text-transform: uppercase !important;
                font-weight: 700 !important; 
                opacity: 0.8; 
              }
              .font-bold { font-weight: 700 !important; font-size: 13px !important; }
              .font-mono { font-family: 'SFMono-Regular', Consolas, monospace !important; font-size: 12px !important; }
              
              /* Official Footer */
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

      {/* Official Footer (Visible in PDF only) */}
      <div className="hidden print-only-footer">
        <p>© 2026 STARLIGHT CYBER | RATHINAM GROUP OF INSTITUTIONS | INFRASTRUCTURE AUDIT DIVISION</p>
        <p className="mt-1">This is a system-generated document. Unauthorized alteration is prohibited.</p>
      </div>
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
