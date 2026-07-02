import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  ArrowLeft, 
  History, 
  Clock, 
  User, 
  MapPin, 
  MessageSquare, 
  Activity,
  Download,
  Shield,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  FileText
} from 'lucide-react';

export default function DeviceHistory() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const downloadExcel = () => {
    const filename = `HISTORY_${device.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = [
      ['ASSET AUDIT ARCHIVE - ' + device.name.toUpperCase()],
      ['Generated On', new Date().toLocaleString()],
      ['Device Type', type.toUpperCase()],
      [''],
      ['DATE', 'TIME', 'USER', 'TYPE', 'REMARK / ACTIVITY']
    ];

    unifiedActivity.forEach(item => {
      rows.push([
        item.date,
        item.time || '00:00',
        item.userName || 'System',
        item.type.toUpperCase(),
        item.remark
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(row => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchHistory();
  }, [id, type]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (type) {
        case 'camera': endpoint = `/cameras/${id}/`; break;
        case 'nvr': endpoint = `/cameras/nvrs/${id}/`; break;
        case 'biometric': endpoint = `/cameras/biometrics/${id}/`; break;
        case 'switch': endpoint = `/cameras/switches/${id}/`; break;
        default: throw new Error('Invalid device type');
      }
      const res = await api.get(endpoint);
      setDevice(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch historical data archives.');
      setLoading(false);
    }
  };

  const unifiedActivity = useMemo(() => {
    if (!device) return [];
    
    const logs = (device.message_history || []).map(log => ({
      ...log,
      type: 'log',
      timestamp: new Date(`${log.date} ${log.time || '00:00'}`).getTime()
    }));

    const moves = (device.relocations || []).map(move => ({
      ...move,
      type: 'move',
      remark: `Asset relocated from ${move.old_location} to ${move.new_location}`,
      timestamp: new Date(`${move.date} 00:00`).getTime()
    }));

    return [...logs, ...moves]
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter(item => {
        const q = searchQuery.toLowerCase();
        return (
          (item.remark || '').toLowerCase().includes(q) ||
          (item.userName || '').toLowerCase().includes(q) ||
          (item.date || '').toLowerCase().includes(q)
        );
      });
  }, [device, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute top-0 w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-dim font-bold animate-pulse text-xs uppercase tracking-widest text-center">
          Accessing Immutable Audit Archive...<br/>
          <span className="text-[10px] opacity-60">Reconstructing Temporal Logs</span>
        </p>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="max-w-md mx-auto mt-20 glass-panel p-8 text-center border-red-500/20">
        <Shield size={48} className="mx-auto text-red-400 mb-6" />
        <h3 className="text-xl font-bold text-main mb-2">Protocol Interrupted</h3>
        <p className="text-dim text-sm mb-8 leading-relaxed">{error || 'Unable to decrypt historical data for this asset.'}</p>
        <button onClick={() => navigate(-1)} className="w-full glass-button py-3 flex items-center justify-center">
          <ArrowLeft size={18} className="mr-2" /> Resume Previous Operation
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-[0.2em] text-dim">
            <button onClick={() => navigate(-1)} className="hover:text-blue-400 transition-colors flex items-center">
              <ArrowLeft size={12} className="mr-1" /> BACK TO ASSET
            </button>
            <ChevronRight size={10} />
            <span className="text-blue-400">MASTER AUDIT LOG</span>
          </div>
          <h1 className="text-4xl font-black text-main uppercase tracking-tight flex items-center">
            <History className="mr-4 text-blue-500" size={36} />
            Temporal History
          </h1>
          <p className="text-sm text-dim font-medium">
            Complete chronological audit trail for <span className="text-main font-bold">{device.name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={downloadExcel}
            className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg"
          >
            <Download size={16} />
            <span>Excel Export</span>
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg"
          >
            <FileText size={16} />
            <span>PDF Archive</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 bg-blue-500/5 border-blue-500/20">
          <p className="text-[10px] font-black text-dim uppercase tracking-widest mb-1">Total Entries</p>
          <p className="text-2xl font-black text-main tracking-tight">{unifiedActivity.length}</p>
        </div>
        <div className="glass-panel p-5 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-[10px] font-black text-dim uppercase tracking-widest mb-1">Relocations</p>
          <p className="text-2xl font-black text-main tracking-tight">
            {unifiedActivity.filter(i => i.type === 'move').length}
          </p>
        </div>
        <div className="glass-panel p-5 bg-amber-500/5 border-amber-500/20">
          <p className="text-[10px] font-black text-dim uppercase tracking-widest mb-1">Last Log Date</p>
          <p className="text-2xl font-black text-main tracking-tight">
            {unifiedActivity[0]?.date || '—'}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="glass-panel p-4 bg-white/[0.02] border-white/5 flex items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" size={18} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter archive by remark, user, or date..."
            className="glass-input w-full !pl-12 pr-4 py-3 text-sm"
          />
        </div>
      </div>

      {/* Main Timeline */}
      <div className="relative space-y-6">
        <div className="absolute top-0 bottom-0 left-[27px] md:left-[147px] w-px bg-white/10"></div>
        
        {unifiedActivity.length > 0 ? (
          unifiedActivity.map((log, i) => (
            <div key={i} className="relative flex flex-col md:flex-row md:items-start group">
              {/* Date Column (Desktop) */}
              <div className="hidden md:block w-32 pt-2 pr-8 text-right">
                <p className="text-[10px] font-black text-dim uppercase tracking-widest">{log.date}</p>
                <p className="text-[9px] text-dim/60 font-bold">{log.time || '00:00'}</p>
              </div>

              {/* Marker */}
              <div className={`absolute left-[15px] md:left-[135px] top-2 w-6 h-6 rounded-full bg-card border-2 ${
                log.type === 'move' ? 'border-emerald-500' : 'border-blue-500'
              } z-10 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
                {log.type === 'move' ? <MapPin size={10} className="text-emerald-500" /> : <MessageSquare size={10} className="text-blue-500" />}
              </div>

              {/* Content Card */}
              <div className="ml-12 md:ml-12 flex-1 pb-8">
                <div className="glass-panel p-6 bg-card/40 hover:bg-card/60 transition-all border-white/5 hover:border-white/10 group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <User size={14} className="text-dim" />
                        <p className="text-xs font-black text-main uppercase tracking-wide">{log.userName || 'System Protocol'}</p>
                        {log.type === 'move' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tighter border border-emerald-500/20">RELOCATION</span>
                        )}
                      </div>
                      <p className="md:hidden text-[9px] font-bold text-dim uppercase tracking-widest mb-2">{log.date} • {log.time || '00:00'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-dim leading-relaxed font-medium">
                    {log.remark}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="glass-panel p-20 text-center border-dashed border-white/10">
            <Activity size={48} className="mx-auto text-dim/20 mb-6" />
            <h3 className="text-lg font-bold text-dim uppercase tracking-widest">No Log Entries Found</h3>
            <p className="text-sm text-dim/60 mt-2">The historical archive for this asset is currently empty.</p>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .glass-panel { border: none !important; background: white !important; color: black !important; box-shadow: none !important; }
          .text-main, .text-dim, .text-blue-500 { color: black !important; }
          button, nav, .Search { display: none !important; }
          body { background: white !important; }
        }
      `}} />
    </div>
  );
}
