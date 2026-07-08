import React, { useState, useEffect } from 'react';
import { Search, Activity, User, Monitor, Calendar, Filter, Download } from 'lucide-react';
import api from '../services/api';

export default function EntryView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showNewEntriesOnly, setShowNewEntriesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, startMonth, endMonth, showErrorsOnly, showNewEntriesOnly]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/cameras/logs/');
      if (Array.isArray(response.data)) {
        setLogs(response.data);
      } else if (response.data.results) {
        setLogs(response.data.results);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const pageNameMapping = {
    'Cameras': 'Camera',
    'NVR': 'NVR',
    'Biometrics': 'Biometric',
    'NetworkSwitches': 'Switches',
    'Racks': 'Racks',
    'Maintenance': 'Ticket',
    'Upgrades': 'Upgrade',
    'Projects': 'Projects',
    'GeneralBilling': 'General Billing',
    'Division': 'Division',
    'Brand': 'Brands',
    'Brands': 'Brands',
    'MasterLocation': 'Add New Site'
  };

  const getDisplayPageName = (rawName) => {
    return pageNameMapping[rawName] || rawName;
  };

  const getUniquePages = () => {
    const pages = new Set(logs.map(log => log.page));
    return ['All', ...Array.from(pages)].filter(Boolean);
  };

  const filteredLogs = logs.filter(log => {
    if (startMonth || endMonth) {
      const logDate = log.timestamp?.split('T')[0] || '';
      if (logDate) {
        const logMonth = logDate.substring(0, 7);
        if (startMonth && logMonth < startMonth) return false;
        if (endMonth && logMonth > endMonth) return false;
      }
    }

    const matchesSearch = 
      (log.userName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      getDisplayPageName(log.page).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'All' || log.page === filterType;
    const matchesError = showErrorsOnly ? (log.action || '').toUpperCase().includes('ERROR') : true;
    const matchesNew = showNewEntriesOnly ? ['CREATE', 'UPLOAD'].includes((log.action || '').toUpperCase()) : true;

    return matchesSearch && matchesFilter && matchesError && matchesNew;
  });

  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + rowsPerPage);

  const handleDownload = () => {
    if (filteredLogs.length === 0) return;
    
    const headers = ['Date', 'User Name', 'User Email/IP', 'Section', 'Action', 'Details'];
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredLogs.map(log => [
      formatDate(log.timestamp),
      escapeCSV(log.userName || 'System'),
      escapeCSV(log.userEmail || log.ipAddress || 'Unknown'),
      escapeCSV(getDisplayPageName(log.page)),
      escapeCSV(log.action),
      escapeCSV(log.details)
    ]);

    const csvContent = "\uFEFF" + [ 
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Activity_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-10 px-4 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <h1 className="text-3xl font-bold text-main tracking-tight flex items-center uppercase">
            <Activity className="mr-3 text-cyan-400" size={28} />
            Entry View Logs
          </h1>
        </div>
        <div className="flex space-x-4 items-center">
          <button 
            onClick={handleDownload}
            disabled={filteredLogs.length === 0}
            className="flex items-center text-[12px] font-bold text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <Download size={14} className="mr-2" /> Export CSV
          </button>
        </div>
      </div>

      {/* Query Filter row */}
      <div className="flex flex-col sm:flex-row gap-4 animate-slide-up delay-200 mt-6 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by user, action, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-panel text-sm text-main border border-main rounded-md w-full pl-10 pr-4 py-3 outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-panel px-4 py-2 rounded-md border border-main">
          <Calendar size={16} className="text-dim" />
          <input 
            type="date" 
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className="bg-panel text-main text-xs font-bold rounded px-3 py-1.5 outline-none border border-main focus:border-cyan-500 w-36 cursor-pointer"
            title="Start Date"
          />
          <span className="text-dim text-xs">to</span>
          <input 
            type="date" 
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            className="bg-panel text-main text-xs font-bold rounded px-3 py-1.5 outline-none border border-main focus:border-cyan-500 w-36 cursor-pointer"
            title="End Date"
          />
        </div>
      </div>

      {/* Section and checkbox row */}
      <div className="flex flex-wrap items-center gap-4 bg-panel/40 p-4 rounded-md border border-main">
        <div className="flex-1 min-w-[200px] flex items-center space-x-3">
          <span className="text-xs font-bold text-secondary uppercase tracking-widest">Section:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-panel text-main text-xs font-bold rounded px-3 py-2 outline-none border border-main focus:border-cyan-500 cursor-pointer flex-1"
          >
            <option value="All">All Sections</option>
            {getUniquePages().filter(p => p !== 'All').map(page => (
              <option key={page} value={page}>{getDisplayPageName(page)}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-xs font-bold text-secondary cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showNewEntriesOnly}
              onChange={(e) => {
                setShowNewEntriesOnly(e.target.checked);
                if (e.target.checked) setShowErrorsOnly(false);
              }}
              className="accent-cyan-400 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-emerald-450">New Entries</span>
          </label>

          <label className="flex items-center space-x-2 text-xs font-bold text-secondary cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={showErrorsOnly}
              onChange={(e) => {
                setShowErrorsOnly(e.target.checked);
                if (e.target.checked) setShowNewEntriesOnly(false);
              }}
              className="accent-cyan-400 w-4 h-4 rounded cursor-pointer"
            />
            <span className="text-rose-500">Errors Only</span>
          </label>
        </div>

        <button 
          onClick={() => {
            setSearchTerm('');
            setStartMonth('');
            setEndMonth('');
            setFilterType('All');
            setShowErrorsOnly(false);
            setShowNewEntriesOnly(false);
          }}
          className="text-xs font-bold text-secondary hover:text-main border border-main px-4 py-2 bg-panel rounded transition-colors ml-auto uppercase tracking-widest"
        >
          Reset Filters
        </button>
      </div>

      <div className="bg-panel border border-main rounded-md overflow-hidden animate-slide-up delay-300">
        {/* Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-main bg-card">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">SHOW</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-panel text-main text-xs font-bold rounded px-2.5 py-1 outline-none border border-main focus:border-cyan-500 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-secondary hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                {startIndex + 1}-{Math.min(startIndex + rowsPerPage, filteredLogs.length)} OF {filteredLogs.length}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredLogs.length / rowsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(filteredLogs.length / rowsPerPage)}
                className="text-secondary hover:text-main disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-panel border-b border-main text-[10px] font-bold text-secondary uppercase tracking-widest">
                <th className="p-4 w-1/5">User</th>
                <th className="p-4 w-1/6">Section</th>
                <th className="p-4 w-1/6">Action</th>
                <th className="p-4 w-1/3">Details</th>
                <th className="p-4 w-1/6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-secondary">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dim">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-widest">Loading entries...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-dim">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Activity size={32} className="text-dim mb-2" />
                      <p className="text-xs font-bold uppercase tracking-widest">No entries found</p>
                      <p className="text-xs text-dim">Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const actionUpper = (log.action || '').toUpperCase();
                  const isError = actionUpper.includes('ERROR');
                  const isNew = ['CREATE', 'UPLOAD'].includes(actionUpper);
                  
                  let rowBg = '';
                  if (isError) rowBg = 'bg-red-500/5 hover:bg-red-500/10';
                  else if (isNew) rowBg = 'bg-emerald-500/5 hover:bg-emerald-500/10';
                  else rowBg = 'hover:bg-slate-700/30';
 
                  let iconBg = 'bg-slate-800 text-slate-400';
                  if (isError) iconBg = 'bg-red-500/20 text-red-400';
                  else if (isNew) iconBg = 'bg-emerald-500/20 text-emerald-400';
 
                  let textNameColor = 'text-main';
                  if (isError) textNameColor = 'text-red-450';
                  else if (isNew) textNameColor = 'text-emerald-450';
 
                  let badgeStyle = 'bg-panel text-secondary border border-main';
                  if (isError) badgeStyle = 'bg-red-550 border border-red-500/30 text-red-100';
                  else if (isNew) badgeStyle = 'bg-emerald-550 border border-emerald-500/30 text-emerald-100';
 
                  let detailsColor = 'text-secondary';
                  if (isError) detailsColor = 'text-red-400 font-bold';
                  else if (isNew) detailsColor = 'text-emerald-400 font-bold';
 
                  return (
                    <tr key={log.id} className={`transition-colors ${rowBg}`}>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                            <User size={14} />
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${textNameColor}`}>{log.userName || 'System'}</p>
                            <p className="text-[10px] text-dim font-mono mt-0.5">{log.userEmail || log.ipAddress || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 text-secondary">
                          <Monitor size={14} />
                          <span className="text-xs font-bold uppercase tracking-wider">{getDisplayPageName(log.page)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className={`text-xs break-words ${detailsColor}`}>
                          {log.details || '—'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 text-dim">
                          <Calendar size={14} className="shrink-0" />
                          <span className="text-[10px] whitespace-nowrap">{formatDate(log.timestamp)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
