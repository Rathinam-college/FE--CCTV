import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Network, Server, Cctv as CctvIcon, Plus, X, Search, ChevronLeft, Database } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

export default function NvrCameraMapping() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  
  const [nvrs, setNvrs] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNvr, setSelectedNvr] = useState(null);
  
  const [assignSearch, setAssignSearch] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Storage:EDIT') || user?.permissions?.includes('Assets:EDIT');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [nvrRes, camRes] = await Promise.all([
        api.get('/cameras/nvrs/'),
        api.get('/cameras/')
      ]);
      setNvrs(nvrRes.data || []);
      setCameras(camRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      showNotification('Failed to load mapping data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCamera = async (camera) => {
    try {
      const currentNvrs = camera.dvrNvrDetails ? camera.dvrNvrDetails.split(',').map(n => n.trim()).filter(Boolean) : [];
      if (!currentNvrs.includes(selectedNvr.nvrName)) {
        currentNvrs.push(selectedNvr.nvrName);
      }
      
      await api.put(`/cameras/${camera.id}/`, {
        ...camera,
        dvrNvrDetails: currentNvrs.join(', ')
      });
      showNotification('Camera linked to NVR', 'success');
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Error assigning camera:', err);
      showNotification('Failed to link camera', 'error');
    }
  };

  const handleRemoveCamera = async (camera) => {
    try {
      const currentNvrs = camera.dvrNvrDetails ? camera.dvrNvrDetails.split(',').map(n => n.trim()).filter(Boolean) : [];
      const newNvrs = currentNvrs.filter(n => n !== selectedNvr.nvrName);

      await api.put(`/cameras/${camera.id}/`, {
        ...camera,
        dvrNvrDetails: newNvrs.join(', ')
      });
      showNotification('Camera unlinked from NVR', 'success');
      fetchData();
    } catch (err) {
      console.error('Error unlinking camera:', err);
      showNotification('Failed to unlink camera', 'error');
    }
  };

  const mappedCameras = useMemo(() => {
    if (!selectedNvr) return [];
    return cameras.filter(c => {
      if (!c.dvrNvrDetails) return false;
      const nvrList = c.dvrNvrDetails.split(',').map(n => n.trim()).filter(Boolean);
      return nvrList.includes(selectedNvr.nvrName);
    });
  }, [cameras, selectedNvr]);

  const filteredAllCameras = useMemo(() => {
    const term = assignSearch.toLowerCase();
    return cameras.filter(c => 
      c.name?.toLowerCase().includes(term) || c.cameraId?.toLowerCase().includes(term)
    );
  }, [cameras, assignSearch]);

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-secondary font-black uppercase tracking-[0.4em] animate-pulse">Syncing Network Topology...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 border-b border-main pb-6">
        <div>
          <button onClick={() => navigate('/nvr')} className="flex items-center text-xs font-black uppercase tracking-widest text-dim hover:text-main transition-colors mb-2">
            <ChevronLeft size={14} className="mr-1" /> Back to Storage
          </button>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Network className="mr-3 text-emerald-500" size={28} />
            NVR Mapping
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* NVR List Sidebar */}
        <div className="glass-panel p-6 bg-panel border border-main rounded-3xl h-[600px] flex flex-col">
          <h3 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Storage Assets</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {nvrs.map(nvr => {
               const count = cameras.filter(c => {
                 if (!c.dvrNvrDetails) return false;
                 return c.dvrNvrDetails.split(',').map(n => n.trim()).filter(Boolean).includes(nvr.nvrName);
               }).length;
               return (
                <div 
                  key={nvr.id} 
                  onClick={() => setSelectedNvr(nvr)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedNvr?.id === nvr.id 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-card border-main hover:border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Server size={16} className={selectedNvr?.id === nvr.id ? 'text-emerald-400' : 'text-dim'} />
                      <span className="ml-2 text-sm font-bold text-main">{nvr.nvrName}</span>
                    </div>
                    <span className="text-[10px] font-black text-secondary bg-panel px-2 py-1 rounded-full border border-main">{count}</span>
                  </div>
                  <p className="text-[9px] font-black text-dim uppercase tracking-widest mt-2 ml-6">{nvr.ipAddress || 'No IP'}</p>
                </div>
               );
            })}
          </div>
        </div>

        {/* Camera Mapping Area */}
        <div className="lg:col-span-3">
          {selectedNvr ? (
            <div className="glass-panel p-8 bg-card border border-main rounded-3xl h-[600px] flex flex-col relative">
              <div className="flex justify-between items-center mb-6 border-b border-main pb-4">
                <div>
                  <h2 className="text-xl font-bold text-main flex items-center">
                    <Database className="mr-2 text-emerald-500" size={20} />
                    {selectedNvr.nvrName} Topology
                  </h2>
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1">Manage connected endpoints</p>
                </div>
                {canEdit && (
                  <button 
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Plus size={16} className="mr-2" /> Assign Camera
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {mappedCameras.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-dim">
                    <CctvIcon size={48} className="opacity-20 mb-4" />
                    <p className="text-sm font-bold">No cameras mapped to this NVR</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr>
                        <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest border-b border-main">Identity ID</th>
                        <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest border-b border-main">Camera Name</th>
                        <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest border-b border-main">IP Address</th>
                        <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest border-b border-main text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-main">
                      {mappedCameras.map(cam => (
                        <tr key={cam.id} className="hover:bg-panel/50 transition-colors">
                          <td className="p-4 text-xs font-mono font-bold text-emerald-400">{cam.cameraId || 'N/A'}</td>
                          <td className="p-4 text-xs font-bold text-main flex items-center">
                            <CctvIcon size={14} className="mr-2 text-dim" />
                            {cam.name}
                          </td>
                          <td className="p-4 text-xs text-dim font-mono">{cam.ipAddress || '0.0.0.0'}</td>
                          <td className="p-4 text-right">
                            {canEdit && (
                              <button 
                                onClick={() => handleRemoveCamera(cam)}
                                className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-full transition-colors border border-rose-500/20"
                              >
                                Unlink
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 bg-panel border border-main rounded-3xl h-[600px] flex items-center justify-center">
              <div className="text-center">
                <Server size={64} className="mx-auto text-main opacity-10 mb-6" />
                <h3 className="text-xl font-bold text-main">Select an NVR</h3>
                <p className="text-xs text-secondary mt-2 max-w-sm mx-auto">Choose an NVR from the sidebar to view or manage its connected cameras.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-main rounded-[2rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-main flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-main">Link Camera to {selectedNvr?.nvrName}</h2>
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1">Select from unassigned assets</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-dim hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 border-b border-main bg-panel/30">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-dim" />
                <input 
                  type="text" 
                  placeholder="Search by name or Identity ID..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full bg-card border border-main rounded-xl py-3 pl-10 pr-4 text-sm text-main placeholder-dim focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {filteredAllCameras.length === 0 ? (
                <div className="p-8 text-center text-dim text-sm">No cameras found matching search.</div>
              ) : (
                <div className="space-y-1">
                  {filteredAllCameras.map(cam => {
                    const currentNvrs = cam.dvrNvrDetails ? cam.dvrNvrDetails.split(',').map(n => n.trim()).filter(Boolean) : [];
                    const isLinked = currentNvrs.includes(selectedNvr?.nvrName);
                    
                    return (
                    <div key={cam.id} className="flex items-center justify-between p-4 hover:bg-panel rounded-xl transition-colors group">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isLinked ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                          <CctvIcon size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-main">{cam.name}</p>
                          <p className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center space-x-2">
                            <span className={isLinked ? "text-emerald-400" : "text-blue-400"}>ID: {cam.cameraId || 'N/A'}</span>
                            <span>•</span>
                            <span className="text-dim">{cam.ipAddress || '0.0.0.0'}</span>
                            {currentNvrs.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-500">Linked to {currentNvrs.length} NVR(s)</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => isLinked ? handleRemoveCamera(cam) : handleAssignCamera(cam)}
                        className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all border ${
                          isLinked 
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500 hover:text-white' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-white'
                        }`}
                      >
                        {isLinked ? 'Unlink' : 'Link'}
                      </button>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
