import{C,rng,poly,pine,palm,person}from'./art.js';
const TW=14,TH=7,METRES=100;
const colors={clocktower:['#c5b48f','#8c8370'],palace:['#d4cbb2','#8d958d'],museum:['#c8c2ad','#939784'],dome:['#d0c6aa','#b6b699'],column:['#c9c1a8','#aaa78d'],pyramid:['#c9cbbd','#a0aea7'],bridge:['#c7b993','#aa947b'],pier:['#c6b895','#a09276'],sculpture:['#b1bab3','#d9ded1'],fountain:['#c7c6ad','#c3c8b1'],qrc:['#b96e55','#795f4b'],redhouse:['#b86250','#936957'],cathedral:['#c9bca0','#737b67'],college:['#d0c4aa','#777e73'],mansion:['#d9cbaa','#8c7d65'],castle:['#c1baa5','#768071'],napa:['#d1d1bd','#e6e0cb'],tower:['#adc5be','#cbd3bf'],hotel:['#d2c7ad','#9da99b']};
function inside(x,y,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function nearest(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return[a[0]+dx*t,a[1]+dy*t];}
function extent(points){return{minX:Math.min(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxX:Math.max(...points.map(p=>p[0])),maxY:Math.max(...points.map(p=>p[1]))};}
function area(points){return Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2);}
export class City{
  constructor(data){
    this.bounds=data.bounds;this.longitudeScale=111320*Math.cos((data.bounds[1]+data.bounds[3])*.5*Math.PI/180)/METRES;this.latitudeScale=111320/METRES;
    this.width=(data.bounds[2]-data.bounds[0])*this.longitudeScale;this.height=(data.bounds[3]-data.bounds[1])*this.latitudeScale;
    this.landAreas=(data.landAreas||[data.land]).map(ring=>ring.map(p=>this.fromGeo(...p)));
    this.water=(data.water||[]).map(ring=>{const points=ring.map(p=>this.fromGeo(...p));return{points,box:extent(points)};});
    this.tropical=Math.abs((data.bounds[1]+data.bounds[3])*.5)<24;this.labelStreets=data.labelStreets;
    this.roads=data.roads.map(r=>({...r,points:r.points.map(p=>this.fromGeo(...p))}));
    this.parks=data.parks.map(r=>({...r,points:r.points.map(p=>this.fromGeo(...p))}));
    this.landmarks=data.landmarks.map(r=>{const polygons=r.polygons.map(ring=>ring.map(p=>this.fromGeo(...p))),centre=this.fromGeo(...r.centre),box=extent(polygons.flat());return{...r,type:r.kind,h:r.height,polygons,x:centre[0],y:centre[1],box};});
    this.platforms=this.landmarks.filter(r=>['bridge','pier'].includes(r.type));
    this.obstacles=this.landmarks.filter(r=>r.h>0&&!this.platforms.includes(r));
    this.bridges=this.roads.filter(r=>r.bridge).map(r=>({...r,box:extent(r.points)}));
    this.keys=new Set();this.path=[];this.objects=[];this.camera={x:0,y:0,zoom:1.15};
    for(const feature of this.landmarks)feature.entry=this.entrance(feature);
    const start=(this.landmarks.find(r=>['square','plaza'].includes(r.type))||this.landmarks.find(r=>!this.platforms.includes(r))).entry;this.player={x:start[0],y:start[1],moving:false};
    const projected=this.landmarks.flatMap(r=>r.polygons.flat().map(p=>this.iso(...p))),view=extent(projected);
    this.camera.x=(view.minX+view.maxX)/2;this.camera.y=(view.minY+view.maxY)/2-10;
    this.viewWidth=view.maxX-view.minX+190;this.viewHeight=view.maxY-view.minY+150;
    const random=rng(657);
    for(const park of this.parks){
      if(['pitch','stadium'].includes(park.kind)||area(park.points)<1)continue;
      const box=extent(park.points),count=Math.min(24,Math.ceil(area(park.points)*.2));
      let planted=0;
      for(let i=0;i<count*12&&planted<count;i++){
        const x=box.minX+random()*(box.maxX-box.minX),y=box.minY+random()*(box.maxY-box.minY);
        if(!inside(x,y,park.points)||!this.walkable(x,y))continue;
        this.objects.push({type:park.kind==='forest'||!this.tropical?'tree':'palm',x,y,size:.55+random()*.25});planted++;
      }
    }
    this.ground=null;this.nav=null;
  }
  fromGeo(lon,lat){return[(lon-this.bounds[0])*this.longitudeScale,(this.bounds[3]-lat)*this.latitudeScale];}
  iso(x,y,z=0){return[(x-y)*TW,(x+y)*TH-z];}
  resize(w,h){this.w=w;this.h=h;const fit=w/h<1?Math.min(w/(this.viewWidth*.55),h/this.viewHeight):Math.min(w/this.viewWidth,h/this.viewHeight);this.scale=fit*1.04*this.camera.zoom;}
  screen(x,y,z=0){const p=this.iso(x,y,z);return[(p[0]-this.camera.x)*this.scale+this.w/2,(p[1]-this.camera.y)*this.scale+this.h/2];}
  world(sx,sy){const px=(sx-this.w/2)/this.scale+this.camera.x,py=(sy-this.h/2)/this.scale+this.camera.y;return[(px/TW+py/TH)/2,(py/TH-px/TW)/2];}
  pan(dx,dy){this.camera.x-=dx/this.scale;this.camera.y-=dy/this.scale;}
  zoom(factor){this.camera.zoom=Math.max(1,Math.min(4.5,this.camera.zoom*factor));}
  isWater(x,y){return this.water.some(r=>x>=r.box.minX&&x<=r.box.maxX&&y>=r.box.minY&&y<=r.box.maxY&&inside(x,y,r.points));}
  onBridge(x,y){
    if(this.platforms.some(r=>r.polygons.some(ring=>inside(x,y,ring))))return true;
    for(const r of this.bridges){const b=r.box;if(x<b.minX-.3||x>b.maxX+.3||y<b.minY-.3||y>b.maxY+.3)continue;for(let i=1;i<r.points.length;i++){const p=nearest(x,y,r.points[i-1],r.points[i]);if(Math.hypot(x-p[0],y-p[1])<.3)return true;}}return false;
  }
  walkable(x,y){
    if(x<.2||y<.2||x>this.width-.2||y>this.height-.2)return false;
    const land=this.landAreas.some(ring=>inside(x,y,ring));if((!land||this.isWater(x,y))&&!this.onBridge(x,y))return false;
    for(const r of this.obstacles){const b=r.box;if(x<b.minX-.1||x>b.maxX+.1||y<b.minY-.1||y>b.maxY+.1)continue;for(const ring of r.polygons){if(inside(x,y,ring))return false;for(let i=1;i<ring.length;i++){const p=nearest(x,y,ring[i-1],ring[i]);if(Math.hypot(x-p[0],y-p[1])<.1)return false;}}}
    return true;
  }
  entrance(feature){
    let best=Infinity,entry=null;const preferred=feature.entryStreet?this.roads.filter(r=>r.name===feature.entryStreet):[],roads=preferred.length?preferred:this.roads;
    for(const road of roads)for(let i=1;i<road.points.length;i++){
      const p=nearest(feature.x,feature.y,road.points[i-1],road.points[i]),d=Math.hypot(p[0]-feature.x,p[1]-feature.y);
      if(d<best&&this.walkable(...p)){entry=p;best=d;}
    }
    return entry||[feature.box.minX-.25,feature.y];
  }
  buildNavigation(){
    const step=.4,n=Math.ceil(this.width/step)+1,m=Math.ceil(this.height/step)+1,mask=new Uint8Array(n*m);
    for(let y=0;y<m;y++)for(let x=0;x<n;x++)mask[y*n+x]=this.walkable(x*step,y*step)?1:0;
    this.nav={step,n,m,mask};
  }
  clearSegment(ax,ay,bx,by){const count=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/.02));for(let i=1;i<=count;i++)if(!this.walkable(ax+(bx-ax)*i/count,ay+(by-ay)*i/count))return false;return true;}
  pathTo(tx,ty){
    if(!this.nav)this.buildNavigation();
    const{step,n,m,mask}=this.nav;
    const closest=(x,y,connect=false)=>{let best=Infinity,point=null;const cx=Math.round(x/step),cy=Math.round(y/step);for(let dx=-8;dx<=8;dx++)for(let dy=-8;dy<=8;dy++){const nx=cx+dx,ny=cy+dy,d=dx*dx+dy*dy;if(nx<0||ny<0||nx>=n||ny>=m||!mask[ny*n+nx]||d>=best)continue;if(connect&&!this.clearSegment(x,y,nx*step,ny*step))continue;point=[nx,ny];best=d;}return point;};
    const start=closest(this.player.x,this.player.y,true),target=closest(tx,ty);if(!start||!target)return false;
    const root=start[1]*n+start[0],prev=new Int32Array(n*m).fill(-1),cost=new Float64Array(n*m).fill(Infinity),open=[];
    const push=item=>{open.push(item);let i=open.length-1;while(i>0){const parent=(i-1)>>1;if(open[parent][1]<=item[1])break;open[i]=open[parent];i=parent;}open[i]=item;};
    const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let child=i*2+1;if(child+1<open.length&&open[child+1][1]<open[child][1])child++;if(last[1]<=open[child][1])break;open[i]=open[child];i=child;}open[i]=last;}return first;};
    const heuristic=(x,y)=>Math.max(0,Math.abs(x-target[0])+Math.abs(y-target[1])-1);
    prev[root]=root;cost[root]=0;push([root,heuristic(...start),0]);this.edges??=new Map();let goal=-1;
    while(open.length){
      const[cell,,travel]=pop();if(travel!==cost[cell])continue;const x=cell%n,y=Math.floor(cell/n);
      if(Math.hypot(x-target[0],y-target[1])<=1){goal=cell;break;}
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,id=ny*n+nx;if(nx<0||ny<0||nx>=n||ny>=m||!mask[id]||travel+1>=cost[id])continue;const edge=Math.min(cell,id)*n*m+Math.max(cell,id);let clear=this.edges.get(edge);if(clear===undefined){clear=this.clearSegment(x*step,y*step,nx*step,ny*step);this.edges.set(edge,clear);}if(!clear)continue;cost[id]=travel+1;prev[id]=cell;push([id,cost[id]+heuristic(nx,ny),cost[id]]);}
    }
    if(goal<0)return false;
    const route=[];let cell=goal;while(prev[cell]!==cell){route.push([cell%n*step,Math.floor(cell/n)*step]);cell=prev[cell];}this.path=[[start[0]*step,start[1]*step],...route.reverse()];return true;
  }
  update(dt,time){
    let dx=0,dy=0;const k=this.keys,p=this.player;
    if(k.has('arrowup')||k.has('w')){dx--;dy--;}
    if(k.has('arrowdown')||k.has('s')){dx++;dy++;}
    if(k.has('arrowleft')||k.has('a')){dx--;dy++;}
    if(k.has('arrowright')||k.has('d')){dx++;dy--;}
    p.moving=false;
    if(dx||dy){this.path=[];const length=Math.hypot(dx,dy);dx=dx/length*dt*3.3;dy=dy/length*dt*3.3;if(this.walkable(p.x+dx,p.y))p.x+=dx;if(this.walkable(p.x,p.y+dy))p.y+=dy;p.moving=true;}
    else if(this.path.length){const t=this.path[0],distance=Math.hypot(t[0]-p.x,t[1]-p.y),speed=dt*3.3;if(distance<=speed){p.x=t[0];p.y=t[1];this.path.shift();}else{const x=p.x+(t[0]-p.x)/distance*speed,y=p.y+(t[1]-p.y)/distance*speed;if(this.walkable(x,y)){p.x=x;p.y=y;}else this.path=[];}p.moving=true;}
    if(p.moving&&this.scale){const at=this.screen(p.x,p.y),margin=Math.min(70,this.w*.2);if(at[0]<margin)this.camera.x-=(margin-at[0])*.1/this.scale;if(at[0]>this.w-margin)this.camera.x+=(at[0]-this.w+margin)*.1/this.scale;if(at[1]<75)this.camera.y-=(75-at[1])*.1/this.scale;if(at[1]>this.h-45)this.camera.y+=(at[1]-this.h+45)*.1/this.scale;}
  }
  featureAt(sx,sy){
    const features=[...this.landmarks].sort((a,b)=>b.x+b.y-a.x-a.y);
    for(const r of features)if(r.polygons.some(ring=>inside(sx,sy,ring.map(p=>this.screen(...p,r.h)))))return r;
    let result=null,distance=7;
    for(const r of features){const p=this.screen(r.x,r.y,r.h*.4),d=Math.hypot(sx-p[0],sy-p[1]);if(d<distance){distance=d;result=r;}}
    return result;
  }
  select(sx,sy){const feature=this.featureAt(sx,sy);this.pathTo(...(feature?feature.entry:this.world(sx,sy)));return feature;}
  groundPolygon(ctx,ring,fill,stroke){poly(ctx,ring.map(p=>this.iso(...p)),fill,stroke);}
  paintGround(){
    const corners=[[0,0],[this.width,0],[this.width,this.height],[0,this.height]].map(p=>this.iso(...p)),box=extent(corners),pad=3;
    this.groundOrigin=[Math.floor(box.minX)-pad,Math.floor(box.minY)-pad];
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(box.maxX-box.minX)+pad*2;canvas.height=Math.ceil(box.maxY-box.minY)+pad*2;
    const ctx=canvas.getContext('2d');ctx.translate(-this.groundOrigin[0],-this.groundOrigin[1]);
    ctx.save();ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();
    for(const ring of this.landAreas)this.groundPolygon(ctx,ring,'#d9caa5','#776f53');
    ctx.save();ctx.beginPath();for(const ring of this.landAreas){ring.forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}ctx.clip();
    const random=rng(812);for(let i=0;i<12000;i++){const p=this.iso(random()*this.width,random()*this.height);ctx.fillStyle=random()>.5?'#fff4d425':'#766a4410';ctx.fillRect(Math.round(p[0]),Math.round(p[1]),1,1);}
    for(const park of this.parks)this.groundPolygon(ctx,park.points,['pitch','stadium'].includes(park.kind)?'#a6b27a':park.kind==='forest'?'#9ca778':'#b0b98a');
    ctx.restore();for(const water of this.water)this.groundPolygon(ctx,water.points,C.sea);
    for(const r of this.landmarks)if(r.type==='plaza')for(const ring of r.polygons)this.groundPolygon(ctx,ring,'#d3c6a6');
    for(const r of this.platforms)for(const ring of r.polygons)this.groundPolygon(ctx,ring,'#c7bda0','#9e957b');
    const weight={motorway:4.6,trunk:4.2,primary:3.1,secondary:2.8,tertiary:2.3,unclassified:1.7,residential:1.7,living_street:1.5,pedestrian:1.5,footway:.65,path:.65};
    const roads=[...this.roads].sort((a,b)=>(weight[a.kind]||1.2)-(weight[b.kind]||1.2));ctx.lineJoin='round';ctx.lineCap='round';
    for(const road of roads){ctx.beginPath();road.points.forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(Math.round(q[0]),Math.round(q[1])):ctx.moveTo(Math.round(q[0]),Math.round(q[1]));});const width=weight[road.kind]||1.6;if(width>1){ctx.strokeStyle='#a99d7e';ctx.lineWidth=width+1;ctx.stroke();}ctx.strokeStyle=width>1?'#f0e0bd':'#d7c9a7';ctx.lineWidth=width;ctx.stroke();}
    const oval=this.landmarks.find(r=>r.type==='oval');if(oval){ctx.save();ctx.beginPath();oval.polygons[0].forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.clip();this.groundPolygon(ctx,oval.polygons[0],'#bcb79a');const b=oval.box,p=this.iso(oval.x,oval.y);ctx.translate(...p);ctx.transform(TW,TH,-TW,TH,0,0);ctx.beginPath();ctx.ellipse(0,0,(b.maxX-b.minX)*.42,(b.maxY-b.minY)*.4,0,0,Math.PI*2);ctx.fillStyle='#8fa367';ctx.fill();ctx.strokeStyle='#d5cda7';ctx.lineWidth=.07;ctx.stroke();ctx.fillStyle='#c9bf93';ctx.fillRect(-.025,-.27,.05,.54);ctx.restore();}
    ctx.restore();this.ground=canvas;
  }
  extrude(ctx,r){
    const[wall,roof]=colors[r.type]||colors.mansion;
    if(r.type==='pyramid'){const tip=this.iso(r.x,r.y,r.h);for(const ring of r.polygons)for(let i=1;i<ring.length;i++)poly(ctx,[this.iso(...ring[i-1]),this.iso(...ring[i]),tip],i%2?'#a3aea6':'#cbd0bf','#8e9b90');return;}
    if(['wheel','sculpture','fountain'].includes(r.type)){const p=this.iso(r.x,r.y);ctx.strokeStyle='#73847c';ctx.fillStyle=r.type==='fountain'?'#9eafa2':'#cbd1c4';ctx.lineWidth=1;if(r.type==='wheel'){ctx.beginPath();ctx.ellipse(p[0],p[1]-12,8,12,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(p[0],p[1]-12);ctx.lineTo(p[0]+Math.cos(a)*8,p[1]-12+Math.sin(a)*12);ctx.stroke();}}else{ctx.beginPath();ctx.ellipse(p[0],p[1]-2,4,2.5,0,0,Math.PI*2);ctx.fill();ctx.stroke();}return;}
    for(const ring of r.polygons){
      const walls=[];
      for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],A=this.iso(...a),B=this.iso(...b),aTop=this.iso(...a,r.h),bTop=this.iso(...b,r.h);walls.push({points:[A,B,bTop,aTop],depth:a[0]+a[1]+b[0]+b[1],color:b[0]+b[1]>a[0]+a[1]?'#a89a7f':wall});}
      walls.sort((a,b)=>a.depth-b.depth);for(const side of walls)poly(ctx,side.points,side.color,'#84785e');
      poly(ctx,ring.map(p=>this.iso(...p,r.h)),roof,'#766b54');
    }
    const p=this.iso(r.x,r.y,r.h);
    if(r.type==='qrc'||r.type==='clocktower'){
      const x=p[0],y=p[1];poly(ctx,[[x-3,y+3],[x-3,y-10],[x+2,y-12],[x+5,y-10],[x+5,y+1]],r.type==='clocktower'?'#b5a581':'#b96e55','#80563e');ctx.fillStyle='#e8d4a6';ctx.fillRect(Math.round(x),Math.round(y)-8,3,3);ctx.fillStyle='#6d5039';ctx.fillRect(Math.round(x)+1,Math.round(y)-8,1,2);
    }else if(r.type==='bridge'){const b=r.box,vertical=b.maxY-b.minY>b.maxX-b.minX,points=[.28,.72].map(t=>this.iso(vertical?r.x:b.minX+(b.maxX-b.minX)*t,vertical?b.minY+(b.maxY-b.minY)*t:r.y));ctx.strokeStyle=r.accent||'#8b9180';ctx.lineWidth=2;for(const p of points){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0],p[1]-15);ctx.stroke();}ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]-15);ctx.quadraticCurveTo((points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2-1,points[1][0],points[1][1]-15);ctx.stroke();
    }else if(r.type==='dome'){ctx.fillStyle='#aeb49a';ctx.strokeStyle='#8b907c';ctx.beginPath();ctx.ellipse(p[0],p[1]-3,4,5,0,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#777e6a';ctx.fillRect(Math.round(p[0]),Math.round(p[1])-10,1,3);
    }else if(r.type==='redhouse'){poly(ctx,[[p[0]-4,p[1]+1],[p[0]-3,p[1]-4],[p[0],p[1]-6],[p[0]+3,p[1]-4],[p[0]+4,p[1]+1]],'#bf8b61','#866548');}
    else if(r.type==='cathedral'){poly(ctx,[[p[0]-3,p[1]+1],[p[0],p[1]-9],[p[0]+3,p[1]+1]],'#66765f');}
    else if(r.type==='castle'){for(const dx of [-4,4]){ctx.fillStyle='#aaa88f';ctx.fillRect(Math.round(p[0])+dx-1,Math.round(p[1])-4,3,6);poly(ctx,[[p[0]+dx-2,p[1]-4],[p[0]+dx,p[1]-8],[p[0]+dx+2,p[1]-4]],'#6c786c');}}
    else if(r.type==='college'){
      const b=r.box,a=this.iso(b.minX,b.maxY,r.h*.5),c=this.iso(b.maxX,b.maxY,r.h*.5),length=Math.hypot(c[0]-a[0],c[1]-a[1]);for(let i=0;i<Math.floor(length/3);i++){const t=(i+1)/(Math.floor(length/3)+1),x=a[0]+(c[0]-a[0])*t,y=a[1]+(c[1]-a[1])*t;ctx.fillStyle='#7b7966';ctx.fillRect(Math.round(x),Math.round(y),1,2);}
    }else if(r.type==='tower'){
      const b=r.box;for(let z=4;z<r.h;z+=4){const a=this.iso(b.minX,b.maxY,z),c=this.iso(b.maxX,b.maxY,z);ctx.strokeStyle='#d7d9bf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...c);ctx.stroke();}
    }
  }
  roadNames(ctx){
    if(this.camera.zoom<1.4)return;
    const names=new Set(this.labelStreets||['Frederick Street','Pembroke Street','Maraval Road','Tragarete Road','Ariapita Avenue','Wrightson Road','Independence Square North','Saint Vincent Street','St. Vincent Street','Charlotte Street']),placed=[];
    ctx.font='6px monospace';ctx.textBaseline='middle';
    for(const road of this.roads){if(!names.has(road.name)||road.points.length<2)continue;const p=road.points[Math.floor(road.points.length/2)],s=this.screen(...p);if(s[0]<25||s[0]>this.w-50||s[1]<50||s[1]>this.h-40)continue;if(placed.some(a=>Math.hypot(a[0]-s[0],a[1]-s[1])<48))continue;names.delete(road.name);placed.push(s);ctx.strokeStyle='#e8d9b5';ctx.lineWidth=2;ctx.strokeText(road.name,Math.round(s[0]),Math.round(s[1]));ctx.fillStyle='#605b43';ctx.fillText(road.name,Math.round(s[0]),Math.round(s[1]));}
  }
  draw(ctx,w,h,time,motion=true){
    this.resize(w,h);if(!this.ground)this.paintGround();ctx.fillStyle=C.sea;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(this.scale,this.scale);ctx.translate(-this.camera.x,-this.camera.y);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.ground,...this.groundOrigin);
    if(motion)for(let i=0;i<30;i++){const x=this.width*(i*.618%1),y=this.height*(.7+(i*.173%1)*.3);if(this.landAreas.some(ring=>inside(x,y,ring))&&!this.isWater(x,y))continue;const p=this.iso(x,y);ctx.fillStyle='#d8dfc43b';ctx.fillRect(Math.round(p[0]+Math.sin(time*.6+i)*2),Math.round(p[1]),4,1);}
    const objects=[...this.landmarks.filter(r=>r.h>0),...this.objects,{type:'player',x:this.player.x,y:this.player.y}].sort((a,b)=>a.x+a.y-b.x-b.y);
    for(const r of objects){if(r.type==='tree')pine(ctx,...this.iso(r.x,r.y),r.size,Math.round(r.x)%2);else if(r.type==='palm')palm(ctx,...this.iso(r.x,r.y),r.size,motion?time:0);else if(r.type==='player')person(ctx,...this.iso(r.x,r.y),time,this.player.moving,.85);else this.extrude(ctx,r);}
    if(this.path.length){const p=this.iso(...this.path[this.path.length-1]);ctx.strokeStyle='#f4e5b5b0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(...p,4,2,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();this.roadNames(ctx);
  }
}
