import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const local=process.env.LOCALAPPDATA;
const cached=local ? (await readdir(path.join(local,'ms-playwright')).catch(()=>[])).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1])) : [];
const executablePath=process.env.PPDF_CHROMIUM || (cached.length ? path.join(local,'ms-playwright',cached[0],'chrome-win64','chrome.exe') : undefined);
const profile=path.resolve(`test-results/browser-profile-${Date.now()}`);
await mkdir('test-results',{recursive:true});
console.log('Browser: launching isolated Chromium with PPDF.');
const context=await chromium.launchPersistentContext(profile,{executablePath,channel:'chromium',headless:true,timeout:30000,args:[`--disable-extensions-except=${path.resolve('dist')}`,`--load-extension=${path.resolve('dist')}`],acceptDownloads:true});
context.setDefaultTimeout(15000);
const watchdog=setTimeout(()=>{console.error('Browser suite exceeded 180 seconds.');void context.close();},180000);
const outbound=[],errors=[];
context.on('request',request=>{if(/^https?:|^wss?:/.test(request.url()))outbound.push(request.url());});
context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
try {
  const manager=await context.newPage();
  await manager.goto('chrome://extensions');
  console.log('Browser: checking installed extension.');
  const extensions=await manager.evaluate(()=>new Promise((resolve,reject)=>{setTimeout(()=>reject(new Error('Extension inventory timed out')),15000);chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true},resolve);}));
  const extension=extensions.find(item=>item.name.startsWith('PPDF'));
  assert.ok(extension,'Chrome did not load PPDF');
  assert.equal(extension.state,'ENABLED');
  assert.equal(extension.manifestErrors?.length ?? 0,0);
  const root=`chrome-extension://${extension.id}/`;
  const page=await context.newPage();
  await page.goto(root+'workspace.html');
  await page.getByRole('heading',{name:'Compress PDF',exact:true}).waitFor();
  console.log('Browser: workspace loaded; testing offline worker tools.');
  await context.setOffline(true);
  const workerFile=(await readdir('dist/assets')).find(f=>/^pdf\.worker-.*\.js$/.test(f));
  assert.ok(workerFile);
  const images=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1200;
    const c=canvas.getContext('2d');const image=c.createImageData(1600,1200);
    let seed=7;for(let i=0;i<image.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;image.data[i]=seed%256;image.data[i+1]=(seed>>>8)%256;image.data[i+2]=(seed>>>16)%256;image.data[i+3]=255;}
    c.putImageData(image,0,0); c.fillStyle='white';c.fillRect(50,50,1000,160);c.fillStyle='black';c.font='60px sans-serif';c.fillText('PPDF SCANNED FIXTURE',70,150);
    const data=canvas.toDataURL('image/jpeg',1).split(',')[1];
    const small=document.createElement('canvas');small.width=30;small.height=20;small.getContext('2d').fillRect(0,0,30,20);
    const png=small.toDataURL('image/png').split(',')[1];
    return {jpg:data,png};
  });
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
  const jpg=await pdf.embedJpg(new Uint8Array(Buffer.from(images.jpg,'base64')));
  for(let i=0;i<3;i++){const p=pdf.addPage([600+i*10,800]);p.drawImage(jpg,{x:0,y:0,width:600,height:600});p.drawText(`PPDF text page ${i+1}`,{x:30,y:730,font,size:20});}
  const mixed=await pdf.save();
  const input={name:'mixed.pdf',bytes:Buffer.from(mixed).toString('base64')};
  async function run(request){return page.evaluate(async({workerUrl,request})=>{
    request.files=request.files.map(f=>({...f,bytes:Uint8Array.from(atob(f.bytes),c=>c.charCodeAt(0))}));
    const worker=new Worker(workerUrl,{type:'module'});
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker timed out'));},60000);worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};worker.onmessage=async({data})=>{if(data.type==='progress')return;clearTimeout(timer);worker.terminate();if(data.type==='error')reject(new Error(data.error));else resolve({files:await Promise.all(data.result.files.map(async f=>({...f,bytes:await new Promise((done,fail)=>{const reader=new FileReader();reader.onload=()=>done(reader.result.split(',')[1]);reader.onerror=fail;reader.readAsDataURL(new Blob([f.bytes]));})}))),warnings:data.result.warnings});};worker.postMessage({id:1,request});});
  },{workerUrl:root+'assets/'+workerFile,request});}
  for(const preset of ['high','balanced','smallest']){
    console.log(`Browser: compression preset ${preset}.`);
    const result=await run({operation:'compress',files:[input],preset});
    assert.ok(Buffer.from(result.files[0].bytes,'base64').length<mixed.length,`${preset} must genuinely shrink scanned image data`);
    const checked=await PDFDocument.load(new Uint8Array(Buffer.from(result.files[0].bytes,'base64')));assert.equal(checked.getPageCount(),3);
    const rendered=await getDocument({data:new Uint8Array(Buffer.from(result.files[0].bytes,'base64')),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/',isEvalSupported:false}).promise;
    const text=await (await rendered.getPage(1)).getTextContent();assert.ok(text.items.some(item=>item.str?.includes('PPDF text page 1')),'Compression must retain searchable text');await rendered.destroy();
  }
  const scanned=await PDFDocument.create();const scanImage=await scanned.embedJpg(Buffer.from(images.jpg,'base64'));scanned.addPage([600,800]).drawImage(scanImage,{x:0,y:0,width:600,height:800});const scannedBytes=await scanned.save();
  const scanResult=await run({operation:'compress',files:[{name:'scanned.pdf',bytes:Buffer.from(scannedBytes).toString('base64')}],preset:'balanced'});
  assert.ok(Buffer.from(scanResult.files[0].bytes,'base64').length<scannedBytes.length,'Image-only scanned PDFs should shrink');
  for(const [operation,extra,count] of [['merge',{files:[input,input]},6],['split',{ranges:'1-2,3'},2],['extract',{pages:[2,0]},2],['delete',{pages:[1]},2],['reorder',{pages:[2,0,1]},3],['rotate',{rotations:{0:90}},3],['number',{},3],['images',{files:[{name:'scan.jpg',bytes:images.jpg},{name:'drawing.png',bytes:images.png}]},2]]){
    const result=await run({operation,files:[input],...extra});
    assert.equal((await PDFDocument.load(new Uint8Array(Buffer.from(result.files[0].bytes,'base64')))).getPageCount(),count,operation);
    if(operation==='split')assert.equal(result.files.length,2);
  }
  // Exercise the shipped workspace and downloads while the browser is offline.
  console.log('Browser: exercising UI tools and downloads.');
  await page.locator('input[type=file]').setInputFiles({name:'mixed.pdf',mimeType:'application/pdf',buffer:Buffer.from(mixed)});
  await page.getByRole('button',{name:'Compress PDF',exact:true}).click();
  await page.getByText('Ready to save',{exact:true}).waitFor();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save',exact:true}).click();
  const download=await downloadEvent;assert.match(download.suggestedFilename(),/compressed\.pdf$/);await download.saveAs('test-results/compressed.pdf');
  await page.screenshot({path:'test-results/workspace.png',fullPage:true});
  const select=async name=>page.locator('.tool-rail').getByRole('button',{name,exact:true}).click();
  const execute=async name=>{await page.locator('.action-row').getByRole('button',{name,exact:true}).click();await page.getByText('Ready to save',{exact:true}).waitFor();};
  const save=async()=>{const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save',exact:true}).first().click();const d=await event;return PDFDocument.load(new Uint8Array(await readFile(await d.path())));};
  await select('Reorder pages');
  await page.getByRole('button',{name:'Move page 1 later',exact:true}).click();
  assert.equal(await page.locator('.reorder-grid .page-caption').first().textContent(),'Page 2');
  await page.locator('.reorder-tile').last().dragTo(page.locator('.reorder-tile').first());
  assert.equal(await page.locator('.reorder-grid .page-caption').first().textContent(),'Page 3');
  await page.getByRole('button',{name:'Preview page 3',exact:true}).click();
  await page.getByRole('dialog').waitFor();await page.waitForFunction(()=>document.querySelector('[role=dialog] canvas')?.width>0);await page.getByRole('button',{name:'Close preview',exact:true}).click();
  await execute('Reorder pages');assert.equal((await save()).getPage(0).getWidth(),620);
  await select('Rotate pages');await page.getByRole('button',{name:'Select page 1',exact:true}).click();await page.getByRole('button',{name:'Right 90°',exact:true}).click();await execute('Rotate pages');assert.equal((await save()).getPage(0).getRotation().angle,90);
  await select('Extract pages');await page.getByRole('button',{name:'Select page 2',exact:true}).click();await execute('Extract pages');assert.equal((await save()).getPageCount(),1);
  await select('Delete pages');await page.getByRole('button',{name:'Select page 2',exact:true}).click();await execute('Delete pages');assert.equal((await save()).getPageCount(),2);
  await select('Split');await page.getByLabel('Page ranges',{exact:false}).fill('1-2,3');await execute('Split PDF');assert.equal(await page.getByRole('button',{name:'Save',exact:true}).count(),2);
  await select('Add page numbers');await execute('Add page numbers');assert.equal((await save()).getPageCount(),3);
  await select('Merge');await page.locator('input[type=file]').setInputFiles({name:'second.pdf',mimeType:'application/pdf',buffer:Buffer.from(mixed)});await execute('Merge PDFs');assert.equal((await save()).getPageCount(),6);
  await page.getByRole('button',{name:'Clear all',exact:true}).click();await select('Images to PDF');
  await page.locator('input[type=file]').setInputFiles([{name:'scan.jpg',mimeType:'image/jpeg',buffer:Buffer.from(images.jpg,'base64')},{name:'drawing.png',mimeType:'image/png',buffer:Buffer.from(images.png,'base64')}]);
  await execute('Images to PDF');assert.equal((await save()).getPageCount(),2);
  // Start a real worker job and cancel before it can publish stale output.
  await page.getByRole('button',{name:'Clear all',exact:true}).click();await select('Compress');
  await page.locator('input[type=file]').setInputFiles({name:'mixed.pdf',mimeType:'application/pdf',buffer:Buffer.from(mixed)});
  await page.getByRole('button',{name:'Compress PDF',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Compress PDF',exact:true}).waitFor();assert.equal(await page.getByText('Ready to save',{exact:true}).count(),0);
  // A deliberately minimal valid text PDF grows under structural serialization.
  // The workspace must explain this and download the exact original bytes.
  const minimal=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  await page.locator('input[type=file]').setInputFiles({name:'minimal.pdf',mimeType:'application/pdf',buffer:minimal});await execute('Compress PDF');
  await page.getByText(/larger|no size reduction/).waitFor();
  const originalEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download original',exact:true}).click();const original=await originalEvent;assert.deepEqual(await readFile(await original.path()),minimal);
  await page.getByRole('button',{name:'Clear all',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'malformed.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')});await page.getByRole('alert').waitFor();
  const encrypted=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>\nendobj\n4 0 obj\n<< /Filter /Standard /V 1 /R 2 /O <'+ '00'.repeat(32)+' > /U <'+'00'.repeat(32)+' > /P -4 >>\nendobj\ntrailer\n<< /Root 1 0 R /Size 5 /Encrypt 4 0 R /ID [<0123456789abcdef0123456789abcdef><0123456789abcdef0123456789abcdef>] >>\n%%EOF');
  await page.locator('input[type=file]').setInputFiles({name:'encrypted.pdf',mimeType:'application/pdf',buffer:encrypted});await page.getByRole('alert').filter({hasText:/encrypted|password/}).waitFor();
  const popup=await context.newPage();await popup.goto(root+'popup.html');
  const newPageEvent=context.waitForEvent('page');await popup.getByRole('button',{name:'Open PDF workspace'}).click();
  const opened=await newPageEvent;await opened.waitForURL(/workspace\.html\?tool=compress/);
  assert.equal(outbound.length,0,`Unexpected network requests: ${outbound.join(', ')}`);
  assert.equal(errors.length,0,`Browser runtime errors: ${errors.join(', ')}`);
  console.log('Browser passed: real MV3 extension, all 9 tools through workers AND UI, 3 JPEG presets, text preservation, drag order, preview, cancellation, offline downloads and popup; no network requests or runtime errors.');
} finally {clearTimeout(watchdog);await context.close();}
