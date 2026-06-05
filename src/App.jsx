import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Launcher from './pages/Launcher';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Cameras from './pages/Cameras';
import Maintenance from './pages/Maintenance';
import Users from './pages/Users';
import Network from './pages/Network';
import Biometrics from './pages/Biometrics';
import NVR from './pages/NVR';
import DeviceManagement from './pages/DeviceManagement';
import DeviceDetail from './pages/DeviceDetail';
import CameraDetail from './pages/CameraDetail';
import NVRDetail from './pages/NVRDetail';
import BiometricDetail from './pages/BiometricDetail';
import SwitchDetail from './pages/SwitchDetail';
import LocationDetail from './pages/LocationDetail';
import DeviceHistory from './pages/DeviceHistory';

import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import Upgrades from './pages/Upgrades';
import Billing from './pages/Billing';
import ProjectTickets from './pages/ProjectTickets';
import NetworkSwitches from './pages/NetworkSwitches';
import Racks from './pages/Racks';
import NvrCameraMapping from './pages/NvrCameraMapping';
import RackDetail from './pages/RackDetail';
import MoveHistory from './pages/MoveHistory';
import UnifiedOnboarding from './pages/UnifiedOnboarding';
import Reports from './pages/Reports';
import Occupation from './pages/Occupation';
import { useNotificationStore } from './store/notificationStore';
import { useConfirmStore } from './store/confirmStore';
import { AlertTriangle, X } from 'lucide-react';

const GlobalNotification = () => {
  const { notification } = useNotificationStore();
  if (!notification) return null;

  return (
    <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center space-x-3 animate-slide-down ${
      notification.type === 'success' 
        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
        : 'bg-red-500/20 border-red-500/30 text-red-400'
    }`}>
      <div className={`w-2 h-2 rounded-full animate-pulse ${notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
      <span className="text-sm font-bold uppercase tracking-widest">{notification.message}</span>
    </div>
  );
};

const GlobalConfirmModal = () => {
  const { isOpen, message, subMessage, onConfirm, closeConfirm } = useConfirmStore();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    closeConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card border border-rose-500/30 rounded-3xl w-full max-w-sm flex flex-col shadow-[0_0_50px_rgba(225,29,72,0.15)] animate-slide-up">
        <div className="p-6 border-b border-main flex justify-between items-start">
          <div className="flex items-center space-x-3 text-rose-500">
            <div className="p-2 bg-rose-500/10 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Confirmation Required</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/80">Permanent Action</p>
            </div>
          </div>
          <button onClick={closeConfirm} className="text-dim hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 bg-panel/30 text-center">
          <p className="text-sm font-bold text-main">{message}</p>
          {subMessage && <p className="text-xs text-secondary mt-2">{subMessage}</p>}
        </div>
        <div className="p-4 border-t border-main flex space-x-3 bg-card rounded-b-3xl">
          <button 
            onClick={closeConfirm} 
            className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-panel border border-main text-secondary hover:text-main hover:bg-panel/80 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm} 
            className="flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { isAuthenticated: isAuth, user } = useAuthStore();
  const isAuthenticated = isAuth && !!user;
  const isAdmin = user?.role === 'Super Admin' || user?.role === 'Admin';
  const isSuperAdmin = user?.role === 'Super Admin';

  const hasPermission = (perm) => {
    if (user?.role === 'Super Admin') return true;
    return Array.isArray(user?.permissions) && user.permissions.includes(`${perm}:VIEW`);
  };

  return (
    <>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        
        {/* Authenticated Wrapper */}
        <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="cameras" element={hasPermission('Assets') ? <Cameras /> : <Navigate to="/" />} />
          <Route path="nvr" element={hasPermission('Storage') ? <NVR /> : <Navigate to="/" />} />
          <Route path="nvr-mapping" element={hasPermission('Storage') ? <NvrCameraMapping /> : <Navigate to="/" />} />
          <Route path="biometrics" element={hasPermission('Identity') ? <Biometrics /> : <Navigate to="/" />} />
          <Route path="network-switches" element={hasPermission('Network') ? <NetworkSwitches /> : <Navigate to="/" />} />
          <Route path="racks" element={hasPermission('Network') ? <Racks /> : <Navigate to="/" />} />
          <Route path="maintenance" element={hasPermission('Maintenance') ? <Maintenance /> : <Navigate to="/" />} />
          <Route path="tickets" element={hasPermission('Maintenance') ? <Tickets /> : <Navigate to="/" />} />
          <Route path="tickets/:id" element={hasPermission('Maintenance') ? <TicketDetail /> : <Navigate to="/" />} />
          <Route path="upgrades" element={hasPermission('Maintenance') ? <Upgrades /> : <Navigate to="/" />} />
          <Route path="billing" element={hasPermission('Maintenance') ? <Billing /> : <Navigate to="/" />} />
          <Route path="projects" element={hasPermission('Projects') ? <Projects /> : <Navigate to="/" />} />
          <Route path="projects/:id" element={hasPermission('Projects') ? <ProjectDetail /> : <Navigate to="/" />} />
          <Route path="users" element={hasPermission('Users') ? <Users /> : <Navigate to="/" />} />
          <Route path="onboarding" element={<UnifiedOnboarding />} />
          <Route path="reports" element={hasPermission('Logs') ? <Reports /> : <Navigate to="/" />} />
          <Route path="occupation" element={<Occupation />} />
          
          {/* Details & Sub-pages */}
          <Route path="devices/detail/:type/:id" element={<DeviceDetail />} />
          <Route path="devices/cameras/:id" element={<CameraDetail />} />
          <Route path="devices/nvr/:id" element={<NVRDetail />} />
          <Route path="devices/biometrics/:id" element={<BiometricDetail />} />
          <Route path="devices/switches/:id" element={<SwitchDetail />} />
          <Route path="devices/racks/:id" element={<RackDetail />} />
          <Route path="devices/history/:type/:id" element={<DeviceHistory />} />
          <Route path="cameras/location/:locationName" element={<LocationDetail />} />
          <Route path="projects/:projectName/:projectId/tickets" element={<ProjectTickets />} />
          <Route path="network" element={<Network />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <GlobalNotification />
      <GlobalConfirmModal />
    </>
  );
}

export default App;
