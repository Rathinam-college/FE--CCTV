import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ComboInput({ value, onChange, options, placeholder, name, required, strict = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredOptions = (options || []).filter(o => o && String(o).toLowerCase().includes((value || '').toLowerCase()));

  const handleBlur = () => {
    // If strict is true, reset value on blur if not matches
    if (strict && value && !(options || []).includes(value)) {
      onChange({ target: { name, value: '' } });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          required={required}
          type="text"
          name={name}
          value={value || ''}
          onChange={(e) => { onChange(e); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          className="glass-input w-full p-4 pr-10 text-xs bg-white/[0.03] border-white/10 focus:border-blue-500 transition-all font-bold text-white"
          placeholder={placeholder}
          autoComplete="off"
        />
        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-dim pointer-events-none" />
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-[#0f172a] border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] max-h-48 overflow-y-auto custom-scrollbar">
          {filteredOptions.map(opt => (
            <div
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevents input onBlur from firing before selection is registered
                onChange({ target: { name, value: opt } });
                setIsOpen(false);
              }}
              className="p-3 text-xs text-secondary font-bold hover:bg-blue-500/20 hover:text-white cursor-pointer border-b border-white/5 last:border-0 transition-colors"
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
