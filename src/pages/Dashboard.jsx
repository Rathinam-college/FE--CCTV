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
    tickets: { total: 0, open: 0, inProgress: 0, completed: 0 },
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
        <h2 className="text-4xl font-black text-white tracking-tight mb-3">Access Restricted</h2>
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
      className="group relative p-8 bg-card/40 backdrop-blur-xl border border-main rounded-[2.5rem] hover:border-teal-500/30 transition-all duration-500 cursor-pointer overflow-hidden shadow-2xl"
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
    <div className="space-y-10 max-w-[1600px] mx-auto animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-main pb-10">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-teal-500 uppercase tracking-[0.4em]">Dashboard Overview</span>
          </div>
          <h1 className="text-5xl font-black text-main tracking-tighter flex items-center">
            <LayoutGrid className="mr-5 text-teal-600" size={48} />
            CCTV DASHBOARD
          </h1>
          <p className="text-xs text-secondary mt-3 font-bold uppercase tracking-[0.2em]">
            System Overview • <span className="text-teal-600">Rathinam Global University</span>
          </p>
        </div>
        <div className="mt-8 md:mt-0 flex items-center space-x-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-secondary uppercase tracking-widest mb-1">System Status</span>
            <div className="flex items-center space-x-2 px-6 py-2.5 bg-panel rounded-2xl border border-main">
              <Shield size={14} className="text-teal-500" />
              <span className="text-xs font-black text-main uppercase tracking-widest">All Systems Normal</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-secondary uppercase tracking-widest mb-1">Date</span>
            <div className="flex items-center space-x-3 px-6 py-2.5 bg-panel rounded-2xl border border-main font-mono text-xs font-black text-main">
              <Clock size={14} className="text-teal-500" />
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-black text-main uppercase tracking-[0.4em] flex items-center">
          <Zap size={18} className="mr-3 text-teal-500" />
          Key Devices
        </h2>
        <div className="dashboard-grid">
          <StatCard title="CAMERA" value={stats.cameras.online} total={stats.cameras.total} icon={Cctv} color="#3b82f6" trend={12} path="/cameras" />
          <StatCard title="NVR" value={stats.nvrs.online} total={stats.nvrs.total} icon={Database} color="#10b981" trend={4} path="/nvr" />
          <StatCard title="Biometric" value={stats.biometrics.online} total={stats.biometrics.total} icon={Fingerprint} color="#8b5cf6" trend={-2} path="/biometrics" />
          <StatCard title="Switches" value={stats.switches.online} total={stats.switches.total} icon={Zap} color="#f59e0b" trend={8} path="/network-switches" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-10 border border-main bg-card shadow-2xl">
          <div className="mb-10">
            <h2 className="text-xl font-black text-main tracking-tight uppercase">Asset Distribution</h2>
            <p className="text-xs text-secondary mt-1 font-bold uppercase tracking-widest">Volume Breakdown by Institution</p>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collegeDistribution} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontWeight: 'black', textTransform: 'uppercase' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.4 }} 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '16px', 
                    boxShadow: 'var(--panel-shadow)',
                    padding: '16px'
                  }} 
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                  {collegeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#0ea5e9', '#10b981', '#8b5cf6', '#f43f5e', '#f59e0b'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-10 bg-card border-main flex flex-col shadow-2xl">
          <div className="mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest flex items-center">
              <Shield size={18} className="mr-3 text-violet-400" />
              Ticket Analytics
            </h3>
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">Ticket Progress</p>
          </div>
          
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ticketStatusData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={10}
                  dataKey="value"
                >
                  {ticketStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px' }} />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ paddingTop: '30px' }}
                  formatter={(value) => <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-10 space-y-4">
            {[
              { label: 'Active Pipeline', count: stats.tickets.open + stats.tickets.inProgress, icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10', path: '/tickets' },
              { label: 'Resolution Rate', count: `${Math.round((stats.tickets.completed/stats.tickets.total)*100 || 0)}%`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10', path: '/tickets' }
            ].map((item, i) => (
              <div key={i} onClick={() => navigate(item.path)} className="flex items-center justify-between p-5 rounded-3xl bg-panel border border-main hover:border-teal-500/30 transition-all cursor-pointer group shadow-sm">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-2xl ${item.bg} border border-white/5`}>
                    <item.icon size={20} className={item.color} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">{item.label}</p>
                    <p className="text-xl font-black text-main">{item.count}</p>
                  </div>
                </div>
                <ArrowUpRight size={18} className="text-dim group-hover:text-white transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="glass-panel p-10 bg-card border-main flex flex-col shadow-2xl">
          <div className="mb-8">
            <h3 className="text-lg font-black uppercase tracking-widest flex items-center">
              <Briefcase size={18} className="mr-3 text-blue-400" />
              Projects Status
            </h3>
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest mt-1">Project Progress</p>
          </div>
          
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={10}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '16px' }} />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ paddingTop: '30px' }}
                  formatter={(value) => <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 glass-panel p-10 border border-main bg-card shadow-2xl flex flex-col justify-center">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div onClick={() => navigate('/projects')} className="p-8 rounded-[2rem] bg-panel border border-main hover:border-blue-500/30 transition-all cursor-pointer group">
                 <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 border border-blue-500/20">
                    <Zap size={24} />
                 </div>
                 <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Active Initiatives</h4>
                 <p className="text-4xl font-black text-main">{stats.projects.active}</p>
                 <div className="mt-4 flex items-center text-[10px] font-black text-blue-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    View Registry <ArrowUpRight size={14} className="ml-2" />
                 </div>
              </div>
              <div onClick={() => navigate('/projects')} className="p-8 rounded-[2rem] bg-panel border border-main hover:border-emerald-500/30 transition-all cursor-pointer group">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20">
                    <CheckCircle size={24} />
                 </div>
                 <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Successfully Closed</h4>
                 <p className="text-4xl font-black text-main">{stats.projects.completed}</p>
                 <div className="mt-4 flex items-center text-[10px] font-black text-emerald-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    View Archive <ArrowUpRight size={14} className="ml-2" />
                 </div>
              </div>
              <div onClick={() => navigate('/projects')} className="p-8 rounded-[2rem] bg-panel border border-main hover:border-amber-500/30 transition-all cursor-pointer group">
                 <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 border border-amber-500/20">
                    <Clock size={24} />
                 </div>
                 <h4 className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mb-1">Strategic Hold</h4>
                 <p className="text-4xl font-black text-main">{stats.projects.onHold}</p>
                 <div className="mt-4 flex items-center text-[10px] font-black text-amber-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Manage Queue <ArrowUpRight size={14} className="ml-2" />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
