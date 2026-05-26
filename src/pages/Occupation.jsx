import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Building, Plus, Trash2, ShieldAlert, X } from 'lucide-react';
import { useMemo } from 'react';
import { useSiteStore } from '../store/siteStore';

export default function Occupation() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  
  const [occupations, setOccupations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { allLocations, fetchAllLocations } = useSiteStore();
  
  const [formData, setFormData] = useState({
    occupation_type: 'College'
  });
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [masterName, setMasterName] = useState('');
  const [showModal, setShowModal] = useState(false);

  const canView = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:VIEW'));
  const canEdit = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:EDIT'));

  const uniqueTypes = useMemo(() => {
    const types = new Set(occupations.map(occ => occ.occupation_type).filter(Boolean));
    if (!types.has('College')) types.add('College');
    if (!types.has('IT Company')) types.add('IT Company');
    return Array.from(types);
  }, [occupations]);

  const uniqueOldColleges = useMemo(() => {
    const colleges = new Set([
      ...allLocations.map(loc => loc.collegeName),
      ...occupations.map(occ => occ.name)
    ].filter(Boolean));
    return Array.from(colleges);
  }, [allLocations, occupations]);

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
      fetchOccupations();
      fetchAllLocations();
    }
  }, [canView]);

  const fetchOccupations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras/occupations/');
      setOccupations(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch occupations', 'error');
    } finally {
      setLoading(false);
    }
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
        await api.post('/cameras/occupations/merge/', {
          old_names: namesToSubmit,
          new_name: masterName.trim(),
          occupation_type: formData.occupation_type
        });
        showNotification(`Merged ${namesToSubmit.length} colleges into ${masterName}`, 'success');
      } else {
        const promises = namesToSubmit.map(name => 
          api.post('/cameras/occupations/', { name: name, occupation_type: formData.occupation_type })
            .catch(err => console.warn(`Could not create ${name}`, err))
        );
        await Promise.all(promises);
        showNotification(`${namesToSubmit.length} occupations processed`, 'success');
      }
      
      setSelectedNames([]);
      setInputValue('');
      setMasterName('');
      setFormData({ occupation_type: 'College' });
      setShowModal(false);
      fetchOccupations();
    } catch (err) {
      console.error(err);
      showNotification(isMergeMode ? 'Failed to merge occupations' : 'Failed to create occupations', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this occupation?')) return;
    try {
      await api.delete(`/cameras/occupations/${id}/`);
      showNotification('Occupation deleted', 'success');
      fetchOccupations();
    } catch (err) {
      console.error(err);
      showNotification('Failed to delete occupation', 'error');
    }
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
          <h1 className="text-5xl font-black font-['Space_Grotesk'] tracking-tighter text-main italic">
            INFRA BUILDER
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.4em] mt-2">Manage Colleges and IT Companies</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center"
          >
            <Plus size={16} className="mr-2" /> Add Occupation
          </button>
        )}
      </div>

      <div>
        {/* List Section */}
        <div className="w-full">
          <div className="bg-panel border border-main shadow-xl rounded-2xl overflow-hidden min-h-[400px]">
            <div className="p-6 border-b border-main bg-main flex items-center justify-between">
              <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                <Building className="mr-2 text-teal-500" size={20} />
                LOCATION REGISTRY
              </h2>
              <div className="text-[10px] font-black text-teal-500 bg-teal-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full uppercase">
                {occupations.length} Total
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center p-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-xs font-bold text-dim uppercase tracking-widest">Loading data...</p>
                </div>
              ) : occupations.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                  <Building size={48} className="mx-auto mb-4 text-main/20" />
                  <p className="text-main/50 text-xs font-bold uppercase tracking-widest">No locations found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {occupations.map(occ => (
                    <div key={occ.id} className="bg-main border border-main rounded-2xl p-5 flex items-start justify-between hover:border-blue-500/40 hover:shadow-lg transition-all group">
                      <div className="flex items-start">
                        <div className="p-4 rounded-xl mr-5 bg-teal-500/10 text-teal-500 border border-teal-500/10">
                          <Building size={24} />
                        </div>
                        <div className="pt-1">
                          <h4 className="text-lg font-black text-main leading-none mb-2">{occ.name}</h4>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-[11px] text-dim font-black uppercase tracking-widest">{occ.occupation_type}</span>
                            {occ.merged_from && occ.merged_from.length > 0 && (
                              <span className="text-[9px] bg-black/10 text-dim px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-main">
                                Contains: {occ.merged_from.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {canEdit && (
                        <button 
                          onClick={() => handleDelete(occ.id)}
                          className="p-2.5 text-main/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 mt-1"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
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
                ADD OCCUPATION
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
                  {isMergeMode ? "Select Old Colleges to Merge" : "Institution Names"}
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
                      placeholder={selectedNames.length === 0 ? "Type or select colleges..." : "Add more..."}
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
                          Create "{inputValue.trim()}" as new college
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isMergeMode && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-black text-dim uppercase tracking-widest mb-2 ml-1">
                    Master College Name
                  </label>
                  <input 
                    type="text"
                    required={isMergeMode}
                    value={masterName}
                    onChange={(e) => setMasterName(e.target.value)}
                    className="w-full p-4 text-sm bg-main border border-main focus:border-blue-500 focus:outline-none text-main font-bold rounded-xl placeholder:text-main/30 transition-all shadow-inner"
                    placeholder="e.g. Rathinam College of Arts"
                  />
                  <p className="text-[10px] text-dim mt-2 font-bold ml-1">All selected old colleges and their hardware will be renamed to this Master Name.</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting || (selectedNames.length === 0 && !inputValue.trim()) || (isMergeMode && !masterName.trim())}
                className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-blue-500/20"
              >
                {isSubmitting ? 'PROCESSING...' : (isMergeMode ? 'MERGE & CREATE' : 'CREATE COLLEGE')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
