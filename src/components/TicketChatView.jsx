import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  MessageSquare, Send, Camera, Image as ImageIcon, Search, 
  ExternalLink, Eye, X, CheckCircle, Activity, AlertCircle, 
  Clock, MapPin, Tag, User as UserIcon, Filter, Layers, 
  Download, Sparkles, RefreshCw, ChevronRight, FileText, Printer,
  FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import pptxgen from 'pptxgenjs';
import api from '../services/api';
import { compressImage } from '../utils/imageCompression';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

const getImageUrl = (path) => {
  if (!path) return '';
  try {
    const url = new URL(path);
    path = url.pathname;
  } catch (e) {
  }
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  if (cleanPath.startsWith('cctv/')) {
    cleanPath = cleanPath.substring(5);
  }
  if (!cleanPath.startsWith('media/') && !cleanPath.startsWith('api/')) {
    cleanPath = 'media/' + cleanPath;
  }
  const baseUrl = import.meta.env.BASE_URL || '/cctv/';
  return `${baseUrl}${cleanPath}`;
};

const getAbsoluteImageUrl = (path) => {
  if (!path) return '';
  const rel = getImageUrl(path);
  if (rel.startsWith('http')) return rel;
  return window.location.origin + rel;
};

const cleanRemarkText = (text) => {
  if (!text) return '';
  return text.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/, '');
};

export const extractTicketImages = (t) => {
  if (!t) return [];
  const list = [];
  const addImg = (src, label, stage, meta = {}) => {
    if (!src) return;
    const path = typeof src === 'string' ? src : (src.image || src.file || src.url);
    if (path && !list.some(item => item.path === path)) {
      list.push({ path, label, stage, ...meta });
    }
  };

  if (t.createdImage) {
    addImg(t.createdImage, 'Initial / Logged Photo', 'Logged', {
      date: t.receivedDate || t.createdDate || (t.createdAt ? String(t.createdAt).split('T')[0] : '')
    });
  }

  if (t.inProgressImage || t.workImage) {
    addImg(t.inProgressImage || t.workImage, 'In Progress / On-Site Photo', 'In Progress', {
      date: t.inProgressDate
    });
  }

  if (Array.isArray(t.completed_images)) {
    t.completed_images.forEach((img, i) => addImg(img, `Completed Photo ${i + 1}`, 'Completed', { date: t.completedDate }));
  }
  if (Array.isArray(t.completedImages)) {
    t.completedImages.forEach((img, i) => addImg(img, `Completed Photo ${i + 1}`, 'Completed', { date: t.completedDate }));
  }
  if (t.completedImage) {
    addImg(t.completedImage, 'Completed Photo', 'Completed', { date: t.completedDate });
  }
  if (t.serviceImage) {
    addImg(t.serviceImage, 'Service Photo', 'Completed', { date: t.completedDate });
  }

  if (Array.isArray(t.message_history)) {
    t.message_history.forEach((m) => {
      if (m.image) {
        addImg(m.image, 'Chat Attached Photo', 'Chat Message', {
          author: m.user_name || 'Staff',
          time: m.time,
          date: m.date,
          remark: cleanRemarkText(m.remark)
        });
      }
    });
  }

  return list;
};

