export const C={paper:'#e8d7b3',land:'#daca9e',ink:'#4f4938',sea:'#74959a',deep:'#64868e',shore:'#b6bd9d',grass:'#a8b17b',green:'#717e4e',darkGreen:'#4b6245',treeLight:'#a2a96a',road:'#d9caab',roof:'#9e7155',wall:'#dbbf96'};
export function rng(seed=1){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function poly(ctx,points,fill,stroke){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
export function person(ctx,x,y,time=0,moving=false,scale=1){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
  ctx.fillStyle='#28352b45';ctx.fillRect(-4,0,9,2);
  const step=moving?Math.sin(time*12)>0?1:-1:0;
  ctx.fillStyle='#443a30';ctx.fillRect(-2,-6,2,6+step);ctx.fillRect(1,-6,2,6-step);
  ctx.fillStyle='#373f37';ctx.fillRect(-3,step,3,1);ctx.fillRect(1,-step,3,1);
  ctx.fillStyle='#b0a77b';ctx.fillRect(-3,-13,6,7);ctx.fillStyle='#e1c58f';ctx.fillRect(3,-12,2,5);
  ctx.fillStyle='#614c36';ctx.fillRect(-5,-12,3,6);ctx.fillStyle='#9a7347';ctx.fillRect(-4,-11,2,4);
  ctx.fillStyle='#d5af78';ctx.fillRect(-2,-18,5,5);ctx.fillStyle='#543f2a';ctx.fillRect(2,-16,1,1);
  ctx.fillStyle='#5e4930';ctx.fillRect(-5,-19,12,2);ctx.fillRect(-2,-23,6,4);ctx.fillStyle='#b89557';ctx.fillRect(-1,-22,4,2);
  ctx.restore();
}
export function pine(ctx,x,y,size=1,tone=0){
  x=Math.round(x);y=Math.round(y);ctx.fillStyle='#3c493c25';ctx.fillRect(x-2,y,size*5,2);
  ctx.fillStyle='#786447';ctx.fillRect(x,y-4*size,Math.max(1,size),5*size);
  poly(ctx,[[x,y-17*size],[x-4*size,y-7*size],[x-2*size,y-7*size],[x-6*size,y-2*size],[x+6*size,y-2*size],[x+3*size,y-7*size],[x+4*size,y-7*size]],tone?C.green:C.darkGreen);
  poly(ctx,[[x,y-17*size],[x-1*size,y-7*size],[x-3*size,y-3*size],[x+3*size,y-4*size],[x+1*size,y-8*size]],C.treeLight);
}
export function palm(ctx,x,y,size=1,time=0){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(size,size);
  ctx.fillStyle='#796345';ctx.fillRect(0,-17,2,18);ctx.fillStyle='#b5a071';ctx.fillRect(1,-15,1,14);
  const sway=Math.round(Math.sin(time*1.4+x)*1);
  poly(ctx,[[1,-19],[7+sway,-22],[13,-17],[7,-19],[2,-16]],'#697f50');
  poly(ctx,[[1,-19],[-7+sway,-22],[-12,-17],[-6,-19],[1,-16]],'#6f8653');
  poly(ctx,[[1,-19],[4,-26],[9,-26],[5,-23],[3,-17]],'#9ba468');
  poly(ctx,[[1,-19],[-4,-26],[-9,-24],[-4,-22],[0,-16]],'#82955d');ctx.restore();
}
export function deciduous(ctx,x,y,size=1,tone=0){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(size,size);
  poly(ctx,[[-7,2],[1,5],[10,1],[3,-2]],'#3b4f3c23');
  ctx.fillStyle='#6c6045';ctx.fillRect(0,-12,2,13);ctx.fillStyle='#a99b70';ctx.fillRect(1,-8,1,8);
  poly(ctx,[[-7,-9],[-8,-15],[-4,-20],[2,-22],[8,-17],[9,-11],[4,-7],[-2,-7]],tone?'#6e8157':'#566e4f','#4f6547');
  poly(ctx,[[-7,-15],[-3,-20],[2,-21],[5,-17],[3,-13],[-2,-12]],tone?'#b1b57c':'#9ca970');
  poly(ctx,[[3,-13],[7,-17],[8,-12],[4,-8],[1,-8]],'#7f945e');ctx.restore();
}
export function star(ctx,x,y,size=3){const points=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.4:size;points.push([x+Math.cos(a)*r,y+Math.sin(a)*r]);}poly(ctx,points,'#e8d4a0','#6c5741');}
