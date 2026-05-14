import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  History, 
  MapPin, 
  Clock, 
  Search, 
  Filter, 
  Activity, 
  User, 
  ArrowRight,
  ExternalLink,
  Shield,
  RefreshCw,
  Camera,
  HardDrive,
  Fingerprint,
  Zap
} from 'lucide-react';
import { useNotificationStore } from '../store/notificationStore';

export default function MoveHistory() {
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');

  useEffect(() => {
    fetchMoveHistory();
  }, []);

  const fetchMoveHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras/move-history/');
      setMoves(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch move history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredMoves = moves.filter(move => {
    const matchesSearch = 
      move.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      move.remark.toLowerCase().includes(searchQuery.toLowerCase()) ||
      move.user.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'All' || move.deviceType === filterType;
    
    return matchesSearch && matchesType;
  });

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'Camera': return <Camera size={14} className="text-blue-400" />;
      case 'NVR': return <HardDrive size={14} className="text-amber-400" />;
      case 'Biometric': return <Fingerprint size={14} className="text-rose-400" />;
      case 'Switch': return <Zap size={14} className="text-emerald-400" />;
      default: return <Activity size={14} className="text-dim" />;
    }
  };

  const getDeviceLink = (move) => {
    switch (move.deviceType) {
      case 'Camera': return `/devices/cameras/${move.dbId}`;
      case 'NVR': return `/devices/nvr/${move.dbId}`;
      case 'Biometric': return `/devices/biometrics/${move.dbId}`;
      case 'Switch': return `/devices/switches/${move.dbId}`;
      default: return '#';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <MapPin className="mr-3 text-blue-400" size={32} />
            Asset Move History
          </h1>
          <p className="text-sm text-dim mt-1">Track chronological relocation and network updates across all infrastructure</p>
        </div>
        <button 
          onClick={fetchMoveHistory} 
          className="glass-panel flex items-center px-5 py-2.5 text-sm font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-blue-400 border-blue-500/20"
        >
          <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </button>
      </div>

      <div className="glass-panel overflow-hidden animate-slide-up">
        {/* Filters */}
        <div className="p-5 border-b border-white/10 flex flex-col md:flex-row gap-4 bg-white/5">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dim" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by device, remark, or user..."
              className="glass-input w-full pl-12 pr-4 py-2.5 text-sm"
            />
          </div>
          <div className="flex items-center space-x-3">
            <Filter size={18} className="text-dim hidden sm:block" />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="glass-input px-4 py-2.5 text-sm min-w-[150px]"
            >
              <option value="All">All Device Types</option>
              <option value="Camera">Cameras</option>
              <option value="NVR">NVRs</option>
              <option value="Biometric">Biometrics</option>
              <option value="Switch">Network Switches</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/10 text-dim">
                <th className="p-5 text-xs font-bold uppercase tracking-wider">Date & Time</th>
                <th className="p-5 text-xs font-bold uppercase tracking-wider">Target Device</th>
                <th className="p-5 text-xs font-bold uppercase tracking-wider">Relocation Details</th>
                <th className="p-5 text-xs font-bold uppercase tracking-wider">Action By</th>
                <th className="p-5 text-xs font-bold uppercase tracking-wider text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-20 text-center">
                    <RefreshCw className="mx-auto h-8 w-8 text-blue-500 animate-spin mb-4" />
                    <p className="text-dim font-bold uppercase tracking-widest text-xs">Accessing historical archives...</p>
                  </td>
                </tr>
              ) : filteredMoves.length > 0 ? (
                filteredMoves.map((move) => (
                  <tr key={move.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center text-main text-xs font-medium">
                        <Clock size={14} className="mr-2 text-dim" />
                        {new Date(move.timestamp).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 bg-white/5`}>
                          {getDeviceIcon(move.deviceType)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-main">{move.deviceName}</div>
                          <div className="text-[10px] text-dim font-bold uppercase tracking-widest">{move.deviceType} • {move.deviceId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="text-xs text-dim bg-white/5 border border-white/5 p-3 rounded-xl max-w-lg leading-relaxed">
                        {move.remark}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center text-xs font-bold text-blue-400">
                        <User size={14} className="mr-2 text-dim" />
                        {move.user}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => navigate(getDeviceLink(move))}
                        className="p-2 text-dim hover:text-main hover:bg-white/10 rounded-lg transition-all"
                      >
                        <ExternalLink size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-20 text-center">
                    <History size={48} className="mx-auto text-dim mb-4 opacity-30" />
                    <p className="text-dim font-bold uppercase tracking-widest text-xs">No relocation history found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
