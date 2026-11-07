/*
 * Hand-built landmark models for the isometric city scenes.
 * Coordinates are local XY metres / 100; elevations passed to modelPoint are metres.
 * All drawing happens in final screen pixels with the canvas at identity transform.
 */

export const cityStyles = {
  'port-of-spain': {
    ground:'#d8cba8', water:'#61999b', park:'#9da978', forest:'#71865d', road:'#c5b18f',
    contextWall:'#cfb99b', contextRoof:'#b16b4c', ink:'#51443a', accent:'#a94f3c',
    stone:'#d7c5a3', roof:'#a85a43', glass:'#a5c6c3', dark:'#52625e', metal:'#92aaa3',
  },
  london: {
    ground:'#cccfc5', water:'#739093', park:'#9eaa92', forest:'#798b78', road:'#b7bcb6',
    contextWall:'#b5b8b0', contextRoof:'#6f7474', ink:'#484c4b', accent:'#738176',
    stone:'#c8c4b5', roof:'#777b79', glass:'#9eafad', dark:'#565b59', metal:'#929995',
  },
  chicago: {
    ground:'#c4c9c8', water:'#5b8d9a', park:'#9aa786', forest:'#71856f', road:'#aeb8b8',
    contextWall:'#aeb9b9', contextRoof:'#6f7f83', ink:'#414b4c', accent:'#a36d50',
    stone:'#cbc9bd', roof:'#848b88', glass:'#789ba0', dark:'#34464a', metal:'#a2ada9',
  },
  'san-francisco': {
    ground:'#d1d4c9', water:'#6b98a3', park:'#a1ad95', forest:'#778a7b', road:'#bec4be',
    contextWall:'#c5c8c0', contextRoof:'#a37f6b', ink:'#484d4b', accent:'#bd6044',
    stone:'#d0d0c6', roof:'#7b8582', glass:'#9cb8b7', dark:'#46595a', metal:'#aab8b2',
  },
};

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const roundPoint=p=>[Math.round(p[0]),Math.round(p[1])];

function bounds(feature){
  if(feature.box&&Number.isFinite(feature.box.minX))return feature.box;
  const pts=(feature.polygons||[]).flat();
  return {minX:Math.min(...pts.map(p=>p[0])),minY:Math.min(...pts.map(p=>p[1])),maxX:Math.max(...pts.map(p=>p[0])),maxY:Math.max(...pts.map(p=>p[1]))};
}
function projection(city,feature,x,y,z=0){return roundPoint(city.modelPoint(feature,x,y,z));}
function screenPolygon(ctx,city,feature,verts,fill,stroke){
  const pts=verts.map(([x,y,z=0])=>projection(city,feature,x,y,z));
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  return pts;
}
function screenLine(ctx,city,feature,verts,color,width=1){
  const pts=verts.map(([x,y,z=0])=>projection(city,feature,x,y,z));
  if(pts.length<2)return pts;
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
  ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,Math.round(width));ctx.lineCap='square';ctx.lineJoin='miter';ctx.stroke();return pts;
}
function record(feature,pts){if(pts&&pts.length>=3)feature.hitFaces.push(pts);}

function footprintSolid(ctx,city,feature,height,wall,roof,opts={}){
  const polygons=feature.polygons||[], faces=[];
  for(const ring of polygons){
    if(!ring||ring.length<3)continue;
    const clean=ring.length>3&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]?ring.slice(0,-1):ring;
    for(let i=0;i<clean.length;i++){
      const a=clean[i],b=clean[(i+1)%clean.length];
      const pts=[[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],height],[a[0],a[1],height]];
      const projected=pts.map(p=>projection(city,feature,...p));
      const depth=projected.reduce((s,p)=>s+p[1],0)/4;
      const shade=(Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1]))?1:0;
      faces.push({pts,depth,shade});
    }
  }
  // Courtyard walls are real inner edges; leave their roof volume open.
  for(const ring of feature.holes||[]){
    if(!ring||ring.length<3)continue;
    const clean=ring.length>3&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1]?ring.slice(0,-1):ring;
    for(let i=0;i<clean.length;i++){
      const a=clean[i],b=clean[(i+1)%clean.length],pts=[[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],height],[a[0],a[1],height]];
      const projected=pts.map(p=>projection(city,feature,...p));
      faces.push({pts,depth:projected.reduce((s,p)=>s+p[1],0)/4,shade:Math.abs(b[0]-a[0])>Math.abs(b[1]-a[1])?1:0,interior:true});
    }
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const f of faces){
    const fill=f.shade?wall:opts.lightWall||wall;
    const pts=screenPolygon(ctx,city,feature,f.pts,fill,opts.outline||'');record(feature,pts);
    if(opts.windows)facadeWindows(ctx,city,feature,f.pts,opts.window||'#53605a');
  }
  // One even-odd roof path cuts true courtyards back to the terrain instead of capping them.
  ctx.beginPath();
  const topRings=[...(feature.polygons||[]),...(feature.holes||[])];
  for(const ring of topRings){
    if(!ring||ring.length<3)continue;
    ring.forEach((p,i)=>{const q=projection(city,feature,p[0],p[1],height);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();
  }
  ctx.fillStyle=roof;ctx.fill('evenodd');
  ctx.strokeStyle=opts.outline||'#77766c';ctx.lineWidth=1;
  for(const ring of topRings){if(!ring||ring.length<3)continue;const pts=ring.map(p=>projection(city,feature,p[0],p[1],height));ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();}
  if((feature.holes||[]).length){
    feature.hitHoles=(feature.holes||[]).map(r=>r.map(p=>projection(city,feature,p[0],p[1],height)));
  }else{
    for(const ring of polygons){const pts=ring.map(p=>projection(city,feature,p[0],p[1],height));record(feature,pts);}
  }
}

function facadeWindows(ctx,city,feature,quad,color){
  const p=quad.map(v=>projection(city,feature,...v));
  const width=(Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]));
  const height=(Math.hypot(p[3][0]-p[0][0],p[3][1]-p[0][1]));
  if(width<9||height<8)return;
  const cols=clamp(Math.floor(width/6),1,18),rows=clamp(Math.floor(height/7),1,28);
  ctx.fillStyle=color;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const t=(col+.5)/cols,v=(row+.5)/rows;
    const bottom=[p[0][0]+(p[1][0]-p[0][0])*t,p[0][1]+(p[1][1]-p[0][1])*t];
    const top=[p[3][0]+(p[2][0]-p[3][0])*t,p[3][1]+(p[2][1]-p[3][1])*t];
    const x=Math.round(bottom[0]+(top[0]-bottom[0])*v),y=Math.round(bottom[1]+(top[1]-bottom[1])*v);
    ctx.fillRect(x, y, width>26?2:1, height>18?2:1);
  }
}

