import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  Cctv, HardDrive, Fingerprint, Network, AlertTriangle, Activity,
  CheckCircle2, Clock, Briefcase, Radio, ChevronRight, WifiOff, Shield,
  Wrench, FileText, SlidersHorizontal, ArrowUpRight, Layers, UserCheck, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid
} from 'recharts';

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

const MOCK_UPTIME = [
  { day: 'Mon', uptime: 97.2 }, { day: 'Tue', uptime: 98.1 }, { day: 'Wed', uptime: 95.4 },
  { day: 'Thu', uptime: 99.0 }, { day: 'Fri', uptime: 96.8 }, { day: 'Sat', uptime: 98.6 },
  { day: 'Sun', uptime: 97.9 },
];

const MOCK_ALERTS = [
  { level: 'CRITICAL', msg: 'Camera CAM-114 in Engineering Block went offline', time: '2m ago' },
  { level: 'WARNING', msg: 'NVR-03 storage at 88% capacity', time: '11m ago' },
  { level: 'INFO', msg: 'Biometric device sync completed — Hostel Block', time: '24m ago' },
  { level: 'WARNING', msg: 'Switch SW-07 packet loss above threshold', time: '38m ago' },
  { level: 'CRITICAL', msg: 'CAM-089 tamper alert — Arts College gate', time: '52m ago' },
  { level: 'INFO', msg: 'Ticket #4521 marked completed by Ops team', time: '1h ago' },
];

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
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
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
      {/* Top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)`, opacity: 0.8 }} />

      {/* Top row: ring + info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px 14px' }}>
        <RadarRing pct={pct} color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Icon size={14} color={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            <span style={{ fontFamily: disp, fontSize: 12, color: C.textMute, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
          </div>
          {/* Online / Total big number */}
          <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1 }}>
            {data.online}<span style={{ color: C.textFaint, fontSize: 16, fontWeight: 400 }}> / {data.total}</span>
          </div>
          {/* Offline count — shown only if > 0 */}
          {data.offline > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <WifiOff size={11} color={C.critical} />
              <span style={{ fontFamily: mono, fontSize: 11, color: C.critical, fontWeight: 600 }}>{data.offline} offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom 4-box row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: `1px solid ${C.panelBorder}` }}>
        {/* Online */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}`,
        }}>
          <CheckCircle2 size={15} color={C.ok} style={{ filter: `drop-shadow(0 0 4px ${C.ok})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.online}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Online</span>
        </div>
        {/* Offline */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}`,
        }}>
          <WifiOff size={15} color={C.critical} style={{ filter: `drop-shadow(0 0 4px ${C.critical})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.offline}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Offline</span>
        </div>
        {/* Maintenance */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '12px 6px', gap: 4, borderRight: `1px solid ${C.panelBorder}`,
        }}>
          <AlertTriangle size={15} color={C.switches} style={{ filter: `drop-shadow(0 0 4px ${C.switches})` }} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.maintenance}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Maint.</span>
        </div>
        {/* Scrap */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '12px 6px', gap: 4,
        }}>
          <HardDrive size={15} color={C.textFaint} />
          <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.text }}>{data.scrap}</span>
          <span style={{ fontFamily: disp, fontSize: 9, color: C.textMute, letterSpacing: 0.8, textTransform: 'uppercase' }}>Scrap</span>
        </div>
      </div>
    </div>
  );
}

