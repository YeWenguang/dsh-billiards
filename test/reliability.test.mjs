import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, key, setShot } from './harness.mjs';

test('keyboard can move and confirm ball in hand; invalid placement is rejected', () => {
  const g = loadGame().createGame();
  g.isOpen = true; g.ballInHand = true; g.phase = 'placing'; g.cueBall().active = false;
  g.ghostCue = { x: g.cueBall().x, y: g.cueBall().y, valid: true };
  const x = g.ghostCue.x;
  g.onKeyDown(key(g, 'ArrowRight'));
  assert.ok(g.ghostCue.x > x);
  g.ghostCue.valid = false;
  g.onKeyDown(key(g, 'Enter'));
  assert.equal(g.ballInHand, true);
  g.ghostCue.valid = true;
  g.onKeyDown(key(g, 'Enter'));
  assert.equal(g.ballInHand, false);
  assert.equal(g.cueBall().active, true);
  assert.equal(g.phase, 'aiming');
});

test('camera resize preserves every ball and active shot; coordinates round-trip', () => {
  const { createGame, context } = loadGame();
  const g = createGame();
  g.canvas = { style: {} }; g.staticCanvas = {};
  g.staticCtx = { setTransform() {} }; g.renderStatic = () => {};
  g.shoot(g.aimAngle, 0.8);
  const before = JSON.stringify({ balls: g.balls, geo: g.geo, shot: g.shot });
  for (const [w,h,dpr] of [[800,600,1],[390,844,3],[320,640,2],[900,400,1],[1440,900,2]]) {
    Object.assign(context.window, { innerWidth: w, innerHeight: h, devicePixelRatio: dpr });
    g.resize();
    assert.equal(JSON.stringify({ balls: g.balls, geo: g.geo, shot: g.shot }), before);
    const screen = g.worldToScreen(300, 200);
    const world = g.screenToWorld(screen.x, screen.y);
    assert.ok(Math.abs(world.x-300) < 1e-8 && Math.abs(world.y-200) < 1e-8);
    assert.ok(g.canvas.width * g.canvas.height <= 4_010_000);
  }
});

test('stable save restores groups, free ball and geometry on a different viewport', () => {
  const {createGame} = loadGame(); const g = createGame();
  g.players = [{group:'solid'},{group:'stripe'}]; g.current = 0;
  g.ballInHand = true; g.cueBall().active = false; g.phase = 'placing'; g.shots = 4;
  g.persistSession();
  const h = createGame(390,844);
  assert.equal(h.restoreSession(), true);
  assert.equal(h.phase, 'placing');
  assert.equal(h.geo.w, 1440);
  assert.equal(h.players[0].group, 'solid');
  assert.equal(h.shots, 4);
  assert.equal(h.ghostCue.valid, true);
});

test('reload during a shot restores its start; a terminal game cannot be scored again by reload', () => {
  const {createGame,storage} = loadGame(); const g = createGame();
  const original = g.cueBall().x;
  g.shoot(g.aimAngle, 0.8); g.stepPhysics(0.02); g.persistSession();
  const h = createGame(); assert.equal(h.restoreSession(), true);
  assert.equal(h.cueBall().x, original);
  assert.equal(h.phase, 'aiming');
  g.endGame(0,'eight');
  assert.equal(storage.has('dsh-billiards.session.v1'), false);
  assert.equal(createGame().restoreSession(), false);
});

test('corrupt, unsupported and non-finite saves fall back without poisoning a new game', () => {
  const {createGame,storage} = loadGame();
  for (const raw of ['{', 'null', '{"version":99}']) {
    storage.set('dsh-billiards.session.v1',raw);
    const g = createGame(); assert.equal(g.restoreSession(),false);
    assert.equal(g.balls.length,16); assert.equal(g.phase,'aiming');
  }
  const g=createGame();g.persistSession();
  const bad=JSON.parse(storage.get('dsh-billiards.session.v1'));
  bad.balls[0].x=null;storage.set('dsh-billiards.session.v1',JSON.stringify(bad));
  assert.equal(createGame().restoreSession(),false);
});