function rectangle(cx,cy,w,d){return [[cx-w/2,cy-d/2],[cx+w/2,cy-d/2],[cx+w/2,cy+d/2],[cx-w/2,cy+d/2],[cx-w/2,cy-d/2]];}
function prism(ctx,city,feature,ring,height,wall,roof,opts={}){
  const old=feature.polygons;feature.polygons=[ring];footprintSolid(ctx,city,feature,height,wall,roof,opts);feature.polygons=old;
}
function capPrism(ctx,city,feature,cx,cy,w,d,z,height,wall,roof){
  const ring=rectangle(cx,cy,w,d);
  // Cap is placed above the base while keeping the feature's sampled terrain elevation.
  const poly=(verts,fill,stroke)=>screenPolygon(ctx,city,feature,verts.map(([x,y,zz])=>[x,y,zz+z]),fill,stroke);
  for(let i=0;i<4;i++){
    const a=ring[i],b=ring[i+1];
    const pts=[[a[0],a[1],0],[b[0],b[1],0],[b[0],b[1],height],[a[0],a[1],height]];
    record(feature,poly(pts,wall,'#77766c'));
  }
  record(feature,poly(ring.slice(0,4).map(p=>[p[0],p[1],height]),roof,'#68685f'));
}

function drawWindowsOnFront(ctx,city,feature,ring,z,height,count,color){
  const a=ring[0],b=ring[1],n=Math.max(2,count|0);
  for(let i=0;i<n;i++){
    const t=(i+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
    const w=Math.max(.008,Math.hypot(b[0]-a[0],b[1]-a[1])/(n*3.8));
    for(const f of [.3,.62]){
      const zz=z+height*f, p=projection(city,feature,x,y,zz);
      ctx.fillStyle=color;ctx.fillRect(p[0]-1,p[1]-1,2,2);
    }
  }
}

function dome(ctx,city,feature,cx,cy,rx,ry,zBase,height,material,segments=12){
  const levels=5,rings=[];
  for(let j=0;j<=levels;j++){
    const t=j/levels,angle=t*Math.PI/2,r=Math.cos(angle),z=zBase+height*Math.sin(angle),ring=[];
    for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2;ring.push([cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,z]);
    }
    rings.push(ring);
  }
  for(let j=0;j<levels;j++)for(let i=0;i<segments;i++){
    const color=i%2?material:'#c7c7b4';
    const pts=[rings[j][i],rings[j][i+1],rings[j+1][i+1],rings[j+1][i]];
    record(feature,screenPolygon(ctx,city,feature,pts,color,'#777d76'));
  }
  const top=projection(city,feature,cx,cy,zBase+height);
  return top;
}

function colonnade(ctx,city,feature,ring,z,height,count,color){
  const a=ring[0],b=ring[1];
  for(let i=0;i<count;i++){
    const t=(i+.5)/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
    screenLine(ctx,city,feature,[[x,y,z],[x,y,z+height]],color,Math.max(1,(city.scale||1)*.035));
  }
}

function tower(ctx,city,feature,cx,cy,w,d,z,h,wall,roof,options={}){
  capPrism(ctx,city,feature,cx,cy,w,d,z,h,wall,roof);
  const base=rectangle(cx,cy,w,d);
  if(options.bands){
    for(let f=.18;f<.9;f+=.2)for(let i=0;i<4;i++){
      const a=base[i],b=base[i+1];screenLine(ctx,city,feature,[[a[0],a[1],z+h*f],[b[0],b[1],z+h*f]],options.bands,1);
    }
  }
  if(options.windows)drawWindowsOnFront(ctx,city,feature,base,z,h,Math.max(2,Math.floor(w*20)),options.windows);
  return z+h;
}

