import{C,rng,poly,pine,person,star}from'./art.js';
const lifeLocations=[{name:'Port of Spain',lon:-61.5189,lat:10.6549}];
export const destination=lifeLocations[Math.floor(Math.random()*lifeLocations.length)];
const bounds={west:-136,east:46,north:77,south:5};
const prominent=new Set(['Ottawa','Washington, D.C.','Washington','Mexico City','Havana','London','Paris','Berlin','Madrid','Rome','New York','Toronto','Miami','Los Angeles','Port-of-Spain']);
export class Atlas{
  constructor(data){
    this.data=data;this.width=1440;this.height=830;
    this.camera={x:720,y:415,zoom:1};this.hover=null;this.fit=1;
    this.position=this.project(destination.lon,destination.lat);
    this.base=document.createElement('canvas');this.base.width=this.width;this.base.height=this.height;
    this.paint();
  }
  project(lon,lat){return[(lon-bounds.west)/(bounds.east-bounds.west)*this.width,(bounds.north-lat)/(bounds.north-bounds.south)*this.height];}
  path(ctx,polygons){ctx.beginPath();for(const polygon of polygons)for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const[x,y]=this.project(lon,lat);i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y));});ctx.closePath();}}
  paint(){
    const ctx=this.base.getContext('2d');ctx.fillStyle=C.sea;ctx.fillRect(0,0,this.width,this.height);
    const random=rng(8261);
    for(let i=0;i<35000;i++){ctx.fillStyle=random()<.5?'#ffffff09':'#1d48520a';ctx.fillRect(Math.floor(random()*this.width),Math.floor(random()*this.height),1,1);}
    const mask=document.createElement('canvas');mask.width=this.width;mask.height=this.height;const m=mask.getContext('2d');
    this.data.countries.forEach((country,i)=>{this.path(ctx,country);ctx.fillStyle=['#dfcca3','#ddcaa0','#dfcda8','#e1cfa8','#dac9a2'][i%5];ctx.fill('evenodd');this.path(m,country);m.fillStyle='#fff';m.fill('evenodd');});
    m.globalCompositeOperation='destination-out';for(const lake of this.data.lakes){this.path(m,lake);m.fill('evenodd');}
    const maskPixels=m.getImageData(0,0,this.width,this.height).data;
    const onLand=(x,y)=>x>0&&y>0&&x<this.width&&y<this.height&&maskPixels[(Math.floor(y)*this.width+Math.floor(x))*4+3]>200;
    for(let i=0;i<76000;i++){
      const x=Math.floor(random()*this.width),y=Math.floor(random()*this.height);if(!onLand(x,y))continue;
      ctx.fillStyle=random()<.5?'#8a785316':'#fff5d524';ctx.fillRect(x,y,1,1);
    }
    for(let i=0;i<16000;i++){
      const lon=-130+random()*170,lat=17+random()*47,[x,y]=this.project(lon,lat);
      const woodland=(lon<-55&&lat>42&&lat<61)||(lon>-12&&lat>43&&lat<59)||(lon<-80&&lon>-100&&lat<42);
      const patch=Math.sin(lon*.57+Math.cos(lat*.3)*3)+Math.sin(lat*.7+lon*.17);
      if(woodland&&patch>.1&&onLand(x,y)&&onLand(x,y-7))pine(ctx,x,y,.32+random()*.3,random()>.5);
    }
    const ranges=[
      [[-126,57],[-119,49],[-111,40],[-106,32]],
      [[-123,47],[-121,39],[-117,34]],
      [[-106,28],[-104,23],[-100,18]],
      [[-77,43],[-80,37],[-84,34]],
      [[-7,43],[-1,43],[2,42]],
      [[5,46],[10,47],[15,46]],
      [[6,60],[12,65],[20,69]],
      [[-8,31],[-2,34],[8,35]],
    ];
    for(const range of ranges)for(let n=1;n<range.length;n++){
      const a=this.project(...range[n-1]),b=this.project(...range[n]);const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/7);
      for(let j=0;j<steps;j++){const t=j/steps,x=a[0]+(b[0]-a[0])*t+(random()-.5)*8,y=a[1]+(b[1]-a[1])*t+(random()-.5)*6;if(!onLand(x,y))continue;const h=9+random()*13;
        poly(ctx,[[x-h*.7,y+2],[x,y-h],[x+h*.7,y+2]],'#a49773');poly(ctx,[[x,y-h],[x+h*.7,y+2],[x+1,y]],'#786f55');poly(ctx,[[x,y-h],[x-2,y-h+5],[x+1,y-h+4],[x+3,y-h+6]],'#eee0bc');
      }
    }
    for(const country of this.data.countries){this.path(ctx,country);ctx.strokeStyle='#675c43';ctx.lineWidth=1.15;ctx.stroke();}
    for(const lake of this.data.lakes){this.path(ctx,lake);ctx.fillStyle=C.sea;ctx.fill('evenodd');ctx.strokeStyle='#656f5b';ctx.lineWidth=.7;ctx.stroke();}
    const coast=ctx.createImageData(this.width,this.height);
    for(let y=2;y<this.height-2;y++)for(let x=2;x<this.width-2;x++){
      if(!onLand(x,y))continue;
      if(!onLand(x-1,y)||!onLand(x+1,y)||!onLand(x,y-1)||!onLand(x,y+1)){
        const k=(y*this.width+x)*4;coast.data[k]=66;coast.data[k+1]=66;coast.data[k+2]=46;coast.data[k+3]=220;
      }
    }
    const edge=document.createElement('canvas');edge.width=this.width;edge.height=this.height;edge.getContext('2d').putImageData(coast,0,0);ctx.drawImage(edge,0,0);
    this.mask=maskPixels;
  }
  resize(w,h){this.w=w;this.h=h;this.fit=Math.min(w/this.width,h/this.height)*.98;if(w/h<1){this.fit=Math.max(w/this.width,h/this.height*.75);if(!this.mobileCentered){this.camera.x=this.position[0];this.camera.y=this.position[1]-100;this.mobileCentered=true;}}}
  screen(point,w=this.w,h=this.h){const s=this.fit*this.camera.zoom;return[(point[0]-this.camera.x)*s+w/2,(point[1]-this.camera.y)*s+h/2];}
  unprojectScreen(x,y){const s=this.fit*this.camera.zoom;return[(x-this.w/2)/s+this.camera.x,(y-this.h/2)/s+this.camera.y];}
  pan(dx,dy){const s=this.fit*this.camera.zoom;this.camera.x-=dx/s;this.camera.y-=dy/s;this.constrain();}
  constrain(){this.camera.x=Math.max(0,Math.min(this.width,this.camera.x));this.camera.y=Math.max(0,Math.min(this.height,this.camera.y));}
  zoom(factor,x=this.w/2,y=this.h/2){const before=this.unprojectScreen(x,y);this.camera.zoom=Math.max(.7,Math.min(9,this.camera.zoom*factor));const after=this.unprojectScreen(x,y);this.camera.x+=before[0]-after[0];this.camera.y+=before[1]-after[1];this.constrain();}
  hit(x,y){const p=this.screen(this.position);return Math.hypot(x-p[0],y-p[1])<24;}
  cityAt(x,y){let best=null,dist=10;for(const city of this.data.cities){const p=this.screen(this.project(city.lon,city.lat));const d=Math.hypot(x-p[0],y-p[1]);if(d<dist){dist=d;best=city;}}return best;}
  draw(ctx,w,h,time,motion=true){
    this.resize(w,h);ctx.fillStyle=C.sea;ctx.fillRect(0,0,w,h);
    const s=this.fit*this.camera.zoom;ctx.save();ctx.translate(w/2,h/2);ctx.scale(s,s);ctx.translate(-this.camera.x,-this.camera.y);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.base,0,0);ctx.restore();
    if(motion){ctx.fillStyle='#d7e1c124';for(let i=0;i<45;i++){const x=(i*137.9+Math.sin(time*.3+i)*6)%this.width,y=(i*79.3+88)%this.height;if(this.mask[(Math.floor(y)*this.width+Math.floor(x))*4+3])continue;const p=this.screen([x,y]);ctx.fillRect(Math.round(p[0]),Math.round(p[1]),3+Math.round(Math.sin(time*.5+i)*2),1);}}
    const occupied=[];ctx.font='7px monospace';ctx.textBaseline='middle';
    const cities=[...this.data.cities].sort((a,b)=>Number(b.capital)-Number(a.capital)||b.population-a.population);
    for(const city of cities){
      if(city.name==='Port-of-Spain'||city.name==='Port of Spain')continue;
      const[x,y]=this.screen(this.project(city.lon,city.lat));if(x<0||x>w||y<0||y>h)continue;
      if(city.capital)star(ctx,Math.round(x),Math.round(y),2.4);else if(city.population>1300000||this.camera.zoom>1.7){ctx.fillStyle='#524c39';ctx.fillRect(Math.round(x),Math.round(y),1,1);}
      const show=this.hover===city||prominent.has(city.name)||(this.camera.zoom>2.5&&(city.capital||city.population>2000000));
      if(!show)continue;
      let label=city.name.replace(', D.C.','');const width=ctx.measureText(label).width;
      const rect={x:x+5,y:y-5,w:width+3,h:10};
      if(this.hover!==city&&occupied.some(r=>rect.x<r.x+r.w&&rect.x+rect.w>r.x&&rect.y<r.y+r.h&&rect.y+rect.h>r.y))continue;
      if(rect.x+rect.w>w-4||rect.y<44||rect.y>h-35)continue;
      occupied.push(rect);ctx.fillStyle='#e9d8b8ed';ctx.fillRect(Math.round(rect.x-1),Math.round(rect.y),Math.ceil(width+3),10);ctx.fillStyle='#302a20';ctx.fillText(label,Math.round(rect.x),Math.round(y));
    }
    const[x,y]=this.screen(this.position);if(x>-40&&x<w+40&&y>-40&&y<h+40){
      const pulse=motion?Math.sin(time*2)*.3+.7:1;ctx.strokeStyle=`rgba(92,65,35,${pulse})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(Math.round(x),Math.round(y)+2,6,2,0,0,Math.PI*2);ctx.stroke();
      person(ctx,x,y-2,time,false,1);const label='Port of Spain';ctx.font='7px monospace';const tw=ctx.measureText(label).width;const lx=Math.max(3,Math.min(w-tw-8,x+10));const ly=Math.min(h-25,y-8);ctx.fillStyle='#eddfbde8';ctx.fillRect(Math.round(lx-3),Math.round(ly-6),Math.ceil(tw+6),11);ctx.fillStyle='#3f3527';ctx.fillText(label,Math.round(lx),Math.round(ly));
    }
  }
}
