const initialServer='https://de1.api.radio-browser.info';
let serverList;
const countries=new Map();
async function json(url){const response=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Radio directory unavailable');return response.json();}
async function servers(){
  if(!serverList)serverList=json(initialServer+'/json/servers').then(rows=>[...new Set(rows.map(row=>'https://'+row.name))].sort(()=>Math.random()-.5)).catch(()=>[initialServer]);
  return serverList;
}
async function request(path){
  for(const server of await servers())try{return await json(server+path);}catch{}
  serverList=null;throw new Error('Radio directory unavailable');
}
function stationsIn(country){
  if(!countries.has(country)){const query=new URLSearchParams({countrycode:country,has_geo_info:'true',hidebroken:'true',order:'clickcount',reverse:'true',limit:'10000'});countries.set(country,request('/json/stations/search?'+query).catch(error=>{countries.delete(country);throw error;}));}
  return countries.get(country);
}
export function nearbyStations(rows,place,audio){
  const radians=value=>value*Math.PI/180,seen=new Set(),types={MP3:'audio/mpeg',AAC:'audio/aac','AAC+':'audio/aac',OGG:'audio/ogg',OPUS:'audio/ogg; codecs="opus"',FLAC:'audio/flac'};
  return rows.flatMap(station=>{
    if(station.countrycode!==place.countrycode||!station.lastcheckok||station.geo_lat==null||station.geo_long==null||!station.url_resolved?.startsWith('https://'))return[];
    const lat=Number(station.geo_lat),lon=Number(station.geo_long);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return[];
    const hls=station.hls||/\.m3u8(?:\?|$)/i.test(station.url_resolved),type=hls?'application/vnd.apple.mpegurl':types[station.codec?.toUpperCase()];if(!type||!audio.canPlayType(type))return[];
    const a=Math.sin(radians(lat-place.lat)/2)**2+Math.cos(radians(place.lat))*Math.cos(radians(lat))*Math.sin(radians(lon-place.lon)/2)**2,distance=12742*Math.asin(Math.sqrt(Math.min(1,a)));
    if(distance>75)return[];
    return[{...station,distance}];
  }).sort((a,b)=>b.clickcount-a.clickcount||a.distance-b.distance).filter(station=>{const name=station.name.trim().toLowerCase();if(seen.has(name)||seen.has(station.url_resolved))return false;seen.add(name);seen.add(station.url_resolved);return true;}).slice(0,60);
}
export class Radio{
  constructor(root,onClose){
    this.root=root;this.onClose=onClose;this.generation=0;this.playback=0;this.station=null;this.stations=[];
    const get=id=>root.querySelector('#radio-'+id);this.title=get('city');this.select=get('station');this.playButton=get('play');this.status=get('status');this.retry=get('retry');this.audio=get('audio');this.exploreButton=get('explore');
    get('close').addEventListener('click',()=>this.close());
    this.exploreButton.addEventListener('click',()=>{const explore=this.explore;this.close();explore?.();});
    this.retry.addEventListener('click',()=>this.open(this.place,this.explore,true));
    this.select.addEventListener('change',()=>{this.stop();this.station=this.stations.find(station=>station.stationuuid===this.select.value)||null;this.playButton.disabled=!this.station;if(this.station){this.audio.src=this.station.url_resolved;this.play();}});
    this.playButton.addEventListener('click',()=>{if(!this.station)return;if(this.audio.paused)this.play();else this.audio.pause();});
    this.audio.addEventListener('playing',()=>{if(!this.station)return;this.status.textContent='';this.playButton.textContent='Pause';});
    this.audio.addEventListener('pause',()=>{this.playButton.textContent='Play';if(this.station)this.status.textContent='';});
    this.audio.addEventListener('waiting',()=>{if(this.station)this.status.textContent='Buffering…';});
    this.audio.addEventListener('error',()=>{if(this.station){this.status.textContent='Station unavailable. Try another.';this.playButton.textContent='Play';}});
  }
  stop(){this.playback++;this.station=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.playButton.textContent='Play';this.playButton.disabled=true;this.status.textContent='';}
  close(){this.generation++;this.stop();this.root.hidden=true;this.onClose?.();}
  async open(place,explore=null,retry=false){
    if(!retry&&!this.root.hidden&&this.place?.id===place.id)return;
    const generation=++this.generation;this.stop();this.place=place;this.explore=explore;this.title.textContent=place.name;this.exploreButton.hidden=!explore;this.root.hidden=false;this.retry.hidden=true;this.select.disabled=true;this.select.replaceChildren(new Option('Choose a station',''));this.status.textContent='Loading stations…';
    try{
      const rows=await stationsIn(place.countrycode);if(generation!==this.generation)return;
      this.stations=nearbyStations(rows,place,this.audio);
      for(const station of this.stations)this.select.add(new Option(station.name.trim(),station.stationuuid));
      this.select.disabled=!this.stations.length;this.status.textContent=this.stations.length?'':'No playable stations nearby.';
      if(this.stations.length)this.select.focus({preventScroll:true});
    }catch{if(generation!==this.generation)return;this.status.textContent='Stations unavailable.';this.retry.hidden=false;}
  }
  async play(){
    if(!this.station)return;const playback=++this.playback,station=this.station;this.status.textContent='Connecting…';
    if(this.audio.error)this.audio.load();
    try{await this.audio.play();if(playback!==this.playback)return;this.playButton.textContent='Pause';request('/json/url/'+encodeURIComponent(station.stationuuid)).catch(()=>{});}
    catch(error){if(playback!==this.playback)return;this.playButton.textContent='Play';this.status.textContent=error.name==='NotAllowedError'?'Press Play to listen.':'Station unavailable. Try another.';}
  }
}