function TicketRing({ tickets }) {
  const segs = [
    { label: 'Open', val: tickets.open, color: C.critical },
    { label: 'In Progress', val: tickets.inProgress, color: C.switches },
    { label: 'Completed', val: tickets.completed, color: C.ok },
    { label: 'Upgrade', val: tickets.upgrade, color: C.nvrs },
  ];
  const total = tickets.total || 1;
  const size = 140, stroke = 14, r = size / 2 - stroke, c = 2 * Math.PI * r, center = size / 2;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth={stroke} />
        {segs.map((s, i) => {
          const frac = s.val / total;
          const len = frac * c;
          const dash = `${len} ${c - len}`;
          const dashOffset = -acc * c;
          acc += frac;
          return (
            <circle
              key={i} cx={center} cy={center} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={dash} strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${center} ${center})`}
              style={{ filter: `drop-shadow(0 0 3px ${s.color})` }}
            />
          );
        })}
        <text x={center} y={center - 4} textAnchor="middle" fontFamily={mono} fontSize="24" fontWeight="700" fill={C.text}>{tickets.total}</text>
        <text x={center} y={center + 16} textAnchor="middle" fontFamily={disp} fontSize="10" fill={C.textMute} letterSpacing="1">TICKETS</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, boxShadow: `0 0 5px ${s.color}` }} />
            <span style={{ fontFamily: disp, fontSize: 12.5, color: C.textMute, minWidth: 82 }}>{s.label}</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: C.text, fontWeight: 600 }}>{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveFeedTile({ n, area }) {
  return (
    <div style={{
      position: 'relative', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden',
      background: 'linear-gradient(135deg, #0d1424 0%, #131c30 100%)',
      border: `1px solid ${C.panelBorder}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(45,212,238,0.04) 0px, rgba(45,212,238,0.04) 1px, transparent 1px, transparent 3px)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '35%',
        background: 'linear-gradient(to bottom, transparent, rgba(45,212,238,0.12), transparent)',
        animation: `scanline 4s linear infinite`, animationDelay: `${n * 0.6}s`,
      }} />
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.critical, animation: 'pulseDot 1.4s ease-in-out infinite' }} />
        <span style={{ fontFamily: mono, fontSize: 9.5, color: C.critical, fontWeight: 700, letterSpacing: 1 }}>LIVE</span>
      </div>
      <span style={{ position: 'absolute', bottom: 8, left: 8, fontFamily: mono, fontSize: 10, color: C.textMute }}>CAM-{100 + n}</span>
      <span style={{ position: 'absolute', bottom: 8, right: 8, fontFamily: disp, fontSize: 9.5, color: C.textFaint }}>{area}</span>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Cctv size={20} color="rgba(148,163,184,0.18)" />
      </div>
    </div>
  );
}

