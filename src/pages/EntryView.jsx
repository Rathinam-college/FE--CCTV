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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
          <Activity size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-main tracking-tight">Entry View</h1>
          <p className="text-secondary text-sm">Overview of all system data entries and activity</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-main p-5 space-y-4">
        {/* Search and Export Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={18} />
            <input
              type="text"
              placeholder="Search by user, action, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-panel border border-main rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-main placeholder-dim"
            />
          </div>
          <button 
            onClick={handleDownload}
            disabled={filteredLogs.length === 0}
            className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            <span className="text-sm font-bold">Export CSV</span>
          </button>
        </div>

        {/* Filter Row matching the image */}
        <div className="flex flex-wrap items-end gap-6 pt-2 border-t border-main/50">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-secondary tracking-wide">Date Range</label>
            <div className="flex items-center space-x-2">
              <input 
                type="date" 
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="bg-panel border border-main text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-w-[140px]"
                title="Start Date"
              />
              <input 
                type="date" 
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="bg-panel border border-main text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-w-[140px]"
                title="End Date"
              />
            </div>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-secondary tracking-wide">Section</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-panel border border-main text-main text-sm rounded-lg w-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
            >
              <option value="All">All Sections</option>
              {getUniquePages().filter(p => p !== 'All').map(page => (
                <option key={page} value={page}>{getDisplayPageName(page)}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center ml-auto space-x-4">
            <div className="flex items-center space-x-2 bg-panel px-4 py-2 rounded-lg border border-main">
              <input 
                type="checkbox" 
                id="newEntryFilter"
                checked={showNewEntriesOnly}
                onChange={(e) => {
                  setShowNewEntriesOnly(e.target.checked);
                  if (e.target.checked) setShowErrorsOnly(false);
                }}
                className="rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="newEntryFilter" className="text-sm font-bold text-emerald-500 cursor-pointer">
                New Entries
              </label>
            </div>

            <div className="flex items-center space-x-2 bg-panel px-4 py-2 rounded-lg border border-main">
              <input 
                type="checkbox" 
                id="errorFilter"
                checked={showErrorsOnly}
                onChange={(e) => {
                  setShowErrorsOnly(e.target.checked);
                  if (e.target.checked) setShowNewEntriesOnly(false);
                }}
                className="rounded text-red-500 focus:ring-red-500 cursor-pointer"
              />
              <label htmlFor="errorFilter" className="text-sm font-bold text-red-500 cursor-pointer">
                Errors Only
              </label>
            </div>
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
            className="bg-panel hover:bg-main hover:text-white text-secondary border border-main text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-sm border border-main overflow-hidden">
        {/* Pagination Controls */}
        {filteredLogs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-main bg-panel/30">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">SHOW</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-panel border border-main text-main text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748b%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .5rem top 50%', backgroundSize: '.5rem auto', paddingRight: '1.5rem' }}
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
              <span className="text-xs font-bold text-secondary uppercase tracking-widest">
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
              <tr className="border-b border-main bg-panel/50">
                <th className="p-4 text-xs font-black uppercase tracking-widest text-secondary w-1/5">User</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-secondary w-1/6">Section</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-secondary w-1/6">Action</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-secondary w-1/3">Details</th>
                <th className="p-4 text-xs font-black uppercase tracking-widest text-secondary w-1/6">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main">
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm">Loading entries...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Activity size={32} className="text-dim mb-2" />
                      <p className="text-base font-bold text-main">No entries found</p>
                      <p className="text-sm">Try adjusting your filters.</p>
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
                  else rowBg = 'hover:bg-panel/30';

                  let iconBg = 'bg-indigo-500/10 text-indigo-600';
                  if (isError) iconBg = 'bg-red-500/20 text-red-600';
                  else if (isNew) iconBg = 'bg-emerald-500/20 text-emerald-600';

                  let textNameColor = 'text-main';
                  if (isError) textNameColor = 'text-red-500';
                  else if (isNew) textNameColor = 'text-emerald-500';

                  let badgeStyle = 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20';
                  if (isError) badgeStyle = 'bg-red-500 text-white';
                  else if (isNew) badgeStyle = 'bg-emerald-500 text-white';

                  let detailsColor = 'text-secondary';
                  if (isError) detailsColor = 'text-red-400 font-medium';
                  else if (isNew) detailsColor = 'text-emerald-500 font-medium';

                  return (
                    <tr key={log.id} className={`transition-colors ${rowBg}`}>
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
                            <User size={14} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${textNameColor}`}>{log.userName || 'System'}</p>
                            <p className="text-xs text-secondary">{log.userEmail || log.ipAddress || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 text-secondary">
                          <Monitor size={14} />
                          <span className="text-sm font-medium">{getDisplayPageName(log.page)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wide ${badgeStyle}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className={`text-sm break-words ${detailsColor}`}>
                          {log.details || '—'}
                        </p>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2 text-secondary">
                          <Calendar size={14} className="shrink-0" />
                          <span className="text-xs whitespace-nowrap">{formatDate(log.timestamp)}</span>
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
