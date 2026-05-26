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
import RackDetail from './pages/RackDetail';
import ActivityLogs from './pages/ActivityLogs';
import MoveHistory from './pages/MoveHistory';
import UnifiedOnboarding from './pages/UnifiedOnboarding';
import Reports from './pages/Reports';
import Occupation from './pages/Occupation';
import { useNotificationStore } from './store/notificationStore';

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
          <Route path="activity-logs" element={hasPermission('Logs') ? <ActivityLogs /> : <Navigate to="/" />} />
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
    </>
  );
}

export default App;