function labelKey(city,feature){
  const n=(feature.name||'').toLowerCase();
  if(n.includes('willis'))return 'willis';
  if(n.includes('wrigley'))return 'wrigley';
  if(n.includes('art institute'))return 'art-institute';
  if(n.includes('field museum'))return 'field-museum';
  if(n.includes('cloud gate'))return 'cloud-gate';
  if(n.includes('buckingham fountain'))return 'fountain';
  if(n.includes('navy pier'))return 'navy-pier';
  if(n.includes('national academy'))return 'napa';
  if(n.includes('st. mary')||n.includes('st mary'))return 'st-marys';
  if(n.includes('queen')&&n.includes('royal college'))return 'qrc';
  if(n.includes('red house'))return 'red-house';
  if(n.includes('holy trinity'))return 'holy-trinity';
  if(n.includes('waterfront centre'))return 'waterfront';
  if(n.includes('hyatt'))return 'hotel';
  if(n.includes('st paul'))return 'st-pauls';
  if(n.includes('palace of westminster'))return 'westminster';
  if(n.includes('elizabeth tower'))return 'elizabeth-tower';
  if(n.includes('buckingham palace'))return 'buckingham-palace';
  if(n.includes('westminster abbey'))return 'abbey';
  if(n.includes('british museum'))return 'british-museum';
  if(n.includes('tower of london'))return 'tower-london';
  if(n.includes('tower bridge'))return 'tower-bridge';
  if(n.includes('london eye'))return 'london-eye';
  if(n.includes('city hall'))return 'city-hall';
  if(n.includes('transamerica'))return 'transamerica';
  if(n.includes('san francisco museum')||n.includes('sfmoma'))return 'sfmoma';
  if(n.includes('ferry building'))return 'ferry-building';
  if(n.includes('golden gate'))return 'golden-gate';
  if(n.includes('coit tower'))return 'coit-tower';
  if(n.includes('palace of fine arts'))return 'palace-fine-arts';
  if(n.includes('tower')&&city.id==='port-of-spain')return 'waterfront';
  if(feature.type==='mansion'||n.includes('house'))return 'caribbean-house';
  return feature.type||'building';
}

function drawWillis(ctx,city,f,b,style,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY,cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2;
  const gap=Math.min(w,d)*.045,cw=(w-gap*2)/3,cd=(d-gap*2)/3;
  const ratios=[[.68,.68,.68],[.78,.78,.78],[.88,.88,1]];
  let top=0;
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const x=b.minX+col*(cw+gap)+cw/2,y=b.minY+row*(cd+gap)+cd/2,z=h*ratios[row][col];
    prism(ctx,city,f,rectangle(x,y,cw,cd),z,style.dark,style.glass,{lightWall:'#52666a',windows:style.metal,outline:'#364b4d'});top=Math.max(top,z);
    const corners=rectangle(x,y,cw,cd).slice(0,4);
    for(const corner of corners)screenLine(ctx,city,f,[[corner[0],corner[1],0],[corner[0],corner[1],z]],'#718985',1);
  }
  f.topHeight=top;
}

function drawNapa(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY,cx=f.x,cy=f.y;
  footprintSolid(ctx,city,f,h*.28,'#776f5f','#b9c8c1',{windows:'#668785',lightWall:'#9a9c8b',outline:'#747a6d'});
  const petals=[[-.22,.0,.25],[-.03,-.1,.34],[.19,.04,.26]];
  let top=h*.28;
  for(const[dx,dy,r]of petals){
    const z=dome(ctx,city,f,cx+dx*w,cy+dy*d,w*r,d*.42,h*.2,h*.78,'#a8c3bf',10);
    screenLine(ctx,city,f,[[cx+dx*w-w*r,cy+dy*d,h*.25],[cx+dx*w,cy+dy*d,h*.25+h*.5],[cx+dx*w+w*r,cy+dy*d,h*.25]],'#d7ddd0',1.4);
    top=Math.max(top,h*.98);
  }
  // A restrained red Chaconia petal accent at the entrance, not a full roof recolour.
  screenLine(ctx,city,f,[[cx-w*.08,cy+d*.3,h*.06],[cx,cy+d*.3,h*.18],[cx+w*.08,cy+d*.3,h*.06]],s.accent,2);
  f.topHeight=top;
}

function drawWaterfront(ctx,city,f,b,s,h){
  // Each mapped footprint is one of the two separate International Waterfront towers.
  footprintSolid(ctx,city,f,h*.96,'#9aaba8','#afbfba',{windows:'#657d7d',lightWall:'#b2c1bb',outline:'#718481'});
  f.topHeight=h;
}

function drawHotel(ctx,city,f,b,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.88,'#b9c4c0','#c6cec7',{windows:'#718988',lightWall:'#d1d6cc',outline:'#7c8984'});
  capPrism(ctx,city,f,f.x,f.y,w*.7,d*.7,h*.88,h*.12,'#aebbb7','#d0d7ce');
  f.topHeight=h;
}

function drawWrigley(ctx,city,f,s,h){
  const polys=f.polygons||[],b=bounds(f),w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.68,'#c5c4b8','#e4e1d4',{windows:'#747c75',lightWall:'#d7d3c5',outline:'#857d6c'});
  const towers=polys.length>1?polys.map(r=>r.slice(0,-1)): [rectangle(f.x,f.y,w*.25,d*.28),rectangle(f.x+w*.18,f.y-d*.05,w*.2,d*.24)];
  for(let i=0;i<towers.length;i++){
    const ring=towers[i],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    capPrism(ctx,city,f,cx,cy,w*.17,d*.14,h*.68,h*.18,'#d8d7ca','#eeece0');
  }
  const x=f.x,y=f.y+h*0;const tw=w*.10,td=d*.12;
  tower(ctx,city,f,x,y,tw,td,h*.68,h*.32,'#c7c7bb','#e8e6d8',{bands:'#a3a69b'});
  const p=projection(city,f,x,y,h);ctx.fillStyle=s.ink;ctx.font='bold 5px monospace';ctx.textAlign='center';ctx.fillText('12',p[0],p[1]);
  f.topHeight=h;
}

