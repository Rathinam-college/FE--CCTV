import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Camera, Server, Fingerprint, Lock, ArrowLeft, MapPin, Database, Wifi, HardDrive, AlertTriangle, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function DeviceDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDeviceDetails();
  }, [type, id]);

  const fetchDeviceDetails = async () => {
    try {
      let url = `/cameras/${id}/`;
      if (type === 'nvrs') url = `/cameras/nvrs/${id}/`;
      if (type === 'biometrics') url = `/cameras/biometrics/${id}/`;
      if (type === 'barriers') url = `/cameras/barriers/${id}/`;

      const res = await api.get(url);
      setDevice(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch device telemetry details.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="max-w-md mx-auto mt-10 glass-panel p-6 text-center border-red-500/20 shadow-sm">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-main">Error Resolving Node</h3>
        <p className="text-secondary text-sm mt-2">{error || 'Hardware target lost.'}</p>
        <button onClick={() => navigate(-1)} className="glass-button px-4 py-2 mt-6 flex items-center justify-center mx-auto">
          <ArrowLeft size={16} className="mr-2" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center text-sm text-secondary hover:text-main transition-colors">
          <ArrowLeft size={18} className="mr-2" /> Back to Master Control
        </button>
        <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-extrabold border ${
          device.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
        }`}>
          {device.status}
        </span>
      </div>

      {/* Core Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Box - Main Metric Overview */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden min-h-[220px] border-main bg-card shadow-sm">
            <div className="flex items-start justify-between z-10">
              <div>
                <span className="text-xs text-secondary font-bold uppercase tracking-widest bg-panel px-2.5 py-1 rounded-md border border-main">{type?.toUpperCase()?.slice(0, -1) || 'DEVICE'} Details</span>
                <h2 className="text-3xl font-black text-main mt-4 tracking-tight">{device.name}</h2>
                <p className="text-sm text-teal-600 font-mono mt-1 flex items-center"><Wifi size={14} className="mr-1.5 shrink-0" /> {device.ipAddress}</p>
              </div>
              <div className="p-4 bg-panel border border-main rounded-2xl text-teal-600">
                {type === 'cameras' && <Camera size={36} />}
                {type === 'nvrs' && <Server size={36} className="text-teal-600" />}
                {type === 'biometrics' && <Fingerprint size={36} className="text-teal-600" />}
                {type === 'barriers' && <Lock size={36} className="text-teal-600" />}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-main z-10 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <MapPin className="text-secondary shrink-0" size={16} />
                <span className="text-secondary"><span className="text-secondary text-xs block uppercase tracking-wider font-bold">Location</span> {device.location || device.siteName || 'Deployment Zone'}</span>
              </div>
            </div>
            
            {/* Subtle Background Shape */}
            <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* Dynamic Module Context Fields */}
          <div className="glass-panel p-6">
            <h3 className="text-base font-bold text-main mb-4 flex items-center tracking-wide"><Database className="text-blue-400 mr-2" size={18} /> Technical Specifications</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-mono">
              {type === 'cameras' && (
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">BRAND/MODEL:</span>
                    <span className="text-main font-bold">{device.brand || '—'}</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">RECORDING STREAM:</span>
                    <span className="text-blue-400 font-bold">{device.recordingStatus || 'OFF'}</span>
                  </div>
                </>
              )}

              {type === 'nvrs' && (
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">CHANNELS CONNECTED:</span>
                    <span className="text-main font-bold">{device.channels || '—'} Total / {device.connectedCameras || '0'} Active</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">DISK ALLOCATION:</span>
                    <span className="text-indigo-400 font-bold flex items-center"><HardDrive size={14} className="mr-1" /> {device.hardDisk} ({device.storageStatus})</span>
                  </div>
                </>
              )}

              {type === 'biometrics' && (
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">AUTHENTICATION:</span>
                    <span className="text-purple-400 font-bold">{device.type}</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">SYNC FREQUENCY:</span>
                    <span className="text-main font-bold flex items-center"><Cpu size={14} className="mr-1" /> {device.syncStatus}</span>
                  </div>
                </>
              )}

              {type === 'barriers' && (
                <>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">GATE LOGIC:</span>
                    <span className={`font-extrabold ${device.gateStatus === 'Open' ? 'text-emerald-400' : 'text-indigo-400'}`}>{device.gateStatus}</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                    <span className="text-dim text-xs">SYSTEM CONTROLLER:</span>
                    <span className="text-main font-bold">{device.controller || 'UNKNOWN'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Status Logs */}
        <div className="space-y-6">
          <div className="glass-panel p-5">
            <h4 className="text-xs font-extrabold text-dim uppercase tracking-wider mb-4">Operational Health</h4>
            <div className="space-y-2 text-xs text-dim">
              <p className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between">
                <span>Hardware Uptime:</span> <span className="text-emerald-400 font-bold">99.8%</span>
              </p>
              <p className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between">
                <span>Last Diagnostic:</span> <span className="text-dim">Completed Today</span>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
