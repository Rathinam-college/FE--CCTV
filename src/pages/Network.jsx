import { useState, useEffect } from 'react';
import api from '../services/api';
import { Activity, Server, Wifi, AlertTriangle, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Network() {
  const { user } = useAuthStore();
  const [cameras, setCameras] = useState([]);
  const [stats, setStats] = useState({ total: 0, online: 0, offline: 0 });

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const res = await api.get('/cameras/');
      const data = res.data;
      setCameras(data);
      
      const online = data.filter(c => c.status === 'Online').length;
      const offline = data.filter(c => c.status === 'Offline').length;
      setStats({ total: data.length, online, offline });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-3xl font-bold text-main tracking-tight">Network Details</h1>
        <p className="text-sm text-dim mt-1">Live ping diagnostics and IP routing topology</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="glass-panel p-6 flex items-center space-x-5 animate-slide-up delay-100 group hover:bg-white/5">
          <div className="p-4 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Server size={28} />
          </div>
          <div>
            <p className="text-xs text-dim font-semibold uppercase tracking-wider mb-1">Total Assets</p>
            <h3 className="text-3xl font-bold text-blue-400">{stats.total}</h3>
          </div>
        </div>
        
        <div className="glass-panel p-6 flex items-center space-x-5 animate-slide-up delay-200 group hover:bg-white/5">
          <div className="p-4 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Wifi size={28} />
          </div>
          <div>
            <p className="text-xs text-dim font-semibold uppercase tracking-wider mb-1">Active Pings</p>
            <h3 className="text-3xl font-bold text-emerald-400">{stats.online}</h3>
          </div>
        </div>
        
        <div className="glass-panel p-6 flex items-center space-x-5 animate-slide-up delay-300 group hover:bg-white/5">
          <div className="p-4 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-xs text-dim font-semibold uppercase tracking-wider mb-1">Lost Packets</p>
            <h3 className="text-3xl font-bold text-red-400">{stats.offline}</h3>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden animate-slide-up delay-300">
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
          <h2 className="font-semibold text-main flex items-center">
            <Cpu size={18} className="mr-3 text-blue-400" />
            IPv4 Address Matrix
          </h2>
          <div className="flex space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="p-5 text-xs font-semibold text-dim uppercase tracking-wider">Asset Signature</th>
                <th className="p-5 text-xs font-semibold text-dim uppercase tracking-wider">Logical Zone</th>
                <th className="p-5 text-xs font-semibold text-dim uppercase tracking-wider">IP Address</th>
                <th className="p-5 text-xs font-semibold text-dim uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cameras.map((camera) => (
                <tr key={camera._id || camera.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-5">
                    <div className="font-semibold text-main">{camera.cameraId}</div>
                    <div className="text-xs text-dim mt-0.5">{camera.name}</div>
                  </td>
                  <td className="p-5 text-sm text-dim">
                    <span className="px-2 py-1 bg-black/30 rounded border border-white/5">
                      {camera.siteName || camera.site || '—'}
                    </span>
                  </td>
                  <td className="p-5 font-mono text-sm text-blue-400">
                    {camera.ipAddress || camera.ip || 'DHCP / Unknown'}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center">
                      <div className={`h-2.5 w-2.5 rounded-full mr-3 ${
                        camera.status === 'Online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                        camera.status === 'Offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                        'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
                      }`}></div>
                      <span className={`text-sm font-medium ${
                        camera.status === 'Online' ? 'text-emerald-400' :
                        camera.status === 'Offline' ? 'text-red-400' :
                        'text-orange-400'
                      }`}>
                        {camera.status === 'Online' ? 'Tx/Rx Active' : camera.status === 'Offline' ? 'Request Timeout' : 'High Latency'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {cameras.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-12 text-center text-dim">
                    No network devices broadcasting.
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
