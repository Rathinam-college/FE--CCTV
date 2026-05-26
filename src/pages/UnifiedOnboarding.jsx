import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  Building, MapPin, Plus, Trash2, X, ShieldAlert, ChevronRight, ChevronDown, LayoutGrid, Layers
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSiteStore } from '../store/siteStore';

export default function UnifiedOnboarding() {
  const { user } = useAuthStore();
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
  const [occupations, setOccupations] = useState([]);
  
  // Prompt Modal State
  const [promptModal, setPromptModal] = useState({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' });

  useEffect(() => {
    fetchAllLocations();
    fetchOccupations();
  }, []);

  const fetchOccupations = async () => {
    try {
      const res = await api.get('/cameras/occupations/');
      setOccupations(res.data);
    } catch (err) {
      console.error('Failed to fetch occupations', err);
    }
  };

  // Process flat locations into a nested hierarchy
  const hierarchy = useMemo(() => {
    const blocks = [];
    
    // Filter by search query first if needed (though filtering a tree is complex, 
    // we'll apply a basic filter at the flat level before building the tree)
    const filteredLocs = allLocations.filter(loc => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (loc.block?.toLowerCase().includes(q) || 
              loc.floor?.toLowerCase().includes(q) || 
              loc.room?.toLowerCase().includes(q));
    });

    filteredLocs.forEach(loc => {
      if (!loc.block) return;
      
      let block = blocks.find(b => b.name === loc.block);
      if (!block) {
        block = { name: loc.block, id: loc.id, collegeName: loc.collegeName || '', floors: [] };
        blocks.push(block);
      } else if (!loc.floor && !loc.room) {
        block.id = loc.id; // Pure block record
      }
      
      if (!loc.floor) return;
      
      let floor = block.floors.find(f => f.name === loc.floor);
      if (!floor) {
        floor = { name: loc.floor, id: loc.id, rooms: [] };
        block.floors.push(floor);
      } else if (!loc.room) {
        floor.id = loc.id; // Pure floor record
      }
      
      if (!loc.room) return;
      
      floor.rooms.push({ name: loc.room, id: loc.id, assignee: loc.assignedTo });
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
        await addLocation({ collegeName: promptModal.selectedCollege, block: value.trim(), floor: '', room: '' });
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
            addLocation({ collegeName: parentData.collegeName, block: parentData.block, floor: f, room: '' })
          ));
        } else {
          await addLocation({ collegeName: parentData.collegeName, block: parentData.block, floor: value.trim(), room: '' });
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
            addLocation({ collegeName: parentData.collegeName, block: parentData.block, floor: parentData.floor, room: r })
          ));
        } else {
          await addLocation({ collegeName: parentData.collegeName, block: parentData.block, floor: parentData.floor, room: value.trim() });
        }
      }

      showNotification(`${type} created successfully`, 'success');
      await fetchAllLocations();
      // If we just created a Block, we could auto-navigate into it, but staying on the list is fine
      // If we are currently in a block, our activeBlockId will re-find the updated block from hierarchy automatically
      
      setPromptModal({ isOpen: false, type: '', parentData: null, value: '', secondaryValue: '', floorMode: 'bulk', selectedCollege: '' });
    } catch (err) {
      showNotification(`Failed to create ${type}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id, type) => {
    e.stopPropagation();
    if (!id) {
       return showNotification('This node does not have a dedicated registry ID. Delete its children first.', 'error');
    }
    
    if (window.confirm(`Are you sure you want to delete this ${type}?`)) {
      const success = await deleteLocation(id);
      if (success) {
        showNotification(`${type} deleted`, 'success');
        fetchAllLocations();
      } else {
        showNotification(`Failed to delete ${type}`, 'error');
      }
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

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-fade-in relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-8 gap-6">
        <div>
          <h1 className="text-5xl font-black font-['Space_Grotesk'] tracking-tighter text-main italic">
            INFRA BUILDER
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.4em] mt-2">Interactive Master Registry</p>
        </div>
        <div className="flex flex-col items-end space-y-4">
          <div className="flex items-center text-emerald-500 font-bold text-sm bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
            ACTIVE HIERARCHY MODE
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenPrompt('Block', null)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center"
            >
              <Plus size={16} className="mr-2" /> Add Block
            </button>
          )}
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
                 onClick={() => handleOpenPrompt('Floor', { collegeName: activeBlockObj.collegeName, block: activeBlockObj.name })}
                 className="px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-blue-500/20 flex items-center"
               >
                 <Plus size={14} className="mr-2" /> Add Floor
               </button>
            )}

            {activeFloorObj && canEdit && (
               <button 
                 onClick={() => handleOpenPrompt('Room', { collegeName: activeBlockObj.collegeName, block: activeBlockObj.name, floor: activeFloorObj.name })}
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
                  <p className="text-dim text-xs font-bold uppercase tracking-widest">No infrastructure found</p>
                  {canEdit && (
                    <button onClick={() => handleOpenPrompt('Block', null)} className="mt-4 text-blue-400 text-xs font-bold hover:text-blue-300">
                      + Create First Block
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hierarchy.map(block => (
                    <div 
                      key={block.name} 
                      className="bg-panel border border-main rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer group hover:border-blue-500/30 flex flex-col justify-between"
                      onClick={() => setActiveBlockId(block.name)}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center">
                          <div className="p-3 bg-teal-500/10 rounded-xl mr-4 group-hover:bg-teal-500/20 transition-colors">
                            <Building size={24} className="text-teal-500" />
                          </div>
                          <div>
                            <h4 className="text-lg font-black text-main tracking-widest uppercase">{block.name}</h4>
                            <p className="text-xs text-dim font-bold uppercase tracking-widest">{block.floors.length} Floors</p>
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
                      <div className="flex items-center justify-between text-xs font-bold text-blue-500 uppercase tracking-widest">
                        <span>Enter Block</span>
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
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
                    {promptModal.parentData.collegeName}
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
