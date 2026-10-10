const C='mitkonenim-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(['./','manifest.json','icon-192.png','icon-512.png','apple-touch-icon.png'].map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 e.respondWith(caches.open(C).then(async c=>{
  const hit=await c.match(r,{ignoreSearch:true});
  const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res}).catch(()=>null);
  return hit||(await net)||(r.mode==='navigate'?await c.match('./'):null)||Response.error();
 }));
});
