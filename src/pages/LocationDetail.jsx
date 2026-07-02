import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Camera, 
  Map, 
  ArrowLeft, 
  Search, 
  Filter, 
  Building, 
  Database, 
  Wifi, 
  Shield, 
  ExternalLink,
  ChevronRight,
  Download,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function LocationDetail() {
  const { locationName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const parseSiteName = (siteName) => {
    if (!siteName) return { block: '', floor: '' };
    const parts = siteName.split(' - ');
    return { block: parts[0] || '', floor: parts[1] || '' };
  };

  const parseNetworkDetails = (details) => {
    if (!details) return { ipv4Gateway: '', subnetMask: '', macAddress: '', divisionName: '' };
    const gwMatch = details.match(/Gateway:\s*([^|]+)/);
    const subMatch = details.match(/Subnet:\s*([^|]+)/);
    const macMatch = details.match(/MAC:\s*([^|]+)/);
    const collMatch = details.match(/College:\s*([^|]+)/);
    return {
      ipv4Gateway: gwMatch ? gwMatch[1].trim() : '',
      subnetMask: subMatch ? subMatch[1].trim() : '',
      macAddress: macMatch ? macMatch[1].trim() : '',
      divisionName: collMatch ? collMatch[1].trim() : ''
    };
  };

  const isOutside = (site, zone) => {
    if (zone) return zone === 'OUTSIDE';
    if (!site) return false;
    const s = site.toLowerCase();
    return s.includes('gate') || s.includes('outside') || s.includes('perimeter') || s.includes('road') || s.includes('external') || s.includes('parking') || s.includes('boundary');
  };

  const exportToExcel = () => {
    const headers = [
      'S.No', 'Division Name', 'Block', 'Floor', 'Campus Zone', 
      'Device Type', 'IP Address', 'IPv4 Gateway', 
      'Serial Number', 'Subnet Mask', 'MAC Address', 'Status'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const dataRows = filteredCameras.map((camera, idx) => {
      const { block, floor } = parseSiteName(camera.siteName);
      const { ipv4Gateway, subnetMask, macAddress, divisionName } = parseNetworkDetails(camera.dvrNvrDetails);
      const zone = camera.campusZone || (isOutside(camera.siteName) ? 'OUTSIDE' : 'INSIDE');
      
      return [
        idx + 1,
        escapeCSV(divisionName || 'N/A'),
        escapeCSV(block || 'N/A'),
        escapeCSV(floor || 'N/A'),
        escapeCSV(zone),
        escapeCSV(camera.name || 'N/A'),
        escapeCSV(camera.ipAddress || ''),
        escapeCSV(ipv4Gateway || ''),
        escapeCSV(camera.cameraId || ''),
        escapeCSV(subnetMask || ''),
        escapeCSV(macAddress || ''),
        escapeCSV(camera.status || '')
      ];
    });

    const csvContent = "\uFEFF" + [ 
      headers.join(","), 
      ...dataRows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    let fileName = `CCTV_Inventory_${locationName.replace(/\s+/g, '_')}`;
    if (statusFilter !== 'ALL') fileName += `_${statusFilter}`;
    fileName += `_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Exported ${filteredCameras.length} records successfully`);
  };

  useEffect(() => {
    fetchLocationCameras();
  }, [locationName]);

  const fetchLocationCameras = async () => {
    setLoading(true);
    try {
      const res = await api.get('/cameras/');
      // Filter by the location name from URL
      const locationCameras = res.data.filter(c => c.siteName === locationName);
      setCameras(locationCameras);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const filteredCameras = useMemo(() => {
    let filtered = cameras;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.name || '').toLowerCase().includes(q) ||
        (c.ipAddress || '').toLowerCase().includes(q) ||
        (c.cameraId || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [cameras, statusFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: cameras.length,
    online: cameras.filter(c => c.status === 'Online').length,
    offline: cameras.filter(c => c.status === 'Offline').length,
  }), [cameras]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="w-16 h-16 border-4 border-teal-500/20 rounded-full"></div>
        <div className="absolute top-0 w-16 h-16 border-4 border-teal-500 rounded-full border-t-transparent animate-spin"></div>
        <p className="text-secondary font-bold animate-pulse text-xs uppercase tracking-widest">Scanning Building Network...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-secondary">
        <button onClick={() => navigate('/dashboard')} className="hover:text-main transition-colors">DASHBOARD</button>
        <ChevronRight size={12} />
        <button onClick={() => navigate('/cameras')} className="hover:text-main transition-colors">CAMERAS</button>
        <ChevronRight size={12} />
        <span className="text-teal-600">{locationName}</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-teal-500/10 rounded-2xl text-teal-600 border border-teal-500/20 shadow-xl">
            <Building size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-main tracking-tight">{locationName}</h1>
            <p className="text-sm text-secondary mt-1 flex items-center">
              <Map size={14} className="mr-2" /> Detailed Building Inventory & Surveillance Asset Map
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button onClick={exportToExcel} className="glass-panel flex items-center px-5 py-2.5 text-xs font-bold uppercase tracking-widest bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-lg">
            <Download size={16} className="mr-2" /> Download Excel
          </button>
          <button onClick={() => navigate('/cameras')} className="glass-button flex items-center px-5 py-2.5 text-xs font-bold uppercase tracking-widest">
            <ArrowLeft size={16} className="mr-2" /> Back
          </button>
        </div>
      </div>

      {/* Building Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-5 border border-main rounded-2xl">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-main">{stats.total}</p>
        </div>
        <div className="bg-card p-5 border border-main rounded-2xl">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Online Now</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.online}</p>
        </div>
        <div className="bg-card p-5 border border-main rounded-2xl">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Issues/Offline</p>
          <p className="text-2xl font-bold text-orange-600">{stats.offline}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-panel p-4 border border-main rounded-2xl flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-secondary" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Device, IP, or ID..."
            className="glass-input w-full !pl-12 pr-4 py-2.5 text-sm bg-card border-main focus:border-teal-500"
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'Online', 'Offline'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${statusFilter === s ? 'bg-teal-500 text-white border-teal-500 shadow-lg shadow-teal-500/20' : 'bg-card border-main text-secondary hover:text-main'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-card overflow-hidden border border-main rounded-2xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest">Device Details</th>
                <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-center">Network Status</th>
                <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest">IP Configuration</th>
                <th className="p-4 text-[10px] font-bold text-secondary uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCameras.map((camera) => (
                <tr key={camera.id || camera._id} className="hover:bg-panel transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${camera.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                        <Camera size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-main group-hover:text-teal-600 transition-colors">{camera.name}</p>
                        <p className="text-[10px] font-mono text-secondary uppercase tracking-tighter">{camera.cameraId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      camera.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }`}>
                      {camera.status === 'Online' ? 'OPERATIONAL' : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-xs font-mono text-secondary">
                        <Wifi size={10} className="mr-1.5 text-teal-600" /> {camera.ipAddress}
                      </div>
                      <p className="text-[10px] text-secondary font-medium">Port Forwarding Active</p>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => navigate(`/devices/cameras/${camera._id || camera.id}`)}
                      className="p-2 bg-panel border border-main rounded-lg text-secondary hover:text-teal-600 transition-all shadow-lg"
                    >
                      <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCameras.length === 0 && (
            <div className="p-20 text-center">
              <AlertCircle size={48} className="mx-auto text-dim mb-4" />
              <p className="text-dim font-bold text-sm uppercase tracking-widest">No matching assets in this building</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
