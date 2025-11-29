/* ---------------------
   Setup & Utilities
   --------------------- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', {alpha:false});
let W = canvas.width, H = canvas.height;
function resizeCanvasToDisplay() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width * devicePixelRatio);
  const h = Math.floor(rect.height * devicePixelRatio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    W = canvas.width / devicePixelRatio;
    H = canvas.height / devicePixelRatio;
  }
}
resizeCanvasToDisplay();
window.addEventListener('resize', resizeCanvasToDisplay);

const rand = (a,b) => Math.random() * (b - a) + a;
const randInt = (a,b) => Math.floor(rand(a,b+1));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const dist2 = (ax,ay,bx,by) => (ax-bx)*(ax-bx) + (ay-by)*(ay-by);
const dist = (ax,ay,bx,by) => Math.sqrt(dist2(ax,ay,bx,by));

const UI = {
  waveLabel: document.getElementById('waveLabel'),
  gold: document.getElementById('gold'),
  hpText: document.getElementById('hpText'),
  hpBar: document.getElementById('hpBar'),
  statAttack: document.getElementById('statAttack'),
  statFireRate: document.getElementById('statFireRate'),
  statArmor: document.getElementById('statArmor'),
  statSpeed: document.getElementById('statSpeed'),
  log: document.getElementById('log'),
  pauseBtn: document.getElementById('pauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  muteBtn: document.getElementById('muteBtn'),
  saveToggle: document.getElementById('saveToggle'),
  statusMsg: document.getElementById('statusMsg'),
  buyAllBtn: document.getElementById('buyAllBtn'),
  upgradePanel: document.getElementById('upgradePanel')
};
function logEvent(msg){
  const time = new Date().toLocaleTimeString();
  const el = document.createElement('div');
  el.textContent = `[${time}] ${msg}`;
  UI.log.prepend(el);
  while(UI.log.children.length > 200) UI.log.removeChild(UI.log.lastChild);
}

/* Audio */
let audioCtx = null;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
let muted = false;
UI.muteBtn.addEventListener('click', ()=>{
  muted = !muted;
  UI.muteBtn.textContent = muted ? '🔇' : '🔊';
  if(!muted) ensureAudio();
});
function playBeep(freq=440, type='sine', time=0.05, gain=0.06){
  if(muted) return;
  ensureAudio();
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
  o.stop(audioCtx.currentTime + time + 0.02);
}

/* ---------------------
   Settings & Balance
   --------------------- */
const SETTINGS = {
  start: {
    MaxHP: 500, HP:500, Attack:10, FireRate:1.0, ArmorPct:0, Speed:100
  },
  waveBase: {
    baseEnemies: 3,
    perWaveScale: 1.5,
    enemyHP: (wave) => 20 + wave * 5,
    enemyDmg: (wave) => 1 + wave * 0.5
  },
  costs: {
    attack: (lvl)=> 50 * (lvl + 1),
    fireRate: (lvl)=> 80 * (lvl + 1),
    maxHP: (lvl)=> 100 * (lvl + 1),
    armor: (lvl)=> 120 * (lvl + 1),
    speed: (lvl)=> 40 * (lvl + 1),
    drones: (lvl)=> 150 * (lvl + 1)
  },
  upgradesEffect: {
    attackAdd: 5,
    fireRateAdd: 0.25,
    maxHPAdd: 20,
    armorPctAdd: 0.02,
    speedAdd: 10,
    dronesAdd: 1
  },
  coinPickupRadius: 30,
  maxBullets: 300,
  maxParticles: 300,
  saveKey: 'space_auto_battler_v5_save'
};

/* ---------------------
   Game State & Persistence
   --------------------- */
let State = {
  paused: false,
  wave: 1,
  gold: 0,
  entities: { enemies: [], bullets: [], particles: [], pickups: [], obstacles: [] },
  time: 0,
  lastTimestamp: 0
};

const defaultUpgradeState = { attack:0, fireRate:0, maxHP:0, armor:0, speed:0, drones:0 };
let Upgrades = {...defaultUpgradeState};

function loadSave(){
  if(!UI.saveToggle.checked) return;
  const raw = localStorage.getItem(SETTINGS.saveKey);
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if(parsed.upgrades) Upgrades = parsed.upgrades;
    if(typeof parsed.gold === 'number') State.gold = parsed.gold;
    logEvent('Loaded save');
  }catch(e){}
}
function saveState(){
  if(!UI.saveToggle.checked) return;
  const data = {upgrades: Upgrades, gold: State.gold, wave: State.wave};
  try{ localStorage.setItem(SETTINGS.saveKey, JSON.stringify(data)); }catch(e){}
}

/* ---------------------
   Vector helper (simple)
   --------------------- */
class Vec {
  constructor(x=0,y=0){this.x=x;this.y=y;}
  add(v){this.x+=v.x;this.y+=v.y;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;return this;}
  mul(s){this.x*=s;this.y*=s;return this;}
  clone(){return new Vec(this.x,this.y);}
  length(){return Math.sqrt(this.x*this.x+this.y*this.y);}
  normalize(){const l=this.length(); if(l>0){this.x/=l;this.y/=l;} return this;}
}

/* ---------------------
   Player (circular hitbox, with velocity for hunting)
   --------------------- */