function drawBritishMuseum(ctx,city,f,b,s,h){
  const ring=(f.polygons||[])[0]||[],w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.72,'#bdb39f','#d8d0bc',{windows:'#6e7069',lightWall:'#cdc3af',outline:'#807766'});
  const front=rectangle(f.x,b.minY+d*.18,w*.73,d*.12);
  const count=clamp(Math.floor(w*15),5,16);
  colonnade(ctx,city,f,front,h*.72,h*.2,count,'#aaa28f');
  // Full triangular pediment above the long south entrance colonnade.
  const y=b.minY+d*.18,z=h*.72,half=w*.37;
  record(f,screenPolygon(ctx,city,f,[[f.x-half,y,z],[f.x+half,y,z],[f.x,y,z+h*.26]],'#cfc5af','#847c6b'));
  // The reading-room drum/court is suggested as a small, unmistakable central rotunda.
  dome(ctx,city,f,f.x,f.y,w*.16,d*.2,h*.72,h*.18,'#9da9a3',12);f.topHeight=h*.98;
}

function drawStPauls(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.30,'#bdb7a8','#d8d0bd',{windows:'#666b65',lightWall:'#d0c8b5',outline:'#81796b'});
  const rx=w*.19,ry=d*.25,z=h*.30;
  // Drum, its ring of supporting piers, outer dome and lantern.
  const drum=rectangle(f.x,f.y,rx*2,ry*1.25);capPrism(ctx,city,f,f.x,f.y,rx*2,ry*1.25,z,h*.10,'#bbb5a6','#d1c8b4');
  colonnade(ctx,city,f,drum,z,h*.10,12,'#827d70');
  dome(ctx,city,f,f.x,f.y,rx,ry,z+h*.10,h*.28,'#bbb5a6',16);
  tower(ctx,city,f,f.x,f.y,rx*.28,ry*.28,h*.68,h*.32,'#c6beab','#d8cfbc');
  // West towers flank the nave; small enough to read as a paired skyline cue.
  for(const dx of[-.34,.34])tower(ctx,city,f,f.x+dx*w,f.y+d*.3,w*.13,d*.16,h*.30,h*.20,'#c0b8a6','#d5ccb8');
  f.topHeight=h;
}

function drawPalace(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.34,'#b5aa92','#d1c2a5',{windows:'#69695f',lightWall:'#c8b99e',outline:'#7e7668'});
  const offsets=[[-.43,-.35],[.43,-.35],[-.43,.35],[.43,.35]];
  for(const[dx,dy]of offsets)tower(ctx,city,f,f.x+dx*w,f.y+dy*d,w*.1,d*.13,h*.34,h*.38,'#b7aa91','#cec0a4');
  for(let i=0;i<12;i++){
    const t=(i+.5)/12,x=b.minX+t*w,y=b.maxY-d*.04;
    screenLine(ctx,city,f,[[x,y,h*.34],[x,y,h*.88]],'#9f927c',1);
  }
  f.topHeight=h*.94;
}

function drawBuckingham(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.84,'#c4baa5','#d8cfbc',{windows:'#656760',lightWall:'#d2c8b4',outline:'#847b69'});
  const front=rectangle(f.x,b.maxY-d*.12,w*.58,d*.08);
  capPrism(ctx,city,f,f.x,b.maxY-d*.12,w*.58,d*.08,h*.84,h*.16,'#c4baa5','#d8cfbc');
  // Central balcony and a restrained row of façade bays.
  const z=h*.67;
  screenLine(ctx,city,f,[[f.x-w*.07,b.maxY-d*.2,z],[f.x+w*.07,b.maxY-d*.2,z]],'#8c8272',1.5);
  for(let i=-5;i<=5;i++){
    const x=f.x+i*w*.045;
    const p=projection(city,f,x,b.maxY-d*.2,h*.64);ctx.fillStyle='#74746b';ctx.fillRect(p[0]-1,p[1]-2,2,4);
  }
  f.topHeight=h;
}

function drawWestminster(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.34,'#b6a88e','#d0bea0',{windows:'#6f685d',lightWall:'#c8b99f',outline:'#827561'});
  // Parliament's skyline is an elongated run of small Gothic pinnacles, not a dome.
  for(let i=0;i<10;i++){
    const t=(i+.5)/10,x=b.minX+t*w,y=b.maxY-d*.18;
    const size=Math.min(w*.022,d*.11);
    capPrism(ctx,city,f,x,y,size,size,h*.34,h*.06,'#bcae95','#c9bba1');
    screenLine(ctx,city,f,[[x-size*.45,y,h*.40],[x,y,h*.50],[x+size*.45,y,h*.40]],'#8d816e',1);
  }
  for(const dx of[-.43,.43])tower(ctx,city,f,f.x+dx*w,f.y,w*.085,d*.12,h*.34,h*.66,'#b6a88e','#cab99b');
  f.topHeight=h;
}

function drawStMarys(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.42,'#bdb6a3','#a96a4b',{windows:'#5d6259',lightWall:'#d1c4aa',outline:'#806d56'});
  // Keep the footprint's real campus shape; use an understated school roof and a marked entrance bay.
  const ridge=rectangle(f.x,f.y,w*.72,d*.54);
  screenLine(ctx,city,f,[[f.x-w*.36,f.y,h*.42],[f.x,f.y,h],[f.x+w*.36,f.y,h*.42]],'#81533f',2);
  const door=projection(city,f,f.x,b.maxY-d*.15,h*.12);ctx.fillStyle='#715540';ctx.fillRect(door[0]-2,door[1]-4,4,5);
  for(let i=0;i<5;i++){
    const x=b.minX+w*(.16+i*.17),y=b.maxY-d*.22,p=projection(city,f,x,y,h*.55);
    ctx.fillStyle='#777361';ctx.fillRect(p[0]-1,p[1]-2,2,3);
  }
  f.topHeight=h;
}

