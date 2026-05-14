import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, Cctv, Activity, Users, FileBarChart, LogOut, 
  Shield, Home, Clock, MessageSquare, Gift, Settings, 
  Sun, Moon, Zap, Menu, X, PlusCircle, Layers, Database, Fingerprint,
  Radio, ChevronLeft, ChevronRight, MapPin, Search, RefreshCw, FileText
} from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import logo from '../image/logo.png';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light'); // Default to light
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  const [toolsOpen, setToolsOpen] = useState(false);

  const menuItems = useMemo(() => [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'Dashboard' },
    { name: 'CCTV', path: '/cameras', icon: Cctv, permission: 'Assets' },
    { name: 'NVR', path: '/nvr', icon: Database, permission: 'Storage' },
    { name: 'Biometric', path: '/biometrics', icon: Fingerprint, permission: 'Identity' },
    { name: 'Switches', path: '/network-switches', icon: Zap, permission: 'Network' },
    { name: 'Tickets', path: '/tickets', icon: FileBarChart, permission: 'Maintenance' },
    { name: 'Projects', path: '/projects', icon: Home, permission: 'Projects' },
    { 
      name: 'System Tools', 
      isGroup: true,
      icon: Settings, 
      permission: 'Logs',
      items: [
        { name: 'Audit Logs', path: '/activity-logs', icon: Activity, permission: 'Logs' },
        { name: 'Intelligence Reports', path: '/reports', icon: FileText, permission: 'Logs' },
        { name: 'Site Onboarding', path: '/onboarding', icon: PlusCircle, permission: 'Users' },
        { name: 'Admin Control', path: '/users', icon: Users, permission: 'Users' },
      ]
    },
  ].filter(item => {
    if (user?.role === 'Super Admin') return true;
    return user?.permissions?.includes(`${item.permission}:VIEW`);
  }), [user]);

  return (
    <div className="flex h-screen relative overflow-hidden text-main bg-main font-['Inter']">
      {/* Clean Sidebar Navigation */}
      <div 
        className={`h-full fixed inset-y-0 left-0 z-[110] flex flex-col transition-all duration-500 overflow-hidden ${
          collapsed ? 'w-20' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-card border-r border-main shadow-sm`}
      >
        <div className={`h-24 flex items-center px-4 border-b border-main relative ${collapsed ? 'justify-center' : 'justify-start'}`}>
          <div className={`flex items-center space-x-3 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-card rounded-xl flex items-center justify-center shadow-sm border border-main shrink-0 p-1.5">
              <img src={logo} alt="Rathinam Logo" className="h-full w-full object-contain" />
            </div>
            {!collapsed && (
              <div className="leading-tight truncate">
                <span className="text-lg font-black tracking-tight text-main block uppercase">Rathinam</span>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">cctv control</span>
              </div>
            )}
          </div>
          
          {/* Edge Toggle / Mobile Close Button */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-[130]">
            <button 
              onClick={() => sidebarOpen ? setSidebarOpen(false) : setCollapsed(!collapsed)}
              className="w-8 h-8 bg-card border border-main rounded-full shadow-md flex items-center justify-center text-secondary hover:text-teal-600 hover:border-teal-500/30 transition-all"
              title={sidebarOpen ? "Close Menu" : (collapsed ? "Expand Sidebar" : "Collapse Sidebar")}
            >
              {sidebarOpen ? <X size={14} /> : (collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar space-y-1">
          {menuItems.map((item) => {
            if (item.isGroup) {
              return (
                <div key={item.name} className="space-y-1">
                  <button
                    onClick={() => {
                      if (collapsed) setCollapsed(false);
                      setToolsOpen(!toolsOpen);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      toolsOpen ? 'bg-panel text-teal-600' : 'text-secondary hover:bg-panel hover:text-teal-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon size={18} strokeWidth={2} className={toolsOpen ? 'text-teal-600' : 'text-secondary group-hover:text-teal-600'} />
                      {!collapsed && <span className="text-sm font-semibold tracking-tight">{item.name}</span>}
                    </div>
                    {!collapsed && <ChevronRight size={14} className={`transition-transform duration-300 ${toolsOpen ? 'rotate-90 text-teal-600' : 'text-dim'}`} />}
                  </button>
                  
                  {toolsOpen && !collapsed && (
                    <div className="pl-4 space-y-1 animate-slide-down">
                      {item.items.map((subItem) => (
                        <NavLink
                          key={subItem.name}
                          to={subItem.path}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                              isActive
                                ? 'bg-teal-500/10 text-teal-600 border-l-2 border-teal-500'
                                : 'text-dim hover:text-teal-600 hover:bg-teal-500/5'
                            }`
                          }
                        >
                          <subItem.icon size={14} className="shrink-0" />
                          <span className="text-xs font-bold uppercase tracking-widest">{subItem.name}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                      : 'text-secondary hover:bg-panel hover:text-teal-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-secondary group-hover:text-teal-600'} />
                    {!collapsed && (
                      <span className={`text-sm font-semibold tracking-tight ${isActive ? 'text-white' : ''}`}>
                        {item.name}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="p-4 border-t border-main">
          <button
            onClick={logout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all duration-200 font-bold text-xs uppercase tracking-widest"
          >
            <LogOut size={18} />
            {!collapsed && <span>Purge Session</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-500 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'} bg-main custom-scrollbar`}
      >
        
        {/* Unified Top Header */}
        <header className="h-20 bg-card/80 backdrop-blur-md border-b border-main flex items-center justify-between px-4 lg:px-8 sticky top-0 z-[100] shadow-sm">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-secondary hover:bg-panel rounded-lg">
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center space-x-2 text-[10px] font-black text-secondary uppercase tracking-[0.2em]">
              <span className="text-dim">RATHINAM COMMAND</span>
              <span className="opacity-20">/</span>
              <span className="text-teal-600 font-black">
                {(menuItems.find(i => location.pathname.includes(i.path))?.name || 
                  (location.pathname.includes('/devices/') ? 'ASSET MGMT' : 
                   location.pathname.substring(1).split('/')[0].replace('-', ' ') || 'DASHBOARD')).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center bg-panel border border-main rounded-xl text-secondary hover:text-teal-600 transition-all shadow-sm group"
            >
              {theme === 'light' ? <Moon size={20} className="group-hover:rotate-12 transition-transform" /> : <Sun size={20} className="group-hover:rotate-45 transition-transform" />}
            </button>
            <div className="flex items-center space-x-3 pl-6 border-l border-main">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest leading-none mb-1">{user?.role}</p>
                <p className="text-sm font-bold text-main leading-none">{user?.name}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-teal-500/20 border-2 border-card">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-10 w-full max-w-7xl mx-auto pb-20">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>


      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[105] lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}
    </div>
  );
}