class Player {
  constructor(){
    this.pos = new Vec(W/2, H/2);
    this.vel = new Vec(0,0);
    this.radius = 18;
    this.dir = 0;
    this.drones = [];
    this.patrolTarget = new Vec(W/2, H/2);
    this.patrolTimer = 0;
    this.circleDir = Math.random() < 0.5 ? 1 : -1;
    this.lastTarget = null;
    this.orbitRadius = rand(120, 180);
    this.respawn();
    this.activePowerUps = [];
  }
  respawn(){
    const s = SETTINGS.start;
    this.maxHP = s.MaxHP + (Upgrades.maxHP * SETTINGS.upgradesEffect.maxHPAdd);
    this.hp = Math.min(s.HP, this.maxHP);
    this.attack = s.Attack + (Upgrades.attack * SETTINGS.upgradesEffect.attackAdd);
    this.fireRate = s.FireRate + (Upgrades.fireRate * SETTINGS.upgradesEffect.fireRateAdd);
    this.armorPct = s.ArmorPct + (Upgrades.armor * SETTINGS.upgradesEffect.armorPctAdd);
    this.speed = s.Speed + (Upgrades.speed * SETTINGS.upgradesEffect.speedAdd);
    this.fireCooldown = 0;
    this.target = null;
    this.activePowerUps = [];
  }
  applyUpgradeChanges(){
    const s = SETTINGS.start;
    const prevMax = this.maxHP || s.MaxHP;
    this.maxHP = s.MaxHP + (Upgrades.maxHP * SETTINGS.upgradesEffect.maxHPAdd);
    const delta = this.maxHP - prevMax;
    if(delta > 0) this.hp = Math.min(this.hp + delta, this.maxHP);
    this.attack = s.Attack + (Upgrades.attack * SETTINGS.upgradesEffect.attackAdd);
    this.fireRate = s.FireRate + (Upgrades.fireRate * SETTINGS.upgradesEffect.fireRateAdd);
    this.armorPct = s.ArmorPct + (Upgrades.armor * SETTINGS.upgradesEffect.armorPctAdd);
    this.speed = s.Speed + (Upgrades.speed * SETTINGS.upgradesEffect.speedAdd);
    const targetDrones = Upgrades.drones || 0;
    while(this.drones.length < targetDrones) this.drones.push(new Drone(this));
    while(this.drones.length > targetDrones) this.drones.pop();
  }
  applyPowerUp(type){
    let existing = this.activePowerUps.find(up => up.type === type);
    if(existing){
      existing.endTime = State.time + 10;
    } else {
      this.activePowerUps.push({type, endTime: State.time + 10});
    }
  }
  update(dt){
    // clean expired power-ups
    this.activePowerUps = this.activePowerUps.filter(up => State.time < up.endTime);

    this.fireCooldown -= dt;

    // find nearest target
    let nearest = null, nd = Infinity;
    for(const e of State.entities.enemies){
      const d2 = dist2(this.pos.x,this.pos.y,e.pos.x,e.pos.y);
      if(d2 < nd){ nd = d2; nearest = e; }
    }
    this.target = nearest;

    if (this.target && this.target !== this.lastTarget) {
      this.circleDir = Math.random() < 0.5 ? 1 : -1;
      this.orbitRadius = rand(120, 180);
      this.lastTarget = this.target;
    }

    // steering behavior
    let desired = new Vec(0,0);
    if(this.target){
      const toTarget = new Vec(this.target.pos.x - this.pos.x, this.target.pos.y - this.pos.y);
      const distance = toTarget.length();
      if (distance > this.orbitRadius * 1.5) {
        // approach if too far
        desired = toTarget.normalize().mul(this.speed);
      } else {
        // circling behavior
        const radialError = distance - this.orbitRadius;
        const radial = toTarget.normalize().mul(radialError * 0.15 * this.speed / this.orbitRadius); // increased radial force for tighter control
        const tangentVec = this.circleDir > 0 ? new Vec(-toTarget.y, toTarget.x) : new Vec(toTarget.y, -toTarget.x);
        const tangent = tangentVec.normalize().mul(this.speed * 1.1); // slightly increased tangential speed
        desired = tangent.add(radial);
      }
      const dToTarget = distance;
      if(dToTarget < this.radius + this.target.radius + 80){
        desired.mul(0.6);
      }
    }else{
      if (this.patrolTimer <= 0 || dist(this.pos.x, this.pos.y, this.patrolTarget.x, this.patrolTarget.y) < 50) {
        this.patrolTarget = new Vec(rand(100, W-100), rand(100, H-100));
        this.patrolTimer = rand(3, 6);
      }
      this.patrolTimer -= dt;
      desired = new Vec(this.patrolTarget.x - this.pos.x, this.patrolTarget.y - this.pos.y).normalize().mul(this.speed * 0.8);
    }
    const steer = new Vec(desired.x - this.vel.x, desired.y - this.vel.y);
    steer.mul(0.2); // increased for better responsiveness
    this.vel.add(steer);
    const maxv = this.speed * 1.2;
    const vlen = this.vel.length();
    if(vlen > maxv) this.vel.mul(maxv / vlen);

    // avoid obstacles
    for(const ob of State.entities.obstacles){
      const d = dist(this.pos.x,this.pos.y, ob.x,ob.y);
      const minDist = ob.r + this.radius + 16;
      if(d < minDist && d > 0.1){
        const away = new Vec(this.pos.x - ob.x, this.pos.y - ob.y).normalize().mul((minDist - d) * 0.1);
        this.vel.add(away);
      }
    }

    // apply movement
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // separate from enemies (pushed in enemy update)
    this.pos.x = clamp(this.pos.x, 20, W-20);
    this.pos.y = clamp(this.pos.y, 20, H-20);

    // shooting
    if(this.target){
      const aim = new Vec(this.target.pos.x - this.pos.x, this.target.pos.y - this.pos.y).normalize();
      this.dir = Math.atan2(aim.y, aim.x);
      if(this.fireCooldown <= 0){
        this.shoot(aim);
        this.fireCooldown = 1 / this.fireRate;
      }
    }else{
      this.dir += (Math.random()-0.5)*0.01;
      if(this.fireCooldown <= 0 && Math.random() < 0.02){
        const aim = new Vec(Math.cos(this.dir), Math.sin(this.dir));
        this.shoot(aim);
        this.fireCooldown = 1 / this.fireRate;
      }
    }

    // pickup collection and drift
    for(let i = State.entities.pickups.length-1; i>=0; i--){
      const pu = State.entities.pickups[i];
      const d = dist(this.pos.x,this.pos.y, pu.pos.x, pu.pos.y);
      if(d < SETTINGS.coinPickupRadius){
        if(pu.type === 'gold'){
          State.gold += pu.value;
          playBeep(880, 'sine', 0.06, 0.06);
          logEvent(`Picked up +${pu.value} gold (total ${State.gold})`);
        } else if(pu.type === 'hp'){
          const restored = Math.min(this.maxHP - this.hp, pu.value);
          this.hp += restored;
          playBeep(660, 'sine', 0.08, 0.08);
          logEvent(`HP restored +${restored} (now ${Math.round(this.hp)}/${this.maxHP})`);
        } else if(pu.type === 'pu'){
          this.applyPowerUp(pu.puType);
          playBeep(440, 'square', 0.1, 0.1);
          logEvent(`Power-up: ${pu.puType} activated for 10s`);
        }
        State.entities.pickups.splice(i,1);
      } else if(d < 300){
        const pull = new Vec(this.pos.x - pu.pos.x, this.pos.y - pu.pos.y).normalize().mul(1000 * dt);
        pu.pos.add(pull);
      }
    }
  }
  takeDamage(amount){
    const reduced = amount * (1 - this.armorPct);
    this.hp -= reduced;
    if(this.hp <= 0){
      this.hp = 0;
      createExplosion(this.pos.x, this.pos.y, 24, '#ff6b6b');
      logEvent('Player destroyed — respawning');
      playBeep(120, 'sawtooth', 0.3, 0.2);
      const lost = Math.floor(State.gold * 0.10);
      State.gold = Math.max(0, State.gold - lost);
      setTimeout(()=>{ this.respawn(); this.pos = new Vec(W/2 + rand(-60,60), H/2 + rand(-60,60)); }, 800);
    } else {
      playBeep(240, 'sine', 0.06, 0.05);
    }
  }
  shoot(direction){
    const hasSpread = this.activePowerUps.some(up => up.type === 'spread');
    const hasHoming = this.activePowerUps.some(up => up.type === 'homing');
    if(hasSpread){
      const num = 5;
      const step = (Math.PI / 3) / (num - 1);
      for(let k = 0; k < num; k++){
        const off = (k - (num - 1) / 2) * step;
        const aDir = this.dir + off;
        const aim = new Vec(Math.cos(aDir), Math.sin(aDir));
        const bx = this.pos.x + Math.cos(aDir) * (this.radius + 6);
        const by = this.pos.y + Math.sin(aDir) * (this.radius + 6);
        const vel = aim.mul(420);
        if(State.entities.bullets.length < SETTINGS.maxBullets){
          const bullet = new Bullet(bx, by, vel, this.attack, 'player');
          if(hasHoming) bullet.homing = true;
          State.entities.bullets.push(bullet);
          createParticle(bx, by, 4, '#9be9ff', 0.15);
        }
      }
    } else {
      const bx = this.pos.x + Math.cos(this.dir) * (this.radius + 6);
      const by = this.pos.y + Math.sin(this.dir) * (this.radius + 6);
      const vel = direction.mul(420);
      if(State.entities.bullets.length < SETTINGS.maxBullets){
        const bullet = new Bullet(bx, by, vel, this.attack, 'player');
        if(hasHoming) bullet.homing = true;
        State.entities.bullets.push(bullet);
        createParticle(bx, by, 6, '#9be9ff', 0.2);
      }
    }
    this.fireCooldown = 1 / this.fireRate;
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.dir);
    // improved ship: body
    ctx.fillStyle = '#66e0ff';
    roundPoly(ctx, [{x:24,y:0},{x:-10,y:-16},{x:-6,y:-8},{x:-18,y:0},{x:-6,y:8},{x:-10,y:16}], 4);
    ctx.fill();
    // cockpit
    ctx.fillStyle = '#03253b';
    ctx.beginPath(); ctx.ellipse(0,-2,8,6,0,0,Math.PI*2); ctx.fill();
    // wings
    ctx.fillStyle = '#4ab8d8';
    roundPoly(ctx, [{x:6,y:-12},{x:-8,y:-20},{x:-12,y:-12}], 2);
    ctx.fill();
    roundPoly(ctx, [{x:6,y:12},{x:-8,y:20},{x:-12,y:12}], 2);
    ctx.fill();
    // glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#9be9ff';
    ctx.beginPath(); ctx.ellipse(-14,0,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
function roundPoly(ctx, pts, r){
  ctx.beginPath();
  for(let i=0;i<pts.length;i++){
    const p = pts[i];
    if(i===0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

/* ---------------------
   Drone (helper for player)
   --------------------- */
class Drone {
  constructor(player) {
    this.player = player;
    this.pos = player.pos.clone();
    this.radius = 8;
    this.angle = rand(0, Math.PI * 2);
    this.attack = player.attack * 0.5;
    this.fireRate = player.fireRate * 0.5;
    this.fireCooldown = rand(0, 1);
    this.target = null;
    this.dir = 0;
  }
  update(dt) {
    this.fireCooldown -= dt;
    // orbit player
    this.angle += dt * (1.2 + (this.player.drones.indexOf(this) % 2 === 0 ? 0.3 : -0.3));
    const orbitR = 40 + this.player.drones.indexOf(this) * 10;
    this.pos.x = this.player.pos.x + Math.cos(this.angle) * orbitR;
    this.pos.y = this.player.pos.y + Math.sin(this.angle) * orbitR;

    // avoid obstacles
    for (const ob of State.entities.obstacles) {
      const d = dist(this.pos.x, this.pos.y, ob.x, ob.y);
      const minD = ob.r + this.radius + 2;
      if (d < minD && d > 0.001) {
        const overlap = minD - d;
        const push = new Vec(this.pos.x - ob.x, this.pos.y - ob.y).normalize().mul(overlap);
        this.pos.add(push);
      }
    }

    // find nearest target
    let nearest = null, nd = Infinity;
    for (const e of State.entities.enemies) {
      const d2 = dist2(this.pos.x, this.pos.y, e.pos.x, e.pos.y);
      if (d2 < nd) { nd = d2; nearest = e; }
    }
    this.target = nearest;

    // shooting
    if (this.target) {
      const aim = new Vec(this.target.pos.x - this.pos.x, this.target.pos.y - this.pos.y).normalize();
      this.dir = Math.atan2(aim.y, aim.x);
      const hasHoming = this.player.activePowerUps?.some(u => u.type === 'homing') || false;
      if (this.fireCooldown <= 0) {
        this.shoot(aim, hasHoming);
        this.fireCooldown = 1 / this.fireRate;
      }
    }
  }
  shoot(direction, isHoming = false) {
    if (State.entities.bullets.length > SETTINGS.maxBullets) return;
    const spd = 420;
    const bx = this.pos.x + Math.cos(this.dir) * (this.radius + 4);
    const by = this.pos.y + Math.sin(this.dir) * (this.radius + 4);
    const vel = new Vec(direction.x * spd, direction.y * spd);
    const bullet = new Bullet(bx, by, vel, this.attack, 'player');
    if(isHoming) bullet.homing = true;
    State.entities.bullets.push(bullet);
    createParticle(bx, by, 4, '#9be9ff', 0.15);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.dir);
    ctx.fillStyle = '#66e0ff';
    roundPoly(ctx, [{x:12,y:0},{x:-6,y:-6},{x:-4,y:0},{x:-6,y:6}], 2);
    ctx.fill();
    // glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#9be9ff';
    ctx.beginPath(); ctx.ellipse(-5,0,6,3,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/* ---------------------
   Bullet
   --------------------- */
class Bullet {
  constructor(x,y,vel,damage,owner){
    this.pos = new Vec(x,y);
    this.vel = vel;
    this.damage = damage;
    this.owner = owner;
    this.radius = owner === 'player' ? 4 : 6;
    this.color = owner === 'player' ? '#bdf7ff' : '#ffb2b2';
    this.life = 3.5;
    this.homing = false;
  }
  update(dt){
    if(this.homing && this.owner === 'player'){
      let nearest = null, nd = Infinity;
      for(const e of State.entities.enemies){
        const d2 = dist2(this.pos.x,this.pos.y,e.pos.x,e.pos.y);
        if(d2 < nd){ nd = d2; nearest = e; }
      }
      if(nearest){
        const toT = new Vec(nearest.pos.x - this.pos.x, nearest.pos.y - this.pos.y);
        const distT = toT.length();
        if(distT > 0){
          toT.normalize();
          const desiredVel = toT.mul(420);
          const steer = new Vec(desiredVel.x - this.vel.x, desiredVel.y - this.vel.y);
          steer.mul(0.15);
          this.vel.add(steer.mul(dt * 60));
          const vlen = this.vel.length();
          if(vlen > 450) this.vel.mul(450 / vlen);
        }
      }
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.life -= dt;
    // removed obstacle collision to allow bullets to go through
    if(this.pos.x < -40 || this.pos.x > W+40 || this.pos.y < -40 || this.pos.y > H+40) this.life = 0;
  }
  draw(ctx){
    ctx.beginPath(); ctx.fillStyle = this.color; ctx.ellipse(this.pos.x, this.pos.y, this.radius, this.radius, 0,0,Math.PI*2); ctx.fill();
  }
}

/* ---------------------
   Enemy (circular collision + separation)
   --------------------- */
class Enemy {
  constructor(type, wave){
    this.type = type;
    this.pos = this._spawnPosNotNearPlayer();
    this.radius = type === 'heavy' ? 20 : type === 'ranged' ? 15 : type === 'elite' ? 26 : 12;
    this.wave = wave;
    const hpBase = SETTINGS.waveBase.enemyHP(wave);
    this.maxHP = hpBase * (type==='heavy' ? 2.2 : type==='ranged' ? 1.4 : type==='elite' ? 4.0 : 1.0);
    this.hp = this.maxHP;
    this.damage = SETTINGS.waveBase.enemyDmg(wave) * (type==='heavy'?1.4: type==='ranged'?0.8: type==='elite'?2.2:1.0);
    this.speed = type==='heavy' ? 40 : type==='ranged' ? 50 : type==='elite'? 30 : 80;
    this.fireCooldown = rand(0,1.5);
    this.color = type==='heavy' ? '#ffd89b' : type==='ranged' ? '#ab6bff' : '#ff7b7b';
    if(type==='elite') this.color = '#ffd15b';
    // velocity for smoother movement
    this.vel = new Vec(0,0);
    this.circleDir = Math.random() < 0.5 ? 1 : -1;
    this.orbitRadius = rand(180, 220);
  }

  // ensure enemy spawns not too close to player or inside obstacles
  _spawnPosNotNearPlayer(){
    const margin = 100 + 30; // min distance from player center
    for(let tries=0; tries<200; tries++){
      let x = rand(20, W-20), y = rand(20, H-20);
      // 40% chance spawn offscreen edge
      if(Math.random() < 0.6){
        if(Math.random() < 0.5) x = Math.random()<0.5? -40: W+40;
        else y = Math.random()<0.5? -40: H+40;
      }
      const pd = dist(x,y, game.player.pos.x, game.player.pos.y);
      if(pd < margin + 20) continue;
      // avoid spawning inside obstacles
      const collOb = State.entities.obstacles.some(o => dist(x,y,o.x,o.y) < o.r + 20);
      if(collOb) continue;
      return new Vec(x,y);
    }
    // fallback
    return new Vec(rand(20,W-20), rand(20,H-20));
  }

  update(dt){
    // steering toward player
    const p = game.player.pos;
    const dToPlayer = dist(this.pos.x,this.pos.y, p.x,p.y);
    let desired;
    if (this.type === 'ranged') {
      const toPlayer = new Vec(p.x - this.pos.x, p.y - this.pos.y);
      const distance = toPlayer.length();
      if (distance > this.orbitRadius * 1.5) {
        // approach if too far
        desired = toPlayer.normalize().mul(this.speed);
      } else {
        // circling behavior
        const radialError = distance - this.orbitRadius;
        const radial = toPlayer.normalize().mul(radialError * 0.15 * this.speed / this.orbitRadius); // increased radial force
        const tangentVec = this.circleDir > 0 ? new Vec(-toPlayer.y, toPlayer.x) : new Vec(toPlayer.y, -toPlayer.x);
        const tangent = tangentVec.normalize().mul(this.speed * 1.1); // increased tangential speed
        desired = tangent.add(radial);
      }
    } else {
      desired = new Vec(p.x - this.pos.x, p.y - this.pos.y).normalize().mul(this.speed);
      // simple arrival: reduce speed when near player
      if(dToPlayer < this.radius + game.player.radius + 80){
        desired.mul(0.6);
      }
    }
    // steering = desired - vel
    const steer = new Vec(desired.x - this.vel.x, desired.y - this.vel.y);
    steer.mul(0.08);
    this.vel.add(steer);
    // limit vel
    const maxv = this.speed * 1.2;
    const vlen = this.vel.length();
    if(vlen > maxv) this.vel.mul(maxv / vlen);
    // apply tentative movement
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    // separation: avoid obstacles, other enemies, player, and drones
    this._separateFromObstacles();
    this._separateFromEnemies();
    this._separateFromPlayer();
    this._separateFromDrones();

    // clamp to bounds
    this.pos.x = clamp(this.pos.x, -40, W+40);
    this.pos.y = clamp(this.pos.y, -40, H+40);

    // shooting
    this.fireCooldown -= dt;
    if(this.fireCooldown <= 0){
      this.fireCooldown = this.type === 'ranged' ? rand(0.4, 0.8) : rand(1.0, 2.2);
      const aim = new Vec(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
      const vel = new Vec(aim.x * 240, aim.y * 240);
      if(State.entities.bullets.length < SETTINGS.maxBullets) State.entities.bullets.push(new Bullet(this.pos.x + aim.x*(this.radius+6), this.pos.y + aim.y*(this.radius+6), vel, this.damage, 'enemy'));
      createParticle(this.pos.x, this.pos.y, 6, '#ffb2b2', 0.08);
    }
  }

  // push away from obstacles with overlap resolution (stronger force)
  _separateFromObstacles(){
    for(const ob of State.entities.obstacles){
      const d = dist(this.pos.x,this.pos.y, ob.x, ob.y);
      const minD = ob.r + this.radius + 2;
      if(d < minD && d > 0.001){
        const overlap = minD - d;
        const push = new Vec(this.pos.x - ob.x, this.pos.y - ob.y).normalize().mul(overlap * 1.0);
        this.pos.add(push);
        // slightly damp velocity
        this.vel.mul(0.8);
      }
    }
  }
  // avoid crowding other enemies using circular separation
  _separateFromEnemies(){
    for(const other of State.entities.enemies){
      if(other === this) continue;
      const d = dist(this.pos.x,this.pos.y, other.pos.x, other.pos.y);
      const minD = this.radius + other.radius + 2;
      if(d < minD && d > 0.001){
        const overlap = minD - d;
        // push both away proportionally — here we push this away
        const push = new Vec(this.pos.x - other.pos.x, this.pos.y - other.pos.y).normalize().mul(overlap * 0.5);
        this.pos.add(push);
        // small damp velocity to avoid jitter
        this.vel.mul(0.92);
      }
    }
  }
  // ensure not overlapping player — push away gently (stronger)
  _separateFromPlayer(){
    const p = game.player;
    const d = dist(this.pos.x,this.pos.y, p.pos.x, p.pos.y);
    const minD = this.radius + p.radius + 6; // keep a small buffer
    if(d < minD && d > 0.001){
      const overlap = minD - d;
      const push = new Vec(this.pos.x - p.pos.x, this.pos.y - p.pos.y).normalize().mul(overlap * 1.2);
      this.pos.add(push);
      // also apply small push to player so they don't get jammed (player heavier)
      p.pos.x -= push.x * 0.18;
      p.pos.y -= push.y * 0.18;
      this.vel.mul(0.9);
    }
  }
  // separate from drones
  _separateFromDrones(){
    for(const drone of game.player.drones){
      const d = dist(this.pos.x,this.pos.y, drone.pos.x, drone.pos.y);
      const minD = this.radius + drone.radius + 4;
      if(d < minD && d > 0.001){
        const overlap = minD - d;
        const push = new Vec(this.pos.x - drone.pos.x, this.pos.y - drone.pos.y).normalize().mul(overlap * 0.9);
        this.pos.add(push);
        this.vel.mul(0.9);
      }
    }
  }

  takeDamage(dmg){
    this.hp -= dmg;
    createParticle(this.pos.x, this.pos.y, 3, '#ffefe0', 0.04);
    if(this.hp <= 0){
      const base = (this.wave < 5) ? 5 : (5 + Math.floor(this.wave/2));
      let value = base * (this.type==='heavy' ? 2 : this.type==='ranged' ? 1.5 : this.type==='elite' ? 6 : 1);
      value = Math.max(1, Math.floor(value * 20));
      State.entities.pickups.push({pos: new Vec(this.pos.x, this.pos.y), type: 'gold', value: value, t: 0});
      // HP restore drop
      if(Math.random() < 0.3){
        const hpVal = 30 + Math.floor(this.wave * 2);
        State.entities.pickups.push({pos: new Vec(this.pos.x + rand(-20,20), this.pos.y + rand(-20,20)), type: 'hp', value: hpVal, t: 0});
      }
      // Power-up drop
      if(Math.random() < 0.2){
        const puType = Math.random() < 0.5 ? 'spread' : 'homing';
        State.entities.pickups.push({pos: new Vec(this.pos.x + rand(-20,20), this.pos.y + rand(-20,20)), type: 'pu', puType, t: 0});
      }
      createExplosion(this.pos.x, this.pos.y, this.radius, this.color);
      playBeep(900, 'triangle', 0.08, 0.07);
      logEvent(`Enemy defeated — +${value} gold`);
      return true;
    } else {
      playBeep(620, 'sine', 0.03, 0.02);
      return false;
    }
  }

  draw(ctx){
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    
    // Calculate rotation toward player
    const toPlayer = new Vec(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y);
    const angle = Math.atan2(toPlayer.y, toPlayer.x);
    ctx.rotate(angle);
    
    // Draw different spaceship designs based on type
    if(this.type === 'basic'){
      // Basic enemy: aggressive red fighter
      const scale = this.radius / 12; // normalize to design size
      ctx.fillStyle = '#ff7b7b';
      roundPoly(ctx, [{x:16*scale,y:0},{x:-8*scale,y:-10*scale},{x:-4*scale,y:-6*scale},{x:-12*scale,y:0},{x:-4*scale,y:6*scale},{x:-8*scale,y:10*scale}], 3);
      ctx.fill();
      // wings
      ctx.fillStyle = '#ff5555';
      roundPoly(ctx, [{x:4*scale,y:-10*scale},{x:-6*scale,y:-14*scale},{x:-8*scale,y:-8*scale}], 2);
      ctx.fill();
      roundPoly(ctx, [{x:4*scale,y:10*scale},{x:-6*scale,y:14*scale},{x:-8*scale,y:8*scale}], 2);
      ctx.fill();
      // cockpit
      ctx.fillStyle = '#440000';
      ctx.beginPath(); ctx.ellipse(2*scale,0,4*scale,3*scale,0,0,Math.PI*2); ctx.fill();
      // engine glow
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff9999';
      ctx.beginPath(); ctx.ellipse(-10*scale,0,6*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      
    } else if(this.type === 'heavy'){
      // Heavy enemy: bulky orange/gold tank
      const scale = this.radius / 20;
      ctx.fillStyle = '#ffd89b';
      roundPoly(ctx, [{x:20*scale,y:0},{x:-10*scale,y:-16*scale},{x:-6*scale,y:-12*scale},{x:-16*scale,y:0},{x:-6*scale,y:12*scale},{x:-10*scale,y:16*scale}], 4);
      ctx.fill();
      // thick armor plating
      ctx.fillStyle = '#ffcc70';
      roundPoly(ctx, [{x:10*scale,y:-8*scale},{x:0,y:-12*scale},{x:-6*scale,y:-10*scale}], 2);
      ctx.fill();
      roundPoly(ctx, [{x:10*scale,y:8*scale},{x:0,y:12*scale},{x:-6*scale,y:10*scale}], 2);
      ctx.fill();
      // cockpit
      ctx.fillStyle = '#663300';
      ctx.beginPath(); ctx.ellipse(4*scale,0,6*scale,5*scale,0,0,Math.PI*2); ctx.fill();
      // double engine glows
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffdd99';
      ctx.beginPath(); ctx.ellipse(-14*scale,-6*scale,7*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-14*scale,6*scale,7*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      
    } else if(this.type === 'ranged'){
      // Ranged enemy: sleek purple ship with weapon arrays
      const scale = this.radius / 15;
      ctx.fillStyle = '#ab6bff';
      roundPoly(ctx, [{x:18*scale,y:0},{x:-6*scale,y:-8*scale},{x:-2*scale,y:-4*scale},{x:-10*scale,y:0},{x:-2*scale,y:4*scale},{x:-6*scale,y:8*scale}], 3);
      ctx.fill();
      // weapon pods
      ctx.fillStyle = '#9955ee';
      ctx.beginPath(); ctx.ellipse(6*scale,-10*scale,5*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6*scale,10*scale,5*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      // weapon barrels
      ctx.fillStyle = '#ffefef';
      ctx.beginPath(); ctx.ellipse(10*scale,-10*scale,3*scale,2*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10*scale,10*scale,3*scale,2*scale,0,0,Math.PI*2); ctx.fill();
      // cockpit
      ctx.fillStyle = '#330066';
      ctx.beginPath(); ctx.ellipse(0,0,5*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      // twin engine glows
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#cc99ff';
      ctx.beginPath(); ctx.ellipse(-8*scale,-4*scale,6*scale,3*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-8*scale,4*scale,6*scale,3*scale,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      
    } else if(this.type === 'elite'){
      // Elite enemy: large gold command ship
      const scale = this.radius / 26;
      ctx.fillStyle = '#ffd15b';
      roundPoly(ctx, [{x:26*scale,y:0},{x:-12*scale,y:-20*scale},{x:-8*scale,y:-14*scale},{x:-20*scale,y:0},{x:-8*scale,y:14*scale},{x:-12*scale,y:20*scale}], 5);
      ctx.fill();
      // command bridge
      ctx.fillStyle = '#ffcc40';
      roundPoly(ctx, [{x:16*scale,y:-8*scale},{x:8*scale,y:-12*scale},{x:-4*scale,y:-10*scale},{x:-4*scale,y:-6*scale}], 3);
      ctx.fill();
      roundPoly(ctx, [{x:16*scale,y:8*scale},{x:8*scale,y:12*scale},{x:-4*scale,y:10*scale},{x:-4*scale,y:6*scale}], 3);
      ctx.fill();
      // bridge window
      ctx.fillStyle = '#663300';
      ctx.beginPath(); ctx.ellipse(6*scale,0,8*scale,6*scale,0,0,Math.PI*2); ctx.fill();
      // armor details
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath(); ctx.ellipse(0,-8*scale,4*scale,3*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0,8*scale,4*scale,3*scale,0,0,Math.PI*2); ctx.fill();
      // triple engine glows
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffee88';
      ctx.beginPath(); ctx.ellipse(-18*scale,0,10*scale,5*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-16*scale,-10*scale,8*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-16*scale,10*scale,8*scale,4*scale,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    
    // Reset rotation for HP bar
    ctx.rotate(-angle);
    
    // hp bar (always horizontal)
    const w = this.radius*2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-w/2, -this.radius-8, w, 5);
    ctx.fillStyle = '#ff6d6d'; const pct = Math.max(0, this.hp/this.maxHP);
    ctx.fillRect(-w/2, -this.radius-8, w*pct, 5);
    ctx.restore();
  }
}

/* ---------------------
   Obstacle
   --------------------- */
class Obstacle {
  constructor(x,y,r){ this.x=x; this.y=y; this.r=r; }
  draw(ctx){
    ctx.save(); ctx.translate(this.x, this.y);
    const grd = ctx.createLinearGradient(-this.r,-this.r,this.r,this.r);
    grd.addColorStop(0,'#3f3f3f'); grd.addColorStop(1,'#6b6b6b');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(0,0,this.r,this.r,0,0,Math.PI*2); ctx.fill();
    // improved: add more craters
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; 
    ctx.beginPath(); ctx.ellipse(-this.r*0.2,-this.r*0.2,this.r*0.4,this.r*0.25,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(this.r*0.3,0,this.r*0.2,this.r*0.15,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,this.r*0.3,this.r*0.25,this.r*0.18,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

/* ---------------------
   Particles & Explosions
   --------------------- */
function createParticle(x,y,count,color,life=0.6){
  const cnt = Math.min(count, SETTINGS.maxParticles - State.entities.particles.length);
  for(let i=0;i<cnt;i++){
    const p = { pos: new Vec(x + rand(-4,4), y + rand(-4,4)), vel: new Vec(rand(-80,80), rand(-80,80)),
      color: color, life: life * rand(0.6,1.1), size: rand(1,4) };
    State.entities.particles.push(p);
  }
}
function createExplosion(x,y,scale=20, color='#ffc27a'){ createParticle(x,y, Math.round(scale*2.4), color, 0.6); }

/* ---------------------
   Wave Manager (uses Enemy class)
   --------------------- */
class WaveManager {
  constructor(){ this.currentWave = 1; this.spawned = false; }
  startWave(n){
    if (n % 10 === 1) {
      generateObstacles();
      logEvent(`Arena regenerated for wave ${n}`);
    }
    this.currentWave = n;
    UI.waveLabel.textContent = `Wave: ${n}`;
    logEvent(`Wave ${n} started`);
    playBeep(520 + (n%12)*30, 'sine', 0.12, 0.08);
    const count = Math.min(50, Math.floor(SETTINGS.waveBase.baseEnemies + Math.floor(n * SETTINGS.waveBase.perWaveScale)));
    const heavyPct = Math.min(0.2 + n * 0.01, 0.45);
    const rangedPct = n > 5 ? Math.min(0.1 + (n - 5) * 0.015, 0.35) : 0;
    const enemies = [];
    for(let i=0;i<count;i++){
      let type = 'basic';
      const r = Math.random();
      if (r < heavyPct) type = 'heavy';
      else if (r < heavyPct + rangedPct) type = 'ranged';
      enemies.push(new Enemy(type, n));
    }
    if(n % 5 === 0) enemies.push(new Enemy('elite', n));
    State.entities.enemies.push(...enemies);
    this.spawned = true;
  }
  onEnemyDefeated(){
    if(State.entities.enemies.length === 0){
      const next = this.currentWave + 1;
      setTimeout(()=>{ this.startWave(next); }, 900);
    }
  }
}
const waveManager = new WaveManager();

/* ---------------------
   Entity Updates & Collisions
   --------------------- */
function updateEntities(dt){
  // drones
  for (const drone of game.player.drones) {
    drone.update(dt);
  }

  // bullets
  for(let i = State.entities.bullets.length-1; i>=0; i--){
    const b = State.entities.bullets[i];
    b.update(dt);
    if(b.life <= 0){ State.entities.bullets.splice(i,1); continue; }
    if(b.owner === 'player'){
      for(let j = State.entities.enemies.length-1; j>=0; j--){
        const e = State.entities.enemies[j];
        const d = dist(b.pos.x,b.pos.y,e.pos.x,e.pos.y);
        if(d < e.radius + b.radius){
          const killed = e.takeDamage(b.damage);
          b.life = 0;
          if(killed){ State.entities.enemies.splice(j,1); waveManager.onEnemyDefeated(); }
          break;
        }
      }
    } else {
      const d = dist(b.pos.x,b.pos.y, game.player.pos.x, game.player.pos.y);
      if(d < b.radius + game.player.radius){
        game.player.takeDamage(b.damage);
        b.life = 0;
      }
    }
  }

  // enemies
  for(let i=State.entities.enemies.length-1;i>=0;i--){
    const e = State.entities.enemies[i];
    e.update(dt);
    // ramming damage if overlapping player
    const d = dist(e.pos.x,e.pos.y, game.player.pos.x, game.player.pos.y);
    if(d < e.radius + game.player.radius){
      // contact damage scaled by overlap
      const overlap = (e.radius + game.player.radius) - d;
      game.player.takeDamage(e.damage * dt * 0.05 * clamp(overlap, 0, 1));
    }
  }

  // particles
  for(let i=State.entities.particles.length-1;i>=0;i--){
    const p = State.entities.particles[i];
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
    p.vel.x *= 0.995; p.vel.y *= 0.995;
    if(p.life <= 0) State.entities.particles.splice(i,1);
  }

  // pickups aging
  for(let i=State.entities.pickups.length-1;i>=0;i--){
    const p = State.entities.pickups[i];
    p.t += dt;
    if(p.t > 25) State.entities.pickups.splice(i,1);
  }
}

/* ---------------------
   Procedural world generation (obstacles)
   --------------------- */
function generateObstacles(){
  State.entities.obstacles = [];
  const count = Math.floor(rand(6, 12));
  for(let i=0;i<count;i++){
    const r = rand(18, 56);
    let x = rand(r+20, W-r-20), y = rand(r+20, H-r-20);
    let tries = 0;
    while(State.entities.obstacles.some(o=>Math.hypot(o.x-x, o.y-y) < o.r + r + 30) && tries < 60){
      x = rand(r+20, W-r-20); y = rand(r+20, H-r-20); tries++;
    }
    State.entities.obstacles.push(new Obstacle(x,y,r));
  }
}

/* ---------------------
   Rendering
   --------------------- */
function clearScreen(ctx){
  ctx.fillStyle = '#031020'; ctx.fillRect(0,0,W,H);
  // improved background: more stars
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; 
  for(let i=0;i<100;i++){ 
    const x = (i*37 + Math.sin(i*0.1)*10) % W; 
    const y = (i*71 + Math.cos(i*0.2)*10) % H; 
    const size = rand(0.5,1.5);
    ctx.fillRect(x,y,size,size); 
  }
}
function drawUIOverlay(ctx){
  for(const pu of State.entities.pickups){
    ctx.save(); ctx.translate(pu.pos.x, pu.pos.y);
    let color, size=6;
    if(pu.type === 'gold'){
      ctx.fillStyle = '#ffd86b'; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00000080'; ctx.fillRect(-10,8,20,6);
      ctx.fillStyle = '#000000aa'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText(`+${pu.value}`, 0, 12);
    } else if(pu.type === 'hp'){
      color = '#7cff9b';
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0,0,size+2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+HP', 0, 3);
    } else if(pu.type === 'pu'){
      color = pu.puType === 'spread' ? '#ffd700' : '#00bfff';
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0,0,size,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00000060'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(pu.puType[0].toUpperCase(), 0, 3);
    }
    ctx.restore();
  }
}

/* ---------------------
   Game object & UI binding
   --------------------- */
const game = {
  player: new Player(),
  init: function(){
    State.entities.enemies = []; State.entities.bullets = []; State.entities.particles = []; State.entities.pickups = []; State.entities.obstacles = [];
    generateObstacles();
    this.player = new Player();
    this.player.pos = new Vec(W/2, H/2);
    this.player.applyUpgradeChanges();
    waveManager.startWave(1);
    this.bindUI();
    State.gold = State.gold || 0;
    UI.gold.textContent = State.gold;
  },
  bindUI: function(){
    UI.pauseBtn.onclick = ()=>{
      State.paused = !State.paused;
      UI.pauseBtn.textContent = State.paused ? 'Resume' : 'Pause';
      UI.statusMsg.textContent = State.paused ? 'Paused' : 'Running';
    };
    UI.restartBtn.onclick = ()=>{ resetGame(true); };
    UI.buyAllBtn.onclick = ()=>{ buyBestAffordableAttack(); };
    window.addEventListener('keydown', (e)=>{
      if(e.key === 'r' || e.key === 'R') resetGame(true);
      if(e.key === 'p' || e.key === 'P') UI.pauseBtn.click();
    });
    UI.saveToggle.addEventListener('change', ()=>{ if(UI.saveToggle.checked) saveState(); });
    UI.upgradePanel.innerHTML = '';
    const upgradesMeta = [
      {id:'attack', title:'Attack +', desc:'Increase damage by +5', costFn: SETTINGS.costs.attack, level: ()=>Upgrades.attack},
      {id:'fireRate', title:'Fire Rate +', desc:'+0.25 shots/sec', costFn: SETTINGS.costs.fireRate, level: ()=>Upgrades.fireRate},
      {id:'maxHP', title:'Max HP +', desc:'+20 MaxHP', costFn: SETTINGS.costs.maxHP, level: ()=>Upgrades.maxHP},
      {id:'armor', title:'Armor +', desc:'+2% damage reduction', costFn: SETTINGS.costs.armor, level: ()=>Upgrades.armor},
      {id:'speed', title:'Speed +', desc:'+10 px/s', costFn: SETTINGS.costs.speed, level: ()=>Upgrades.speed},
      {id:'drones', title:'Drones +', desc:'Add 1 auto-firing drone', costFn: SETTINGS.costs.drones, level: ()=>Upgrades.drones},
    ];
    upgradesMeta.forEach(u=>{
      const div = document.createElement('div');
      div.className = 'upgradeBtn';
      const left = document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column';
      const title = document.createElement('div'); title.style.fontWeight='700'; title.textContent = u.title;
      const desc = document.createElement('div'); desc.className='small'; desc.textContent = u.desc;
      left.appendChild(title); left.appendChild(desc);
      const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.alignItems='flex-end';
      const cost = document.createElement('div'); cost.className='small'; cost.id = `cost_${u.id}`;
      const btn = document.createElement('button'); btn.className='btn'; btn.style.marginTop='6px';
      btn.textContent = 'Buy';
      btn.onclick = ()=>{
        const lvl = u.level();
        const c = u.costFn(lvl);
        if(State.gold >= c){
          State.gold -= c;
          Upgrades[u.id] = (Upgrades[u.id] || 0) + 1;
          logEvent(`${u.title} upgraded to level ${Upgrades[u.id]}`);
          game.player.applyUpgradeChanges();
          UI.gold.textContent = State.gold;
          saveState();
          updateUpgradePanel();
        }
      };
      right.appendChild(cost); right.appendChild(btn);
      div.appendChild(left); div.appendChild(right);
      UI.upgradePanel.appendChild(div);
    });
    updateUpgradePanel();
  }
};

function updateUpgradePanel(){
  const list = [
    {id:'attack', cost:SETTINGS.costs.attack(Upgrades.attack || 0)},
    {id:'fireRate', cost:SETTINGS.costs.fireRate(Upgrades.fireRate || 0)},
    {id:'maxHP', cost:SETTINGS.costs.maxHP(Upgrades.maxHP || 0)},
    {id:'armor', cost:SETTINGS.costs.armor(Upgrades.armor || 0)},
    {id:'speed', cost:SETTINGS.costs.speed(Upgrades.speed || 0)},
    {id:'drones', cost:SETTINGS.costs.drones(Upgrades.drones || 0)}
  ];
  list.forEach(u=>{
    const el = document.getElementById(`cost_${u.id}`);
    if(el) el.textContent = `Cost: ${u.cost}  (Lvl ${Upgrades[u.id] || 0})`;
  });
  UI.statAttack.textContent = Math.round(game.player.attack);
  UI.statFireRate.textContent = (game.player.fireRate).toFixed(2);
  UI.statArmor.textContent = Math.round(game.player.armorPct * 100) + '%';
  UI.statSpeed.textContent = Math.round(game.player.speed);
  UI.gold.textContent = State.gold;
  const buttons = UI.upgradePanel.querySelectorAll('button.btn');
  buttons.forEach((b, idx)=>{
    const item = list[idx];
    b.disabled = State.gold < item.cost;
  });
}
function buyBestAffordableAttack(){
  const cost = SETTINGS.costs.attack(Upgrades.attack || 0);
  if(State.gold >= cost){
    State.gold -= cost;
    Upgrades.attack = (Upgrades.attack || 0) + 1;
    game.player.applyUpgradeChanges();
    logEvent(`Attack upgraded to level ${Upgrades.attack}`);
    saveState();
    updateUpgradePanel();
  } else {
    logEvent('Not enough gold to auto-buy Attack');
  }
}

/* ---------------------
   Reset / Init
   --------------------- */
function resetGame(fullReset=false){
  if(fullReset){
    State.entities.enemies = []; State.entities.bullets = []; State.entities.particles = []; State.entities.pickups = []; State.entities.obstacles = [];
    State.gold = 0;
    Upgrades = {...defaultUpgradeState};
    saveState();
  }
  State.paused = false; UI.pauseBtn.textContent = 'Pause'; UI.statusMsg.textContent = 'Running';
  State.wave = 1; State.time = 0;
  game.init();
  updateUpgradePanel();
  logEvent('Game reset');
}

/* load save and init */
loadSave();
game.init();

/* ---------------------
   Main Loop
   --------------------- */
let then = performance.now();
function frame(now){
  resizeCanvasToDisplay();
  const dt = Math.min((now - then) / 1000, 0.05);
  then = now;
  if(!State.paused){
    State.time += dt;
    game.player.update(dt);
    updateEntities(dt);
  }
  render();
  // update UI text
  UI.hpText.textContent = `${Math.round(game.player.hp)} / ${Math.round(game.player.maxHP)}`;
  UI.hpBar.style.width = clamp(game.player.hp / game.player.maxHP * 100, 0, 100) + '%';
  UI.gold.textContent = State.gold;
  UI.statAttack.textContent = Math.round(game.player.attack);
  UI.statFireRate.textContent = (game.player.fireRate).toFixed(2);
  UI.statArmor.textContent = Math.round(game.player.armorPct * 100) + '%';
  UI.statSpeed.textContent = Math.round(game.player.speed);
  updateUpgradePanel();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function render(){
  clearScreen(ctx);
  for(const ob of State.entities.obstacles) ob.draw(ctx);
  drawUIOverlay(ctx);
  for(const e of State.entities.enemies) e.draw(ctx);
  for(const b of State.entities.bullets) b.draw(ctx);
  for(const p of State.entities.particles){ ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.pos.x,p.pos.y,p.size,p.size,0,0,Math.PI*2); ctx.fill(); }
  for (const drone of game.player.drones) drone.draw(ctx);
  game.player.draw(ctx);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(`Wave ${waveManager.currentWave}`, W/2, 26);
}

/* spawn ticker ensures continuous waves */
(function spawnTicker(){
  if(!State.paused){
    if(State.entities.enemies.length === 0){
      waveManager.startWave(waveManager.currentWave !== undefined ? waveManager.currentWave : 1);
    }
  }
  setTimeout(spawnTicker, 1000);
})();

/* ---------------------
   Mouse / touch repositioning
   --------------------- */
let isDragging = false;
canvas.addEventListener('mousedown', ()=>{ isDragging = true; });
canvas.addEventListener('mouseup', ()=>{ isDragging=false; });
canvas.addEventListener('mousemove', (e)=>{
  if(isDragging){
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    game.player.pos.x = clamp(x, 20, W-20);
    game.player.pos.y = clamp(y, 20, H-20);
  }
});

/* ---------------------
   Utility intervals: cap arrays & save periodically
   --------------------- */
setInterval(()=> {
  if(State.entities.bullets.length > SETTINGS.maxBullets) State.entities.bullets.splice(0, State.entities.bullets.length - SETTINGS.maxBullets);
  if(State.entities.particles.length > SETTINGS.maxParticles) State.entities.particles.splice(0, State.entities.particles.length - SETTINGS.maxParticles);
  saveState();
}, 3000);
