import{rng,pine,palm,person,deciduous}from'./art.js?v=8';
import{cityStyles,drawLandmark}from'./city-models.js?v=8';
const TW=14,TH=7,METRES=100,VZ=TW/METRES*1.25;
function inside(x,y,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function nearest(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return[a[0]+dx*t,a[1]+dy*t,t];}
function extent(points){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}return{minX,minY,maxX,maxY};}
function area(points){return Math.abs(points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);}
function polygon(ctx,points,fill,stroke){if(points.length<3)return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(Math.round(p[0]),Math.round(p[1])):ctx.moveTo(Math.round(p[0]),Math.round(p[1])));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.65;ctx.stroke();}}
function hull(points){const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const lower=[],upper=[];for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}for(const p of sorted.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}return lower.slice(0,-1).concat(upper.slice(0,-1));}
function simplifyRing(ring,tolerance=.02){
  const line=ring.slice(0,-1);if(line.length<5)return ring;const split=Math.floor(line.length/2),simplify=points=>{if(points.length<3)return points;let best=0,index=0;for(let i=1;i<points.length-1;i++){const p=nearest(...points[i],points[0],points.at(-1)),d=Math.hypot(p[0]-points[i][0],p[1]-points[i][1]);if(d>best){best=d;index=i;}}return best>tolerance?[...simplify(points.slice(0,index+1)).slice(0,-1),...simplify(points.slice(index))]:[points[0],points.at(-1)];};
  const reduced=[...simplify(line.slice(0,split+1)).slice(0,-1),...simplify([...line.slice(split),line[0]])];return reduced.length>=4?reduced:ring;
}
function winding(ring){let sum=0;for(let i=1;i<ring.length;i++)sum+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];return Math.sign(sum)||1;}
function tone(hex,factor){const color=hex.replace('#','');return'#'+[0,2,4].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(color.slice(i,i+2),16)*factor))).toString(16).padStart(2,'0')).join('');}
class Spatial{
  constructor(items,size=2){this.size=size;this.cells=new Map();for(const item of items){const b=item.box;for(let y=Math.floor(b.minY/size);y<=Math.floor(b.maxY/size);y++)for(let x=Math.floor(b.minX/size);x<=Math.floor(b.maxX/size);x++){const key=x+','+y;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(item);}}}
  at(x,y){return this.cells.get(Math.floor(x/this.size)+','+Math.floor(y/this.size))||[];}
  in(box){const found=new Set();for(let y=Math.floor(box.minY/this.size);y<=Math.floor(box.maxY/this.size);y++)for(let x=Math.floor(box.minX/this.size);x<=Math.floor(box.maxX/this.size);x++)for(const item of this.cells.get(x+','+y)||[])found.add(item);return[...found];}
}
export class City{
  constructor(data){
    this.id=data.cityId;
    this.style=cityStyles[this.id];this.bounds=data.bounds;this.terrain=data.terrain;this.datum=this.terrain?.datumMeters||0;this.minElevation=this.terrain?Math.min(...this.terrain.values):0;this.maxElevation=this.terrain?Math.max(...this.terrain.values):0;
    this.longitudeScale=111320*Math.cos((data.bounds[1]+data.bounds[3])*.5*Math.PI/180)/METRES;this.latitudeScale=111320/METRES;
    this.width=(data.bounds[2]-data.bounds[0])*this.longitudeScale;this.height=(data.bounds[3]-data.bounds[1])*this.latitudeScale;
    this.landAreas=(data.landAreas||[data.land]).map(ring=>ring.map(p=>this.fromGeo(...p)));this.landBoxes=this.landAreas.map(extent);
    this.water=(data.water||[]).map(ring=>{const points=ring.map(p=>this.fromGeo(...p));return{points,box:extent(points)};});this.waterIndex=new Spatial(this.water,4);
    this.roads=data.roads.map(road=>({...road,points:road.points.map(p=>this.fromGeo(...p))}));this.labelStreets=data.labelStreets||['Frederick Street','Pembroke Street','Maraval Road','Ariapita Avenue','Wrightson Road'];
    this.parks=data.parks.map(park=>({...park,points:park.points.map(p=>this.fromGeo(...p))}));this.tropical=this.id==='port-of-spain';
    const feature=row=>{const polygons=row.polygons.map(ring=>ring.map(p=>this.fromGeo(...p))),box=extent(polygons.flat()),centre=row.centre?this.fromGeo(...row.centre):[(box.minX+box.maxX)/2,(box.minY+box.maxY)/2];const height=row.heightMeters??(row.height===0?0:9);return{...row,type:row.kind,polygons,holes:(row.holes||[]).map(ring=>ring.map(p=>this.fromGeo(...p))),box,x:centre[0],y:centre[1],h:Number.isFinite(height)?height:9,heightMeters:Number.isFinite(height)?height:9,baseElevation:Math.max(...polygons.flat().map(p=>this.elevationAt(...p))),hitFaces:[]};};
    this.landmarks=data.landmarks.map(feature);this.context=(data.contextBuildings||[]).map(feature);
    this.pageBuildings=this.landmarks.filter(row=>row.page);this.activePage=null;
    this.platforms=this.landmarks.filter(row=>['bridge','pier'].includes(row.type));
    this.bridges=this.roads.filter(road=>road.bridge).map(road=>{const ends=[road.points[0],road.points.at(-1)],height=Math.max(this.datum+5,...ends.map(p=>this.elevationAt(...p)));return{...road,box:extent(road.points),deck:height};});this.bridgeIndex=new Spatial(this.bridges,2);
    for(const p of this.platforms){p.baseElevation=this.datum;p.deck=this.datum+(p.type==='pier'?2:p.name==='Golden Gate Bridge'?67:p.name==='Tower Bridge'?9:5);}
    this.obstacles=[...this.landmarks.filter(row=>row.h>0&&!this.platforms.includes(row)),...this.context];this.buildingIndex=new Spatial(this.obstacles);
    this.keys=new Set();this.path=[];this.objects=[];this.camera={x:0,y:0,zoom:1};this.scale=1;
    for(const row of this.landmarks)row.entry=this.entrance(row);
    const start=(this.landmarks.find(row=>['square','plaza'].includes(row.type))||this.pageBuildings[0]||this.landmarks[0]).entry;this.player={x:start[0],y:start[1],moving:false};
    const projected=(this.pageBuildings.length?this.pageBuildings:this.landmarks).flatMap(row=>row.polygons.flatMap(ring=>ring.flatMap(p=>[this.modelIso(row,...p),this.modelIso(row,...p,row.h+20)]))),view=extent(projected);
    this.camera.x=(view.minX+view.maxX)/2;this.camera.y=(view.minY+view.maxY)/2-8;this.viewWidth=view.maxX-view.minX+100;this.viewHeight=view.maxY-view.minY+110;
    const random=rng(657);for(const park of this.parks){if(['pitch','stadium'].includes(park.kind)||area(park.points)<.5)continue;const box=extent(park.points),count=Math.min(45,Math.ceil(area(park.points)*.45));let planted=0;for(let i=0;i<count*10&&planted<count;i++){const x=box.minX+random()*(box.maxX-box.minX),y=box.minY+random()*(box.maxY-box.minY);if(!inside(x,y,park.points)||!this.walkable(x,y))continue;this.objects.push({type:park.kind==='forest'?'pine':this.tropical?'palm':'tree',x,y,size:.16+random()*.1});planted++;}}
    this.ground=null;this.nav=null;this.maxBuildingHeight=Math.max(30,...this.obstacles.map(row=>row.h));
  }
  fromGeo(lon,lat){return[(lon-this.bounds[0])*this.longitudeScale,(this.bounds[3]-lat)*this.latitudeScale];}
  elevationAt(x,y){
    const t=this.terrain;if(!t)return 0;const u=Math.max(0,Math.min(t.width-1,x/this.width*(t.width-1))),v=Math.max(0,Math.min(t.height-1,y/this.height*(t.height-1))),i=Math.min(t.width-2,Math.floor(u)),j=Math.min(t.height-2,Math.floor(v)),a=u-i,b=v-j;
    return(t.values[j*t.width+i]*(1-a)+t.values[j*t.width+i+1]*a)*(1-b)+(t.values[(j+1)*t.width+i]*(1-a)+t.values[(j+1)*t.width+i+1]*a)*b;
  }
  surfaceElevation(x,y){
    for(const p of this.platforms||[])if(p.polygons.some(ring=>inside(x,y,ring)))return p.deck;
    for(const road of this.bridgeIndex?.at(x,y)||[]){for(let i=1;i<road.points.length;i++){const p=nearest(x,y,road.points[i-1],road.points[i]);if(Math.hypot(x-p[0],y-p[1])<.16)return road.deck;}}
    return this.elevationAt(x,y);
  }
  rawIso(x,y,elevation){return[(x-y)*TW,(x+y)*TH-(elevation-this.datum)*VZ];}
  iso(x,y,z=0){return this.rawIso(x,y,this.surfaceElevation(x,y)+z);}
  modelIso(feature,x,y,z=0){return this.rawIso(x,y,feature.baseElevation+z);}
  toScreen(point){return[(point[0]-this.camera.x)*this.scale+this.w/2,(point[1]-this.camera.y)*this.scale+this.h/2];}
  screen(x,y,z=0){return this.toScreen(this.iso(x,y,z));}
  modelPoint(feature,x,y,z=0){return this.toScreen(this.modelIso(feature,x,y,z));}
  resize(w,h){this.w=w;this.h=h;const fit=w/h<1?Math.min(w/(this.viewWidth*.65),h/this.viewHeight):Math.min(w/this.viewWidth,h/this.viewHeight);this.scale=fit*1.04*this.camera.zoom;}
  world(sx,sy){
    const px=(sx-this.w/2)/this.scale+this.camera.x,py=(sy-this.h/2)/this.scale+this.camera.y,difference=px/TW;
    const lowHeight=Math.min(this.datum,this.minElevation),highHeight=Math.max(this.maxElevation,this.datum+70),lo=Math.max(Math.abs(difference),(py+(lowHeight-this.datum)*VZ)/TH-.02),hi=Math.min(2*this.width-difference,2*this.height+difference,(py+(highHeight-this.datum)*VZ)/TH+.02);
    const value=sum=>{const x=(sum+difference)/2,y=(sum-difference)/2;return sum*TH-(this.surfaceElevation(x,y)-this.datum)*VZ-py;};let root=null;
    if(hi>=lo){const count=Math.max(1,Math.ceil((hi-lo)/.1));let previous=lo,previousValue=value(lo);for(let i=1;i<=count;i++){const next=lo+(hi-lo)*i/count,nextValue=value(next);if(previousValue*nextValue<=0){let a=previous,b=next,fa=previousValue;for(let j=0;j<24;j++){const m=(a+b)/2,fm=value(m);if(fa*fm<=0)b=m;else{a=m;fa=fm;}}const candidate=(a+b)/2;if(Math.abs(value(candidate))<.001)root=candidate;}previous=next;previousValue=nextValue;}}
    if(root==null){root=py/TH;for(let i=0;i<4;i++)root=(py+(this.elevationAt((root+difference)/2,(root-difference)/2)-this.datum)*VZ)/TH;}
    return[(root+difference)/2,(root-difference)/2];
  }

