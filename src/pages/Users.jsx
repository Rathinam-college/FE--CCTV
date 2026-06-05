import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';
import { Plus, Edit2, Trash2, Users as UsersIcon, ShieldAlert, Upload } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useConfirmStore } from '../store/confirmStore';

export default function Users() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { showConfirm } = useConfirmStore();
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', role: 'Staff', branch: '',
    permissions: ['Dashboard:VIEW', 'Assets:VIEW', 'Maintenance:VIEW', 'Projects:VIEW'] 
  });
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchUsers();
  }, []);



  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0].map(h => h.trim());
      const data = rows.slice(1).filter(row => row.length > 1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let val = row[index]?.trim() || '';
          if (header.toLowerCase() === 'name') obj['name'] = val;
          else if (header.toLowerCase() === 'email') obj['email'] = val;
          else if (header.toLowerCase() === 'role') obj['role'] = val || 'Staff';
          else if (header.toLowerCase() === 'branch' || header.toLowerCase() === 'operational zone') obj['branch'] = val;
          else if (header.toLowerCase() === 'password') obj['password'] = val;
          else obj[header] = val;
        });
        if (!obj.password) obj.password = 'Cctv@123'; 
        if (!obj.permissions) obj.permissions = ['Dashboard:VIEW', 'Assets:VIEW', 'Maintenance:VIEW', 'Projects:VIEW'];
        return obj;
      });

      try {
        await api.post('/users/bulk_create/', data);
        showNotification(`Successfully imported ${data.length} personnel`);
        fetchUsers();
      } catch (err) {
        console.error(err);
        showNotification('Failed to import personnel. Check CSV format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = { ...formData };
      if (editingId && !payload.password) {
        delete payload.password;
      }

      if (editingId) {
        await api.put(`/users/${editingId}/`, payload);
        showNotification('User updated successfully');
      } else {
        await api.post('/auth/register', payload);
        showNotification('New user created successfully');
      }
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'Staff', branch: '', permissions: ['Dashboard:VIEW', 'Assets:VIEW', 'Maintenance:VIEW', 'Projects:VIEW'] });
      setEditingId(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
      showNotification('Error saving user. Email may already exist.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const editUser = (usr) => {
    setFormData({ 
      name: usr.name, 
      email: usr.email, 
      password: '', 
      role: usr.role, 
      branch: usr.branch || '',
      permissions: usr.permissions || []
    });
    setEditingId(usr._id);
    setShowModal(true);
  };

  const deleteUser = async (id) => {
    showConfirm('Are you sure?', async () => {
      try {
        await api.delete(`/users/${id}/`);
        showNotification('User purged successfully');
        fetchUsers();
      } catch (err) {
        console.error(err);
        showNotification('Failed to purge user', 'error');
      }
    });
  };

  if (user?.role !== 'Super Admin' && user?.role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <ShieldAlert size={64} className="text-red-500 mb-6 opacity-80" />
        <h2 className="text-2xl font-bold text-main tracking-tight mb-2">Access Restricted</h2>
        <p className="text-dim">Clearance Level: Tier 1 (Super Admin) Required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 border-b border-main pb-6">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center">
            <UsersIcon className="mr-3 text-teal-500" size={28} />
            User Management
          </h1>
        </div>
        <div className="flex space-x-3">
          <label className="glass-panel flex items-center px-5 py-2.5 text-sm font-medium bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 transition-all cursor-pointer">
            <Upload size={18} className="mr-2" /> Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button onClick={() => { setEditingId(null); setFormData({ name: '', email: '', password: '', role: 'Staff', branch: '', permissions: ['Dashboard:VIEW', 'Assets:VIEW', 'Maintenance:VIEW', 'Projects:VIEW'] }); setShowModal(true); }} className="glass-button flex items-center px-5 py-2.5 text-sm shrink-0">
            <Plus size={18} className="mr-2" />
            Create Identity
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden animate-slide-up delay-100 border border-main bg-card shadow-sm">
        <div className="p-5 border-b border-main bg-panel flex items-center">
           <UsersIcon size={20} className="text-teal-500 mr-3" />
           <h2 className="font-semibold text-main tracking-wide">Registered Personnel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main">
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Identity</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Clearance Role</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Operational Zone</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider">Page Access</th>
                <th className="p-5 text-xs font-semibold text-main uppercase tracking-wider text-right">Directives</th>
              </tr>
            </thead>
            <tbody className="divide-y border-main">
              {(() => {
                const indexOfLastItem = currentPage * itemsPerPage;
                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                const currentItems = users.slice(indexOfFirstItem, indexOfLastItem);

                if (currentItems.length === 0 && users.length > 0 && currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }

                return currentItems.map((usr) => (
                  <tr key={usr._id} className="hover:bg-panel transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-md bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-lg font-bold text-teal-600">
                          {usr.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-main tracking-wide">{usr.name}</div>
                          <div className="text-xs text-secondary mt-0.5">{usr.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${
                        usr.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                        usr.role === 'Admin' ? 'bg-teal-500/10 text-teal-600 border-teal-500/20' :
                        'bg-slate-500/10 text-secondary border-main'
                      }`}>
                        {usr.role === 'Super Admin' && <ShieldAlert size={10} className="mr-1.5" />}
                        {usr.role}
                      </span>
                    </td>
                    <td className="p-5 text-sm font-medium text-secondary">
                      {usr.branch ? (
                        <span className="px-3 py-1 bg-panel rounded border border-main">{usr.branch}</span>
                      ) : (
                        <span className="text-secondary italic">Global Access</span>
                      )}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-wrap gap-1.5 max-w-[300px] max-h-24 overflow-y-auto pr-2 custom-scrollbar py-1">
                        {usr.role === 'Super Admin' ? (
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 shadow-sm">Full System Access</span>
                        ) : (usr.permissions || []).length > 0 ? (
                          usr.permissions.map((perm, idx) => {
                            const [page, type] = perm.split(':');
                            const isEdit = type === 'EDIT';
                            return (
                              <span key={idx} className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-tighter flex items-center transition-all hover:scale-105 ${
                                isEdit ? 'bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]' : 'bg-teal-500/20 text-teal-600 border-teal-500/30 shadow-[0_0_8px_rgba(20,184,166,0.1)]'
                              }`}>
                                {page} <span className="ml-1 opacity-60 font-black">{isEdit ? '(E)' : '(V)'}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[10px] text-secondary italic">No Access Assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end space-x-2 transition-all">
                        <button onClick={() => editUser(usr)} className="p-2.5 text-teal-600 bg-teal-500/10 hover:bg-teal-500 hover:text-white rounded-xl transition-all border border-teal-500/20 group">
                          <Edit2 size={16} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <button onClick={() => deleteUser(usr._id)} className="p-2.5 text-red-600 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 group">
                          <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-secondary italic">
                    No personnel found in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {users.length > itemsPerPage && (
          <div className="p-4 border-t border-main bg-panel flex items-center justify-between">
            <div className="text-xs font-bold text-secondary uppercase tracking-widest">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, users.length)} to {Math.min(currentPage * itemsPerPage, users.length)} of {users.length} Personnel
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-panel border border-main rounded-lg text-xs font-bold text-secondary hover:text-main hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
              >
                Previous
              </button>
              {Array.from({ length: Math.ceil(users.length / itemsPerPage) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${
                    currentPage === i + 1 
                      ? 'bg-teal-500 text-white shadow-sm' 
                      : 'bg-panel text-secondary hover:bg-card border border-main'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(users.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(users.length / itemsPerPage)}
                className="px-4 py-2 bg-panel border border-main rounded-lg text-xs font-bold text-secondary hover:text-main hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-all uppercase tracking-widest"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-main shadow-2xl my-8">
            <div className="p-8 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-2xl font-black text-main tracking-tight uppercase">
                  {editingId ? 'Modify Personnel' : 'Initialize Identity'}
                </h2>
                <p className="text-xs text-secondary mt-1 uppercase tracking-widest font-black">Security Clearance Protocol</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-xl text-dim hover:text-main transition-all">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Full Designation (Name)</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-teal-500 transition-all" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Comms Address (Email)</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-teal-500 transition-all" placeholder="john@domain.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">
                    Security Passcode {editingId && <span className="text-secondary normal-case tracking-normal">(Leave blank to retain)</span>}
                  </label>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingId} className="glass-input w-full p-3 bg-panel border-main focus:border-teal-500 transition-all" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Clearance Level (Role)</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="glass-input w-full p-3 cursor-pointer [&>option]:bg-card [&>option]:text-main border-main focus:border-teal-500 transition-all">
                    <option value="Staff">Staff / Technician (Tier 3)</option>
                    <option value="Admin">Admin / Site Manager (Tier 2)</option>
                    <option value="Super Admin">Super Admin (Tier 1)</option>
                  </select>
                </div>
                {formData.role !== 'Super Admin' && (
                  <div className="animate-slide-up md:col-span-2">
                    <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-2">Operational Zone (Branch)</label>
                    <input type="text" name="branch" value={formData.branch} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-teal-500 transition-all" placeholder="e.g. Main Campus" />
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-main">
                <label className="block text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-4">Operational Directives (Permissions)</label>
                <div className="space-y-4">
                  {(() => {
                    const pages = [
                      'Dashboard', 'Assets', 'Maintenance', 'Storage', 
                      'Identity', 'Network', 'Projects', 
                      'Routes', 'Logs', 'Reports', 'Users', 'Onboarding'
                    ];

                    const toggleAll = (type) => {
                      const allPermsForType = pages.map(p => `${p}:${type}`);
                      const allCurrentOfType = formData.permissions.filter(p => p.endsWith(`:${type}`));
                      
                      if (allCurrentOfType.length === pages.length) {
                        setFormData({ 
                          ...formData, 
                          permissions: formData.permissions.filter(p => !p.endsWith(`:${type}`)) 
                        });
                      } else {
                        const otherPerms = formData.permissions.filter(p => !p.endsWith(`:${type}`));
                        setFormData({ 
                          ...formData, 
                          permissions: [...otherPerms, ...allPermsForType] 
                        });
                      }
                    };

                    return (
                      <>
                        <div className="flex items-center justify-between p-4 bg-teal-500/5 border border-teal-500/20 rounded-2xl mb-6 shadow-sm">
                          <span className="text-[10px] font-black text-teal-600 uppercase tracking-[0.3em]">Global Protocols</span>
                          <div className="flex space-x-6">
                            <button 
                              type="button"
                              onClick={() => toggleAll('VIEW')}
                              className="flex items-center space-x-3 bg-card px-3 py-1.5 rounded-xl border border-main hover:bg-panel transition-all shadow-sm"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${formData.permissions.filter(p => p.endsWith(':VIEW')).length === pages.length ? 'bg-teal-600 border-teal-500' : 'bg-panel border-main'}`}>
                                {formData.permissions.filter(p => p.endsWith(':VIEW')).length === pages.length && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                              </div>
                              <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Master View</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => toggleAll('EDIT')}
                              className="flex items-center space-x-3 bg-card px-3 py-1.5 rounded-xl border border-main hover:bg-panel transition-all shadow-sm"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${formData.permissions.filter(p => p.endsWith(':EDIT')).length === pages.length ? 'bg-amber-600 border-amber-500' : 'bg-panel border-main'}`}>
                                {formData.permissions.filter(p => p.endsWith(':EDIT')).length === pages.length && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                              </div>
                              <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Master Edit</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-3 custom-scrollbar p-1">
                          {pages.map(page => (
                            <div key={page} className="flex items-center justify-between p-3 bg-panel rounded-2xl border border-main hover:border-teal-500/30 transition-all group">
                              <span className="text-[11px] font-bold text-secondary group-hover:text-main transition-colors uppercase tracking-tight">{page}</span>
                              <div className="flex space-x-4">
                                {/* VIEW Toggle */}
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const perm = `${page}:VIEW`;
                                    const newPerms = formData.permissions.includes(perm)
                                      ? formData.permissions.filter(p => p !== perm)
                                      : [...formData.permissions, perm];
                                    setFormData({ ...formData, permissions: newPerms });
                                  }}
                                  className={`flex items-center space-x-1.5 transition-all group/btn`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${
                                    formData.permissions.includes(`${page}:VIEW`) 
                                      ? 'bg-teal-600 border-teal-500' 
                                      : 'bg-card border-main group-hover/btn:border-teal-500/50'
                                  }`}>
                                    {formData.permissions.includes(`${page}:VIEW`) && <div className="w-1 h-1 bg-white rounded-sm"></div>}
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${formData.permissions.includes(`${page}:VIEW`) ? 'text-teal-600' : 'text-secondary'}`}>V</span>
                                </button>

                                {/* EDIT Toggle */}
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const perm = `${page}:EDIT`;
                                    const newPerms = formData.permissions.includes(perm)
                                      ? formData.permissions.filter(p => p !== perm)
                                      : [...formData.permissions, perm];
                                    setFormData({ ...formData, permissions: newPerms });
                                  }}
                                  className={`flex items-center space-x-1.5 transition-all group/btn`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${
                                    formData.permissions.includes(`${page}:EDIT`) 
                                      ? 'bg-amber-500 border-amber-400' 
                                      : 'bg-card border-main group-hover/btn:border-amber-500/50'
                                  }`}>
                                    {formData.permissions.includes(`${page}:EDIT`) && <div className="w-1 h-1 bg-white rounded-sm"></div>}
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${formData.permissions.includes(`${page}:EDIT`) ? 'text-amber-500' : 'text-secondary'}`}>E</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-10 pt-8 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-main hover:bg-panel rounded-2xl transition-all">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className={`neon-button px-10 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {submitting ? 'Processing...' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