function drawQrc(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.72,'#c8bda6','#a96049',{windows:'#5e625b',lightWall:'#d8cdb4',outline:'#817764'});
  const front=rectangle(f.x,b.maxY-d*.14,w*.72,d*.09);
  colonnade(ctx,city,f,front,h*.28,h*.42,5,'#e0d1b5');
  const y=b.maxY-d*.14,half=w*.36,z=h*.72;
  record(f,screenPolygon(ctx,city,f,[[f.x-half,y,z],[f.x+half,y,z],[f.x,y,z+h*.16]],'#b46e53','#765846'));
  capPrism(ctx,city,f,f.x,f.y,w*.38,d*.36,h*.72,h*.28,'#b45f47','#c77c5c');
  f.topHeight=h;
}

function drawRedHouse(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.72,'#a95341','#a54d3c',{windows:'#513e36',lightWall:'#c3745d',outline:'#74483d'});
  capPrism(ctx,city,f,f.x,f.y,w*.43,d*.42,h*.72,h*.16,'#a95341','#bd6450');
  dome(ctx,city,f,f.x,f.y,w*.12,d*.18,h*.86,h*.13,'#8e4d3d',12);
  tower(ctx,city,f,f.x,f.y-d*.29,w*.09,d*.1,h*.68,h*.23,'#a95341','#bd6450');
  f.topHeight=h*.99;
}

function drawCityHall(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.40,'#b8b9b0','#d9d7ca',{windows:'#696e6a',lightWall:'#cdccc2',outline:'#777a72'});
  const rx=w*.22,ry=d*.25,z=h*.40;
  capPrism(ctx,city,f,f.x,f.y,rx*2.1,ry*1.4,z,h*.10,'#b5b5ab','#d0cec3');
  dome(ctx,city,f,f.x,f.y,rx,ry,z+h*.10,h*.27,'#858e8c',16);
  tower(ctx,city,f,f.x,f.y,rx*.25,ry*.25,h*.77,h*.23,'#c6c3b4','#d8d2bb');
  for(const dx of[-.39,.39])tower(ctx,city,f,f.x+dx*w,f.y+d*.1,w*.12,d*.18,h*.40,h*.16,'#b8b9b0','#d1cec1');
  f.topHeight=h;
}

function drawTransamerica(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY,cx=f.x,cy=f.y,levels=7,ring=f.polygons[0]||rectangle(cx,cy,w,d);
  const base=ring.slice(0,-1);
  for(let level=0;level<levels;level++){
    const t0=level/levels,t1=(level+1)/levels,scale0=1-t0*.82,scale1=1-t1*.82,z0=h*t0*.9,z1=h*t1*.9;
    for(let i=0;i<base.length;i++){
      const a=base[i],b0=base[(i+1)%base.length];
      const p=(q,scale,z)=>[cx+(q[0]-cx)*scale,cy+(q[1]-cy)*scale,z];
      record(f,screenPolygon(ctx,city,f,[p(a,scale0,z0),p(b0,scale0,z0),p(b0,scale1,z1),p(a,scale1,z1)],i%2?'#79918e':'#a9b7b0','#617b78'));
    }
  }
  // Thin horizontal set-back ribbons and the tapered crown/spire.
  for(let i=1;i<levels;i++){
    const t=i/levels,sc=1-t*.82;
    for(let e=0;e<base.length;e++){
      const a=base[e],b0=base[(e+1)%base.length];
      screenLine(ctx,city,f,[[cx+(a[0]-cx)*sc,cy+(a[1]-cy)*sc,h*t*.9],[cx+(b0[0]-cx)*sc,cy+(b0[1]-cy)*sc,h*t*.9]],'#d6d8cb',1);
    }
  }
  const top=base.map(p=>[cx+(p[0]-cx)*.18,cy+(p[1]-cy)*.18,h*.9]);
  record(f,screenPolygon(ctx,city,f,top,'#98aaa4','#617b78'));
  tower(ctx,city,f,cx,cy,w*.045,d*.045,h*.9,h*.1,'#879790','#b4c0b8');
  f.topHeight=h;
}

function drawSfmoma(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.57,'#747873','#d5d6ce',{windows:'#58615f',lightWall:'#c8cbc3',outline:'#6d736f'});
  // Old Botta block and contemporary expanded volume read as separate stepped masses.
  capPrism(ctx,city,f,f.x-w*.13,f.y,w*.55,d*.72,h*.57,h*.22,'#4f5552','#626965');
  capPrism(ctx,city,f,f.x+w*.15,f.y-d*.06,w*.56,d*.8,h*.79,h*.17,'#c4c8c1','#e1e1d8');
  // The expansion's façade is indicated by broad, soft vertical ribs rather than tiny noise.
  for(let i=0;i<8;i++){
    const x=b.minX+w*(.53+i*.045),y=b.minY+d*.08;
    screenLine(ctx,city,f,[[x,y,h*.8],[x+w*.01,y,h*.92]],'#a5ada7',1);
  }
  f.topHeight=h;
}