  pan(dx,dy){this.camera.x-=dx/this.scale;this.camera.y-=dy/this.scale;this.motionUntil=performance.now()+120;}
  zoom(factor){this.camera.zoom=Math.max(1,Math.min(16,this.camera.zoom*factor));this.motionUntil=performance.now()+120;}
  labelPoint(feature){return this.modelPoint(feature,feature.x,feature.y,(feature.topHeight||feature.h)+12/Math.max(.2,this.scale*VZ));}
  focusPage(page){
    const feature=this.pageBuildings.find(row=>row.page===page);if(!feature)return;this.activePage=page;this.keys.clear();this.path=[];this.player.x=feature.entry[0];this.player.y=feature.entry[1];
    const box=extent(feature.polygons.flatMap(ring=>ring.flatMap(p=>[this.modelIso(feature,...p),this.modelIso(feature,...p,feature.h*1.15)]))),fit=this.scale/this.camera.zoom,target=Math.min(10,this.w/(box.maxX-box.minX+55),this.h/(box.maxY-box.minY+70));
    this.camera.zoom=Math.max(1,Math.min(16,target/fit));this.camera.x=(box.minX+box.maxX)/2;this.camera.y=(box.minY+box.maxY)/2;this.resize(this.w,this.h);return feature;
  }
  isWater(x,y){return this.waterIndex.at(x,y).some(row=>inside(x,y,row.points));}
  onLand(x,y){return this.landAreas.some((ring,i)=>{const b=this.landBoxes[i];return x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY&&inside(x,y,ring);});}
  onBridge(x,y){if(this.platforms.some(row=>row.polygons.some(ring=>inside(x,y,ring))))return true;for(const road of this.bridgeIndex.at(x,y))for(let i=1;i<road.points.length;i++){const p=nearest(x,y,road.points[i-1],road.points[i]);if(Math.hypot(x-p[0],y-p[1])<.16)return true;}return false;}
  inBuilding(feature,x,y){return feature.polygons.some(ring=>inside(x,y,ring))&&!feature.holes.some(ring=>inside(x,y,ring));}
  walkable(x,y){
    if(x<.05||y<.05||x>this.width-.05||y>this.height-.05)return false;if((!this.onLand(x,y)||this.isWater(x,y))&&!this.onBridge(x,y))return false;
    return!this.buildingIndex.at(x,y).some(row=>this.inBuilding(row,x,y));
  }
  entrance(feature){
    let best=Infinity,entry=null;const street=feature.entryStreet,preferred=street?this.roads.filter(road=>road.name===street):[],roads=preferred.length?preferred:this.roads.filter(road=>['primary','secondary','tertiary','residential','unclassified','pedestrian','living_street'].includes(road.kind));
    for(const road of roads)for(let i=1;i<road.points.length;i++){const p=nearest(feature.x,feature.y,road.points[i-1],road.points[i]),d=Math.hypot(p[0]-feature.x,p[1]-feature.y);if(d<best&&this.walkable(...p)){entry=p.slice(0,2);best=d;}}
    if(entry)return entry;for(let radius=.05;radius<2;radius+=.08)for(let angle=0;angle<Math.PI*2;angle+=.3){const p=[feature.x+Math.cos(angle)*radius,feature.y+Math.sin(angle)*radius];if(this.walkable(...p))return p;}return[feature.box.minX-.1,feature.y];
  }
  buildNavigation(){
    const step=.08,n=Math.ceil(this.width/step)+1,m=Math.ceil(this.height/step)+1,canvas=document.createElement('canvas');canvas.width=n;canvas.height=m;const ctx=canvas.getContext('2d');
    const draw=(rings,fill)=>{ctx.beginPath();for(const ring of rings){ring.forEach((p,i)=>i?ctx.lineTo(p[0]/step,p[1]/step):ctx.moveTo(p[0]/step,p[1]/step));ctx.closePath();}ctx.fillStyle=fill;ctx.fill('evenodd');};
    draw(this.landAreas,'#fff');for(const water of this.water)draw([water.points],'#000');for(const platform of this.platforms)draw(platform.polygons,'#fff');
    ctx.lineWidth=.3/step;ctx.strokeStyle='#fff';for(const road of this.bridges){ctx.beginPath();road.points.forEach((p,i)=>i?ctx.lineTo(p[0]/step,p[1]/step):ctx.moveTo(p[0]/step,p[1]/step));ctx.stroke();}
    for(const feature of this.obstacles)draw([...feature.polygons,...feature.holes],'#000');
    const pixels=ctx.getImageData(0,0,n,m).data,mask=new Uint8Array(n*m);for(let i=0;i<mask.length;i++)mask[i]=pixels[i*4]>160?1:0;this.nav={step,n,m,mask};
  }
  clearSegment(ax,ay,bx,by){const count=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/.018));for(let i=1;i<=count;i++)if(!this.walkable(ax+(bx-ax)*i/count,ay+(by-ay)*i/count))return false;return true;}
  pathTo(tx,ty){
    if(this.walkable(tx,ty)&&this.clearSegment(this.player.x,this.player.y,tx,ty)){this.path=[[tx,ty]];return true;}
    if(!this.nav)this.buildNavigation();const{step,n,m,mask}=this.nav;
    const closest=(x,y,connect)=>{let best=Infinity,point=null;const cx=Math.round(x/step),cy=Math.round(y/step);for(let dx=-7;dx<=7;dx++)for(let dy=-7;dy<=7;dy++){const nx=cx+dx,ny=cy+dy,d=dx*dx+dy*dy;if(nx<0||ny<0||nx>=n||ny>=m||!mask[ny*n+nx]||d>=best)continue;if(connect&&!this.clearSegment(x,y,nx*step,ny*step))continue;point=[nx,ny];best=d;}return point;};
    const start=closest(this.player.x,this.player.y,true),target=closest(tx,ty,true);if(!start||!target)return false;
    const root=start[1]*n+start[0],prev=new Int32Array(n*m).fill(-1),cost=new Float64Array(n*m).fill(Infinity),open=[];
    const push=item=>{open.push(item);let i=open.length-1;while(i>0){const parent=(i-1)>>1;if(open[parent][1]<=item[1])break;open[i]=open[parent];i=parent;}open[i]=item;};
    const pop=()=>{const first=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let child=i*2+1;if(child+1<open.length&&open[child+1][1]<open[child][1])child++;if(last[1]<=open[child][1])break;open[i]=open[child];i=child;}open[i]=last;}return first;};
    const heuristic=(x,y)=>Math.hypot(x-target[0],y-target[1]);cost[root]=0;prev[root]=root;push([root,heuristic(...start),0]);let goal=-1,visits=0;
    while(open.length&&visits++<350000){const[cell,,travel]=pop();if(Math.abs(travel-cost[cell])>.0001)continue;const x=cell%n,y=Math.floor(cell/n);if(Math.hypot(x-target[0],y-target[1])<1.5){goal=cell;break;}for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy,id=ny*n+nx,d=Math.hypot(dx,dy);if(nx<0||ny<0||nx>=n||ny>=m||!mask[id]||travel+d>=cost[id]-1e-7)continue;if(!this.clearSegment(x*step,y*step,nx*step,ny*step))continue;cost[id]=travel+d;prev[id]=cell;push([id,cost[id]+heuristic(nx,ny),cost[id]]);}}
    if(goal<0)return false;const route=[];let cell=goal;while(prev[cell]!==cell){route.push([cell%n*step,Math.floor(cell/n)*step]);cell=prev[cell];}this.path=[[start[0]*step,start[1]*step],...route.reverse()];const end=this.path.at(-1);if(this.clearSegment(...end,tx,ty))this.path.push([tx,ty]);return true;
  }
  update(dt){
    let dx=0,dy=0;const k=this.keys,p=this.player;if(k.has('arrowup')||k.has('w')){dx--;dy--;}if(k.has('arrowdown')||k.has('s')){dx++;dy++;}if(k.has('arrowleft')||k.has('a')){dx--;dy++;}if(k.has('arrowright')||k.has('d')){dx++;dy--;}
    p.moving=false;if(dx||dy){this.path=[];const length=Math.hypot(dx,dy);dx=dx/length*dt*3.3;dy=dy/length*dt*3.3;if(this.walkable(p.x+dx,p.y))p.x+=dx;if(this.walkable(p.x,p.y+dy))p.y+=dy;p.moving=true;}else if(this.path.length){const target=this.path[0],distance=Math.hypot(target[0]-p.x,target[1]-p.y),speed=dt*3.3;if(distance<=speed){p.x=target[0];p.y=target[1];this.path.shift();}else{const x=p.x+(target[0]-p.x)/distance*speed,y=p.y+(target[1]-p.y)/distance*speed;if(this.walkable(x,y)){p.x=x;p.y=y;}else this.path=[];}p.moving=true;}
    if(p.moving&&this.scale){const at=this.screen(p.x,p.y),margin=Math.min(60,this.w*.2);if(at[0]<margin)this.camera.x-=(margin-at[0])*.12/this.scale;if(at[0]>this.w-margin)this.camera.x+=(at[0]-this.w+margin)*.12/this.scale;if(at[1]<65)this.camera.y-=(65-at[1])*.12/this.scale;if(at[1]>this.h-35)this.camera.y+=(at[1]-this.h+35)*.12/this.scale;}
  }
  featureAt(sx,sy){
    const current=this.hitTransform===[this.camera.x,this.camera.y,this.scale,this.w,this.h].join(',');
    for(const feature of[...this.landmarks].sort((a,b)=>b.x+b.y-a.x-a.y)){
      if(current){if(feature.hitHoles?.some(ring=>inside(sx,sy,ring)))continue;if(feature.hitFaces?.some(face=>inside(sx,sy,face)))return feature;continue;}
      for(const ring of feature.polygons){if(inside(sx,sy,ring.map(p=>this.modelPoint(feature,...p,feature.h))))return feature;for(let i=1;i<ring.length;i++)if(inside(sx,sy,[this.modelPoint(feature,...ring[i-1]),this.modelPoint(feature,...ring[i]),this.modelPoint(feature,...ring[i],feature.h),this.modelPoint(feature,...ring[i-1],feature.h)]))return feature;}
      const p=this.modelPoint(feature,feature.x,feature.y,feature.h*.4);if(Math.hypot(sx-p[0],sy-p[1])<6)return feature;
    }return null;
  }

  select(sx,sy){const feature=this.featureAt(sx,sy);this.pathTo(...(feature?feature.entry:this.world(sx,sy)));return feature;}
  groundPath(ctx,rings){ctx.beginPath();for(const ring of rings){let index=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5));for(let j=0;j<steps;j++){const p=this.iso(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps);index++?ctx.lineTo(...p):ctx.moveTo(...p);}}ctx.closePath();}}
  paintGround(){
    const points=[];for(let y=0;y<=this.height;y+=.5){points.push(this.iso(0,y),this.iso(this.width,y));}for(let x=0;x<=this.width;x+=.5)points.push(this.iso(x,0),this.iso(x,this.height));const box=extent(points),resolution=2,pad=8;
    this.groundOrigin=[Math.floor(box.minX)-pad,Math.floor(box.minY)-pad];const canvas=document.createElement('canvas');canvas.width=Math.ceil(box.maxX-box.minX+pad*2)*resolution;canvas.height=Math.ceil(box.maxY-box.minY+pad*2)*resolution;const ctx=canvas.getContext('2d');ctx.scale(resolution,resolution);ctx.translate(-this.groundOrigin[0],-this.groundOrigin[1]);
    ctx.save();this.groundPath(ctx,this.landAreas);ctx.clip('evenodd');
    const step=.65,cells=[];for(let y=0;y<this.height;y+=step)for(let x=0;x<this.width;x+=step)cells.push([x,y]);cells.sort((a,b)=>a[0]+a[1]-b[0]-b[1]);
    for(const[x,y]of cells){const x1=Math.min(this.width,x+step),y1=Math.min(this.height,y+step),slopeX=(this.elevationAt(x1,y)-this.elevationAt(x,y))/(step*100),slopeY=(this.elevationAt(x,y1)-this.elevationAt(x,y))/(step*100),light=Math.max(.82,Math.min(1.08,1+(slopeX+slopeY)*.24));const corners=[this.iso(x,y),this.iso(x1,y),this.iso(x1,y1),this.iso(x,y1)];ctx.fillStyle=tone(this.style.ground,light);ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}
    for(const park of this.parks){this.groundPath(ctx,[park.points]);ctx.fillStyle=park.kind==='forest'?this.style.forest:this.style.park;ctx.fill();}
    for(const building of this.context){this.groundPath(ctx,[...building.polygons,...building.holes]);ctx.fillStyle=tone(this.style.contextRoof,.96);ctx.fill('evenodd');}
    ctx.restore();
    for(const water of this.water){this.groundPath(ctx,[water.points]);ctx.fillStyle=this.style.water;ctx.fill();}
    for(const platform of this.platforms){this.groundPath(ctx,platform.polygons);ctx.fillStyle='#bac4b1';ctx.fill();}
    const weight={motorway:1.8,trunk:1.7,primary:1.4,secondary:1.1,tertiary:.8,unclassified:.5,residential:.5,living_street:.4,pedestrian:.4,footway:.15,path:.15};ctx.lineJoin='round';ctx.lineCap='round';
    for(const road of this.roads){const width=weight[road.kind]||.25;ctx.beginPath();for(let i=0;i<road.points.length;i++){const a=road.points[i],b=road.points[Math.min(i+1,road.points.length-1)],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.4));for(let j=0;j<steps;j++){const p=this.iso(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps);i||j?ctx.lineTo(...p):ctx.moveTo(...p);}}ctx.strokeStyle=this.style.road;ctx.globalAlpha=width>=1?.85:width>=.4?.5:.25;ctx.lineWidth=width;ctx.stroke();}ctx.globalAlpha=1;
    ctx.save();this.groundPath(ctx,this.landAreas);ctx.clip('evenodd');ctx.fillStyle='#394f381e';for(const feature of this.obstacles){const dx=feature.h*.006,dy=feature.h*.003;for(const ring of feature.polygons){const points=hull(ring.flatMap(p=>[this.iso(...p),this.iso(p[0]+dx,p[1]+dy)]));ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}}ctx.restore();
    const oval=this.landmarks.find(row=>row.type==='oval');if(oval){this.groundPath(ctx,oval.polygons);ctx.fillStyle=this.style.park;ctx.fill();}
    this.ground=canvas;this.groundResolution=resolution;
  }
  contextFaces(feature){
    const detail=this.scale>=3?'fine':'coarse';feature.meshes??={};if(!feature.meshes[detail]){
      const faces=[],variant=(String(feature.id).split('').reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%7-3)*.018,wall=feature.h>=40?this.style.glass:this.style.contextWall,roof=feature.h>=40?this.style.metal:this.style.contextRoof;
      for(const original of feature.polygons){const ring=simplifyRing(original,detail==='fine'?.008:.025),holes=feature.holes.filter(hole=>inside(hole[0][0],hole[0][1],original)).map(hole=>simplifyRing(hole,detail==='fine'?.008:.025));
        for(const sideRing of[ring,...holes])for(let i=1;i<sideRing.length;i++){const a=sideRing[i-1],b=sideRing[i],depth=a[0]+a[1]+b[0]+b[1];if(((b[1]-a[1])-(b[0]-a[0]))*winding(sideRing)*(sideRing===ring?1:-1)<=0)continue;faces.push({points:[this.rawIso(...a,this.elevationAt(...a)),this.rawIso(...b,this.elevationAt(...b)),this.modelIso(feature,...b,feature.h),this.modelIso(feature,...a,feature.h)],fill:tone(wall,(b[0]+b[1]>a[0]+a[1]?.84:1)+variant),depth});}
        faces.push({points:ring.map(p=>this.modelIso(feature,...p,feature.h)),holes:holes.map(hole=>hole.map(p=>this.modelIso(feature,...p,feature.h))),fill:tone(roof,1+variant),depth:Infinity});
      }feature.meshes[detail]=faces.sort((a,b)=>a.depth-b.depth);
    }
    if(feature.projected?.key===this.hitTransform)return feature.projected.faces;const projected=feature.meshes[detail].map(face=>({...face,points:face.points.map(p=>this.toScreen(p)),holes:face.holes?.map(ring=>ring.map(p=>this.toScreen(p)))}));feature.projected={key:this.hitTransform,faces:projected};return projected;
  }

  landmarkSprite(ctx,feature){
    let sprite=feature.sprite,dx=sprite?(sprite.cameraX-this.camera.x)*this.scale:0,dy=sprite?(sprite.cameraY-this.camera.y)*this.scale:0,reuse=sprite?.key===this.geometryTransform;
    if(reuse){const b=sprite.box,left=Math.max(-40,b.minX+dx-12),top=Math.max(-40,b.minY+dy-12),right=Math.min(this.w+40,b.maxX+dx+12),bottom=Math.min(this.h+40,b.maxY+dy+12);reuse=left>=sprite.left+dx-.5&&top>=sprite.top+dy-.5&&right<=sprite.left+dx+sprite.canvas.width+.5&&bottom<=sprite.top+dy+sprite.canvas.height+.5;}
    if(!reuse){
      if(sprite){sprite.canvas.width=0;sprite.canvas.height=0;feature.sprite=null;}
      const points=feature.polygons.flatMap(ring=>ring.flatMap(p=>[this.modelPoint(feature,...p),this.modelPoint(feature,...p,Math.max(feature.h*1.2,feature.topHeight||0)+15)])),box=extent(points),left=Math.max(-40,Math.floor(box.minX-12)),top=Math.max(-40,Math.floor(box.minY-12)),right=Math.min(this.w+40,Math.ceil(box.maxX+12)),bottom=Math.min(this.h+40,Math.ceil(box.maxY+12));if(right<=left||bottom<=top)return;
      const canvas=document.createElement('canvas');canvas.width=right-left;canvas.height=bottom-top;const image=canvas.getContext('2d');image.translate(-left,-top);feature.hitFaces=[];feature.hitHoles=[];drawLandmark(image,feature,this);sprite={key:this.geometryTransform,canvas,left,top,box,cameraX:this.camera.x,cameraY:this.camera.y,faces:feature.hitFaces,holes:feature.hitHoles};feature.sprite=sprite;dx=0;dy=0;
    }
    dx=Math.round(dx);dy=Math.round(dy);feature.hitFaces=dx||dy?sprite.faces.map(ring=>ring.map(p=>[p[0]+dx,p[1]+dy])):sprite.faces;feature.hitHoles=dx||dy?sprite.holes.map(ring=>ring.map(p=>[p[0]+dx,p[1]+dy])):sprite.holes;ctx.drawImage(sprite.canvas,sprite.left+dx,sprite.top+dy);
  }

  foundation(feature){for(const ring of feature.polygons)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(Math.max(feature.baseElevation-this.elevationAt(...a),feature.baseElevation-this.elevationAt(...b))<1)continue;polygon(this.ctx,[this.screen(...a),this.screen(...b),this.modelPoint(feature,...b),this.modelPoint(feature,...a)],tone(this.style.contextWall,.8));}}
  visibleBuildings(){const points=[[0,0],[this.w,0],[0,this.h],[this.w,this.h]].map(p=>this.world(...p)),box=extent(points),pad=this.maxBuildingHeight/METRES+2;box.minX-=pad;box.minY-=pad;box.maxX+=pad;box.maxY+=pad;return this.buildingIndex.in(box);}
  dispose(){if(this.ground){this.ground.width=0;this.ground.height=0;}for(const feature of this.landmarks)if(feature.sprite){feature.sprite.canvas.width=0;feature.sprite.canvas.height=0;}this.ctx=null;}
  draw(ctx,w,h,time,motion=true){
    const inheritedAlpha=ctx.globalAlpha;this.resize(w,h);this.ctx=ctx;if(!this.ground)this.paintGround();ctx.fillStyle=this.id==='london'?this.style.ground:this.style.water;ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=false;const origin=this.toScreen(this.groundOrigin);ctx.drawImage(this.ground,...origin,this.ground.width/this.groundResolution*this.scale,this.ground.height/this.groundResolution*this.scale);
    for(const feature of this.landmarks){feature.hitFaces=[];feature.hitHoles=[];}this.hitTransform=[this.camera.x,this.camera.y,this.scale,this.w,this.h].join(',');this.geometryTransform=[this.scale,this.w,this.h].join(',');
    const selected=this.pageBuildings.find(row=>row.page===this.activePage),selectedAt=selected?this.modelPoint(selected,selected.x,selected.y,selected.h*.5):this.screen(this.player.x,this.player.y),moving=performance.now()<(this.motionUntil||0),selectionKey=this.hitTransform+','+this.activePage+','+moving;
    let context=this.contextSelection?.key===selectionKey?this.contextSelection.context:null;
    if(!context){const ranked=[],limit=moving?96:this.activePage?300:240,rankingAt=selected?selectedAt:[w/2,h/2];const offer=(feature,score)=>{if(ranked.length===limit&&score<=ranked[0].score)return;const item={feature,score};if(ranked.length<limit){ranked.push(item);let i=ranked.length-1;while(i>0){const p=(i-1)>>1;if(ranked[p].score<=score)break;ranked[i]=ranked[p];i=p;}ranked[i]=item;}else{let i=0;while(i*2+1<ranked.length){let child=i*2+1;if(child+1<ranked.length&&ranked[child+1].score<ranked[child].score)child++;if(score<=ranked[child].score)break;ranked[i]=ranked[child];i=child;}ranked[i]=item;}};for(const feature of this.visibleBuildings()){if(this.landmarks.includes(feature))continue;const b=feature.box,roofWidth=(b.maxX-b.minX+b.maxY-b.minY)*TW*this.scale,roofDepth=roofWidth*.5,height=feature.h*VZ*this.scale,p=this.modelPoint(feature,feature.x,feature.y,feature.h*.5);if(p[0]+roofWidth/2<0||p[0]-roofWidth/2>w||p[1]+height/2+roofDepth/2<0||p[1]-height/2-roofDepth/2>h||height<.6||roofWidth<2.5)continue;const distance=Math.hypot(p[0]-rankingAt[0],p[1]-rankingAt[1]),score=roofWidth*Math.sqrt(height)/(1+distance/(Math.min(w,h)*.6));offer(feature,score);}context=ranked.map(row=>row.feature);this.contextSelection={key:selectionKey,context};}

    const objects=[...context,...this.landmarks.filter(row=>row.h>0),...this.objects,{type:'player',x:this.player.x,y:this.player.y}].sort((a,b)=>a.x+a.y-b.x-b.y);this.drawnContext=context.length;

    for(const feature of objects){
      const p=feature.polygons?this.modelPoint(feature,feature.x,feature.y,feature.h*.5):this.screen(feature.x,feature.y);if(p[0]<-150||p[0]>w+150||p[1]<-160||p[1]>h+150)continue;
      if(feature.type==='tree'||feature.type==='palm'||feature.type==='pine'){const size=feature.size*Math.max(.8,this.scale);if(feature.type==='palm')palm(ctx,...p,size,motion?time:0);else if(feature.type==='pine')pine(ctx,...p,size,Math.round(feature.x)%2);else deciduous(ctx,...p,size,Math.round(feature.x)%2);continue;}
      if(feature.type==='player'){ctx.strokeStyle=this.style.accent;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p[0],p[1]+1,3,1.5,0,0,Math.PI*2);ctx.stroke();person(ctx,...p,time,this.player.moving,Math.min(.4,Math.max(.2,this.scale*.12)));continue;}
      if(this.landmarks.includes(feature)){this.foundation(feature);this.landmarkSprite(ctx,feature);continue;}
      const roof=feature.polygons.flat().map(v=>this.modelPoint(feature,...v,feature.h)),box=extent(roof),height=feature.h*VZ*this.scale;if(height<.35||(box.maxX-box.minX)*(box.maxY-box.minY)<3)continue;
      const fades=selectedAt&&selected!==feature&&feature.x+feature.y>(selected||this.player).x+(selected||this.player).y&&selectedAt[0]>box.minX-5&&selectedAt[0]<box.maxX+5&&selectedAt[1]>box.minY&&selectedAt[1]<box.maxY+height;
      ctx.globalAlpha=inheritedAlpha*(fades?.3:1);
      if(feature.batchKey!==this.geometryTransform){const batches=new Map();for(const face of this.contextFaces(feature)){const key=face.fill+(face.depth===Infinity?'roof':'wall');if(!batches.has(key))batches.set(key,{fill:face.fill,roof:face.depth===Infinity,rings:[]});const batch=batches.get(key);batch.rings.push(face.points);if(face.holes)batch.rings.push(...face.holes);}feature.batches=[...batches.values()];for(const batch of feature.batches){if(typeof Path2D==='undefined')continue;batch.path=new Path2D();for(let ring of batch.rings){if(!batch.roof&&winding(ring.concat([ring[0]]))<0)ring=ring.slice().reverse();ring.forEach((p,i)=>i?batch.path.lineTo(Math.round(p[0]),Math.round(p[1])):batch.path.moveTo(Math.round(p[0]),Math.round(p[1])));batch.path.closePath();}}feature.batchKey=this.geometryTransform;feature.batchCamera=[this.camera.x,this.camera.y];}
      ctx.save();ctx.translate(Math.round((feature.batchCamera[0]-this.camera.x)*this.scale),Math.round((feature.batchCamera[1]-this.camera.y)*this.scale));for(const batch of feature.batches){ctx.fillStyle=batch.fill;if(batch.path){ctx.fill(batch.path,batch.roof?'evenodd':'nonzero');continue;}ctx.beginPath();for(let ring of batch.rings){if(!batch.roof&&winding(ring.concat([ring[0]]))<0)ring=ring.slice().reverse();ring.forEach((p,i)=>i?ctx.lineTo(Math.round(p[0]),Math.round(p[1])):ctx.moveTo(Math.round(p[0]),Math.round(p[1])));ctx.closePath();}ctx.fill(batch.roof?'evenodd':'nonzero');}ctx.restore();ctx.globalAlpha=inheritedAlpha;

    }
    if(this.camera.zoom>=3){ctx.font='6px monospace';ctx.textBaseline='middle';let count=0;const names=new Set(this.labelStreets);for(const road of this.roads){if(!names.has(road.name))continue;const p=this.screen(...road.points[Math.floor(road.points.length/2)]);if(p[0]<30||p[0]>w-70||p[1]<60||p[1]>h-35)continue;if(this.landmarks.some(row=>{const q=this.modelPoint(row,row.x,row.y,row.h*.5);return Math.hypot(q[0]-p[0],q[1]-p[1])<55;}))continue;ctx.lineWidth=2;ctx.strokeStyle=this.style.ground;ctx.strokeText(road.name,...p);ctx.fillStyle=this.style.ink;ctx.fillText(road.name,...p);names.delete(road.name);if(++count===3)break;}}
  }
}
