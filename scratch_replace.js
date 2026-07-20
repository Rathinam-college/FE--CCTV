const fs = require('fs');
const file = 'd:/Rathinam college/Website/CODE MAIN/CODE MAIN/FE--CCTV/src/pages/Tickets.jsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '{/* Section 2: Logistical Metadata */}';
const endMarker = '{/* Section 3: Personnel & Execution */}';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    let section2 = content.substring(startIdx, endIdx);
    
    // We will extract the image and video rendering code exactly to not break anything.
    const imgStart = section2.indexOf('{formData.createdImage && typeof formData.createdImage === \\'string\\' ? (');
    const imgEnd = section2.indexOf('</label>\\n                          </div>\\n                        )}') + 73; // approx end of image block
    const imageBlock = section2.substring(imgStart, imgEnd);

    const vidStart = section2.indexOf('{formData.createdVideo && typeof formData.createdVideo === \\'string\\' ? (');
    const vidEnd = section2.indexOf('</label>\\n                          </div>\\n                        )}') + 73; // approx end of video block
    const videoBlock = section2.substring(vidStart, vidEnd);

    const newSection2 = `{/* Section 2: Logistical Metadata */}
              <div className="space-y-8 pt-4 pb-8">
                
                {/* Timeline & Status */}
                <div className="bg-panel p-6 rounded-3xl border border-main">
                  <div className="flex items-center space-x-3 mb-4">
                    <Clock size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Timeline & Status</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[9px] font-black text-white uppercase tracking-widest mb-2">Date Received</label>
                      <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-bold bg-[#0f172a] border-[#1e293b] rounded-2xl cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-white uppercase tracking-widest mb-2">Time Received / Logged</label>
                      <input type="time" name="receivedTime" value={formData.receivedTime} onChange={handleInputChange} className="glass-input w-full p-4 text-sm font-bold bg-[#0f172a] border-[#1e293b] rounded-2xl cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">End Time</label>
                      <input type="time" name="endTime" value={formData.endTime} onChange={handleInputChange} className="glass-input w-full p-4 text-sm bg-panel border-main cursor-pointer rounded-2xl" />
                    </div>
                  </div>
                </div>

                {/* Logistical Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Ticket Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="glass-input w-full p-3 text-xs cursor-pointer bg-panel border-main">
                      <option value="Issue">Issue</option>
                      <option value="Service">Service</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Installation">Installation</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Ticket Device</label>
                    <select name="ticketDevice" value={formData.ticketDevice} onChange={handleInputChange} className="glass-input w-full p-3 text-xs cursor-pointer bg-panel border-main">
                      <option value="">None</option>
                      <option value="Camera">Camera</option>
                      <option value="Biometrics">Biometrics</option>
                      <option value="Flap Barrier">Flap Barrier</option>
                    </select>
                  </div>
                  <div>
                     <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Instruction By</label>
                     <input type="text" name="instructionBy" value={formData.instructionBy} onChange={handleInputChange} className="glass-input w-full p-3 text-xs bg-panel border-main" placeholder="Name of authorize officer" />
                   </div>
                </div>

                {/* Media Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Initial Issue Image (Optional)</label>
                     \${imageBlock.trim()}
                   </div>
                   <div>
                     <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Initial Issue Video (Optional)</label>
                     \${videoBlock.trim()}
                   </div>
                </div>

                {/* Issue & Action */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Nature of Problem</label>
                    <textarea required name="issueDescription" value={formData.issueDescription} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[120px] resize-none bg-panel border-main" placeholder="Describe the technical failure..." />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-secondary uppercase tracking-widest mb-2">Action Taken</label>
                    <textarea name="actionTaken" value={formData.actionTaken} onChange={handleInputChange} className="glass-input w-full p-3 text-xs min-h-[120px] resize-none bg-panel border-main" placeholder="Repair steps..." />
                  </div>
                </div>

              </div>
              `;

    content = content.substring(0, startIdx) + newSection2 + content.substring(endIdx);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully replaced Section 2.");
} else {
    console.log("Could not find markers.");
}