function drawFerry(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.55,'#b9b6a9','#d1c9b7',{windows:'#68716a',lightWall:'#cac4b5',outline:'#80786b'});
  const cx=f.x,cy=f.y;capPrism(ctx,city,f,cx,cy,w*.22,d*.44,h*.55,h*.09,'#b9b6a9','#d9d1bd');
  tower(ctx,city,f,cx,cy,w*.12,d*.19,h*.64,h*.36,'#c1bcac','#d9d1bd',{bands:'#938c7d'});
  const p=projection(city,f,cx,cy,h);ctx.fillStyle='#ede1bf';ctx.beginPath();ctx.arc(p[0],p[1],3,0,Math.PI*2);ctx.fill();
  f.topHeight=h;
}

function drawCoit(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY,cx=f.x,cy=f.y;
  footprintSolid(ctx,city,f,h*.1,'#b7b3a5','#d0c9b8',{outline:'#837d70'});
  const rings=[];for(let j=0;j<=6;j++){const t=j/6,rr=1-t*.19,z=h*(.1+t*.78),ring=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI*2;ring.push([cx+Math.cos(a)*w*.35*rr,cy+Math.sin(a)*d*.35*rr,z]);}rings.push(ring);}
  for(let j=0;j<6;j++)for(let i=0;i<12;i++)record(f,screenPolygon(ctx,city,f,[rings[j][i],rings[j][i+1],rings[j+1][i+1],rings[j+1][i]],i%2?'#c3beae':'#d4cdbd','#827d70'));
  capPrism(ctx,city,f,cx,cy,w*.67,d*.67,h*.88,h*.08,'#c2bdae','#d8d1c0');
  dome(ctx,city,f,cx,cy,w*.2,d*.2,h*.93,h*.07,'#d2caba',10);f.topHeight=h;
}

function drawGoldenGate(ctx,city,f,b,s){
  const box=b,vertical=(box.maxY-box.minY)>(box.maxX-box.minX);
  const at=t=>vertical?[f.x,box.minY+(box.maxY-box.minY)*t]:[box.minX+(box.maxX-box.minX)*t,f.y];
  const p0=at(.05),p1=at(.95),towerA=at(.32),towerB=at(.68),deck=Math.max(0,(f.deck??((city.datum||0)+67))-(city.datum||0)),towerH=160;
  screenLine(ctx,city,f,[[p0[0],p0[1],deck],[p1[0],p1[1],deck]],'#9a5845',3);
  for(const [x,y]of[towerA,towerB]){
    capPrism(ctx,city,f,x,y,vertical?.16:.07,vertical?.07:.16,deck,towerH,'#a64e3e','#bd634b');
    for(let k=1;k<5;k++)screenLine(ctx,city,f,[[x-(vertical?.055:.025),y-(vertical?.025:.055),deck+towerH*k/5],[x+(vertical?.055:.025),y+(vertical?.025:.055),deck+towerH*k/5]],'#d49b7d',1);
  }
  // Main cable profile and vertical suspenders.
  const cable=[];for(let i=0;i<=16;i++){const t=i/16,p=[towerA[0]+(towerB[0]-towerA[0])*t,towerA[1]+(towerB[1]-towerA[1])*t];cable.push([p[0],p[1],deck+towerH*(.96-.43*Math.sin(Math.PI*t))]);}
  screenLine(ctx,city,f,cable,'#9c5945',2);
  for(let i=1;i<16;i++){const t=i/16,p=[towerA[0]+(towerB[0]-towerA[0])*t,towerA[1]+(towerB[1]-towerA[1])*t];screenLine(ctx,city,f,[[p[0],p[1],deck],[p[0],p[1],deck+towerH*(.96-.43*Math.sin(Math.PI*t))]],'#ad715b',1);}
  f.topHeight=towerH+deck;
}

function drawTowerBridge(ctx,city,f,b,s,h){
  const vertical=(b.maxY-b.minY)>(b.maxX-b.minX),at=t=>vertical?[f.x,b.minY+(b.maxY-b.minY)*t]:[b.minX+(b.maxX-b.minX)*t,f.y];
  const a=at(.32),c=at(.68),deck=Math.max(0,(f.deck??((city.datum||0)+9))-(city.datum||0)),towerH=56;
  screenLine(ctx,city,f,[[...at(.04),deck],[...at(.96),deck]],'#6e8b88',3);
  for(const [x,y]of[a,c]){
    const w=vertical?.14:.07,d=vertical?.07:.14;
    tower(ctx,city,f,x,y,w,d,deck,towerH,'#aaa58f','#c5b99d',{bands:'#7e8b84'});
    screenLine(ctx,city,f,[[x-w*.7,y,deck+towerH*.35],[x+w*.7,y,deck+towerH*.35]],'#80918b',2);
  }
  screenLine(ctx,city,f,[[a[0],a[1],deck+towerH],[(a[0]+c[0])/2,(a[1]+c[1])/2,deck+towerH],[c[0],c[1],deck+towerH]],'#768b88',2);
  f.topHeight=towerH+deck;
}

function drawAbbey(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  footprintSolid(ctx,city,f,h*.73,'#b7ac95','#d1c1a4',{windows:'#68685f',lightWall:'#c9b99e',outline:'#7d7567'});
  for(const dx of[-.42,.42])tower(ctx,city,f,f.x+dx*w,f.y+d*.28,w*.09,d*.12,h*.73,h*.27,'#b6aa93','#cabc9f');
  for(let i=0;i<7;i++){const x=b.minX+w*(.2+i*.1),y=b.maxY-d*.1;screenLine(ctx,city,f,[[x,y,h*.73],[x,y,h*.88]],'#90836f',1);}
  f.topHeight=h;
}

