/**
 * Libera portas do `npm run dev` antes do listen.
 * Windows + Unix. Só mata PIDs em estado LISTEN nas portas listadas.
 */
import { execSync } from 'node:child_process';

const PORTS = [
  Number(process.env.PORT || 3000),
  Number(process.env.VITE_HMR_PORT || 24678),
].filter((p) => Number.isFinite(p) && p > 0);

function unique(nums) {
  return [...new Set(nums)];
}

function pidsListeningWindows(port) {
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
    const pids = [];
    // Local address column ends with :PORT (evita 3000 casar 30001).
    const re = new RegExp(String.raw`^\s*TCP\s+\S+:${port}\s+\S+\s+LISTENING\s+(\d+)\s*$`, 'i');
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(re);
      if (!m) continue;
      const pid = Number(m[1]);
      if (Number.isFinite(pid) && pid > 0) pids.push(pid);
    }
    return unique(pids);
  } catch {
    return [];
  }
}

function pidsListeningUnix(port) {
  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return unique(
      out
        .split(/\s+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    console.log(`🔓 Porta livre — matou PID ${pid}`);
  } catch (err) {
    console.warn(
      `⚠️  Não matou PID ${pid}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

for (const port of PORTS) {
  const pids =
    process.platform === 'win32' ? pidsListeningWindows(port) : pidsListeningUnix(port);
  if (!pids.length) {
    console.log(`✅ :${port} já livre`);
    continue;
  }
  console.log(`🧹 :${port} ocupada por PID(s) ${pids.join(', ')}`);
  for (const pid of pids) killPid(pid);
}

if (process.platform === 'win32') {
  // Evita corrida TIME_WAIT → EADDRINUSE logo após taskkill.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
}
