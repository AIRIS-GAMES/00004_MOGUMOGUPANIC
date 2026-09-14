// Capacitor 8 emits Windows separators into Swift package path literals.
// Normalize only generated local package paths as part of the sync pipeline.
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../ios/App/CapApp-SPM/Package.swift');
if (fs.existsSync(file)) {
  const source = fs.readFileSync(file, 'utf8');
  const normalized = source.replace(/path: "([^"]+)"/g, (_, value) => `path: "${value.replace(/\\/g, '/')}"`);
  if (source !== normalized) fs.writeFileSync(file, normalized);
}
