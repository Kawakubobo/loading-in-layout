import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { validateEvent, appendActivity, readActivity } from './scripts/activity-store.mjs';
import { beginPrompt, snapshotFiles } from './scripts/begin-prompt.mjs';
import { reduceLiveActivity } from './layout-engine.js';
const event = {kind:'tool',runId:'figma',status:'running',title:'Working in Figma',summary:'Checking actual layouts.',expiresAt:'2030-01-01T00:00:00.000Z',labels:['Working in Figma','Checking layouts']};
test('lifecycle fields survive persistence and can be replayed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'live-lifecycle-'));
 try{await appendActivity(root,event);const feed=await readActivity(root);assert.equal(feed.events[0].status,'running');assert.deepEqual(feed.events[0].labels,event.labels);assert.equal(feed.events[0].expiresAt,event.expiresAt);}finally{await rm(root,{recursive:true,force:true});}
});
test('live states require explicit valid lifecycle and expiry',()=>{
 assert.throws(()=>validateEvent({...event,expiresAt:'bad'}));
 assert.throws(()=>validateEvent({...event,runId:''}));
 assert.throws(()=>validateEvent({...event,kind:'progress'}));
 assert.throws(()=>validateEvent({...event,labels:Array(5).fill('extra')}));
});
test('unrelated completion cannot end current work; real completion can',()=>{
 const state=reduceLiveActivity(null,event);
 assert.equal(reduceLiveActivity(state,{runId:'other',status:'completed'}),state);
 assert.equal(reduceLiveActivity(state,{runId:'figma',status:'completed'}).status,'completed');
 assert.equal(reduceLiveActivity(state,{kind:'progress'}),state);
});
test('preserve-activity snapshot retains canvas session and every event',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'live-snapshot-'));
 try{for(const f of snapshotFiles)await writeFile(path.join(root,f),'reference content');await appendActivity(root,event);const before=await readFile(path.join(root,'data/activity.json'),'utf8');await beginPrompt(root,{preserveActivity:true});assert.equal(await readFile(path.join(root,'data/activity.json'),'utf8'),before);assert.equal(await readFile(path.join(root,'snapshots/reference/app.js'),'utf8'),'reference content');}finally{await rm(root,{recursive:true,force:true});}
});
