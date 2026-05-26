import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  Zap, 
  Cctv, 
  Shield, 
  FileBarChart, 
  Users, 
  Wrench, 
  MapPin,
  HardDrive,
  Search,
  LayoutDashboard,
  Fingerprint,
  ChevronRight,
  Globe,
  Lock,
  Cpu,
  Activity,
  LayoutGrid,
  RefreshCw
} from 'lucide-react';

export default function Launcher() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const allApps = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/50', desc: 'Real-time analytics and system overview' },
    { name: 'Assets', icon: Cctv, path: '/cameras', color: 'from-orange-400 to-red-500', shadow: 'shadow-orange-500/50', desc: 'Hardware asset inventory and management' },
    { name: 'Storage', icon: HardDrive, path: '/nvr', color: 'from-gray-600 to-slate-800', shadow: 'shadow-gray-500/50', desc: 'Digital storage and recording nodes' },
    { name: 'Identity', icon: Fingerprint, path: '/biometrics', color: 'from-purple-500 to-pink-600', shadow: 'shadow-purple-500/50', desc: 'Identity verification and access control' },
    ...(user?.role === 'Super Admin' ? [
      { name: 'Maintenance', icon: Wrench, path: '/maintenance', color: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/50', desc: 'Hardware repair and ticket workflow' },
      { name: 'Routes', icon: MapPin, path: '/routes', color: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-500/50', desc: 'Campus site and patrol path mapping' },
      { name: 'Network', icon: Zap, path: '/network-switches', color: 'from-cyan-400 to-blue-500', shadow: 'shadow-cyan-500/50', desc: 'Infrastructure and bandwidth monitoring' },
      { name: 'Reports', icon: FileBarChart, path: '/reports', color: 'from-rose-400 to-red-500', shadow: 'shadow-rose-500/50', desc: 'Compliance and audit documentation' },
      { name: 'Onboarding', icon: LayoutGrid, path: '/onboarding', color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/50', desc: 'Batch register hardware and nodes' },
      { name: 'Unified Editor', icon: RefreshCw, path: '/asset-editor', color: 'from-indigo-500 to-purple-600', shadow: 'shadow-indigo-500/50', desc: 'Modify hardware across all modules' },
      { name: 'Users', icon: Users, path: '/users', color: 'from-violet-500 to-fuchsia-600', shadow: 'shadow-violet-500/50', desc: 'Role-based access and permissions' }
    ] : [])
  ];

  const filteredApps = allApps.filter(app => app.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-body text-main selection:bg-teal-500/30">
      {/* Dynamic Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px] animate-blob delay-300"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-emerald-600/5 rounded-full blur-[120px] animate-blob delay-700"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-20 flex flex-col items-center">
        {/* Top Branding & Status */}
        <div className="w-full flex justify-between items-center mb-16 animate-slide-down">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/30">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tighter text-main">SMART ASSETS <span className="text-teal-500">v2.4</span></h2>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em]">Enterprise Security OS</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 bg-panel border border-main rounded-full px-4 py-2 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">System Online</span>
            </div>
            <div className="h-4 w-[1px] bg-main opacity-10"></div>
            <div className="flex items-center space-x-2">
              <Globe size={14} className="text-teal-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Region: AS-SOUTH-1</span>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="text-center mb-16 max-w-3xl animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-black text-main tracking-tight mb-6 leading-[1.1]">
            Secure. Monitor. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-teal-600 to-indigo-600">Manage Everything.</span>
          </h1>
          <p className="text-lg text-secondary font-medium leading-relaxed mb-10 max-w-2xl mx-auto">
            Welcome back, <span className="text-main font-bold">{user?.name || 'Authorized Personnel'}</span>. 
            Access your secure command center to oversee infrastructure and maintain campus safety.
          </p>

          {/* Search Box */}
          <div className="relative max-w-xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-card border border-main rounded-2xl p-2 flex items-center shadow-2xl">
              <Search className="ml-4 text-secondary" size={20} />
              <input 
                type="text" 
                placeholder="Search command or module..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-main px-4 py-3 flex-1 text-lg placeholder:text-secondary"
              />
              <div className="hidden sm:flex items-center space-x-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-dim mr-2">
                <span className="px-1 text-white">CTRL</span>
                <span>+</span>
                <span className="px-1 text-white">K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {filteredApps.map((app, index) => (
            <div 
              key={app.name}
              onClick={() => navigate(app.path)}
              className="glass-card p-6 rounded-[2rem] cursor-pointer group flex flex-col justify-between h-56 relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Background Icon Watermark */}
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-500 transform group-hover:scale-125">
                <app.icon size={160} />
              </div>

              <div className="flex justify-between items-start relative z-10">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${app.color} shadow-xl transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <app.icon className="text-white" size={28} />
                </div>
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 transition-all duration-300">
                  <ChevronRight size={18} className="text-white transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="relative z-10">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{app.name}</h3>
                <p className="text-xs text-dim font-medium leading-relaxed line-clamp-2">{app.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* System Stats Footer */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-6 p-8 rounded-[3rem] bg-white/5 border border-white/10 backdrop-blur-xl animate-slide-up delay-300">
          {[
            { label: 'Active Streams', value: '1,284', icon: Cpu, color: 'text-blue-400' },
            { label: 'Encryption', value: 'AES-256', icon: Lock, color: 'text-emerald-400' },
            { label: 'Network Uptime', value: '99.98%', icon: Activity, color: 'text-purple-400' },
            { label: 'Users Active', value: '12 Online', icon: Users, color: 'text-rose-400' }
          ].map(stat => (
            <div key={stat.label} className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                <stat.icon size={14} className={stat.color} />
                <span className="text-[10px] font-black text-dim uppercase tracking-[0.2em]">{stat.label}</span>
              </div>
              <p className="text-2xl font-black text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-[10px] font-bold text-dim uppercase tracking-[0.5em] opacity-40">
          Powered by Rathinam Global University &copy; 2026
        </p>
      </div>
    </div>
  );
}
