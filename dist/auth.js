(()=>{
const PKEY='bp_projects_v3';
let projects=JSON.parse(localStorage.getItem(PKEY)||'[]');
let currentProject=null,pendingDocs=[];
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(+n||0))+' ₽';
const dateText=v=>v?new Date(v+'T00:00:00').toLocaleDateString('ru-RU'):'не указан';
const fileType=name=>(String(name).split('.').pop()||'FILE').slice(0,4).toUpperCase();
const saveProjects=()=>localStorage.setItem(PKEY,JSON.stringify(projects));

document.body.insertAdjacentHTML('afterbegin',`
<div class="bp-layer" id="bpProjectLayer"><form class="bp-modal" id="bpProjectForm"><div class="bp-modal-head"><div><h2>Новый тендер</h2><p style="margin:3px 0;color:#66706b;font-size:12px">Создай карточку и загрузи исходные документы</p></div><button type="button" class="bp-close" data-bp-close="bpProjectLayer">×</button></div><div class="bp-form-grid"><div class="bp-field full"><label>Название тендера / объекта</label><input class="bp-input" id="bpProjectName" required placeholder="Например: Покраска домов в КП Лесной"></div><div class="bp-field"><label>Номер тендера</label><input class="bp-input" id="bpTenderNumber" placeholder="Например: Т-2026-014"></div><div class="bp-field"><label>Заказчик</label><input class="bp-input" id="bpCustomer"></div><div class="bp-field full"><label>Адрес объекта</label><input class="bp-input" id="bpAddress"></div><div class="bp-field"><label>Стоимость договора, ₽</label><input class="bp-input" id="bpContract" type="number" min="0" value="0"></div><div class="bp-field"><label>Срок подачи заявки</label><input class="bp-input" id="bpSubmissionDeadline" type="date"></div><div class="bp-field full"><label>Срок выполнения работ</label><input class="bp-input" id="bpDeadline" placeholder="Например: 45 календарных дней"></div></div><div class="bp-modal-actions"><button type="button" class="bp-secondary" data-bp-close="bpProjectLayer">Отмена</button><button class="bp-main-btn">Создать тендер и загрузить документы</button></div></form></div>
`);

const support=q('.sidebar-foot');
if(support)support.style.display='none';
const content=q('.content');
content.insertAdjacentHTML('afterbegin',`<section class="bp-setup" id="bpSetup"><div class="bp-setup-card"><div class="bp-setup-icon">▤</div><h2 id="bpSetupTitle">Пока нет тендеров</h2><p id="bpSetupText">Создай тендер, загрузи документы и переходи к расчёту.</p><div id="bpProjectList"></div><button class="bp-main-btn" id="bpNewProject">+ Создать тендер</button></div></section><div class="bp-project-bar" id="bpProjectBar" style="display:none"><div><b id="bpBarName"></b><span id="bpBarMeta"></span></div><button id="bpBackProjects">Все тендеры</button></div>`);
const originalChildren=[...content.children].filter(x=>x.id!=='bpSetup'&&x.id!=='bpProjectBar');
const setDashboardVisible=v=>originalChildren.forEach(x=>x.style.display=v?'':'none');
const openLayer=id=>document.getElementById(id).classList.add('open');
const closeLayer=id=>document.getElementById(id).classList.remove('open');
qa('[data-bp-close]').forEach(b=>b.onclick=()=>closeLayer(b.dataset.bpClose));

function renderSetup(){
  currentProject=null;
  setDashboardVisible(false);
  const crumbs=q('.crumbs');if(crumbs)crumbs.innerHTML='<span>Best Paints</span><b>›</b><b>Тендеры</b>';
  qa('.nav .count').forEach(x=>x.textContent='0');
  ['exportBtn','uploadOpen'].forEach(id=>{const el=q('#'+id);if(el)el.disabled=true});
  q('#bpProjectBar').style.display='none';
  q('#bpSetup').style.display='grid';
  q('#bpSetupTitle').textContent=projects.length?'Мои тендеры':'Пока нет тендеров';
  q('#bpSetupText').textContent=projects.length?'Выбери тендер или создай новый.':'Создай тендер, загрузи документы и переходи к расчёту.';
  q('#bpProjectList').innerHTML=projects.map(p=>`<button class="bp-project-bar" style="width:100%;text-align:left;margin:8px 0" data-open-project="${p.id}"><div><b>${esc(p.name)}</b><span>${esc(p.tenderNumber||'Без номера')} · документов: ${(p.docs||[]).length} · ${fmt(p.contract)}</span></div><span>Открыть →</span></button>`).join('');
  qa('[data-open-project]').forEach(b=>b.onclick=()=>showProject(b.dataset.openProject));
}

function resetVisibleDemo(){
  const docsCount=(currentProject.docs||[]).length;
  const navOverview=q('.nav [data-tab="overview"] .count');if(navOverview)navOverview.textContent=docsCount;
  const navLabor=q('.nav [data-tab="labor"] .count');if(navLabor)navLabor.textContent=(currentProject.labor||[]).length;
  const navMaterials=q('.nav [data-tab="materials"] .count');if(navMaterials)navMaterials.textContent=(currentProject.materials||[]).length;
  const navRisks=q('.nav [data-tab="risks"] .count');if(navRisks)navRisks.textContent='0';
  const eye=q('.project-copy .eyebrow');if(eye)eye.textContent='Тендер'+(currentProject.tenderNumber?' · '+currentProject.tenderNumber:'');
  const factHint=q('.facts')?.closest('.card')?.querySelector('.card-head p');if(factHint)factHint.textContent='Введено при создании объекта';
  const laborHint=q('#laborBody')?.closest('.card')?.querySelector('.card-head p');if(laborHint)laborHint.textContent='Добавляй реальные работы и расценки';
  const materialsHint=q('#materialBody')?.closest('.card')?.querySelector('.card-head p');if(materialsHint)materialsHint.textContent='Добавляй реальные материалы и цены';
  const status=q('.status');if(status)status.innerHTML='<i></i> '+(docsCount?'Документы загружены':'Ожидает документов');
  const meta=q('.project-meta');if(meta)meta.innerHTML='<div><span>Заказчик</span><b>'+esc(currentProject.customer||'Не указан')+'</b></div><div><span>Срок работ</span><b>'+esc(currentProject.deadline||'Не указан')+'</b></div>';
  qa('.kpi small').forEach(x=>x.textContent='');
  const docsHint=q('#docsList')?.closest('.card')?.querySelector('.card-head p');if(docsHint)docsHint.textContent='Файлы текущего объекта';
  q('#docCount').textContent=(currentProject.docs||[]).length+' файлов';
  const match=q('.kpis .kpi:nth-child(2) b');if(match)match.textContent=(currentProject.labor||[]).length+' позиций';
  const review=q('.kpis .kpi:nth-child(3) b');if(review)review.textContent='0 позиций';
  const risks=q('.kpis .kpi:nth-child(4) b');if(risks)risks.textContent='0 рисков';
  const docs=q('#docsList');if(docs)docs.innerHTML=docsCount?(currentProject.docs||[]).map(d=>`<div class="doc"><div class="doc-icon">${fileType(d.name)}</div><div><b>${esc(d.name)}</b><span>${esc(d.size)}</span></div><span class="doc-status">В тендере</span></div>`).join(''):'<div class="empty-inline">Загрузи договор, ТЗ, локальную смету, график и приложения</div>';
  const fact=q('.facts');if(fact)fact.innerHTML=`<div class="fact"><span>Номер тендера</span><b>${esc(currentProject.tenderNumber||'Не указан')}</b></div><div class="fact"><span>Срок подачи заявки</span><b>${esc(dateText(currentProject.submissionDeadline))}</b></div><div class="fact"><span>Заказчик</span><b>${esc(currentProject.customer||'Не указан')}</b></div><div class="fact"><span>Срок выполнения</span><b>${esc(currentProject.deadline||'Не указан')}</b></div>`;
  const riskList=q('.risk-list');if(riskList)riskList.innerHTML='<div class="empty-inline">Риски ещё не добавлены</div>';
}

function showProject(id){
  currentProject=projects.find(p=>p.id===id);
  if(!currentProject)return;
  q('#bpSetup').style.display='none';
  setDashboardVisible(true);
  q('#bpProjectBar').style.display='flex';
  const crumbs=q('.crumbs');if(crumbs)crumbs.innerHTML='<span>Тендеры</span><b>›</b><b>'+esc(currentProject.name)+'</b>';
  ['exportBtn','uploadOpen'].forEach(id=>{const el=q('#'+id);if(el)el.disabled=false});
  q('#bpBarName').textContent=currentProject.name;
  q('#bpBarMeta').textContent=currentProject.address||'Адрес не указан';
  const h1=q('.page-head h1');if(h1)h1.textContent=currentProject.name;
  const hp=q('.page-head p');if(hp)hp.textContent=(currentProject.tenderNumber?'Тендер '+currentProject.tenderNumber+' · ':'')+'срок подачи: '+dateText(currentProject.submissionDeadline);
  const ph=q('.project-copy h2');if(ph)ph.textContent=currentProject.name;
  const pp=q('.project-copy p');if(pp)pp.textContent=currentProject.customer?'Заказчик: '+currentProject.customer:'Заказчик не указан';
  q('#contractValue').value=currentProject.contract||0;
  const finance=currentProject.finance||{};
  ['equipment','logistics','overheadPct','taxPct','riskPct'].forEach(id=>{const el=q('#'+id);if(el)el.value=finance[id]??0});
  window.bpLabor.splice(0,window.bpLabor.length,...(currentProject.labor||[]));
  window.bpMaterials.splice(0,window.bpMaterials.length,...(currentProject.materials||[]));
  window.renderLabor();window.renderMaterials();window.calculate();resetVisibleDemo();
}

const openProjectForm=()=>openLayer('bpProjectLayer');
q('#bpNewProject').onclick=openProjectForm;
q('#bpBackProjects').onclick=renderSetup;
const top=q('.top-actions');
if(top){
  top.insertAdjacentHTML('afterbegin','<button class="secondary" id="bpTopProjects">Тендеры</button><button class="primary" id="bpTopNew">+ Новый тендер</button>');
  q('#bpTopProjects').onclick=renderSetup;
  q('#bpTopNew').onclick=openProjectForm;
}
q('#bpProjectForm').onsubmit=e=>{
  e.preventDefault();
  const p={id:crypto.randomUUID(),name:q('#bpProjectName').value.trim(),tenderNumber:q('#bpTenderNumber').value.trim(),submissionDeadline:q('#bpSubmissionDeadline').value,customer:q('#bpCustomer').value.trim(),address:q('#bpAddress').value.trim(),contract:+q('#bpContract').value||0,deadline:q('#bpDeadline').value.trim(),docs:[],labor:[],materials:[],finance:{equipment:0,logistics:0,overheadPct:0,taxPct:0,riskPct:0}};
  projects.push(p);saveProjects();e.target.reset();closeLayer('bpProjectLayer');showProject(p.id);window.switchTab('overview');q('#uploadModal').classList.add('open');window.showToast('Тендер создан — загрузи документы');
};

const persist=()=>{
  if(!currentProject)return;
  currentProject.contract=+q('#contractValue').value||0;
  currentProject.labor=window.bpLabor.map(x=>({...x}));
  currentProject.materials=window.bpMaterials.map(x=>({...x}));
  currentProject.finance={};
  ['equipment','logistics','overheadPct','taxPct','riskPct'].forEach(id=>currentProject.finance[id]=+q('#'+id).value||0);
  saveProjects();
};
document.addEventListener('input',e=>{if(e.target.matches('.labor-qty,.labor-price,.material-qty,.material-price,.calc-input'))setTimeout(persist,0)});
['addLabor','addMaterial'].forEach(id=>q('#'+id)?.addEventListener('click',()=>setTimeout(persist,0)));
['uploadOpen','addDocs'].forEach(id=>q('#'+id)?.addEventListener('click',()=>{pendingDocs=[];q('#fileInput').value='';q('#fileList').innerHTML=''}));
q('#fileInput')?.addEventListener('change',e=>{if(!currentProject)return;pendingDocs=[...e.target.files].map(f=>({name:f.name,size:Math.max(1,Math.round(f.size/1024))+' КБ',type:f.type||''}))});
q('#reanalyze')?.addEventListener('click',()=>window.showToast('Автоматический ИИ-анализ подключается на серверном этапе'));
q('#startAnalysis').onclick=()=>{if(!currentProject)return;if(!pendingDocs.length){window.showToast('Сначала выбери документы тендера');return}const existing=new Set((currentProject.docs||[]).map(d=>d.name+'|'+d.size));currentProject.docs=[...(currentProject.docs||[]),...pendingDocs.filter(d=>!existing.has(d.name+'|'+d.size))];saveProjects();q('#uploadModal').classList.remove('open');q('#fileInput').value='';q('#fileList').innerHTML='';pendingDocs=[];resetVisibleDemo();window.switchTab('overview');window.showToast('Документы добавлены в тендер')};

document.body.classList.remove('bp-locked');
renderSetup();
})();
