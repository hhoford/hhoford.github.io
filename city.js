import{C,rng,poly,pine,palm,person}from'./art.js';
const TW=14,TH=7;
export const landmarks=[
  {name:'Queen’s Park Savannah',type:'savannah',x:9,y:4,w:7,d:5,entry:[12,9.5]},
  {name:'Magnificent Seven',type:'mansions',x:7,y:4,w:1.3,d:4.4,entry:[8.5,6]},
  {name:'Queen’s Royal College',type:'qrc',x:6.8,y:8.2,w:1.6,d:1.5,h:21,entry:[8.7,9.5]},
  {name:'Queen’s Park Oval',type:'oval',x:2.8,y:10,w:4.7,d:4,entry:[7.7,12]},
  {name:'National Academy for the Performing Arts',type:'napa',x:12.8,y:10,w:2.7,d:1.7,h:18,entry:[12.2,11.5]},
  {name:'Woodford Square',type:'square',x:13,y:16,w:2.7,d:2.1,entry:[15.9,17.3]},
  {name:'The Red House',type:'redhouse',x:11.2,y:16.2,w:1.3,d:1.9,h:17,entry:[12.7,17.3]},
  {name:'Holy Trinity Cathedral',type:'cathedral',x:13.5,y:18.8,w:1.8,d:1,h:19,entry:[15.7,19]},
  {name:'International Waterfront Centre',type:'waterfront',x:9.6,y:20.3,w:3.4,d:1.5,h:36,entry:[11,19.8]},
];
function inRect(x,y,r,pad=0){return x>r.x-pad&&x<r.x+r.w+pad&&y>r.y-pad&&y<r.y+r.d+pad;}
export class City{
  constructor(){
    this.player={x:15.7,y:18.1,moving:false};this.path=[];this.camera={x:0,y:175,zoom:1.2};this.keys=new Set();this.hover=null;this.objects=[];this.obstacles=[];
    const random=rng(657);
    const roadsX=[2,8,12,17,22],roadsY=[3,9.4,14.8,18.1,21.8];
    this.roadsX=roadsX;this.roadsY=roadsY;
    for(let x=1;x<25;x+=1.7)for(let y=3.5;y<21;y+=1.6){
      if(roadsX.some(v=>Math.abs(x-v)<.8)||roadsY.some(v=>Math.abs(y-v)<.8))continue;
      const house={type:'house',x:x+.12,y:y+.12,w:.95+random()*.25,d:.85+random()*.3,h:5+Math.floor(random()*8),tone:Math.floor(random()*5),seed:random()};
      if(landmarks.some(r=>inRect(house.x,house.y,r,.8)||inRect(house.x+house.w,house.y+house.d,r,.7)))continue;
      this.objects.push(house);this.obstacles.push(house);
    }
    for(const r of landmarks){this.objects.push(r);if(!['savannah','square','oval','mansions'].includes(r.type))this.obstacles.push(r);}
    for(let i=0;i<105;i++){
      const x=1+random()*24,y=random()*2.3;
      this.objects.push({type:'tree',x,y,size:.7+random()*.55});
    }
    for(let i=0;i<55;i++){
      const x=1+random()*24,y=3+random()*18;
      if(this.objects.some(r=>r.w&&inRect(x,y,r,.2))||roadsX.some(v=>Math.abs(x-v)<.35)||roadsY.some(v=>Math.abs(y-v)<.35))continue;
      this.objects.push({type:'palm',x,y,size:.65+random()*.3});
    }
    for(let i=0;i<12;i++)this.objects.push({type:'palm',x:3+i*1.75,y:22.05,size:.7});
    this.grain=Array.from({length:500},()=>({x:random()*26,y:random()*23,c:random()>.5}));
  }
  iso(x,y,z=0){return[(x-y)*TW,(x+y)*TH-z];}
  resize(w,h){this.w=w;this.h=h;const fit=w/h<1?Math.min(w/420,h/465):Math.min(w/760,h/465);this.scale=fit*1.04*this.camera.zoom;}
  screen(x,y,z=0){const p=this.iso(x,y,z);return[(p[0]-this.camera.x)*this.scale+this.w/2,(p[1]-this.camera.y)*this.scale+this.h/2];}
  world(sx,sy){const px=(sx-this.w/2)/this.scale+this.camera.x,py=(sy-this.h/2)/this.scale+this.camera.y;return[(px/TW+py/TH)/2,(py/TH-px/TW)/2];}
  pan(dx,dy){this.camera.x-=dx/this.scale;this.camera.y-=dy/this.scale;}
  zoom(factor){this.camera.zoom=Math.max(.7,Math.min(3.5,this.camera.zoom*factor));}
  walkable(x,y){return x>.8&&x<25&&y>2.8&&y<22.1&&!this.obstacles.some(r=>inRect(x,y,r,.13));}
  pathTo(tx,ty){
    const n=54,step=.5,start=[Math.round(this.player.x/step),Math.round(this.player.y/step)];
    let target=[Math.round(tx/step),Math.round(ty/step)],best=Infinity;
    for(let dx=-6;dx<=6;dx++)for(let dy=-6;dy<=6;dy++){
      const x=target[0]+dx,y=target[1]+dy,dist=dx*dx+dy*dy;
      if(x>=0&&x<n&&y>=0&&y<n&&dist<best&&this.walkable(x*step,y*step)){best=dist;this.target=[x,y];}
    }
    if(!Number.isFinite(best))return false;
    target=this.target;const prev=new Int32Array(n*n).fill(-1),queue=[start[1]*n+start[0]],goal=target[1]*n+target[0];prev[queue[0]]=queue[0];
    for(let head=0;head<queue.length;head++){
      const cell=queue[head];if(cell===goal)break;const x=cell%n,y=Math.floor(cell/n);
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,id=ny*n+nx;if(nx<0||ny<0||nx>=n||ny>=n||prev[id]!==-1||!this.walkable(nx*step,ny*step))continue;prev[id]=cell;queue.push(id);}
    }
    if(prev[goal]===-1)return false;
    const route=[];let cell=goal;while(prev[cell]!==cell){route.push([cell%n*step,Math.floor(cell/n)*step]);cell=prev[cell];}
    this.path=route.reverse();return true;
  }
  update(dt,time){
    let dx=0,dy=0;const k=this.keys;
    if(k.has('arrowup')||k.has('w')){dx--;dy--;}
    if(k.has('arrowdown')||k.has('s')){dx++;dy++;}
    if(k.has('arrowleft')||k.has('a')){dx--;dy++;}
    if(k.has('arrowright')||k.has('d')){dx++;dy--;}
    const p=this.player;this.player.moving=false;
    if(dx||dy){this.path=[];const length=Math.hypot(dx,dy);dx=dx/length*dt*3.3;dy=dy/length*dt*3.3;
      if(this.walkable(p.x+dx,p.y))p.x+=dx;if(this.walkable(p.x,p.y+dy))p.y+=dy;p.moving=true;
    }else if(this.path.length){const t=this.path[0],distance=Math.hypot(t[0]-p.x,t[1]-p.y),speed=dt*3.3;if(distance<=speed){p.x=t[0];p.y=t[1];this.path.shift();}else{p.x+=(t[0]-p.x)/distance*speed;p.y+=(t[1]-p.y)/distance*speed;}p.moving=true;}
    if(p.moving&&this.scale){const at=this.screen(p.x,p.y);const margin=Math.min(70,this.w*.2);if(at[0]<margin)this.camera.x-=(margin-at[0])*.1/this.scale;if(at[0]>this.w-margin)this.camera.x+=(at[0]-this.w+margin)*.1/this.scale;if(at[1]<75)this.camera.y-=(75-at[1])*.1/this.scale;if(at[1]>this.h-45)this.camera.y+=(at[1]-this.h+45)*.1/this.scale;}
  }
  featureAt(sx,sy){
    const world=this.world(sx,sy);let found=null;
    for(const r of landmarks){const centre=this.screen(r.x+r.w/2,r.y+r.d/2,(r.h||0)*.45);const radius=Math.max(10,(r.w+r.d)*TW*.28*this.scale);if(inRect(...world,r,.15)||Math.hypot(sx-centre[0],sy-centre[1])<radius)found=r;}
    return found;
  }
  select(sx,sy){const feature=this.featureAt(sx,sy);if(feature){this.pathTo(...feature.entry);return feature;}this.pathTo(...this.world(sx,sy));return null;}
  tile(ctx,x,y,color,w=1,d=1,z=0){poly(ctx,[this.iso(x,y,z),this.iso(x+w,y,z),this.iso(x+w,y+d,z),this.iso(x,y+d,z)],color);}
  ellipse(ctx,x,y,w,d,color,stroke){ctx.save();const p=this.iso(x,y);ctx.translate(...p);ctx.transform(TW,TH,-TW,TH,0,0);ctx.beginPath();ctx.ellipse(w/2,d/2,w/2,d/2,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.07;ctx.stroke();}ctx.restore();}
  building(ctx,r){
    const{x,y,w,d,h}=r,wall=r.wall||['#d9b991','#ddcaa5','#b4b7a0','#d5b69c','#c9c1a2'][r.tone||0],roof=r.roof||['#9b7058','#746d5b','#9b755a','#6f8578','#a28d6b'][r.tone||0];
    const a=this.iso(x,y),b=this.iso(x+w,y),c=this.iso(x+w,y+d),e=this.iso(x,y+d),A=this.iso(x,y,h),B=this.iso(x+w,y,h),D=this.iso(x+w,y+d,h),E=this.iso(x,y+d,h);
    poly(ctx,[[c[0],c[1]],[c[0]+h*.8,c[1]+h*.23],[e[0]+h*.8,e[1]+h*.23],[e[0],e[1]]],'#4a453c20');
    poly(ctx,[b,c,D,B],r.shade||'#a6987d','#786a50');poly(ctx,[c,e,E,D],wall,'#82745a');poly(ctx,[A,B,D,E],roof,'#6e604a');
    if(r.type==='house'){
      const ridge1=this.iso(x+w*.5,y,h+4),ridge2=this.iso(x+w*.5,y+d,h+4);poly(ctx,[A,ridge1,ridge2,E],roof);poly(ctx,[ridge1,B,D,ridge2],r.tone===3?'#5f776e':'#805f4d');
      const front=this.iso(x+w*.5,y+d,h*.32);ctx.fillStyle='#6b624f';ctx.fillRect(Math.round(front[0])-1,Math.round(front[1])-2,3,5);
    }
    for(let i=1;i<=Math.max(1,Math.floor(w*2));i++){const t=i/(Math.floor(w*2)+1),p=this.iso(x+w*t,y+d,h*.58);ctx.fillStyle='#605e4e';ctx.fillRect(Math.round(p[0])-1,Math.round(p[1])-2,2,3);ctx.fillStyle='#dfd6ac';ctx.fillRect(Math.round(p[0]),Math.round(p[1])-1,1,1);}
  }
  drawPark(ctx,r){
    this.tile(ctx,r.x,r.y,'#a3ad78',r.w,r.d);this.ellipse(ctx,r.x+.25,r.y+.25,r.w-.5,r.d-.5,'#b3ba85','#d8c89e');
    if(r.type==='savannah'){
      this.ellipse(ctx,r.x+.65,r.y+.6,r.w-1.3,r.d-1.2,'#afb982');
      for(let i=0;i<14;i++){const a=i/14*Math.PI*2,p=this.iso(r.x+r.w/2+Math.cos(a)*(r.w/2-.05),r.y+r.d/2+Math.sin(a)*(r.d/2-.05));pine(ctx,...p,.48,i%2);}
      this.building(ctx,{x:r.x+r.w-2,y:r.y+r.d-.65,w:1.7,d:.4,h:3,wall:'#ccb78f',roof:'#9b8b71'});
    }else{this.tile(ctx,r.x+r.w/2-.12,r.y,'#d9cdab',.24,r.d);this.tile(ctx,r.x,r.y+r.d/2-.12,'#d9cdab',r.w,.24);const p=this.iso(r.x+r.w/2,r.y+r.d/2);poly(ctx,[[p[0]-3,p[1]],[p[0],p[1]-8],[p[0]+3,p[1]]],'#a6a18a');}
  }
  drawFeature(ctx,r,time){
    if(r.type==='savannah'||r.type==='square')return this.drawPark(ctx,r);
    if(r.type==='mansions'){
      for(let i=0;i<6;i++){this.building(ctx,{type:'house',x:r.x,y:r.y+i*.68,w:1,d:.5,h:8+i%3*3,tone:i%5});const p=this.iso(r.x+.5,r.y+i*.68,12+i%3*3);if(i===0||i===4)poly(ctx,[[p[0]-3,p[1]],[p[0],p[1]-7],[p[0]+3,p[1]]],'#7f7363');}return;
    }
    if(r.type==='oval'){
      this.tile(ctx,r.x-.2,r.y-.2,'#bdbb93',r.w+.4,r.d+.4);this.ellipse(ctx,r.x,r.y,r.w,r.d,'#b8b19a');this.ellipse(ctx,r.x+.3,r.y+.3,r.w-.6,r.d-.6,'#698951');this.ellipse(ctx,r.x+.6,r.y+.5,r.w-1.2,r.d-1,'#87a162');this.tile(ctx,r.x+r.w*.47,r.y+r.d*.32,'#c8bd87',.18,r.d*.36);for(let i=0;i<7;i++){this.building(ctx,{x:r.x+i*.65,y:r.y-.15,w:.56,d:.4,h:4,wall:'#bbbda8',roof:i%2?'#7d8c8b':'#a6aba0'});}return;
    }
    if(r.type==='napa'){
      this.tile(ctx,r.x-.2,r.y-.2,'#c9c1a3',r.w+.4,r.d+.4);this.building(ctx,{...r,h:5,wall:'#c2b9a5',roof:'#d7d3bc'});
      for(let i=0;i<5;i++){const a=this.iso(r.x+i*.48,r.y+r.d,5),b=this.iso(r.x+i*.48+.7,r.y+.05,5),c=this.iso(r.x+i*.48+.4,r.y+r.d*.5,17-i%2*3);poly(ctx,[a,c,b],i%2?'#e4ddc4':'#c3c7b6','#a7aa98');}return;
    }
    if(r.type==='waterfront'){
      this.tile(ctx,r.x-.5,r.y-.2,'#c6c6b0',r.w+1,r.d+.5);
      for(let i=0;i<2;i++){
        const b={...r,x:r.x+i*1.9,w:1.1,d:1,h:35+i*3,wall:'#afc5bf',shade:'#789a96',roof:'#d4d6bf'};this.building(ctx,b);
        for(let level=5;level<b.h;level+=4){const a=this.iso(b.x+b.w,b.y,level),c=this.iso(b.x+b.w,b.y+b.d,level),d=this.iso(b.x,b.y+b.d,level);ctx.strokeStyle='#d2d4ba';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...c);ctx.lineTo(...d);ctx.stroke();}
      }return;
    }
    if(r.type==='qrc'){
      this.building(ctx,{...r,h:11,wall:'#b7654c',shade:'#915341',roof:'#78715a'});const b={...r,x:r.x+.55,y:r.y+.4,w:.6,d:.6,h:25};this.building(ctx,{...b,wall:'#bc7356',shade:'#96543e',roof:'#82654c'});const p=this.iso(b.x+.3,b.y+.6,21);ctx.fillStyle='#e7d7ac';ctx.fillRect(Math.round(p[0])-2,Math.round(p[1])-2,4,4);ctx.fillStyle='#654e33';ctx.fillRect(Math.round(p[0]),Math.round(p[1])-1,1,2);return;
    }
    if(r.type==='redhouse'){
      this.building(ctx,{...r,h:11,wall:'#b8624f',shade:'#8e503d',roof:'#9e6956'});const p=this.iso(r.x+.65,r.y+.75,13);poly(ctx,[[p[0]-5,p[1]],[p[0],p[1]-9],[p[0]+5,p[1]]],'#b27e59','#835f42');return;
    }
    if(r.type==='cathedral'){
      this.building(ctx,{...r,h:10,wall:'#c8bc9a',roof:'#797c65'});this.building(ctx,{...r,x:r.x+.1,y:r.y+.1,w:.55,d:.55,h:22,wall:'#c7b895',roof:'#667364'});const p=this.iso(r.x+.38,r.y+.37,22);poly(ctx,[[p[0]-4,p[1]],[p[0],p[1]-11],[p[0]+4,p[1]]],'#617066');return;
    }
  }
  draw(ctx,w,h,time,motion=true){
    this.resize(w,h);ctx.fillStyle='#8da29b';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(this.scale,this.scale);ctx.translate(-this.camera.x,-this.camera.y);
    for(let x=0;x<27;x++)for(let y=0;y<24;y++){
      if(y>22||x===0||x>25)continue;
      const road=this.roadsX.some(v=>Math.abs(x+.5-v)<.55)||this.roadsY.some(v=>Math.abs(y+.5-v)<.55);
      this.tile(ctx,x,y,y<3?'#889568':road?'#d4c6a5':(x+y)%3?'#bcb58c':'#b5b18a');
    }
    for(const g of this.grain){const p=this.iso(g.x,g.y);ctx.fillStyle=g.c?'#ffffff13':'#4c533414';ctx.fillRect(Math.round(p[0]),Math.round(p[1]),1,1);}
    for(let i=0;i<13;i++){
      const x=i*2.15,y=.7+Math.sin(i*2)*.6,p=this.iso(x,y),height=22+Math.sin(i*.9)*12;
      poly(ctx,[[p[0]-31,p[1]],[p[0],p[1]-height],[p[0]+39,p[1]+5]],'#82916b');poly(ctx,[[p[0],p[1]-height],[p[0]+39,p[1]+5],[p[0]+9,p[1]]],'#657d5a');
    }
    for(let i=0;i<40;i++){const p=this.iso(i*.71,23.1+(i%4)*.36);ctx.fillStyle='#d8dfc442';ctx.fillRect(Math.round(p[0]+(motion?Math.sin(time+i)*2:0)),Math.round(p[1]),4,1);}
    const objects=[...this.objects,{type:'player',x:this.player.x,y:this.player.y}].sort((a,b)=>(a.x+a.y+(a.w||0)*.5+(a.d||0)*.5)-(b.x+b.y+(b.w||0)*.5+(b.d||0)*.5));
    for(const r of objects){
      if(r.type==='house')this.building(ctx,r);
      else if(r.type==='tree')pine(ctx,...this.iso(r.x,r.y),r.size,Math.round(r.x)%2);
      else if(r.type==='palm')palm(ctx,...this.iso(r.x,r.y),r.size,motion?time:0);
      else if(r.type==='player')person(ctx,...this.iso(r.x,r.y),time,this.player.moving,.85);
      else this.drawFeature(ctx,r,time);
    }
    if(this.path.length){const end=this.path[this.path.length-1],p=this.iso(...end);ctx.strokeStyle='#f4e5b5b0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(...p,4,2,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
}
