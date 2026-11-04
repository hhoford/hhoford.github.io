import{Atlas,lifeLocations}from'./atlas.js?v=3';
import{City}from'./city.js?v=3';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const ui={place:document.querySelector('#place'),destinations:document.querySelector('#destinations'),landmark:document.querySelector('#landmark'),loading:document.querySelector('#loading'),error:document.querySelector('#error')};
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),cities=new Map(),links=new Map(),pointers=new Map();
let atlas,city,activeLocation,view='atlas',transition=null,previousCamera=null,lastTime=0,lastPaint=0,drag=null,loadingCity=false;
function resize(){canvas.width=Math.max(160,Math.round(innerWidth/2));canvas.height=Math.max(160,Math.round(innerHeight/2));ctx.imageSmoothingEnabled=false;if(atlas)atlas.resize(canvas.width,canvas.height);if(city)city.resize(canvas.width,canvas.height);syncLabels();}
function position(event){const r=canvas.getBoundingClientRect();return[(event.clientX-r.left)*canvas.width/r.width,(event.clientY-r.top)*canvas.height/r.height];}
function showLandmark(feature){const label=feature?.name||'';ui.landmark.hidden=!feature;if(ui.landmark.textContent!==label)ui.landmark.textContent=label;}
function syncLabels(){
  if(!atlas)return;ui.destinations.hidden=view!=='atlas'||!!transition||loadingCity;
  const ratioX=innerWidth/canvas.width,ratioY=innerHeight/canvas.height;
  for(const place of atlas.places){const p=atlas.screen(place.point),link=links.get(place.location.id);if(!link)continue;let x=p[0]*ratioX+11,y=p[1]*ratioY-7;const width=link.offsetWidth||place.location.name.length*7.3+8;if(p[0]>=0&&p[0]<=canvas.width&&p[1]>=0&&p[1]<=canvas.height){x=Math.max(10,Math.min(innerWidth-width-10,x));y=Math.max(62,Math.min(innerHeight-24,y));}link.style.left=Math.round(x)+'px';link.style.top=Math.round(y)+'px';}
}
function setView(next){view=next;document.body.dataset.view=next;ui.place.textContent=next==='city'?activeLocation.name:'';document.querySelector('#city-credit').hidden=next!=='city';canvas.setAttribute('aria-label',next==='city'?activeLocation.name+'. Use arrow keys or W A S D to walk. Click or tap streets to walk. Press Escape or select Hugh Hoford to return to the atlas.':'Interactive atlas. Pan and zoom, or select London, Chicago, San Francisco, or Port of Spain.');showLandmark(null);syncLabels();}
async function enter(place=atlas?.location){
  if(!atlas||!place||transition||loadingCity||view==='city')return;
  loadingCity=true;ui.error.hidden=true;syncLabels();
  try{
    if(!cities.has(place.id)){ui.loading.textContent='Loading '+place.name+'…';ui.loading.hidden=false;const response=await fetch('./data/'+place.id+'.json');if(!response.ok)throw new Error('City data unavailable');cities.set(place.id,new City(await response.json()));}
    city=cities.get(place.id);activeLocation=place;previousCamera={...atlas.camera};atlas.select(place);city.resize(canvas.width,canvas.height);transition={kind:'in',start:performance.now(),duration:reduced.matches?1:1450};canvas.focus({preventScroll:true});
  }catch(error){console.error(error);ui.error.hidden=false;}
  finally{loadingCity=false;ui.loading.hidden=true;syncLabels();}
}
function leave(){if(!atlas||transition||view!=='city')return;city.keys.clear();city.path=[];transition={kind:'out',start:performance.now(),duration:reduced.matches?1:1150};showLandmark(null);}
function zoom(factor,x,y){if(!atlas||transition||loadingCity)return;if(view==='atlas')atlas.zoom(factor,x,y);else city.zoom(factor);syncLabels();}
function smooth(x){return x*x*(3-2*x);}
function draw(now){
  requestAnimationFrame(draw);if(!atlas)return;const dt=Math.min(.05,(now-lastTime)/1000||.016);lastTime=now;if(view==='city'&&!transition)city.update(dt,now/1000);if(now-lastPaint<30)return;lastPaint=now;
  const w=canvas.width,h=canvas.height,time=now/1000;ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);
  if(transition){const raw=Math.min(1,(now-transition.start)/transition.duration),p=smooth(transition.kind==='in'?raw:1-raw),from=previousCamera;atlas.camera.x=from.x+(atlas.position[0]-from.x)*p;atlas.camera.y=from.y+(atlas.position[1]-from.y)*p;atlas.camera.zoom=from.zoom+(8-from.zoom)*p;atlas.draw(ctx,w,h,time,!reduced.matches);const blend=Math.max(0,(p-.62)/.38);if(blend>0){ctx.globalAlpha=blend;city.draw(ctx,w,h,time,!reduced.matches);ctx.globalAlpha=1;}if(raw===1){const next=transition.kind==='in'?'city':'atlas';transition=null;if(next==='atlas')atlas.camera={...previousCamera};setView(next);}}
  else if(view==='atlas')atlas.draw(ctx,w,h,time,!reduced.matches);else city.draw(ctx,w,h,time,!reduced.matches);
  syncLabels();
}
canvas.addEventListener('pointerdown',event=>{if(!atlas||transition||loadingCity)return;canvas.focus({preventScroll:true});const p=position(event);pointers.set(event.pointerId,p);canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,start:p,last:p,moved:false};});
canvas.addEventListener('pointermove',event=>{
  if(!atlas||transition||loadingCity)return;const p=position(event);
  if(pointers.has(event.pointerId)&&pointers.size===2){const old=[...pointers.values()],oldDistance=Math.hypot(old[0][0]-old[1][0],old[0][1]-old[1][1]);pointers.set(event.pointerId,p);const next=[...pointers.values()],distance=Math.hypot(next[0][0]-next[1][0],next[0][1]-next[1][1]);if(oldDistance>0)zoom(distance/oldDistance,(next[0][0]+next[1][0])/2,(next[0][1]+next[1][1])/2);if(drag)drag.moved=true;return;}
  if(drag&&drag.id===event.pointerId){const dx=p[0]-drag.last[0],dy=p[1]-drag.last[1];if(Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])>3)drag.moved=true;if(drag.moved){if(view==='atlas')atlas.pan(dx,dy);else city.pan(dx,dy);}drag.last=p;pointers.set(event.pointerId,p);}
  else if(view==='atlas'){atlas.hover=atlas.cityAt(...p);canvas.style.cursor=atlas.hit(...p)?'pointer':'grab';}
  else{const feature=city.featureAt(...p);showLandmark(feature);canvas.style.cursor=feature?'pointer':'crosshair';}syncLabels();
});
canvas.addEventListener('pointerup',event=>{if(!atlas)return;const p=position(event);pointers.delete(event.pointerId);if(drag&&drag.id===event.pointerId&&!drag.moved&&!transition&&!loadingCity){if(view==='atlas'){const place=atlas.hit(...p);if(place)enter(place);else atlas.hover=atlas.cityAt(...p);}else showLandmark(city.select(...p));}if(pointers.size===0)drag=null;});
canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);drag=null;});
canvas.addEventListener('pointerleave',()=>{if(atlas)atlas.hover=null;if(view==='city'&&!city.path.length)showLandmark(null);});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-event.deltaY*.0015),...position(event));},{passive:false});
addEventListener('keydown',event=>{if(!atlas||event.metaKey||event.ctrlKey||event.altKey)return;const key=event.key.toLowerCase();if(key==='escape'){leave();return;}if((key==='enter'||key===' ')&&event.target===canvas&&view==='atlas'){event.preventDefault();enter();return;}if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)&&event.target===canvas){event.preventDefault();if(view==='city')city.keys.add(key);else{if(key==='arrowleft'||key==='a')atlas.pan(10,0);if(key==='arrowright'||key==='d')atlas.pan(-10,0);if(key==='arrowup'||key==='w')atlas.pan(0,10);if(key==='arrowdown'||key==='s')atlas.pan(0,-10);syncLabels();}}});
addEventListener('keyup',event=>city?.keys.delete(event.key.toLowerCase()));addEventListener('blur',()=>{city?.keys.clear();pointers.clear();drag=null;});addEventListener('resize',resize);
document.querySelector('#name').addEventListener('click',event=>{event.preventDefault();if(view==='city')leave();else if(atlas&&!transition){atlas.reset();syncLabels();}});
document.querySelector('#retry').addEventListener('click',()=>location.reload());
async function start(){
  try{const response=await fetch('./data/atlas.json');if(!response.ok)throw new Error('Map data unavailable');atlas=new Atlas(await response.json());activeLocation=atlas.location;
    for(const place of lifeLocations){const link=document.createElement('a');link.href='#'+place.id;link.textContent=place.name;link.addEventListener('click',event=>{event.preventDefault();enter(place);});link.addEventListener('focus',()=>{if(view==='atlas'&&!transition){atlas.focusLocation(place);syncLabels();}});ui.destinations.appendChild(link);links.set(place.id,link);}
    resize();setView('atlas');ui.loading.hidden=true;requestAnimationFrame(draw);const linked=lifeLocations.find(place=>'#'+place.id===location.hash);if(linked)enter(linked);
  }catch(error){console.error(error);ui.loading.hidden=true;ui.error.hidden=false;ui.destinations.hidden=true;}
}
resize();start();