// ==========================================
// PDF GENERATION (Activity & Chat + Ticket # + Issue)
// ==========================================
export const generateTicketChatPDF = (ticketList) => {
  const ticketsToPrint = Array.isArray(ticketList) ? ticketList : [ticketList];
  if (ticketsToPrint.length === 0 || !ticketsToPrint[0]) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Ticket Activity & Chat Report</title>
        <meta charset="utf-8">
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
          body { background: #ffffff; color: #0f172a; padding: 15px; }
          .header-main { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          .header-title { font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .header-title span { color: #0284c7; }
          .header-sub { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 3px; }
          
          .ticket-card { border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 25px; background: #ffffff; page-break-inside: avoid; }
          .ticket-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 8px; }
          .ticket-number { font-size: 18px; font-weight: 900; color: #0284c7; font-family: monospace; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #fff; }
          .badge-completed { background: #10b981; }
          .badge-progress { background: #f59e0b; }
          .badge-open { background: #ef4444; }

          .meta-row { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta-val { font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 2px; }

          .issue-box { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; }
          .issue-label { font-size: 9px; font-weight: 900; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .issue-desc { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.45; font-style: italic; }

          .chat-section-title { font-size: 11px; font-weight: 900; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
          .chat-feed { display: flex; flex-direction: column; gap: 10px; }
          .chat-bubble { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #fafafa; }
          .chat-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
          .chat-user { font-size: 11px; font-weight: 800; color: #0284c7; }
          .chat-status { font-size: 8px; font-weight: 800; text-transform: uppercase; background: #e2e8f0; color: #334155; padding: 1.5px 6px; border-radius: 4px; margin-left: 6px; }
          .chat-time { font-size: 9px; color: #64748b; font-family: monospace; }
          .chat-text { font-size: 11px; color: #1e293b; line-height: 1.45; white-space: pre-wrap; font-weight: 500; }
          .chat-attachment { margin-top: 8px; max-width: 240px; max-height: 160px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; display: block; }

          .footer { margin-top: 25px; text-align: center; font-size: 8px; font-weight: 700; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; text-transform: uppercase; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-main">
          <div>
            <div class="header-title">CCTV Security • <span>Activity & Chat Report</span></div>
            <div class="header-sub">Tickets, Issues & Communication Timeline</div>
          </div>
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-align: right;">
            <div>Generated: ${new Date().toLocaleDateString()}</div>
            <div>${new Date().toLocaleTimeString()}</div>
          </div>
        </div>

        ${ticketsToPrint.map(ticket => {
          const tId = ticket.id || ticket._id;
          const msgs = (ticket.message_history || []).slice().reverse();
          const badgeClass = ticket.status === 'Completed' ? 'badge-completed' : (ticket.status === 'In Progress' ? 'badge-progress' : 'badge-open');

          return `
            <div class="ticket-card">
              <div class="ticket-header">
                <div class="ticket-number">${ticket.category || 'TICKET'} ACTIVITY REPORT</div>
                <div class="badge ${badgeClass}">${ticket.status || 'OPEN'}</div>
              </div>

              <div class="meta-row">
                <div class="meta-item">
                  <span class="meta-label">Division</span>
                  <span class="meta-val">${ticket.divisionName || 'N/A'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Location / Block</span>
                  <span class="meta-val">${ticket.location || ticket.block || 'N/A'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Category</span>
                  <span class="meta-val">${ticket.category || 'Issue'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Logged Date</span>
                  <span class="meta-val">${ticket.operationDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A')}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Messages</span>
                  <span class="meta-val">${msgs.length} Updates</span>
                </div>
              </div>

              <div class="issue-box">
                <div class="issue-label">Reported Issue Description</div>
                <div class="issue-desc">"${ticket.issueDescription || 'No description provided'}"</div>
              </div>

              <div class="chat-section-title">
                <span>Activity & Chat (${msgs.length} Messages)</span>
              </div>

              <div class="chat-feed">
                ${msgs.length === 0 ? `
                  <div style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 6px 0;">
                    No chat updates or remarks logged for this ticket.
                  </div>
                ` : msgs.map(m => `
                  <div class="chat-bubble">
                    <div class="chat-top">
                      <div>
                        <span class="chat-user">${m.user_name || 'Protocol System'}</span>
                        ${m.device_status ? `<span class="chat-status">${m.device_status}</span>` : ''}
                      </div>
                      <span class="chat-time">${m.date ? `${m.date} ` : ''}${m.time || ''}</span>
                    </div>
                    <div class="chat-text">${cleanRemarkText(m.remark)}</div>
                    ${m.image ? `<img class="chat-attachment" src="${getImageUrl(m.image)}" alt="Evidence" onerror="this.style.display='none'" />` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <div class="footer">
          GENERATED FROM CCTV MANAGEMENT SYSTEM • PRINTED ON ${new Date().toLocaleDateString()} AT ${new Date().toLocaleTimeString()}
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
};

// ==========================================
// PPT GENERATION (Activity & Chat + Ticket # + Issue)
// ==========================================
export const generateTicketChatPPT = async (ticketList) => {
  const ticketsToExport = Array.isArray(ticketList) ? ticketList : [ticketList];
  if (ticketsToExport.length === 0 || !ticketsToExport[0]) return;

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  for (const ticket of ticketsToExport) {
    const tId = ticket.id || ticket._id;
    const msgs = (ticket.message_history || []).slice().reverse(); // Chronological
    const isCompleted = ticket.status === 'Completed';
    const statusColor = isCompleted ? '10B981' : (ticket.status === 'In Progress' ? 'F59E0B' : 'EF4444');

    const chunkSize = 3;
    const totalSlides = Math.max(1, Math.ceil(msgs.length / chunkSize));

    for (let sIdx = 0; sIdx < totalSlides; sIdx++) {
      const slide = pptx.addSlide();
      slide.background = { color: '0F172A' };

      // Outer container
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.4,
        y: 0.4,
        w: 12.53,
        h: 6.7,
        line: { color: '334155', width: 1.5 },
        fill: { color: '1E293B' }
      });

      // Ticket Header
      slide.addText(`${(ticket.category || 'TICKET').toUpperCase()} ACTIVITY REPORT`, {
        x: 0.7,
        y: 0.6,
        w: 3.8,
        h: 0.4,
        fontSize: 22,
        fontFace: 'Arial',
        bold: true,
        color: '22D3EE'
      });

      // Status Badge
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 4.6,
        y: 0.62,
        w: 1.6,
        h: 0.35,
        rectRadius: 0.1,
        fill: { color: statusColor },
        line: { color: statusColor }
      });
      slide.addText((ticket.status || 'OPEN').toUpperCase(), {
        x: 4.6,
        y: 0.62,
        w: 1.6,
        h: 0.35,
        fontSize: 10,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        valign: 'middle'
      });

      // Location & Division
      slide.addText(`${ticket.divisionName || 'N/A'} • ${ticket.location || ticket.block || 'Site'}`, {
        x: 6.4,
        y: 0.65,
        w: 6.2,
        h: 0.3,
        fontSize: 10,
        bold: true,
        color: '94A3B8',
        align: 'right'
      });

      // Reported Issue Description Box
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.15,
        w: 11.93,
        h: 0.75,
        rectRadius: 0.08,
        fill: { color: '0B1329' },
        line: { color: '334155', width: 1 }
      });
      slide.addText('REPORTED ISSUE DESCRIPTION:', {
        x: 0.85,
        y: 1.2,
        w: 11.6,
        h: 0.2,
        fontSize: 8,
        bold: true,
        color: '38BDF8'
      });
      slide.addText(`"${ticket.issueDescription || 'No description provided'}"`, {
        x: 0.85,
        y: 1.42,
        w: 11.6,
        h: 0.42,
        fontSize: 11,
        color: 'F1F5F9',
        italic: true,
        valign: 'top'
      });

      // Section title
      slide.addText(`ACTIVITY & CHAT (${msgs.length} MESSAGES) - PAGE ${sIdx + 1}/${totalSlides}`, {
        x: 0.7,
        y: 2.02,
        w: 11.93,
        h: 0.25,
        fontSize: 9,
        bold: true,
        color: 'A855F7'
      });

      // Messages in this slide
      const slideMsgs = msgs.slice(sIdx * chunkSize, (sIdx + 1) * chunkSize);
      if (slideMsgs.length === 0) {
        slide.addText('No chat messages recorded for this ticket.', {
          x: 0.7,
          y: 3.2,
          w: 11.93,
          h: 0.8,
          fontSize: 12,
          color: '64748B',
          align: 'center',
          valign: 'middle'
        });
      } else {
        let curY = 2.32;
        const cardH = 1.35;

        for (let mIdx = 0; mIdx < slideMsgs.length; mIdx++) {
          const msg = slideMsgs[mIdx];
          const hasImg = !!msg.image;
          const cardW = hasImg ? 9.8 : 11.93;

          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.7,
            y: curY,
            w: cardW,
            h: cardH,
            rectRadius: 0.08,
            fill: { color: '0F172A' },
            line: { color: '334155', width: 0.8 }
          });

          // User & Time
          const userName = msg.user_name || 'Protocol System';
          const timeString = `${msg.date ? msg.date + ' ' : ''}${msg.time || ''}`.trim();
          slide.addText(`${userName}  •  ${timeString}`, {
            x: 0.85,
            y: curY + 0.08,
            w: cardW - 0.3,
            h: 0.25,
            fontSize: 10,
            bold: true,
            color: '22D3EE'
          });

          if (msg.device_status) {
            slide.addText(`[${msg.device_status}]`, {
              x: 0.85,
              y: curY + 0.32,
              w: 3.0,
              h: 0.2,
              fontSize: 8,
              bold: true,
              color: '94A3B8'
            });
          }

          // Text
          const cleanText = cleanRemarkText(msg.remark);
          slide.addText(cleanText, {
            x: 0.85,
            y: curY + (msg.device_status ? 0.52 : 0.35),
            w: cardW - 0.3,
            h: 0.75,
            fontSize: 10,
            color: 'E2E8F0',
            valign: 'top'
          });

          // Attached Image
          if (hasImg) {
            const rawUrl = getImageUrl(msg.image);
            const fullImgUrl = rawUrl.startsWith('http') ? rawUrl : window.location.origin + rawUrl;
            try {
              slide.addImage({
                path: fullImgUrl,
                x: 10.7,
                y: curY,
                w: 1.93,
                h: cardH
              });
            } catch (e) {
              console.warn('Could not add image to PPT slide', e);
            }
          }

          curY += cardH + 0.12;
        }
      }

      // Footer
      slide.addText('GENERATED FROM CCTV MANAGEMENT SYSTEM • ACTIVITY & CHAT REPORT', {
        x: 0.7,
        y: 6.8,
        w: 11.93,
        h: 0.2,
        fontSize: 8,
        bold: true,
        color: '64748B',
        align: 'center'
      });
    }
  }

  const fileName = ticketsToExport.length === 1 
    ? `ticket_${ticketsToExport[0].id || ticketsToExport[0]._id}_activity_chat.pptx`
    : `tickets_activity_chat_report.pptx`;

  await pptx.writeFile({ fileName });
};

export default function TicketChatView({ 
  tickets = [], 
  onTicketUpdate,
  divisions = [],
  startMonth = '',
  endMonth = '',
  globalSearch = ''
}) {
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const navigate = useNavigate();

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'with_chat' | 'with_images' | 'Open' | 'In Progress' | 'Completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('chat'); // 'chat' | 'media'
  
  // Composer state
  const [newMessage, setNewMessage] = useState('');
  const [newImage, setNewImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [exportingPPT, setExportingPPT] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);

  // Overall Statistics across all tickets
  const stats = useMemo(() => {
    let totalMessages = 0;
    let totalImages = 0;
    let ticketsWithChat = 0;
    let ticketsWithImages = 0;
    let openActive = 0;

    tickets.forEach(t => {
      const msgs = t.message_history || [];
      if (msgs.length > 0) {
        ticketsWithChat++;
        totalMessages += msgs.length;
      }
      const imgs = extractTicketImages(t);
      if (imgs.length > 0) {
        ticketsWithImages++;
        totalImages += imgs.length;
      }
      if (t.status !== 'Completed' && (msgs.length > 0 || imgs.length > 0)) {
        openActive++;
      }
    });

    return {
      totalTickets: tickets.length,
      ticketsWithChat,
      totalMessages,
      ticketsWithImages,
      totalImages,
      openActive
    };
  }, [tickets]);

  // Filtered tickets for the chat master list
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      let meta = {};
      try {
        if (typeof ticket.remarks === 'string' && ticket.remarks.startsWith('{')) {
          meta = JSON.parse(ticket.remarks);
        } else if (typeof ticket.remarks === 'object' && ticket.remarks) {
          meta = ticket.remarks;
        }
      } catch (e) {}

      const ticketDate = ticket.operationDate || meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : '');

      // Month filter
      if (startMonth || endMonth) {
        if (!ticketDate) return false;
        const tMonth = String(ticketDate).substring(0, 7);
        const inRange = (!startMonth || tMonth >= startMonth) && (!endMonth || tMonth <= endMonth);
        const isOldUnresolved = startMonth && tMonth < startMonth && ticket.status !== 'Completed';
        if (!inRange && !isOldUnresolved) return false;
      }

      // Division filter
      if (selectedDivision && ticket.divisionName !== selectedDivision) {
        return false;
      }

      // Tab filter
      const msgs = ticket.message_history || [];
      const imgs = extractTicketImages(ticket);
      if (filterTab === 'with_chat' && msgs.length === 0) return false;
      if (filterTab === 'with_images' && imgs.length === 0) return false;
      if (['Open', 'In Progress', 'Completed'].includes(filterTab) && ticket.status !== filterTab) return false;

      // Search Query filter
      const q = (searchQuery || globalSearch).trim().toLowerCase();
      if (q) {
        const idStr = String(ticket.id || ticket._id || '');
        const desc = String(ticket.issueDescription || '').toLowerCase();
        const loc = String(ticket.location || meta.location || '').toLowerCase();
        const div = String(ticket.divisionName || '').toLowerCase();
        const blk = String(ticket.block || '').toLowerCase();
        const cat = String(ticket.category || meta.category || '').toLowerCase();
        const staff = (ticket.assignedStaff || []).map(s => s.name || s.username).join(' ').toLowerCase();
        const raised = String(ticket.raisedByName || (ticket.raisedBy?.name || ticket.raisedBy?.username || '')).toLowerCase();
        const msgText = msgs.map(m => `${m.user_name || ''} ${m.remark || ''}`).join(' ').toLowerCase();
        
        const matches = idStr.includes(q) || desc.includes(q) || loc.includes(q) || 
          div.includes(q) || blk.includes(q) || cat.includes(q) || 
          staff.includes(q) || raised.includes(q) || msgText.includes(q);

        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort priority: Newest message createdAt -> newest ticket date
      const getLatestTimestamp = (t) => {
        if (t.message_history && t.message_history.length > 0) {
          const first = t.message_history[0];
          if (first.createdAt) {
            const time = new Date(first.createdAt).getTime();
            if (!isNaN(time)) return time;
          }
        }
        let meta = {};
        try {
          if (typeof t.remarks === 'string' && t.remarks.startsWith('{')) meta = JSON.parse(t.remarks);
          else if (typeof t.remarks === 'object' && t.remarks) meta = t.remarks;
        } catch (e) {}
        const d = t.operationDate || meta.manualDate || t.receivedDate || (t.createdAt ? String(t.createdAt).split('T')[0] : '');
        return d ? new Date(d).getTime() || 0 : (t.id || 0);
      };

      return getLatestTimestamp(b) - getLatestTimestamp(a);
    });
  }, [tickets, startMonth, endMonth, selectedDivision, filterTab, searchQuery, globalSearch]);

  // Selected Ticket
  const activeTicket = useMemo(() => {
    if (selectedTicketId) {
      const found = tickets.find(t => String(t.id || t._id) === String(selectedTicketId));
      if (found) return found;
    }
    return filteredTickets.length > 0 ? filteredTickets[0] : null;
  }, [selectedTicketId, tickets, filteredTickets]);

  // All images for active ticket
  const activeTicketImages = useMemo(() => {
    return extractTicketImages(activeTicket);
  }, [activeTicket]);

  // Auto scroll chat to bottom when active ticket or messages change
  useEffect(() => {
    if (activeSubTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTicket?.id, activeTicket?.message_history?.length, activeSubTab]);

  // Handle Image File Selection
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 50);
      setNewImage(compressed);
      setImagePreview(URL.createObjectURL(compressed));
    } catch (err) {
      console.warn('Compression failed, using original file', err);
      setNewImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const removeSelectedImage = () => {
    setNewImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  // Handle Send Chat / Remark
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!activeTicket) return;
    if (!newMessage.trim() && !newImage) {
      showNotification('Please enter a message or select an image', 'error');
      return;
    }

    // Restriction check: completed tickets can only receive remarks from Super Admin
    if (activeTicket.status === 'Completed' && user?.role !== 'Super Admin') {
      showNotification('Cannot add messages to a completed ticket without Super Admin permission', 'error');
      return;
    }

    const ticketId = activeTicket.id || activeTicket._id;
    try {
      setSending(true);
      const formData = new FormData();
      formData.append('remark', newMessage.trim() || 'Attached Photo Update');
      if (newImage) {
        formData.append('image', newImage);
      }

      const res = await api.post(`/tickets/${ticketId}/add_remark/`, formData);

      // Notify parent component to update state
      if (onTicketUpdate) {
        onTicketUpdate(ticketId, res.data);
      }

      setNewMessage('');
      removeSelectedImage();
      showNotification('Message & image update posted successfully!', 'success');
    } catch (err) {
      console.error('Error posting chat message:', err);
      showNotification(err.response?.data?.message || 'Failed to post message update', 'error');
    } finally {
      setSending(false);
    }
  };

  // Export handlers
  const handleExportSelectedPDF = () => {
    if (!activeTicket) return;
    generateTicketChatPDF(activeTicket);
  };

  const handleExportSelectedPPT = async () => {
    if (!activeTicket) return;
    try {
      setExportingPPT(true);
      showNotification('Generating PPT, please wait...', 'info');
      await generateTicketChatPPT(activeTicket);
      showNotification('PPT downloaded successfully!', 'success');
    } catch (err) {
      console.error('Error generating PPT:', err);
      showNotification('Failed to generate PPT: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExportingPPT(false);
    }
  };

  const handleExportAllPDF = () => {
    if (filteredTickets.length === 0) {
      showNotification('No tickets to export', 'error');
      return;
    }
    generateTicketChatPDF(filteredTickets);
  };

  const handleExportAllPPT = async () => {
    if (filteredTickets.length === 0) {
      showNotification('No tickets to export', 'error');
      return;
    }
    try {
      setExportingPPT(true);
      showNotification(`Generating PPT for ${filteredTickets.length} tickets, please wait...`, 'info');
      await generateTicketChatPPT(filteredTickets);
      showNotification('PPT downloaded successfully!', 'success');
    } catch (err) {
      console.error('Error generating PPT:', err);
      showNotification('Failed to generate PPT: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExportingPPT(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto">
      
      {/* Top Stat Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-panel border border-main rounded-2xl p-5 relative overflow-hidden group shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Discussions</p>
              <h3 className="text-3xl font-black text-main mt-2 font-mono">{stats.ticketsWithChat}</h3>
              <p className="text-[10px] text-cyan-400 font-bold mt-1 uppercase">Of {stats.totalTickets} total tickets</p>
            </div>
            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
              <MessageSquare size={20} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" style={{ width: `${(stats.ticketsWithChat / (stats.totalTickets || 1)) * 100}%` }}></div>
        </div>

        <div className="bg-panel border border-main rounded-2xl p-5 relative overflow-hidden group shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Messages Logged</p>
              <h3 className="text-3xl font-black text-purple-400 mt-2 font-mono">{stats.totalMessages}</h3>
              <p className="text-[10px] text-purple-300 font-bold mt-1 uppercase">Remarks & chat updates</p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" style={{ width: '65%' }}></div>
        </div>

        <div className="bg-panel border border-main rounded-2xl p-5 relative overflow-hidden group shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidence Photos Uploaded</p>
              <h3 className="text-3xl font-black text-emerald-400 mt-2 font-mono">{stats.totalImages}</h3>
              <p className="text-[10px] text-emerald-300 font-bold mt-1 uppercase">Across {stats.ticketsWithImages} tickets</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Camera size={20} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" style={{ width: `${(stats.ticketsWithImages / (stats.totalTickets || 1)) * 100}%` }}></div>
        </div>

        <div className="bg-panel border border-main rounded-2xl p-5 relative overflow-hidden group shadow-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Active Stream</p>
              <h3 className="text-3xl font-black text-amber-400 mt-2 font-mono">{stats.openActive}</h3>
              <p className="text-[10px] text-amber-300 font-bold mt-1 uppercase">Tickets requiring attention</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Activity size={20} />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" style={{ width: '45%' }}></div>
        </div>
      </div>

      {/* Filter and Search Bar with Batch Export Actions */}
      <div className="bg-panel border border-main rounded-2xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-2 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
          {[
            { id: 'all', label: `All Tickets (${tickets.length})` },
            { id: 'with_chat', label: `💬 With Chat (${stats.ticketsWithChat})` },
            { id: 'with_images', label: `📸 With Photos (${stats.ticketsWithImages})` },
            { id: 'Open', label: `🔴 Open (${tickets.filter(t => t.status === 'Open').length})` },
            { id: 'In Progress', label: `🟠 In Progress (${tickets.filter(t => t.status === 'In Progress').length})` },
            { id: 'Completed', label: `🟢 Completed (${tickets.filter(t => t.status === 'Completed').length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                filterTab === tab.id
                  ? 'bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20 font-black'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat, issue, staff..."
              className="bg-slate-800/90 text-xs text-slate-200 border border-slate-700 rounded-xl pl-9 pr-3 py-2 outline-none focus:border-cyan-500 w-full"
            />
          </div>

          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="bg-slate-800/90 text-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none border border-slate-700 focus:border-cyan-500 cursor-pointer min-w-[130px]"
          >
            <option value="">All Divisions</option>
            {Array.isArray(divisions) && Array.from(new Set(divisions.map(d => d.name))).filter(Boolean).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Export All Filtered Chats */}
          <button
            onClick={handleExportAllPDF}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
            title="Download PDF Report for All Filtered Ticket Chats"
          >
            <Printer size={13} className="text-cyan-400" />
            <span className="hidden sm:inline">All Chats</span> PDF
          </button>

          <button
            onClick={handleExportAllPPT}
            disabled={exportingPPT}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-900/50 hover:bg-indigo-800/80 text-indigo-300 border border-indigo-700/50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
            title="Download PowerPoint Presentation for All Filtered Ticket Chats"
          >
            <Download size={13} className="text-indigo-400" />
            <span className="hidden sm:inline">All Chats</span> PPT
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left List & Right Active Room */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[720px]">
        
        {/* Left Panel: Ticket Feed / Selector */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
              <Layers size={14} className="text-cyan-400" />
              Ticket Conversations ({filteredTickets.length})
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">
              Click to Open Chat & Media
            </span>
          </div>

          <div className="bg-panel border border-main rounded-2xl overflow-hidden shadow-2xl flex-1 flex flex-col max-h-[750px]">
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {filteredTickets.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <MessageSquare size={36} className="mb-3 opacity-30 text-cyan-400" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">No Tickets Found</p>
                  <p className="text-[10px] text-slate-500 mt-1">Try changing your search query or filter tab.</p>
                </div>
              ) : (
                filteredTickets.map(ticket => {
                  const isSelected = activeTicket && String(activeTicket.id || activeTicket._id) === String(ticket.id || ticket._id);
                  const msgs = ticket.message_history || [];
                  const latestMsg = msgs.length > 0 ? msgs[0] : null;
                  const imgs = extractTicketImages(ticket);
                  
                  let meta = {};
                  try {
                    if (typeof ticket.remarks === 'string' && ticket.remarks.startsWith('{')) meta = JSON.parse(ticket.remarks);
                    else if (typeof ticket.remarks === 'object' && ticket.remarks) meta = ticket.remarks;
                  } catch (e) {}

                  const ticketDate = ticket.operationDate || meta.manualDate || (ticket.createdAt ? String(ticket.createdAt).split('T')[0] : 'N/A');

                  return (
                    <div
                      key={ticket.id || ticket._id}
                      onClick={() => {
                        setSelectedTicketId(ticket.id || ticket._id);
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                          : 'bg-card/60 hover:bg-card border-white/5 hover:border-white/20'
                      }`}
                    >
                      {/* Status indicator bar on left */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          ticket.status === 'Completed' ? 'bg-emerald-500' :
                          ticket.status === 'In Progress' ? 'bg-amber-500 animate-pulse' :
                          'bg-rose-500'
                        }`} 
                      />

                      <div className="flex items-start justify-between gap-2 mb-1.5 pl-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            {ticket.category || meta.category || 'Ticket'}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          ticket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                          ticket.status === 'In Progress' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                          'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>

                      {/* Location & Division */}
                      <div className="pl-2 flex items-center space-x-3 text-[10px] text-slate-400 font-bold mb-2">
                        <span className="text-cyan-400 truncate max-w-[140px]" title={ticket.divisionName}>
                          {ticket.divisionName || 'Division N/A'}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]" title={ticket.location || meta.location}>
                          {ticket.location || meta.location || 'Location N/A'}
                        </span>
                      </div>

                      {/* Issue snippet */}
                      <p className="pl-2 text-xs text-slate-300 line-clamp-1 font-medium mb-3 italic">
                        "{ticket.issueDescription || 'No description'}"
                      </p>

                      {/* Latest Message Preview */}
                      {latestMsg ? (
                        <div className="pl-2 pt-2 border-t border-white/5 flex items-start space-x-2 text-[10px] text-slate-400">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-[8px] font-black flex items-center justify-center text-white shrink-0 mt-0.5">
                            {(latestMsg.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-200 mr-1.5">{latestMsg.user_name || 'Staff'}:</span>
                            <span className="text-slate-400 truncate">{cleanRemarkText(latestMsg.remark)}</span>
                          </div>
                          {latestMsg.image && (
                            <span className="text-cyan-400 font-bold text-[9px] shrink-0 flex items-center gap-0.5">
                              <Camera size={10} /> 1
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="pl-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Logged on {ticketDate}</span>
                          <span className="text-[9px] font-bold text-slate-600">No chat yet</span>
                        </div>
                      )}

                      {/* Bottom Counts Badges */}
                      <div className="pl-2 mt-3 flex items-center justify-between text-[9px] font-black uppercase text-slate-500">
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center gap-1 text-slate-400">
                            <MessageSquare size={11} className={msgs.length > 0 ? 'text-cyan-400' : 'text-slate-600'} />
                            {msgs.length} {msgs.length === 1 ? 'Message' : 'Messages'}
                          </span>
                          <span className="flex items-center gap-1 text-slate-400">
                            <Camera size={11} className={imgs.length > 0 ? 'text-emerald-400' : 'text-slate-600'} />
                            {imgs.length} {imgs.length === 1 ? 'Photo' : 'Photos'}
                          </span>
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${isSelected ? 'text-cyan-400 translate-x-1' : 'text-slate-600'}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Detailed Interactive Chat & Evidence Room */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {activeTicket ? (
            <div className="bg-panel border border-main rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[750px]">
              
              {/* Room Header with Individual PDF & PPT Export */}
              <div className="p-5 border-b border-main bg-card/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="text-base font-black text-main">
                      Ticket Discussion
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      activeTicket.status === 'Completed' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' :
                      activeTicket.status === 'In Progress' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10 animate-pulse' :
                      'text-rose-400 border-rose-500/40 bg-rose-500/10'
                    }`}>
                      {activeTicket.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {activeTicket.category || 'CCTV'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold flex items-center gap-1">
                    <MapPin size={12} className="text-cyan-400" />
                    <span>{activeTicket.divisionName || 'N/A'}</span>
                    <span>•</span>
                    <span>{activeTicket.location || activeTicket.block || 'Main Site'}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  {/* PDF Download for this Ticket */}
                  <button
                    onClick={handleExportSelectedPDF}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                    title="Export Activity & Chat PDF"
                  >
                    <FileText size={13} />
                    <span>Chat PDF</span>
                  </button>

                  {/* PPT Download for this Ticket */}
                  <button
                    onClick={handleExportSelectedPPT}
                    disabled={exportingPPT}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
                    title="Export Activity & Chat PPT"
                  >
                    <Download size={13} />
                    <span>Chat PPT</span>
                  </button>

                  {/* Full Details link */}
                  <button
                    onClick={() => navigate(`/tickets/${activeTicket.id || activeTicket._id}`)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                    title="Open Full Ticket Details Page"
                  >
                    <span>Full Details</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>

              {/* Sub-Tabs: Activity Chat vs All Evidence Photos */}
              <div className="flex border-b border-main bg-slate-900/40 px-5 pt-3 space-x-6">
                <button
                  onClick={() => setActiveSubTab('chat')}
                  className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 flex items-center space-x-2 transition-all ${
                    activeSubTab === 'chat'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare size={14} />
                  <span>Activity & Chat ({activeTicket.message_history?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('media')}
                  className={`pb-3 text-xs font-black uppercase tracking-widest border-b-2 flex items-center space-x-2 transition-all ${
                    activeSubTab === 'media'
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Camera size={14} />
                  <span>Evidence Gallery ({activeTicketImages.length})</span>
                </button>
              </div>

              {/* Ticket Context Header Box */}
              <div className="p-4 bg-slate-900/60 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    Reported Issue Description:
                  </span>
                  <p className="text-xs text-slate-200 font-medium italic">
                    "{activeTicket.issueDescription || 'No description provided'}"
                  </p>
                </div>
                <div className="text-right shrink-0 flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase tracking-widest">Logged Date</span>
                    <span className="font-bold text-slate-300">{activeTicket.operationDate || (activeTicket.createdAt ? String(activeTicket.createdAt).split('T')[0] : 'N/A')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase tracking-widest">Received Time</span>
                    <span className="font-bold text-cyan-400">{activeTicket.receivedTime || '09:00'}</span>
                  </div>
                </div>
              </div>

              {/* TAB 1: Chat Stream & Interactive Timeline */}
              {activeSubTab === 'chat' && (
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  
                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar max-h-[460px]">
                    {(!activeTicket.message_history || activeTicket.message_history.length === 0) ? (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
                        <div className="p-4 rounded-full bg-slate-800/80 border border-slate-700 mb-3 text-cyan-400">
                          <MessageSquare size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Chat History Yet</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          Use the composer below to add notes, technician status updates, or upload evidence photos for this ticket.
                        </p>
                      </div>
                    ) : (
                      activeTicket.message_history.map((msg, index) => {
                        const isSystem = !msg.user_name || msg.user_name.toLowerCase().includes('system') || msg.user_name.toLowerCase().includes('protocol');
                        const hasImg = !!msg.image;
                        const initial = (msg.user_name || 'U').charAt(0).toUpperCase();

                        return (
                          <div key={msg.id || index} className="flex items-start space-x-3.5 group animate-fade-in">
                            {/* Avatar */}
                            <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-lg ${
                              isSystem 
                                ? 'bg-gradient-to-br from-purple-600 to-indigo-700' 
                                : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                            }`}>
                              {initial}
                            </div>

                            {/* Message Bubble Card */}
                            <div className="flex-1 bg-slate-900/80 border border-white/10 hover:border-cyan-500/30 rounded-2xl rounded-tl-none p-4.5 space-y-2 shadow-xl transition-all">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-black text-white">
                                    {msg.user_name || 'Protocol System'}
                                  </span>
                                  {msg.device_status && (
                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                      {msg.device_status}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {msg.time || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                                  {msg.date ? ` • ${msg.date}` : ''}
                                </span>
                              </div>

                              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                                {cleanRemarkText(msg.remark)}
                              </p>

                              {/* Attached Image inside Chat */}
                              {hasImg && (
                                <div className="pt-2">
                                  <div 
                                    onClick={() => setLightboxImage({
                                      src: getImageUrl(msg.image),
                                      title: `Photo by ${msg.user_name || 'Staff'}`,
                                      caption: cleanRemarkText(msg.remark)
                                    })}
                                    className="relative w-48 h-36 rounded-xl overflow-hidden border border-white/15 cursor-pointer group/img bg-black/40 shadow-lg"
                                  >
                                    <img
                                      src={getImageUrl(msg.image)}
                                      alt="Attachment"
                                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                      <div className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white">
                                        <Eye size={18} />
                                      </div>
                                    </div>
                                    <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-white text-[8px] font-black uppercase px-2 py-0.5 rounded border border-white/10 tracking-widest">
                                      Click to View
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Composer Footer */}
                  <div className="p-4 bg-card/80 border-t border-main">
                    <form onSubmit={handleSendMessage} className="space-y-3">
                      
                      {/* Image Preview if chosen */}
                      {imagePreview && (
                        <div className="relative inline-block border border-cyan-500/40 rounded-xl overflow-hidden bg-black/60 p-1">
                          <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={removeSelectedImage}
                            className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 transition-colors shadow-lg"
                            title="Remove attached photo"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center space-x-3">
                        {/* Text Input */}
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type an update or comment for this ticket..."
                            className="w-full bg-slate-900/90 text-xs text-slate-100 border border-slate-700 rounded-xl pl-4 pr-12 py-3 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-500"
                            disabled={sending}
                          />

                          {/* Image Attachment Trigger */}
                          <label 
                            htmlFor="chat-view-img-upload" 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 cursor-pointer p-1 transition-colors"
                            title="Attach Photo"
                          >
                            <Camera size={18} />
                            <input
                              id="chat-view-img-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageChange}
                              disabled={sending}
                            />
                          </label>
                        </div>

                        {/* Send Button */}
                        <button
                          type="submit"
                          disabled={sending || (!newMessage.trim() && !newImage)}
                          className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:hover:bg-cyan-500 flex items-center space-x-2 shadow-lg shadow-cyan-500/20"
                        >
                          {sending ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <>
                              <span>Send</span>
                              <Send size={14} />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 2: Multi-Stage Evidence Gallery */}
              {activeSubTab === 'media' && (
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar max-h-[580px]">
                  {activeTicketImages.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center">
                      <ImageIcon size={40} className="mb-3 opacity-30 text-emerald-400" />
                      <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Evidence Photos</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        No photos have been uploaded for this ticket yet (Logged, In Progress, Completed, or Chat attachments).
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {activeTicketImages.map((imgItem, idx) => {
                        const url = getImageUrl(imgItem.path);
                        const isCompleted = imgItem.stage === 'Completed';

                        return (
                          <div
                            key={idx}
                            onClick={() => setLightboxImage({
                              src: url,
                              title: `${imgItem.label}`,
                              caption: imgItem.remark ? `"${imgItem.remark}" - ${imgItem.author || 'Technician'}` : (imgItem.date ? `Date: ${imgItem.date}` : '')
                            })}
                            className={`group relative aspect-[4/3] rounded-2xl overflow-hidden border cursor-pointer bg-black/60 shadow-xl transition-all hover:scale-[1.02] ${
                              isCompleted ? 'border-emerald-500/40 hover:border-emerald-400' : 'border-white/10 hover:border-cyan-400'
                            }`}
                          >
                            <img
                              src={url}
                              alt={imgItem.label}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                e.currentTarget.src = '';
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-70 group-hover:opacity-90 transition-opacity"></div>
                            
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-3 bg-white/20 backdrop-blur-md rounded-full text-white shadow-xl">
                                <Eye size={20} />
                              </div>
                            </div>

                            <div className="absolute bottom-3 left-3 right-3 flex flex-col space-y-0.5">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border tracking-widest self-start ${
                                isCompleted ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40' :
                                imgItem.stage === 'In Progress' ? 'bg-amber-950/90 text-amber-300 border-amber-500/40' :
                                'bg-black/80 text-cyan-300 border-cyan-500/40'
                              }`}>
                                {imgItem.label}
                              </span>
                              {imgItem.date && (
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {imgItem.date} {imgItem.time ? `• ${imgItem.time}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-panel border border-main rounded-2xl p-12 h-full flex flex-col items-center justify-center text-center shadow-2xl">
              <MessageSquare size={48} className="text-slate-600 mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-300 uppercase tracking-wider">Select a Ticket Conversation</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md">
                Click any ticket on the left list to view its entire activity timeline, chat messages, and all uploaded evidence photos.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden p-3 flex flex-col items-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center px-4 py-2 border-b border-white/10 mb-2">
              <span className="text-xs font-black uppercase text-cyan-400 tracking-wider">
                {lightboxImage.title || 'Photo Evidence Lightbox'}
              </span>
              <div className="flex items-center space-x-2">
                <a
                  href={lightboxImage.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                  title="Open Original Photo in New Tab"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[72vh] flex items-center justify-center p-2">
              <img
                src={lightboxImage.src}
                alt="Preview"
                className="max-h-[68vh] w-auto object-contain rounded-xl border border-white/10 shadow-2xl"
              />
            </div>

            {lightboxImage.caption && (
              <p className="text-xs text-slate-300 px-4 py-2.5 text-center italic bg-black/50 w-full rounded-b-xl border-t border-white/5">
                {lightboxImage.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