function drawSmallClockTower(ctx,city,f,b,s,h){
  footprintSolid(ctx,city,f,h*.16,'#beb6a5','#d3cbb9',{windows:'#666960',lightWall:'#cec5b3',outline:'#827a6b'});
  const x=f.x,y=f.y,w=(b.maxX-b.minX)*.42,d=(b.maxY-b.minY)*.42;
  const towerH=h*.84;tower(ctx,city,f,x,y,w,d,h*.16,towerH,'#bdb5a4','#d8ceba');
  const p=projection(city,f,x,y,h*.16+towerH*.91);ctx.strokeStyle='#eee4cb';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p[0],p[1],2.6,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0],p[1]-1);ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+1,p[1]);ctx.stroke();
  f.topHeight=h;
}

function drawGeneric(ctx,city,f,b,s,h,key){
  const n=key==='caribbean-house';
  const wall=n?'#c1af8f':s.stone,roof=n?'#a25f48':s.roof;
  footprintSolid(ctx,city,f,h*.78,wall,roof,{windows:n?'#596055':'#657066',lightWall:n?'#d0c1a2':'#d0c5b0',outline:'#807968'});
  if(n){
    const w=b.maxX-b.minX,d=b.maxY-b.minY;
    capPrism(ctx,city,f,f.x,f.y,w*.76,d*.72,h*.78,h*.16,wall,'#9e5b47');
    screenLine(ctx,city,f,[[b.minX,b.maxY,h*.25],[b.maxX,b.maxY,h*.25]],'#ede0c2',1.2);
    f.topHeight=h*.95;
  }else f.topHeight=h*.78;
}

function drawPlazaOrPark(ctx,city,f,b,s){
  // These low objects retain real 2-D footprint context; no false tower mass is added.
  for(const ring of f.polygons||[])record(f,screenPolygon(ctx,city,f,ring.map(p=>[p[0],p[1],0]),f.type==='plaza'?'#d1c5a9':'#9ca97b','#8b927b'));
  f.topHeight=0;
}

function drawEye(ctx,city,f,b,s,h){
  const vertical=(b.maxY-b.minY)>(b.maxX-b.minX),center=projection(city,f,f.x,f.y,h*.6),radius=Math.max(7,Math.min(25,(b.maxX-b.minX+b.maxY-b.minY)*city.scale*.22));
  ctx.strokeStyle='#687c78';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(center[0],center[1],radius,radius*1.25,0,0,Math.PI*2);ctx.stroke();
  const spokes=12;for(let i=0;i<spokes;i++){const a=i*Math.PI*2/spokes,x=center[0]+Math.cos(a)*radius,y=center[1]+Math.sin(a)*radius*1.25;ctx.beginPath();ctx.moveTo(center[0],center[1]);ctx.lineTo(Math.round(x),Math.round(y));ctx.stroke();ctx.fillStyle='#c8c8b5';ctx.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);}
  screenLine(ctx,city,f,[[f.x-(vertical?.12:.2),f.y,h*.1],[f.x,f.y,h*.55],[f.x+(vertical?.12:.2),f.y,h*.1]],'#777c71',2);f.topHeight=h;
}

