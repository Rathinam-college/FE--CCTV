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
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-8 gap-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <Plus className="mr-3 text-blue-500" size={28} />
            Add New Site
          </h1>
        </div>
        <div className="flex flex-col items-end space-y-4">
          <div className="flex items-center text-emerald-500 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
            ACTIVE HIERARCHY MODE
          </div>
          <div className="flex space-x-3">
            <button
              onClick={exportLocationsCSV}
              disabled={hierarchy.length === 0}
              className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center disabled:opacity-50"
            >
              <Download size={16} className="mr-2" /> Export CSV
            </button>
            {canEdit && (
              <>
                <label className="px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center cursor-pointer disabled:opacity-50">
                  <Upload size={16} className="mr-2" /> Upload CSV
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={isSubmitting} />
                </label>
                <button
                  onClick={() => handleOpenPrompt('Block', null)}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  <Plus size={16} className="mr-2" /> Add Block
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="glass-panel bg-panel border-main shadow-xl overflow-hidden min-h-[500px]">
          <div className="p-6 border-b border-main flex flex-col sm:flex-row justify-between items-center bg-panel">
            {activeBlockObj && activeFloorObj ? (
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <button 
                  onClick={() => setActiveFloorId(null)}
                  className="px-3 py-1.5 bg-main hover:bg-panel border border-main text-secondary hover:text-main rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center"
                >
                   ← Back to Floors
                </button>
                <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center">
                  <Layers className="mr-3 text-emerald-500" size={18} />
                  Block {activeBlockObj.name} &gt; {activeFloorObj.name}
                </h3>
              </div>
            ) : activeBlockObj ? (
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <button 
                  onClick={() => { setActiveBlockId(null); setActiveFloorId(null); }}
                  className="px-3 py-1.5 bg-main hover:bg-panel border border-main text-secondary hover:text-main rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center"
                >
                   ← Back to Blocks
                </button>
                <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center">
                  <Building className="mr-3 text-teal-500" size={18} />
                  Block {activeBlockObj.name}
                </h3>
              </div>
            ) : (
              <h3 className="text-sm font-black text-main uppercase tracking-widest flex items-center mb-4 sm:mb-0">
                <LayoutGrid className="mr-3 text-blue-500" size={18} />
                Location Registry
              </h3>
            )}

            {!activeBlockObj && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter hierarchy..."
                className="glass-input p-2.5 text-xs bg-panel border-main focus:border-blue-500 transition-all text-main w-full sm:w-64 rounded-xl"
              />
            )}
            
            {activeBlockObj && !activeFloorObj && canEdit && (
               <button 
                 onClick={() => handleOpenPrompt('Floor', { divisionName: activeBlockObj.divisionName, block: activeBlockObj.name })}
                 className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-blue-500/20 flex items-center"
               >
                 <Plus size={14} className="mr-2" /> Add Floor
               </button>
            )}

            {activeFloorObj && canEdit && (
               <button 
                 onClick={() => handleOpenPrompt('Room', { divisionName: activeBlockObj.divisionName, block: activeBlockObj.name, floor: activeFloorObj.name })}
                 className="px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-emerald-500/20 flex items-center"
               >
                 <Plus size={14} className="mr-2" /> Add Room
               </button>
            )}
          </div>

          <div className="p-6">
            {!activeBlockObj ? (
              hierarchy.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                  <Layers size={48} className="mx-auto mb-4 text-dim" />
                  <p className="text-dim text-xs font-bold uppercase tracking-widest">No hardware found</p>
                  {canEdit && (
                    <button onClick={() => handleOpenPrompt('Block', null)} className="mt-4 text-blue-400 text-xs font-bold hover:text-blue-300">
                      + Create First Block
                    </button>
                  )}
                </div>
              ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      className="hud-panel p-6 hover:shadow-lg transition-all cursor-pointer group hover:border-blue-500/30 flex flex-col justify-between relative overflow-hidden"
                      onClick={() => setActiveBlockId(block.name)}
                    >
                      <div className="hud-corner-tr"></div>
                      <div className="hud-corner-bl"></div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <div className="p-3 bg-teal-500/10 rounded-xl mr-4 group-hover:bg-teal-500/20 transition-colors">
                            <Building size={24} className="text-teal-500" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-main tracking-widest uppercase">{block.name}</h4>
                            <p className="text-xs text-dim font-bold uppercase tracking-widest">{block.floors.length} Floors | {blockDevices.length} Devices</p>
                          </div>
                        </div>
                        {canEdit && block.id && (
                          <button 
                            onClick={(e) => handleDelete(e, block.id, 'Block')} 
                            className="p-2 hover:bg-red-500/10 text-dim hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>

                      {/* Device type breakdown */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {camsCount > 0 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                            <Cctv size={12} className="mr-1" /> {camsCount}
                          </span>
                        )}
                        {nvrsCount > 0 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                            <Server size={12} className="mr-1" /> {nvrsCount}
                          </span>
                        )}
                        {biosCount > 0 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Fingerprint size={12} className="mr-1" /> {biosCount}
                          </span>
                        )}
                        {swsCount > 0 && (
                          <span className="inline-flex items-center text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                            <Network size={12} className="mr-1" /> {swsCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-blue-500 uppercase tracking-widest">
                        <span>Enter Block</span>
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  )})}
                </div>
              )
            ) : activeBlockObj && !activeFloorObj ? (
              <div className="space-y-6">
                 {activeBlockObj.floors.length === 0 ? (
                   <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                     <Layers size={48} className="mx-auto mb-4 text-dim" />
                     <p className="text-dim text-xs font-bold uppercase tracking-widest">No floors in this block</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {activeBlockObj.floors.map(floor => (
                        <div 
                          key={floor.name} 
                          className="bg-panel border border-main rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer group hover:border-emerald-500/30 flex flex-col justify-between"
                          onClick={() => setActiveFloorId(floor.name)}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center">
                              <div className="p-3 bg-emerald-500/10 rounded-xl mr-4 group-hover:bg-emerald-500/20 transition-colors">
                                <Layers size={24} className="text-emerald-500" />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-main tracking-widest uppercase">{floor.name}</h4>
                                <p className="text-xs text-dim font-bold uppercase tracking-widest">{floor.rooms.length} Rooms</p>
                              </div>
                            </div>
                            {canEdit && floor.id && (
                              <button 
                                onClick={(e) => handleDelete(e, floor.id, 'Floor')} 
                                className="p-2 hover:bg-red-500/10 text-dim hover:text-red-500 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-xs font-bold text-emerald-500 uppercase tracking-widest">
                            <span>Enter Floor</span>
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                     ))}
                   </div>
                 )}

                  {/* Devices connected to this block */}
                  <div className="mt-12 bg-panel border border-main rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-main flex flex-col md:flex-row justify-between items-start md:items-center bg-panel gap-4">
                      <div>
                        <h3 className="text-base font-black text-main uppercase tracking-widest flex items-center">
                          <Cctv className="mr-3 text-blue-500" size={20} />
                          Devices in Block {activeBlockObj.name}
                        </h3>
                        <p className="text-xs text-dim font-bold uppercase tracking-widest mt-1">
                          Showing {filteredBlockDevices.length} of {activeBlockDevices.length} Devices
                        </p>
                      </div>
                      
                      {/* Search and type filters */}
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
                          placeholder="Search devices by name, IP, serial..."
                          className="glass-input p-2.5 text-xs bg-panel border-main focus:border-blue-500 transition-all text-main w-full sm:w-64 rounded-xl font-medium"
                        />
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-main bg-main/50 text-[10px] font-black text-secondary uppercase tracking-[0.2em]">
                            <th className="p-5">Device</th>
                            <th className="p-5">Type</th>
                            <th className="p-5">Location</th>
                            <th className="p-5">Network & Serial</th>
                            <th className="p-5">Status</th>
                            <th className="p-5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
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
                              <tr key={`${device.deviceType}-${device.id || device._id}`} className="border-b border-main/50 hover:bg-main/20 transition-all group">
                                <td className="p-5">
                                  <div className="flex items-center space-x-3">
                                    <div className={`p-2.5 rounded-xl border ${
                                      device.deviceType === 'Camera' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                      device.deviceType === 'NVR' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                                      device.deviceType === 'Biometric' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                      'bg-orange-500/10 border-orange-500/20 text-orange-500'
                                    }`}>
                                      {device.deviceType === 'Camera' && <Cctv size={16} />}
                                      {device.deviceType === 'NVR' && <Server size={16} />}
                                      {device.deviceType === 'Biometric' && <Fingerprint size={16} />}
                                      {device.deviceType === 'Switch' && <Network size={16} />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-black text-main uppercase tracking-wider">{deviceName}</div>
                                      <div className="text-[9px] font-mono text-secondary mt-0.5">{serialNo}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-5">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                    device.deviceType === 'Camera' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    device.deviceType === 'NVR' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                                    device.deviceType === 'Biometric' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                  }`}>
                                    {device.deviceType}
                                  </span>
                                </td>
                                <td className="p-5">
                                  <div className="text-xs font-black text-main uppercase tracking-tight flex items-center">
                                    <MapPin size={12} className="mr-1.5 text-secondary" />
                                    {loc.floor !== '—' ? `Floor ${loc.floor}` : '—'}
                                    {loc.room !== '—' && <span className="mx-1.5 text-secondary">•</span>}
                                    {loc.room !== '—' ? `Room ${loc.room}` : ''}
                                  </div>
                                </td>
                                <td className="p-5">
                                  <div className="text-xs font-mono text-main font-bold">{device.ipAddress || '—'}</div>
                                  <div className="text-[9px] font-mono text-secondary uppercase tracking-widest mt-0.5">{device.macAddress || 'NO MAC'}</div>
                                </td>
                                <td className="p-5">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    device.status === 'Online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                    device.status === 'Offline' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                    device.status === 'Maintenance' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                    'bg-slate-500/10 text-slate-600 border-slate-500/20'
                                  }`}>
                                    {device.status || 'Offline'}
                                  </span>
                                </td>
                                <td className="p-5 text-right">
                                  {detailUrl && (
                                    <button
                                      onClick={() => navigate(detailUrl)}
                                      className="px-3 py-1.5 bg-main hover:bg-panel border border-main text-secondary hover:text-main rounded-lg text-[10px] font-black uppercase tracking-widest transition-all inline-flex items-center"
                                    >
                                      View Details
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredBlockDevices.length === 0 && (
                            <tr>
                              <td colSpan="6" className="p-10 text-center text-dim font-bold uppercase tracking-widest text-[10px]">
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
                   <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                     <MapPin size={48} className="mx-auto mb-4 text-dim" />
                     <p className="text-dim text-xs font-bold uppercase tracking-widest">No rooms added to this floor</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                     {activeFloorObj.rooms.map(room => (
                        <div key={room.id} className="group relative flex flex-col justify-between bg-panel border border-main p-4 rounded-xl hover:border-amber-500/50 hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center">
                              <MapPin size={16} className="text-amber-500 mr-2" />
                              <span className="text-sm font-black text-main uppercase tracking-wider">{room.name}</span>
                            </div>
                            {canEdit && (
                              <button 
                                onClick={(e) => handleDelete(e, room.id, 'Room')} 
                                className="text-dim hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
          <div className="bg-panel rounded-3xl w-full max-w-sm border border-main shadow-2xl overflow-hidden transform animate-slide-up">
            <div className="p-6 border-b border-main flex justify-between items-center bg-main">
              <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                <Plus className="mr-2 text-blue-500" size={20} />
                Add {promptModal.type}
              </h2>
              <button onClick={() => !isSubmitting && setPromptModal({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' })} className="p-2 hover:bg-main rounded-xl text-dim hover:text-main transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handlePromptSubmit} className="p-6 space-y-6">
              {promptModal.parentData && (
                <div className="bg-main p-3 rounded-xl border border-main text-[9px] font-mono text-dim uppercase">
                  Creating under:<br/>
                  <span className="text-main">
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
                    className="accent-blue-500 w-4 h-4"
                  />
                  <label htmlFor="bulkFloor" className="text-[10px] font-bold text-main uppercase cursor-pointer">
                    Auto-Generate {promptModal.type}s
                  </label>
                </div>
              )}



              <div>
                <label className="block text-[10px] font-black text-secondary uppercase tracking-widest mb-2">
                  {(promptModal.type === 'Floor' || promptModal.type === 'Room') && promptModal.floorMode === 'bulk' ? `${promptModal.type}s to Generate` : `${promptModal.type} Name`}
                </label>
                <input 
                  type="text"
                  required
                  autoFocus
                  value={promptModal.value} 
                  onChange={(e) => setPromptModal(prev => ({ ...prev, value: e.target.value }))}
                  className="glass-input w-full p-3 text-xs bg-main border-main focus:border-blue-500 text-main font-bold" 
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
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
