import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

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
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden font-sans">
      
      {/* Full-screen Background Image with subtle zoom animation */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-10000 scale-105"
        style={{ backgroundImage: `url(${bgImage})` }}
      ></div>
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[6px]"></div>

      <div className="relative z-10 w-full max-w-md px-6 py-12 flex flex-col items-center">
        
        {/* Premium Glassmorphic Login Card */}
        <div className="w-full bg-white/90 backdrop-blur-2xl border border-white/50 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2rem] p-8 sm:p-10 flex flex-col items-center animate-fade-in-up">
          
          {/* Logo Section properly scaled for wide aspect ratios */}
          <div className="w-full flex justify-center mb-8">
            <img 
              src={logo} 
              alt="Brand Logo" 
              className="w-full max-w-[260px] h-auto object-contain drop-shadow-sm" 
            />
          </div>

          <div className="w-full text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Login</h1>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Please sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 w-full">
            
            <div className="space-y-2 relative group">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Email</label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm text-sm font-medium"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2 relative group">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Password</label>
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-11 pr-12 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm text-sm font-medium"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                >
                  <div className="p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-2xl flex items-center space-x-3 border border-red-100 mt-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}

            <div className="pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex items-center justify-center py-4 px-6 border border-transparent text-sm font-bold rounded-2xl text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20 transition-all duration-300 shadow-xl shadow-slate-900/20 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <span>Continue to Dashboard</span>
                )}
              </button>
            </div>
          </form>
          
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/50 font-medium tracking-wide">
            Secured by enterprise-grade encryption
          </p>
        </div>

      </div>
    </div>
  );
}

