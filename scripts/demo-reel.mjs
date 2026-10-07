import { appendActivity } from './activity-store.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const shots = [
 ['oleg-1lLqsynNaZY-unsplash.jpg',4096,2731,'Liquid Light','The surface moves. The image stays.'],
 ['marcus-lenk-JkhlqUHAMtA-unsplash.jpg',2467,3700,'Between Buildings','A slice of gold between concrete and leaves.'],
 ['sayan-nath-8qyyTHeI99U-unsplash.jpg',3840,2160,'Beyond the Horizon','The land folds into a quiet, unfamiliar shape.'],
 ['eduardo-salgado-ZGaoGnrUGNI-unsplash.jpg',2081,2522,'Electric Yellow','A face, a gesture, a flash of yellow.'],
 ['maximilian-bungart-qUtbGNNq5x0-unsplash.jpg',3543,5286,'Orange Crush','Chrome catches the light. Color takes over.'],
 ['robert-ritchie-MzbMuF0sv1I-unsplash.jpg',3625,2039,'After Hours','Every window holds another story.'],
 ['sayan-nath-iAReN0zr8_U-unsplash.jpg',8064,4536,'Almost Another Planet','A small figure crosses a world of white.'],
 ['parker-nate-H20hvLo4EnY-unsplash.jpg',3240,4050,'Into the Light','The walls open. Light finds its way through.'],
];
const rhythm = [2800,1500,2200,1200,1800,2600,1400,3200];
for (let scene=0; scene<24; scene++) {
 const index = (scene + Math.floor(scene / 8) * 3) % shots.length;
 const [file,width,height,title,copy] = shots[index];
 await appendActivity(root, {kind:'progress',title,summary:`Demo ${String(scene+1).padStart(2,'0')} / 24. ${copy}`,image:{src:`/example/${file}`,alt:title,width,height}});
 console.log(`Demo ${scene+1}/24: ${title}`);
 await delay(scene===23 ? 4500 : rhythm[scene%8]);
 if (scene === 7 || scene === 15) {
  await appendActivity(root, {kind:'progress', presentation:'overtext',
   title: scene === 7 ? 'Shall We Go\nEven Bigger?' : 'Ready for\nAnother Perspective?',
   summary:'Demo question — a visual sample, not an actual approval request.'});
  await delay(4200);
 }
}
console.log('Demo complete. Final composition remains on screen.');
