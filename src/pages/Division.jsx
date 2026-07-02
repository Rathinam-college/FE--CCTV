import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { Building, Plus, Trash2, ShieldAlert, X, Cctv, Server, Fingerprint, Network, ChevronRight, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useSiteStore } from '../store/siteStore';

export default function Division() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const navigate = useNavigate();
  
  const [Divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { allLocations, fetchAllLocations, divisions, fetchDivisions } = useSiteStore();
  
  const [formData, setFormData] = useState({
    division_type: 'Division'
  });
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [masterName, setMasterName] = useState('');
  const [showModal, setShowModal] = useState(false);

  // New States for Detail View
  const [activeDivisionName, setActiveDivisionName] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('ALL');

  const canView = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:VIEW'));
  const canEdit = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:EDIT'));

  const uniqueTypes = useMemo(() => {
    const types = new Set(Divisions.map(occ => occ.division_type).filter(Boolean));
    if (!types.has('Division')) types.add('Division');
    if (!types.has('IT Company')) types.add('IT Company');
    return Array.from(types);
  }, [Divisions]);

  const uniqueOldColleges = useMemo(() => {
    const colleges = new Set([
      ...(divisions ? divisions.map(loc => loc.name) : []),
      ...Divisions.map(occ => occ.name)
    ].filter(Boolean));
    return Array.from(colleges);
  }, [allLocations, Divisions]);

  const availableColleges = useMemo(() => {
    return uniqueOldColleges.filter(c => 
      !selectedNames.includes(c) && c.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [uniqueOldColleges, selectedNames, inputValue]);

  const handleAddName = (name) => {
    const trimmed = name.trim();
    if (trimmed && !selectedNames.includes(trimmed)) {
      setSelectedNames([...selectedNames, trimmed]);
    }
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const handleRemoveName = (name) => {
    setSelectedNames(selectedNames.filter(n => n !== name));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddName(inputValue);
    }
  };

  useEffect(() => {
    if (canView) {
      fetchLocalDivisions();
      fetchDivisions();
      fetchAllLocations();
      fetchDevices();
    }
  }, [canView]);

  const fetchDevices = async () => {
    try {
      const [camRes, nvrRes, bioRes, swRes] = await Promise.all([
        api.get('/cameras/').catch(() => ({ data: [] })),
        api.get('/cameras/nvrs/').catch(() => ({ data: [] })),
        api.get('/cameras/biometrics/').catch(() => ({ data: [] })),
        api.get('/cameras/switches/').catch(() => ({ data: [] }))
      ]);
      const cams = (camRes.data || []).map(d => ({ ...d, deviceType: 'Camera' }));
      const nvrs = (nvrRes.data || []).map(d => ({ ...d, deviceType: 'NVR' }));
      const bios = (bioRes.data || []).map(d => ({ ...d, deviceType: 'Biometric' }));
      const sws = (swRes.data || []).map(d => ({ ...d, deviceType: 'Switch' }));
      setDevices([...cams, ...nvrs, ...bios, ...sws]);
    } catch (err) {
      console.error('Failed to fetch devices', err);
    }
  };

  const parseLocation = (device) => {
    if (!device) return { block: '—', floor: '—', room: '—' };
    let block = device.block || '';
    let floor = device.floor || '';
    let room = device.room || '';
    const raw = (device.siteName || (device.block?.includes('|') ? device.block : '')).trim();
    if (raw && raw.includes('|')) {
      const parts = raw.split('|').map(p => p.trim());
      block = parts[1] || block;
      floor = parts[2] || floor;
      room = parts[3] || room;
    }
    return { block: block || '—', floor: floor || '—', room: room || '—' };
  };

  const filteredDevices = useMemo(() => {
    if (!activeDivisionName) return [];
    const activeUpper = activeDivisionName.trim().toUpperCase();
    
    return devices.filter(d => {
      const devCollege = (d.divisionName || '').trim().toUpperCase();
      if (devCollege !== activeUpper) return false;
      
      if (deviceTypeFilter !== 'ALL' && d.deviceType !== deviceTypeFilter) return false;
      
      if (deviceSearchQuery) {
        const q = deviceSearchQuery.toLowerCase();
        const name = d.name || d.cameraName || d.nvrName || d.biometricName || d.switchName || '';
        const serial = d.serialNumber || d.serialNo || d.sno || '';
        const loc = parseLocation(d);
        if (!name.toLowerCase().includes(q) &&
            !serial.toLowerCase().includes(q) &&
            !(d.ipAddress || '').toLowerCase().includes(q) &&
            !(loc.block || '').toLowerCase().includes(q) &&
            !(loc.floor || '').toLowerCase().includes(q) &&
            !(loc.room || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [devices, activeDivisionName, deviceTypeFilter, deviceSearchQuery]);

  const fetchLocalDivisions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras/divisions/');
      setDivisions(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch Divisions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (filteredDevices.length === 0) {
      showNotification('No devices to export', 'error');
      return;
    }
    
    const headers = ['Device', 'Type', 'Block', 'Floor', 'Room', 'IP', 'Serial', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredDevices.map(d => {
        const loc = parseLocation(d);
        const name = d.name || d.cameraName || d.nvrName || d.biometricName || d.switchName || '';
        return [
          `"${name}"`,
          `"${d.deviceType}"`,
          `"${loc.block}"`,
          `"${loc.floor}"`,
          `"${loc.room}"`,
          `"${d.ipAddress || ''}"`,
          `"${d.serialNumber || d.serialNo || d.sno || ''}"`,
          `"${d.status || 'Active'}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devices_${activeDivisionName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportDivisionsCSV = () => {
    if (Divisions.length === 0) {
      showNotification('No divisions to export', 'error');
      return;
    }
    
    const headers = ['Division Name', 'Type', 'Merged From'];
    const csvContent = [
      headers.join(','),
      ...Divisions.map(occ => {
        return [
          `"${occ.name}"`,
          `"${occ.division_type}"`,
          `"${occ.merged_from ? occ.merged_from.join(', ') : ''}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Divisions_List_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const namesToSubmit = [...selectedNames];
    if (inputValue.trim() && !namesToSubmit.includes(inputValue.trim())) {
      namesToSubmit.push(inputValue.trim());
    }
    
    if (namesToSubmit.length === 0) return;

    try {
      setIsSubmitting(true);
      
      if (isMergeMode) {
        if (!masterName.trim()) {
           showNotification('Master name is required for merging', 'error');
           setIsSubmitting(false);
           return;
        }
        await api.post('/cameras/divisions/merge/', {
          old_names: namesToSubmit,
          new_name: masterName.trim(),
          division_type: formData.division_type
        });
        showNotification(`Merged ${namesToSubmit.length} divisions into ${masterName}`, 'success');
      } else {
        const promises = namesToSubmit.map(name => 
          api.post('/cameras/divisions/', { name: name, division_type: formData.division_type })
            .catch(err => console.warn(`Could not create ${name}`, err))
        );
        await Promise.all(promises);
        showNotification(`${namesToSubmit.length} Divisions processed`, 'success');
      }
      
      setSelectedNames([]);
      setInputValue('');
      setMasterName('');
      setFormData({ division_type: 'Division' });
      setShowModal(false);
      fetchLocalDivisions();
      fetchDivisions();
    } catch (err) {
      console.error(err);
      showNotification(isMergeMode ? 'Failed to merge Divisions' : 'Failed to create Divisions', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/divisions/${id}/`);
        showNotification('Division deleted', 'success');
        fetchLocalDivisions();
        fetchDivisions();
      } catch (error) {
        showNotification('Failed to delete', 'error');
      }
    });
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <ShieldAlert size={64} className="text-red-500 mb-6 opacity-80" />
        <h2 className="text-2xl font-bold text-main tracking-tight mb-2">Access Restricted</h2>
        <p className="text-dim">Please contact the CCTV Admin to request access permissions.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] -m-6 lg:-m-10 p-6 lg:p-10 bg-main text-main animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-main pb-8 gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Building className="mr-3 text-teal-500" size={28} />
            Division
          </h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportDivisionsCSV}
            disabled={Divisions.length === 0}
            className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center disabled:opacity-50"
          >
            <Download size={16} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center"
            >
              <Plus size={16} className="mr-2" /> Add Division
            </button>
          )}
        </div>
      </div>

      <div>
        {/* List Section */}
        <div className="w-full">
          <div className="bg-panel border border-main shadow-xl rounded-2xl overflow-hidden min-h-[400px]">
            <div className="p-6 border-b border-main bg-main flex items-center justify-between">
              {activeDivisionName ? (
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => setActiveDivisionName(null)}
                    className="px-3 py-1.5 bg-main hover:bg-panel border border-main text-secondary hover:text-main rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center"
                  >
                     ← Back to Divisions
                  </button>
                  <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                    <Building className="mr-2 text-teal-500" size={20} />
                    {activeDivisionName}
                  </h2>
                </div>
              ) : (
                <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                  <Building className="mr-2 text-teal-500" size={20} />
                  LOCATION REGISTRY
                </h2>
              )}
              {!activeDivisionName && (
                <div className="text-[10px] font-black text-teal-500 bg-teal-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full uppercase">
                  {Divisions.length} Total
                </div>
              )}
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center p-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-xs font-bold text-dim uppercase tracking-widest">Loading data...</p>
                </div>
              ) : activeDivisionName ? (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-panel rounded-2xl p-4 border border-main gap-4">
                    <div>
                      <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center">
                        <Cctv className="mr-2 text-blue-500" size={16} />
                        Devices in {activeDivisionName}
                      </h3>
                      <p className="text-xs text-dim font-bold uppercase tracking-widest mt-1">
                        Showing {filteredDevices.length} Devices
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <select
                        value={deviceTypeFilter}
                        onChange={(e) => setDeviceTypeFilter(e.target.value)}
                        className="glass-input p-2.5 text-xs bg-panel border-main focus:border-blue-500 text-main font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                      >
                        <option value="ALL">All Types</option>
                        <option value="Camera">Cameras</option>
                        <option value="NVR">NVRs</option>
                        <option value="Biometric">Biometrics</option>
                        <option value="Switch">Switches</option>
                      </select>
                      
                      <input
                        type="text"
                        value={deviceSearchQuery}
                        onChange={(e) => setDeviceSearchQuery(e.target.value)}
                        placeholder="Search devices..."
                        className="glass-input p-2.5 text-xs bg-panel border-main focus:border-blue-500 transition-all text-main w-full sm:w-64 rounded-xl font-medium"
                      />
                      <button
                        onClick={exportCSV}
                        className="px-4 py-2.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center shadow-[0_0_15px_rgba(16,185,129,0.15)] group whitespace-nowrap"
                      >
                        <Download size={14} className="mr-2 group-hover:scale-110 transition-transform" />
                        Export
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto glass-panel border border-main rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-main bg-main/50 text-[10px] font-black text-secondary uppercase tracking-[0.2em]">
                          <th className="p-4">Device</th>
                          <th className="p-4">Type</th>
                          <th className="p-4">Location</th>
                          <th className="p-4">Network & Serial</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDevices.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-8 text-center text-dim text-xs font-bold uppercase tracking-widest">
                              No devices found
                            </td>
                          </tr>
                        ) : (
                          filteredDevices.map((device) => {
                            const loc = parseLocation(device);
                            const deviceName = device.name || device.cameraName || device.nvrName || device.biometricName || device.switchName || 'Unnamed Device';
                            const serialNo = device.serialNumber || device.serialNo || device.sno || '—';
                            
                            let detailUrl = '';
                            if (device.deviceType === 'Camera') detailUrl = `/devices/cameras/${device.id || device._id}`;
                            else if (device.deviceType === 'NVR') detailUrl = `/devices/nvr/${device.id || device._id}`;
                            else if (device.deviceType === 'Biometric') detailUrl = `/devices/biometrics/${device.id || device._id}`;
                            else if (device.deviceType === 'Switch') detailUrl = `/devices/switches/${device.id || device._id}`;

                            return (
                              <tr key={`${device.deviceType}-${device.id || device._id}`} className="border-b border-main/50 hover:bg-main/20 transition-all group">
                                <td className="p-4">
                                  <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded-lg ${
                                      device.deviceType === 'Camera' ? 'bg-blue-500/10 text-blue-500' :
                                      device.deviceType === 'NVR' ? 'bg-purple-500/10 text-purple-500' :
                                      device.deviceType === 'Biometric' ? 'bg-emerald-500/10 text-emerald-500' :
                                      'bg-orange-500/10 text-orange-500'
                                    }`}>
                                      {device.deviceType === 'Camera' && <Cctv size={16} />}
                                      {device.deviceType === 'NVR' && <Server size={16} />}
                                      {device.deviceType === 'Biometric' && <Fingerprint size={16} />}
                                      {device.deviceType === 'Switch' && <Network size={16} />}
                                    </div>
                                    <span className="text-xs font-bold text-main">{deviceName}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-[10px] font-black text-dim uppercase tracking-widest border border-main px-2 py-0.5 rounded-md bg-main">
                                    {device.deviceType}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="text-[10px] font-bold text-secondary uppercase tracking-wider flex flex-col">
                                    <span>{loc.block}</span>
                                    <span className="opacity-60">{loc.floor} • {loc.room}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-[10px] font-mono flex flex-col">
                                    <span className="text-blue-400 font-bold">{device.ipAddress || '0.0.0.0'}</span>
                                    <span className="text-dim">{serialNo}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${
                                    device.status === 'Active' || device.status === 'Online' 
                                      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                                      : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                                  }`}>
                                    {device.status || 'Active'}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  {detailUrl && (
                                    <button 
                                      onClick={() => navigate(detailUrl)}
                                      className="text-[10px] font-bold text-blue-500 hover:text-white hover:bg-blue-500 px-3 py-1.5 rounded-lg border border-blue-500/30 transition-all uppercase tracking-widest"
                                    >
                                      View
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : Divisions.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                  <Building size={48} className="mx-auto mb-4 text-main/20" />
                  <p className="text-main/50 text-xs font-bold uppercase tracking-widest">No locations found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Divisions.map(occ => (
                    <div 
                      key={occ.id} 
                      onClick={() => setActiveDivisionName(occ.name)}
                      className="hud-panel border border-main rounded-2xl p-5 flex items-start justify-between hover:border-teal-500/40 transition-all group cursor-pointer relative overflow-hidden"
                    >
                      <div className="hud-corner-tr"></div>
                      <div className="hud-corner-bl"></div>
                      <div className="flex items-start">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl mr-4 bg-teal-500/10 text-teal-500 border border-teal-500/10 group-hover:scale-110 transition-transform shrink-0">
                          <Building size={20} />
                        </div>
                        <div className="pt-1">
                          <h4 className="text-lg font-black text-main leading-none mb-2">{occ.name}</h4>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-[11px] text-dim font-black uppercase tracking-widest">
                              {occ.division_type === 'College' ? 'Division' : occ.division_type}
                            </span>
                            {occ.merged_from && occ.merged_from.length > 0 && (
                              <span className="text-[9px] bg-black/10 text-dim px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-main">
                                Contains: {occ.merged_from.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end h-full justify-between">
                        {canEdit && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(occ.id); }}
                            className="p-2 text-main/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <ChevronRight size={20} className="text-teal-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[150] animate-fade-in">
          <div className="bg-panel border border-main shadow-2xl rounded-3xl w-full max-w-md overflow-hidden transform animate-slide-up">
            <div className="p-6 border-b border-main bg-main flex justify-between items-center">
              <h2 className="text-xl font-black text-main tracking-tight uppercase flex items-center">
                <Plus className="mr-3 text-blue-500" size={24} />
                ADD Division
              </h2>
              <button onClick={() => setShowModal(false)} className="text-main/50 hover:text-main transition-colors p-2 hover:bg-main/5 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="flex bg-black/10 rounded-xl p-1 mb-4">
                <button 
                  type="button" 
                  onClick={() => setIsMergeMode(false)}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${!isMergeMode ? 'bg-panel shadow text-blue-500' : 'text-main/50 hover:text-main'}`}
                >
                  Bulk Create
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsMergeMode(true)}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${isMergeMode ? 'bg-panel shadow text-blue-500' : 'text-main/50 hover:text-main'}`}
                >
                  Merge Legacy
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-black text-dim uppercase tracking-widest mb-2 ml-1">
                  {isMergeMode ? "Select Old Divisions to Merge" : "Division Names"}
                </label>
                <div className="relative">
                  <div className="w-full p-2 bg-main border border-main focus-within:border-blue-500 rounded-xl flex flex-wrap gap-2 items-center min-h-[56px] transition-all shadow-inner">
                    {selectedNames.map(name => (
                      <span key={name} className="flex items-center space-x-1 bg-black/10 text-dim px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest border border-main">
                        <span>{name}</span>
                        <button type="button" onClick={() => handleRemoveName(name)} className="hover:text-red-500 transition-colors ml-1">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => { setInputValue(e.target.value); setIsDropdownOpen(true); }}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-main font-bold placeholder:text-main/30 text-sm px-2 py-1"
                      placeholder={selectedNames.length === 0 ? "Type or select divisions..." : "Add more..."}
                    />
                  </div>
                  
                  {isDropdownOpen && (availableColleges.length > 0 || (inputValue.trim() && !uniqueOldColleges.some(c => c.toLowerCase() === inputValue.trim().toLowerCase()) && !selectedNames.includes(inputValue.trim()))) && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-panel border border-main shadow-2xl rounded-xl max-h-48 overflow-y-auto z-[300]">
                      {availableColleges.map(c => (
                        <div 
                          key={c}
                          onMouseDown={(e) => { e.preventDefault(); handleAddName(c); }}
                          className="px-4 py-3 cursor-pointer hover:bg-main text-sm font-bold text-main border-b border-main/30 last:border-0 transition-colors"
                        >
                          {c}
                        </div>
                      ))}
                      {inputValue.trim() && !uniqueOldColleges.some(c => c.toLowerCase() === inputValue.trim().toLowerCase()) && !selectedNames.includes(inputValue.trim()) && (
                        <div 
                          onMouseDown={(e) => { e.preventDefault(); handleAddName(inputValue.trim()); }}
                          className="px-4 py-3 cursor-pointer hover:bg-main text-sm font-bold text-blue-500 bg-blue-500/10 transition-colors flex items-center"
                        >
                          <Plus size={14} className="mr-2" />
                          Create "{inputValue.trim()}" as new division
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isMergeMode && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-black text-dim uppercase tracking-widest mb-2 ml-1">
                    Master Division Name
                  </label>
                  <input 
                    type="text"
                    required={isMergeMode}
                    value={masterName}
                    onChange={(e) => setMasterName(e.target.value)}
                    className="w-full p-4 text-sm bg-main border border-main focus:border-blue-500 focus:outline-none text-main font-bold rounded-xl placeholder:text-main/30 transition-all shadow-inner"
                    placeholder="e.g. Rathinam College of Arts"
                  />
                  <p className="text-[10px] text-dim mt-2 font-bold ml-1">All selected old divisions and their hardware will be renamed to this Master Name.</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting || (selectedNames.length === 0 && !inputValue.trim()) || (isMergeMode && !masterName.trim())}
                className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-blue-500/20"
              >
                {isSubmitting ? 'PROCESSING...' : (isMergeMode ? 'MERGE & CREATE' : 'CREATE DIVISION')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
