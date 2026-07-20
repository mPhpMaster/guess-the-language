'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path=require('path'),fs=require('fs');
const SRC=path.join(__dirname,'..','src');
const L=(...a)=>process.stdout.write(a.join(' ')+'\n');
ipcMain.handle('questions:get',async()=>JSON.parse(await fs.promises.readFile(path.join(SRC,'data','questions-algo.json'),'utf-8')));
try{app.setPath('userData',path.join(require('os').tmpdir(),'gtl-algo-'+Date.now()));}catch(e){}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let pass=0,total=0; const chk=(n,c,d)=>{total++;if(c)pass++;L((c?'PASS':'FAIL')+'  '+n+(d?'  ('+d+')':''));};
app.whenReady().then(async()=>{try{
  const win=new BrowserWindow({show:false,webPreferences:{preload:path.join(SRC,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const run=(js)=>win.webContents.executeJavaScript(js,true);
  for(let a=0;;a++){try{await win.loadFile(path.join(SRC,'index.html'));break;}catch(e){if(a>=5)throw e;await sleep(400);}}
  await sleep(400);
  await run("window.SUPABASE_CONFIG={url:'',anonKey:''};window.__GTL_QTIME=1;var n=document.querySelector('#set-name');n.value='Tester';n.dispatchEvent(new Event('input'));'ok'");
  chk('algorithms mode card exists', await run("!!document.querySelector('.mode-card[data-mode=\"algorithms\"]')"));
  await run("document.querySelector('.mode-card[data-mode=\"algorithms\"]').click();'ok'");
  for(let i=0;i<25;i++){ if(await run("!document.querySelector('#btn-start').disabled")) break; await sleep(100);}
  chk('start enabled after algo bank loads', await run("!document.querySelector('#btn-start').disabled"));
  const qc = await run("window.gameAPI.getQuestions('algorithms').then(a=>a.length)");
  chk('algo bank has >= 40 questions', qc>=40, 'count='+qc);
  await run("document.querySelector('#btn-start').click();'ok'"); await sleep(200);
  chk('game screen active', await run("document.querySelector('#screen-game').classList.contains('active')"));
  const opts = await run("document.querySelectorAll('#options-grid .opt-btn').length");
  chk('4 multiple-choice options rendered', opts===4, 'opts='+opts);
  chk('options grid uses cyber (MC) style', await run("document.querySelector('#options-grid').classList.contains('cyber')"));
  await run("document.querySelectorAll('#options-grid .opt-btn')[0].click();'ok'"); await sleep(1400);
  chk('correct answer highlighted after answering', await run("document.querySelectorAll('#options-grid .opt-btn.correct').length===1"));
  L('==== '+pass+'/'+total+' passed ===='); app.exit(pass===total?0:1);
}catch(e){L('ERR '+(e&&e.stack||e));app.exit(2);}});
