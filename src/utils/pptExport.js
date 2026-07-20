import pptxgen from 'pptxgenjs';

const loadImage = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const generateTicketCanvas = async (ticket, getImageUrl, titlePrefix = 'TICKET') => {
  const getAbsoluteUrl = (path) => {
    if (!path) return '';
    const rel = getImageUrl(path);
    if (rel.startsWith('http')) return rel;
    return window.location.origin + rel;
  };

  const openUrl = getAbsoluteUrl(ticket.createdImage || ticket.created_image);
  const inProgressUrl = getAbsoluteUrl(ticket.inProgressImage || ticket.in_progress_image);
  const completedUrl = getAbsoluteUrl(
    ticket.completedImage || (ticket.completed_images && ticket.completed_images[0]?.image)
  );

  const [openImg, inProgressImg, completedImg] = await Promise.all([
    loadImage(openUrl),
    loadImage(inProgressUrl),
    loadImage(completedUrl)
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 760);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 900, 760);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 880, 740);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`${titlePrefix.toUpperCase()} #${ticket.id || ticket._id}`, 40, 60);

  const isCompleted = ticket.status === 'Completed';
  const badgeColor = isCompleted ? '#10b981' : (ticket.status === 'In Progress' ? '#f97316' : '#ef4444');
  ctx.fillStyle = badgeColor;
  ctx.fillRect(40, 85, 120, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText((ticket.status || 'Open').toUpperCase(), 100, 105);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px Arial';
  ctx.fillText('CATEGORY', 40, 160);
  ctx.fillText('WORKED BY', 240, 160);
  ctx.fillText('LOGGED DATE', 40, 230);
  ctx.fillText('LOCATION', 40, 300);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 15px Arial';
  ctx.fillText(ticket.category || 'N/A', 40, 185);
  
  let workedByText = 'Unassigned';
  const staffList = [];
  
  if (ticket.assignedStaff && Array.isArray(ticket.assignedStaff) && ticket.assignedStaff.length > 0) {
    ticket.assignedStaff.forEach(s => {
      const name = typeof s === 'object' ? (s.name || s.username) : s;
      if (name && !staffList.includes(name)) staffList.push(name);
    });
  }
  
  if (ticket.assignedTo) {
    const name = typeof ticket.assignedTo === 'object' ? (ticket.assignedTo.name || ticket.assignedTo.username) : ticket.assignedTo;
    if (name && !staffList.includes(name)) {
      staffList.push(name);
    }
  }
  
  if (staffList.length > 0) {
    workedByText = staffList.join(', ');
  } else if (ticket.raisedByName) {
    workedByText = ticket.raisedByName;
  }

  // Set worked by font size dynamically to fit within 210px width
  let fontSize = 15;
  ctx.font = `bold ${fontSize}px Arial`;
  while (ctx.measureText(workedByText).width > 210 && fontSize > 9) {
    fontSize -= 1;
    ctx.font = `bold ${fontSize}px Arial`;
  }
  ctx.fillText(workedByText, 240, 185);
  
  ctx.fillText(ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : 'N/A', 40, 255);
  
  const locText = ticket.location || 'N/A';
  ctx.fillText(locText, 40, 325);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(460, 140, 400, 200);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('ISSUE DESCRIPTION', 480, 170);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'italic 13px Arial';
  
  const words = (ticket.issueDescription || 'No Description').split(' ');
  let line = '';
  let y = 195;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 360 && n > 0) {
      ctx.fillText(line, 480, y);
      line = words[n] + ' ';
      y += 20;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 480, y);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('EVIDENCE GALLERY', 40, 390);

  const imgWidth = 260;
  const imgHeight = 180;
  const imgY = 410;

  // Open Image
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, imgY, imgWidth, imgHeight);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(40, imgY, imgWidth, imgHeight);
  if (openImg) {
    ctx.drawImage(openImg, 40, imgY, imgWidth, imgHeight);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px Arial';
    ctx.fillText('Open Image Not Available', 80, imgY + 95);
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('OPEN IMAGE', 40, imgY + imgHeight + 20);

  // In Progress Image
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(320, imgY, imgWidth, imgHeight);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(320, imgY, imgWidth, imgHeight);
  if (inProgressImg) {
    ctx.drawImage(inProgressImg, 320, imgY, imgWidth, imgHeight);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px Arial';
    ctx.fillText('In Progress Image Not Available', 345, imgY + 95);
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('IN PROGRESS IMAGE', 320, imgY + imgHeight + 20);

  // Completed Image
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(600, imgY, imgWidth, imgHeight);
  ctx.strokeStyle = '#334155';
  ctx.strokeRect(600, imgY, imgWidth, imgHeight);
  if (completedImg) {
    ctx.drawImage(completedImg, 600, imgY, imgWidth, imgHeight);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 12px Arial';
    ctx.fillText('Completed Image Not Available', 635, imgY + 95);
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('COMPLETED IMAGE', 600, imgY + imgHeight + 20);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('GENERATED FROM CCTV SECURITY MANAGEMENT SYSTEM', 40, 710);

  return canvas;
};

export const exportMonthlyPPT = async (tickets, getImageUrl, monthName = 'Monthly', titlePrefix = 'Ticket') => {
  if (!tickets || tickets.length === 0) {
    throw new Error('No tickets available to generate PPT.');
  }

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  
  // Create a title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '0F172A' };
  titleSlide.addText(`${monthName} ${titlePrefix} Report`, {
    x: 0,
    y: 3,
    w: '100%',
    h: 1,
    align: 'center',
    fontSize: 44,
    color: 'FFFFFF',
    bold: true
  });
  titleSlide.addText(`${tickets.length} ${titlePrefix}s Processed`, {
    x: 0,
    y: 4,
    w: '100%',
    h: 1,
    align: 'center',
    fontSize: 24,
    color: '94A3B8'
  });

  // Create a slide for each ticket
  for (const ticket of tickets) {
    try {
      const canvas = await generateTicketCanvas(ticket, getImageUrl, titlePrefix);
      const imgDataUrl = canvas.toDataURL('image/png');

      const slide = pptx.addSlide();
      slide.background = { color: '0F172A' };
      
      slide.addImage({ 
        data: imgDataUrl, 
        x: 0, 
        y: 0, 
        w: 13.33,
        h: 7.5
      });
    } catch (err) {
      console.error(`Failed to generate slide for ticket ${ticket.id || ticket._id}:`, err);
    }
  }

  const sanitizedMonthName = monthName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  await pptx.writeFile({ fileName: `${sanitizedMonthName}_${titlePrefix.toLowerCase()}_report.pptx` });
};

export const exportProjectsPPT = async (projects, monthName = 'Monthly') => {
  if (!projects || projects.length === 0) {
    throw new Error('No projects available to generate PPT.');
  }

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  // Title Slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '0F172A' };
  titleSlide.addText(`${monthName} Projects Report`, {
    x: 0,
    y: 3,
    w: '100%',
    h: 1,
    align: 'center',
    fontSize: 44,
    color: 'FFFFFF',
    bold: true
  });
  titleSlide.addText(`${projects.length} Projects Tracked`, {
    x: 0,
    y: 4,
    w: '100%',
    h: 1,
    align: 'center',
    fontSize: 24,
    color: '94A3B8'
  });

  // Slide for each project
  for (const project of projects) {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };

    // Project header
    slide.addText(project.name.toUpperCase(), {
      x: 0.5,
      y: 0.6,
      w: 8.5,
      h: 0.8,
      fontSize: 28,
      color: 'FFFFFF',
      bold: true
    });

    // Status Badge
    const status = project.status || 'Active';
    const statusColor = status === 'Completed' ? '10B981' : (status === 'On Hold' ? 'F59E0B' : '3B82F6');
    slide.addText(status.toUpperCase(), {
      x: 9.5,
      y: 0.7,
      w: 3.3,
      h: 0.5,
      fontSize: 16,
      color: 'FFFFFF',
      bold: true,
      align: 'center',
      fill: { color: statusColor }
    });

    // Details Grid (Client, Dates, Ticket Count)
    slide.addText('CLIENT ENTITY', { x: 0.5, y: 1.8, w: 3.5, h: 0.3, fontSize: 12, color: '94A3B8', bold: true });
    slide.addText(project.client_name || 'N/A', { x: 0.5, y: 2.1, w: 3.5, h: 0.5, fontSize: 16, color: 'FFFFFF', bold: true });

    slide.addText('DATE RANGE', { x: 0.5, y: 3.0, w: 3.5, h: 0.3, fontSize: 12, color: '94A3B8', bold: true });
    slide.addText(`${project.start_date || 'N/A'} to ${project.end_date || 'Open Ended'}`, { x: 0.5, y: 3.3, w: 3.5, h: 0.5, fontSize: 14, color: 'FFFFFF', bold: true });

    slide.addText('TICKETS MAPPED', { x: 0.5, y: 4.2, w: 3.5, h: 0.3, fontSize: 12, color: '94A3B8', bold: true });
    slide.addText(String(project.ticket_count || 0), { x: 0.5, y: 4.5, w: 3.5, h: 0.5, fontSize: 24, color: '22D3EE', bold: true });

    // Scope / Description Card
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 4.5,
      y: 1.8,
      w: 8.3,
      h: 4.5,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 }
    });

    slide.addText('SCOPE & OPERATIONS DESCRIPTION', {
      x: 4.8,
      y: 2.1,
      w: 7.7,
      h: 0.4,
      fontSize: 12,
      color: '94A3B8',
      bold: true
    });

    slide.addText(project.description || 'No detailed scope of operations registered.', {
      x: 4.8,
      y: 2.6,
      w: 7.7,
      h: 3.4,
      fontSize: 14,
      color: 'F8FAFC',
      italic: true,
      align: 'left',
      valign: 'top'
    });

    // Footer
    slide.addText('GENERATED FROM CCTV MANAGEMENT SYSTEM', {
      x: 0.5,
      y: 6.8,
      w: 12.3,
      h: 0.3,
      fontSize: 10,
      color: '64748B',
      bold: true
    });
  }

  const sanitizedMonthName = monthName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  await pptx.writeFile({ fileName: `${sanitizedMonthName}_projects_report.pptx` });
};
