import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Cctv, HardDrive, Fingerprint, Network, 
  Building, MapPin, Tag, Cpu, ShieldCheck,
  Plus, Save, X, Trash2, Edit2, Upload, Search,
  ChevronDown, Monitor, CheckCircle, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';
import { useSiteStore } from '../store/siteStore';

export default function AssetRegistration() {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const navigate = useNavigate();
  const [assetType, setAssetType] = useState('CCTV');
  const [submitting, setSubmitting] = useState(false);
  const { currentSite, fetchSite, allLocations, fetchAllLocations } = useSiteStore();
  const [isAddingNewBrand, setIsAddingNewBrand] = useState(false);
  
  const [knownLocations, setKnownLocations] = useState([]);
  
  const [isAddingNewBlock, setIsAddingNewBlock] = useState(false);
  const [isAddingNewCollege, setIsAddingNewCollege] = useState(false);
  const [isAddingNewFloor, setIsAddingNewFloor] = useState(false);
  const [isAddingNewRoom, setIsAddingNewRoom] = useState(false);

  useEffect(() => {
    fetchExistingLocations();
    fetchAllLocations();
  }, []);

  const fetchExistingLocations = async () => {
    try {
      const res = await api.get('/cameras/');
      const locations = [];
      res.data.forEach(c => {
        if (c.divisionName || c.block || c.floor || c.room) {
          locations.push({
            divisionName: (c.divisionName || '').toUpperCase(),
            block: (c.block || '').toUpperCase(),
            floor: (c.floor || '').toUpperCase(),
            room: (c.room || '').toUpperCase()
          });
        }
        if (c.siteName) {
          const parts = c.siteName.split('|').map(p => p.trim().toUpperCase());
          locations.push({
            divisionName: parts[0] || '',
            block: parts[1] || '',
            floor: parts[2] || '',
            room: parts[3] || ''
          });
        }
      });
      setKnownLocations(locations);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    allLocations.forEach(loc => { if (loc.brand) brands.add(loc.brand); });
    // Common default brands
    ['HIKVISION', 'DAHUA', 'CP PLUS', 'UNV', 'HONEYWELL', 'ZKTECO', 'CISCO'].forEach(b => brands.add(b));
    return Array.from(brands).sort();
  }, [allLocations]);

  const [formData, setFormData] = useState({
    // Shared Fields
    divisionName: '',
    block: '',
    floor: '',
    room: '',
    location: '', // Used for NVR/Bio/Switch
    brand: '',
    ipAddress: '',
    serialNumber: '', // Hardware Serial
    
    // CCTV Specific
    name: '',
    deviceType: 'Bullet',
    cameraId: '', // Device ID
    gateway: '',
    subnetMask: '',
    macAddress: '',
    campusZone: 'INSIDE',

    // NVR Specific
    nvrName: '',
    hardDisk: '',
    channel: '',
    sNo: '',

    // Biometric Specific
    bioName: '',
    bioType: 'Fingerprint',

    // Switch Specific
    switchName: '',
    switchModel: '',
    switchName: '',
    switchModel: '',
    portCount: ''
  });

  // Load Global Site if available
  useEffect(() => {
    fetchSite();
  }, []);

  useEffect(() => {
    if (currentSite?.divisionName) {
      setFormData(prev => ({
        ...prev,
        divisionName: currentSite.divisionName,
        block: currentSite.block,
        floor: currentSite.floor,
        room: currentSite.room
      }));
    }
  }, [currentSite]);

  useEffect(() => {
    if (!submitting) {
      localStorage.setItem(`cctv_draft_assetregistration_${assetType}`, JSON.stringify(formData));
    }
  }, [formData, assetType, submitting]);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let newValue = value;
    if (type === 'text') {
      newValue = value.toUpperCase();
    }
    
    if (name === 'brand' && newValue === 'NEW') {
      setIsAddingNewBrand(true);
      setFormData(prev => ({ ...prev, brand: '' }));
      return;
    }

    setFormData(prev => {
      const nextData = { ...prev, [name]: newValue };
      
      if (name === 'divisionName') {
        nextData.block = '';
        nextData.floor = '';
        nextData.room = '';
      } else if (name === 'block') {
        nextData.floor = '';
        nextData.room = '';
      } else if (name === 'floor') {
        nextData.room = '';
      }
      
      // Auto-populate brand if location is found in Master Registry
      if (['divisionName', 'block', 'floor', 'room'].includes(name)) {
        const matchingLoc = allLocations.find(loc => 
          (loc.divisionName || '') === (name === 'divisionName' ? value : (prev.divisionName || '')) &&
          (loc.block || '') === (name === 'block' ? value : (prev.block || '')) &&
          (loc.floor || '') === (name === 'floor' ? value : (prev.floor || '')) &&
          (loc.room || '') === (name === 'room' ? value : (prev.room || ''))
        );
        if (matchingLoc && matchingLoc.brand) {
          nextData.brand = matchingLoc.brand;
          setIsAddingNewBrand(false);
        }
      }
      return nextData;
    });
  };

  const resetForm = () => {
    setFormData({
      divisionName: currentSite?.divisionName || '', 
      block: currentSite?.block || '', 
      floor: currentSite?.floor || '', 
      room: currentSite?.room || '', 
      location: '', brand: '', ipAddress: '', serialNumber: '',
      name: '', deviceType: 'Bullet', cameraId: '', gateway: '', subnetMask: '', macAddress: '', campusZone: 'INSIDE',
      nvrName: '', hardDisk: '', channel: '', sNo: '',
      bioName: '', bioType: 'Fingerprint',
      switchName: '', switchModel: '', portCount: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let endpoint = '';
      let payload = {};

      // Common mapping for location string
      const locationString = `${formData.divisionName} | ${formData.block} | ${formData.floor} | ${formData.room || 'N/A'}`;

      if (assetType === 'CCTV') {
        endpoint = '/cameras/';
        payload = {
          name: formData.name || `CAM-${formData.deviceType}`,
          siteName: locationString,
          ipAddress: formData.ipAddress,
          brand: formData.brand,
          deviceType: formData.deviceType,
          serialNumber: formData.serialNumber,
          cameraId: formData.cameraId || null,
          block: formData.block,
          floor: formData.floor,
          room: formData.room,
          divisionName: formData.divisionName,
          campusZone: formData.campusZone,
          gateway: formData.gateway,
          subnetMask: formData.subnetMask,
          macAddress: formData.macAddress
        };
      } else if (assetType === 'NVR') {
        endpoint = '/cameras/nvrs/';
        payload = {
          nvrName: formData.nvrName,
          location: locationString,
          ipAddress: formData.ipAddress,
          brand: formData.brand,
          hardDisk: formData.hardDisk,
          channel: formData.channel,
          serialNumber: formData.serialNumber,
          sNo: formData.sNo,
          block: formData.block,
          floor: formData.floor,
          room: formData.room,
          divisionName: formData.divisionName,
          campusZone: formData.campusZone
        };
      } else if (assetType === 'Biometric') {
        endpoint = '/cameras/biometrics/';
        payload = {
          name: formData.bioName,
          location: locationString,
          type: formData.bioType,
          brand: formData.brand,
          ipAddress: formData.ipAddress,
          serialNumber: formData.serialNumber,
          block: formData.block,
          floor: formData.floor,
          room: formData.room,
          divisionName: formData.divisionName,
          campusZone: formData.campusZone
        };
      } else if (assetType === 'Switch') {
        endpoint = '/cameras/switches/';
        payload = {
          name: formData.switchName,
          location: locationString,
          brand: formData.brand,
          model: formData.switchModel,
          portCount: formData.portCount,
          ipAddress: formData.ipAddress,
          serialNumber: formData.serialNumber,
          block: formData.block,
          floor: formData.floor,
          room: formData.room,
          divisionName: formData.divisionName,
          campusZone: formData.campusZone
        };
      }

      if (!payload.serialNumber || payload.serialNumber.trim() === '') {
        payload.serialNumber = null;
      }

      await api.post(endpoint, payload);
      showNotification(`${assetType} asset registered successfully`, 'success');
      try {
        localStorage.setItem(`cctv_last_assetregistration_${assetType}`, JSON.stringify(formData));
        localStorage.removeItem(`cctv_draft_assetregistration_${assetType}`);
      } catch (e) {
        console.error(e);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showNotification(`Failed to register ${assetType}. Please check all fields.`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const assetTypes = [
    { id: 'CCTV', name: 'Assets', icon: Cctv, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'NVR', name: 'Storage', icon: HardDrive, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { id: 'Biometric', name: 'Identity', icon: Fingerprint, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { id: 'Switch', name: 'Network', icon: Network, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6">
        <div>
          <h1 className="text-4xl font-black font-['Space_Grotesk'] tracking-tighter text-white">
            Universal <span className="text-gradient-cyan">Onboarding</span>
          </h1>
          <p className="text-[10px] text-dim font-black uppercase tracking-[0.2em] mt-1">Add new hardware assets</p>
        </div>
      </div>

      {/* Quick Setup for Locations */}
      <div className="glass-panel p-6 bg-white/[0.02] border-white/10">
        <div className="flex items-center space-x-3 text-cyan-400 mb-4">
          <MapPin size={18} />
          <h3 className="text-xs font-black uppercase tracking-widest">Location</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from(new Set([...knownLocations, ...allLocations].map(l => (l.block || '').toUpperCase()))).filter(Boolean).sort().slice(0, 10).map(block => (
            <div key={block} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-dim hover:text-white hover:border-cyan-500/30 transition-all cursor-default">
              {block}
            </div>
          ))}
          <button 
            onClick={() => setIsAddingNewBlock(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-cyan-500/20 transition-all"
          >
            + Register New Block
          </button>
        </div>
      </div>

      {/* Asset Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {assetTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => { setAssetType(type.id); resetForm(); }}
            className={`flex flex-col items-center justify-center p-6 rounded-3xl border transition-all duration-300 ${
              assetType === type.id 
                ? `${type.bg} border-white/20 shadow-xl scale-105` 
                : 'bg-white/5 border-white/5 hover:border-white/10 opacity-60 hover:opacity-100'
            }`}
          >
            <type.icon size={32} className={`${type.color} mb-3`} />
            <span className={`text-xs font-black uppercase tracking-widest ${assetType === type.id ? 'text-white' : 'text-dim'}`}>
              {type.name}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-8 space-y-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
          {assetTypes.find(t => t.id === assetType)?.icon && (
            (() => {
              const Icon = assetTypes.find(t => t.id === assetType).icon;
              return <Icon size={200} />;
            })()
          )}
        </div>

        {/* Draft & Reuse Controls */}
        <div className="flex items-center space-x-3 mb-6 relative z-10">
          {localStorage.getItem(`cctv_last_assetregistration_${assetType}`) && (
            <button
              type="button"
              onClick={() => {
                try {
                  const last = JSON.parse(localStorage.getItem(`cctv_last_assetregistration_${assetType}`));
                  setFormData(prev => ({
                    ...prev,
                    ...last,
                    serialNumber: '',
                    cameraId: ''
                  }));
                  showNotification('Last entry data loaded');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-md"
            >
              📋 Reuse Last Data
            </button>
          )}
          {localStorage.getItem(`cctv_draft_assetregistration_${assetType}`) && (
            <button
              type="button"
              onClick={() => {
                try {
                  const draft = JSON.parse(localStorage.getItem(`cctv_draft_assetregistration_${assetType}`));
                  setFormData(prev => ({ ...prev, ...draft }));
                  showNotification('Draft restored');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-md"
            >
              📂 Restore Draft
            </button>
          )}
        </div>

        {/* Location Section */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 text-blue-400 border-b border-white/10 pb-2">
            <Building size={18} />
            <h3 className="text-sm font-black uppercase tracking-widest">Asset Location Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2 flex justify-between">
                Division Name
                {!isAddingNewCollege && (
                  <button type="button" onClick={() => setIsAddingNewCollege(true)} className="text-cyan-400 hover:text-white transition-colors text-[9px] font-black underline">NEW DIVISION</button>
                )}
              </label>
              {isAddingNewCollege ? (
                <div className="relative">
                  <input required type="text" name="divisionName" value={formData.divisionName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-cyan-500/30" placeholder="Type new division name..." />
                  <button onClick={() => setIsAddingNewCollege(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <select required name="divisionName" value={formData.divisionName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                  <option value="">Select Existing Division</option>
                  {Array.from(new Set([...knownLocations, ...allLocations].map(l => (l.divisionName || '').toUpperCase()))).filter(Boolean).sort().map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2 flex justify-between">
                Block Name
                {!isAddingNewBlock && (
                  <button type="button" onClick={() => setIsAddingNewBlock(true)} className="text-cyan-400 hover:text-white transition-colors text-[9px] font-black underline">NEW BLOCK</button>
                )}
              </label>
              {isAddingNewBlock ? (
                <div className="relative">
                  <input required type="text" name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-cyan-500/30" placeholder="Type new block name..." />
                  <button onClick={() => setIsAddingNewBlock(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <select required name="block" value={formData.block} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                  <option value="">Select Existing Block</option>
                  {Array.from(new Set([...knownLocations, ...allLocations]
                    .filter(l => !formData.divisionName || (l.divisionName || '').toUpperCase() === formData.divisionName.toUpperCase())
                    .map(l => (l.block || '').toUpperCase())
                  )).filter(Boolean).sort().map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2 flex justify-between">
                Floor
                {!isAddingNewFloor && (
                  <button type="button" onClick={() => setIsAddingNewFloor(true)} className="text-cyan-400 hover:text-white transition-colors text-[9px] font-black underline">NEW FLOOR</button>
                )}
              </label>
              {isAddingNewFloor ? (
                <div className="relative">
                  <input required type="text" name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-cyan-500/30" placeholder="Type new floor..." />
                  <button onClick={() => setIsAddingNewFloor(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <select required name="floor" value={formData.floor} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                  <option value="">Select Existing Floor</option>
                  {Array.from(new Set([...knownLocations, ...allLocations]
                    .filter(l => (!formData.divisionName || (l.divisionName || '').toUpperCase() === formData.divisionName.toUpperCase()) && 
                                 (!formData.block || (l.block || '').toUpperCase() === formData.block.toUpperCase()))
                    .map(l => (l.floor || '').toUpperCase())
                  )).filter(Boolean).sort().map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2 flex justify-between">
                Room / Lab No
                {!isAddingNewRoom && (
                  <button type="button" onClick={() => setIsAddingNewRoom(true)} className="text-cyan-400 hover:text-white transition-colors text-[9px] font-black underline">NEW ROOM</button>
                )}
              </label>
              {isAddingNewRoom ? (
                <div className="relative">
                  <input type="text" name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-cyan-500/30" placeholder="Type new room..." />
                  <button onClick={() => setIsAddingNewRoom(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <select name="room" value={formData.room} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                  <option value="">Select Existing Room</option>
                  {Array.from(new Set([...knownLocations, ...allLocations]
                    .filter(l => (!formData.divisionName || (l.divisionName || '').toUpperCase() === formData.divisionName.toUpperCase()) && 
                                 (!formData.block || (l.block || '').toUpperCase() === formData.block.toUpperCase()) &&
                                 (!formData.floor || (l.floor || '').toUpperCase() === formData.floor.toUpperCase()))
                    .map(l => (l.room || '').toUpperCase())
                  )).filter(Boolean).sort().map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Asset Specific Section */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 text-emerald-400 border-b border-white/10 pb-2">
            <Tag size={18} />
            <h3 className="text-sm font-black uppercase tracking-widest">{assetType} Configuration</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assetType === 'CCTV' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Camera Name / Description</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. Front Gate Entry - Left" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Camera Type</label>
                  <select name="deviceType" value={formData.deviceType} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                    <option value="Bullet">Bullet Camera</option>
                    <option value="Dome">Dome Camera</option>
                    <option value="PTZ">PTZ Camera</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Campus Zone</label>
                  <select name="campusZone" value={formData.campusZone} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                    <option value="INSIDE">Inside Campus</option>
                    <option value="OUTSIDE">Outside Campus</option>
                  </select>
                </div>
              </>
            )}

            {assetType === 'NVR' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Storage Asset Name</label>
                  <input required type="text" name="nvrName" value={formData.nvrName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. Block A Server Room Storage" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Storage Capacity (TB)</label>
                  <input type="text" name="hardDisk" value={formData.hardDisk} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. 8TB / 12TB" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Channels</label>
                  <input type="text" name="channel" value={formData.channel} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. 16 CH / 32 CH" />
                </div>
              </>
            )}

            {assetType === 'Biometric' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Identity Asset Name</label>
                  <input required type="text" name="bioName" value={formData.bioName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. Staff Attendance - Admin Block" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Device Type</label>
                  <select name="bioType" value={formData.bioType} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                    <option value="Fingerprint">Fingerprint</option>
                    <option value="Face">Face</option>
                    <option value="Palm">Palm</option>
                    <option value="Card">Card</option>
                    <option value="Face + Fingerprint">Face + Fingerprint</option>
                    <option value="Face + Palm">Face + Palm</option>
                    <option value="Fingerprint + Palm">Fingerprint + Palm</option>
                    <option value="Card + Face">Card + Face</option>
                    <option value="Card + Fingerprint">Card + Fingerprint</option>
                    <option value="Card + Palm">Card + Palm</option>
                    <option value="Face + Fingerprint + Palm">Face + Fingerprint + Palm</option>
                    <option value="Card + Face + Fingerprint">Card + Face + Fingerprint</option>
                    <option value="Card + Face + Palm">Card + Face + Palm</option>
                    <option value="Card + Fingerprint + Palm">Card + Fingerprint + Palm</option>
                    <option value="Card + Face + Fingerprint + Palm">Card + Face + Fingerprint + Palm</option>
                  </select>
                </div>
              </>
            )}

            {assetType === 'Switch' && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Switch Display Name</label>
                  <input required type="text" name="switchName" value={formData.switchName} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. PoE Switch - Floor 2 Rack" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Model Number</label>
                  <input type="text" name="switchModel" value={formData.switchModel} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. TL-SG1008P" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Port Count</label>
                  <input type="text" name="portCount" value={formData.portCount} onChange={handleInputChange} className="glass-input w-full p-3 text-sm" placeholder="e.g. 8 Port / 16 Port" />
                </div>
              </>
            )}

            {/* Common Hardware Fields */}
            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Brand / Manufacturer</label>
              {isAddingNewBrand ? (
                <div className="relative">
                  <input required type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-3 text-sm border-cyan-500/30" placeholder="Type new brand..." />
                  <button type="button" onClick={() => setIsAddingNewBrand(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dim hover:text-white"><X size={14} /></button>
                </div>
              ) : (
                <select name="brand" value={formData.brand} onChange={handleInputChange} className="glass-input w-full p-3 text-sm cursor-pointer">
                  <option value="">Select Brand</option>
                  {uniqueBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="NEW">+ Add New Brand</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">Hardware Serial Number</label>
              <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono" placeholder="Manufacturer SN" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">IP Address</label>
              <input type="text" name="ipAddress" value={formData.ipAddress} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono text-blue-400" placeholder="192.168.1.xxx" />
            </div>
            {assetType === 'CCTV' && (
              <div>
                <label className="block text-[10px] font-bold text-dim uppercase tracking-widest mb-2">MAC Address</label>
                <input type="text" name="macAddress" value={formData.macAddress} onChange={handleInputChange} className="glass-input w-full p-3 text-sm font-mono" placeholder="00:00:00:00:00" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-white/10 flex justify-end space-x-4">
          <button 
            type="button" 
            onClick={resetForm}
            className="px-8 py-3 text-xs font-black uppercase tracking-widest text-dim hover:text-white transition-colors"
          >
            Clear Form
          </button>
          <button 
            type="submit" 
            disabled={submitting}
            className={`glass-button px-10 py-3 text-xs font-black uppercase tracking-widest shadow-2xl flex items-center ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Registering...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Confirm & Register Asset
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
