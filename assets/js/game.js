/* Flood Defense: a small tower-defense style water damage game */
(function(){
'use strict';
var W=800,H=480;
var PATH=[[-20,90],[250,90],[250,250],[110,250],[110,400],[500,400],[500,170],[640,170],[640,330]];
var HOUSE={x:650,y:285,w:120,h:110};
var TOOLS={
 pump:{name:'Sump pump',cost:26,range:95,rate:1.0,dmg:2,hits:3,life:12,color:'#0891b2',letter:'P'},
 sandbag:{name:'Sandbag barrier',cost:22,range:72,slow:0.55,duration:14,color:'#b08968',letter:'S'},
 sealant:{name:'Leak sealant',cost:10,range:78,rate:0.5,dmg:3,hits:1,life:8,color:'#f59e0b',letter:'L'},
 dehumid:{name:'Dehumidifier',cost:16,range:88,slow:0.7,dps:0.7,duration:16,color:'#7c3aed',letter:'D'}
};
var KEYS={'1':'pump','2':'sandbag','3':'sealant','4':'dehumid'};
var LAST_WAVE=8;
var seg=[],total=0,i;
for(i=0;i<PATH.length-1;i++){var a=PATH[i],b=PATH[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);seg.push(l);total+=l;}
function posAt(d){var k=0;while(k<seg.length-1&&d>seg[k]){d-=seg[k];k++;}var a=PATH[k],b=PATH[k+1],t=Math.min(1,d/seg[k]);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function distToPath(x,y){var best=1e9;for(var k=0;k<PATH.length-1;k++){var a=PATH[k],b=PATH[k+1],dx=b[0]-a[0],dy=b[1]-a[1],t=((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy);t=Math.max(0,Math.min(1,t));var px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(x-px,y-py);if(d<best)best=d;}return best;}

function init(root){
 if(!root||root.dataset.ready) return; root.dataset.ready='1';
 var canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
 var q=function(k){return root.querySelector('[data-k="'+k+'"]');};
 var el={home:q('home'),stopped:q('stopped'),wave:q('wave'),score:q('score'),best:q('best'),combo:q('combo'),points:q('points'),msg:q('msg'),over:q('over'),overTitle:q('overTitle'),overText:q('overText')};
 var toolBtns=[].slice.call(root.querySelectorAll('.wtool'));
 var pauseBtn=root.querySelector('[data-act="pause"]');
 var S,raf=0,last=0,hover=null,selected=null,best=0;
 try{best=parseInt(localStorage.getItem('wdrpBest')||'0',10)||0;}catch(e){}
 function reset(){
  S={home:3,stopped:0,wave:0,score:0,points:60,combo:0,comboT:0,enemies:[],towers:[],parts:[],queue:0,spawnT:0,gap:0,waveT:2.5,running:true,paused:false,over:false,waveActive:false};
  el.over.hidden=true; pauseBtn.textContent='Pause'; say('Protect the house. Choose a tool, then place it beside the water\u2019s path.'); hud();
 }
 function say(t){el.msg.textContent=t;}
 function hud(){
  el.home.textContent=S.home+' / 3'; el.stopped.textContent=S.stopped; el.wave.textContent=Math.max(1,S.wave);
  el.score.textContent=S.score; el.best.textContent=Math.max(best,S.score); el.combo.textContent=S.combo+'\u00d7'; el.points.textContent=Math.floor(S.points);
  toolBtns.forEach(function(b){var t=TOOLS[b.dataset.tool];b.classList.toggle('off',S.points<t.cost);b.classList.toggle('sel',selected===b.dataset.tool);});
 }
 function valid(x,y){
  if(x<20||x>W-20||y<20||y>H-20) return false;
  if(distToPath(x,y)<36) return false;
  if(x>HOUSE.x-26&&x<HOUSE.x+HOUSE.w+26&&y>HOUSE.y-40&&y<HOUSE.y+HOUSE.h+26) return false;
  for(var k=0;k<S.towers.length;k++){if(Math.hypot(S.towers[k].x-x,S.towers[k].y-y)<36) return false;}
  return true;
 }
 function place(x,y){
  if(S.over||!S.running) return;
  if(!selected){say('Choose a tool first.');return;}
  var t=TOOLS[selected];
  if(S.points<t.cost){say('Not enough points yet. Stop more water to earn them.');return;}
  if(!valid(x,y)){say('Too close to the path, the house or another tool.');return;}
  S.points-=t.cost; S.towers.push({x:x,y:y,type:selected,cd:0,life:t.life||0,time:t.duration||0});
  say(t.name+' placed.'); hud();
 }
 function startWave(){
  S.wave++; S.queue=6+S.wave*3; S.gap=Math.max(0.5,1.1-S.wave*0.07); S.spawnT=0.6; S.waveActive=true; say('Wave '+S.wave+' incoming. The water is rising!'); hud();
 }
 function spawn(){
  var w=S.wave,r=Math.random(),kind='normal',hp=3+w*0.9,sp=38+w*2.2;
  if(w>=4&&r<0.15){kind='tank';hp*=2.4;sp*=0.72;}else if(w>=3&&r<0.4){kind='fast';hp*=0.6;sp*=1.6;}
  S.enemies.push({d:0,hp:hp,max:hp,sp:sp,kind:kind,slow:0});
 }
 function kill(e){
  S.combo=Math.min(5,S.combo+1); S.comboT=2.2; S.score+=100*S.combo; S.points+=8+(e.kind==='tank'?6:0); S.stopped++;
  var p=posAt(e.d); for(var k=0;k<8;k++) S.parts.push({x:p[0],y:p[1],vx:(Math.random()-.5)*120,vy:(Math.random()-.5)*120,t:.5});
 }
 function end(win){
  S.over=true; var sc=S.score;
  if(sc>best){best=sc;try{localStorage.setItem('wdrpBest',String(sc));}catch(e){}}
  el.overTitle.textContent=win?'You saved the house!':'The house flooded';
  el.overText.textContent=(win?'Great defense. ':'')+'Final score '+sc+', water stopped '+S.stopped+'. In real life, fast water removal and drying protect a home just like this.';
  el.over.hidden=false; hud();
 }
 function update(dt){
  S.comboT-=dt; if(S.comboT<=0&&S.combo){S.combo=0;}
  if(!S.waveActive){S.waveT-=dt; if(S.waveT<=0){ if(S.wave>=LAST_WAVE){end(true);return;} startWave(); }}
  else{
   S.spawnT-=dt; if(S.queue>0&&S.spawnT<=0){spawn();S.queue--;S.spawnT=S.gap;}
   if(S.queue===0&&S.enemies.length===0){S.waveActive=false;S.waveT=3;S.points+=20;say('Wave '+S.wave+' cleared! +20 points.');}
  }
  S.enemies.forEach(function(e){e.slow=0;});
  S.towers.forEach(function(t){
   var T=TOOLS[t.type],inr=[];
   S.enemies.forEach(function(e){var p=posAt(e.d);if(Math.hypot(p[0]-t.x,p[1]-t.y)<=T.range)inr.push(e);});
   if(T.slow){inr.forEach(function(e){e.slow=Math.max(e.slow,T.slow);if(T.dps)e.hp-=T.dps*dt;});t.time-=dt;}
   else{t.cd-=dt;if(t.cd<=0&&inr.length){inr.sort(function(a,b){return b.d-a.d;});for(var k=0;k<Math.min(T.hits,inr.length);k++)inr[k].hp-=T.dmg;t.cd=T.rate;t.life--;t.flash=.12;}}
   if(t.flash)t.flash-=dt;
  });
  S.towers=S.towers.filter(function(t){var T=TOOLS[t.type];return T.slow?t.time>0:t.life>0;});
  var alive=[];
  S.enemies.forEach(function(e){
   if(e.hp<=0){kill(e);return;}
   e.d+=e.sp*(1-e.slow)*dt;
   if(e.d>=total){S.home--;S.combo=0;say('Water reached the house! '+S.home+' left.');if(S.home<=0)end(false);return;}
   alive.push(e);
  });
  S.enemies=alive;
  S.parts.forEach(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;});S.parts=S.parts.filter(function(p){return p.t>0;});
  hud();
 }
 function draw(){
  var g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#d7ecc9');g.addColorStop(1,'#b6dba9');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#6aa6c8';ctx.lineWidth=40;ctx.beginPath();PATH.forEach(function(p,k){k?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});ctx.stroke();
  ctx.strokeStyle='#a9d6ee';ctx.lineWidth=28;ctx.stroke();
  // house
  ctx.fillStyle='#f3e2bd';ctx.fillRect(HOUSE.x,HOUSE.y+30,HOUSE.w,HOUSE.h-30);
  ctx.fillStyle='#b8473f';ctx.beginPath();ctx.moveTo(HOUSE.x-12,HOUSE.y+34);ctx.lineTo(HOUSE.x+HOUSE.w/2,HOUSE.y-6);ctx.lineTo(HOUSE.x+HOUSE.w+12,HOUSE.y+34);ctx.closePath();ctx.fill();
  ctx.fillStyle='#7a4a2b';ctx.fillRect(HOUSE.x+HOUSE.w/2-12,HOUSE.y+HOUSE.h-44,24,44);
  ctx.fillStyle='#9fd0e8';ctx.fillRect(HOUSE.x+14,HOUSE.y+50,26,26);ctx.fillRect(HOUSE.x+HOUSE.w-40,HOUSE.y+50,26,26);
  ctx.fillStyle='#e0b13a';for(var h=0;h<S.home;h++){ctx.beginPath();ctx.arc(HOUSE.x+22+h*20,HOUSE.y-22,7,0,6.28);ctx.fill();}
  // towers
  S.towers.forEach(function(t){var T=TOOLS[t.type];
   ctx.globalAlpha=.16;ctx.fillStyle=T.color;ctx.beginPath();ctx.arc(t.x,t.y,T.range,0,6.28);ctx.fill();ctx.globalAlpha=1;
   ctx.fillStyle=T.color;ctx.strokeStyle=t.flash>0?'#fff':'#06293b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(t.x,t.y,16,0,6.28);ctx.fill();ctx.stroke();
   ctx.fillStyle='#fff';ctx.font='bold 15px system-ui,Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(T.letter,t.x,t.y+1);
  });
  // enemies
  S.enemies.forEach(function(e){var p=posAt(e.d),r=e.kind==='tank'?13:e.kind==='fast'?8:10;
   ctx.fillStyle=e.kind==='tank'?'#1d4e89':e.kind==='fast'?'#38bdf8':'#2f8fd8';ctx.beginPath();ctx.arc(p[0],p[1],r,0,6.28);ctx.fill();
   ctx.beginPath();ctx.moveTo(p[0]-r*.6,p[1]-r*.7);ctx.lineTo(p[0],p[1]-r*1.7);ctx.lineTo(p[0]+r*.6,p[1]-r*.7);ctx.closePath();ctx.fill();
   ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(p[0]-r*.35,p[1]-r*.25,r*.28,0,6.28);ctx.fill();
   ctx.fillStyle='#06293b';ctx.fillRect(p[0]-12,p[1]+r+4,24,4);ctx.fillStyle='#4ade80';ctx.fillRect(p[0]-12,p[1]+r+4,24*Math.max(0,e.hp/e.max),4);
  });
  S.parts.forEach(function(p){ctx.globalAlpha=Math.max(0,p.t*2);ctx.fillStyle='#7cc4ee';ctx.beginPath();ctx.arc(p.x,p.y,3,0,6.28);ctx.fill();ctx.globalAlpha=1;});
  // placement ghost
  if(hover&&selected&&!S.over){var T=TOOLS[selected],ok=valid(hover.x,hover.y)&&S.points>=T.cost;
   ctx.globalAlpha=.25;ctx.fillStyle=ok?'#22c55e':'#ef4444';ctx.beginPath();ctx.arc(hover.x,hover.y,T.range,0,6.28);ctx.fill();ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(hover.x,hover.y,16,0,6.28);ctx.fill();ctx.globalAlpha=1;}
  if(S.paused){ctx.fillStyle='rgba(6,41,59,.55)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffd24a';ctx.font='bold 40px system-ui,Arial';ctx.textAlign='center';ctx.fillText('Paused',W/2,H/2);}
 }
 function frame(t){
  var dt=Math.min(.05,(t-last)/1000);last=t;
  if(S.running&&!S.paused&&!S.over)update(dt);
  draw();raf=requestAnimationFrame(frame);
 }
 function coords(e){var r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)};}
 canvas.addEventListener('pointermove',function(e){hover=coords(e);});
 canvas.addEventListener('pointerleave',function(){hover=null;});
 canvas.addEventListener('pointerdown',function(e){var c=coords(e);hover=c;place(c.x,c.y);});
 toolBtns.forEach(function(b){b.addEventListener('click',function(){selected=b.dataset.tool;var t=TOOLS[selected];say('Selected '+t.name+' ('+t.cost+' pts). Click or tap beside the path to place it.');hud();});});
 root.addEventListener('click',function(e){
  var a=e.target.closest('[data-act]'); if(!a) return;
  if(a.dataset.act==='restart'){reset();}
  if(a.dataset.act==='pause'&&!S.over){S.paused=!S.paused;pauseBtn.textContent=S.paused?'Resume':'Pause';say(S.paused?'Paused.':'Back in the game.');}
 });
 document.addEventListener('keydown',function(e){if(KEYS[e.key]&&root.offsetParent!==null&&!/input|textarea|select/i.test((e.target||{}).tagName||'')){selected=KEYS[e.key];say('Selected '+TOOLS[selected].name+'.');hud();}});
 reset(); last=performance.now(); raf=requestAnimationFrame(frame);
 root._wg={state:function(){return S;},place:place,select:function(t){selected=t;hud();}};
}
window.initWaterGame=init;
document.addEventListener('DOMContentLoaded',function(){if(window.__noAutoGame)return;[].forEach.call(document.querySelectorAll('[data-wgame]'),init);});
})();
