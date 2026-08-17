/* ==========================================================
   CID GTA RP — SUPABASE ONLY
   Aucune base locale / aucune donnée fictive.
   ========================================================== */

const SUPABASE_URL = "https://vkbjdbuifrxwnrvmnjiv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYmpkYnVpZnJ4d25ydm1uaml2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NjU5MjIsImV4cCI6MjEwMjU0MTkyMn0.nhHE22rbHRLy7suEviBXuE-0I2MfPAQapfVs0j0WUME";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let db = { groups: [], identities: [], vehicles: [], notes: [], history: [], reports: [], evidence: [], report_people: [], report_vehicles: [], person_relations: [], drugs: [], laboratories: [] };
let view = "dashboard", selectedGroup = null, selectedPerson = null;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const groupById = id => db.groups.find(g => g.id === id);
const personById = id => db.identities.find(p => p.id === id);
const personName = p => p ? `${p.first_name} ${p.last_name}` : "Inconnu";
const fmtDate = d => d ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d)) : "—";
const fmtTime = d => d ? new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";
const ago = d => { const m = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000)); return m < 1 ? "à l'instant" : m < 60 ? `Il y a ${m} min` : m < 1440 ? `Il y a ${Math.floor(m / 60)} h` : fmtDate(d) };

function toast(msg, error = false) {
   const el = document.createElement("div"); el.className = "toast show"; el.innerHTML = `<div class="toast-body"><i class="bi ${error ? "bi-exclamation-triangle" : "bi-check-circle"} me-2"></i>${esc(msg)}</div>`;
   $("#toastHost").appendChild(el); setTimeout(() => el.remove(), 3500);
}
function err(e) { console.error(e); toast(e?.message || "Erreur Supabase", true) }
async function q(table, select = "*") {
   const { data, error } = await sb.from(table).select(select);
   if (error) throw error;
   return data || [];
}
async function qOptional(table, select = "*") {
   try { return await q(table, select); } catch (e) { console.warn(`Table ${table} indisponible:`, e.message); return []; }
}
async function loadDB() {
   $("#dbStatus").textContent = "SUPABASE CONNECTING";
   try {
      // Pas de .order() ici : on trie côté navigateur pour rester compatible
      // avec toutes les versions du client Supabase présentes dans les ZIP.
      const [groups, identities, vehicles, notes, history, reports, evidence, report_people, report_vehicles, person_relations, drugs, laboratories] = await Promise.all([
         q("groups", "*"), q("identities", "*"), q("vehicles", "*"),
         q("intelligence_notes", "*"), q("audit_log", "*"),
         qOptional("reports", "*"), qOptional("evidence", "*"),
         qOptional("report_people", "*"), qOptional("report_vehicles", "*"),
         qOptional("person_relations", "*"), qOptional("drugs", "*"), qOptional("laboratories", "*")
      ]);
      notes.sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0));
      history.sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0));
      reports.sort((a,b) => new Date(b.report_date || b.created_at || 0)-new Date(a.report_date || a.created_at || 0));
      evidence.sort((a,b) => new Date(b.created_at||0)-new Date(a.created_at||0));
      db = { groups, identities, vehicles, notes, history: history.slice(0,100), reports, evidence, report_people, report_vehicles, person_relations, drugs, laboratories };
      $("#dbStatus").textContent = "SUPABASE ONLINE";
   } catch (e) { $("#dbStatus").textContent = "SUPABASE ERROR"; throw e }
}

function groupTree() {
   const cats = ["CARTEL", "ORGANISATION", "MAFIA", "FAMILLE"];
   $("#groupTree").innerHTML = cats.map(cat => {
      const gs = db.groups.filter(g => g.category === cat);
      return `<div class="tree-cat"><button class="cat-toggle" data-cat="${cat}">${cat}<i class="bi bi-chevron-down float-end"></i></button><div class="cat-items">${gs.map(g => `<div class="tree-item" data-group="${g.id}"><span class="tree-icon">${esc(g.icon || "◈")}</span>${esc(g.name)}</div>`).join("")}</div></div>`
   }).join("");
   document.querySelectorAll("[data-group]").forEach(x => x.onclick = () => openGroup(x.dataset.group));
   document.querySelectorAll(".cat-toggle").forEach(x => x.onclick = () => x.nextElementSibling.classList.toggle("d-none"));
}
function setView(v) { view = v; selectedGroup = null; selectedPerson = null; document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === v)); render(); $("#sidebar").classList.remove("open") }
function empty(t) { return `<div class="empty"><i class="bi bi-inbox"></i>${esc(t)}</div>` }
function statCard(icon, label, val) { return `<div class="stat-card"><div class="stat-icon"><i class="bi ${icon}"></i></div><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>` }

function render() {
   groupTree(); const c = $("#content"); try {
      if (view === "dashboard") c.innerHTML = dashboard();
      else if (view === "groups") c.innerHTML = groupsPage();
      else if (view === "reports") c.innerHTML = reportsPage();
      else if (view === "identities") c.innerHTML = identitiesPage();
      else if (view === "vehicles") c.innerHTML = vehiclesPage();
      else if (view === "notes") c.innerHTML = notesPage();
      else if (view === "history") c.innerHTML = historyPage();
      else if (view === "search") c.innerHTML = searchPage();
      bindContent();
   } catch (e) { err(e) }
}

