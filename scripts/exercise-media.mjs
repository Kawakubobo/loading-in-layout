import { appendActivity } from './activity-store.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photos = [
 ['oleg-1lLqsynNaZY-unsplash.jpg',4096,2731,'Water reflections'],
 ['marcus-lenk-JkhlqUHAMtA-unsplash.jpg',2467,3700,'Sunlit architecture'],
 ['sayan-nath-8qyyTHeI99U-unsplash.jpg',3840,2160,'Desert from above'],
 ['eduardo-salgado-ZGaoGnrUGNI-unsplash.jpg',2081,2522,'Yellow instant portrait'],
 ['maximilian-bungart-qUtbGNNq5x0-unsplash.jpg',3543,5286,'Orange car detail'],
 ['robert-ritchie-MzbMuF0sv1I-unsplash.jpg',3625,2039,'City lights at night'],
 ['sayan-nath-iAReN0zr8_U-unsplash.jpg',8064,4536,'White rock landscape'],
 ['parker-nate-H20hvLo4EnY-unsplash.jpg',3240,4050,'Light inside a canyon'],
];
const count = 24;
for (let i=0; i<count; i++) {
 const [file,width,height,alt] = photos[i % photos.length];
 const bytes = await readFile(path.join(root,'example',file));
 const hash = createHash('sha256').update(bytes).digest('hex').slice(0,12);
 const round = Math.floor(i / 8);
 const paragraphs = [
  `Test activity ${i+1}/${count}. Read ${bytes.length.toLocaleString('en-US')} bytes from the original photo. Its dimensions are ${width} by ${height} pixels. SHA-256 prefix: ${hash}.`,
  'The title appears first. This paragraph follows in a separate typing sequence, exercising the three-column body width and the first-line indent.',
  'A new composition shares the canvas with older traces. This final paragraph adds more text to test overlap cleanup and the stability of image dimensions during typing.',
 ];
 const event = await appendActivity(root, {kind:'tool',title:alt,summary:paragraphs.slice(0,round+1).join('\n\n'),image:{src:'/example/'+file,alt,width,height}});
 console.log(`${i+1}/${count}: ${alt} · ${round+1} paragraph(s) · event ${event.id}`);
 if(i<count-1) await delay(2400);
}
console.log('Completed 24 photo/text steps. No further activity scheduled. Original photos were only read.');
