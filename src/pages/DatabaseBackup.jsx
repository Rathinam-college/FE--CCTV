import React, { useState, useRef } from 'react';
import { Database, Download, Upload, AlertTriangle, Trash2, CheckCircle2, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function DatabaseBackup() {
  const { user } = useAuthStore();
  const fileInputRef = useRef(null);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const isSuperAdmin = user?.role === 'Super Admin';
  
  const [selectedModels, setSelectedModels] = useState([]);
  const [deleteSelectedModels, setDeleteSelectedModels] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');

  React.useEffect(() => {
    const fetchMonths = async () => {
      try {
        const response = await api.get('/backup/?action=get_months');
        if (response.data && response.data.months) {
          setAvailableMonths(response.data.months);
        }
      } catch (err) {
        console.error("Failed to fetch months", err);
      }
    };
    if (isSuperAdmin) {
      fetchMonths();
    }
  }, [isSuperAdmin]);

  const datasetOptions = [
    { label: 'Cameras', value: 'cctv.camera' },
    { label: 'NVRs', value: 'cctv.nvr' },
    { label: 'Biometrics', value: 'cctv.biometric' },
    { label: 'Switches', value: 'cctv.networkswitch' },
    { label: 'Racks', value: 'cctv.rack' },
    { label: 'Tickets', value: 'maintenance.ticket' },
    { label: 'Projects', value: 'maintenance.project' },
    { label: 'Users', value: 'users.user' },
    { label: 'Activity Logs', value: 'cctv.activitylog' },
    { label: 'Locations', value: 'cctv.masterlocation' }
  ];

  const handleToggleModel = (value) => {
    setSelectedModels(prev => 
      prev.includes(value) ? prev.filter(m => m !== value) : [...prev, value]
    );
  };

  const handleSelectAll = () => {
    if (selectedModels.length === datasetOptions.length) {
      setSelectedModels([]);
    } else {
      setSelectedModels(datasetOptions.map(o => o.value));
    }
  };

  const handleDeleteToggleModel = (value) => {
    setDeleteSelectedModels(prev => 
      prev.includes(value) ? prev.filter(m => m !== value) : [...prev, value]
    );
  };

  const handleDeleteSelectAll = () => {
    if (deleteSelectedModels.length === datasetOptions.length) {
      setDeleteSelectedModels([]);
    } else {
      setDeleteSelectedModels(datasetOptions.map(o => o.value));
    }
  };

  const handleDownload = async (format = 'json') => {
    try {
      setLoadingDownload(true);
      setErrorMsg('');
      setSuccessMsg('');
      
      let urlEndpoint = `/backup/?export=1&format=${format}`;
      if (selectedModels.length > 0) {
        urlEndpoint += `&models=${selectedModels.join(',')}`;
      }
      if (selectedMonth) {
        urlEndpoint += `&month=${selectedMonth}`;
      }
      
      const response = await api.get(urlEndpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const fileExtension = format === 'sql' ? 'sql' : 'json';
      link.setAttribute('download', `cctv_backup_${new Date().toISOString().split('T')[0]}.${fileExtension}`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccessMsg(`Database backup downloaded successfully as ${fileExtension.toUpperCase()}!`);
    } catch (error) {
      console.error('Download error:', error);
      let errorText = 'Failed to download backup.';
      if (error.response && error.response.data && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          errorText = json.error || text;
        } catch (e) {
          errorText = await error.response.data.text();
        }
      } else if (error.response?.data?.error) {
        errorText = error.response.data.error;
      }
      setErrorMsg(errorText);
    } finally {
      setLoadingDownload(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json') && !file.name.endsWith('.sql')) {
      setErrorMsg('Please upload a valid JSON or SQL backup file.');
      return;
    }

    try {
      setLoadingUpload(true);
      setErrorMsg('');
      setSuccessMsg('');

      const formData = new FormData();
      formData.append('backup_file', file);

      const response = await api.post('/backup/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccessMsg(response.data.status || 'Database restored successfully!');
      
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMsg(error.response?.data?.error || 'Failed to restore database from backup.');
    } finally {
      setLoadingUpload(false);
    }
  };

  const handleClearDatabase = async () => {
    try {
      setLoadingDelete(true);
      setErrorMsg('');
      setSuccessMsg('');
      
      let urlEndpoint = '/backup/';
      if (deleteSelectedModels.length > 0) {
        urlEndpoint += `?models=${deleteSelectedModels.join(',')}`;
      } else {
        setErrorMsg('Please select at least one dataset to clear.');
        setLoadingDelete(false);
        return;
      }
      
      await api.delete(urlEndpoint);
      
      setSuccessMsg('Selected database data cleared successfully!');
      setShowConfirm(false);
      setDeleteSelectedModels([]);
    } catch (error) {
      console.error('Delete error:', error);
      setErrorMsg(error.response?.data?.error || 'Failed to clear database.');
    } finally {
      setLoadingDelete(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="text-amber-500 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-main">Access Denied</h2>
        <p className="text-secondary mt-2">Only Super Admins can access database backup and wipe functions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-teal-500/10 text-teal-600 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-main tracking-tight">Database Management</h1>
            <p className="text-secondary text-sm">Backup or clear your CCTV datasets</p>
          </div>
        </div>
        <a 
          href={window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/cctv/admin/' : '/cctv/admin/'}
          target="_blank" 
          rel="noopener noreferrer"
          className="px-4 py-2.5 bg-panel border border-main text-secondary hover:text-teal-600 hover:border-teal-500/30 rounded-xl font-bold text-sm transition-all flex items-center space-x-2 shadow-sm"
        >
          <span>Open Django Admin</span>
          <ExternalLink size={16} />
        </a>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl flex items-center space-x-3 animate-fade-in">
          <CheckCircle2 size={20} />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl flex items-center space-x-3 animate-fade-in">
          <AlertTriangle size={20} />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-main p-6 flex flex-col items-start space-y-4">
          <div className="w-12 h-12 bg-teal-500/10 text-teal-600 rounded-full flex items-center justify-center">
            <Download size={24} />
          </div>
          <h3 className="text-xl font-bold text-main">Download Backup</h3>
          <p className="text-secondary text-sm">
            Download a JSON dump of your database. Select specific datasets below or leave empty to download everything.
          </p>

          <div className="w-full bg-panel rounded-xl p-4 space-y-3 flex-1">
            <div className="flex items-center justify-between border-b border-main pb-2">
              <span className="font-bold text-sm text-main">Filter by Month</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-card border border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              <option value="">All Time (No Filter)</option>
              {availableMonths.map(month => {
                const dateObj = new Date(month + '-01');
                const label = dateObj.toLocaleDateString('default', { month: 'long', year: 'numeric' });
                return (
                  <option key={month} value={month}>{label}</option>
                );
              })}
            </select>
          </div>

          <div className="w-full bg-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-main pb-2">
              <span className="font-bold text-sm text-main">Select Datasets</span>
              <button 
                onClick={handleSelectAll}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 uppercase tracking-wider"
              >
                {selectedModels.length === datasetOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {datasetOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600/20 cursor-pointer"
                      checked={selectedModels.includes(option.value)}
                      onChange={() => handleToggleModel(option.value)}
                    />
                  </div>
                  <span className="text-sm font-medium text-secondary group-hover:text-main transition-colors select-none">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="w-full flex space-x-2">
            <button
              onClick={() => handleDownload('json')}
              disabled={loadingDownload}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <Download size={18} />
              <span>{loadingDownload ? 'Generating...' : 'Download JSON'}</span>
            </button>
            <button
              onClick={() => handleDownload('sql')}
              disabled={loadingDownload}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <Database size={18} />
              <span>{loadingDownload ? 'Generating...' : 'Full SQL Dump'}</span>
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-main p-6 flex flex-col items-start space-y-4">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 rounded-full flex items-center justify-center">
            <Upload size={24} />
          </div>
          <h3 className="text-xl font-bold text-main">Restore Data</h3>
          <p className="text-secondary text-sm flex-1">
            Upload a previously downloaded JSON backup file or an SQL file to instantly restore your data. The data will be safely updated in your database.
          </p>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json,application/json,.sql" 
            className="hidden" 
          />

          <button
            onClick={handleUploadClick}
            disabled={loadingUpload}
            className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            <Upload size={18} />
            <span>{loadingUpload ? 'Uploading & Restoring...' : 'Upload JSON / SQL Backup'}</span>
          </button>
        </div>

        {/* Danger Zone Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-rose-200 p-6 flex flex-col items-start space-y-4 relative overflow-hidden md:col-span-2">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-bl-[100px] -z-10" />
          <div className="w-12 h-12 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center">
            <Trash2 size={24} />
          </div>
          <h3 className="text-xl font-bold text-rose-600">Danger Zone</h3>
          <p className="text-secondary text-sm flex-1">
            Permanently clear selected core data. User accounts and settings are preserved. This action cannot be undone!
          </p>

          <div className="w-full bg-rose-50 rounded-xl p-4 space-y-3 relative z-10 border border-rose-100">
            <div className="flex items-center justify-between border-b border-rose-200 pb-2">
              <span className="font-bold text-sm text-rose-800">Select Datasets to Delete</span>
              <button 
                onClick={handleDeleteSelectAll}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 uppercase tracking-wider"
              >
                {deleteSelectedModels.length === datasetOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {datasetOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      className="peer w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-600/20 cursor-pointer"
                      checked={deleteSelectedModels.includes(option.value)}
                      onChange={() => handleDeleteToggleModel(option.value)}
                    />
                  </div>
                  <span className="text-sm font-medium text-rose-800/80 group-hover:text-rose-900 transition-colors select-none">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {!showConfirm ? (
            <button
              onClick={() => {
                if(deleteSelectedModels.length === 0) {
                  setErrorMsg('Please select at least one dataset to clear.');
                  return;
                }
                setShowConfirm(true);
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-rose-100 text-rose-600 hover:bg-rose-200 rounded-xl font-bold transition-colors z-10 relative"
            >
              <Trash2 size={18} />
              <span>Clear Selected Data</span>
            </button>
          ) : (
            <div className="w-full p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 animate-fade-in">
              <p className="text-sm font-bold text-rose-700 text-center">Are you absolutely sure?</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearDatabase}
                  disabled={loadingDelete}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-500 transition-colors disabled:opacity-50"
                >
                  {loadingDelete ? 'Wiping...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