function drawSculpture(ctx,city,f,b,s,h){
  const w=b.maxX-b.minX,d=b.maxY-b.minY;
  if(labelKey(city,f)==='cloud-gate'){
    const cx=f.x,cy=f.y,z=h*.3;
    const p=projection(city,f,cx,cy,z);
    ctx.fillStyle='#9da9a4';ctx.strokeStyle='#64736e';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(p[0],p[1],Math.max(5,w*city.scale*.32),Math.max(3,d*city.scale*.24),-.12,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#e1e3d8';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p[0]-1,p[1]-1,Math.max(2,w*city.scale*.21),Math.max(1,d*city.scale*.14),-.12,Math.PI,Math.PI*1.9);ctx.stroke();
  }else{
    const p=projection(city,f,f.x,f.y,h*.3);ctx.fillStyle='#a8aaa0';ctx.strokeStyle='#74776e';ctx.beginPath();ctx.ellipse(p[0],p[1],Math.max(3,w*city.scale*.2),Math.max(2,d*city.scale*.18),0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  f.topHeight=h;
}

function drawFountain(ctx,city,f,b,s,h){
  const p=projection(city,f,f.x,f.y,0),r=Math.max(5,Math.min(17,(b.maxX-b.minX+b.maxY-b.minY)*city.scale*.17));
  ctx.fillStyle='#a2b2aa';ctx.strokeStyle='#697a70';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p[0],p[1],r,r*.53,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.quadraticCurveTo(p[0]+(i-1.5)*2,p[1]-8,p[0]+(i-1.5)*4,p[1]-1);ctx.stroke();}
  f.topHeight=h;
}

function drawPier(ctx,city,f,b,s,h){
  footprintSolid(ctx,city,f,Math.max(2,h),'#bda987','#c8b993',{outline:'#90866b'});
  const ring=(f.polygons||[])[0]||[],w=b.maxX-b.minX,d=b.maxY-b.minY;
  for(let i=0;i<8;i++){
    const t=(i+.5)/8,x=b.minX+t*w,y=f.y;
    screenLine(ctx,city,f,[[x,y,0],[x,y,Math.max(2,h*.45)]],'#9b8d6e',1);
  }
  f.topHeight=Math.max(2,h);
}

function drawMansion(ctx,city,f,b,s,h){drawGeneric(ctx,city,f,b,s,h,'caribbean-house');}

export function landmarkTop(feature){return Number.isFinite(feature.topHeight)?feature.topHeight:(feature.h||feature.heightMeters||0);}

export function drawLandmark(ctx,feature,city){
  const s=city.style||cityStyles[city.id]||cityStyles.london,b=bounds(feature),h=Math.max(0,Number(feature.h??feature.heightMeters)||0),key=labelKey(city,feature);
  feature.hitFaces=[];feature.hitHoles=[];feature.topHeight=h;
  if(key==='plaza'||key==='park'||feature.type==='savannah'||feature.type==='square'){drawPlazaOrPark(ctx,city,feature,b,s);return feature.topHeight;}
  if(key==='willis')drawWillis(ctx,city,feature,b,s,h);
  else if(key==='wrigley')drawWrigley(ctx,city,feature,s,h);
  else if(key==='napa')drawNapa(ctx,city,feature,b,s,h);
  else if(key==='st-marys')drawStMarys(ctx,city,feature,b,s,h);
  else if(key==='red-house')drawRedHouse(ctx,city,feature,b,s,h);
  else if(key==='british-museum')drawBritishMuseum(ctx,city,feature,b,s,h);
  else if(key==='st-pauls')drawStPauls(ctx,city,feature,b,s,h);
  else if(key==='westminster')drawWestminster(ctx,city,feature,b,s,h);
  else if(key==='elizabeth-tower'||key==='tower-london')drawSmallClockTower(ctx,city,feature,b,s,h);
  else if(key==='ferry-building')drawFerry(ctx,city,feature,b,s,h);
  else if(key==='qrc')drawQrc(ctx,city,feature,b,s,h);
  else if(key==='buckingham-palace')drawBuckingham(ctx,city,feature,b,s,h);
  else if(key==='abbey')drawAbbey(ctx,city,feature,b,s,h);
  else if(key==='city-hall')drawCityHall(ctx,city,feature,b,s,h);
  else if(key==='transamerica')drawTransamerica(ctx,city,feature,b,s,h);
  else if(key==='sfmoma')drawSfmoma(ctx,city,feature,b,s,h);
  else if(key==='coit-tower')drawCoit(ctx,city,feature,b,s,h);
  else if(key==='golden-gate')drawGoldenGate(ctx,city,feature,b,s);
  else if(key==='tower-bridge')drawTowerBridge(ctx,city,feature,b,s,h);
  else if(key==='london-eye')drawEye(ctx,city,feature,b,s,h);
  else if(key==='cloud-gate')drawSculpture(ctx,city,feature,b,s,h);
  else if(key==='fountain')drawFountain(ctx,city,feature,b,s,h);
  else if(key==='field-museum'||key==='art-institute'){
    footprintSolid(ctx,city,feature,h*.76,'#c2baa9','#d8cfbe',{windows:'#686d66',lightWall:'#d2c9b8',outline:'#827b6e'});
    const w=b.maxX-b.minX,d=b.maxY-b.minY,front=rectangle(feature.x,b.maxY-d*.16,w*.66,d*.1);
    colonnade(ctx,city,feature,front,h*.75,h*.2,Math.max(5,Math.floor(w*18)),key==='field-museum'?'#9f998b':'#a39b89');
    const z=h*.75,y=b.maxY-d*.16,half=w*.33;
    record(feature,screenPolygon(ctx,city,feature,[[feature.x-half,y,z],[feature.x+half,y,z],[feature.x,y,z+h*.25]],'#c8c0ae','#827a6e'));
    if(key==='art-institute'){
      const p=projection(city,feature,feature.x,b.maxY,h*.08);ctx.fillStyle='#6c685b';ctx.fillRect(p[0]-2,p[1]-2,2,3);ctx.fillRect(p[0]+2,p[1]-2,2,3);
    }
    feature.topHeight=h;
  }
  else if(key==='waterfront')drawWaterfront(ctx,city,feature,b,s,h);
  else if(key==='hotel')drawHotel(ctx,city,feature,b,h);
  else if(key==='caribbean-house'||feature.type==='mansion'||feature.type==='castle'||feature.type==='qrc')drawMansion(ctx,city,feature,b,s,h);
  else if(feature.type==='cathedral'||feature.type==='dome'){
    // Fallback for non-page historic domed landmarks: use a low church mass and one restrained dome.
    const w=b.maxX-b.minX,d=b.maxY-b.minY;
    footprintSolid(ctx,city,feature,h*.58,'#c0b8a6','#d4cbb8',{windows:'#6d6d63',lightWall:'#d0c7b5',outline:'#847c6c'});
    dome(ctx,city,feature,feature.x,feature.y,w*.2,d*.24,h*.58,h*.35,'#aeb0a1',12);feature.topHeight=h*.95;
  }
  else if(feature.type==='bridge')drawTowerBridge(ctx,city,feature,b,s,h);
  else if(feature.type==='museum')footprintSolid(ctx,city,feature,h*.75,'#c2baa9','#d8cfbe',{windows:'#686d66',lightWall:'#d2c9b8',outline:'#827b6e'});
  else if(feature.type==='pier')drawPier(ctx,city,feature,b,s,h);
  else if(feature.type==='sculpture')drawSculpture(ctx,city,feature,b,s,h);
  else drawGeneric(ctx,city,feature,b,s,h,'building');
  return feature.topHeight;
}
