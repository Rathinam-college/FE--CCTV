import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Building, MapPin, Plus, Trash2, X, ShieldAlert, ChevronRight, ChevronDown, LayoutGrid, Layers, Server, Cctv, Fingerprint, Network, Download, Upload
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';

export default function UnifiedOnboarding() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { showNotification } = useNotificationStore();
  const { 
    allLocations,
    fetchAllLocations,
    deleteLocation,
    addLocation
  } = useSiteStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { divisions, fetchDivisions } = useSiteStore();
  
  // Prompt Modal State
  const [promptModal, setPromptModal] = useState({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' });
  const [devices, setDevices] = useState([]);

  // Device-specific filters for the active block view
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('ALL');

  // Reset filters when changing active block
  useEffect(() => {
    setDeviceSearchQuery('');
    setDeviceTypeFilter('ALL');
  }, [activeBlockId]);

  useEffect(() => {
    fetchAllLocations();
    fetchDivisions();
    fetchDevices();
  }, []);

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



  // Process flat locations into a nested hierarchy
  // Process flat locations into a nested hierarchy
  const hierarchy = useMemo(() => {
    const blocks = [];
    
    // Filter by search query first if needed
    const filteredLocs = allLocations.filter(loc => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (loc.block?.toLowerCase().includes(q) || 
              loc.floor?.toLowerCase().includes(q) || 
              loc.room?.toLowerCase().includes(q));
    });

    filteredLocs.forEach(loc => {
      if (!loc.block) return;
      const blockName = String(loc.block).trim().toUpperCase();
      
      let block = blocks.find(b => b.name.toUpperCase() === blockName);
      if (!block) {
        block = { name: String(loc.block).trim(), id: loc.id, divisionName: loc.divisionName || '', floors: [] };
        blocks.push(block);
      } else if (!loc.floor && !loc.room) {
        block.id = loc.id; // Pure block record
      }
      
      if (!loc.floor) return;
      const floorName = String(loc.floor).trim().toUpperCase();
      
      let floor = block.floors.find(f => f.name.toUpperCase() === floorName);
      if (!floor) {
        floor = { name: String(loc.floor).trim(), id: loc.id, rooms: [] };
        block.floors.push(floor);
      } else if (!loc.room) {
        floor.id = loc.id; // Pure floor record
      }
      
      if (!loc.room) return;
      const roomName = String(loc.room).trim().toUpperCase();
      
      let room = floor.rooms.find(r => r.name.toUpperCase() === roomName);
      if (!room) {
        floor.rooms.push({ name: String(loc.room).trim(), id: loc.id, assignee: loc.assignedTo });
      }
    });
    
    blocks.forEach(block => {
      block.floors.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        
        if (nameA === 'G') return -1;
        if (nameB === 'G') return 1;
        
        const numA = parseInt(nameA, 10);
        const numB = parseInt(nameB, 10);
        
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        
        return nameA.localeCompare(nameB);
      });
      
      block.floors.forEach(floor => {
        floor.rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      });
    });

    // Sort blocks A-Z
    blocks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return blocks;
  }, [allLocations, searchQuery]);

  const handleOpenPrompt = (type, parentData) => {
    setPromptModal({ isOpen: true, type, parentData, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' });
  };

  const handlePromptSubmit = async (e) => {
    e.preventDefault();
    const { type, parentData, value, secondaryValue, floorMode } = promptModal;
    if (!value.trim() && value !== '0') return; // Allow '0' for floor count
    
    try {
      setIsSubmitting(true);

      if (type === 'Block') {
        await addLocation({ divisionName: '', block: value.trim(), floor: '', room: '' });
      } else if (type === 'Floor') {
        if (floorMode === 'bulk') {
          const val = value.trim().toUpperCase();
          const floorsToCreate = new Set();
          
          if (val.includes(',')) {
            val.split(',').forEach(f => { if(f.trim()) floorsToCreate.add(f.trim()) });
          } else if (val.includes('-')) {
            const [start, end] = val.split('-').map(s => s.trim());
            let startNum = start === 'G' ? 0 : parseInt(start, 10);
            let endNum = end === 'G' ? 0 : parseInt(end, 10);
            
            if (!isNaN(startNum) && !isNaN(endNum)) {
               for (let i = startNum; i <= endNum; i++) {
                 floorsToCreate.add(i === 0 ? 'G' : `${i}`);
               }
            } else {
               floorsToCreate.add(val);
            }
          } else {
             if (val === 'G') {
               floorsToCreate.add('G');
             } else {
               const count = parseInt(val, 10);
               if (!isNaN(count)) {
                 floorsToCreate.add('G');
                 for (let i = 1; i <= count; i++) {
                   floorsToCreate.add(`${i}`);
                 }
               } else {
                 floorsToCreate.add(val);
               }
             }
          }
          
          await Promise.all(Array.from(floorsToCreate).map(f => 
            addLocation({ divisionName: parentData?.divisionName || '', block: parentData?.block || '', floor: f, room: '' })
          ));
        } else {
          await addLocation({ divisionName: parentData?.divisionName || '', block: parentData?.block || '', floor: value.trim(), room: '' });
        }
      } else if (type === 'Room') {
        if (floorMode === 'bulk') {
          const val = value.trim().toUpperCase();
          const roomsToCreate = new Set();
          
          if (val.includes(',')) {
            val.split(',').forEach(r => { if(r.trim()) roomsToCreate.add(r.trim()) });
          } else if (val.includes('-')) {
            const [start, end] = val.split('-').map(s => s.trim());
            let startNum = parseInt(start, 10);
            let endNum = parseInt(end, 10);
            
            if (!isNaN(startNum) && !isNaN(endNum)) {
               for (let i = startNum; i <= endNum; i++) {
                 roomsToCreate.add(`${i}`);
               }
            } else {
               roomsToCreate.add(val);
            }
          } else {
            roomsToCreate.add(val);
          }
          
          await Promise.all(Array.from(roomsToCreate).map(r => 
            addLocation({ divisionName: parentData?.divisionName || '', block: parentData?.block || '', floor: parentData?.floor || '', room: r })
          ));
        } else {
          await addLocation({ divisionName: parentData?.divisionName || '', block: parentData?.block || '', floor: parentData?.floor || '', room: value.trim() });
        }
      }

      showNotification(`${type} created successfully`, 'success');
      
      setPromptModal({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.name?.[0] || `Failed to create ${type}`;
      showNotification(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id, type) => {
    e.stopPropagation();
    if (!id || String(id).startsWith('legacy')) {
       return showNotification('This asset does not have a dedicated registry ID. Please remove or reassign the devices assigned to it first.', 'error');
    }
    
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      const result = await deleteLocation(id);
      if (result.success) {
        showNotification(`${type} deleted`, 'success');
        if (type === 'Block' && activeBlockId === id) {
          setActiveBlockId(null);
          setActiveFloorId(null);
        }
      } else {
        showNotification(result.message || `Failed to delete ${type}`, 'error');
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/cameras/locations/upload_excel/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const msg = response.data.skipped > 0 
        ? `Imported ${response.data.created} locations. Skipped ${response.data.skipped} duplicates.` 
        : `Imported ${response.data.created} locations successfully!`;
      showNotification(msg, response.data.skipped > 0 ? 'warning' : 'success');
      await fetchAllLocations();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to import locations', 'error');
    } finally {
      setIsSubmitting(false);
      if (e.target) e.target.value = '';
    }
  };


  const canView = user?.role === 'Super Admin' || user?.permissions?.includes('Onboarding:VIEW');
  const canEdit = user?.role === 'Super Admin' || user?.permissions?.includes('Onboarding:EDIT');

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <ShieldAlert size={64} className="text-red-500 mb-6 opacity-80" />
        <h2 className="text-2xl font-bold text-main tracking-tight mb-2">Access Restricted</h2>
        <p className="text-dim">Please contact the CCTV Admin to request access permissions.</p>
      </div>
    );
  }

  const activeBlockObj = activeBlockId ? hierarchy.find(b => b.name === activeBlockId) : null;
  const activeFloorObj = activeBlockObj && activeFloorId ? activeBlockObj.floors.find(f => f.name === activeFloorId) : null;

  const activeBlockDevices = useMemo(() => {
    if (!activeBlockObj) return [];
    return devices.filter(d => {
      const parsedLoc = parseLocation(d);
      return parsedLoc.block && activeBlockObj.name && parsedLoc.block.trim().toUpperCase() === activeBlockObj.name.trim().toUpperCase();
    });
  }, [devices, activeBlockObj]);

  const filteredBlockDevices = useMemo(() => {
    return activeBlockDevices.filter(d => {
      // Filter by type
      if (deviceTypeFilter !== 'ALL' && d.deviceType !== deviceTypeFilter) return false;
      
      // Filter by search query
      if (!deviceSearchQuery) return true;
      const q = deviceSearchQuery.toLowerCase();
      const loc = parseLocation(d);
      const name = d.name || d.cameraName || d.nvrName || d.biometricName || d.switchName || '';
      const serial = d.serialNumber || d.serialNo || d.sno || '';
      
      return (
        name.toLowerCase().includes(q) ||
        serial.toLowerCase().includes(q) ||
        (d.ipAddress || '').toLowerCase().includes(q) ||
        (loc.floor || '').toLowerCase().includes(q) ||
        (loc.room || '').toLowerCase().includes(q)
      );
    });
  }, [activeBlockDevices, deviceSearchQuery, deviceTypeFilter]);

  const exportLocationsCSV = () => {
    if (hierarchy.length === 0) {
      showNotification('No locations to export', 'error');
      return;
    }
    
    const headers = ['Division', 'Block', 'Floor', 'Room'];
    const csvContent = [headers.join(',')];

    hierarchy.forEach(block => {
      if (block.floors.length === 0) {
        csvContent.push(`"${block.divisionName || ''}","${block.name}","",""`);
      } else {
        block.floors.forEach(floor => {
          if (floor.rooms.length === 0) {
            csvContent.push(`"${block.divisionName || ''}","${block.name}","${floor.name}",""`);
          } else {
            floor.rooms.forEach(room => {
              csvContent.push(`"${block.divisionName || ''}","${block.name}","${floor.name}","${room.name}"`);
            });
          }
        });
      }
    });

    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Locations_List_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10 px-4 relative">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Plus className="mr-3 text-cyan-400" size={28} />
            Add New Site & Location
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button 
            onClick={exportLocationsCSV}
            disabled={hierarchy.length === 0}
            className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors"
          >
            <Download size={14} className="mr-2" /> Export Locations
          </button>
          {canEdit && (
            <>
              <label className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors cursor-pointer">
                <Upload size={14} className="mr-2" /> Upload CSV
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={isSubmitting} />
              </label>
              <button 
                onClick={() => handleOpenPrompt('Block', null)} 
                className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2"
              >
                <Plus size={16} className="mr-2" /> Add Block
              </button>
            </>
          )}
        </div>
      </div>

      <div className="w-full">
        <div className="bg-panel border border-main rounded-md overflow-hidden min-h-[500px]">
          <div className="p-5 border-b border-main bg-card flex flex-col sm:flex-row justify-between items-center">
            {activeBlockObj && activeFloorObj ? (
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <button 
                  onClick={() => setActiveFloorId(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center"
                >
                   ← Back to Floors
                </button>
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center">
                  <Layers className="mr-2 text-cyan-400" size={16} />
                  Block {activeBlockObj.name} &gt; {activeFloorObj.name}
                </h3>
              </div>
            ) : activeBlockObj ? (
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <button 
                  onClick={() => { setActiveBlockId(null); setActiveFloorId(null); }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center"
                >
                   ← Back to Blocks
                </button>
                <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center">
                  <Building className="mr-2 text-cyan-400" size={16} />
                  Block {activeBlockObj.name}
                </h3>
              </div>
            ) : (
              <h3 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center mb-4 sm:mb-0">
                <LayoutGrid className="mr-2 text-cyan-400" size={16} />
                Location Registry
              </h3>
            )}

            {!activeBlockObj && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter hierarchy..."
                className="bg-panel text-sm text-main border border-main rounded px-3 py-2 outline-none focus:border-cyan-500 w-full sm:w-64 placeholder:text-slate-500"
              />
            )}
            
            {activeBlockObj && !activeFloorObj && canEdit && (
               <button 
                 onClick={() => handleOpenPrompt('Floor', { divisionName: activeBlockObj.divisionName, block: activeBlockObj.name })}
                 className="text-[10px] font-bold text-cyan-400 hover:text-white border border-cyan-500/30 hover:bg-cyan-500/20 px-3 py-1.5 rounded transition-colors uppercase tracking-widest"
               >
                 <Plus size={14} className="mr-2 inline" /> Add Floor
               </button>
            )}

            {activeFloorObj && canEdit && (
               <button 
                 onClick={() => handleOpenPrompt('Room', { divisionName: activeBlockObj.divisionName, block: activeBlockObj.name, floor: activeFloorObj.name })}
                 className="text-[10px] font-bold text-emerald-400 hover:text-white border border-emerald-500/30 hover:bg-emerald-500/20 px-3 py-1.5 rounded transition-colors uppercase tracking-widest"
               >
                 <Plus size={14} className="mr-2 inline" /> Add Room
               </button>
            )}
          </div>

          <div className="p-6">
            {!activeBlockObj ? (
              hierarchy.length === 0 ? (
                <div className="text-center p-12 border border-dashed border-main rounded-md">
                  <Layers size={48} className="mx-auto mb-4 text-slate-650" />
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No hardware found</p>
                  {canEdit && (
                    <button onClick={() => handleOpenPrompt('Block', null)} className="mt-4 text-cyan-400 text-xs font-bold hover:text-cyan-300">
                      + Create First Block
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hierarchy.map(block => {
                    const blockDevices = devices.filter(d => {
                      const blockName = parseLocation(d).block;
                      return blockName && block.name && blockName.trim().toUpperCase() === block.name.trim().toUpperCase();
                    });
                    const camsCount = blockDevices.filter(d => d.deviceType === 'Camera').length;
                    const nvrsCount = blockDevices.filter(d => d.deviceType === 'NVR').length;
                    const biosCount = blockDevices.filter(d => d.deviceType === 'Biometric').length;
                    const swsCount = blockDevices.filter(d => d.deviceType === 'Switch').length;

                    return (
                      <div 
                        key={block.name} 
                        className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between hover:ring-1 hover:ring-cyan-500/30 transition-all group cursor-pointer relative overflow-hidden"
                        onClick={() => setActiveBlockId(block.name)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 group-hover:scale-110 transition-transform shrink-0 mr-4">
                              <Building size={20} />
                            </div>
                            <div>
                              <h4 className="text-md font-bold text-white tracking-widest uppercase">{block.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{block.floors.length} Floors | {blockDevices.length} Devices</p>
                            </div>
                          </div>
                          {canEdit && block.id && (
                            <button 
                              onClick={(e) => handleDelete(e, block.id, 'Block')} 
                              className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {/* Device type breakdown */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {camsCount > 0 && (
                            <span className="inline-flex items-center text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              <Cctv size={10} className="mr-1" /> {camsCount}
                            </span>
                          )}
                          {nvrsCount > 0 && (
                            <span className="inline-flex items-center text-[9px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              <Server size={10} className="mr-1" /> {nvrsCount}
                            </span>
                          )}
                          {biosCount > 0 && (
                            <span className="inline-flex items-center text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Fingerprint size={10} className="mr-1" /> {biosCount}
                            </span>
                          )}
                          {swsCount > 0 && (
                            <span className="inline-flex items-center text-[9px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                              <Network size={10} className="mr-1" /> {swsCount}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 uppercase tracking-widest mt-2">
                          <span>Enter Block</span>
                          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeBlockObj && !activeFloorObj ? (
              <div className="space-y-6">
                 {activeBlockObj.floors.length === 0 ? (
                   <div className="text-center p-12 border border-dashed border-main rounded-md">
                     <Layers size={48} className="mx-auto mb-4 text-slate-650" />
                     <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No floors in this block</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {activeBlockObj.floors.map(floor => (
                        <div 
                          key={floor.name} 
                          className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between hover:ring-1 hover:ring-cyan-500/30 transition-all group cursor-pointer"
                          onClick={() => setActiveFloorId(floor.name)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 flex items-center justify-center rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 group-hover:scale-110 transition-transform shrink-0 mr-4">
                                <Layers size={20} />
                              </div>
                              <div>
                                <h4 className="text-md font-bold text-white tracking-widest uppercase">{floor.name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{floor.rooms.length} Rooms</p>
                              </div>
                            </div>
                            {canEdit && floor.id && (
                              <button 
                                onClick={(e) => handleDelete(e, floor.id, 'Floor')} 
                                className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-bold text-cyan-400 uppercase tracking-widest mt-2">
                            <span>Enter Floor</span>
                            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                     ))}
                   </div>
                 )}

                  {/* Devices connected to this block */}
                  <div className="mt-8 bg-panel border border-main rounded-md overflow-hidden animate-slide-up">
                    <div className="p-5 border-b border-main bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="text-xs font-bold text-slate-355 uppercase tracking-widest flex items-center">
                          <Cctv className="mr-2 text-cyan-400" size={14} />
                          Devices in Block {activeBlockObj.name}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Showing {filteredBlockDevices.length} of {activeBlockDevices.length} Devices
                        </p>
                      </div>
                      
                      {/* Search and type filters */}
                      <div className="flex flex-wrap items-center gap-3 ml-auto">
                        <select
                          value={deviceTypeFilter}
                          onChange={(e) => setDeviceTypeFilter(e.target.value)}
                          className="bg-slate-800 text-slate-200 text-xs font-bold rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer min-w-[120px]"
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
                          className="bg-slate-800 text-slate-200 text-xs font-medium rounded px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 w-full sm:w-48 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-panel border-b border-main text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <th className="p-4">Device</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Location</th>
                            <th className="p-4">Network & Serial</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-350">
                          {filteredBlockDevices.map((device) => {
                            const loc = parseLocation(device);
                            const deviceName = device.name || device.cameraName || device.nvrName || device.biometricName || device.switchName || 'Unnamed Device';
                            const serialNo = device.serialNumber || device.serialNo || device.sno || '—';
                            
                            let detailUrl = '';
                            if (device.deviceType === 'Camera') detailUrl = `/devices/cameras/${device.id || device._id}`;
                            else if (device.deviceType === 'NVR') detailUrl = `/devices/nvr/${device.id || device._id}`;
                            else if (device.deviceType === 'Biometric') detailUrl = `/devices/biometrics/${device.id || device._id}`;
                            else if (device.deviceType === 'Switch') detailUrl = `/devices/switches/${device.id || device._id}`;

                            return (
                              <tr key={`${device.deviceType}-${device.id || device._id}`} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="p-4">
                                  <div className="flex items-center space-x-3">
                                    <div className={`p-2 rounded ${
                                      device.deviceType === 'Camera' ? 'bg-blue-500/10 text-blue-500' :
                                      device.deviceType === 'NVR' ? 'bg-purple-500/10 text-purple-500' :
                                      device.deviceType === 'Biometric' ? 'bg-emerald-500/10 text-emerald-500' :
                                      'bg-orange-500/10 text-orange-500'
                                    }`}>
                                      {device.deviceType === 'Camera' && <Cctv size={14} />}
                                      {device.deviceType === 'NVR' && <Server size={14} />}
                                      {device.deviceType === 'Biometric' && <Fingerprint size={14} />}
                                      {device.deviceType === 'Switch' && <Network size={14} />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-slate-300">{deviceName}</div>
                                      <div className="text-[9px] font-mono text-slate-500 mt-0.5">{serialNo}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-slate-700 text-slate-400 bg-slate-800">
                                    {device.deviceType}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="text-xs font-bold text-slate-350 flex items-center">
                                    <MapPin size={12} className="mr-1.5 text-slate-500" />
                                    {loc.floor !== '—' ? `Floor ${loc.floor}` : '—'}
                                    {loc.room !== '—' && <span className="mx-1.5 text-slate-500">•</span>}
                                    {loc.room !== '—' ? `Room ${loc.room}` : ''}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="text-xs font-mono text-cyan-400 font-bold">{device.ipAddress || '—'}</div>
                                  <div className="text-[9px] font-mono text-slate-550 uppercase tracking-widest mt-0.5">{device.macAddress || 'NO MAC'}</div>
                                </td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                    device.status === 'Online' ? 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10' :
                                    device.status === 'Offline' ? 'text-rose-500 border-rose-500/50 bg-rose-500/10' :
                                    device.status === 'Maintenance' ? 'text-amber-550 border-amber-500/50 bg-amber-550/10' :
                                    'text-slate-500 border-slate-750 bg-slate-800'
                                  }`}>
                                    {device.status || 'Offline'}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  {detailUrl && (
                                    <button
                                      onClick={() => navigate(detailUrl)}
                                      className="text-[10px] font-bold text-cyan-400 hover:text-white border border-cyan-500/30 hover:bg-cyan-500/20 px-3 py-1 rounded transition-colors uppercase tracking-widest"
                                    >
                                      View
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredBlockDevices.length === 0 && (
                            <tr>
                              <td colSpan="6" className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                                No devices found matching filters
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
              </div>
            ) : activeFloorObj ? (
              <div className="space-y-6">
                 {activeFloorObj.rooms.length === 0 ? (
                   <div className="text-center p-12 border border-dashed border-main rounded-md">
                     <MapPin size={48} className="mx-auto mb-4 text-dim" />
                     <p className="text-dim text-xs font-bold uppercase tracking-widest">No rooms added to this floor</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                     {activeFloorObj.rooms.map(room => (
                        <div key={room.id} className="group relative flex flex-col justify-between bg-card border border-main p-4 rounded hover:ring-1 hover:ring-cyan-500/30 transition-all">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <MapPin size={14} className="text-amber-500 mr-2" />
                              <span className="text-xs font-bold text-main uppercase tracking-wider">{room.name}</span>
                            </div>
                            {canEdit && (
                              <button 
                                onClick={(e) => handleDelete(e, room.id, 'Room')} 
                                className="text-dim hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                     ))}
                   </div>
                 )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Input Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-sm overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-main tracking-tight uppercase flex items-center">
                <Plus className="mr-3 text-cyan-400" size={24} />
                Add {promptModal.type}
              </h2>
              <button onClick={() => !isSubmitting && setPromptModal({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' })} className="p-2 hover:bg-card rounded-xl text-secondary hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePromptSubmit} className="p-6 space-y-6">
              {promptModal.parentData && (
                <div className="bg-panel p-3 rounded-lg border border-main text-[10px] font-mono text-slate-350 uppercase">
                  Creating under:<br/>
                  <span className="text-main font-bold">
                    {promptModal.parentData.divisionName}
                    {promptModal.parentData.block && ` > ${promptModal.parentData.block}`}
                    {promptModal.parentData.floor && ` > ${promptModal.parentData.floor}`}
                  </span>
                </div>
              )}

              {(promptModal.type === 'Floor' || promptModal.type === 'Room') && (
                <div className="flex items-center space-x-2 mb-2">
                  <input 
                    type="checkbox" 
                    id="bulkFloor"
                    checked={promptModal.floorMode === 'bulk'}
                    onChange={(e) => setPromptModal(prev => ({ ...prev, floorMode: e.target.checked ? 'bulk' : 'single', value: '' }))}
                    className="accent-cyan-400 w-4 h-4 bg-panel border-main rounded cursor-pointer"
                  />
                  <label htmlFor="bulkFloor" className="text-[10px] font-bold text-secondary uppercase cursor-pointer select-none">
                    Auto-Generate {promptModal.type}s
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                  {(promptModal.type === 'Floor' || promptModal.type === 'Room') && promptModal.floorMode === 'bulk' ? `${promptModal.type}s to Generate` : `${promptModal.type} Name`}
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  value={promptModal.value} 
                  onChange={(e) => setPromptModal(prev => ({ ...prev, value: e.target.value }))}
                  className="glass-input w-full p-3 text-xs bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg" 
                  placeholder={
                    promptModal.type === 'Floor' 
                      ? (promptModal.floorMode === 'bulk' ? 'e.g. 6 (makes G to 6) or G-6 or G,1,2' : 'e.g. Basement')
                      : promptModal.type === 'Room'
                        ? (promptModal.floorMode === 'bulk' ? 'e.g. 101-110 or 101,102' : 'e.g. Server Room')
                        : `e.g. ${promptModal.type === 'Block' ? 'A Block' : 'Room 101'}`
                  }
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !promptModal.value.trim()}
                className="w-full py-4 mt-4 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 font-bold"
              >
                {isSubmitting ? 'SAVING...' : 'CREATE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
