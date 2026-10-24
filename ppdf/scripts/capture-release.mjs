// Capture the actual frozen extension; generated sample documents contain no user data.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {chromium} from 'playwright';
import {PDFDocument,PDFRawStream,PDFName,StandardFonts} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

const zipPath=path.resolve('release/ppdf-1.0.0.zip');
const zip=await readFile(zipPath);
const runtime=path.resolve('release/unpacked',createHash('sha256').update(zip).digest('hex').slice(0,12));
await mkdir(runtime,{recursive:true});
for(const [name,bytes] of Object.entries(unzipSync(zip))){
  const output=path.resolve(runtime,name);
  assert.ok(output.startsWith(runtime+path.sep),'Unsafe archive member');
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,bytes);
}
const manifest=JSON.parse(await readFile(path.join(runtime,'manifest.json'),'utf8'));
assert.equal(manifest.version,'1.0.0');assert.equal(manifest.homepage_url,'https://plugins.brownsmithdynamics.com/ppdf/');
const local=process.env.LOCALAPPDATA;
const cached=local?(await readdir(path.join(local,'ms-playwright'))).filter(n=>/^chromium-\d+$/.test(n)).sort((a,b)=>Number(b.split('-')[1])-Number(a.split('-')[1])):[];
const executablePath=process.env.PPDF_CHROMIUM||(cached.length?path.join(local,'ms-playwright',cached[0],'chrome-win64','chrome.exe'):undefined);
const context=await chromium.launchPersistentContext(path.resolve(`release/browser-profile-${Date.now()}`),{executablePath,channel:'chromium',headless:true,viewport:{width:1280,height:800},deviceScaleFactor:1,timeout:30000,args:[`--disable-extensions-except=${runtime}`,`--load-extension=${runtime}`],acceptDownloads:true});
context.setDefaultTimeout(15000);
const timeout=setTimeout(()=>void context.close(),180000);
const outbound=[],errors=[];let processing=true;
context.on('request',r=>{if(processing && /^https?:|^wss?:/.test(r.url()))outbound.push(r.url());});
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
const report={version:'1.0.0',archive:path.basename(zipPath),sha256:createHash('sha256').update(zip).digest('hex'),date:'2026-10-23',scope:'Scoped release verification and artifact capture; full regression suite not rerun (no commit requested).',sample:'Generated labelled example report; actual extension UI, real worker results, no API shims.',presets:[],urls:[]};
try{
  const manager=await context.newPage();await manager.goto('chrome://extensions');
  const list=await manager.evaluate(()=>new Promise(resolve=>chrome.developerPrivate.getExtensionsInfo({includeDisabled:true,includeTerminated:true},resolve)));
  const installed=list.find(e=>e.name===manifest.name);assert.equal(installed?.state,'ENABLED');assert.equal(installed.manifestErrors?.length??0,0);
  const base=`chrome-extension://${installed.id}/`;
  const page=await context.newPage();await page.goto(base+'workspace.html');await page.getByRole('heading',{name:'Compress PDF',exact:true}).waitFor();await context.setOffline(true);
  const jpeg=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=2200;canvas.height=1500;const c=canvas.getContext('2d');
    const pixels=c.createImageData(canvas.width,canvas.height);let seed=17;
    for(let i=0;i<pixels.data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;pixels.data[i]=40+(seed%160);pixels.data[i+1]=90+((seed>>>8)%140);pixels.data[i+2]=110+((seed>>>16)%130);pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);c.fillStyle='#ffffff';c.fillRect(130,160,1940,350);c.fillStyle='#006577';c.font='bold 92px sans-serif';c.fillText('EXAMPLE FIELD REPORT',200,310);c.font='48px sans-serif';c.fillText('Generated sample for PPDF screenshots',200,410);
    return canvas.toDataURL('image/jpeg',1).split(',')[1];
  });
  const doc=await PDFDocument.create();doc.setTitle('Example report - generated sample');doc.setAuthor('PPDF demo fixture');const font=await doc.embedFont(StandardFonts.Helvetica);const image=await doc.embedJpg(Buffer.from(jpeg,'base64'));
  for(let index=0;index<3;index++){const p=doc.addPage([600+index*10,800]);p.drawText(`Example report / page ${index+1}`,{x:32,y:748,size:22,font});p.drawText('Generated example data. No private documents.',{x:32,y:718,size:11,font});p.drawImage(image,{x:32,y:250,width:536,height:365});p.drawText(['Overview','Site notes','Reference images'][index],{x:32,y:190,size:19,font});}
  const input=await doc.save();
  const worker=(await readdir(path.join(runtime,'assets'))).find(f=>/^pdf\.worker-.*\.js$/.test(f));assert.ok(worker);
  for(const preset of ['high','balanced','smallest']){
    const output=await page.evaluate(async({workerUrl,bytes,preset})=>{
      const w=new Worker(workerUrl,{type:'module'});
      return new Promise((resolve,reject)=>{w.onerror=e=>{w.terminate();reject(new Error(e.message));};w.onmessage=async({data})=>{if(data.type==='progress')return;w.terminate();if(data.type==='error'){reject(new Error(data.error));return;}const blob=new Blob([data.result.files[0].bytes]);const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);};w.postMessage({id:1,request:{operation:'compress',files:[{name:'example-report.pdf',bytes:Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))}],preset}});});
    },{workerUrl:base+'assets/'+worker,bytes:Buffer.from(input).toString('base64'),preset});
    const bytes=Buffer.from(output,'base64');const parsed=await PDFDocument.load(bytes);assert.equal(parsed.getPageCount(),3);
    const pdf=await getDocument({data:new Uint8Array(bytes),standardFontDataUrl:path.resolve('node_modules/pdfjs-dist/standard_fonts').replaceAll('\\','/')+'/',isEvalSupported:false}).promise;
    assert.ok((await (await pdf.getPage(1)).getTextContent()).items.some(t=>t.str?.includes('Example report / page 1')));await pdf.destroy();
    const jpegStream=parsed.context.enumerateIndirectObjects().map(([,o])=>o).find(o=>o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype'))?.toString()==='/Image');
    report.presets.push({preset,originalBytes:input.length,outputBytes:bytes.length,reductionPercent:Math.round((1-bytes.length/input.length)*1000)/10,imageWidth:jpegStream.dict.lookup(PDFName.of('Width')).asNumber(),imageHeight:jpegStream.dict.lookup(PDFName.of('Height')).asNumber(),pageCount:3,selectableTextPreserved:true});
  }
  assert.ok(report.presets[0].outputBytes>report.presets[1].outputBytes && report.presets[1].outputBytes>report.presets[2].outputBytes,'Stronger presets should reduce this example progressively');
  assert.equal(report.presets[0].imageWidth,2200);assert.equal(report.presets[1].imageWidth,2000);assert.equal(report.presets[2].imageWidth,1000);
  await page.locator('input[type=file]').setInputFiles({name:'example-report.pdf',mimeType:'application/pdf',buffer:Buffer.from(input)});
  await page.getByRole('button',{name:/Smallest size/}).click();await page.getByRole('button',{name:'Compress PDF',exact:true}).click();await page.getByText('Ready to save',{exact:true}).waitFor();
  await page.evaluate(()=>window.scrollTo(0,70));await page.screenshot({path:'store-assets/screenshot-01.png',fullPage:false});
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save',exact:true}).click();const download=await downloadEvent;assert.equal((await PDFDocument.load(new Uint8Array(await readFile(await download.path())))).getPageCount(),3);
  await page.locator('.tool-rail').getByRole('button',{name:'Reorder pages',exact:true}).click();await page.getByRole('button',{name:'Move page 3 earlier',exact:true}).click();
  assert.equal(await page.locator('.reorder-grid .page-caption').nth(1).textContent(),'Page 3');
  await page.locator('.action-row').getByRole('button',{name:'Reorder pages',exact:true}).click();await page.getByText('Ready to save',{exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.reorder-grid canvas')].length===3 && [...document.querySelectorAll('.reorder-grid canvas')].every(c=>c.dataset.rendered==='true'));
  await page.evaluate(()=>window.scrollTo(0,70));await page.screenshot({path:'store-assets/screenshot-02.png',fullPage:false});
  const popup=await context.newPage();await popup.goto(base+'popup.html');await popup.getByRole('button',{name:'Open PDF workspace'}).waitFor();
  assert.equal(outbound.length,0);assert.equal(errors.length,0);report.offlineProcessing=true;report.outboundRequestsDuringProcessing=outbound;report.runtimeErrors=errors;report.exactZipLoaded=true;report.actualDownloadsVerified=true;
  processing=false;await context.setOffline(false);
  for(const [role,url,expected] of [['homepage',manifest.homepage_url,'Privacy PDF'],['support','https://plugins.brownsmithdynamics.com/support/','Plugin support'],['privacy_policy','https://plugins.brownsmithdynamics.com/ppdf/privacy/','PPDF privacy policy']]){
    const publicPage=await context.newPage();
    try{const response=await publicPage.goto(url,{waitUntil:'domcontentloaded',timeout:30000});const body=await publicPage.locator('body').innerText();report.urls.push({role,url,status:response.status(),contentVerified:body.includes(expected),draftLabel:/Draft ·/.test(body),signedOut:true});}catch(error){report.urls.push({role,url,error:error.message,contentVerified:false,signedOut:true});}
    await publicPage.close();
  }
  await writeFile('release/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{clearTimeout(timeout);await context.close();}
