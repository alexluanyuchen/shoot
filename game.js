(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);
const ui={score:$("score"),wave:$("wave"),kills:$("kills"),hpBar:$("hpBar"),shieldBar:$("shieldBar"),hpText:$("hpText"),shieldText:$("shieldText"),weaponName:$("weaponName"),weaponHint:$("weaponHint"),enemyCount:$("enemyCount"),start:$("startScreen"),pause:$("pauseScreen"),upgrade:$("upgradeScreen"),over:$("gameOverScreen"),choices:$("upgradeChoices")};
const TAU=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
let W=900,H=600,dpr=1,last=0,raf=0,running=false,paused=false,upgradeOpen=false;
const world={time:0,score:0,kills:0,wave:1,spawn:0,shake:0,stars:[],particles:[],bullets:[],enemyShots:[],enemies:[],pickups:[],obstacles:[],rings:[],map:0};
const player={x:450,y:300,r:13,hp:100,shield:100,speed:235,angle:0,fire:0,dash:0,dashCd:0,invuln:0,weapon:"pulse",damage:1,fireRate:1,moveX:0,moveY:0};
const weapons={
 pulse:{name:"脉冲星",hint:"快速能量弹 · 单发",cool:.19,color:"#63eaff",damage:13,speed:610},
 fan:{name:"星尘扇",hint:"多枚能量弹 · 扇形",cool:.58,color:"#b78cff",damage:8,speed:500},
 orb:{name:"引力球",hint:"缓慢重型能量球",cool:.9,color:"#ffb86b",damage:42,speed:350},
 beam:{name:"光棱线",hint:"高速贯穿光束",cool:.42,color:"#83ffbd",damage:20,speed:950},
 nova:{name:"新星环",hint:"近距离环形脉冲",cool:1.05,color:"#ff80cb",damage:26,speed:420}
};
const enemyTypes=[
 {name:"漂游体",r:11,hp:24,speed:88,color:"#ff668e",score:10,kind:"chase"},
 {name:"闪跃体",r:8,hp:17,speed:155,color:"#ffb36b",score:14,kind:"dash"},
 {name:"棱镜体",r:14,hp:55,speed:55,color:"#b18cff",score:24,kind:"shoot"},
 {name:"重核体",r:21,hp:135,speed:34,color:"#ff6d56",score:40,kind:"tank"},
 {name:"回响体",r:12,hp:38,speed:75,color:"#5bdbff",score:18,kind:"orbit"}
];
const upgrades=[
 {name:"核心增幅",desc:"能量输出提高 20%。",apply:()=>player.damage*=1.2},
 {name:"冷却优化",desc:"模块充能速度提高 15%。",apply:()=>player.fireRate*=1.15},
 {name:"护盾扩容",desc:"恢复并增加护盾容量。",apply:()=>player.shield=Math.min(100,player.shield+45)},
 {name:"机动强化",desc:"移动速度提高 10%。",apply:()=>player.speed*=1.1},
 {name:"核心修复",desc:"恢复 35 点能量核心。",apply:()=>player.hp=Math.min(100,player.hp+35)},
 {name:"相位稳定",desc:"冲刺冷却缩短。",apply:()=>player.dashCd=Math.max(.5,player.dashCd*.75)}
];
let keys={},mouse={x:W/2,y:H/2,down:false},touch={x:0,y:0,fire:false},stick={active:false,id:null,cx:0,cy:0};
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);W=Math.max(320,r.width);H=Math.max(240,r.height);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!running){player.x=W/2;player.y=H/2;}makeStars();}
function makeStars(){world.stars=Array.from({length:Math.floor(W*H/8500)},()=>({x:Math.random()*W,y:Math.random()*H,s:rand(.5,1.8),a:rand(.2,.8),p:rand(0,TAU)}));}
function reset(){Object.assign(world,{time:0,score:0,kills:0,wave:1,spawn:0,shake:0,particles:[],bullets:[],enemyShots:[],enemies:[],pickups:[],rings:[],map:0});Object.assign(player,{x:W/2,y:H/2,hp:100,shield:100,speed:235,angle:0,fire:0,dash:0,dashCd:0,invuln:0,weapon:"pulse",damage:1,fireRate:1});makeObstacles();updateUI();}
function makeObstacles(){world.obstacles=[];const count=Math.max(7,Math.floor(W*H/47000));for(let i=0;i<count;i++){const x=rand(65,W-65),y=rand(70,H-70);if(Math.hypot(x-W/2,y-H/2)>100)world.obstacles.push({x,y,r:rand(18,36),phase:rand(0,TAU)});}}
function setWeapon(id){if(!weapons[id])return;player.weapon=id;document.querySelectorAll(".weapon").forEach(b=>b.classList.toggle("active",b.dataset.weapon===id));updateUI();}
function updateUI(){const w=weapons[player.weapon];ui.score.textContent=String(world.score).padStart(6,"0");ui.wave.textContent=String(world.wave).padStart(2,"0");ui.kills.textContent=world.kills;ui.hpBar.style.width=player.hp+"%";ui.shieldBar.style.width=player.shield+"%";ui.hpText.textContent=Math.ceil(player.hp)+"%";ui.shieldText.textContent=Math.ceil(player.shield)+"%";ui.weaponName.textContent=w.name;ui.weaponHint.textContent=w.hint;ui.enemyCount.textContent=world.enemies.length;}
function spawnEnemy(){const edge=Math.floor(Math.random()*4);let x=edge===0?-25:edge===1?W+25:rand(0,W),y=edge===2?-25:edge===3?H+25:rand(0,H);const difficulty=Math.min(1.8,1+world.wave*.075);let pool=enemyTypes.slice(0,Math.min(enemyTypes.length,2+Math.floor(world.wave/2)));let t=pool[Math.floor(Math.random()*pool.length)];world.enemies.push({x,y,r:t.r,hp:t.hp*difficulty,maxHp:t.hp*difficulty,speed:t.speed*(1+world.wave*.018),color:t.color,score:t.score,kind:t.kind,phase:rand(0,TAU),fire:rand(1,3),flash:0});}
function burst(x,y,color,n=12,power=150){for(let i=0;i<n;i++){let a=rand(0,TAU),s=rand(power*.25,power);world.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),max:.7,size:rand(1.5,4),color});}}
function addRing(x,y,color,r=20){world.rings.push({x,y,r,max:r+65,life:.35,maxLife:.35,color});}
function shoot(){const w=weapons[player.weapon];if(player.fire>0)return;player.fire=w.cool/player.fireRate;const a=player.angle;const spawn=(ang,damage,speed,r=4)=>world.bullets.push({x:player.x+Math.cos(ang)*18,y:player.y+Math.sin(ang)*18,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,life:1.35,damage:damage*player.damage,r,color:w.color,beam:player.weapon==="beam"});
if(player.weapon==="pulse")spawn(a,w.damage,w.speed,4);
if(player.weapon==="fan")for(let i=-2;i<=2;i++)spawn(a+i*.19,w.damage,w.speed,3.5);
if(player.weapon==="orb")spawn(a,w.damage,w.speed,9);
if(player.weapon==="beam")spawn(a,w.damage,w.speed,3);
if(player.weapon==="nova"){addRing(player.x,player.y,w.color,28);for(let i=0;i<12;i++)spawn(i*TAU/12,w.damage,w.speed,5);}
burst(player.x+Math.cos(a)*17,player.y+Math.sin(a)*17,w.color,3,45);}
function hurtEnemy(e,dmg){e.hp-=dmg;e.flash=.08;if(e.hp<=0){world.kills++;world.score+=e.score;burst(e.x,e.y,e.color,e.kind==="tank"?26:13,e.kind==="tank"?220:145);if(Math.random()<.12)world.pickups.push({x:e.x,y:e.y,r:7,type:Math.random()<.55?"shield":"heal",life:9});return true;}return false;}
function update(dt){world.time+=dt;world.shake=Math.max(0,world.shake-dt*22);player.fire=Math.max(0,player.fire-dt);player.dashCd=Math.max(0,player.dashCd-dt);player.dash=Math.max(0,player.dash-dt);player.invuln=Math.max(0,player.invuln-dt);
let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+touch.x,my=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+touch.y;const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;}player.moveX=mx;player.moveY=my;
if(player.dash>0){player.x+=mx*player.speed*3.1*dt;player.y+=my*player.speed*3.1*dt;}else{player.x+=mx*player.speed*dt;player.y+=my*player.speed*dt;}
player.x=clamp(player.x,player.r+4,W-player.r-4);player.y=clamp(player.y,player.r+4,H-player.r-4);
player.angle=Math.atan2(mouse.y-player.y,mouse.x-player.x);
if((mouse.down||touch.fire)&&!upgradeOpen)shoot();
for(const o of world.obstacles){const dx=player.x-o.x,dy=player.y-o.y,d=Math.hypot(dx,dy),min=player.r+o.r*.72;if(d<min&&d>0){player.x+=dx/d*(min-d);player.y+=dy/d*(min-d);}}
world.spawn-=dt;if(world.spawn<=0&&world.enemies.length<Math.min(34,7+world.wave*2)){spawnEnemy();world.spawn=Math.max(.24,1.05-world.wave*.035);}
if(world.kills>=world.wave*9){world.wave++;world.spawn=.1;world.score+=100;showUpgrade();}
for(let i=world.enemies.length-1;i>=0;i--){const e=world.enemies[i];e.flash=Math.max(0,e.flash-dt);e.phase+=dt*2;const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy)||1;let vx=dx/d,vy=dy/d;if(e.kind==="orbit"){const a=Math.atan2(dy,dx)+Math.sin(e.phase)*.75;vx=Math.cos(a);vy=Math.sin(a);}if(e.kind==="dash"){const boost=Math.sin(e.phase*2)>0.72?1.8:1;e.x+=vx*e.speed*boost*dt;e.y+=vy*e.speed*boost*dt;}else{e.x+=vx*e.speed*dt;e.y+=vy*e.speed*dt;}
if(e.kind==="shoot"){e.fire-=dt;if(e.fire<=0&&d<390){world.enemyShots.push({x:e.x,y:e.y,vx:vx*190,vy:vy*190,r:5,life:3,color:e.color});e.fire=2.2;}}
if(d<e.r+player.r&&player.invuln<=0){damagePlayer(e.kind==="tank"?18:10);e.x-=vx*18;e.y-=vy*18;}
}
for(let i=world.bullets.length-1;i>=0;i--){const b=world.bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let remove=b.life<=0||b.x<-30||b.x>W+30||b.y<-30||b.y>H+30;for(let j=world.enemies.length-1;j>=0&&!remove;j--){const e=world.enemies[j];if(Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){if(hurtEnemy(e,b.damage)){world.enemies.splice(j,1);}if(!b.beam)remove=true;}}if(remove)world.bullets.splice(i,1);}
for(let i=world.enemyShots.length-1;i>=0;i--){const b=world.enemyShots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r&&player.invuln<=0){damagePlayer(9);world.enemyShots.splice(i,1);continue;}if(b.life<=0||b.x<0||b.x>W||b.y<0||b.y>H)world.enemyShots.splice(i,1);}
for(let i=world.pickups.length-1;i>=0;i--){const p=world.pickups[i];p.life-=dt;if(Math.hypot(p.x-player.x,p.y-player.y)<p.r+player.r){if(p.type==="heal")player.hp=Math.min(100,player.hp+18);else player.shield=Math.min(100,player.shield+24);burst(p.x,p.y,p.type==="heal"?"#6cffb0":"#8d9bff",10);world.pickups.splice(i,1);}else if(p.life<=0)world.pickups.splice(i,1);}
for(let i=world.particles.length-1;i>=0;i--){const p=world.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.04,dt);p.vy*=Math.pow(.04,dt);p.life-=dt;if(p.life<=0)world.particles.splice(i,1);}
for(let i=world.rings.length-1;i>=0;i--){const r=world.rings[i];r.life-=dt;r.r+=(r.max-r.r)*dt*9;if(r.life<=0)world.rings.splice(i,1);}
updateUI();}
function damagePlayer(amount){if(player.invuln>0)return;let rest=amount;if(player.shield>0){let take=Math.min(player.shield,rest);player.shield-=take;rest-=take;}player.hp=Math.max(0,player.hp-rest);player.invuln=.48;world.shake=7;burst(player.x,player.y,"#ff759a",8,110);if(player.hp<=0)gameOver();}
function showUpgrade(){if(upgradeOpen||!running)return;upgradeOpen=true;paused=true;ui.choices.innerHTML="";const choices=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);for(const u of choices){const b=document.createElement("button");b.className="choice";b.innerHTML=`<b>${u.name}</b><small>${u.desc}</small>`;b.addEventListener("click",()=>{u.apply();upgradeOpen=false;paused=false;ui.upgrade.classList.add("hidden");last=performance.now();});ui.choices.appendChild(b);}ui.upgrade.classList.remove("hidden");}
function gameOver(){running=false;paused=true;$("finalScore").textContent=world.score;ui.over.classList.remove("hidden");}
function draw(){ctx.save();if(world.shake)ctx.translate(rand(-world.shake,world.shake),rand(-world.shake,world.shake));ctx.fillStyle="#080f1d";ctx.fillRect(0,0,W,H);drawBackground();drawObstacles();drawPickups();drawRings();drawBullets();drawEnemies();drawPlayer();drawParticles();ctx.restore();}
function drawBackground(){const g=ctx.createRadialGradient(W*.5,H*.48,20,W*.5,H*.48,Math.max(W,H)*.72);g.addColorStop(0,"#142642");g.addColorStop(.55,"#0b1728");g.addColorStop(1,"#070d19");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.strokeStyle="rgba(94,160,210,.075)";ctx.lineWidth=1;const step=48,ox=(world.time*7)%step,oy=(world.time*4)%step;for(let x=-step;x<W+step;x+=step){ctx.beginPath();ctx.moveTo(x+ox,0);ctx.lineTo(x+ox,H);ctx.stroke();}for(let y=-step;y<H+step;y+=step){ctx.beginPath();ctx.moveTo(0,y+oy);ctx.lineTo(W,y+oy);ctx.stroke();}for(const s of world.stars){let a=s.a*(.65+.35*Math.sin(world.time*1.8+s.p));ctx.fillStyle=`rgba(146,210,255,${a})`;ctx.fillRect(s.x,s.y,s.s,s.s);}}
function drawObstacles(){for(const o of world.obstacles){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.phase+world.time*.08);ctx.fillStyle="#14283b";ctx.strokeStyle="#5eb8d955";ctx.lineWidth=2;ctx.shadowColor="#38bce8";ctx.shadowBlur=15;ctx.beginPath();for(let i=0;i<7;i++){let a=i*TAU/7,r=o.r*(i%2?.86:1);let x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}
function drawPlayer(){ctx.save();ctx.translate(player.x,player.y);ctx.rotate(player.angle);ctx.shadowColor="#5deaff";ctx.shadowBlur=22;ctx.fillStyle=player.invuln>0&&Math.floor(world.time*18)%2?"#ffffff":"#76edff";ctx.strokeStyle="#e2fbff";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(19,0);ctx.lineTo(-11,-11);ctx.lineTo(-6,0);ctx.lineTo(-11,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle="#1c5c7a";ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();ctx.restore();if(player.shield>0){ctx.strokeStyle=`rgba(113,151,255,${.18+player.shield/230})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(player.x,player.y,player.r+8,0,TAU);ctx.stroke();}}
function drawEnemies(){for(const e of world.enemies){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.phase*.18);ctx.shadowColor=e.color;ctx.shadowBlur=16;ctx.fillStyle=e.flash>0?"#fff":e.color;ctx.strokeStyle="#ffffff99";ctx.lineWidth=1.2;ctx.beginPath();if(e.kind==="tank"){ctx.rect(-e.r*.8,-e.r*.8,e.r*1.6,e.r*1.6);}else if(e.kind==="shoot"){for(let i=0;i<6;i++){let a=i*TAU/6,r=e.r;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();}else{ctx.arc(0,0,e.r,0,TAU);}ctx.fill();ctx.stroke();ctx.fillStyle="#10182b";ctx.beginPath();ctx.arc(0,0,e.r*.35,0,TAU);ctx.fill();ctx.restore();if(e.hp<e.maxHp){ctx.fillStyle="#26364b";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,3);ctx.fillStyle=e.color;ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*(e.hp/e.maxHp),3);}}}
function drawBullets(){for(const b of world.bullets){ctx.save();ctx.strokeStyle=b.color;ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=15;ctx.lineWidth=b.r*1.4;ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.restore();}for(const b of world.enemyShots){ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();ctx.shadowBlur=0;}}
function drawPickups(){for(const p of world.pickups){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(world.time*2);ctx.strokeStyle=p.type==="heal"?"#69ffb1":"#a4a0ff";ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=15;ctx.lineWidth=2;ctx.strokeRect(-6,-6,12,12);ctx.restore();}}
function drawRings(){for(const r of world.rings){ctx.globalAlpha=r.life/r.maxLife;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=18;ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke();ctx.globalAlpha=1;ctx.shadowBlur=0;}}
function drawParticles(){for(const p of world.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}ctx.globalAlpha=1;ctx.shadowBlur=0;}
function loop(t){raf=requestAnimationFrame(loop);if(!running||paused){draw();return;}let dt=Math.min(.033,(t-last)/1000||0);last=t;update(dt);draw();}
function start(){reset();running=true;paused=false;ui.start.classList.add("hidden");ui.over.classList.add("hidden");ui.pause.classList.add("hidden");ui.upgrade.classList.add("hidden");last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);}
function pause(){if(!running||upgradeOpen)return;paused=true;ui.pause.classList.remove("hidden");}
function resume(){if(!running)return;paused=false;ui.pause.classList.add("hidden");last=performance.now();}
window.addEventListener("resize",resize);
window.addEventListener("keydown",e=>{keys[e.code]=true;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();if(e.code==="Space"&&running&&player.dashCd<=0&&!paused){player.dash=.17;player.dashCd=1.7;player.invuln=.22;}if(e.code==="Escape")paused?resume():pause();if(e.code>="Digit1"&&e.code<="Digit5")setWeapon(["pulse","fan","orb","beam","nova"][Number(e.code.slice(5))-1]);});
window.addEventListener("keyup",e=>keys[e.code]=false);
canvas.addEventListener("pointermove",e=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"){mouse.down=true;canvas.setPointerCapture(e.pointerId);}});
window.addEventListener("pointerup",()=>mouse.down=false);
document.querySelectorAll(".weapon").forEach(b=>b.addEventListener("click",()=>setWeapon(b.dataset.weapon)));
$("startBtn").addEventListener("click",start);$("restartBtn").addEventListener("click",start);$("pauseBtn").addEventListener("click",pause);$("resumeBtn").addEventListener("click",resume);
const zone=$("stickZone"),knob=$("stickKnob");
zone.addEventListener("pointerdown",e=>{stick.active=true;stick.id=e.pointerId;const r=zone.getBoundingClientRect();stick.cx=r.left+r.width/2;stick.cy=r.top+r.height/2;zone.setPointerCapture(e.pointerId);moveStick(e);});
zone.addEventListener("pointermove",e=>{if(stick.active&&e.pointerId===stick.id)moveStick(e);});
function moveStick(e){let dx=e.clientX-stick.cx,dy=e.clientY-stick.cy,l=Math.hypot(dx,dy),m=35;if(l>m){dx=dx/l*m;dy=dy/l*m;}touch.x=dx/m;touch.y=dy/m;knob.style.transform=`translate(${dx}px,${dy}px)`;}
function releaseStick(){stick.active=false;touch.x=0;touch.y=0;knob.style.transform="translate(0,0)";}
zone.addEventListener("pointerup",releaseStick);zone.addEventListener("pointercancel",releaseStick);
const fire=$("fireTouch");fire.addEventListener("pointerdown",e=>{touch.fire=true;fire.setPointerCapture(e.pointerId);});fire.addEventListener("pointerup",()=>touch.fire=false);fire.addEventListener("pointercancel",()=>touch.fire=false);
$("dashTouch").addEventListener("pointerdown",()=>{if(player.dashCd<=0){player.dash=.17;player.dashCd=1.7;player.invuln=.22;}});
resize();reset();draw();
})();