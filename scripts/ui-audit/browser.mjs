/** Reuse one optional browser across isolated fixtures, with a cross-process lease. */
import { chromium } from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';

export async function acquireAuditBrowser() {
  const endpointFile = process.env.CAMS_AUDIT_BROWSER_FILE || '/tmp/cams-life/audit-browser.json';
  let endpoint;
  try { endpoint = JSON.parse(await readFile(endpointFile, 'utf8')).endpoint; } catch {}
  if (!endpoint) {
    const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
    return { browser, release: () => browser.close() };
  }
  const lock = endpointFile + '.lease';
  const deadline = Date.now() + 10 * 60 * 1000;
  while (true) {
    try { await mkdir(lock); await writeFile(lock + '/pid', String(process.pid)); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        // A new lease may not have finished writing its owner yet.
        if (Date.now() - (await stat(lock)).mtimeMs < 5000) {
          await new Promise(resolve => setTimeout(resolve, 150));
          continue;
        }
        const pid = Number(await readFile(lock + '/pid', 'utf8'));
        const status = await readFile('/proc/' + pid + '/stat', 'utf8');
        if (/\) Z /.test(status)) await rm(lock, { recursive: true, force: true });
      } catch (e) { if (e.code === 'ENOENT') await rm(lock, { recursive: true, force: true }); }
      if (Date.now() > deadline) throw new Error('Shared audit browser lease timed out.');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
  try {
    const browser = await chromium.connect(endpoint, { timeout: 20000 });
    return { browser, async release() { try { await browser.close(); } finally { await rm(lock, { recursive: true, force: true }); } } };
  } catch (error) { await rm(lock, { recursive: true, force: true }); throw error; }
}
