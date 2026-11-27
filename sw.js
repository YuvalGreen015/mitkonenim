/* מתכוננים - Service Worker: התראות (המבחן מוכן / מחר יש מבחן). לא שומר קבצים בזיכרון, כדי שעדכונים תמיד יופיעו. */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
function readList(){return new Promise(function(res){try{var r=indexedDB.open('mitkonenim',2);r.onupgradeneeded=function(){var d=r.result;if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos');if(!d.objectStoreNames.contains('rem'))d.createObjectStore('rem')};r.onsuccess=function(){try{var q=r.result.transaction('rem','readonly').objectStore('rem').get('list');q.onsuccess=function(){res(q.result||[])};q.onerror=function(){res([])}}catch(e){res([])}};r.onerror=function(){res([])}}catch(e){res([])}})}
function daysTo(d){var a=new Date(d+'T00:00:00'),n=new Date();n.setHours(0,0,0,0);return Math.round((a-n)/864e5)}
function when(n){return n<=0?'היום':n==1?'מחר':'בעוד '+n+' ימים'}
async function remind(){
 var list=await readList(),shown=await self.registration.getNotifications();
 for(var i=0;i<list.length;i++){var e=list[i],n=daysTo(e.date);if(n<0||n>2)continue;
  var tag='exam-'+e.id+'-'+n;if(shown.some(function(x){return x.tag===tag}))continue;
  await self.registration.showNotification(when(n)+' יש לך '+(e.kind||'מבחן')+' ב'+e.subject,{body:'בהצלחה! כדאי להתכונן היום באפליקציה 💪',tag:tag,lang:'he',dir:'rtl',icon:'icon-192.png'})}
}
self.addEventListener('periodicsync',function(e){if(e.tag==='exam-remind')e.waitUntil(remind())});
self.addEventListener('message',function(e){if(e.data==='remind')e.waitUntil(remind())});
self.addEventListener('notificationclick',function(e){e.notification.close();
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(cs){for(var i=0;i<cs.length;i++){if('focus' in cs[i])return cs[i].focus()}return self.clients.openWindow('./mitkonenim.html')}))});
