'use strict';
(function(){
  const section=document.getElementById('character-models');
  if(!section)return;
  const token=location.hash.slice(1), categories={chat:'Чат',pet:'Питомец',room:'Рабочий стол'};
  let state={slots:{},names:{}},file=null,working=false,selection='';
  function element(tag,text){const e=document.createElement(tag);if(text)e.textContent=text;return e;}
  const title=element('h3','3D-модели'), fileInput=element('input'),pick=element('button','Выбрать GLB'), chosen=element('span');
  fileInput.type='file';fileInput.hidden=true;fileInput.accept='.glb,model/gltf-binary,application/octet-stream';
  const library=element('select');library.setAttribute('aria-label','Сохранённая модель');
  const targets=element('fieldset'),legend=element('legend','Где использовать');targets.append(legend);
  const boxes={};
  for(const [key,name] of Object.entries(categories)){
    const label=element('label'),input=element('input');input.type='checkbox';input.checked=key==='chat';boxes[key]=input;
    label.append(input,document.createTextNode(name));targets.append(label);
  }
  const apply=element('button','Применить'),remove=element('button','Удалить файл'),status=element('p'),current=element('div');
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  for(const b of [pick,apply,remove])b.type='button';
  section.append(title,pick,fileInput,chosen,library,targets,apply,remove,status,current);
  function redraw(data){
    state=data;
    library.replaceChildren(new Option('Из библиотеки…',''));
    for(const [hash,name] of Object.entries(data.names))library.add(new Option(name,hash));
    if(data.names[selection])library.value=selection;else selection='';
    current.replaceChildren();
    for(const [key,label] of Object.entries(categories)){
      const line=element('div');line.className='character-slot';const hash=data.slots[key];
      line.append(element('span',label+' · '+(data.names[hash]||'По умолчанию')));
      if(hash){
        const reset=element('button',key==='chat'?'Вернуть портрет':'Вернуть стандартный');reset.type='button';
        reset.setAttribute('aria-label',reset.textContent+' — '+label);
        reset.onclick=()=>run(async()=>{redraw(await assign([key],null));status.textContent='Образ восстановлен.';});line.append(reset);
      }
      current.append(line);
    }
    document.dispatchEvent(new CustomEvent('eva-character-models',{detail:data}));
    locks();
  }
  function locks(){
    for(const e of [pick,library,targets,apply,...current.querySelectorAll('button')])e.disabled=working;
    apply.disabled=working||(!file&&!selection)||!Object.values(boxes).some(c=>c.checked);
    remove.hidden=!!file||!selection;remove.disabled=working||Object.values(state.slots).includes(selection);
  }
  async function request(path,options={}){
    const res=await fetch('/character-models'+path,{...options,headers:{...options.headers,'x-codex-token':token}});
    const data=await res.json();if(!res.ok)throw Error(data.error||'Не удалось открыть модели.');return data;
  }
  const assign=(targets,hash)=>request('/slots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({targets,hash})});
  async function run(fn){if(working)return;working=true;locks();try{await fn();}catch(e){status.textContent=e.message;}finally{working=false;locks();}}
  pick.onclick=()=>fileInput.click();
  fileInput.onchange=()=>{const next=fileInput.files[0];fileInput.value='';if(!next)return;file=null;selection='';library.value='';chosen.textContent='';
    if(next.size>16*1024*1024){status.textContent='Нужен GLB до 16 МиБ.';locks();return;}
    file=next;chosen.textContent=next.name;status.textContent='';locks();};
  library.onchange=()=>{selection=library.value;file=null;chosen.textContent='';status.textContent='';locks();};
  targets.onchange=locks;
  apply.onclick=()=>run(async()=>{
    const dest=Object.keys(categories).filter(key=>boxes[key].checked);if(!dest.length)return;
    if(!file){redraw(await assign(dest,selection));status.textContent='Модель применена.';return;}
    status.textContent='Читаю модель…';
    const src=await file.arrayBuffer(),{bakeActor}=await import('/character-bake.js');
    const {mesh,atlas,poses,poster}=await bakeActor(src,fraction=>{status.textContent='Готовлю позы питомца · '+Math.round(fraction*100)+'%';});
    status.textContent='Сохраняю на устройстве…';
    const header=new ArrayBuffer(24), view=new DataView(header);
    view.setUint32(0,0x32415645,true);
    [src.byteLength,mesh.size,atlas.size,poses.size,poster.size].forEach((n,i)=>view.setUint32(4+i*4,n,true));
    const params=new URLSearchParams({slots:dest.join(','),name:file.name});
    const data=await request('/import?'+params,{method:'POST',headers:{'content-type':'application/octet-stream'},body:new Blob([header,src,mesh,atlas,poses,poster])});
    file=null;chosen.textContent='';selection=data.slots[dest[0]];redraw(data);status.textContent='Модель применена.';
  });
  remove.onclick=()=>run(async()=>{if(!selection)return;redraw(await request('/'+selection,{method:'DELETE'}));status.textContent='Модель удалена.';});
  document.addEventListener('eva-use-personal-portrait',()=>{if(state.slots.chat)assign(['chat'],null).then(redraw).catch(e=>{status.textContent=e.message;});});
  request('').then(redraw).catch(e=>{status.textContent=e.message;});locks();
})();
