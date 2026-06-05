import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  Cctv, HardDrive, Fingerprint, Network, 
  Activity, CheckCircle, AlertCircle, Clock,
  ArrowUpRight, ArrowDownRight, TrendingUp, Shield,
  Database, User, Zap, LayoutGrid, Briefcase
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  // Permission Guard
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const hasAnyPermission = isAdmin || (user?.permissions && user.permissions.length > 0);

  const [stats, setStats] = useState({
    cameras: { total: 0, online: 0, offline: 0 },
    nvrs: { total: 0, online: 0, offline: 0 },
    biometrics: { total: 0, online: 0, offline: 0 },
    switches: { total: 0, online: 0, offline: 0 },
    tickets: { total: 0, open: 0, inProgress: 0, completed: 0, upgrade: 0, project: 0 },
    projects: { total: 0, active: 0, completed: 0, onHold: 0 }
  });
  const [collegeDistribution, setCollegeDistribution] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasAnyPermission) {
      fetchData();
    }
  }, [hasAnyPermission]);

  if (!hasAnyPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in text-center px-6">
        <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-8 border border-rose-500/20">
          <Shield size={40} className="text-rose-500" />
        </div>
        <h2 className="text-4xl font-black text-text-main tracking-tight mb-3">Access Restricted</h2>
        <p className="text-secondary font-medium max-w-md leading-relaxed">
          Your account has been verified, but no access rights have been assigned to your profile yet.
        </p>
        <div className="mt-8 p-6 bg-panel border border-main rounded-2xl flex flex-col items-center">
           <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em] mb-2">Access Required</span>
           <p className="text-teal-500 font-black uppercase tracking-widest text-sm">Please contact the CCTV Admin for access.</p>
        </div>
      </div>
    );
  }

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, projectsRes] = await Promise.all([
        api.get('/cameras/global-site-config/dashboard_stats/'),
        api.get('/tickets/projects/')
      ]);
      
      const data = statsRes.data;
      const projects = Array.isArray(projectsRes.data) ? projectsRes.data : [];
      
      setStats({
        cameras: data.cameras,
        nvrs: data.nvrs,
        biometrics: data.biometrics,
        switches: data.switches,
        tickets: data.tickets,
        projects: {
          total: projects.length,
          active: projects.filter(p => p.status === 'Active').length,
          completed: projects.filter(p => p.status === 'Completed').length,
          onHold: projects.filter(p => p.status === 'On Hold').length
        }
      });

      setCollegeDistribution(data.distribution || []);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const ticketStatusData = useMemo(() => [
    { name: 'Open', value: stats.tickets.open, color: '#f43f5e' },
    { name: 'In Progress', value: stats.tickets.inProgress, color: '#f59e0b' },
    { name: 'Completed', value: stats.tickets.completed, color: '#10b981' },
  ], [stats.tickets]);

  const projectStatusData = useMemo(() => [
    { name: 'Active', value: stats.projects.active, color: '#0ea5e9' },
    { name: 'Completed', value: stats.projects.completed, color: '#10b981' },
    { name: 'On Hold', value: stats.projects.onHold, color: '#f59e0b' },
  ], [stats.projects]);

  const StatCard = ({ title, value, total, icon: Icon, color, trend, path }) => (
    <div 
      onClick={() => navigate(path)}
      className="group relative p-8 glass-panel rounded-[2.5rem] hover:border-teal-500/30 transition-all duration-500 cursor-pointer overflow-hidden spark-effect"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="flex items-center justify-between mb-8">
        <div className="p-4 rounded-3xl bg-panel border border-main text-secondary group-hover:text-teal-500 transition-colors shadow-inner">
          <Icon size={24} />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-black text-secondary uppercase tracking-[0.3em]">{title}</h3>
        <div className="flex items-baseline space-x-3">
          <span className="text-4xl font-black text-main tracking-tight">{value}</span>
          <span className="text-sm text-secondary font-bold">/ {total}</span>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-secondary">
          <span>Online Status</span>
          <span style={{ color }}>{Math.round((value/total)*100) || 0}%</span>
        </div>
        <div className="h-2 bg-panel rounded-full overflow-hidden border border-main shadow-inner p-0.5">
          <div 
            className="h-full rounded-full transition-all duration-1000 relative shadow-[0_0_10px_rgba(20,184,166,0.2)]" 
            style={{ 
              width: `${(value/total)*100 || 0}%`, 
              backgroundColor: color,
              boxShadow: `0 0 15px ${color}30`
            }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/40"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in pb-20 pt-10 px-4 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-8 mb-10">
        <div>
          <h1 className="text-4xl font-bold text-text-main">
            CCTV <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-secondary to-accent-primary">Dashboard</span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* ROW 1: Separate Device Cards */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
           {[ 
             { label: "Cameras", path: '/cameras', value: stats.cameras.online, total: stats.cameras.total, perc: Math.round((stats.cameras.online/(stats.cameras.total||1))*100), color: 'var(--accent-secondary)' },
             { label: "NVR", path: '/nvr', value: stats.nvrs.online, total: stats.nvrs.total, perc: Math.round((stats.nvrs.online/(stats.nvrs.total||1))*100), color: 'var(--accent-primary)' },
             { label: "Biometrics", path: '/biometrics', value: stats.biometrics.online, total: stats.biometrics.total, perc: Math.round((stats.biometrics.online/(stats.biometrics.total||1))*100), color: 'var(--accent-violet)' },
             { label: "Switches", path: '/network', value: stats.switches.online, total: stats.switches.total, perc: Math.round((stats.switches.online/(stats.switches.total||1))*100), color: 'var(--accent-secondary)' }
           ].map((stat, i) => (
              <div key={i} onClick={() => navigate(stat.path)} className="hud-panel p-6 flex flex-col justify-between overflow-hidden h-36 cursor-pointer hover:shadow-lg hover:border-white/10 transition-all">
                 <div className="hud-corner-tr"></div>
                 <div className="hud-corner-bl"></div>
                 
                 <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full" style={{ background: stat.color, opacity: 0.1, filter: 'blur(20px)' }}></div>
                 
                 <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-text-secondary tracking-widest uppercase" style={{ color: stat.color }}>[{stat.label}]</h3>
                 </div>
                 
                 <div className="flex flex-col space-y-3">
                    <div className="flex items-end space-x-2 font-mono">
                       <span className="text-4xl font-bold text-text-main" style={{ textShadow: `0 0 10px ${stat.color}60` }}>{stat.value}</span>
                       <span className="text-sm font-semibold text-text-secondary mb-1">/ {stat.total}</span>
                    </div>
                    
                    <div className="w-full h-1 bg-text-main/10 overflow-visible relative">
                       <div className="h-full relative" style={{ width: `${stat.perc}%`, background: `linear-gradient(90deg, transparent, ${stat.color})` }}>
                          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-4 bg-white" style={{ boxShadow: `0 0 10px ${stat.color}, 0 0 20px ${stat.color}` }}></div>
                       </div>
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* ROW 2: Radial Rings & Tickets */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
           {/* Ring 1 */}
           <div className="hud-panel p-8 flex flex-col items-center justify-center relative">
              <div className="hud-corner-tr"></div>
              <div className="hud-corner-bl"></div>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full" style={{ background: 'var(--accent-primary)', opacity: 0.1, filter: 'blur(30px)' }}></div>
              <h3 className="text-[10px] font-bold text-accent-primary uppercase tracking-[0.2em] absolute top-6 left-6">TOTAL TICKETS</h3>
              
              <div className="relative w-48 h-48 flex items-center justify-center mt-6">
                 {/* HUD Radar Rings Behind */}
                 <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 }}>
                    <circle cx="50%" cy="50%" r="46%" fill="none" stroke="var(--accent-primary)" strokeWidth="1" strokeDasharray="4 4" />
                    <circle cx="50%" cy="50%" r="38%" fill="none" stroke="var(--accent-secondary)" strokeWidth="1" strokeDasharray="2 6" />
                    {/* Crosshairs */}
                    <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="var(--accent-primary)" strokeWidth="1" strokeOpacity="0.3" />
                    <line x1="50%" y1="5%" x2="50%" y2="95%" stroke="var(--accent-primary)" strokeWidth="1" strokeOpacity="0.3" />
                 </svg>
                 <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                    <PieChart>
                       <Pie 
                         data={
                            (stats.tickets.open + stats.tickets.completed + stats.tickets.upgrade + stats.projects.total) > 0 
                            ? [
                                { value: stats.tickets.open, fill: 'rgba(255,255,255,0.8)' },
                                { value: stats.tickets.completed, fill: 'var(--accent-secondary)' },
                                { value: stats.tickets.upgrade, fill: 'var(--accent-primary)' },
                                { value: stats.projects.total, fill: 'var(--accent-violet)' }
                              ]
                            : [{ value: 1, fill: 'rgba(255,255,255,0.05)' }]
                         } 
                         dataKey="value" cx="50%" cy="50%" innerRadius={70} outerRadius={85} stroke="none" cornerRadius={10} paddingAngle={4}
                       />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="text-center z-10 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-text-main" style={{ textShadow: '0 0 10px var(--accent-secondary)' }}>{stats.tickets.total}</span>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 w-full mt-6 px-4">
                 <div className="text-center font-mono">
                     <div className="text-[9px] uppercase tracking-widest text-text-secondary mb-1">Open</div>
                    <div className="text-lg font-bold text-text-main">{stats.tickets.open}</div>
                 </div>
                 <div className="text-center font-mono">
                    <div className="text-[9px] uppercase tracking-widest text-text-secondary mb-1">Resolved</div>
                    <div className="text-lg font-bold text-accent-secondary">{stats.tickets.completed}</div>
                 </div>
                 <div className="text-center font-mono">
                     <div className="text-[9px] uppercase tracking-widest text-text-secondary mb-1">Upgrades</div>
                    <div className="text-lg font-bold text-text-main">{stats.tickets.upgrade}</div>
                 </div>
                 <div className="text-center font-mono">
                    <div className="text-[9px] uppercase tracking-widest text-text-secondary mb-1">Projects</div>
                    <div className="text-lg font-bold text-accent-violet">{stats.projects.total}</div>
                 </div>
              </div>
           </div>

           {/* Projects Ring */}
           <div className="hud-panel p-8 flex flex-col items-center justify-center relative">
              <div className="hud-corner-tr"></div>
              <div className="hud-corner-bl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full" style={{ background: 'var(--accent-secondary)', opacity: 0.1, filter: 'blur(30px)' }}></div>
              <h3 className="text-[10px] font-bold text-accent-secondary uppercase tracking-[0.2em] absolute top-6 left-6">PROJECTS</h3>
              
              <div className="relative w-48 h-48 flex items-center justify-center mt-6">
                 {/* HUD Radar Rings Behind */}
                 <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 }}>
                    <circle cx="50%" cy="50%" r="46%" fill="none" stroke="var(--accent-secondary)" strokeWidth="1" strokeDasharray="2 8" />
                    <circle cx="50%" cy="50%" r="38%" fill="none" stroke="var(--accent-violet)" strokeWidth="1" strokeDasharray="5 5" />
                    {/* Crosshairs */}
                    <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="var(--accent-secondary)" strokeWidth="1" strokeOpacity="0.3" />
                    <line x1="50%" y1="5%" x2="50%" y2="95%" stroke="var(--accent-secondary)" strokeWidth="1" strokeOpacity="0.3" />
                 </svg>
                 <ResponsiveContainer width="100%" height="100%" className="absolute inset-0">
                    <PieChart>
                       <defs>
                          <linearGradient id="ringGrad2" x1="0" y1="0" x2="1" y2="1">
                             <stop offset="0%" stopColor="var(--accent-violet)" />
                             <stop offset="100%" stopColor="var(--accent-primary)" />
                          </linearGradient>
                       </defs>
                       <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={8}>
                          {projectStatusData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? 'url(#ringGrad2)' : 'rgba(255,255,255,0.1)'} />
                          ))}
                       </Pie>
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="text-center z-10 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-text-main">{stats.projects.active}</span>
                    <span className="text-xs text-text-secondary mt-1">Active</span>
                 </div>
              </div>
              <div className="flex justify-between w-full mt-8 px-4 cursor-pointer" onClick={() => navigate('/projects')}>
                 <div className="text-center w-full bg-accent-secondary/10 py-2 rounded border border-accent-secondary/30 hover:bg-accent-secondary/20 transition-colors">
                    <span className="text-[10px] font-bold text-accent-secondary tracking-widest uppercase">View Registry</span>
                 </div>
              </div>
           </div>

           {/* Secondary Chart / Matrix */}
           <div className="hud-panel p-8 flex flex-col relative">
              <div className="hud-corner-tr"></div>
              <div className="hud-corner-bl"></div>
              <h3 className="text-[10px] font-bold text-accent-primary uppercase tracking-[0.2em] absolute top-6 left-6">SECTOR MATRIX</h3>
              <div className="flex-1 min-h-[200px] mt-8">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={collegeDistribution} layout="vertical" margin={{ left: 0 }}>
                       <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                             <stop offset="0%" stopColor="var(--accent-secondary)" stopOpacity={0.3}/>
                             <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={1}/>
                          </linearGradient>
                       </defs>
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9, fill: 'var(--text-secondary)', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: 'none', borderRadius: '8px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                       <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        </div>

        {/* ROW 3: Quick Action Links */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
            <button 
                onClick={() => navigate('/reports')}
                className="hud-panel p-6 flex items-center justify-center space-x-3 cursor-pointer hover:bg-accent-primary/10 hover:border-accent-primary transition-all group"
            >
               <div className="hud-corner-tr"></div>
               <div className="hud-corner-bl"></div>
               <Database size={20} className="text-accent-primary group-hover:scale-110 transition-transform" />
               <span className="text-[12px] font-bold tracking-widest uppercase text-text-main">System Reports</span>
            </button>
            <button 
                onClick={() => navigate('/billing')}
                className="hud-panel p-6 flex items-center justify-center space-x-3 cursor-pointer hover:bg-accent-secondary/10 hover:border-accent-secondary transition-all group"
            >
               <div className="hud-corner-tr"></div>
               <div className="hud-corner-bl"></div>
               <Briefcase size={20} className="text-accent-secondary group-hover:scale-110 transition-transform" />
               <span className="text-[12px] font-bold tracking-widest uppercase text-text-main">Billing & PO Tracking</span>
            </button>
        </div>

      </div>
    </div>
  );
}
