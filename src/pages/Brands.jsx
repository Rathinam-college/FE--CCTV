import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';
import { Tag, Plus, Trash2, ShieldAlert, X, Download, Search } from 'lucide-react';
import { useMemo } from 'react';

export default function Brands() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedNames, setSelectedNames] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBrands = useMemo(() => {
    return brands.filter(brand => brand.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [brands, searchQuery]);

  const canView = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:VIEW'));
  const canEdit = user?.role === 'Super Admin' || (Array.isArray(user?.permissions) && user.permissions.includes('Logs:EDIT'));

  const handleAddName = (name) => {
    const trimmed = name.trim();
    if (trimmed && !selectedNames.includes(trimmed)) {
      setSelectedNames([...selectedNames, trimmed]);
    }
    setInputValue('');
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
      fetchBrands();
    }
  }, [canView]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cameras/brands/');
      setBrands(res.data);
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch brands. Please check if database migrations are applied.', 'error');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (brand) => {
    setEditingId(brand.id);
    setEditValue(brand.name);
  };

  const handleUpdate = async (id) => {
    if (!editValue.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await api.put(`/cameras/brands/${id}/`, { name: editValue.trim() });
      showNotification('Brand updated', 'success');
      setEditingId(null);
      fetchBrands();
    } catch (error) {
      showNotification('Failed to update brand', 'error');
    }
  };

  const exportBrandsCSV = () => {
    if (brands.length === 0) {
      showNotification('No brands to export', 'error');
      return;
    }
    
    const headers = ['Brand Name'];
    const csvContent = [
      headers.join(','),
      ...brands.map(brand => {
        return [`"${brand.name}"`];
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Brands_List_${new Date().toISOString().split('T')[0]}.csv`;
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
      
      const promises = namesToSubmit.map(name => 
        api.post('/cameras/brands/', { name: name })
          .catch(err => console.warn(`Could not create ${name}`, err))
      );
      await Promise.all(promises);
      showNotification(`${namesToSubmit.length} brands processed`, 'success');
      
      setSelectedNames([]);
      setInputValue('');
      setShowModal(false);
      fetchBrands();
    } catch (err) {
      console.error(err);
      showNotification('Failed to create brands', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/cameras/brands/${id}/`);
        showNotification('Brand deleted', 'success');
        fetchBrands();
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
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Tag className="mr-3 text-cyan-400" size={28} />
            Brand Management
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button 
            onClick={exportBrandsCSV} 
            disabled={brands.length === 0} 
            className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors disabled:opacity-50"
          >
            <Download size={14} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button 
              onClick={() => setShowModal(true)} 
              className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2"
            >
              <Plus size={16} className="mr-2" /> Add Brand
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim" size={16} />
          <input
            type="text"
            placeholder="Search brands by Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-panel text-sm text-main border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* List Section */}
      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        <div className="p-5 border-b border-main bg-card flex items-center justify-between">
          <h2 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center">
            <Tag className="mr-2 text-cyan-400" size={16} />
            BRAND REGISTRY
          </h2>
          <div className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-3 py-1 rounded-full uppercase">
            {brands.length} Total
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center p-12">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-xs font-bold text-dim uppercase tracking-widest">Loading data...</p>
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="text-center p-12 border border-dashed border-main rounded-md">
              <Tag size={32} className="mx-auto mb-4 text-dim" />
              <p className="text-dim text-xs font-bold uppercase tracking-widest">No brands found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBrands.map(brand => (
                <div key={brand.id} className="bg-panel border border-main rounded-md p-5 flex items-start justify-between hover:ring-1 hover:ring-cyan-500/30 transition-all relative group overflow-hidden">
                  <div className="flex items-start flex-1">
                    <div className="w-8 h-8 flex items-center justify-center rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 shrink-0 mr-4">
                      <Tag size={16} />
                    </div>
                    <div className="pt-1 flex-1 pr-4">
                      {editingId === brand.id ? (
                        <input 
                          type="text" 
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded px-3 py-1.5 text-slate-200 text-sm outline-none font-bold"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(brand.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => handleUpdate(brand.id)}
                        />
                      ) : (
                        <h4 className="text-md font-bold text-main leading-none mb-2">{brand.name}</h4>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                      <button 
                        onClick={() => handleEdit(brand)}
                        className="text-secondary hover:text-cyan-400 transition-colors p-1"
                        title="Edit"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(brand.id)}
                        className="text-secondary hover:text-red-500 transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-md overflow-hidden border border-main shadow-2xl relative my-8 flex flex-col">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-main tracking-tight uppercase flex items-center">
                <Plus className="mr-3 text-cyan-400" size={24} />
                ADD BRAND
              </h2>
              <button onClick={() => setShowModal(false)} className="text-secondary hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 ml-1">
                  Brand Names
                </label>
                <div className="relative">
                  <div className="w-full p-3 bg-panel border border-main focus-within:border-cyan-500 rounded-xl flex flex-wrap gap-2 items-center min-h-[56px] transition-all">
                    {selectedNames.map(name => (
                      <span key={name} className="flex items-center space-x-1 bg-slate-800 text-slate-350 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-700">
                        <span>{name}</span>
                        <button type="button" onClick={() => handleRemoveName(name)} className="hover:text-red-500 transition-colors ml-1">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-main font-bold placeholder:text-slate-600 text-sm px-2 py-1"
                      placeholder={selectedNames.length === 0 ? "Type brand name..." : "Add more..."}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || (selectedNames.length === 0 && !inputValue.trim())}
                className="w-full py-4 mt-4 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center font-bold"
              >
                {isSubmitting ? 'PROCESSING...' : 'CREATE BRAND'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