test('storage denial does not block shooting or finishing', () => {
  const {createGame,context}=loadGame();
  context.localStorage.setItem=()=>{throw new Error('denied');};
  const g=createGame();g.shoot(g.aimAngle,0.5);assert.equal(g.phase,'shooting');
  assert.equal(g.storageUnavailable,true);g.endGame(0,'eight');assert.equal(g.gameOver,true);
});

test('restart asks only for an unfinished game with shots', () => {
  const g=loadGame().createGame();let confirmed=0,started=0;
  g.showPanel=(kind)=>{assert.equal(kind,'confirm');confirmed++;};g.newGame=()=>started++;
  g.requestNewGame();g.shots=1;g.requestNewGame();g.gameOver=true;g.requestNewGame();
  assert.equal(confirmed,1);assert.equal(started,2);
});

test('AI early eight gives a truthful win reason', () => {
  const g=loadGame().createGame();g.current=1;g.players=[{group:'solid'},{group:'stripe'}];
  setShot(g,{by:1,firstHit:9,firstHitKind:'stripe',startGroup:'stripe',startOnEight:false,pocketOrder:[8]});
  g.resolveShot();assert.equal(g.result.winner,0);
  assert.match(g.refs.resultCopy.textContent,/提前/);assert.doesNotMatch(g.refs.resultTitle.innerHTML,/清台/);
});

test('titlebar is restored after its marker disappears and newer host styles survive', () => {
  const {createGame,context}=loadGame();const g=createGame();g.host={dataset:{}};
  let available=true;const values=new Map([['--dsw-specific-sidebar-fill','original']]);
  context.document.documentElement={hasAttribute:()=>available};
  context.document.body={style:{getPropertyValue:n=>values.get(n)||'',getPropertyPriority:()=>'',setProperty:(n,v)=>values.set(n,v),removeProperty:n=>values.delete(n)}};
  g.syncDesktopChrome(true);available=false;g.syncDesktopChrome(false);
  assert.equal(values.get('--dsw-specific-sidebar-fill'),'original');
  available=true;g.syncDesktopChrome(true);values.set('--dsw-specific-sidebar-fill','new-theme');g.syncDesktopChrome(false);
  assert.equal(values.get('--dsw-specific-sidebar-fill'),'new-theme');
});

test('fixed power is independent of press duration', () => {
  const g=loadGame().createGame();g.isOpen=true;g.prefs.fixedPower=0.45;
  g.beginCharge();g.updateCharge(g.chargeStart+1);assert.equal(g.power,0.45);
  g.updateCharge(g.chargeStart+10000);assert.equal(g.power,0.45);
});

test('one-cushion kick is found when a direct target is blocked', () => {
  const g=loadGame().createGame();
  g.debugSetBalls({cue:{x:300,y:450},balls:[{number:1,x:900,y:450},{number:9,x:600,y:450}]});
  const target=g.ballByNumber(1);const plan=g.planKick([target]);
  assert.ok(plan && Number.isFinite(plan.angle));assert.equal(plan.target,target);
  g.shoot(plan.angle,plan.power);
  for(let i=0;i<24000 && !g.allStopped();i++) g.stepPhysics(1/2400);
  assert.equal(g.shot.firstHit,1,'kick must actually contact its intended ball in production physics');
});

test('rule boundaries: mixed open-table pots, foul assignment, simultaneous last color/eight and break scratch/eight', () => {
  for (const foul of [false,true]) {
    const g=loadGame().createGame();
    setShot(g,{pocketOrder:[9,1],cuePocketed:foul});g.resolveShot();
    assert.equal(g.players[0].group,foul?null:'stripe');
    assert.equal(g.ballInHand,foul);
  }
  const g=loadGame().createGame();g.players=[{group:'solid'},{group:'stripe'}];
  setShot(g,{startGroup:'solid',startOnEight:false,pocketOrder:[7,8],firstHit:7});
  g.resolveShot();assert.equal(g.result.winner,1,'black eight eligibility is decided at shot start');
  const h=loadGame().createGame();
  setShot(h,{break:true,pocketOrder:[8,0],cuePocketed:true});h.resolveShot();
  assert.equal(h.isBreak,true);assert.equal(h.gameOver,false);assert.equal(h.prefs.games,0);
});
