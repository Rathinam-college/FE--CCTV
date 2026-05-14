import { useState } from 'react';
import { X, Send, RefreshCw, MessageSquare } from 'lucide-react';

export default function RemarkModal({ isOpen, onClose, onSave, title, loading }) {
  const [remark, setRemark] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!remark.trim()) return;
    onSave(remark);
    setRemark('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0a0a0a] w-full max-w-xl border border-white/10 overflow-hidden rounded-[2.5rem] shadow-2xl">
        <div className="p-8 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20">
              <MessageSquare size={24} />
            </div>
            <div>
               <h3 className="text-lg font-black text-white uppercase tracking-tight">
                 {title || 'Add Maintenance Log'}
               </h3>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Master Audit Log Integration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-10 space-y-8">
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Maintenance Remark / Details</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Enter detailed maintenance notes for the audit trail..."
              className="w-full p-6 min-h-[200px] text-sm text-white bg-white/5 rounded-3xl border border-white/10 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none outline-none"
              autoFocus
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSave}
              disabled={loading || !remark.trim()}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin mr-3" size={18} /> : <Send className="mr-3" size={18} />}
              Commit to History
            </button>
            <button 
              onClick={onClose}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] transition-all border border-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
