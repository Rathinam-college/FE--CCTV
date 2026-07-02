import { useState, useEffect } from 'react';
import api from '../services/api';
import { MapPin, Plus, CheckCircle, Clock } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function RoutesPage() {
  const { user } = useAuthStore();
  const [routes, setRoutes] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ date: '', technician: '', status: 'Pending', sitesToVisit: [{ siteName: '', status: 'Pending', remarks: '' }] });
  
  useEffect(() => {
    fetchRoutes();
    if (user?.role === 'Super Admin' || user?.role === 'Admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/routes/');
      let fetchedRoutes = res.data;
      if (user?.role === 'Staff') {
        fetchedRoutes = fetchedRoutes.filter(r => r.technician?._id === user._id || r.technician === user._id);
      }
      setRoutes(fetchedRoutes);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data.filter(u => u.role === 'Staff' || u.role === 'Technician'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/routes/', formData);
      setShowModal(false);
      setFormData({ date: '', technician: '', status: 'Pending', sitesToVisit: [{ siteName: '', status: 'Pending', remarks: '' }] });
      fetchRoutes();
    } catch (err) {
      console.error(err);
    }
  };

  const updateRouteStatus = async (routeId, newStatus) => {
    try {
      const route = routes.find(r => r._id === routeId);
      await api.put(`/routes/${routeId}/`, { ...route, status: newStatus });
      fetchRoutes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight">Deployment Routes</h1>
          <p className="text-sm text-dim mt-1">Manage technician field visits and routing schedules</p>
        </div>
        {(user?.role === 'Super Admin' || user?.role === 'Admin') && (
          <button onClick={() => setShowModal(true)} className="glass-button flex items-center px-5 py-2.5 text-sm font-medium">
            <Plus size={18} className="mr-2" />
            Dispatch Route
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {routes.map((route, idx) => (
          <div key={route._id} className={`glass-panel flex flex-col animate-slide-up delay-${(idx % 3 + 1) * 100} group hover:border-indigo-500/30 transition-all`}>
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/20 rounded-t-2xl">
              <div className="flex items-center space-x-3 text-main font-semibold">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30 group-hover:scale-110 transition-transform">
                  <RouteIcon size={18} />
                </div>
                <span>{new Date(route.date).toLocaleDateString()}</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${
                route.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                route.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' :
                'bg-orange-500/10 text-orange-400 border-orange-500/20'
              }`}>
                {route.status}
              </span>
            </div>
            
            <div className="p-5 flex-1">
              <div className="mb-6 p-4 bg-white/5 border border-white/5 rounded-xl">
                <p className="text-[10px] text-dim uppercase tracking-widest mb-1.5 font-semibold">Field Technician</p>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-main shadow-md">
                    {(route.technician?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-main">
                    {route.technician?.name || 'Unknown'}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] text-dim uppercase tracking-widest mb-3 font-semibold">Waypoint Trajectory</p>
                <div className="relative border-l-2 border-white/10 ml-3 space-y-5 pb-2">
                  {route.sitesToVisit?.map((site, idx) => (
                    <div key={idx} className="relative pl-6">
                      <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-gray-900 flex items-center justify-center ${
                        site.status === 'Completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-dim'
                      }`}>
                        {site.status === 'Completed' && <CheckCircle size={10} className="text-main" />}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${site.status === 'Completed' ? 'text-dim line-through' : 'text-main'}`}>{site.siteName}</p>
                        {site.remarks && <p className="text-xs text-dim mt-1 italic">{site.remarks}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-white/10 bg-black/20 rounded-b-2xl flex justify-end space-x-3">
              {route.status === 'Pending' && (
                <button onClick={() => updateRouteStatus(route._id, 'In Progress')} className="glass-button px-4 py-2 text-xs font-bold tracking-wide rounded-lg">
                  Initiate Deployment
                </button>
              )}
              {route.status === 'In Progress' && (
                <button onClick={() => updateRouteStatus(route._id, 'Completed')} className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 text-main shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 px-4 py-2 text-xs font-bold tracking-wide rounded-lg">
                  Confirm Completion
                </button>
              )}
            </div>
          </div>
        ))}
        {routes.length === 0 && (
          <div className="col-span-full p-12 text-center glass-panel">
            <RouteIcon size={48} className="mx-auto text-dim mb-4 opacity-50" />
            <p className="text-dim">No active deployment routes found.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-lg overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h2 className="text-xl font-bold text-main">Generate Route Manifest</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-semibold text-dim uppercase tracking-widest mb-2">Deployment Date</label>
                <input required type="datetime-local" name="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="glass-input w-full p-3" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dim uppercase tracking-widest mb-2">Assign Technician</label>
                <select required name="technician" value={formData.technician} onChange={(e) => setFormData({...formData, technician: e.target.value})} className="glass-input w-full p-3 [&>option]:bg-gray-900 [&>option]:text-main">
                  <option value="">Select Technician</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                  <label className="text-xs font-semibold text-dim uppercase tracking-widest">Target Waypoints</label>
                  <button type="button" onClick={() => setFormData({...formData, sitesToVisit: [...formData.sitesToVisit, { siteName: '', status: 'Pending', remarks: '' }]})} className="text-xs text-blue-400 hover:text-blue-300 font-bold tracking-wider">
                    + ADD SITE
                  </button>
                </div>
                <div className="space-y-4">
                  {formData.sitesToVisit.map((site, index) => (
                    <div key={index} className="flex space-x-3 items-center relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dim">
                        <MapPin size={16} />
                      </div>
                      <input required type="text" placeholder="Designation Name" value={site.siteName} onChange={(e) => {
                        const newSites = [...formData.sitesToVisit];
                        newSites[index].siteName = e.target.value;
                        setFormData({...formData, sitesToVisit: newSites});
                      }} className="glass-input w-full !pl-10 pr-4 py-2 text-sm" />
                      {formData.sitesToVisit.length > 1 && (
                        <button type="button" onClick={() => {
                          const newSites = [...formData.sitesToVisit];
                          newSites.splice(index, 1);
                          setFormData({...formData, sitesToVisit: newSites});
                        }} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-white/10">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 text-sm font-bold tracking-wide text-dim hover:text-main hover:bg-white/10 rounded-xl transition-colors">
                  CANCEL
                </button>
                <button type="submit" className="glass-button px-6 py-2 text-sm font-bold tracking-wide">
                  DISPATCH
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
