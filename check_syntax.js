const fs = require('fs');
try {
  const code = fs.readFileSync('d:\\Company Deatils\\Rathinam college\\Webite\\CCTV\\CODE MAIN\\FE--CCTV\\src\\pages\\Tickets.jsx', 'utf8');
  require('acorn').parse(code, { sourceType: 'module', ecmaVersion: 2022, plugins: { jsx: true } });
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax error:', e);
}
