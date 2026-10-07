import { appendActivity } from './activity-store.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const start = Date.now()+15000;
await writeFile(`${root}/exports/demo-start.json`,JSON.stringify({start}));
const scenes = [
 [0,'Another Perspective','sayan-nath-iAReN0zr8_U-unsplash.jpg',8064,4536],
 [50,'After Hours','robert-ritchie-MzbMuF0sv1I-unsplash.jpg',3625,2039],
 [100,'Shall We Go\nEven Bigger?'],
 [5000,'A Different Rhythm'],
];
for(const [time,title,file,width,height] of scenes){
 await delay(Math.max(0,start+time-Date.now()));
 await appendActivity(root,{kind:'progress',title,summary:file?'Demo reel. A study in light, scale, and unexpected encounters.':'Demo question — visual sample only.',...(file?{image:{src:'/example/'+file,alt:title,width,height}}:{presentation:time===5000?'editorial':'overtext'})});
}
await delay(Math.max(0,start+10000-Date.now()));
console.log('10-second demo complete.');
