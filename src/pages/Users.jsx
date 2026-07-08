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
    const { name, value } = e.target;
    let newValue = value;
    if (typeof newValue === 'string' && !['email', 'password', 'role'].includes(name)) {
      newValue = newValue.toUpperCase();
    }
    setFormData({ ...formData, [name]: newValue });
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
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10 px-4 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <UsersIcon className="mr-3 text-cyan-400" size={28} />
            User Management
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <label className="flex items-center text-[12px] font-bold text-slate-355 hover:text-white transition-colors cursor-pointer">
            <Upload size={14} className="mr-2" /> Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          <button 
            onClick={() => { setEditingId(null); setFormData({ name: '', email: '', password: '', role: 'Staff', branch: '', permissions: ['Dashboard:VIEW', 'Assets:VIEW', 'Maintenance:VIEW', 'Projects:VIEW'] }); setShowModal(true); }}
            className="flex items-center bg-cyan-400 hover:bg-cyan-500 text-slate-900 px-4 py-2 rounded font-bold text-[13px] transition-colors ml-2"
          >
            <Plus size={16} className="mr-2" /> Create Identity
          </button>
        </div>
      </div>

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-100">
        <div className="p-5 border-b border-main bg-card flex items-center">
           <UsersIcon size={16} className="text-cyan-400 mr-2" />
           <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Personnel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="p-4">Identity</th>
                <th className="p-4">Clearance Role</th>
                <th className="p-4">Operational Zone</th>
                <th className="p-4">Page Access</th>
                <th className="p-4 text-right">Directives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-350">
              {(() => {
                const indexOfLastItem = currentPage * itemsPerPage;
                const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                const currentItems = users.slice(indexOfFirstItem, indexOfLastItem);

                if (currentItems.length === 0 && users.length > 0 && currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }

                return currentItems.map((usr) => (
                  <tr key={usr._id} className="hover:bg-slate-700/30 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 flex items-center justify-center text-sm font-bold shrink-0">
                          {usr.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 tracking-wide text-xs">{usr.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{usr.email}</div>
                          {user?.role === 'Super Admin' && (
                            <div className="text-[9px] text-amber-500 font-mono mt-0.5">
                              Pass: {usr.raw_password || 'Not Set'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${
                        usr.role === 'Super Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        usr.role === 'Admin' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                        'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {usr.role === 'Super Admin' && <ShieldAlert size={10} className="mr-1" />}
                        {usr.role}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-400">
                      {usr.branch ? (
                        <span className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-350">{usr.branch}</span>
                      ) : (
                        <span className="text-slate-550 italic">Global Access</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[300px] max-h-24 overflow-y-auto pr-2 custom-scrollbar py-1">
                        {usr.role === 'Super Admin' ? (
                          <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 shadow-sm">Full System Access</span>
                        ) : (usr.permissions || []).length > 0 ? (
                          usr.permissions.map((perm, idx) => {
                            const [page, type] = perm.split(':');
                            const isEdit = type === 'EDIT';
                            return (
                              <span key={idx} className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-tighter flex items-center transition-all ${
                                isEdit ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                              }`}>
                                {page} <span className="ml-1 opacity-60 font-black">{isEdit ? '(E)' : '(V)'}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[9px] text-slate-500 italic">No Access Assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => editUser(usr)} className="text-xs font-bold text-cyan-400 hover:text-white transition-colors uppercase tracking-widest">
                          Edit
                        </button>
                        <button onClick={() => deleteUser(usr._id)} className="text-xs font-bold text-rose-500 hover:text-rose-450 transition-colors uppercase tracking-widest">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500 italic text-xs uppercase tracking-widest">
                    No personnel found in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {users.length > itemsPerPage && (
          <div className="p-4 border-t border-main bg-card flex items-center justify-between">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Showing {Math.min((currentPage - 1) * itemsPerPage + 1, users.length)} to {Math.min(currentPage * itemsPerPage, users.length)} of {users.length} Personnel
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded text-xs font-bold uppercase tracking-widest"
              >
                Previous
              </button>
              {Array.from({ length: Math.ceil(users.length / itemsPerPage) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded text-xs font-bold transition-all uppercase tracking-widest ${
                    currentPage === i + 1 
                      ? 'bg-cyan-400 text-slate-900 shadow-sm' 
                      : 'bg-slate-800 text-slate-350 hover:bg-slate-750 border border-slate-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(users.length / itemsPerPage)))}
                disabled={currentPage === Math.ceil(users.length / itemsPerPage)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-750 disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded text-xs font-bold uppercase tracking-widest"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-card rounded-[2.5rem] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-main shadow-2xl my-8">
            <div className="p-6 border-b border-main bg-panel flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-main tracking-tight uppercase">
                  {editingId ? 'Modify Personnel' : 'Initialize Identity'}
                </h2>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Security Clearance Protocol</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Full Designation (Name)</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg text-xs" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Comms Address (Email)</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg text-xs" placeholder="john@domain.com" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">
                    Security Passcode {editingId && <span className="text-dim normal-case tracking-normal">(Leave blank to retain)</span>}
                  </label>
                  <input type="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingId} className="glass-input w-full p-3 bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg text-xs" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Clearance Level (Role)</label>
                  <select name="role" value={formData.role} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg text-xs cursor-pointer [&>option]:bg-slate-900 [&>option]:text-slate-200">
                    <option value="Staff">Staff / Technician (Tier 3)</option>
                    <option value="Admin">Admin / Site Manager (Tier 2)</option>
                    <option value="Super Admin">Super Admin (Tier 1)</option>
                  </select>
                </div>
                {formData.role !== 'Super Admin' && (
                  <div className="animate-slide-up md:col-span-2">
                    <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Operational Zone (Branch)</label>
                    <input type="text" name="branch" value={formData.branch} onChange={handleInputChange} className="glass-input w-full p-3 bg-panel border-main focus:border-cyan-500 text-main font-bold rounded-lg text-xs" placeholder="e.g. Main Campus" />
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-main">
                <label className="block text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">Operational Directives (Permissions)</label>
                <div className="space-y-4">
                  {(() => {
                    const pages = [
                      'Dashboard', 'Cameras', 'NVRs', 'Biometrics', 'Network Switches', 'Racks',
                      'Tickets', 'Upgrades', 'Projects', 'Billing & PO', 'General Billing',
                      'Reports', 'Divisions', 'Brands', 'Onboarding', 'Activity Logs',
                      'Database Backup', 'User Management'
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
                        <div className="flex items-center justify-between p-4 bg-cyan-400/5 border border-cyan-500/15 rounded-md mb-4">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Global Protocols</span>
                          <div className="flex space-x-4">
                            <button 
                              type="button"
                              onClick={() => toggleAll('VIEW')}
                              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${formData.permissions.filter(p => p.endsWith(':VIEW')).length === pages.length ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-900 border-slate-700'}`}>
                                {formData.permissions.filter(p => p.endsWith(':VIEW')).length === pages.length && <div className="w-1.5 h-1.5 bg-slate-900 rounded-sm"></div>}
                              </div>
                              <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Master View</span>
                            </button>
                            <button 
                              type="button"
                              onClick={() => toggleAll('EDIT')}
                              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-750 px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${formData.permissions.filter(p => p.endsWith(':EDIT')).length === pages.length ? 'bg-amber-500 border-amber-400' : 'bg-slate-900 border-slate-700'}`}>
                                {formData.permissions.filter(p => p.endsWith(':EDIT')).length === pages.length && <div className="w-1.5 h-1.5 bg-slate-900 rounded-sm"></div>}
                              </div>
                              <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">Master Edit</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar p-1">
                          {pages.map(page => (
                            <div key={page} className="flex items-center justify-between p-3 bg-panel rounded border border-main hover:border-cyan-500/20 transition-colors group">
                              <span className="text-[11px] font-bold text-secondary group-hover:text-main transition-colors uppercase tracking-tight">
                                {page}
                              </span>
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
                                  className="flex items-center space-x-1.5 transition-all"
                                >
                                  <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${
                                    formData.permissions.includes(`${page}:VIEW`) 
                                      ? 'bg-cyan-500 border-cyan-400' 
                                      : 'bg-slate-900 border-slate-700 hover:border-cyan-500/50'
                                  }`}>
                                    {formData.permissions.includes(`${page}:VIEW`) && <div className="w-1.5 h-1.5 bg-slate-900 rounded-sm"></div>}
                                  </div>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest ${formData.permissions.includes(`${page}:VIEW`) ? 'text-cyan-400' : 'text-dim'}`}>V</span>
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
                                  className="flex items-center space-x-1.5 transition-all"
                                >
                                  <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${
                                    formData.permissions.includes(`${page}:EDIT`) 
                                      ? 'bg-amber-500 border-amber-400' 
                                      : 'bg-slate-900 border-slate-700 hover:border-amber-500/50'
                                  }`}>
                                    {formData.permissions.includes(`${page}:EDIT`) && <div className="w-1.5 h-1.5 bg-slate-900 rounded-sm"></div>}
                                  </div>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest ${formData.permissions.includes(`${page}:EDIT`) ? 'text-amber-500' : 'text-dim'}`}>E</span>
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
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-main">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-main rounded transition-colors">
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-8 py-2.5 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
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
