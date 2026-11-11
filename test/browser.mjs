import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, '.test-artifacts');
mkdirSync(output, { recursive: true });
const profile = mkdtempSync(join(output, 'chromium-'));
const browser = process.env.BILLIARDS_BROWSER || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(existsSync);
if (!browser) throw new Error('Set BILLIARDS_BROWSER to a Chromium executable');
const previewPath = new URL('../tools/preview.html', import.meta.url);
const html = readFileSync(previewPath, 'utf8').replace('../lib/client.js', '/client.js');
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/client.js' ? 'application/javascript' : 'text/html; charset=utf-8');
  res.end(req.url === '/client.js' ? readFileSync(join(root, 'lib/client.js')) : html);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const hostUrl = process.env.BILLIARDS_HOST_URL;
if (hostUrl && !['127.0.0.1','localhost','[::1]'].includes(new URL(hostUrl).hostname)) throw new Error('Host smoke test requires a local isolated Harness');
const url = hostUrl || `http://127.0.0.1:${server.address().port}/`;
const child = spawn(browser, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
const exited = new Promise((resolve) => child.once('exit', resolve));
let ws;
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; !existsSync(portFile) && i < 100; i++) await delay(100);
  const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
  let page;
  for (let i = 0; i < 100; i++) {
    page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((p) => p.type === 'page' && p.url === 'about:blank');
    if (page) break;
    await delay(100);
  }
  assert.ok(page, 'preview tab created');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    const task = pending.get(msg.id);
    if (task) {
      clearTimeout(task.timer);
      pending.delete(msg.id);
      msg.error ? task.reject(new Error(JSON.stringify(msg.error))) : task.resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id;
    const timer = setTimeout(() => { pending.delete(request); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(request, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const handle = '(window.__BILLIARDS_PREVIEW_GAME__ || window.__DSH_BILLIARDS__?.game || document.querySelector(".dsh-bil-host")?.__dshBilliardsGame)';
  const game = (code) => evaluate(`(() => { const g = ${handle}; ${code} })()`);
  const press = async (key, code = key, extra = {}) => {
    const windowsVirtualKeyCode = ({ Escape: 27, ArrowRight: 39, ' ': 32 })[key] || key.toUpperCase().charCodeAt(0);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...extra });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, ...extra });
  };
  const viewport = (width, height, deviceScaleFactor = 1) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  const screenshot = async (name) => {
    // The real host animates its responsive sidebar across viewport changes.
    // Wait for its compositor to settle before capturing the final layout.
    await delay(400);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(output, name), Buffer.from(data, 'base64'));
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__DSH_BILLIARDS_DEBUG__=true;document.addEventListener('DOMContentLoaded',()=>document.documentElement.setAttribute('data-dsh-billiards-debug','true'),{once:true});`});
  await send('Page.navigate',{url});
  await viewport(1440, 900);
  for (let i = 0; i < 150 && !await evaluate(`!!${handle}`); i++) await delay(100);
  if(hostUrl) {
    if(!await evaluate(`!!${handle}`)) {
      await screenshot('host-startup-failure.png');
      throw new Error(JSON.stringify(await evaluate(`({title:document.title,text:document.body.innerText.slice(0,400),loader:!!window.__ModuleLoader__,scripts:Array.from(document.scripts).map(s=>s.src).filter(s=>s.includes('billiard'))})`)));
    }
    await delay(800);
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='继续')?.click();`);
    await delay(200);
    await press('Escape');
    await delay(200);
    await game('g.open();return true;');
  }
  await delay(700);
  assert.deepEqual(await game('return [g.isOpen, g.phase, g.raf, g.stage.inert, g.launcher.inert];'), [true, 'aiming', null, false, true]);
  await game('g.stage.focus();return true;');
  const beforeAngle = await game('return g.aimAngle;');
  await press('ArrowRight');
  await delay(50);
  assert.ok(await game(`return g.aimAngle > ${beforeAngle};`));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 900, y: 450, button: 'left', clickCount: 1 });
  await delay(150);
  if(hostUrl && !await game('return g.charging;')) {
    await screenshot('host-pointer-failure.png');
    console.log('Pointer target',await evaluate(`({top:document.elementFromPoint(900,450)?.outerHTML.slice(0,500),active:document.activeElement?.outerHTML.slice(0,200)})`));
  }
  assert.equal(await game('return g.charging;'), true);
  await press('Escape');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 900, y: 450, button: 'left', clickCount: 1 });
  assert.deepEqual(await game('return [g.isOpen, g.charging, g.phase];'), [true, false, 'aiming']);
  console.log('PASS idle frames, keyboard aim, pointer charge and Escape');

  await evaluate(`window.hostDialog = document.createElement('dialog'); hostDialog.innerHTML = '<input autofocus>'; document.body.append(hostDialog); hostDialog.showModal();`);
  await press('n', 'KeyN');
  await press('Escape');
  await delay(50);
  assert.deepEqual(await game('return [g.isOpen, window.hostDialog.open];'), [true, false]);
  await evaluate('hostDialog.remove();');
  await game('g.stage.focus(); g.setPassive(true); return true;');
  assert.deepEqual(await game('return [g.passive, g.stage.inert, g.launcher.inert, g.raf];'), [true, true, false, null]);
  await press('h', 'KeyH', { modifiers: 1 });
  assert.equal(await game('return g.passive;'), false);
  console.log('PASS host dialog keyboard and passive mode');

  await game('g.newGame(); g.shoot(g.aimAngle, 1); return true;');
  await delay(200);
  await game('g.setPassive(true); return true;');
  const paused = await game('return g.balls.map(b => [b.x,b.y]);');
  await delay(200);
  assert.deepEqual(await game('return g.balls.map(b => [b.x,b.y]);'), paused);
  await game('g.setPassive(false); return true;');
  await delay(200);
  assert.notDeepEqual(await game('return g.balls.map(b => [b.x,b.y]);'), paused);
  await game('g.newGame(); g.endGame(0, "eight"); return true;');
  assert.equal(await evaluate('document.activeElement.dataset.act'), 'new');
  await press(' ', 'Space');
  assert.deepEqual(await game('return [g.gameOver, g.phase, document.activeElement === g.stage];'), [false, 'aiming', true]);
  console.log('PASS physics pause/resume and keyboard result button');

  await game('g.newGame(); g.shoot(g.aimAngle, 0.6); return true;');
  await delay(100);
  await evaluate(`Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'));`);
  const hiddenBalls = await game('return g.balls.map(b => [b.x,b.y]);');
  await delay(150);
  assert.deepEqual(await game('return g.balls.map(b => [b.x,b.y]);'), hiddenBalls);
  assert.equal(await game('return g.raf;'), null);
  await evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
  await delay(150);
  assert.notDeepEqual(await game('return g.balls.map(b => [b.x,b.y]);'), hiddenBalls);
  await game('g.newGame(); g.current = 1; g.phase = "ai-aiming"; g.aiPlan = g.planAIShot(); return true;');
  await viewport(1000, 700);
  await delay(50);
  assert.equal(await game('return g.phase;'), 'ai-aiming');
  console.log('PASS visibility handler pause/resume; resize preserves AI plan in unchanged world');

  await game(`g.newGame(); g.current=1; g.switchTurn({foul:'测试',ballInHand:true}); g.stage.focus(); return true;`);
  await press('ArrowRight'); await press('Enter', 'Enter', {windowsVirtualKeyCode:13});
  assert.deepEqual(await game('return [g.ballInHand,g.phase,g.cueBall().active];'),[false,'aiming',true]);
  await game(`g.newGame(); const b=g.stage.querySelector('.dsh-bil-actions').getBoundingClientRect(); Object.assign(g.cueBall(),g.screenToWorld(b.x+b.width/2,b.y+b.height/2)); g.render(); return true;`);
  assert.equal(await game(`return getComputedStyle(g.stage.querySelector('.dsh-bil-actions')).opacity;`),'1');
  await game('g.newGame();g.shoot(g.aimAngle,0.7);g.requestNewGame();return true;');
  assert.equal(await game('return g.panelOpen;'),true);
  const confirmedPause=await game('return JSON.stringify(g.balls);');
  await delay(100);
  assert.equal(await game('return JSON.stringify(g.balls);'),confirmedPause);
  await press('Escape'); assert.equal(await game('return g.panelOpen;'),false);
  await game('g.newGame();g.showPanel("help");return true;');
  await press('Tab');
  assert.equal(await game('return g.panel.contains(document.activeElement);'),true);
  await evaluate(`const choice=document.querySelector('[data-pref="difficulty"]');choice.value='hard';choice.dispatchEvent(new Event('change'));`);
  assert.equal(await game('return g.prefs.difficulty;'),'hard');
  await press('Escape');
  await game('g.newGame();g.isBreak=false;g.shots=3;g.cueBall().x+=30;g.persistSession();return true;');
  const savedX=await game('return g.cueBall().x;');
  await evaluate('window.reloadMarker=true');
  await send('Page.reload');
  await delay(200);
  for(let i=0;i<100;i++) {
    if(await evaluate(`!window.reloadMarker && !!${handle}`)) break;
    await delay(50);
  }
  assert.equal(await game('return g.restored;'),true);
  if(hostUrl) {
    await delay(800);await press('Escape');await delay(200);
    await game('g.open();return true;');
  }
  assert.equal(await game('return g.cueBall().x;'),savedX);
  assert.equal(await game('return g.prefs.difficulty;'),'hard');
  await game('g.prefs.difficulty="standard";g.newGame();return true;');
  console.log('PASS keyboard placement, persistent exit, restart confirmation, settings and real page reload');

  const screenshots = [];
  for (const [width, height, dark] of [[1440, 900, true], [1440, 900, false], [1280, 800, true], [940, 700, true],
    [800, 600, true], [701, 640, false], [700, 640, true], [390, 844, false], [320, 640, true], [900, 400, true]]) {
    await viewport(width, height);
    await evaluate(`document.body.toggleAttribute('data-ds-dark-theme', ${dark});`);
    await game('g.resize(); g.newGame(); return true;');
    await game('clearTimeout(g.introTimer); g.refs.toast.classList.remove("is-show"); return true;');
    await delay(250);
    const theme = await game('return g.stage.dataset.bilTheme;');
    assert.equal(theme, dark ? 'dark' : 'light');
    const overlaps = await game(`
      const panels = [g.refs.turn, g.refs.human, g.refs.ai, g.stage.querySelector('.dsh-bil-actions'),
        g.spinPanel, g.stage.querySelector('.dsh-bil-bottom'), g.stage.querySelector('.dsh-bil-corner')];
      const boxes = panels.filter(el => getComputedStyle(el).display !== 'none').map(el => el.getBoundingClientRect());
      let count = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i+1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) count++;
      }
      return count;
    `);
    assert.equal(overlaps, 0, `${width}px HUD panels must not overlap`);
    const overflow = await game(`return Array.from(g.stage.querySelectorAll('.dsh-bil-player, .dsh-bil-actions, .dsh-bil-turn, .dsh-bil-spin-panel')).some(el => {
      const box = el.getBoundingClientRect();
      return box.left < 0 || box.right > innerWidth || box.top < 0 || box.bottom > innerHeight || el.scrollWidth > el.clientWidth + 1;
    });`);
    assert.equal(overflow, false, `${width}x${height}px HUD must fit`);
    const clickable = await game(`return Array.from(g.stage.querySelectorAll('.dsh-bil-actions button')).filter(el=>getComputedStyle(el).display!=='none').every(el=>{
      const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));
    });`);
    assert.equal(clickable,true,`${width}px visible toolbar buttons must receive actual pointer hits`);
    const name = `preview-${width}-${theme}.png`;
    await screenshot(name);
    screenshots.push(name);
  }
  await viewport(1440, 900);
  await game('g.prefs.clarity=0; g.applyPrefsToUI(); return true;');
  await game(`g.onAction('focus'); return true;`);
  assert.equal(await game('return g.refs.focus.dataset.label;'), '标准');
  await game(`g.onAction('focus'); return true;`);
  assert.equal(await game('return g.refs.focus.dataset.label;'), '专注');
  await game(`g.onAction('focus'); g.onAction('mute'); return true;`);
  assert.equal(await game('return g.refs.mute.getAttribute("aria-label");'), '取消静音');
  await game(`g.onAction('mute'); return true;`);
  assert.equal(await game('return g.refs.mute.getAttribute("aria-label");'), '静音');
  await game(`g.newGame(); const box=g.spinPanel.getBoundingClientRect(); Object.assign(g.cueBall(),g.screenToWorld(box.x+box.width/2,box.y+box.height/2)); g.stage.focus(); g.render(); return true;`);
  assert.equal(await game('return g.spinPanel.dataset.occluded;'), 'true');
  await game(`g.spinBall.focus(); return true;`);
  await delay(250);
  assert.equal(await game('return getComputedStyle(g.spinPanel).opacity;'), '1');
  await game(`g.stage.focus(); const box=g.stage.querySelector('.dsh-bil-bottom').getBoundingClientRect(); Object.assign(g.cueBall(),g.screenToWorld(box.x+box.width/2,box.y+box.height/2)); g.render(); return true;`);
  assert.equal(await game('return g.stage.querySelector(".dsh-bil-bottom").dataset.occluded;'), 'true');

  // Assigned groups and Windows titlebar offsets have different copy/geometry.
  for (const [width, height] of [[1440, 900], [940, 700], [701, 640], [700, 640], [390, 844], [320, 640]]) {
    await viewport(width, height);
    await evaluate(`document.documentElement.setAttribute('data-windows-titlebar', '');`);
    await game(`g.syncDesktopChrome(true); g.players[0].group='solid'; g.players[1].group='stripe'; g.updateHud(); return true;`);
    await delay(100);
    const fit = await game(`return [g.refs.human, g.refs.ai, g.stage.querySelector('.dsh-bil-actions')].every(el => {
      const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1;
    });`);
    assert.equal(fit, true, `${width}px assigned HUD with native titlebar must fit`);
    const overlaps = await game(`const items=[g.refs.turn,g.refs.human,g.refs.ai,g.stage.querySelector('.dsh-bil-actions')];
      const boxes=items.map(el=>el.getBoundingClientRect()); let count=0;
      for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
        const a=boxes[i], b=boxes[j]; if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top) count++;
      } return count;`);
    assert.equal(overlaps, 0, `${width}px native titlebar HUD panels must not overlap`);
  }
  await evaluate(`document.documentElement.removeAttribute('data-windows-titlebar');`);
  await game(`g.syncDesktopChrome(false); return true;`);
  for (const [width, height] of [[1440, 900], [390, 844], [900, 400]]) {
    await viewport(width, height);
    await evaluate(`document.body.removeAttribute('data-ds-dark-theme');`);
    await game(`g.newGame(); g.endGame(0, 'eight'); return true;`);
    await delay(500);
    assert.equal(await evaluate(`(() => { const el=document.querySelector('.dsh-bil-result-card'); const b=el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1; })()`), true);
    await screenshot(`result-${width}-light.png`);
  }
  await viewport(320, 640);
  await game(`g.resize(); g.newGame(); g.endGame(1,'eight-foul',['白球落袋']); return true;`);
  await delay(500);
  await screenshot('result-320-loss-light.png');
  await viewport(1440,900);
  await game('g.newGame();g.showPanel("help");return true;');
  await screenshot('help-desktop.png');
  await viewport(390,844);
  assert.equal(await game(`const b=g.panel.querySelector('.dsh-bil-panel-card').getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;`),true);
  await screenshot('help-mobile.png');
  await game('g.panel.querySelector(".dsh-bil-panel-card").scrollTop=500;return true;');
  assert.equal(await game(`const el=g.panel.querySelector('.dsh-bil-panel-dismiss'),b=el.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight&&el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));`),true);
  await game('g.hidePanel();g.newGame();return true;');
  await viewport(1440,900);
  const frameTiming=await game(`return new Promise(resolve=>{
    const times=[];let last=0,start=0;
    const frame=t=>{if(!start)start=t;if(last)times.push(t-last);last=t;
      if(t-start<1500)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({frames:times.length,p50:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]});}};
    g.shoot(g.aimAngle,1);requestAnimationFrame(frame);
  });`);
  await game('g.newGame();return true;');
  await send('Performance.enable');
  await send('HeapProfiler.collectGarbage');
  const heapBefore=(await send('Performance.getMetrics')).metrics.find(m=>m.name==='JSHeapUsedSize').value;
  await game(`for(let i=0;i<10;i++){const host=g.host,Type=g.constructor;const old=window.__BILLIARDS_PREVIEW_GAME__||window.__DSH_BILLIARDS__?.game||host.__dshBilliardsGame;old.destroy();window.__BILLIARDS_PREVIEW_GAME__=new Type(host);}return true;`);
  await send('HeapProfiler.collectGarbage');
  const heapAfter=(await send('Performance.getMetrics')).metrics.find(m=>m.name==='JSHeapUsedSize').value;
  const performanceResult={frameTiming,heapBefore,heapAfter,heapDelta:heapAfter-heapBefore};
  writeFileSync(join(output,hostUrl?'host-performance.json':'performance.json'),JSON.stringify(performanceResult,null,2));
  console.log('MEASURE rendering and 10 mount/destroy cycles',performanceResult);
  await game(`g.open();g.setPassive(true);g.setPassive(false);return true;`);
  await evaluate(`document.body.removeAttribute('data-ds-dark-theme'); document.documentElement.classList.add('dark');`);
  await delay(50);
  assert.equal(await game('return g.stage.dataset.bilTheme;'), 'dark');
  assert.deepEqual(errors, []);
  const result = { runtimeExceptions: errors.length, screenshots };
  writeFileSync(join(output, hostUrl ? 'host-results.json' : 'browser-results.json'), JSON.stringify(result, null, 2));
  console.log('PASS theme, HUD layouts, native titlebar offsets and results', result);
  await game('g.destroy(); return true;');
  assert.equal(await evaluate('!!window.__DSH_BILLIARDS__'), false);
  assert.equal(await evaluate('!!document.querySelector(".dsh-bil-host").__dshBilliardsGame'),false);
  await evaluate(`const host=document.querySelector('.dsh-bil-host'),Type=window.__BILLIARDS_PREVIEW_GAME__?.constructor; if(Type){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=()=>null;try{const broken=new Type(host);if(!broken.destroyed||!host.textContent.includes('无法启动'))throw new Error('Canvas failure not contained');}finally{HTMLCanvasElement.prototype.getContext=original;}}`);
} finally {
  ws?.close();
  child.kill();
  await Promise.race([exited, delay(3000)]);
  await new Promise((resolve) => server.close(resolve));
  // Only remove the unique profile created inside this repository's output dir.
  if (profile.startsWith(output + (process.platform === 'win32' ? '\\' : '/'))) {
    for (let i = 0; i < 10; i++) {
      try { rmSync(profile, { recursive: true, force: true }); break; } catch { await delay(200); }
    }
  }
}
