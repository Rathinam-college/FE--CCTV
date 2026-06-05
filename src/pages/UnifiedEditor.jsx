import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { 
  Cctv, HardDrive, Fingerprint, Network, 
  Building, MapPin, Tag, Cpu, ShieldCheck,
  Plus, Save, X, Trash2, Edit2, Upload, Search,
  ChevronDown, Monitor, CheckCircle, AlertCircle,
  LayoutGrid, ArrowRight, Layers, RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';

export default function UnifiedEditor() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // All Assets for search
  const [allItems, setAllItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  // Form Data States
  const [formData, setFormData] = useState({
    id: '',
    type: '', // 'CCTV', 'NVR', 'BIOMETRIC', 'SWITCH'
    name: '',
    ipAddress: '',
    serialNumber: '',
    collegeName: '',
    block: '',
    floor: '',
    room: '',
    
    // CCTV Specific
    deviceType: 'Bullet',
    gateway: '',
    subnetMask: '',
    macAddress: '',
    campusZone: 'INSIDE',
    
    // NVR Specific
    hardDisk: '',
    channel: '',
    brand: '',
    
    // Biometric Specific
    bioType: 'Fingerprint',
    
    // Switch Specific
    model: '',
    portCount: ''
  });

  const [locations, setLocations] = useState({ colleges: [], blocks: [], floors: [], rooms: [] });

  useEffect(() => {
    fetchAllAssets();
  }, []);

  const fetchAllAssets = async () => {
    setLoading(true);
    try {
      const [cameras, nvrs, biometrics, switches] = await Promise.all([
        api.get('/cameras/'),
        api.get('/cameras/nvrs/'),
        api.get('/cameras/biometrics/'),
        api.get('/cameras/switches/')
      ]);

      const formatted = [
        ...cameras.data.map(c => ({ ...c, uiType: 'CCTV', displayName: c.name || c.cameraId })),
        ...nvrs.data.map(n => ({ ...n, uiType: 'NVR', displayName: n.nvrName })),
        ...biometrics.data.map(b => ({ ...b, uiType: 'BIOMETRIC', displayName: b.name })),
        ...switches.data.map(s => ({ ...s, uiType: 'SWITCH', displayName: s.name }))
      ];

      setAllItems(formatted);
      
      // Extract locations for suggestions
      const cols = new Set();
      const blks = new Set();
      const flrs = new Set();
      const rms = new Set();
      formatted.forEach(item => {
        if (item.collegeName) cols.add(item.collegeName);
        if (item.block) blks.add(item.block);
        if (item.floor) flrs.add(item.floor);
        if (item.room) rms.add(item.room);
      });
      setLocations({
        colleges: Array.from(cols).sort(),
        blocks: Array.from(blks).sort(),
        floors: Array.from(flrs).sort(),
        rooms: Array.from(rms).sort()
      });

    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch assets for indexing.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allItems.filter(item => 
      item.displayName?.toLowerCase().includes(q) || 
      item.ipAddress?.toLowerCase().includes(q) || 
      item.serialNumber?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, allItems]);

  const selectItem = (item) => {
    setSelectedItem(item);
    setSearchQuery('');
    setFormData({
      id: item.id,
      type: item.uiType,
      name: item.displayName || '',
      ipAddress: item.ipAddress || '',
      serialNumber: item.serialNumber || item.cameraId || '',
      collegeName: item.collegeName || '',
      block: item.block || '',
      floor: item.floor || '',
      room: item.room || '',
      
      // CCTV
      deviceType: item.deviceType || 'Bullet',
      gateway: item.gateway || '',
      subnetMask: item.subnetMask || '',
      macAddress: item.macAddress || '',
      campusZone: item.campusZone || 'INSIDE',
      
      // NVR
      hardDisk: item.hardDisk || '',
      channel: item.channel || '',
      brand: item.brand || '',
      
      // Biometric
      bioType: item.type || 'Fingerprint',
      
      // Switch
      model: item.model || '',
      portCount: item.portCount || ''
    });
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let endpoint = '';
      let payload = {};
      const locationString = `${formData.collegeName} | ${formData.block} | ${formData.floor} | ${formData.room || 'N/A'}`;

      if (formData.type === 'CCTV') {
        endpoint = `/cameras/${formData.id}/`;
        payload = {
          ...formData,
          siteName: locationString
        };
      } else if (formData.type === 'NVR') {
        endpoint = `/cameras/nvrs/${formData.id}/`;
        payload = {
          ...formData,
          location: locationString,
          nvrName: formData.name
        };
      } else if (formData.type === 'BIOMETRIC') {
        endpoint = `/cameras/biometrics/${formData.id}/`;
        payload = {
          ...formData,
          location: locationString,
          type: formData.bioType
        };
      } else if (formData.type === 'SWITCH') {
        endpoint = `/cameras/switches/${formData.id}/`;
        payload = {
          ...formData,
          location: locationString
        };
      }

      await api.put(endpoint, payload);
      showNotification('Asset updated successfully', 'success');
      fetchAllAssets(); // Refresh local index
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
      showNotification('Failed to update asset.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </div>
            <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-white">
              Unified <span className="text-gradient-purple">Asset Editor</span>
            </h1>
          </div>
          <p className="text-xs text-dim font-bold uppercase tracking-[0.2em]">Locate and modify hardware parameters</p>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative group max-w-2xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000"></div>
        <div className="relative glass-panel p-2 flex items-center bg-[#0a0c10]/80">
          <Search className="ml-4 text-dim" size={20} />
          <input 
            type="text" 
            placeholder="Search by IP, Serial, or Device Name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white px-4 py-4 flex-1 text-lg placeholder:text-dim"
          />
          {loading && <div className="mr-4 w-5 h-5 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin"></div>}
        </div>

        {/* Results Dropdown */}
        {filteredResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-3 glass-panel border-white/20 overflow-hidden z-[100] shadow-2xl animate-scale-up">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10">
              <span className="text-[10px] font-black text-dim uppercase tracking-widest">Found {filteredResults.length} Matching Nodes</span>
            </div>
            {filteredResults.map(item => (
              <button 
                key={`${item.uiType}-${item.id}`}
                onClick={() => selectItem(item)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    item.uiType === 'CCTV' ? 'bg-blue-500/10 text-blue-400' :
                    item.uiType === 'NVR' ? 'bg-indigo-500/10 text-indigo-400' :
                    item.uiType === 'BIOMETRIC' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {item.uiType === 'CCTV' && <Cctv size={18} />}
                    {item.uiType === 'NVR' && <HardDrive size={18} />}
                    {item.uiType === 'BIOMETRIC' && <Fingerprint size={18} />}
                    {item.uiType === 'SWITCH' && <Network size={18} />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{item.displayName}</p>
                    <p className="text-[10px] text-dim font-mono">{item.ipAddress} • {item.serialNumber || item.cameraId}</p>
                  </div>
                </div>
                <ChevronDown size={16} className="text-dim -rotate-90 group-hover:translate-x-1 transition-transform" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Form Section */}
      {selectedItem ? (
        <form onSubmit={handleUpdate} className="space-y-10 animate-slide-up">
          <div className="glass-panel p-8 bg-white/[0.02] border-white/10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 flex items-center space-x-2">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">{formData.type} NODE</span>
                <button type="button" onClick={() => setSelectedItem(null)} className="p-2 text-dim hover:text-white hover:bg-white/10 rounded-full transition-all"><X size={16} /></button>
             </div>

             <div className="flex items-center space-x-3 text-indigo-400 mb-8 border-b border-white/10 pb-4">
              <Edit2 size={20} />
              <h3 className="text-sm font-black uppercase tracking-widest">Modify Device Configuration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Common Location Fields */}
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">College</label>
                <input list="cols" name="collegeName" value={formData.collegeName} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                <datalist id="cols">{locations.colleges.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Block</label>
                <input list="blks" name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                <datalist id="blks">{locations.blocks.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Floor</label>
                <input list="flrs" name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                <datalist id="flrs">{locations.floors.map(f => <option key={f} value={f} />)}</datalist>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Room</label>
                <input list="rms" name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                <datalist id="rms">{locations.rooms.map(r => <option key={r} value={r} />)}</datalist>
              </div>

              {/* Common Hardware Fields */}
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Display Name</label>
                <input name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">IP Address</label>
                <input name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono text-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Serial Number</label>
                <input name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono" readOnly />
              </div>

              {/* Type Specific Fields */}
              {formData.type === 'CCTV' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Camera Type</label>
                    <select name="deviceType" value={formData.deviceType} onChange={handleInputChange} className="glass-input w-full p-4 text-sm">
                      <option value="Bullet">Bullet</option>
                      <option value="Dome">Dome</option>
                      <option value="PTZ">PTZ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Gateway</label>
                    <input name="gateway" value={formData.gateway} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">MAC Address</label>
                    <input name="macAddress" value={formData.macAddress} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-mono" />
                  </div>
                </>
              )}

              {formData.type === 'NVR' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Storage (TB)</label>
                    <input name="hardDisk" value={formData.hardDisk} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Channels</label>
                    <input name="channel" value={formData.channel} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                  </div>
                </>
              )}

              {formData.type === 'BIOMETRIC' && (
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Device Type</label>
                  <select name="bioType" value={formData.bioType} onChange={handleInputChange} className="glass-input w-full p-4 text-sm">
                    <option value="Fingerprint">Fingerprint</option>
                    <option value="Face Recognition">Face Recognition</option>
                    <option value="RFID Card">RFID Card</option>
                  </select>
                </div>
              )}

              {formData.type === 'SWITCH' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Model</label>
                    <input name="model" value={formData.model} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Ports</label>
                    <input name="portCount" value={formData.portCount} onChange={handleInputChange} className="glass-input w-full p-4 text-sm" />
                  </div>
                </>
              )}
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex justify-end items-center space-x-6">
              <div className="flex items-center space-x-2 text-dim">
                <AlertCircle size={14} className="text-indigo-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Updates are logged for audit compliance</span>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="glass-button px-10 py-3 text-[11px] font-black uppercase tracking-widest flex items-center space-x-2"
              >
                {submitting ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Save size={16} />}
                <span>{submitting ? 'Applying...' : 'Commit Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in">
           <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
              <Monitor size={32} className="text-dim opacity-20" />
           </div>
           <div className="max-w-xs">
              <p className="text-sm font-bold text-dim uppercase tracking-widest">No Node Selected</p>
              <p className="text-xs text-secondary mt-1">Use the search bar above to locate an asset and begin editing its parameters.</p>
           </div>
        </div>
      )}
    </div>
  );
}
