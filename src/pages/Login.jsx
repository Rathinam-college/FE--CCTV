import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Eye, EyeOff, Lock, Mail, Shield, ShieldCheck, ArrowRight, Activity, Sparkles } from 'lucide-react';

import logo from '../image/logo.png';
import bgImage from '../image/brlogin.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const { showNotification } = useNotificationStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const success = await login(email, password);
    if (success) {
      showNotification('Authentication Successful', 'success');
      navigate('/dashboard');
    } else {
      setError('Invalid credentials provided. Please try again.');
      showNotification('Authentication Failed', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden font-sans bg-slate-950">
      
      {/* Full-screen Background Image with subtle zoom */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-10000 scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      
      {/* High-tech Multi-layered Backdrop & Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-sky-950/90 backdrop-blur-[8px]" />
      
      {/* Ambient Animated Glow Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Decorative Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)`, 
          backgroundSize: '24px 24px' 
        }} 
      />

      <div className="relative z-10 w-full max-w-[440px] px-4 py-8 flex flex-col items-center">
        
        {/* Main Glassmorphic Login Card */}
        <div className="w-full bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/40 dark:border-slate-700/50 shadow-[0_25px_70px_rgba(0,0,0,0.45)] rounded-3xl p-8 sm:p-10 flex flex-col items-center relative overflow-hidden transition-all duration-300">
          
          {/* Top Subtle Gradient Accent Line */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-400 via-cyan-500 to-blue-600" />

          {/* Logo Showcase with soft frosted badge */}
          <div className="w-full flex flex-col items-center mb-6">
            <div className="bg-white px-6 py-3.5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center max-w-[220px] transition-transform hover:scale-[1.02] duration-300">
              <img 
                src={logo} 
                alt="Rathinam Logo" 
                className="w-full h-auto max-h-16 object-contain" 
              />
            </div>
          </div>

          {/* Header Title */}
          <div className="w-full text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              Welcome Back
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">
              Enter your credentials to access security logs
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 w-full">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                <span>Email Address</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-600 transition-colors">
                  <Mail size={17} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 transition-all text-xs sm:text-sm font-medium"
                  placeholder="admin@mail.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            
            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Password</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-600 transition-colors">
                  <Lock size={17} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-11 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 transition-all text-xs sm:text-sm font-medium"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-cyan-600 transition-colors"
                  tabIndex={-1}
                >
                  <div className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </div>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-3 rounded-xl flex items-center space-x-2.5 border border-rose-500/20 text-xs font-semibold animate-shake">
                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex items-center justify-center py-3.5 px-6 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-cyan-700 hover:via-teal-600 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-cyan-500/25 transition-all duration-300 shadow-lg shadow-slate-900/20 hover:shadow-cyan-500/25 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 cursor-pointer overflow-hidden"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2.5">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Continue to Dashboard</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
            </div>
          </form>

        </div>

        {/* Footer info */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-[11px] text-slate-400/90 font-medium tracking-wide">
            © {new Date().getFullYear()} Rathinam Technical Campus · Security Operations Center
          </p>
        </div>

      </div>
    </div>
  );
}