function drugById(id) { return db.drugs.find(d => d.id === id); }
function reportProduct(r) { return r.product || drugById(r.drug_id)?.name || "Produit inconnu"; }
function reportPerson(r) { return personById(r.suspect_id || r.identity_id); }
function reportTypeLabel(t) { return t === "RECOLTE" ? "RÉCOLTE" : t === "LABORATOIRE" ? "LABORATOIRE" : "TRAFIC"; }
function reportBadge(t) { return `<span class="badge-status ${t === "TRAFIC" ? "badge-red" : "badge-blue"}">${reportTypeLabel(t)}</span>`; }
function reportPeople(rid) { return db.report_people.filter(x => x.report_id === rid); }
function reportVehicles(rid) { return db.report_vehicles.filter(x => x.report_id === rid); }
function reportEvidence(rid) { return db.evidence.filter(x => x.report_id === rid); }
function reportTitle(r) { return r.title || `${reportTypeLabel(r.report_type)} — ${reportProduct(r)}`; }
function reportsPage() {
  const type = window.reportFilterType || "ALL", product = window.reportFilterProduct || "ALL", search = (window.reportFilterSearch || "").toLowerCase();
  let rows = db.reports.filter(r => type === "ALL" || r.report_type === type).filter(r => product === "ALL" || reportProduct(r) === product);
  if (search) rows = rows.filter(r => `${reportTitle(r)} ${reportProduct(r)} ${r.content||""} ${r.suspect_last_name||""} ${r.suspect_first_name||""}`.toLowerCase().includes(search));
  const products = [...new Set(db.reports.map(reportProduct).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const counts = { all: db.reports.length, trafic: db.reports.filter(r=>r.report_type==='TRAFIC').length, recolte: db.reports.filter(r=>r.report_type==='RECOLTE').length, labo: db.reports.filter(r=>r.report_type==='LABORATOIRE').length };
  return `<div class="page-head"><div><div class="eyebrow">DOSSIERS OPÉRATIONNELS</div><h1>Rapports</h1><div class="subtitle">Trafic, récoltes et laboratoires — reliés aux personnes, groupes, véhicules et preuves.</div></div><button class="btn-cid" onclick="openReport()">+ Nouveau rapport</button></div>
  <div class="stat-grid">${statCard('bi-folder2-open','Tous les rapports',counts.all)}${statCard('bi-exclamation-diamond','Trafic',counts.trafic)}${statCard('bi-flower1','Récoltes',counts.recolte)}${statCard('bi-building','Laboratoires',counts.labo)}</div>
  <div class="panel"><div class="report-filter"><button class="filter-pill ${type==='ALL'?'active':''}" onclick="setReportFilter('ALL')">Tous (${counts.all})</button><button class="filter-pill ${type==='TRAFIC'?'active':''}" onclick="setReportFilter('TRAFIC')">Trafic (${counts.trafic})</button><button class="filter-pill ${type==='RECOLTE'?'active':''}" onclick="setReportFilter('RECOLTE')">Récoltes (${counts.recolte})</button><button class="filter-pill ${type==='LABORATOIRE'?'active':''}" onclick="setReportFilter('LABORATOIRE')">Laboratoires (${counts.labo})</button></div>
  <div class="d-flex gap-2 mb-3 flex-wrap"><input id="reportSearch" class="form-control" style="max-width:420px" placeholder="Rechercher un rapport, produit, suspect..." value="${esc(window.reportFilterSearch||'')}"><select id="reportProductFilter" class="form-select" style="max-width:260px"><option value="ALL">Tous les produits</option>${products.map(p=>`<option value="${esc(p)}" ${product===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>
  ${rows.length ? `<div class="result-list">${rows.map(reportCard).join('')}</div>` : empty('Aucun rapport pour ces filtres')}</div>`;
}
function reportCard(r) {
  const p = reportPerson(r), g = groupById(r.group_id), ev = reportEvidence(r.id).length, rp = reportPeople(r.id).length, rv = reportVehicles(r.id).length;
  return `<div class="result-card" onclick="openReportDetail('${r.id}')"><div class="d-flex justify-content-between gap-2"><div><div class="result-type">${reportBadge(r.report_type)}</div><div class="result-title">${esc(reportTitle(r))}</div><div class="result-meta">${esc(reportProduct(r))} · ${esc(p ? personName(p) : ((r.suspect_first_name||'')+' '+(r.suspect_last_name||'')).trim() || 'Suspect inconnu')} · ${esc(g?.name||'Sans groupe')}</div></div><div class="text-end"><div class="result-meta">${fmtDate(r.report_date||r.created_at)}</div><div class="result-meta">${ev} preuve(s) · ${rp} personne(s) · ${rv} véhicule(s)</div></div></div></div>`;
}
function setReportFilter(type) { window.reportFilterType = type; render(); }
function openReport(id="") {
  populateReportSelects();
  const f = $("#reportForm"); f.reset(); $("#reportPeopleList").innerHTML=''; $("#reportVehiclesList").innerHTML=''; $("#evidenceList").innerHTML='';
  window.pendingEvidence=[]; window.editingReportId=id||null;
  if(id){ const r=db.reports.find(x=>x.id===id); if(r){
    $("#reportModalTitle").textContent='Modifier / consulter le rapport';
    $("#reportType").value=r.report_type; $("#reportProduct").value=reportProduct(r); $("[name=quantity]").value=r.quantity??'';
    $("#reportSuspect").value=r.suspect_id||r.identity_id||''; $("#reportGroup").value=r.group_id||'';
    $("[name=manual_first_name]").value=r.suspect_id||r.identity_id?'':(r.suspect_first_name||'');
    $("[name=manual_last_name]").value=r.suspect_id||r.identity_id?'':(r.suspect_last_name||'');
    $("[name=phone]").value=r.phone||r.suspect_phone||''; $("[name=title]").value=r.title||''; $("[name=content]").value=r.content||'';
    $("#linkedTraffic").checked=!!r.linked_traffic; $("#linkedReport").value=r.linked_report_id||r.related_report_id||'';
    toggleManualSuspect();
    reportPeople(r.id).forEach(x=>addReportPersonRow(x.identity_id,x.relation_type||'LIÉ',x.person_name||'',x.person_phone||''));
    reportVehicles(r.id).forEach(x=>addReportVehicleRow(x.vehicle_id,x.relation_type||'LIÉ'));
    reportEvidence(r.id).forEach(x=>window.pendingEvidence.push({...x})); renderPendingEvidence(); }}
  else { $("#reportModalTitle").textContent='Nouveau rapport'; addReportPersonRow(selectedPerson||'','SUSPECT'); }
  toggleLinkedReport(); bootstrap.Modal.getOrCreateInstance("#reportModal").show();
}
function populateReportSelects(){
  const personOpts='<option value="">Aucun / inconnu</option>'+db.identities.map(p=>`<option value="${p.id}">${esc(personName(p))}</option>`).join('');
  $("#reportSuspect").innerHTML=personOpts;
  $("#reportGroup").innerHTML='<option value="">Aucun groupe</option>'+db.groups.map(g=>`<option value="${g.id}">${esc(g.icon||'')} ${esc(g.name)}</option>`).join('');
  $("#linkedReport").innerHTML='<option value="">Choisir un rapport de trafic</option>'+db.reports.filter(r=>r.report_type==='TRAFIC').map(r=>`<option value="${r.id}">${esc(reportTitle(r))}</option>`).join('');
}
function toggleManualSuspect(){ const manual=$("#manualSuspectToggle")?.checked; $("#manualSuspectFields")?.classList.toggle('d-none',!manual); $("#reportSuspect")?.classList.toggle('d-none',!!manual); if(manual && $("#reportSuspect")) $("#reportSuspect").value=''; }
function addReportPersonRow(identityId='', role='LIÉ', manualName='', manualPhone=''){ const wrap=$("#reportPeopleList"); if(!wrap)return; const div=document.createElement('div'); div.className='relation-row report-person-row'; const manual=!!manualName; div.innerHTML=`<div class="person-entry"><select class="form-select report-person ${manual?'d-none':''}"><option value="">Choisir une personne existante</option>${db.identities.map(p=>`<option value="${p.id}" ${p.id===identityId?'selected':''}>${esc(personName(p))}</option>`).join('')}</select><input class="form-control report-person-manual ${manual?'':'d-none'}" placeholder="Nom / prénom libre" value="${esc(manualName)}"><input class="form-control report-person-phone ${manual?'':'d-none'} mt-1" placeholder="Téléphone (facultatif)" value="${esc(manualPhone)}"><div class="form-check mt-1"><input class="form-check-input report-person-manual-toggle" type="checkbox" ${manual?'checked':''}><label class="form-check-label">Individu non enregistré</label></div></div><select class="form-select report-person-role"><option ${role==='SUSPECT'?'selected':''}>SUSPECT</option><option ${role==='COMPLICE'?'selected':''}>COMPLICE</option><option ${role==='ASSOCIE'?'selected':''}>ASSOCIE</option><option ${role==='TEMOIN'?'selected':''}>TEMOIN</option><option ${role==='AUTRE'?'selected':''}>AUTRE</option></select><button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()">×</button>`; wrap.appendChild(div); const toggle=div.querySelector('.report-person-manual-toggle'); toggle.addEventListener('change',()=>{ const on=toggle.checked; div.querySelector('.report-person').classList.toggle('d-none',on); div.querySelector('.report-person-manual').classList.toggle('d-none',!on); div.querySelector('.report-person-phone').classList.toggle('d-none',!on); if(on) div.querySelector('.report-person').value=''; }); }
function addReportVehicleRow(vehicleId='', role='LIÉ'){ const wrap=$("#reportVehiclesList"); if(!wrap)return; const div=document.createElement('div'); div.className='relation-row'; div.innerHTML=`<select class="form-select report-vehicle"><option value="">Choisir un véhicule</option>${db.vehicles.map(v=>`<option value="${v.id}" ${v.id===vehicleId?'selected':''}>${esc(v.make)} ${esc(v.model)} · ${esc(v.plate)}</option>`).join('')}</select><select class="form-select report-vehicle-role"><option ${role==='LIÉ'?'selected':''}>LIÉ</option><option ${role==='SAISI'?'selected':''}>SAISI</option><option ${role==='OBSERVE'?'selected':''}>OBSERVE</option></select><button type="button" class="btn btn-ghost" onclick="this.parentElement.remove()">×</button>`; wrap.appendChild(div); }
function toggleLinkedReport(){ const el=$("#linkedReportWrap"); if(el)el.classList.toggle('d-none',!$("#linkedTraffic").checked); }
function renderPendingEvidence(){ const list=$("#evidenceList"); if(!list)return; list.innerHTML=(window.pendingEvidence||[]).map((x,i)=>`<div class="evidence-card">${x.url?`<img src="${esc(x.url)}" onerror="this.style.display='none'">`:''}<div class="evidence-info"><strong>${esc(x.caption||x.title||'Preuve')}</strong><div class="evidence-url">${esc(x.url||'')}</div><button type="button" class="btn btn-ghost btn-sm" onclick="removePendingEvidence(${i})">Supprimer</button></div></div>`).join(''); }
function removePendingEvidence(i){window.pendingEvidence.splice(i,1);renderPendingEvidence();}
function addEvidenceUrl(){const url=prompt('URL de la preuve / image :'); if(url){window.pendingEvidence.push({url,caption:'Preuve'});renderPendingEvidence();}}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
async function addEvidenceFiles(files){for(const file of files){if(!file.type.startsWith('image/'))continue;const url=await fileToDataURL(file);window.pendingEvidence.push({url,caption:file.name,mime_type:file.type});}renderPendingEvidence();}
function parseQuantity(value){ const raw=String(value??'').trim(); if(!raw)return {number:null,unit:null}; const m=raw.replace(',','.').match(/(\d+(?:\.\d+)?)/); if(!m)return {number:null,unit:raw}; return {number:Number(m[1]),unit:raw.slice((m.index||0)+m[1].length).trim()||null}; }
function reportDetailHtml(r){
 const p=reportPerson(r), g=groupById(r.group_id), ev=reportEvidence(r.id), people=reportPeople(r.id), vehicles=reportVehicles(r.id), linked=db.reports.find(x=>x.id===(r.linked_report_id||r.related_report_id));
 return `<div class="page-head"><div><button class="btn-ghost mb-2" onclick="setView('reports')">← Rapports</button><div class="eyebrow">${reportTypeLabel(r.report_type)}</div><h1>${esc(reportTitle(r))}</h1><div class="subtitle">${esc(reportProduct(r))} · ${fmtDate(r.report_date||r.created_at)}</div></div><button class="btn-cid" onclick="openReport('${r.id}')">Modifier</button></div>
 <div class="detail-grid"><div class="panel"><div class="panel-head"><span class="panel-title">Dossier</span></div>${[['Type',reportTypeLabel(r.report_type)],['Produit',reportProduct(r)],['Quantité',r.quantity||r.quantity===0?`${r.quantity} ${r.unit||''}`:'—'],['Téléphone',r.phone||r.suspect_phone||'—'],['Groupe',g?.name||'—'],['Suspect',p?personName(p):`${r.suspect_first_name||''} ${r.suspect_last_name||''}`.trim()||'Inconnu']].map(x=>`<div class="kv"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join('')}</div><div class="panel"><div class="panel-head"><span class="panel-title">Liens</span></div><div class="kv"><span>Personnes</span><span>${people.map(x=>{const pp=personById(x.identity_id);return pp?`<span class="relation-chip clickable" onclick="openPerson('${pp.id}')">${esc(personName(pp))} · ${esc(x.relation_type||'LIÉ')}</span>`:''}).join('')||'—'}</span></div><div class="kv"><span>Véhicules</span><span>${vehicles.map(x=>{const vv=db.vehicles.find(v=>v.id===x.vehicle_id);return vv?`<span class="relation-chip clickable" onclick="openVehicleDetail('${vv.id}')">${esc(vv.make)} ${esc(vv.model)} · ${esc(vv.plate)}</span>`:''}).join('')||'—'}</span></div>${linked?`<div class="kv"><span>Dossier lié</span><span class="clickable" onclick="openReportDetail('${linked.id}')">${esc(reportTitle(linked))}</span></div>`:''}</div></div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Faits / circonstances</span></div><p class="muted mb-0">${esc(r.content||'Aucun détail.')}</p></div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Preuves / photos</span></div><div class="evidence-grid">${ev.map(x=>`<div class="evidence-card"><img src="${esc(x.url||'')}" onerror="this.style.display='none'"><div class="evidence-info"><strong>${esc(x.caption||x.title||'Preuve')}</strong><div class="evidence-url">${esc(x.url||'')}</div></div></div>`).join('')||empty('Aucune preuve')}</div></div>`;
}
function openReportDetail(id){ const r=db.reports.find(x=>x.id===id); if(!r)return; view='report-detail'; selectedGroup=null; selectedPerson=null; $("#content").innerHTML=reportDetailHtml(r); }

function dashboard() {
   const recent = db.history.slice(0, 6);
   return `<div class="page-head"><div><div class="eyebrow">CRIMINAL INVESTIGATION DIVISION</div><h1>Tableau de bord</h1><div class="subtitle">Vue opérationnelle de la base de renseignement.</div></div><div class="actions"><button class="btn-ghost" onclick="openSearch()">Recherche rapide</button><button class="btn-cid" onclick="openIdentity()">+ Ajouter une identité</button></div></div>
 <div class="stat-grid">${statCard("bi-diagram-3", "Groupes surveillés", db.groups.length)}${statCard("bi-person-badge", "Identités enregistrées", db.identities.length)}${statCard("bi-car-front", "Véhicules connus", db.vehicles.length)}${statCard("bi-credit-card-2-front", "Plaques enregistrées", db.vehicles.length)}${statCard("bi-journal-text", "Renseignements", db.notes.length)}${statCard("bi-folder2-open", "Rapports", db.reports.length)}${statCard("bi-clock-history", "Modifications", db.history.length)}</div>
 <div class="grid-2"><div class="panel"><div class="panel-head"><span class="panel-title">Dernières informations</span><button class="btn-ghost" onclick="setView('history')">Voir tout</button></div>${recent.map(r => `<div class="activity"><div class="activity-icon"><i class="bi bi-file-earmark-text"></i></div><div><strong>${esc(r.action)}</strong><p>${esc(r.detail)}</p><time>${fmtDate(r.created_at)} · ${fmtTime(r.created_at)} · ${esc(r.agent)}</time></div></div>`).join("") || empty("Aucune activité")}</div>
 <div class="panel"><div class="panel-head"><span class="panel-title">Groupes sous surveillance</span><button class="btn-ghost" onclick="setView('groups')">Tous les groupes</button></div><div class="result-list">${db.groups.map(g => `<div class="result-card" onclick="openGroup('${g.id}')"><div class="group-top"><span class="group-symbol">${esc(g.icon || "◈")}</span><div><div class="group-name">${esc(g.name)}</div><div class="group-cat">${esc(g.category)}</div></div></div></div>`).join("")}</div></div></div>`;
}
function groupCard(g) { const m = db.identities.filter(x => x.group_id === g.id).length, v = db.vehicles.filter(x => x.group_id === g.id).length, n = db.notes.filter(x => x.group_id === g.id).length; return `<div class="group-card" onclick="openGroup('${g.id}')"><div class="group-top"><span class="group-symbol">${esc(g.icon || "◈")}</span><div><div class="group-name">${esc(g.name)}</div><div class="group-cat">${esc(g.category)}</div></div></div><div class="group-stats"><div><b>${m}</b><span>Membres</span></div><div><b>${v}</b><span>Véhicules</span></div><div><b>${n}</b><span>Notes</span></div></div></div>` }
function groupsPage() { return `<div class="page-head"><div><div class="eyebrow">RÉSEAU CRIMINEL</div><h1>Tous les groupes</h1><div class="subtitle">${db.groups.length} groupes chargés depuis Supabase.</div></div></div>${["CARTEL", "ORGANISATION", "MAFIA", "FAMILLE"].map(c => `<div class="panel mb-4"><div class="panel-head"><span class="panel-title">${c}</span></div><div class="group-grid">${db.groups.filter(g => g.category === c).map(groupCard).join("") || empty("Aucun groupe")}</div></div>`).join("")}` }
function identitiesPage() { return `<div class="page-head"><div><div class="eyebrow">REGISTRE DES INDIVIDUS</div><h1>Identités</h1><div class="subtitle">Toutes les personnes connues de la CID.</div></div><button class="btn-cid" onclick="openIdentity()">+ Ajouter une identité</button></div><div class="panel">${db.identities.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Groupe</th><th>Poste</th><th>Statut</th><th>Véhicules</th></tr></thead><tbody>${db.identities.map(p => { const g = groupById(p.group_id); return `<tr class="clickable" onclick="openPerson('${p.id}')"><td><span class="person-name">${esc(personName(p))}</span></td><td>${esc(g?.icon || "")} ${esc(g?.name || "—")}</td><td>${esc(p.role || "—")}</td><td><span class="badge-status">${esc(p.status)}</span></td><td>${db.vehicles.filter(v => v.owner_id === p.id).length}</td></tr>` }).join("")}</tbody></table></div>` : empty("Aucune identité dans Supabase")}</div>` }
function vehicleTable(rows) { return rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Véhicule</th><th>Plaque</th><th>Propriétaire</th><th>Couleur</th><th>Statut</th></tr></thead><tbody>${rows.map(v => `<tr class="clickable" onclick="openVehicleDetail('${v.id}')"><td><span class="person-name">${esc(v.make)} ${esc(v.model)}</span></td><td><span class="badge-status">${esc(v.plate)}</span></td><td>${esc(personName(personById(v.owner_id)))}</td><td>${esc(v.color || "—")}</td><td>${v.stolen ? '<span class="badge-status badge-red">SIGNALÉ</span>' : '<span class="badge-status badge-green">NORMAL</span>'}</td></tr>`).join("")}</tbody></table></div>` : empty("Aucun véhicule") }
function vehiclesPage() { return `<div class="page-head"><div><div class="eyebrow">REGISTRE AUTOMOBILE</div><h1>Véhicules</h1><div class="subtitle">Véhicules, propriétaires et plaques.</div></div><button class="btn-cid" onclick="openVehicle()">+ Ajouter un véhicule</button></div><div class="panel">${vehicleTable(db.vehicles)}</div>` }
function noteHtml(n) { const p = personById(n.identity_id), g = groupById(n.group_id); return `<div class="note"><div class="note-head"><span>${fmtDate(n.created_at)} · ${fmtTime(n.created_at)} · ${esc(n.agent || "Agent CID")}</span><span>${esc(g?.icon || "")} ${esc(g?.name || "")}${p ? " · " + esc(personName(p)) : ""}</span></div><div class="note-body">${esc(n.content)}</div></div>` }
function notesPage() { return `<div class="page-head"><div><div class="eyebrow">RENSEIGNEMENT</div><h1>Notes / Renseignements</h1><div class="subtitle">Informations enregistrées dans Supabase.</div></div><button class="btn-cid" onclick="openNote()">+ Ajouter un renseignement</button></div><div class="panel">${db.notes.map(noteHtml).join("") || empty("Aucun renseignement")}</div>` }
function historyRows(rows) { return rows.map(h => `<div class="activity"><div class="activity-icon"><i class="bi bi-clock-history"></i></div><div><strong>${esc(h.action)}</strong><p>${esc(h.detail)}</p><time>${fmtDate(h.created_at)} · ${fmtTime(h.created_at)} · ${esc(h.agent || "Agent CID")}</time></div></div>`) }
function historyPage() { return `<div class="page-head"><div><div class="eyebrow">TRAÇABILITÉ</div><h1>Historique</h1><div class="subtitle">Journal des modifications.</div></div></div><div class="panel"><input id="historyFilter" class="form-control mb-3" placeholder="Filtrer l'historique..."><div id="historyList">${historyRows(db.history).join("") || empty("Aucun historique")}</div></div>` }
function searchPage() { return `<div class="page-head"><div><div class="eyebrow">RECHERCHE TRANSVERSALE</div><h1>Recherche globale</h1><div class="subtitle">Plaque → véhicule → propriétaire → groupe → poste → renseignements.</div></div></div><div class="search-hero"><div class="big-search"><i class="bi bi-search"></i><input id="pageSearch" placeholder="AB-123-CD, Jean Dupont, Sultan RS, Herrera, Bras droit..."></div></div><div id="searchResults">${empty("Saisissez une recherche.")}</div>` }

function doSearch(q) {
   q = q.trim().toLowerCase(); if (!q) return $("#searchResults").innerHTML = empty("Saisissez une recherche.");
   const out = [];
   db.identities.filter(p => `${p.first_name} ${p.last_name} ${p.role || ""} ${p.status || ""}`.toLowerCase().includes(q)).forEach(p => out.push({ type: "IDENTITÉ", title: personName(p), meta: `${groupById(p.group_id)?.icon || ""} ${groupById(p.group_id)?.name || "—"} · ${p.role || "Poste inconnu"}`, open: () => openPerson(p.id) }));
   db.vehicles.filter(v => `${v.make} ${v.model} ${v.plate} ${v.color || ""}`.toLowerCase().includes(q)).forEach(v => out.push({ type: "VÉHICULE", title: `${v.make} ${v.model}`, meta: `Plaque ${v.plate} · Propriétaire ${personName(personById(v.owner_id))}`, open: () => openVehicleDetail(v.id) }));
   db.groups.filter(g => `${g.name} ${g.category}`.toLowerCase().includes(q)).forEach(g => out.push({ type: "GROUPE", title: `${g.icon || ""} ${g.name}`, meta: `${g.category} · ${db.identities.filter(p => p.group_id === g.id).length} identités`, open: () => openGroup(g.id) }));
   db.notes.filter(n => n.content.toLowerCase().includes(q)).forEach(n => out.push({ type: "RENSEIGNEMENT", title: n.content.slice(0, 90), meta: `${fmtDate(n.created_at)} · ${personName(personById(n.identity_id))}`, open: () => openPerson(n.identity_id) }));
   db.reports.filter(r => `${reportTitle(r)} ${reportProduct(r)} ${r.content||""}`.toLowerCase().includes(q)).forEach(r => out.push({ type: "RAPPORT", title: reportTitle(r), meta: `${reportTypeLabel(r.report_type)} · ${reportProduct(r)} · ${fmtDate(r.report_date||r.created_at)}`, open: () => openReportDetail(r.id) }));
   $("#searchResults").innerHTML = out.length ? `<div class="result-list">${out.slice(0, 40).map((r, i) => `<div class="result-card" data-result="${i}"><div class="result-type">${r.type}</div><div class="result-title">${esc(r.title)}</div><div class="result-meta">${esc(r.meta)}</div></div>`).join("")}</div>` : empty("Aucun résultat");
   out.slice(0, 40).forEach((r, i) => document.querySelector(`[data-result="${i}"]`).onclick = r.open);
}

function openSearch() { setView("search"); setTimeout(() => $("#pageSearch")?.focus(), 30) }
function openGroup(id) {
   selectedGroup = id; view = "group"; renderGroup();
}
function renderGroup() {
   const g = groupById(selectedGroup); if (!g) return setView("groups");
   const members = db.identities.filter(x => x.group_id === g.id), vehicles = db.vehicles.filter(x => x.group_id === g.id), notes = db.notes.filter(x => x.group_id === g.id);
   $("#content").innerHTML = `<div class="page-head"><div><button class="btn-ghost mb-2" onclick="setView('groups')">← Tous les groupes</button></div></div>
 <div class="group-hero"><div class="d-flex align-items-center gap-3"><div class="hero-symbol">${esc(g.icon || "◈")}</div><div><h1 class="hero-title">${esc(g.name)}</h1><div class="hero-meta">Catégorie : ${esc(g.category)}</div></div></div><div class="mini-stats"><div><b>${members.length}</b><span>Membres connus</span></div><div><b>${vehicles.length}</b><span>Véhicules connus</span></div><div><b>${vehicles.length}</b><span>Plaques</span></div><div><b>${notes.length}</b><span>Renseignements</span></div></div></div>
 <div class="tabs"><button class="tab-btn active" data-tab="members">👤 Identités</button><button class="tab-btn" data-tab="vehicles">🚗 Véhicules</button><button class="tab-btn" data-tab="notes">📝 Renseignements</button><button class="tab-btn" data-tab="relations">🔗 Relations</button><button class="tab-btn" data-tab="reports">📁 Rapports</button><button class="tab-btn" data-tab="history">📋 Historique</button></div><div id="groupTab"></div>`;
   renderGroupTab("members");
   document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { document.querySelectorAll("[data-tab]").forEach(x => x.classList.remove("active")); b.classList.add("active"); renderGroupTab(b.dataset.tab) });
}
function renderGroupTab(tab) {
   const g = groupById(selectedGroup), target = $("#groupTab");
   if (tab === "members") { const rows = db.identities.filter(x => x.group_id === g.id); target.innerHTML = `<div class="panel"><div class="panel-head"><span class="panel-title">Identités connues</span><button class="btn-cid" onclick="openIdentity('${g.id}')">+ Ajouter</button></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Poste</th><th>Statut</th><th>Véhicules</th><th>Mise à jour</th></tr></thead><tbody>${rows.map(p => `<tr class="clickable" onclick="openPerson('${p.id}')"><td><span class="person-name">${esc(personName(p))}</span></td><td>${esc(p.role || "—")}</td><td><span class="badge-status">${esc(p.status)}</span></td><td>${db.vehicles.filter(v => v.owner_id === p.id).length}</td><td>${fmtDate(p.updated_at || p.created_at)}</td></tr>`).join("")}</tbody></table></div>` : empty("Aucune identité")}</div>` }
   if (tab === "vehicles") { target.innerHTML = `<div class="panel"><div class="panel-head"><span class="panel-title">Véhicules associés</span><button class="btn-cid" onclick="openVehicle('${g.id}')">+ Ajouter</button></div>${vehicleTable(db.vehicles.filter(x => x.group_id === g.id))}</div>` }
   if (tab === "notes") { target.innerHTML = `<div class="panel"><div class="panel-head"><span class="panel-title">Renseignements CID</span><button class="btn-cid" onclick="openNote('${g.id}')">+ Ajouter</button></div>${db.notes.filter(x => x.group_id === g.id).map(noteHtml).join("") || empty("Aucun renseignement")}</div>` }
   if (tab === "relations") { target.innerHTML = `<div class="panel">${db.identities.filter(x => x.group_id === g.id).map(p => `<div class="activity"><div class="activity-icon">${esc(g.icon || "◈")}</div><div><strong class="clickable" onclick="openPerson('${p.id}')">${esc(personName(p))}</strong><p>${esc(p.role || "Poste inconnu")} → ${db.vehicles.filter(v => v.owner_id === p.id).map(v => `<span class="clickable" onclick="event.stopPropagation();openVehicleDetail('${v.id}')">${esc(v.make)} ${esc(v.model)} · ${esc(v.plate)}</span>`).join(", ") || "Aucun véhicule connu"}</p></div></div>`).join("") || empty("Aucune relation")}</div>` }
   if (tab === "reports") { target.innerHTML = `<div class="panel"><div class="panel-head"><span class="panel-title">Rapports du groupe</span><button class="btn-cid" onclick="openReport()">+ Nouveau rapport</button></div>${db.reports.filter(r=>r.group_id===g.id).map(reportCard).join("")||empty("Aucun rapport")}</div>` }
   if (tab === "history") { target.innerHTML = `<div class="panel">${historyRows(db.history.filter(h => (h.detail || "").toLowerCase().includes(g.name.toLowerCase()))).join("") || empty("Aucun historique spécifique")}</div>` }
}

function openPerson(id) {
   const p = personById(id); if (!p) return; selectedPerson = id; const g = groupById(p.group_id), vs = db.vehicles.filter(v => v.owner_id === id), ns = db.notes.filter(n => n.identity_id === id);
   $("#content").innerHTML = `<div class="page-head"><div><button class="btn-ghost mb-2" onclick="setView('identities')">← Identités</button><div class="eyebrow">FICHE INDIVIDUELLE</div><h1>${esc(personName(p))}</h1><div class="subtitle">${esc(g?.icon || "")} ${esc(g?.name || "—")} · ${esc(p.role || "Poste inconnu")}</div></div><button class="btn-cid" onclick="openNote('${g?.id || ""}','${p.id}')">+ Ajouter un renseignement</button></div>
 <div class="detail-grid"><div class="panel"><div class="panel-head"><span class="panel-title">Informations personnelles</span></div>${[
         ["Nom", p.last_name], ["Prénom", p.first_name], ["Date de naissance", fmtDate(p.birth_date)], ["Téléphone", p.phone || "—"], ["Statut", p.status], ["Implication", p.involvement || "—"]
      ].map(x => `<div class="kv"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join("")}</div>
 <div class="panel"><div class="panel-head"><span class="panel-title">Groupe</span></div><div class="group-top"><span class="group-symbol">${esc(g?.icon || "◈")}</span><div><div class="group-name">${esc(g?.name || "—")}</div><div class="group-cat">${esc(p.role || "Poste inconnu")}</div></div></div><p class="mt-4 muted">${esc(p.notes || "Aucune note.")}</p></div></div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Véhicules associés</span></div>${vehicleTable(vs)}</div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Renseignements CID</span></div>${ns.map(noteHtml).join("") || empty("Aucun renseignement")}</div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Rapports liés</span></div>${db.reports.filter(r=>r.suspect_id===id||r.identity_id===id||db.report_people.some(x=>x.report_id===r.id&&x.identity_id===id)).map(r=>`<div class="activity clickable" onclick="openReportDetail('${r.id}')"><div class="activity-icon">${reportBadge(r.report_type)}</div><div><strong>${esc(reportTitle(r))}</strong><p>${esc(reportProduct(r))} · ${fmtDate(r.report_date||r.created_at)}</p></div></div>`).join('')||empty('Aucun rapport lié')}</div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Relations entre personnes</span></div>${db.person_relations.filter(x=>x.person_a_id===id||x.person_b_id===id).map(x=>{const other=personById(x.person_a_id===id?x.person_b_id:x.person_a_id);return other?`<div class="activity"><div class="activity-icon">🔗</div><div><strong class="clickable" onclick="openPerson('${other.id}')">${esc(personName(other))}</strong><p>${esc(x.relation_type||'ASSOCIÉ')}</p></div></div>`:''}).join('')||empty('Aucune relation')}</div>`;
}

function openVehicleDetail(id) {
   const v = db.vehicles.find(x => x.id === id); if (!v) return; const p = personById(v.owner_id), g = groupById(v.group_id);
   $("#content").innerHTML = `<div class="page-head"><div><button class="btn-ghost mb-2" onclick="setView('vehicles')">← Véhicules</button><div class="eyebrow">FICHE VÉHICULE</div><h1>${esc(v.make)} ${esc(v.model)}</h1><div class="subtitle">${esc(v.plate)} · ${esc(v.color || "Couleur inconnue")}</div></div></div>
 <div class="detail-grid"><div class="panel"><div class="panel-head"><span class="panel-title">Détails</span></div>${[["Marque", v.make], ["Modèle", v.model], ["Plaque", v.plate], ["Couleur", v.color || "—"], ["Statut", v.stolen ? "Véhicule signalé" : "Normal"]].map(x => `<div class="kv"><span>${x[0]}</span><span>${esc(x[1])}</span></div>`).join("")}</div>
 <div class="panel"><div class="panel-head"><span class="panel-title">Relations</span></div><div class="kv"><span>Propriétaire</span><span class="clickable" onclick="${p ? `openPerson('${p.id}')` : ""}">${esc(personName(p))}</span></div><div class="kv"><span>Groupe</span><span class="clickable" onclick="${g ? `openGroup('${g.id}')` : ""}">${esc(g?.icon || "")} ${esc(g?.name || "—")}</span></div><div class="kv"><span>Poste</span><span>${esc(p?.role || "—")}</span></div></div></div>
 <div class="panel mt-3"><div class="panel-head"><span class="panel-title">Notes véhicule</span></div><p class="muted mb-0">${esc(v.notes || "Aucune note.")}</p></div>`;
}

function populateSelects() {
   const groups = db.groups.map(g => `<option value="${g.id}">${esc(g.icon || "")} ${esc(g.name)}</option>`).join("");
   $("#identityGroup").innerHTML = groups; $("#vehicleGroup").innerHTML = groups; $("#noteGroup").innerHTML = groups;
   $("#vehicleOwner").innerHTML = '<option value="">Sans propriétaire</option>' + db.identities.map(p => `<option value="${p.id}">${esc(personName(p))}</option>`).join("");
   $("#noteIdentity").innerHTML = '<option value="">Aucune</option>' + db.identities.map(p => `<option value="${p.id}">${esc(personName(p))}</option>`).join("");
}
function openIdentity(groupId = "") { populateSelects(); $("#identityForm").reset(); $("#identityGroup").value = groupId || selectedGroup || db.groups[0]?.id || ""; $("#identityDuplicate").classList.add("d-none"); bootstrap.Modal.getOrCreateInstance("#identityModal").show() }
function openVehicle(groupId = "") { populateSelects(); $("#vehicleForm").reset(); $("#vehicleGroup").value = groupId || selectedGroup || db.groups[0]?.id || ""; bootstrap.Modal.getOrCreateInstance("#vehicleModal").show() }
function openNote(groupId = "", identityId = "") { populateSelects(); $("#noteForm").reset(); $("#noteGroup").value = groupId || selectedGroup || db.groups[0]?.id || ""; $("#noteIdentity").value = identityId || selectedPerson || ""; bootstrap.Modal.getOrCreateInstance("#noteModal").show() }

async function audit(action, detail) {
   const row = { action, detail, agent: "Agent CID" };
   const { error } = await sb.from("audit_log").insert(row); if (error) throw error;
   db.history.unshift({ ...row, created_at: new Date().toISOString() });
}

$("#identityForm").addEventListener("submit", async e => {
   e.preventDefault(); const f = new FormData(e.target), p = Object.fromEntries(f.entries());
   const duplicate = db.identities.find(x => x.first_name.trim().toLowerCase() === p.first_name.trim().toLowerCase() && x.last_name.trim().toLowerCase() === p.last_name.trim().toLowerCase());
   if (duplicate) { $("#identityDuplicate").classList.remove("d-none"); $("#identityDuplicate").innerHTML = `⚠️ Cette identité existe déjà : <strong>${esc(personName(duplicate))}</strong>.`; return }
   try { const { data, error } = await sb.from("identities").insert(p).select().single(); if (error) throw error; await audit("Identité ajoutée", `${personName(data)} a été ajoutée à ${groupById(data.group_id)?.name || "un groupe"}.`); bootstrap.Modal.getInstance($("#identityModal")).hide(); toast("Identité enregistrée"); await loadDB(); render() } catch (e) { err(e) }
});
$("#vehicleForm").addEventListener("submit", async e => {
   e.preventDefault(); const f = new FormData(e.target), p = Object.fromEntries(f.entries()); p.stolen = f.has("stolen"); p.plate = p.plate.trim().toUpperCase();
   if (db.vehicles.some(v => v.plate.toLowerCase() === p.plate.toLowerCase())) { toast("Cette plaque existe déjà dans la base.", true); return }
   try { const { data, error } = await sb.from("vehicles").insert(p).select().single(); if (error) throw error; await audit("Véhicule ajouté", `${data.make} ${data.model} · ${data.plate} a été enregistré.`); bootstrap.Modal.getInstance($("#vehicleModal")).hide(); toast("Véhicule enregistré"); await loadDB(); render() } catch (e) { err(e) }
});
$("#noteForm").addEventListener("submit", async e => {
   e.preventDefault(); const f = new FormData(e.target), p = Object.fromEntries(f.entries()); p.agent = "Agent CID";
   try { const { data, error } = await sb.from("intelligence_notes").insert(p).select().single(); if (error) throw error; await audit("Renseignement ajouté", `Nouvelle note au groupe ${groupById(data.group_id)?.name || "—"}.`); bootstrap.Modal.getInstance($("#noteModal")).hide(); toast("Renseignement enregistré"); await loadDB(); render() } catch (e) { err(e) }
});

$("#reportForm")?.addEventListener("submit", async e => {
 e.preventDefault();
 const f=new FormData(e.target), base=Object.fromEntries(f.entries());
 const manualSuspect=$("#manualSuspectToggle")?.checked; const suspect=manualSuspect?null:personById(base.suspect_id); const product=(base.product||'').trim();
 let drug=db.drugs.find(d=>d.name.toLowerCase()===product.toLowerCase());
 const qty=parseQuantity(base.quantity);
 const reportPayload={report_type:base.report_type,title:base.title||null,group_id:base.group_id||null,quantity:qty.number,unit:qty.unit,location:null,suspect_last_name:manualSuspect?(base.manual_last_name||null):(suspect?.last_name||null),suspect_first_name:manualSuspect?(base.manual_first_name||null):(suspect?.first_name||null),suspect_phone:base.phone||suspect?.phone||null,content:base.content||null,agent:'Agent CID',report_date:new Date().toISOString(),suspect_id:manualSuspect?null:(base.suspect_id||null),phone:base.phone||null,product:product||null,linked_traffic:f.has('linked_traffic'),linked_report_id:base.linked_report_id||null,related_report_id:base.linked_report_id||null};
 if(drug) reportPayload.drug_id=drug.id;
 let data,error;
 try {
   const id=window.editingReportId;
   if(id){ let res=await sb.from('reports').update(reportPayload).eq('id',id).select().single(); if(res.error && ('product' in reportPayload || 'suspect_id' in reportPayload || 'phone' in reportPayload || 'linked_traffic' in reportPayload)){ const fallback={report_type:base.report_type,title:base.title||null,identity_id:base.suspect_id||null,group_id:base.group_id||null,drug_id:drug?.id||null,related_report_id:base.linked_report_id||null,quantity:qty.number,unit:qty.unit,content:base.content||null,agent:'Agent CID',report_date:new Date().toISOString()}; res=await sb.from('reports').update(fallback).eq('id',id).select().single(); } data=res.data;error=res.error; }
   else { let res=await sb.from('reports').insert(reportPayload).select().single(); if(res.error){ const fallback={report_type:base.report_type,title:base.title||null,identity_id:base.suspect_id||null,group_id:base.group_id||null,drug_id:drug?.id||null,related_report_id:base.linked_report_id||null,quantity:qty.number,unit:qty.unit,content:base.content||null,agent:'Agent CID',report_date:new Date().toISOString()}; res=await sb.from('reports').insert(fallback).select().single(); } data=res.data;error=res.error; }
   if(error)throw error;
   const rid=data.id;
   await sb.from('report_people').delete().eq('report_id',rid);
   const people=[...document.querySelectorAll('#reportPeopleList .relation-row')].map(row=>({report_id:rid,identity_id:row.querySelector('.report-person')?.value||null,person_name:row.querySelector('.report-person-manual')?.value?.trim()||null,person_phone:row.querySelector('.report-person-phone')?.value?.trim()||null,relation_type:row.querySelector('.report-person-role')?.value||'LIÉ'})).filter(x=>x.identity_id || x.person_name);
   if(people.length){let rr=await sb.from('report_people').insert(people);if(rr.error)throw rr.error;}
   await sb.from('report_vehicles').delete().eq('report_id',rid);
   const vehicles=[...document.querySelectorAll('#reportVehiclesList .relation-row')].map(row=>({report_id:rid,vehicle_id:row.querySelector('.report-vehicle')?.value,relation_type:row.querySelector('.report-vehicle-role')?.value||'LIÉ'})).filter(x=>x.vehicle_id);
   if(vehicles.length){let rr=await sb.from('report_vehicles').insert(vehicles);if(rr.error)throw rr.error;}
   // Les preuves sont remplacées lors d'une modification. Les URLs sont stockées directement.
   if(window.editingReportId) await sb.from('evidence').delete().eq('report_id',rid);
   const ev=(window.pendingEvidence||[]).map(x=>({report_id:rid,url:x.url||'',caption:x.caption||x.title||'Preuve',mime_type:x.mime_type||null,title:x.caption||x.title||'Preuve',evidence_type:'IMAGE',description:null})).filter(x=>x.url);
   if(ev.length){let rr=await sb.from('evidence').insert(ev);if(rr.error){const simple=ev.map(x=>({report_id:rid,url:x.url,description:x.caption}));rr=await sb.from('evidence').insert(simple);}if(rr.error)throw rr.error;}
   // Relations entre personnes : le suspect principal est relié à toutes les personnes ajoutées au rapport.
   if(base.suspect_id){
     const rels=people.filter(x=>x.identity_id && x.identity_id!==base.suspect_id).map(x=>({person_a_id:base.suspect_id,person_b_id:x.identity_id,relation_type:x.relation_type||'ASSOCIÉ',notes:`Rapport ${rid}`}));
     for(const rel of rels){
       try{
         const a=await sb.from('person_relations').select('id').eq('person_a_id',rel.person_a_id).eq('person_b_id',rel.person_b_id).eq('relation_type',rel.relation_type).limit(1);
         const b=await sb.from('person_relations').select('id').eq('person_a_id',rel.person_b_id).eq('person_b_id',rel.person_a_id).eq('relation_type',rel.relation_type).limit(1);
         if(!a.error && !a.data?.length && !b.error && !b.data?.length) await sb.from('person_relations').insert(rel);
       }catch(x){console.warn('relation non enregistrée',x.message)}
     }
   }
   await audit(window.editingReportId?'Rapport modifié':'Rapport créé',`${reportTypeLabel(base.report_type)} · ${product||'Produit inconnu'}${suspect?' · '+personName(suspect):''}`);
   bootstrap.Modal.getInstance($("#reportModal")).hide(); toast('Rapport enregistré'); await loadDB(); render();
 }catch(err){err instanceof Error?window.console.error(err):console.error(err); err && err.message ? toast(err.message,true):toast('Erreur lors de l’enregistrement',true)}
});
$("#addReportPerson")?.addEventListener('click',()=>addReportPersonRow());
$("#addReportVehicle")?.addEventListener('click',()=>addReportVehicleRow());
$("#addEvidenceUrl")?.addEventListener('click',addEvidenceUrl);
$("#chooseEvidenceFile")?.addEventListener('click',()=>$("#evidenceFile")?.click());
$("#evidenceFile")?.addEventListener('change',e=>addEvidenceFiles(e.target.files));
$("#linkedTraffic")?.addEventListener('change',toggleLinkedReport);
$("#evidencePaste")?.addEventListener('paste',async e=>{const files=[...(e.clipboardData?.files||[])]; if(files.length){e.preventDefault();await addEvidenceFiles(files);}});
$("#evidencePaste")?.addEventListener('dragover',e=>{e.preventDefault();$("#evidencePaste").classList.add('dragover')});
$("#evidencePaste")?.addEventListener('dragleave',()=>$("#evidencePaste").classList.remove('dragover'));
$("#evidencePaste")?.addEventListener('drop',async e=>{e.preventDefault();$("#evidencePaste").classList.remove('dragover');await addEvidenceFiles(e.dataTransfer.files)});

function bindContent() {
   $("#pageSearch")?.addEventListener("input", e => doSearch(e.target.value));
   $("#historyFilter")?.addEventListener("input", e => { const q = e.target.value.toLowerCase(); $("#historyList").innerHTML = historyRows(db.history.filter(h => (h.action + " " + h.detail + " " + h.agent).toLowerCase().includes(q))).join("") || empty("Aucun résultat") });
   $("#reportSearch")?.addEventListener("input", e => { window.reportFilterSearch=e.target.value; render(); setTimeout(()=>{const x=$("#reportSearch"); if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},0); });
   $("#reportProductFilter")?.addEventListener("change", e => { window.reportFilterProduct=e.target.value; render(); });
}
$("#globalSearch").addEventListener("keydown", e => { if (e.key === "Enter") { openSearch(); setTimeout(() => { $("#pageSearch").value = e.target.value; doSearch(e.target.value) }, 50) } });
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#globalSearch").focus() } });
document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => setView(b.dataset.view));
$("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");

window.openGroup = openGroup; window.openPerson = openPerson; window.openVehicleDetail = openVehicleDetail; window.openIdentity = openIdentity; window.openVehicle = openVehicle; window.openNote = openNote; window.openReport = openReport; window.openReportDetail = openReportDetail; window.setView = setView; window.openSearch = openSearch; window.setReportFilter = setReportFilter;

(async () => { try { await loadDB(); render() } catch (e) { $("#content").innerHTML = `<div class="panel"><div class="empty"><i class="bi bi-database-x"></i><h5>Connexion Supabase impossible</h5><p>${esc(e.message)}</p><p>Vérifie que le script SQL a bien été exécuté et que les policies RLS sont présentes.</p></div></div>` } })();
