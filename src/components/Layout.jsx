import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  LayoutDashboard, Cctv, Activity, Users, FileBarChart, LogOut, 
  Shield, Home, Clock, MessageSquare, Gift, Settings, 
  Sun, Moon, Droplets, Zap, Menu, X, PlusCircle, Layers, Database, Fingerprint,
  Radio, ChevronLeft, ChevronRight, MapPin, Search, RefreshCw, FileText, Server, Sunrise, Waves, Building, Gamepad2, Tag
} from 'lucide-react';
import { useEffect, useState, useMemo, useRef } from 'react';
import logo from '../image/logo.png';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('cctv_theme');
    // Default to white (non-gaming) theme
    return saved || 'light';
  });
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
    localStorage.setItem('cctv_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'gaming' ? 'light' : 'gaming');
  };

  const [openGroups, setOpenGroups] = useState({});

  const menuItems = useMemo(() => [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, permission: 'Dashboard' },
    { 
      name: 'Devices', 
      isGroup: true,
      icon: Server, 
      permission: 'Assets', // This permission will be checked in the filter, but Super Admin bypasses it. Sub-items have their own.
      items: [
        { name: 'Camera', path: '/cameras', icon: Cctv, permission: 'Cameras' },
        { name: 'NVR', path: '/nvr', icon: Database, permission: 'NVRs' },
        { name: 'Biometric', path: '/biometrics', icon: Fingerprint, permission: 'Biometrics' },
        { name: 'Switches', path: '/network-switches', icon: Zap, permission: 'Network Switches' },
        { name: 'Racks', path: '/racks', icon: Layers, permission: 'Racks' },
      ]
    },
    { 
      name: 'Tickets', 
      isGroup: true,
      icon: FileBarChart, 
      permission: 'Maintenance',
      items: [
        { name: 'Ticket', path: '/tickets', icon: FileBarChart, permission: 'Tickets' },
        { name: 'Ticket Dashboard', path: '/tickets-dashboard', icon: LayoutDashboard, permission: 'Tickets' },
        { name: 'Upgrades', path: '/upgrades', icon: Shield, permission: 'Upgrades' },
        { name: 'Projects', path: '/projects', icon: Home, permission: 'Projects' },
        { name: 'Billing & PO', path: '/billing', icon: FileText, permission: 'Billing & PO' },
      ]
    },
    { 
      name: 'Master Data', 
      isGroup: true,
      icon: Layers, 
      permission: 'Logs',
      items: [
        { name: 'General Billing', path: '/general-billing', icon: FileText, permission: 'General Billing' },
        { name: 'Reports', path: '/reports', icon: FileText, permission: 'Reports' },
        { name: 'Division', path: '/division', icon: Building, permission: 'Divisions' },
        { name: 'Brands', path: '/brands', icon: Tag, permission: 'Brands' },
        { name: 'Add New Site', path: '/onboarding', icon: PlusCircle, permission: 'Onboarding' },
      ]
    },
    { 
      name: 'Settings', 
      isGroup: true,
      icon: Settings, 
      permission: 'Logs',
      items: [
        { name: 'Entry View', path: '/entry-view', icon: Activity, permission: 'Activity Logs' },
        { name: 'Backup & Restore', path: '/backup', icon: Database, permission: 'Database Backup' },
        { name: 'User Management', path: '/users', icon: Users, permission: 'User Management' },
      ]
    },
  ].map(item => {
    if (user?.role === 'Super Admin') return item;
    if (item.isGroup) {
      return {
        ...item,
        items: item.items.filter(sub => Array.isArray(user?.permissions) && user.permissions.includes(`${sub.permission}:VIEW`))
      };
    }
    return item;
  }).filter(item => {
    if (user?.role === 'Super Admin') return true;
    if (item.isGroup) return item.items.length > 0;
    return Array.isArray(user?.permissions) && user.permissions.includes(`${item.permission}:VIEW`);
  }), [user]);

  return (
    <div className={`flex h-screen relative overflow-hidden ${theme === 'gaming' ? 'text-white bg-[#082f49] gaming-pattern' : 'text-slate-900 bg-[#f0f4f8]'}`}>
      {/* Clean Sidebar Navigation */}
      <div 
        className={`h-full fixed inset-y-0 left-0 z-[110] flex flex-col transition-all duration-500 overflow-hidden ${
          collapsed ? 'w-20' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} bg-card border-r border-main shadow-sm`}
      >
        <div className={`h-24 flex items-center px-4 border-b border-main relative ${collapsed ? 'justify-center' : 'justify-start'}`}>
          <div className={`flex items-center w-full ${collapsed ? 'justify-center' : 'pr-4'}`}>
            <div className={`flex items-center justify-center shrink-0 transition-all ${
              collapsed 
                ? 'bg-white rounded-xl shadow-sm border border-slate-200 w-12 h-12 overflow-hidden' 
                : (theme === 'dark' || theme === 'gaming')
                  ? 'bg-white/95 rounded-xl w-full h-16 py-1.5 px-2 shadow-sm' 
                  : 'w-full h-16'
            }`}>
              <img src={logo} alt="Rathinam Logo" className={`object-contain ${
                collapsed 
                  ? 'w-auto h-[80%]' 
                  : (theme === 'dark' || theme === 'gaming')
                    ? 'w-full h-full' 
                    : 'w-full h-full mix-blend-multiply drop-shadow-sm'
              }`} />
            </div>
          </div>
          
          {/* Edge Toggle / Mobile Close Button */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-[130]">
            <button 
              onClick={() => sidebarOpen ? setSidebarOpen(false) : setCollapsed(!collapsed)}
              className="w-8 h-8 bg-card border border-main rounded-full shadow-md flex items-center justify-center text-secondary hover:text-accent-primary hover:border-accent-primary/30 transition-all"
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
              const isOpen = openGroups[item.name];
              return (
                <div key={item.name} className="space-y-1">
                  <button
                    onClick={() => {
                      if (collapsed) setCollapsed(false);
                      // Close all other groups and toggle the current one
                      setOpenGroups(prev => ({ [item.name]: !prev[item.name] }));
                      if (item.items && item.items.length > 0 && !openGroups[item.name]) {
                        navigate(item.items[0].path);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                      isOpen ? 'bg-panel text-accent-primary' : 'text-secondary hover:bg-panel hover:text-accent-primary'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon size={18} strokeWidth={2} className={isOpen ? 'text-accent-primary' : 'text-secondary group-hover:text-accent-primary'} />
                      {!collapsed && <span className="text-sm font-semibold tracking-tight">{item.name}</span>}
                    </div>
                    {!collapsed && <ChevronRight size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-accent-primary' : 'text-dim'}`} />}
                  </button>
                  
                  {isOpen && !collapsed && (
                    <div className="pl-4 space-y-1 animate-slide-down">
                      {item.items.map((subItem) => (
                        <NavLink
                          key={subItem.name}
                          to={subItem.path}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                              isActive
                                ? 'bg-accent-primary/10 text-accent-primary border-l-2 border-accent-primary'
                                : 'text-dim hover:text-accent-primary hover:bg-accent-primary/5'
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
                      ? 'bg-gradient-to-r from-accent-secondary to-accent-primary text-white shadow-lg'
                      : 'text-secondary hover:bg-panel hover:text-accent-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-white' : 'text-secondary group-hover:text-accent-primary'} />
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

        <div className="p-4 border-t border-main space-y-4">
          <div className={`flex items-center ${collapsed ? 'flex-col space-y-4' : 'justify-between'} w-full`}>
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-teal-500 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-teal-500/20 border-2 border-card">
                {String(user?.name || user?.username || 'U').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="text-left overflow-hidden">
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest leading-none mb-1 truncate">{user?.role}</p>
                  <p className="text-sm font-bold text-main leading-none truncate">{user?.name}</p>
                </div>
              )}
            </div>
            
            <button
              onClick={toggleTheme}
              className={`w-10 h-10 shrink-0 flex items-center justify-center bg-panel border border-main rounded-xl text-secondary hover:text-teal-600 transition-all shadow-sm group`}
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={20} className="group-hover:rotate-12 transition-transform" /> : 
               <Sun size={20} className="group-hover:rotate-45 transition-transform text-orange-500" />}
            </button>
          </div>

          <button
            onClick={logout}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'space-x-3 px-3'} py-2.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all duration-200 font-bold text-xs uppercase tracking-widest`}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-500 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'} ${theme === 'gaming' ? 'bg-[#082f49]' : 'bg-[#f0f4f8]'} custom-scrollbar`}
      >
        
        {/* Unified Top Header */}
        <header className="h-20 bg-card/80 backdrop-blur-md border-b border-main flex items-center px-4 lg:px-8 sticky top-0 z-[100] shadow-sm lg:hidden">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-secondary hover:bg-panel rounded-lg">
              <Menu size={20} />
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 lg:p-10 w-full max-w-7xl mx-auto pb-20">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>


      {/* Mobile Floating Action Button */}
      <button
        onClick={() => navigate('/tickets')}
        className="lg:hidden fixed bottom-24 right-4 z-[100] w-14 h-14 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl shadow-[0_8px_30px_rgb(13,148,136,0.3)] flex items-center justify-center transition-transform active:scale-95"
        style={{ borderRadius: '1.2rem' }}
      >
        <PlusCircle size={28} />
      </button>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-card/95 backdrop-blur-lg border-t border-main z-[100] flex items-center justify-around px-2 pb-1 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {[
          { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Tickets', path: '/tickets', icon: FileBarChart },
          { name: 'Devices', path: '/cameras', icon: Cctv },
          { name: 'Settings', path: '/users', icon: Settings }
        ].map(item => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-16 h-full transition-all ${
                isActive ? 'text-teal-600' : 'text-secondary hover:text-teal-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-teal-500/10' : ''}`}>
                  <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] mt-1 uppercase tracking-widest ${isActive ? 'font-black' : 'font-bold'}`}>{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[105] lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}
    </div>
  );
}
