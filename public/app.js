'use strict';
const $=s=>document.querySelector(s);
let examples=[],history=[],busy=false,language=Semilon.getLanguage(),statusKey='waiting',errorMessage='',photos=[];
const t=(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),TEXT[language][key]||key);
const sc=key=>Semilon.copy()[key]||key;
const escapeHtml=Semilon.escape;
let accessRequired=false;
const accessPanel=document.createElement('div');accessPanel.id='demo-access';accessPanel.className='access-panel';accessPanel.hidden=true;
accessPanel.innerHTML='<label for="demo-code" data-site-text="demoAccess"></label><input id="demo-code" type="password" maxlength="120" autocomplete="off"><p data-site-text="demoAccessHint"></p>';
$('#complaintForm').prepend(accessPanel);
try{$('#demo-code').value=sessionStorage.getItem('semilonDemoCode')||''}catch{}
const accessReady=fetch('/api/config').then(response=>{if(!response.ok)throw Error();return response.json()}).then(config=>{accessRequired=config.access_required===true;accessPanel.hidden=!accessRequired;return true}).catch(()=>{showError(t('network'));return false});
function localizedError(value){if(language==='ko'||Object.values(TEXT[language]).includes(value)||Object.values(Semilon.copy()).includes(value))return value;return ERROR_TEXT[value]?.[language==='en'?0:1]||t('failed')}
function showError(value){errorMessage=value;$('#error').textContent=value?localizedError(value):''}
function status(key){statusKey=key;$('#status').textContent=key==='imageReading'?sc(key):t(key)}
function lock(value){busy=value;$('#submit').disabled=value;$('#language').disabled=value;$('#profile-open').disabled=value;$('#send').disabled=value||!history.length;$('#followup').disabled=value||!history.length;$('#choose-files').disabled=value;$('#photos').disabled=value;document.querySelectorAll('[data-example]').forEach(b=>b.disabled=value);document.querySelectorAll('[data-remove-photo]').forEach(b=>b.disabled=value);$('#submit').textContent=t(value?'busy':'submit')}
function applyLanguage(){
 language=Semilon.getLanguage();
 accessPanel.querySelector('[data-site-text=demoAccess]').textContent=sc('demoAccess');
 accessPanel.querySelector('[data-site-text=demoAccessHint]').textContent=sc('demoAccessHint');
 document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
 document.querySelectorAll('[data-placeholder]').forEach(el=>el.placeholder=t(el.dataset.placeholder));
 document.querySelectorAll('[data-source-count]').forEach(el=>el.textContent=t('sources',{n:el.dataset.sourceCount}));
 document.querySelectorAll('[data-usage]').forEach(el=>el.textContent=t('usage',JSON.parse(el.dataset.usage)));
 document.querySelectorAll('textarea[data-answer]').forEach(el=>el.setAttribute('aria-label',t('answerLabel')));
 document.querySelectorAll('[data-edit-draft]').forEach(el=>el.textContent=sc(el.dataset.editDraft));
 $('#product').placeholder=t('examplePrefix')+'HB-CASE-100';$('#order').placeholder=t('examplePrefix')+'LOT-N-001';
 $('#followup').placeholder=t(history.length?'followupAfter':'followupBefore');$('#followup').setAttribute('aria-label',t('followup'));$('#send').setAttribute('aria-label',t('send'));$('#photos').setAttribute('aria-label',sc('chooseFiles'));
 if(errorMessage)$('#error').textContent=localizedError(errorMessage);
 status(statusKey);lock(busy);renderPhotos();
}
window.addEventListener('semilon:language',applyLanguage);
$('#complaint').oninput=()=>$('#count').textContent=$('#complaint').value.length;
document.querySelectorAll('[data-example]').forEach((button,i)=>{button.onclick=()=>{const sample=examples[[0,1,3][i]];if(!sample)return;$('#complaint').value=language==='ko'?sample.message:EXAMPLE_MESSAGES[language][i];$('#product').value=sample.product_code;$('#order').value=sample.lot_id;$('#count').textContent=$('#complaint').value.length;}});
function renderPhotos(){
 const list=$('#file-previews');list.replaceChildren();
 photos.forEach((item,i)=>{const el=document.createElement('div');el.className='file-preview';const img=document.createElement('img');img.src=item.url;img.alt=item.file.name;const caption=document.createElement('small');caption.textContent=item.file.name;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.dataset.removePhoto=i;remove.disabled=busy;remove.setAttribute('aria-label',sc('remove')+': '+item.file.name);remove.onclick=()=>{if(busy)return;URL.revokeObjectURL(item.url);photos.splice(i,1);renderPhotos()};el.append(img,caption,remove);list.append(el)});
}
function addFiles(files){
 if(busy)return;
 const incoming=Array.from(files);
 if(incoming.length+photos.length>3||incoming.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024||!f.size)){showError(sc('fileError'));return}
 photos.push(...incoming.map(file=>({file,url:URL.createObjectURL(file)})));showError('');renderPhotos();
}
$('#choose-files').onclick=()=>$('#photos').click();$('#photos').onchange=e=>{addFiles(e.target.files);e.target.value=''};
const drop=$('#drop-zone');drop.addEventListener('dragover',e=>{e.preventDefault();if(!busy)drop.classList.add('dragover')});drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');addFiles(e.dataTransfer.files)});
function readPhoto(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,data_url:r.result});r.onerror=()=>reject(new Error(sc('fileReadError')));r.readAsDataURL(file)})}
function message(text,user=false){const el=document.createElement('div');el.className='msg'+(user?' user':'');el.textContent=text;$('#output').append(el)}
function markdown(text){
 let inList=false;const parts=[];
 for(const raw of text.split('\n')){
  const line=escapeHtml(raw).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  if(/^\s*[-*]\s+/.test(raw)){if(!inList){parts.push('<ul>');inList=true}parts.push('<li>'+line.replace(/^\s*[-*]\s+/,'')+'</li>');continue}
  if(inList){parts.push('</ul>');inList=false}
  if(/^#{1,4}\s+/.test(raw))parts.push('<h3>'+line.replace(/^#{1,4}\s+/,'')+'</h3>');
  else if(/^\[[^\]]+\]\s*$/.test(raw.trim()))parts.push('<h3>'+line+'</h3>');
  else if(raw.trim())parts.push('<p>'+line+'</p>');
 }
 if(inList)parts.push('</ul>');return parts.join('');
}
function renderResult(result){
 const title=document.createElement('div');title.className='msg-title';title.dataset.i18n='resultTitle';title.textContent=t('resultTitle');$('#output').append(title);
 if(result.image_analysis){const block=document.createElement('div');block.className='image-observations';const heading=document.createElement('h3');heading.dataset.siteText='imageResult';heading.textContent=sc('imageResult');const observation=document.createElement('p');observation.textContent=result.image_analysis.observations;const limitations=document.createElement('small');limitations.textContent=result.image_analysis.limitations;block.append(heading,observation,limitations);$('#output').append(block)}
 const rendered=document.createElement('div');rendered.className='answer-text';rendered.innerHTML=markdown(result.answer);
 const answer=document.createElement('textarea');answer.className='answer-editor';answer.dataset.answer='';answer.value=result.answer;answer.hidden=true;answer.setAttribute('aria-label',t('answerLabel'));
 const actions=document.createElement('div');actions.className='result-actions';
 const edit=document.createElement('button');edit.type='button';edit.dataset.editDraft='edit';edit.textContent=sc('edit');edit.onclick=()=>{const opening=answer.hidden;answer.hidden=!opening;rendered.hidden=opening;if(!opening)rendered.innerHTML=markdown(answer.value);edit.dataset.editDraft=opening?'preview':'edit';edit.textContent=sc(edit.dataset.editDraft);if(opening)answer.focus()};
 const copy=document.createElement('button');copy.type='button';copy.dataset.i18n='copy';copy.textContent=t('copy');copy.onclick=async()=>{try{await navigator.clipboard.writeText(answer.value);copy.dataset.i18n='copied';copy.textContent=t('copied')}catch{answer.hidden=false;rendered.hidden=true;edit.dataset.editDraft='preview';edit.textContent=sc('preview');answer.focus();answer.select();copy.dataset.i18n='copyFallback';copy.textContent=t('copyFallback')}};
 actions.append(edit,copy);
 const details=document.createElement('details');details.className='result-sources';const summary=document.createElement('summary');summary.dataset.sourceCount=result.sources.length;summary.textContent=t('sources',{n:result.sources.length});details.append(summary);
 for(const source of result.sources){const item=document.createElement('div');item.className='source-record';const id=document.createElement('b');id.textContent=source.id;const pre=document.createElement('pre');pre.textContent=JSON.stringify(source,null,2);item.append(id,pre);details.append(item)}
 const usage=document.createElement('p');usage.className='usage';const counts={input:result.usage.input_tokens??'?',output:result.usage.output_tokens??'?'};usage.dataset.usage=JSON.stringify(counts);usage.textContent=t('usage',counts);
 $('#output').append(rendered,answer,actions,details,usage);
}
async function ask(text,initial){
 if(busy)return;
 if(!await accessReady){showError(t('network'));return}
 const demoCode=$('#demo-code').value.trim();
 if(accessRequired&&!demoCode){showError(sc('demoAccessRequired'));$('#demo-code').focus();return}
 try{if(accessRequired)sessionStorage.setItem('semilonDemoCode',demoCode)}catch{}
 showError('');if(initial){history=[];$('#output').replaceChildren()}
 lock(true);status(initial&&photos.length?'imageReading':'checking');message(text,true);
 try{
  const images=initial?await Promise.all(photos.map(p=>readPhoto(p.file))):[];
  const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-Demo-Code':demoCode},body:JSON.stringify({message:text,product:$('#product').value.trim(),lot:$('#order').value.trim(),history,language,images})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||t('failed'));
  const visual=result.image_analysis;const userHistory=visual?text+'\n[사진 관찰 · AI 추정]\n'+visual.search_terms_ko+'\n'+visual.observations:text;
  history.push({role:'user',content:userHistory},{role:'assistant',content:result.answer});
  renderResult(result);status('done');$('#followup').placeholder=t('followupAfter');
  window.dispatchEvent(new CustomEvent('carely:completed',{detail:{message:$('#complaint').value||text,product:$('#product').value.trim(),lot:$('#order').value.trim(),language,answer:result.answer,history:history.slice(-10),image_analysis:result.image_analysis||null}}));
 }catch(error){const reason=error instanceof TypeError?t('network'):error.message;showError(reason);message(localizedError(reason));status('check')}
 finally{lock(false);$('#output').scrollTop=$('#output').scrollHeight}
}
$('#complaintForm').onsubmit=e=>{e.preventDefault();const text=$('#complaint').value.trim();if(text)ask(text,true)};
$('#chatForm').onsubmit=async e=>{e.preventDefault();const text=$('#followup').value.trim();if(!text||busy)return;await ask(text,false);if(!errorMessage)$('#followup').value=''};
fetch('/api/examples').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>examples=data).catch(()=>{$('#error').textContent=t('startup')});
const queryProduct=new URLSearchParams(location.search).get('product');if(['HB-CASE-100','HB-COVER-200','HB-BRACKET-300'].includes(queryProduct))$('#product').value=queryProduct;
const restored=Semilon.read('semilonRestore',null);
if(restored){try{localStorage.removeItem('semilonRestore')}catch{}$('#complaint').value=restored.message||'';$('#product').value=restored.product||'';$('#order').value=restored.lot||'';history=Array.isArray(restored.history)?restored.history.slice(-8):[];if(restored.answer){message(restored.message,true);renderResult({answer:restored.answer,usage:{},sources:[],image_analysis:restored.image_analysis});statusKey='done'}$('#count').textContent=$('#complaint').value.length;}
applyLanguage();