function AlertRow({ a }) {
  const colorMap = { CRITICAL: C.critical, WARNING: C.switches, INFO: C.cameras };
  const color = colorMap[a.level] || C.textMute;
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 4px', borderBottom: `1px solid ${C.panelBorder}` }}>
      <div style={{ marginTop: 3, width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color, letterSpacing: 0.5 }}>{a.level}</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: C.textFaint }}>{a.time}</span>
        </div>
        <div style={{ fontFamily: disp, fontSize: 12.5, color: C.text, marginTop: 2 }}>{a.msg}</div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1424', border: `1px solid ${C.panelBorder}`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: C.textMute }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 13, color: C.cameras, fontWeight: 700 }}>{payload[0].value}{payload[0].unit || ''}</div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  const [stats, setStats] = useState({
    cameras: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    nvrs: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    biometrics: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    switches: { total: 0, online: 0, offline: 0, maintenance: 0, scrap: 0, official: 0 },
    tickets: { total: 0, open: 0, inProgress: 0, completed: 0, upgrade: 0 },
    distribution: []
  });
  const [projects, setProjects] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [ticketList, setTicketList] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Permission Guard
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const hasAnyPermission = isAdmin || (user?.permissions && user.permissions.length > 0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, projectsRes, logsRes, ticketsRes] = await Promise.all([
        api.get('/cameras/global-site-config/dashboard_stats/').catch(() => ({ data: {} })),
        api.get('/tickets/projects/').catch(() => ({ data: [] })),
        api.get('/cameras/logs/').catch(() => ({ data: [] })),
        api.get('/tickets/?page_size=100').catch(() => ({ data: [] }))
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

      const logs = Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data?.results || []);
      const formatted = logs.slice(0, 15).map(log => {
        let level = 'INFO';
        const act = String(log.action).toUpperCase();
        if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CRITICAL')) {
          level = 'CRITICAL';
        } else if (act.includes('EDIT') || act.includes('UPDATE') || act.includes('WARNING')) {
          level = 'WARNING';
        }

        let timeStr = 'Just now';
        if (log.timestamp) {
          const diffMs = new Date() - new Date(log.timestamp);
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 1) timeStr = 'Just now';
          else if (diffMins < 60) timeStr = `${diffMins}m ago`;
          else {
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) timeStr = `${diffHours}h ago`;
            else timeStr = new Date(log.timestamp).toLocaleDateString();
          }
        }

        return {
          level,
          msg: log.details || `${log.action} on ${log.page}`,
          time: timeStr
        };
      });
      setAlerts(formatted.length > 0 ? formatted : MOCK_ALERTS);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setAlerts(MOCK_ALERTS);
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

  const totalOnline = stats.cameras.online + stats.nvrs.online + stats.biometrics.online + stats.switches.online;
  const totalDevices = stats.cameras.total + stats.nvrs.total + stats.biometrics.total + stats.switches.total;

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
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: C.textMute, letterSpacing: 1.5 }}>LOADING SENSORS...</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 20, padding: '7px 14px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.ok, animation: 'pulseDot 1.6s ease-in-out infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 11.5, color: C.ok, fontWeight: 600 }}>
              {totalOnline}/{totalDevices} SYSTEMS ONLINE
            </span>
          </div>
          <button
            onClick={() => navigate('/reports')}
            style={{
              background: 'transparent', border: `1px solid ${C.cameras}`, color: C.cameras,
              borderRadius: 8, padding: '8px 14px', fontFamily: disp, fontSize: 12.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            }}
          >
            Reports <ChevronRight size={13} />
          </button>
          <button
            onClick={() => navigate('/billing')}
            style={{
              background: C.cameras, border: 'none', color: '#08111f',
              borderRadius: 8, padding: '8px 14px', fontFamily: disp, fontSize: 12.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            }}
          >
            Billing & PO <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* TOP METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18 }}>
        <MetricCard icon={Cctv} label="Cameras" data={stats.cameras} color={C.cameras} />
        <MetricCard icon={HardDrive} label="NVRs" data={stats.nvrs} color={C.nvrs} />
        <MetricCard icon={Fingerprint} label="Biometrics" data={stats.biometrics} color={C.biometrics} />
        <MetricCard icon={Network} label="Switches" data={stats.switches} color={C.switches} />
      </div>


      {/* ── TICKET ANALYTICS DASHBOARD ── */}
      <div style={{ marginTop: 28 }}>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Wrench size={16} color={C.switches} style={{ filter: `drop-shadow(0 0 4px ${C.switches})` }} />
          <span style={{ fontFamily: disp, fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: 0.5, textTransform: 'uppercase' }}>Service Operations</span>
        </div>

        {/* Stats summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total', val: stats.tickets.total, icon: FileText, color: C.textMute },
            { label: 'Open', val: stats.tickets.open, icon: Wrench, color: C.switches },
            { label: 'In Progress', val: stats.tickets.inProgress, icon: Clock, color: C.nvrs },
            { label: 'Completed', val: stats.tickets.completed, icon: CheckCircle2, color: C.ok },
            { label: 'Upgrades', val: stats.tickets.upgrade, icon: ArrowUpRight, color: C.cameras },
            { label: 'Projects', val: stats.tickets.project, icon: Layers, color: C.biometrics },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} style={{
              background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 12,
              padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 5,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: disp, fontSize: 10, color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                <Icon size={12} color={color} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1 }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Charts Row: Division + Category */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          {/* Tickets by Division */}
          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: disp, fontSize: 12, fontWeight: 700, color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Tickets by Division</div>
            {(() => {
              const divMap = {};
              ticketList.forEach(t => { const k = t.divisionName || 'Unassigned'; divMap[k] = (divMap[k] || 0) + 1; });
              const data = Object.entries(divMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
              const max = Math.max(...data.map(d => d[1]), 1);
              return data.length === 0
                ? <div style={{ textAlign: 'center', color: C.textFaint, fontFamily: mono, fontSize: 12, padding: 24 }}>No data</div>
                : data.map(([name, count]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: disp, fontSize: 11, color: C.text }}>{name}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.textMute }}>{count}</span>
                    </div>
                    <div style={{ height: 10, background: 'rgba(148,163,184,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: C.nvrs, borderRadius: 5, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ));
            })()}
          </div>

          {/* Category Breakdown */}
          <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontFamily: disp, fontSize: 12, fontWeight: 700, color: C.textMute, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Category Breakdown</div>
            {(() => {
              const catMap = {};
              ticketList.forEach(t => { const k = t.category || 'Uncategorized'; catMap[k] = (catMap[k] || 0) + 1; });
              const catColors = { Repair: C.critical, Upgrade: C.cameras, Installation: C.ok, Project: C.nvrs };
              const data = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
              const max = Math.max(...data.map(d => d[1]), 1);
              return data.length === 0
                ? <div style={{ textAlign: 'center', color: C.textFaint, fontFamily: mono, fontSize: 12, padding: 24 }}>No data</div>
                : data.map(([name, count]) => (
                  <div key={name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: disp, fontSize: 11, color: C.text }}>{name}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.textMute }}>{count}</span>
                    </div>
                    <div style={{ height: 10, background: 'rgba(148,163,184,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: catColors[name] || C.biometrics, borderRadius: 5, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                ));
            })()}
          </div>
        </div>



      </div>

    </div>
  );
}
