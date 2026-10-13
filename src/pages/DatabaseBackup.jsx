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
    { label: 'Divisions', value: 'cctv.division' },
    { label: 'Brands', value: 'cctv.brand' },
    { label: 'Blocks', value: 'cctv.block' },
    { label: 'Floors', value: 'cctv.floor' },
    { label: 'Rooms', value: 'cctv.room' },
    { label: 'General Billing', value: 'maintenance.generalbillinginfo' }
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
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10 px-4 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Database className="mr-3 text-cyan-400" size={28} />
            Database & Backups
          </h1>
        </div>
        <a 
          href={window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000/cctv/admin/' : '/cctv/admin/'}
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-[12px] font-bold text-secondary hover:text-main transition-colors"
        >
          Open Django Admin <ExternalLink size={12} className="ml-1.5" />
        </a>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md flex items-center space-x-3 animate-fade-in text-xs font-bold uppercase tracking-wider">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-md flex items-center space-x-3 animate-fade-in text-xs font-bold uppercase tracking-wider">
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group">
          <div className="flex items-start space-x-4 mb-4">
            <div className="w-10 h-10 flex items-center justify-center rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 shrink-0">
              <Download size={20} />
            </div>
            <div>
              <h3 className="text-md font-bold text-main uppercase tracking-wider">Download Backup</h3>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-widest mt-1">
                Select datasets or month to dump DB.
              </p>
            </div>
          </div>

          <div className="w-full bg-slate-800/40 rounded-md border border-slate-700/50 p-4 space-y-3 flex-1 mb-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
              <span className="font-bold text-xs text-secondary uppercase">Filter by Month</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 cursor-pointer"
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

          <div className="w-full bg-slate-800/40 rounded-md border border-slate-700/50 p-4 space-y-3 mb-4">
            <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
              <span className="font-bold text-xs text-secondary uppercase">Select Datasets</span>
              <button 
                onClick={handleSelectAll}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-widest"
              >
                {selectedModels.length === datasetOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 text-secondary">
              {datasetOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group select-none">
                  <input 
                    type="checkbox" 
                    className="accent-cyan-400 w-4 h-4 rounded cursor-pointer bg-slate-800 border-slate-700"
                    checked={selectedModels.includes(option.value)}
                    onChange={() => handleToggleModel(option.value)}
                  />
                  <span className="text-xs font-bold text-secondary group-hover:text-main transition-colors">
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
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded font-bold text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              <span>{loadingDownload ? 'Generating...' : 'JSON'}</span>
            </button>
            <button
              onClick={() => handleDownload('sql')}
              disabled={loadingDownload}
              className="flex-1 flex items-center justify-center space-x-2 py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded font-bold text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <Database size={14} />
              <span>{loadingDownload ? 'Generating...' : 'SQL Dump'}</span>
            </button>
          </div>
        </div>

        {/* Restore Card */}
        <div className="bg-panel border border-main rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group">
          <div className="flex items-start space-x-4 mb-4">
            <div className="w-10 h-10 flex items-center justify-center rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/10 shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <h3 className="text-md font-bold text-main uppercase tracking-wider">Restore Data</h3>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-widest mt-1">
                Import JSON or SQL files to overwrite database.
              </p>
            </div>
          </div>
          <p className="text-xs text-dim leading-relaxed mb-6">
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
            className="w-full flex items-center justify-center space-x-2 py-3 bg-cyan-400 hover:bg-cyan-500 text-slate-900 rounded font-bold text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
          >
            <Upload size={14} />
            <span>{loadingUpload ? 'Uploading & Restoring...' : 'Upload Backup File'}</span>
          </button>
        </div>

        {/* Danger Zone Card */}
        <div className="bg-panel border border-rose-500/30 rounded-md p-5 flex flex-col justify-between overflow-hidden relative transition-all group md:col-span-2">
          <div className="flex items-start space-x-4 mb-4">
            <div className="w-10 h-10 flex items-center justify-center rounded bg-rose-500/10 text-rose-500 border border-rose-500/10 shrink-0">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-md font-bold text-rose-500 uppercase tracking-wider">Danger Zone</h3>
              <p className="text-[11px] text-secondary font-bold uppercase tracking-widest mt-1">
                Permanently clear selected core datasets.
              </p>
            </div>
          </div>

          <div className="w-full bg-rose-500/5 rounded-md p-4 space-y-3 border border-rose-500/15 mb-4">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
              <span className="font-bold text-xs text-rose-400 uppercase">Select Datasets to Delete</span>
              <button 
                onClick={handleDeleteSelectAll}
                className="text-[10px] font-bold text-rose-450 hover:text-rose-400 uppercase tracking-widest"
              >
                {deleteSelectedModels.length === datasetOptions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 text-rose-400">
              {datasetOptions.map(option => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group select-none">
                  <input 
                    type="checkbox" 
                    className="accent-rose-500 w-4 h-4 rounded cursor-pointer bg-slate-800 border-slate-700"
                    checked={deleteSelectedModels.includes(option.value)}
                    onChange={() => handleDeleteToggleModel(option.value)}
                  />
                  <span className="text-xs font-bold text-rose-400 group-hover:text-rose-300 transition-colors">
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
              className="w-full flex items-center justify-center space-x-2 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded font-bold text-xs font-bold uppercase tracking-widest transition-colors border border-rose-500/25"
            >
              <Trash2 size={14} />
              <span>Clear Selected Data</span>
            </button>
          ) : (
            <div className="w-full p-4 bg-rose-500/5 border border-rose-500/20 rounded-md space-y-3 animate-fade-in">
              <p className="text-xs font-bold text-rose-400 uppercase tracking-widest text-center">Are you absolutely sure?</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-350 border border-slate-700 rounded text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearDatabase}
                  disabled={loadingDelete}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
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
