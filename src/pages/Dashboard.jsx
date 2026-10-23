import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import {
  Cctv, HardDrive, Fingerprint, Network, AlertTriangle, Activity,
  CheckCircle2, Clock, Briefcase, Radio, WifiOff, Shield,
  Wrench, FileText, SlidersHorizontal, ArrowUpRight, Layers, UserCheck, Calendar,
  Download, FileDown, X
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Cell
} from 'recharts';
import { exportDashboardMReportPPT } from '../utils/pptExport';

/* ---------------------------------------------------------------
   TOKENS
   Cyber-HUD palette: each device class gets its own accent so the
   ring colors alone tell you what system you're looking at, the
   way a NOC wall does.
--------------------------------------------------------------- */
const C = {
  bg: 'transparent',
  bgGrid: 'var(--glass-border)',
  panel: 'var(--glass-bg)',
  panelBorder: 'var(--glass-border)',
  text: 'var(--text-primary)',
  textMute: 'var(--text-secondary)',
  textFaint: 'var(--text-dim)',
  cameras: 'var(--accent-primary)',
  nvrs: 'var(--accent-violet)',
  biometrics: '#10b981',
  switches: '#f59e0b',
  critical: '#ef4444',
  ok: '#10b981',
};

const mono = "'JetBrains Mono', 'Roboto Mono', monospace";
const disp = "'Space Grotesk', 'Inter', sans-serif";

const GoogleFonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes scanline { 0% { top: -10%; } 100% { top: 110%; } }
    @keyframes pulseDot { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
    @keyframes tickerScroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
    @keyframes blink { 0%,49% { opacity:1; } 50%,100% { opacity:0.15; } }
    .hud-scroll::-webkit-scrollbar { width: 4px; }
    .hud-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 4px; }
  `}</style>
);

function RadarRing({ pct, color, size = 92 }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const center = size / 2;
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        {ticks.map((_, i) => {
          const angle = (i / ticks.length) * 360;
          const rad = (angle * Math.PI) / 180;
          const x1 = center + (r + 4) * Math.cos(rad);
          const y1 = center + (r + 4) * Math.sin(rad);
          const x2 = center + (r + 7) * Math.cos(rad);
          const y2 = center + (r + 7) * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.textFaint} strokeWidth="1" />;
        })}
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="5" />
        <circle
          cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute', inset: 0, animation: 'sweep 3.2s linear infinite',
          transformOrigin: `${center}px ${center}px`,
        }}
      >
        <div style={{
          position: 'absolute', left: center - 1, top: 8, width: 2, height: r - 6,
          background: `linear-gradient(to bottom, ${color}, transparent)`,
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.text }}>{pct}%</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, data, color }) {
  const pct = Math.round((data.online / (data.total || 1)) * 100);
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 16,
      backdropFilter: 'blur(10px)', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.8 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px 14px' }}>
        <RadarRing pct={pct} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon size={14} color={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <span style={{ fontFamily: disp, fontSize: 12, color: C.textMute, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1 }}>
            {data.online}<span style={{ color: C.textFaint, fontSize: 16, fontWeight: 400 }}> / {data.total}</span>
          </div>
          {data.offline > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <AlertTriangle size={11} color={C.critical} />
              <span style={{ fontFamily: mono, fontSize: 11, color: C.critical, fontWeight: 600 }}>{data.offline} offline</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: `1px solid ${C.panelBorder}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}` }}>
          <CheckCircle2 size={15} color={C.ok} style={{ filter: `drop-shadow(0 0 4px ${C.ok})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.online}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Online</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}` }}>
          <AlertTriangle size={15} color={C.critical} style={{ filter: `drop-shadow(0 0 4px ${C.critical})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.offline}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Offline</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}` }}>
          <Activity size={15} color={C.switches} style={{ filter: `drop-shadow(0 0 4px ${C.switches})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.maintenance}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Maint.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 6px', gap: 4 }}>
          <HardDrive size={15} color={C.textFaint} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.scrap}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Scrap</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [opsTab, setOpsTab] = useState('Tickets'); // 'Tickets', 'Upgrades', 'Projects'
  const [selectedMonth, setSelectedMonth] = useState(''); // e.g. '2026-09' or '' for all
  const [isExportingPPT, setIsExportingPPT] = useState(false);

  const [stats, setStats] = useState({
    cameras: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    nvrs: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    biometrics: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    switches: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    tickets: { total: 0, open: 0, inProgress: 0, completed: 0, upgrade: 0 },
    distribution: []
  });
  const [projects, setProjects] = useState([]);
  const [ticketList, setTicketList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Permission Guard
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const hasAnyPermission = isAdmin || (user?.permissions && user.permissions.length > 0);

  const getImageUrl = (path) => {
    if (!path) return '';
    try {
      const url = new URL(path);
      path = url.pathname;
    } catch (e) {}
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('cctv/')) {
      cleanPath = cleanPath.substring(5);
    }
    if (!cleanPath.startsWith('media/') && !cleanPath.startsWith('api/')) {
      cleanPath = 'media/' + cleanPath;
    }
    const baseUrl = import.meta.env.BASE_URL || '/cctv/';
    return `${baseUrl}${cleanPath}`;
  };

  const isUpgradeTicket = (t) => {
    if (!t) return false;
    let meta = {};
    try {
      meta = typeof t.remarks === 'string' && t.remarks.startsWith('{') ? JSON.parse(t.remarks) : (typeof t.remarks === 'object' && t.remarks ? t.remarks : {});
    } catch(e) {}
    const cat = String(t.category || meta.category || '').toLowerCase();
    const desc = String(t.issueDescription || '').toLowerCase();
    return cat.includes('upgrade') || desc.includes('upgrade') || meta.isUpgrade === true || meta.category === 'Upgrade';
  };

  const getItemMonth = (item) => {
    if (!item) return '';
    let meta = {};
    try {
      meta = typeof item.remarks === 'string' && item.remarks.startsWith('{') 
        ? JSON.parse(item.remarks) 
        : (typeof item.remarks === 'object' && item.remarks ? item.remarks : {});
    } catch(e) {}

    const dateStr = item.operationDate || meta.manualDate || item.receivedDate || item.createdDate || item.start_date || (item.createdAt ? String(item.createdAt).split('T')[0] : '');
    return dateStr ? String(dateStr).substring(0, 7) : '';
  };

  const getProjectMonth = (project) => {
    if (!project || !selectedMonth) return true;
    const startM = project.start_date ? String(project.start_date).substring(0, 7) : '';
    const endM = project.end_date ? String(project.end_date).substring(0, 7) : '';
    const createdM = project.created_at || project.createdAt ? String(project.created_at || project.createdAt).substring(0, 7) : '';
    if (startM && endM) return (startM <= selectedMonth && endM >= selectedMonth);
    if (startM) return startM <= selectedMonth;
    if (createdM) return createdM === selectedMonth;
    return true;
  };

  const formatMonthLabel = (ym) => {
    if (!ym) return 'All Months';
    try {
      const [y, m] = ym.split('-');
      const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return date.toLocaleString('default', { month: 'long', year: 'numeric' });
    } catch (e) {
      return ym;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, projectsRes, ticketsRes] = await Promise.all([
        api.get('/cameras/global-site-config/dashboard_stats/').catch(() => ({ data: {} })),
        api.get('/tickets/projects/').catch(() => ({ data: [] })),
        api.get('/tickets/?page_size=1000').catch(() => ({ data: [] }))
      ]);

      const statsData = statsRes.data;
      setStats({
        cameras: {
          total: statsData.cameras?.total || 0,
          online: statsData.cameras?.online || 0,
          offline: statsData.cameras?.offline || 0,
          maintenance: statsData.cameras?.maintenance || 0,
          scrap: statsData.cameras?.scrap || 0,
          official: statsData.cameras?.official || 0,
        },
        nvrs: {
          total: statsData.nvrs?.total || 0,
          online: statsData.nvrs?.online || 0,
          offline: statsData.nvrs?.offline || 0,
          maintenance: statsData.nvrs?.maintenance || 0,
          scrap: statsData.nvrs?.scrap || 0,
          official: statsData.nvrs?.official || 0,
        },
        biometrics: {
          total: statsData.biometrics?.total || 0,
          online: statsData.biometrics?.online || 0,
          offline: statsData.biometrics?.offline || 0,
          maintenance: statsData.biometrics?.maintenance || 0,
          scrap: statsData.biometrics?.scrap || 0,
          official: statsData.biometrics?.official || 0,
        },
        switches: {
          total: statsData.switches?.total || 0,
          online: statsData.switches?.online || 0,
          offline: statsData.switches?.offline || 0,
          maintenance: statsData.switches?.maintenance || 0,
          scrap: statsData.switches?.scrap || 0,
          official: statsData.switches?.official || 0,
        },
        tickets: statsData.tickets || { total: 0, open: 0, inProgress: 0, completed: 0, upgrade: 0 },
        distribution: statsData.distribution || []
      });

      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);

      // Ticket list
      const ticketsRaw = ticketsRes.data;
      const ticketArr = Array.isArray(ticketsRaw) ? ticketsRaw : (ticketsRaw?.results || []);
      setTicketList(ticketArr);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    if (hasAnyPermission) {
      fetchData();
    }
    return () => clearInterval(t);
  }, [hasAnyPermission]);

  // Filtered collections by Selected Month
  const filteredTickets = useMemo(() => {
    if (!selectedMonth) return ticketList;
    return ticketList.filter(t => getItemMonth(t) === selectedMonth);
  }, [ticketList, selectedMonth]);

  const filteredUpgrades = useMemo(() => {
    const upg = ticketList.filter(t => isUpgradeTicket(t));
    if (!selectedMonth) return upg;
    return upg.filter(t => getItemMonth(t) === selectedMonth);
  }, [ticketList, selectedMonth]);

  const filteredProjects = useMemo(() => {
    if (!selectedMonth) return projects;
    return projects.filter(p => getProjectMonth(p));
  }, [projects, selectedMonth]);

  // Categories & Divisions stats for Tickets
  const ticketCategoryStats = useMemo(() => {
    const catMap = {};
    filteredTickets.forEach(t => {
      const k = t.category || 'Other';
      catMap[k] = (catMap[k] || 0) + 1;
    });
    return Object.entries(catMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTickets]);

  const ticketDivisionStats = useMemo(() => {
    const divMap = {};
    filteredTickets.forEach(t => {
      const k = t.divisionName || 'Unassigned';
      divMap[k] = (divMap[k] || 0) + 1;
    });
    return Object.entries(divMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredTickets]);

  // Categories & Divisions stats for Upgrades
  const upgradeDivisionStats = useMemo(() => {
    const divMap = {};
    filteredUpgrades.forEach(t => {
      const k = t.divisionName || 'Unassigned';
      divMap[k] = (divMap[k] || 0) + 1;
    });
    return Object.entries(divMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredUpgrades]);

  const upgradeStatusStats = useMemo(() => {
    const statusMap = { 'Open': 0, 'In Progress': 0, 'Completed': 0 };
    filteredUpgrades.forEach(t => {
      const st = t.status || 'Open';
      statusMap[st] = (statusMap[st] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, count]) => ({ name, count }));
  }, [filteredUpgrades]);

  // Projects stats
  const projectStatusStats = useMemo(() => {
    const statusMap = { 'Active': 0, 'Completed': 0, 'On Hold': 0 };
    filteredProjects.forEach(p => {
      const st = p.status || 'Active';
      statusMap[st] = (statusMap[st] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, count]) => ({ name, count }));
  }, [filteredProjects]);

  const projectsVolumeStats = useMemo(() => {
    return filteredProjects.map(p => ({
      name: p.name || 'Project',
      count: p.ticket_count || 0
    })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredProjects]);

  const getCategoryColor = (cat) => {
    const lower = String(cat).toLowerCase();
    if (lower.includes('issue')) return '#3b82f6';
    if (lower.includes('service')) return '#64748b';
    if (lower.includes('maintenance')) return '#64748b';
    if (lower.includes('installation')) return '#475569';
    if (lower.includes('upgrade')) return '#a855f7';
    if (lower.includes('camera')) return '#0284c7';
    if (lower.includes('cctv')) return '#0369a1';
    return '#3b82f6';
  };

  const handleDownloadMReport = async () => {
    try {
      setIsExportingPPT(true);
      const monthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : 'All Time';
      showNotification(`Generating Consolidated M-Report PPT (${monthLabel})...`, 'info');
      await exportDashboardMReportPPT({
        tickets: filteredTickets,
        upgrades: filteredUpgrades,
        projects: filteredProjects,
        allTickets: ticketList,
        getImageUrl,
        monthName: monthLabel
      });
      showNotification(`M-Report PPT (${monthLabel}) downloaded successfully!`, 'success');
    } catch (err) {
      console.error('M-Report export failed:', err);
      showNotification('Failed to generate M-Report PPT: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsExportingPPT(false);
    }
  };

  if (!hasAnyPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in text-center px-6">
        <GoogleFonts />
        <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-8 border border-rose-500/20">
          <Shield size={40} className="text-rose-500" />
        </div>
        <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tight mb-3">Access Restricted</h2>
        <p className="text-[var(--text-secondary)] font-medium max-w-md leading-relaxed">
          Your account has been verified, but no access rights have been assigned to your profile yet.
        </p>
        <div className="mt-8 p-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl flex flex-col items-center shadow-lg">
          <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.3em] mb-2">Access Required</span>
          <p className="text-teal-500 font-black uppercase tracking-widest text-sm">Please contact the CCTV Admin for access.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: C.text, gap: 16
      }}>
        <GoogleFonts />
        <div style={{
          width: 48, height: 48, border: `3px solid rgba(45,212,238,0.1)`,
          borderTop: `3px solid ${C.cameras}`, borderRadius: '50%',
          animation: 'sweep 1s linear infinite'
        }} />
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: C.textMute, letterSpacing: 1.5 }}>LOADING DASHBOARD...</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text, fontFamily: disp,
      padding: 24,
    }}>
      <GoogleFonts />

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={20} color={C.cameras} style={{ filter: `drop-shadow(0 0 4px ${C.cameras})` }} />
            <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: 0.5, margin: 0, textTransform: 'uppercase' }}>CCTV DASHBOARD</h1>
          </div>
          <p style={{ fontFamily: mono, fontSize: 11.5, color: C.textMute, marginTop: 4 }}>
            Rathinam College · {now.toLocaleTimeString()}
          </p>
        </div>

        {/* CONTROLS: MONTH FILTER & M-REPORT PPT BUTTON */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Month Filter Picker */}
          <div className="flex items-center gap-2 bg-panel border border-main px-3 py-1.5 rounded-xl shadow-sm">
            <Calendar size={15} className="text-cyan-400 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-mono text-xs font-semibold focus:outline-none cursor-pointer"
              title="Filter Dashboard by Month"
            />
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth('')}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-300 ml-1 px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-all uppercase"
                title="Clear Month Filter (Show All)"
              >
                <X size={11} />
                <span>All</span>
              </button>
            )}
          </div>

          {/* M-Report Download Button */}
          <button
            onClick={handleDownloadMReport}
            disabled={isExportingPPT}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 shadow-lg shadow-indigo-500/25 transition-all border border-cyan-400/30 cursor-pointer disabled:opacity-50"
            title={`Download M-Report PPT (${selectedMonth ? formatMonthLabel(selectedMonth) : 'All Months'})`}
          >
            <Download size={15} className={isExportingPPT ? "animate-bounce" : "text-cyan-200"} />
            <span>{isExportingPPT ? "Generating PPT..." : "M-Report PPT"}</span>
          </button>
        </div>
      </div>

      {/* TOP METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 26 }}>
        <MetricCard icon={Cctv} label="Cameras" data={stats.cameras} color={C.cameras} />
        <MetricCard icon={HardDrive} label="NVRs" data={stats.nvrs} color={C.nvrs} />
        <MetricCard icon={Fingerprint} label="Biometrics" data={stats.biometrics} color={C.biometrics} />
        <MetricCard icon={Network} label="Switches" data={stats.switches} color={C.switches} />
      </div>

      {/* ── SERVICE OPERATIONS ANALYTICS (TICKETS / UPGRADES / PROJECTS) ── */}
      <div style={{ marginTop: 24 }}>

        {/* Section Header & Tab Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={18} color={C.switches} style={{ filter: `drop-shadow(0 0 4px ${C.switches})` }} />
              <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Service Operations & Reports
              </span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase tracking-wider">
              {formatMonthLabel(selectedMonth)}
            </span>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-main">
            {[
              { id: 'Tickets', label: 'Tickets', icon: FileText, count: filteredTickets.length },
              { id: 'Upgrades', label: 'Upgrades', icon: ArrowUpRight, count: filteredUpgrades.length },
              { id: 'Projects', label: 'Projects', icon: Layers, count: filteredProjects.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setOpsTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  opsTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={13} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${opsTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── TICKETS TAB CONTENT ── */}
        {opsTab === 'Tickets' && (
          <div className="space-y-6 animate-fade-in">
            {/* 6 Top Metric Cards matching User Screenshot */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Tickets</span>
                <span className="text-3xl font-bold font-mono text-white mt-2">{filteredTickets.length}</span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Open Queue</span>
                <span className="text-3xl font-bold font-mono text-rose-400 mt-2">
                  {filteredTickets.filter(t => t.status === 'Open').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">In Progress</span>
                <span className="text-3xl font-bold font-mono text-amber-400 mt-2">
                  {filteredTickets.filter(t => t.status === 'In Progress').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Completed</span>
                <span className="text-3xl font-bold font-mono text-green-400 mt-2">
                  {filteredTickets.filter(t => t.status === 'Completed').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Resolution Rate</span>
                <span className="text-3xl font-bold font-mono text-cyan-400 mt-2">
                  {filteredTickets.length > 0
                    ? ((filteredTickets.filter(t => t.status === 'Completed').length / filteredTickets.length) * 100).toFixed(0)
                    : 0}%
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Billing Records</span>
                <span className="text-3xl font-bold font-mono text-purple-400 mt-2">
                  {filteredTickets.filter(t => t.billing_records?.length > 0 || t.bill_no || t.po_no).length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"></div>
              </div>
            </div>

            {/* Charts Row: Category Breakdown + Tickets by Division */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Breakdown (Horizontal Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Category Breakdown</h3>
                <div className="h-64 flex items-center justify-center">
                  {ticketCategoryStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketCategoryStats} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={70} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {ticketCategoryStats.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={getCategoryColor(entry.name)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Category Data for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>

              {/* Tickets by Division (Vertical Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col lg:col-span-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Tickets by Division</h3>
                <div className="h-64 flex items-center justify-center">
                  {ticketDivisionStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketDivisionStats} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} interval={0} angle={-30} textAnchor="end" height={45} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Division Data for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── UPGRADES TAB CONTENT ── */}
        {opsTab === 'Upgrades' && (
          <div className="space-y-6 animate-fade-in">
            {/* 6 Top Metric Cards for Upgrades */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Upgrades</span>
                <span className="text-3xl font-bold font-mono text-white mt-2">{filteredUpgrades.length}</span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">Open Queue</span>
                <span className="text-3xl font-bold font-mono text-rose-400 mt-2">
                  {filteredUpgrades.filter(t => t.status === 'Open').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">In Progress</span>
                <span className="text-3xl font-bold font-mono text-amber-400 mt-2">
                  {filteredUpgrades.filter(t => t.status === 'In Progress').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Completed</span>
                <span className="text-3xl font-bold font-mono text-green-400 mt-2">
                  {filteredUpgrades.filter(t => t.status === 'Completed').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Resolution Rate</span>
                <span className="text-3xl font-bold font-mono text-cyan-400 mt-2">
                  {filteredUpgrades.length > 0
                    ? ((filteredUpgrades.filter(t => t.status === 'Completed').length / filteredUpgrades.length) * 100).toFixed(0)
                    : 0}%
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Upgrade Ratio</span>
                <span className="text-3xl font-bold font-mono text-purple-400 mt-2">
                  {filteredTickets.length > 0 ? ((filteredUpgrades.length / filteredTickets.length) * 100).toFixed(0) : 0}%
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"></div>
              </div>
            </div>

            {/* Charts Row for Upgrades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status Breakdown (Horizontal Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Upgrade Status</h3>
                <div className="h-64 flex items-center justify-center">
                  {upgradeStatusStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={upgradeStatusStats} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={75} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#10b981" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Data for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>

              {/* Upgrades by Division (Vertical Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col lg:col-span-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Upgrades by Division</h3>
                <div className="h-64 flex items-center justify-center">
                  {upgradeDivisionStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={upgradeDivisionStats} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} interval={0} angle={-30} textAnchor="end" height={45} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Division Data for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS TAB CONTENT ── */}
        {opsTab === 'Projects' && (
          <div className="space-y-6 animate-fade-in">
            {/* 6 Top Metric Cards for Projects */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Projects</span>
                <span className="text-3xl font-bold font-mono text-white mt-2">{filteredProjects.length}</span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Active Contracts</span>
                <span className="text-3xl font-bold font-mono text-green-400 mt-2">
                  {filteredProjects.filter(p => p.status === 'Active' || !p.status).length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">On Hold</span>
                <span className="text-3xl font-bold font-mono text-amber-400 mt-2">
                  {filteredProjects.filter(p => p.status === 'On Hold').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Completed</span>
                <span className="text-3xl font-bold font-mono text-cyan-400 mt-2">
                  {filteredProjects.filter(p => p.status === 'Completed').length}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">Mapped Tickets</span>
                <span className="text-3xl font-bold font-mono text-purple-400 mt-2">
                  {filteredProjects.reduce((acc, p) => acc + (p.ticket_count || 0), 0)}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"></div>
              </div>

              <div className="bg-panel border border-main rounded-md p-4 flex flex-col justify-between h-28 relative overflow-hidden transition-all group">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Client Entities</span>
                <span className="text-3xl font-bold font-mono text-indigo-400 mt-2">
                  {new Set(filteredProjects.map(p => p.client_name).filter(Boolean)).size}
                </span>
                <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50"></div>
              </div>
            </div>

            {/* Charts Row for Projects */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Project Status (Horizontal Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Contract Status</h3>
                <div className="h-64 flex items-center justify-center">
                  {projectStatusStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStatusStats} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" stroke="#94a3b8" fontSize={9} />
                        <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={75} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          <Cell fill="#10b981" />
                          <Cell fill="#06b6d4" />
                          <Cell fill="#f59e0b" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Status Data for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>

              {/* Tickets Per Project (Vertical Bar Chart) */}
              <div className="bg-panel border border-main rounded-md p-6 flex flex-col lg:col-span-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Volume by Project</h3>
                <div className="h-64 flex items-center justify-center">
                  {projectsVolumeStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectsVolumeStats} margin={{ left: 0, right: 10, top: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} interval={0} angle={-30} textAnchor="end" height={45} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: '#fff'
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No Projects Tracked for {formatMonthLabel(selectedMonth)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
