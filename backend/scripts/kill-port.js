#!/usr/bin/env node
// Libère le port 4000 (Windows) avant de démarrer le backend
const { execSync } = require('child_process');
const port = process.env.PORT || 4000;
try {
  if (process.platform === 'win32') {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = result.trim().split('\n').filter(Boolean);
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Port ${port} libéré (PID ${pid})`);
      } catch (_) {}
    }
  }
} catch (_) {
  // Port libre ou netstat n'a rien trouvé
}
