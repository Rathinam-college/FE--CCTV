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
    <div className="min-h-[calc(100vh-80px)] -m-6 lg:-m-10 p-6 lg:p-10 bg-main text-main animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-main pb-8 gap-6 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-main tracking-tight flex items-center">
            <Tag className="mr-3 text-teal-500" size={20} />
            Brand
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-dim" />
            </div>
            <input
              type="text"
              placeholder="Search brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-panel border border-main rounded-xl text-sm font-bold text-main focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <button
            onClick={exportBrandsCSV}
            disabled={brands.length === 0}
            className="px-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center disabled:opacity-50"
          >
            <Download size={16} className="mr-2" /> Export CSV
          </button>
          {canEdit && (
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 flex items-center"
            >
              <Plus size={16} className="mr-2" /> Add Brand
            </button>
          )}
        </div>
      </div>

      <div>
        {/* List Section */}
        <div className="w-full">
          <div className="bg-panel border border-main shadow-xl rounded-2xl overflow-hidden min-h-[400px]">
            <div className="p-6 border-b border-main bg-main flex items-center justify-between">
              <h2 className="text-lg font-black text-main tracking-tight uppercase flex items-center">
                <Tag className="mr-2 text-teal-500" size={20} />
                BRAND REGISTRY
              </h2>
              <div className="text-[10px] font-black text-teal-500 bg-teal-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full uppercase">
                {brands.length} Total
              </div>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center p-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-xs font-bold text-dim uppercase tracking-widest">Loading data...</p>
                </div>
              ) : filteredBrands.length === 0 ? (
                <div className="text-center p-12 border-2 border-dashed border-main rounded-2xl">
                  <Tag size={32} className="mx-auto mb-4 text-main/20" />
                  <p className="text-main/50 text-xs font-bold uppercase tracking-widest">No brands found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredBrands.map(brand => (
                    <div key={brand.id} className="bg-main border border-main rounded-2xl p-5 flex items-start justify-between hover:border-blue-500/40 hover:shadow-lg transition-all group">
                      <div className="flex items-start flex-1">
                        <div className="w-8 h-8 flex items-center justify-center rounded-xl mr-4 bg-teal-500/10 text-teal-500 border border-teal-500/10 shrink-0">
                          <Tag size={16} />
                        </div>
                        <div className="pt-1 flex-1 pr-4">
                          {editingId === brand.id ? (
                            <input 
                              type="text" 
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full bg-panel border border-blue-500/50 rounded-lg px-3 py-1.5 text-main font-bold focus:outline-none focus:border-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdate(brand.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => handleUpdate(brand.id)}
                            />
                          ) : (
                            <h4 className="text-lg font-black text-main leading-none mb-2">{brand.name}</h4>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-all mt-1">
                          <button 
                            onClick={() => handleEdit(brand)}
                            className="p-2.5 text-main/40 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(brand.id)}
                            className="p-2.5 text-main/40 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
                ADD BRAND
              </h2>
              <button onClick={() => setShowModal(false)} className="text-main/50 hover:text-main transition-colors p-2 hover:bg-main/5 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-[11px] font-black text-dim uppercase tracking-widest mb-2 ml-1">
                  Brand Names
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
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 min-w-[150px] bg-transparent focus:outline-none text-main font-bold placeholder:text-main/30 text-sm px-2 py-1"
                      placeholder={selectedNames.length === 0 ? "Type brand name..." : "Add more..."}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || (selectedNames.length === 0 && !inputValue.trim())}
                className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-blue-500/20"
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
