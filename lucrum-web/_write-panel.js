const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '_panel-template.txt'), 'utf8');
fs.writeFileSync(
  path.join(__dirname, 'src/components/discovery/strategy-detail-panel.tsx'),
  content,
  'utf8'
);
console.log('Written strategy-detail-panel.tsx (' + content.length + ' chars)');
