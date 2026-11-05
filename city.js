import{C,rng,poly,pine,palm,person,deciduous}from'./art.js?v=7';
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
    this.landmarks=data.landmarks.map(r=>{const polygons=r.polygons.map(ring=>ring.map(p=>this.fromGeo(...p))),centre=this.fromGeo(...r.centre),box=extent(polygons.flat());return{...r,type:r.kind,h:r.height*1.4,polygons,x:centre[0],y:centre[1],box};});
    this.pageBuildings=this.landmarks.filter(feature=>feature.page);this.activePage=null;
    this.platforms=this.landmarks.filter(r=>['bridge','pier'].includes(r.type));
    this.obstacles=this.landmarks.filter(r=>r.h>0&&!this.platforms.includes(r));
    this.bridges=this.roads.filter(r=>r.bridge).map(r=>({...r,box:extent(r.points)}));
    this.keys=new Set();this.path=[];this.objects=[];this.camera={x:0,y:0,zoom:1.15};
    for(const feature of this.landmarks)feature.entry=this.entrance(feature);
    const start=(this.landmarks.find(r=>['square','plaza'].includes(r.type))||this.landmarks.find(r=>!this.platforms.includes(r))).entry;this.player={x:start[0],y:start[1],moving:false};
    const projected=(this.pageBuildings.length?this.pageBuildings:this.landmarks).flatMap(r=>r.polygons.flat().flatMap(p=>[this.iso(...p),this.iso(...p,r.h+40)])),view=extent(projected);
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
        this.objects.push({type:park.kind==='forest'?'pine':this.tropical?'palm':'tree',x,y,size:.55+random()*.35});planted++;
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
  focusPage(page){
    const feature=this.pageBuildings.find(feature=>feature.page===page);if(!feature)return;
    this.activePage=page;this.keys.clear();this.path=[];this.player.x=feature.entry[0];this.player.y=feature.entry[1];
    const projected=feature.polygons.flat().map(p=>this.iso(...p)),box=extent(projected),fit=this.scale/this.camera.zoom;
    const target=Math.min(2.8,this.w/(box.maxX-box.minX+150),this.h/(box.maxY-box.minY+feature.h+130));
    this.camera.zoom=Math.max(1,Math.min(4.5,target/fit));const p=this.iso(feature.x,feature.y,feature.h*.4);this.camera.x=p[0];this.camera.y=p[1];this.resize(this.w,this.h);return feature;
  }
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
    for(const r of features)for(const ring of r.polygons){if(inside(sx,sy,ring.map(p=>this.screen(...p,r.h))))return r;for(let i=1;i<ring.length;i++)if(inside(sx,sy,[this.screen(...ring[i-1]),this.screen(...ring[i]),this.screen(...ring[i],r.h),this.screen(...ring[i-1],r.h)]))return r;}
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
    for(const ring of this.landAreas)this.groundPolygon(ctx,ring,'#ddd3b6','#8c997a');
    ctx.save();ctx.beginPath();for(const ring of this.landAreas){ring.forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}ctx.clip();
    const random=rng(812);for(let i=0;i<12000;i++){const p=this.iso(random()*this.width,random()*this.height);ctx.fillStyle=random()>.5?'#fff4d425':'#766a4410';ctx.fillRect(Math.round(p[0]),Math.round(p[1]),1,1);}
    for(const park of this.parks)this.groundPolygon(ctx,park.points,['pitch','stadium'].includes(park.kind)?'#a1b17c':park.kind==='forest'?'#91a17a':'#b5bf91');
    ctx.restore();for(const water of this.water)this.groundPolygon(ctx,water.points,C.sea);
    for(const r of this.landmarks)if(r.type==='plaza')for(const ring of r.polygons)this.groundPolygon(ctx,ring,'#d3c6a6');
    for(const r of this.platforms)for(const ring of r.polygons)this.groundPolygon(ctx,ring,'#c7bda0','#9e957b');
    const weight={motorway:4.6,trunk:4.2,primary:3.1,secondary:2.8,tertiary:2.3,unclassified:1.7,residential:1.7,living_street:1.5,pedestrian:1.5,footway:.65,path:.65};
    const roads=[...this.roads].sort((a,b)=>(weight[a.kind]||1.2)-(weight[b.kind]||1.2));ctx.lineJoin='round';ctx.lineCap='round';
    for(const road of roads){ctx.beginPath();road.points.forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(Math.round(q[0]),Math.round(q[1])):ctx.moveTo(Math.round(q[0]),Math.round(q[1]));});const width=weight[road.kind]||1.6;if(width>1){ctx.strokeStyle='#f1e7cc';ctx.lineWidth=width+1.6;ctx.stroke();}ctx.strokeStyle=width>2?'#a6a58e':width>1?'#c1baa0':'#e1d8bd';ctx.lineWidth=width;ctx.stroke();if(width>2.7){ctx.setLineDash([3,5]);ctx.strokeStyle='#ebe3c8';ctx.lineWidth=.45;ctx.stroke();ctx.setLineDash([]);}}
    for(const feature of this.landmarks)if(feature.h>0)for(const ring of feature.polygons){const offset=[feature.h*.65,feature.h*.32];const points=ring.map(p=>this.iso(...p));poly(ctx,points.map(p=>[p[0]+offset[0],p[1]+offset[1]]),'#4b4e3f25');for(let i=1;i<points.length;i++)poly(ctx,[points[i-1],points[i],[points[i][0]+offset[0],points[i][1]+offset[1]],[points[i-1][0]+offset[0],points[i-1][1]+offset[1]]],'#4b4e3f18');}
    const oval=this.landmarks.find(r=>r.type==='oval');if(oval){ctx.save();ctx.beginPath();oval.polygons[0].forEach((p,i)=>{const q=this.iso(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.clip();this.groundPolygon(ctx,oval.polygons[0],'#bcb79a');const b=oval.box,p=this.iso(oval.x,oval.y);ctx.translate(...p);ctx.transform(TW,TH,-TW,TH,0,0);ctx.beginPath();ctx.ellipse(0,0,(b.maxX-b.minX)*.42,(b.maxY-b.minY)*.4,0,0,Math.PI*2);ctx.fillStyle='#8fa367';ctx.fill();ctx.strokeStyle='#d5cda7';ctx.lineWidth=.07;ctx.stroke();ctx.fillStyle='#c9bf93';ctx.fillRect(-.025,-.27,.05,.54);ctx.restore();}
    ctx.restore();this.ground=canvas;
  }
  extrude(ctx,r){
    const[wall,roof]=colors[r.type]||colors.mansion,modern=['tower','pyramid','napa'].includes(r.type),willis=r.name==='Willis Tower';
    if(r.type==='pyramid'){
      const tip=this.iso(r.x,r.y,r.h);
      for(const ring of r.polygons)for(let i=1;i<ring.length;i++){
        const a=this.iso(...ring[i-1]),b=this.iso(...ring[i]);poly(ctx,[a,b,tip],i%2?'#9aa99f':'#d3d5c1','#778b7e');
        for(let level=.14;level<.95;level+=.14){ctx.strokeStyle='#7d8f826b';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(a[0]+(tip[0]-a[0])*level,a[1]+(tip[1]-a[1])*level);ctx.lineTo(b[0]+(tip[0]-b[0])*level,b[1]+(tip[1]-b[1])*level);ctx.stroke();}
      }
      ctx.strokeStyle='#536d61';ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(tip[0],tip[1]-5);ctx.stroke();return;
    }
    if(['wheel','sculpture','fountain'].includes(r.type)){
      const p=this.iso(r.x,r.y);ctx.strokeStyle='#647d75';ctx.fillStyle=r.type==='fountain'?'#91b0a4':'#cbd5cd';ctx.lineWidth=1;
      if(r.type==='wheel'){ctx.beginPath();ctx.ellipse(p[0],p[1]-22,16,22,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(p[0],p[1]-22);ctx.lineTo(p[0]+Math.cos(a)*16,p[1]-22+Math.sin(a)*22);ctx.stroke();ctx.fillStyle='#e0dfc8';ctx.fillRect(Math.round(p[0]+Math.cos(a)*16)-1,Math.round(p[1]-22+Math.sin(a)*22)-1,2,2);}ctx.beginPath();ctx.moveTo(p[0]-7,p[1]);ctx.lineTo(p[0],p[1]-22);ctx.lineTo(p[0]+8,p[1]);ctx.stroke();}
      else if(r.type==='sculpture'){ctx.beginPath();ctx.ellipse(p[0],p[1]-3,7,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(p[0],p[1],2,1.5,0,Math.PI,0);ctx.stroke();ctx.fillStyle='#f1eddb';ctx.fillRect(Math.round(p[0])-3,Math.round(p[1])-5,4,1);}
      else{ctx.beginPath();ctx.ellipse(p[0],p[1],8,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(p[0],p[1]-3,4,2,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e1e5c9';ctx.beginPath();ctx.moveTo(p[0],p[1]-2);ctx.quadraticCurveTo(p[0]-3,p[1]-13,p[0]-5,p[1]-2);ctx.moveTo(p[0],p[1]-2);ctx.quadraticCurveTo(p[0]+3,p[1]-13,p[0]+5,p[1]-2);ctx.stroke();}return;
    }
    for(const ring of r.polygons){
      const sides=[];
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],A=this.iso(...a),B=this.iso(...b),aTop=this.iso(...a,r.h),bTop=this.iso(...b,r.h),depth=a[0]+a[1]+b[0]+b[1];
        sides.push({a,b,A,B,aTop,bTop,depth,shade:b[0]+b[1]>a[0]+a[1]});
      }
      sides.sort((a,b)=>a.depth-b.depth);
      for(const side of sides){
        const{A,B,aTop,bTop,shade}=side;poly(ctx,[A,B,bTop,aTop],willis?(shade?'#4e5d55':'#68766a'):modern?(shade?'#708c84':'#abc0af'):(shade?'#a5987e':wall),'#776d57');
        if(modern){ctx.strokeStyle=willis?'#a0af956e':'#d1dbc18c';ctx.lineWidth=.65;for(let z=3;z<r.h;z+=3.8){ctx.beginPath();ctx.moveTo(A[0],A[1]-z);ctx.lineTo(B[0],B[1]-z);ctx.stroke();}}
        const length=Math.hypot(B[0]-A[0],B[1]-A[1]);if(length<2||r.h<5)continue;
        const cols=Math.min(20,Math.max(1,Math.floor(length/4.5))),rows=Math.max(1,Math.floor(r.h/(modern?4:5)));
        const point=(t,z)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t-z];
        for(let level=0;level<rows;level++)for(let col=0;col<cols;col++){
          const t=(col+1)/(cols+1),half=Math.min(.11,1.1/length),z=(level+.45)*r.h/rows;
          poly(ctx,[point(t-half,z),point(t+half,z),point(t+half,z+Math.min(2,r.h/rows*.48)),point(t-half,z+Math.min(2,r.h/rows*.48))],modern?(shade?'#c1ccb0':'#526f68'):(shade?'#5f6955':'#71806a'));
          if(!modern){ctx.strokeStyle='#f0dec0';ctx.lineWidth=.7;const a=point(t-half,z-.4),b=point(t+half,z-.4);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
        }
        if(['museum','palace'].includes(r.type)&&length>14){ctx.strokeStyle='#e7dfc7';ctx.lineWidth=1.2;for(let col=0;col<=cols;col++){const t=(col+.5)/(cols+1);ctx.beginPath();ctx.moveTo(...point(t,1));ctx.lineTo(...point(t,r.h-2));ctx.stroke();}}
        ctx.strokeStyle=modern?'#c2ccb5':'#eee0bf';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...point(0,r.h-1));ctx.lineTo(...point(1,r.h-1));ctx.stroke();
      }
      poly(ctx,ring.map(p=>this.iso(...p,r.h)),willis?'#7b8474':roof,'#716e58');
      const pitched=['qrc','redhouse','college','mansion','castle','cathedral'].includes(r.type),inner=ring.map(p=>[r.x+(p[0]-r.x)*.77,r.y+(p[1]-r.y)*.77]);
      poly(ctx,inner.map(p=>this.iso(...p,r.h+(pitched?3:1))),pitched?(r.type==='redhouse'||r.type==='qrc'?'#9f6c50':'#657d6d'):modern?'#c7d0ba':'#b5b59a','#8a8d70');
      if(!pitched&&ring.length>4){ctx.save();ctx.beginPath();ring.forEach((p,i)=>{const q=this.iso(...p,r.h);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();ctx.clip();const box=extent(ring.map(p=>this.iso(...p,r.h)));ctx.strokeStyle='#f1ead130';ctx.lineWidth=.6;for(let x=box.minX;x<box.maxX;x+=5){ctx.beginPath();ctx.moveTo(x,box.minY);ctx.lineTo(x+12,box.maxY);ctx.stroke();}ctx.restore();}
    }
    const p=this.iso(r.x,r.y,r.h),x=p[0],y=p[1];
    if(willis){
      const ring=r.polygons[0];for(const[scale,height]of[[.72,10],[.4,18]]){const tier=ring.map(p=>[r.x+(p[0]-r.x)*scale,r.y+(p[1]-r.y)*scale]);for(let i=1;i<tier.length;i++)poly(ctx,[this.iso(...tier[i-1],r.h),this.iso(...tier[i],r.h),this.iso(...tier[i],r.h+height),this.iso(...tier[i-1],r.h+height)],'#627365','#899880');poly(ctx,tier.map(p=>this.iso(...p,r.h+height)),'#9fa78e','#657963');}ctx.strokeStyle='#b8bfa7';ctx.lineWidth=1;for(const dx of[-3,3]){ctx.beginPath();ctx.moveTo(x+dx,y-18);ctx.lineTo(x+dx,y-32+(dx<0?0:4));ctx.stroke();}
    }else if(r.type==='qrc'||r.type==='clocktower'){
      const stone=r.type==='qrc'?'#b36b4f':'#c7b892';poly(ctx,[[x-4,y+2],[x-4,y-15],[x+3,y-18],[x+7,y-15],[x+7,y+1]],stone,'#786a50');poly(ctx,[[x-5,y-15],[x+1,y-23],[x+8,y-15]],'#526c5b','#6c7055');ctx.fillStyle='#f1e5bd';ctx.beginPath();ctx.arc(x+1,y-11,2.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#655d45';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+1,y-13);ctx.lineTo(x+1,y-11);ctx.lineTo(x+3,y-10);ctx.stroke();ctx.fillStyle='#68765e';ctx.fillRect(Math.round(x),Math.round(y)-6,2,5);
    }else if(r.type==='dome'){
      poly(ctx,[[x-7,y],[x-7,y-5],[x+6,y-5],[x+7,y]],'#c8c6a7','#8b9477');ctx.fillStyle='#849c86';ctx.strokeStyle='#617f6d';ctx.beginPath();ctx.ellipse(x,y-5,7,9,0,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#d2d6ae';for(const dx of[-3,0,3]){ctx.beginPath();ctx.moveTo(x+dx,y-5);ctx.quadraticCurveTo(x+dx*.5,y-15,x,y-14);ctx.stroke();}ctx.fillStyle='#b5a46c';ctx.fillRect(Math.round(x)-1,Math.round(y)-18,3,5);ctx.fillRect(Math.round(x),Math.round(y)-21,1,3);
    }else if(r.type==='museum'){
      ctx.fillStyle='#afc5b8';ctx.strokeStyle='#879c89';ctx.beginPath();ctx.ellipse(x,y,7,4,0,Math.PI,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#e5e7ca';ctx.beginPath();ctx.moveTo(x-6,y-1);ctx.lineTo(x+6,y-1);ctx.moveTo(x,y-4);ctx.lineTo(x,y+1);ctx.stroke();
    }else if(r.type==='napa'){
      for(const dx of[-10,0,10]){ctx.fillStyle=dx===0?'#e7e7d1':'#c7d3c4';ctx.strokeStyle='#9cae9b';ctx.beginPath();ctx.moveTo(x+dx-9,y+3);ctx.quadraticCurveTo(x+dx-3,y-16,x+dx+9,y+2);ctx.closePath();ctx.fill();ctx.stroke();}
    }else if(r.type==='bridge'){
      const b=r.box,vertical=b.maxY-b.minY>b.maxX-b.minX,points=[.28,.72].map(t=>this.iso(vertical?r.x:b.minX+(b.maxX-b.minX)*t,vertical?b.minY+(b.maxY-b.minY)*t:r.y)),tower=r.name==='Tower Bridge';
      for(const p of points){if(tower){poly(ctx,[[p[0]-3,p[1]],[p[0]-3,p[1]-17],[p[0]+3,p[1]-20],[p[0]+6,p[1]-17],[p[0]+6,p[1]]],'#c2bca0','#6a7b6b');poly(ctx,[[p[0]-4,p[1]-17],[p[0]+1,p[1]-25],[p[0]+7,p[1]-17]],'#647f74');}else{ctx.strokeStyle=r.accent||'#9a785b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(p[0],p[1]-24);ctx.stroke();}}
      ctx.strokeStyle=tower?'#718f91':r.accent||'#a7835d';ctx.lineWidth=1;for(const side of[-2,2]){ctx.beginPath();ctx.moveTo(points[0][0]+side,points[0][1]-20);ctx.quadraticCurveTo((points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2-2,points[1][0]+side,points[1][1]-20);ctx.stroke();}
    }else if(r.type==='cathedral'){poly(ctx,[[x-4,y+1],[x,y-12],[x+4,y+1]],'#5c7867','#57705d');ctx.strokeStyle='#dacda8';ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x,y-7);ctx.moveTo(x-2,y-12);ctx.lineTo(x+2,y-12);ctx.stroke();}
    else if(r.type==='castle'){for(const dx of[-5,5]){ctx.fillStyle='#b8b49b';ctx.fillRect(Math.round(x)+dx-2,Math.round(y)-7,4,9);poly(ctx,[[x+dx-3,y-7],[x+dx,y-14],[x+dx+3,y-7]],'#607e6b','#5b735c');}}
  }
  roadNames(ctx){
    if(this.camera.zoom<1.4)return;
    const names=new Set(this.labelStreets||['Frederick Street','Pembroke Street','Maraval Road','Tragarete Road','Ariapita Avenue','Wrightson Road','Independence Square North','Saint Vincent Street','St. Vincent Street','Charlotte Street']),placed=[];
    const buildings=this.landmarks.filter(feature=>feature.h>4).map(feature=>{const points=feature.polygons.flat().flatMap(p=>[this.screen(...p),this.screen(...p,feature.h+26)]);return extent(points);});
    ctx.font='6px monospace';ctx.textBaseline='middle';
    for(const road of this.roads){if(!names.has(road.name)||road.points.length<2)continue;const p=road.points[Math.floor(road.points.length/2)],s=this.screen(...p);if(s[0]<25||s[0]>this.w-50||s[1]<50||s[1]>this.h-40)continue;if(buildings.some(box=>s[0]+road.name.length*3.6>box.minX-5&&s[0]<box.maxX+5&&s[1]>box.minY-12&&s[1]<box.maxY+8))continue;if(placed.some(a=>Math.hypot(a[0]-s[0],a[1]-s[1])<48))continue;names.delete(road.name);placed.push(s);ctx.strokeStyle='#e8d9b5';ctx.lineWidth=2;ctx.strokeText(road.name,Math.round(s[0]),Math.round(s[1]));ctx.fillStyle='#605b43';ctx.fillText(road.name,Math.round(s[0]),Math.round(s[1]));}
  }
  draw(ctx,w,h,time,motion=true){
    this.resize(w,h);if(!this.ground)this.paintGround();ctx.fillStyle=C.sea;ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h/2);ctx.scale(this.scale,this.scale);ctx.translate(-this.camera.x,-this.camera.y);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.ground,...this.groundOrigin);
    if(motion)for(let i=0;i<30;i++){const x=this.width*(i*.618%1),y=this.height*(.7+(i*.173%1)*.3);if(this.landAreas.some(ring=>inside(x,y,ring))&&!this.isWater(x,y))continue;const p=this.iso(x,y);ctx.fillStyle='#d8dfc43b';ctx.fillRect(Math.round(p[0]+Math.sin(time*.6+i)*2),Math.round(p[1]),4,1);}
    for(const feature of this.pageBuildings)if(feature.page===this.activePage){for(const ring of feature.polygons)this.groundPolygon(ctx,ring,'#d3b2693b','#b08b43');}
    const objects=[...this.landmarks.filter(r=>r.h>0),...this.objects,{type:'player',x:this.player.x,y:this.player.y}].sort((a,b)=>a.x+a.y-b.x-b.y);
    for(const r of objects){if(r.type==='tree')deciduous(ctx,...this.iso(r.x,r.y),r.size,Math.round(r.x)%2);else if(r.type==='pine')pine(ctx,...this.iso(r.x,r.y),r.size,Math.round(r.x)%2);else if(r.type==='palm')palm(ctx,...this.iso(r.x,r.y),r.size,motion?time:0);else if(r.type==='player')person(ctx,...this.iso(r.x,r.y),time,this.player.moving,.22);else this.extrude(ctx,r);}
    if(this.path.length){const p=this.iso(...this.path[this.path.length-1]);ctx.strokeStyle='#f4e5b5b0';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(...p,4,2,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();this.roadNames(ctx);
  }
}
