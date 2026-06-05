import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  History, User, Clock, Monitor, Globe, 
  Search, Filter, Download, Activity, Shield,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useActivityLogger } from '../hooks/useActivityLogger';

export default function ActivityLogs() {
  const { user } = useAuthStore();
  useActivityLogger('Activity Logs');
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showOnlyMyLogs, setShowOnlyMyLogs] = useState(user?.role !== 'Super Admin');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  useEffect(() => {
    fetchLogs();
  }, []);



  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras/logs/');
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (log.userEmail || '').toLowerCase().includes(q) ||
      (log.userName || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.page || '').toLowerCase().includes(q) ||
      (log.details || '').toLowerCase().includes(q) ||
      (log.ipAddress || '').toLowerCase().includes(q)
    );
    
    if (showOnlyMyLogs) {
      return matchesSearch && log.userEmail === user?.email;
    }
    return matchesSearch;
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'EDIT': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'DELETE': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'VIEW': return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <History className="mr-3 text-teal-500" size={32} />
            System Audit Logs
          </h1>
        </div>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setShowOnlyMyLogs(!showOnlyMyLogs)}
              className={`flex items-center px-4 py-2.5 text-xs font-bold uppercase tracking-widest border rounded-xl transition-all ${
                showOnlyMyLogs 
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-600' 
                  : 'bg-panel border-main text-secondary hover:text-main'
              }`}
            >
              <User size={14} className="mr-2" />
              {showOnlyMyLogs ? 'My Logs Only' : 'All System Logs'}
            </button>
            <button onClick={fetchLogs} className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium hover:bg-panel transition-all bg-card border-main">
              <Activity size={18} className="mr-2 text-teal-500" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden animate-slide-up">
        <div className="p-5 border-b border-main flex flex-col sm:flex-row gap-4 bg-panel/20">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dim" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by user, action, page, or details..."
              className="glass-input w-full pl-12 pr-4 py-2.5 text-sm"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 mr-2">
              <span className="text-[10px] font-black text-dim uppercase tracking-widest">Show</span>
              <select 
                value={itemsPerPage} 
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-panel border border-main rounded px-2 py-0.5 text-[10px] font-black text-main outline-none focus:border-teal-500 transition-colors"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center space-x-1">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[10px] font-bold text-dim uppercase tracking-tighter whitespace-nowrap">
                {Math.min((currentPage - 1) * itemsPerPage + 1, filteredLogs.length)}-{Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
              </span>
              <button 
                disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1 text-dim hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Timestamp</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">User Identity</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Action & Page</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Operation Details</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">IP Origin</th>
              </tr>
            </thead>
            <tbody className="divide-y border-main">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-20 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    <p className="mt-4 text-dim font-bold uppercase tracking-widest text-xs">Decrypting Audit Trails...</p>
                  </td>
                </tr>
              ) : filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center text-main text-xs font-medium">
                      <Clock size={14} className="mr-2 text-dim" />
                      {formatDate(log.timestamp)}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400 border border-blue-500/30 shadow-lg">
                        {log.userName?.substring(0, 2)?.toUpperCase() || '??'}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-main">{log.userName || 'Unknown'}</div>
                        <div className="text-[10px] text-dim font-medium">{log.userEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex flex-col space-y-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border w-fit ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-bold text-main flex items-center">
                        <Monitor size={12} className="mr-1.5 text-dim" />
                        {log.page}
                      </span>
                    </div>
                  </td>
                  <td className="p-5">
                    <p className="text-xs text-dim leading-relaxed italic max-w-md">
                      "{log.details || 'No extended metadata provided.'}"
                    </p>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center text-xs font-mono text-teal-500/70 bg-panel px-2 py-1 rounded border border-main w-fit">
                      <Globe size={12} className="mr-2 text-dim" />
                      {log.ipAddress || 'Intranet/VPN'}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-20 text-center">
                    <Shield size={48} className="mx-auto text-dim mb-4 opacity-30" />
                    <p className="text-dim font-bold uppercase tracking-widest text-xs">No audit logs found.</p>
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
