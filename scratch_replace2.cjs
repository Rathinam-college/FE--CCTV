const fs = require('fs');
const files = ['Tickets.jsx', 'Upgrades.jsx', 'Projects.jsx', 'Billing.jsx', 'UnifiedOnboarding.jsx', 'Dashboard.jsx', 'Reports.jsx'];
files.forEach(f => {
  const path = 'src/pages/' + f;
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/text-black dark:text-white/g, 'text-main');
  // Also replace any remaining text-white with text-main unless it's in a button with a hardcoded background color like bg-blue-500
  // Actually, replacing all text-white might be safer if we just use text-main for all of them
  content = content.replace(/\btext-white\b/g, 'text-main');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Updated ' + f);
});
