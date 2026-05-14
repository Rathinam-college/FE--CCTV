import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowRight, Zap } from 'lucide-react';
import loginImage from '../image/loginpage .png';
import logo from '../image/logo.png';

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
      showNotification('Access Granted: System initialized');
      navigate('/dashboard');
    } else {
      setError('Invalid cryptographic key (credentials)');
      showNotification('Access Denied: Identity unverified', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden bg-body">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px] pulse-glow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/5 rounded-full blur-[120px] pulse-glow delay-1000"></div>

      <div className="w-full max-w-[1200px] flex flex-col lg:flex-row items-center z-10 p-6 gap-20">
        
        {/* Branding Side */}
        <div className="hidden lg:flex flex-1 flex-col items-start space-y-8 animate-fade-in">
          <div className="flex items-center space-x-4">
            <div className="bg-card p-2 rounded-2xl shadow-xl shadow-teal-500/10 border border-main">
              <img src={logo} alt="Logo" className="h-12 w-auto" />
            </div>
            <div className="leading-none">
              <h1 className="text-4xl font-['Space_Grotesk'] font-black tracking-tighter text-main">Rathinam <span className="text-teal-500 uppercase">cctv control</span></h1>
              <p className="text-[10px] font-black text-secondary uppercase tracking-[0.4em] mt-2">Security & Infrastructure Intelligence</p>
            </div>
          </div>
          
          <div className="relative group w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
            <div className="relative glass-panel overflow-hidden border-main bg-card shadow-2xl">
              <img 
                src={loginImage} 
                alt="Branding" 
                className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-all duration-700 transform group-hover:scale-[1.01]"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-secondary text-xs font-bold uppercase tracking-widest">
              <Shield size={16} className="text-emerald-500" />
              <span>TLS 1.3 Secure</span>
            </div>
            <div className="flex items-center space-x-2 text-secondary text-xs font-bold uppercase tracking-widest">
              <Zap size={16} className="text-cyan-500" />
              <span>Edge Optimized</span>
            </div>
          </div>
        </div>

        {/* Login Form Side */}
        <div className="w-full max-w-md animate-slide-up">
          <div className="glass-panel p-10 bg-card border-main relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-cyan-500"></div>
            
            <div className="mb-10">
              <h2 className="text-3xl font-['Space_Grotesk'] font-black text-main mb-2">Initialize Session</h2>
              <p className="text-secondary text-xs font-bold uppercase tracking-widest">Provide administrative credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary group-focus-within:text-teal-500 transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input w-full !pl-12 py-4 placeholder:text-secondary border-main focus:border-teal-500 bg-panel"
                    placeholder="admin@rathinam.in"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-dim uppercase tracking-widest">Access Key</label>
                  <button type="button" className="text-[10px] font-black text-teal-500 uppercase tracking-widest hover:text-teal-400 transition-colors">Recovery</button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input w-full !pl-12 py-4 placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="neon-button w-full h-14 mt-4"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span className="flex items-center">
                    Authorize Access <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
            </form>
            
            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Rathinam Institutions Security Portal v4.0</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
