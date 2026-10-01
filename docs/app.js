
(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    properties: [],
    metrics: {},
    filtered: [],
    scored: [],
    compare: [],
    view: "cards",
    map: null,
    markers: null,
    sourceMode: "demo"
  };

  const els = {
    search: $("searchInput"), business: $("businessType"), city: $("cityFilter"),
    propertyType: $("propertyType"), maxBudget: $("maxBudget"), minScore: $("minScore"),
    minAcres: $("minAcres"), minSqft: $("minSqft"), includeUnpriced: $("includeUnpriced"),
    sortBy: $("sortBy"), cards: $("cardsView"), mapView: $("mapView"), tableView: $("tableView"),
    tableBody: $("resultsTable"), matchCount: $("matchCount"), medianPrice: $("medianPrice"),
    avgScore: $("avgScore"), cityCount: $("cityCount"), resultsTitle: $("resultsTitle"),
    compareTray: $("compareTray"), compareCount: $("compareCount"), compareChips: $("compareChips"),
    compareDialog: $("compareDialog"), compareContent: $("compareContent"),
    sourceMode: $("sourceMode"), sourceDetail: $("sourceDetail")
  };

  function clamp(v, min=0, max=100){ return Math.max(min, Math.min(max, v)); }
  function n(v){ const x=Number(v); return Number.isFinite(x) ? x : null; }
  function fmtNum(v){ return v == null ? "—" : Math.round(v).toLocaleString(); }
  function fmtCurrency(v, compact=false){
    if(v == null || !Number.isFinite(Number(v))) return "Unpriced";
    const x=Number(v);
    if(compact && x >= 1_000_000) return `$${(x/1_000_000).toFixed(x>=10_000_000?1:2).replace(/\.00$/,"")}M`;
    if(compact && x >= 1000) return `$${Math.round(x/1000)}K`;
    return x.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  }
  function fmtAcres(v){ return v == null ? "—" : `${Number(v).toFixed(Number(v)<10?1:0)} ac`; }
  function parseMoney(s){ const x=Number(String(s||"").replace(/[^0-9.]/g,"")); return Number.isFinite(x)&&x>0?x:null; }
  function median(arr){
    const v=arr.filter(x=>Number.isFinite(x)).slice().sort((a,b)=>a-b);
    if(!v.length) return null; const m=Math.floor(v.length/2); return v.length%2?v[m]:(v[m-1]+v[m])/2;
  }
  function percentileRank(value, arr, inverse=false){
    const v=arr.filter(x=>Number.isFinite(x)).sort((a,b)=>a-b);
    if(value==null || !v.length) return 50;
    const less=v.filter(x=>x<=value).length/v.length*100;
    return inverse ? 100-less : less;
  }
  function normalizeCity(s){
    if(!s) return "Unknown";
    const aliases={"FUQUAY VARINA":"Fuquay-Varina","Fuquay Varina":"Fuquay-Varina","FUQUAY-VARINA":"Fuquay-Varina","RALEIGH":"Raleigh","raleigh":"Raleigh"};
    return aliases[s] || s;
  }

  function fitScore(p, business){
    if(business==="ANY") return 72;
    const text=`${p.type||""} ${p.subtype||""}`.toLowerCase();
    const has=(word)=>text.includes(word);
    const matrix={
      RETAIL: [[["retail","shopping","store"],100],[["mixed use"],88],[["commercial"],78],[["land"],68],[["office"],45],[["industrial"],30],[["multifamily"],25]],
      RESTAURANT: [[["restaurant","retail"],100],[["hospitality"],82],[["mixed use"],80],[["commercial"],75],[["land"],66],[["office"],42],[["industrial"],25]],
      OFFICE: [[["office","medical"],100],[["mixed use"],88],[["commercial"],76],[["land"],62],[["retail"],55],[["industrial"],48],[["multifamily"],28]],
      INDUSTRIAL: [[["industrial","warehouse","flex","self storage"],100],[["land"],82],[["commercial"],72],[["mixed use"],55],[["office"],43],[["retail"],30],[["multifamily"],18]],
      MULTIFAMILY: [[["multifamily","apartment","senior living"],100],[["residential"],90],[["mixed use"],83],[["land"],75],[["office"],32],[["retail"],30],[["industrial"],15]]
    };
    for(const [tokens,score] of matrix[business]||[]){
      if(tokens.some(has)) return score;
    }
    return 45;
  }

  function marketScore(city){
    const m=state.metrics[normalizeCity(city)];
    if(!m) return 50;
    const pop=n(m.population2024), growth=n(m.growthPct2020to2024);
    const popScore=pop ? clamp(25 + 75 * (Math.log10(pop)-Math.log10(9000))/(Math.log10(500639)-Math.log10(9000))) : 50;
    const growthScore=growth != null ? clamp((growth/35)*100) : 50; // very high growth is capped
    return clamp(popScore*.58 + growthScore*.42);
  }

  function financialScore(p){
    const c=n(p.capRate);
    if(c==null || c===0) return 55;
    return clamp(25 + ((c-4)/4)*75);
  }

  function completenessScore(p){
    const keys=["askingPrice","sqft","lotAcres","capRate","latitude","longitude","daysOnMarket"];
    const present=keys.filter(k=>p[k]!=null && p[k]!==0).length;
    return 35 + (present/keys.length)*65;
  }

  function computeGroupStats(props){
    const groups={};
    props.forEach(p=>{
      const major=(p.type||"Other").split(",")[0].trim();
      const key=`${normalizeCity(p.city)}|${major}`;
      groups[key] ||= {ppsf:[], ppa:[], prices:[]};
      if(n(p.pricePerSqft)>0) groups[key].ppsf.push(n(p.pricePerSqft));
      if(n(p.pricePerAcre)>0) groups[key].ppa.push(n(p.pricePerAcre));
      if(n(p.askingPrice)>0) groups[key].prices.push(n(p.askingPrice));
    });
    return groups;
  }

  function valueScore(p, groups, budget){
    const major=(p.type||"Other").split(",")[0].trim();
    const group=groups[`${normalizeCity(p.city)}|${major}`] || {ppsf:[],ppa:[],prices:[]};
    let relative=52;
    if(n(p.pricePerSqft)>0 && group.ppsf.length>=3) relative=percentileRank(n(p.pricePerSqft),group.ppsf,true);
    else if(n(p.pricePerAcre)>0 && group.ppa.length>=3) relative=percentileRank(n(p.pricePerAcre),group.ppa,true);
    else if(n(p.askingPrice)>0 && group.prices.length>=3) relative=percentileRank(n(p.askingPrice),group.prices,true);

    let budgetScore=55;
    const price=n(p.askingPrice);
    if(budget && price){
      const ratio=price/budget;
      budgetScore = ratio<=.6 ? 100 : ratio<=1 ? 100-((ratio-.6)/.4)*35 : clamp(65-(ratio-1)*100);
    } else if(budget && !price) budgetScore=48;
    return budget ? relative*.45 + budgetScore*.55 : relative;
  }

  function scoreProperty(p, groups){
    const budget=parseMoney(els.maxBudget.value);
    const fit=fitScore(p,els.business.value);
    const market=marketScore(p.city);
    const value=valueScore(p,groups,budget);
    const financial=financialScore(p);
    const complete=completenessScore(p);
    let score=fit*.35 + market*.25 + value*.20 + financial*.10 + complete*.10;

    const minAcres=n(els.minAcres.value);
    const minSqft=n(els.minSqft.value);
    if(minAcres && n(p.lotAcres)!=null && n(p.lotAcres)<minAcres) score-=12;
    if(minSqft && n(p.sqft)!=null && n(p.sqft)<minSqft) score-=12;

    const reasons=[];
    if(fit>=85) reasons.push("Strong use fit");
    else if(fit<50) reasons.push("Weak use fit");
    if(market>=72) reasons.push("Strong local growth");
    if(value>=70) reasons.push("Relative value");
    if(n(p.capRate)>=6.5) reasons.push("Higher cap rate");
    if(!p.askingPrice) reasons.push("Price unavailable");
    if(!state.metrics[normalizeCity(p.city)]) reasons.push("Limited city data");

    return {...p, _score:Math.round(clamp(score)), _parts:{fit:Math.round(fit),market:Math.round(market),value:Math.round(value),financial:Math.round(financial),complete:Math.round(complete)}, _reasons:reasons.slice(0,3)};
  }

  function applyFilters(){
    const q=els.search.value.trim().toLowerCase();
    const city=els.city.value;
    const ptype=els.propertyType.value.toLowerCase();
    const budget=parseMoney(els.maxBudget.value);
    const minScore=Number(els.minScore.value||0);
    const minAcres=Number(els.minAcres.value||0);
    const minSqft=Number(els.minSqft.value||0);
    const includeUnpriced=els.includeUnpriced.checked;
    const groups=computeGroupStats(state.properties);
    let out=state.properties.map(p=>scoreProperty(p,groups)).filter(p=>{
      const hay=`${p.name||""} ${p.address||""} ${p.city||""} ${p.type||""} ${p.subtype||""}`.toLowerCase();
      if(q && !hay.includes(q)) return false;
      if(city && normalizeCity(p.city)!==city) return false;
      if(ptype && !`${p.type||""} ${p.subtype||""}`.toLowerCase().includes(ptype)) return false;
      if(budget && p.askingPrice && Number(p.askingPrice)>budget) return false;
      if(budget && !p.askingPrice && !includeUnpriced) return false;
      if(!includeUnpriced && !p.askingPrice) return false;
      if(minAcres && (!p.lotAcres || Number(p.lotAcres)<minAcres)) return false;
      if(minSqft && (!p.sqft || Number(p.sqft)<minSqft)) return false;
      if(p._score<minScore) return false;
      return true;
    });
    const sort=els.sortBy.value;
    out.sort((a,b)=>{
      if(sort==="priceAsc") return (a.askingPrice??Infinity)-(b.askingPrice??Infinity);
      if(sort==="priceDesc") return (b.askingPrice??-1)-(a.askingPrice??-1);
      if(sort==="acresDesc") return (b.lotAcres??-1)-(a.lotAcres??-1);
      if(sort==="domAsc") return (a.daysOnMarket??Infinity)-(b.daysOnMarket??Infinity);
      return b._score-a._score;
    });
    state.filtered=out;
    render();
  }

  function marketLabel(p){
    const m=state.metrics[normalizeCity(p.city)];
    if(!m) return "No city metric";
    return `${fmtNum(m.population2024)} pop · +${m.growthPct2020to2024}%`;
  }

  function cardHtml(p){
    const selected=state.compare.some(x=>x.id===p.id);
    const m=state.metrics[normalizeCity(p.city)];
    const reasons=(p._reasons||[]).map(x=>`<span class="reason ${x.includes("unavailable")||x.includes("Limited")||x.includes("Weak")?"warn":""}">${x}</span>`).join("");
    return `<article class="property-card">
      <div class="card-top"></div>
      <div class="card-body">
        <div class="card-header">
          <div><h3 class="card-title">${escapeHtml(p.name)}</h3><p class="card-address">${escapeHtml([p.address,p.city,p.state,p.zip].filter(Boolean).join(", "))}</p></div>
          <div class="score-badge" style="--score:${p._score}"><strong>${p._score}</strong></div>
        </div>
        <div class="price-line"><div class="price">${fmtCurrency(p.askingPrice)}</div><span class="type-pill" title="${escapeHtml(p.type||"")}">${escapeHtml(p.type||"Other")}</span></div>
        <div class="metric-row">
          <div class="metric"><span>LOT</span><strong>${fmtAcres(p.lotAcres)}</strong></div>
          <div class="metric"><span>BUILDING</span><strong>${p.sqft?fmtNum(p.sqft)+" sf":"—"}</strong></div>
          <div class="metric"><span>CAP RATE</span><strong>${p.capRate?Number(p.capRate).toFixed(2)+"%":"—"}</strong></div>
        </div>
        <div class="metric-row">
          <div class="metric"><span>2024 POP.</span><strong>${m?fmtNum(m.population2024):"—"}</strong></div>
          <div class="metric"><span>2020–24 GROWTH</span><strong>${m?`+${m.growthPct2020to2024}%`:"—"}</strong></div>
          <div class="metric"><span>DAYS MARKET</span><strong>${p.daysOnMarket??"—"}</strong></div>
        </div>
        <div class="reason-row">${reasons}</div>
      </div>
      <div class="card-actions">
        <button class="compare-btn ${selected?"selected":""}" data-compare="${p.id}">${selected?"Selected":"Add to compare"}</button>
        ${p.sourceUrl?`<a class="source-link" href="${escapeAttr(p.sourceUrl)}" target="_blank" rel="noreferrer">View source ↗</a>`:`<span class="table-sub">Demo listing</span>`}
      </div>
    </article>`;
  }

  function renderCards(){
    if(!state.filtered.length){ els.cards.innerHTML='<div class="empty"><strong>No properties match these filters.</strong><br><span>Try raising the budget, lowering the score threshold, or resetting the filters.</span></div>'; return; }
    els.cards.innerHTML=state.filtered.slice(0,80).map(cardHtml).join("");
  }

  function renderTable(){
    els.tableBody.innerHTML=state.filtered.map(p=>`<tr>
      <td><span class="score-mini">${p._score}</span></td>
      <td><span class="table-name">${escapeHtml(p.name)}</span><span class="table-sub">${escapeHtml(p.address||"")}</span></td>
      <td>${escapeHtml(p.city||"—")}</td><td>${escapeHtml(p.type||"—")}</td>
      <td>${fmtCurrency(p.askingPrice,true)}</td>
      <td>${p.sqft?fmtNum(p.sqft)+" sf":fmtAcres(p.lotAcres)}</td>
      <td>${escapeHtml(marketLabel(p))}</td>
      <td><button class="compare-btn ${state.compare.some(x=>x.id===p.id)?"selected":""}" data-compare="${p.id}">Compare</button></td>
    </tr>`).join("");
  }

  function initMap(){
    if(state.map || !window.L) return;
    state.map=L.map("map",{zoomControl:true}).setView([35.79,-78.64],10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
    }).addTo(state.map);
    state.markers=L.layerGroup().addTo(state.map);
  }
  function renderMap(){
    initMap();
    if(!state.map) return;
    state.markers.clearLayers();
    const bounds=[];
    state.filtered.forEach(p=>{
      const lat=n(p.latitude), lon=n(p.longitude);
      if(lat==null||lon==null) return;
      const icon=L.divIcon({className:"score-marker",html:String(p._score),iconSize:[35,27],iconAnchor:[17,13]});
      const marker=L.marker([lat,lon],{icon}).addTo(state.markers);
      marker.bindPopup(`<div class="popup-title">${escapeHtml(p.name)}</div><div class="popup-meta">${fmtCurrency(p.askingPrice)} · ${escapeHtml(p.city||"")} · score ${p._score}</div>`);
      bounds.push([lat,lon]);
    });
    if(bounds.length) state.map.fitBounds(bounds,{padding:[30,30],maxZoom:12});
    setTimeout(()=>state.map.invalidateSize(),50);
  }

  function renderKpis(){
    els.matchCount.textContent=state.filtered.length.toLocaleString();
    const priced=state.filtered.map(p=>n(p.askingPrice)).filter(Boolean);
    els.medianPrice.textContent=priced.length?fmtCurrency(median(priced),true):"—";
    els.avgScore.textContent=state.filtered.length?Math.round(state.filtered.reduce((s,p)=>s+p._score,0)/state.filtered.length):"—";
    els.cityCount.textContent=new Set(state.filtered.map(p=>normalizeCity(p.city))).size;
    const business=els.business.options[els.business.selectedIndex].text;
    els.resultsTitle.textContent=els.business.value==="ANY"?"Properties":`${business} candidates`;
  }

  function renderCompareTray(){
    if(!state.compare.length){ els.compareTray.classList.add("hidden"); return; }
    els.compareTray.classList.remove("hidden");
    els.compareCount.textContent=`${state.compare.length} selected`;
    els.compareChips.innerHTML=state.compare.map(p=>`<span class="compare-chip">${escapeHtml(p.name)}</span>`).join("");
  }

  function renderCompareDialog(){
    const items=state.compare.map(p=>{
      const current=state.filtered.find(x=>x.id===p.id);
      return current || scoreProperty(p,computeGroupStats(state.properties));
    });
    const rows=[
      ["SiteFit score",p=>`<strong>${p._score}/100</strong>`],
      ["Price",p=>fmtCurrency(p.askingPrice)],
      ["Property type",p=>escapeHtml(p.type||"—")],
      ["Lot size",p=>fmtAcres(p.lotAcres)],
      ["Building",p=>p.sqft?`${fmtNum(p.sqft)} sf`:"—"],
      ["Cap rate",p=>p.capRate?`${Number(p.capRate).toFixed(2)}%`:"—"],
      ["2024 population",p=>fmtNum(state.metrics[normalizeCity(p.city)]?.population2024)],
      ["2020–24 growth",p=>state.metrics[normalizeCity(p.city)]?`+${state.metrics[normalizeCity(p.city)].growthPct2020to2024}%`:"—"],
      ["Fit component",p=>`${p._parts.fit}/100`],["Market component",p=>`${p._parts.market}/100`],
      ["Value component",p=>`${p._parts.value}/100`],["Days on market",p=>p.daysOnMarket??"—"],
      ["Location",p=>escapeHtml(`${p.city||""}, ${p.state||""}`)]
    ];
    els.compareContent.innerHTML=`<div class="compare-grid" style="--cols:${items.length}">
      <div class="compare-label">Property</div>${items.map(p=>`<div class="compare-value"><strong>${escapeHtml(p.name)}</strong><br><span class="table-sub">${escapeHtml(p.address||"")}</span></div>`).join("")}
      ${rows.map(([label,fn])=>`<div class="compare-label">${label}</div>${items.map(p=>`<div class="compare-value">${fn(p)}</div>`).join("")}`).join("")}
    </div>`;
  }

  function render(){
    renderKpis(); renderCards(); renderTable(); renderCompareTray();
    if(state.view==="map") renderMap();
  }

  function toggleCompare(id){
    const existing=state.compare.findIndex(p=>p.id===id);
    if(existing>=0) state.compare.splice(existing,1);
    else{
      if(state.compare.length>=3){ alert("Compare up to 3 properties at a time."); return; }
      const p=state.properties.find(x=>x.id===id); if(p) state.compare.push(p);
    }
    render();
  }

  function setView(view){
    state.view=view;
    document.querySelectorAll(".view-toggle button").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    els.cards.classList.toggle("hidden",view!=="cards");
    els.mapView.classList.toggle("hidden",view!=="map");
    els.tableView.classList.toggle("hidden",view!=="table");
    if(view==="map") renderMap();
  }

  function populateCities(){
    const cities=[...new Set(state.properties.map(p=>normalizeCity(p.city)).filter(Boolean))].sort();
    els.city.innerHTML='<option value="">All cities</option>'+cities.map(c=>`<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
  }

  function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
  function escapeAttr(s){ return escapeHtml(s); }

  async function loadJson(url){
    const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`${r.status}`); return r.json();
  }
  async function loadData(){
    const metrics=await loadJson("data/city-metrics.json");
    state.metrics=metrics.cities||{};
    try{
      const props=await loadJson("/api/properties");
      state.properties=props;
      state.sourceMode="full";
      els.sourceMode.textContent=`Local dataset · ${props.length.toLocaleString()} listings`;
      els.sourceDetail.textContent="Using your private CREXi export through the Java server. Raw data stays out of Git.";
    }catch(err){
      const props=await loadJson("data/demo-properties.json");
      state.properties=props;
      state.sourceMode="demo";
      els.sourceMode.textContent=`Public demo · ${props.length} synthetic listings`;
      els.sourceDetail.textContent="Run the Java server with your private export to load all 385 listings.";
    }
    state.properties.forEach(p=>p.city=normalizeCity(p.city));
    populateCities();
    applyFilters();
  }

  function wireEvents(){
    [els.search,els.business,els.city,els.propertyType,els.maxBudget,els.minScore,els.minAcres,els.minSqft,els.includeUnpriced,els.sortBy].forEach(el=>{
      el.addEventListener(el.tagName==="INPUT"&&el.type!=="checkbox"?"input":"change",applyFilters);
    });
    $("resetBtn").addEventListener("click",()=>{
      els.search.value="";els.business.value="ANY";els.city.value="";els.propertyType.value="";
      els.maxBudget.value="";els.minScore.value="0";els.minAcres.value="";els.minSqft.value="";
      els.includeUnpriced.checked=true;els.sortBy.value="score";applyFilters();
    });
    document.querySelector(".view-toggle").addEventListener("click",e=>{
      const b=e.target.closest("button[data-view]"); if(b) setView(b.dataset.view);
    });
    document.addEventListener("click",e=>{
      const b=e.target.closest("[data-compare]"); if(b) toggleCompare(b.dataset.compare);
      const close=e.target.closest("[data-close]"); if(close) $(close.dataset.close).close();
    });
    $("clearCompare").addEventListener("click",()=>{state.compare=[];render();});
    $("openCompare").addEventListener("click",()=>{renderCompareDialog();els.compareDialog.showModal();});
    $("methodBtn").addEventListener("click",()=>$("methodDialog").showModal());
    [els.compareDialog,$("methodDialog")].forEach(d=>d.addEventListener("click",e=>{ if(e.target===d) d.close(); }));
    els.maxBudget.addEventListener("blur",()=>{ const v=parseMoney(els.maxBudget.value); if(v) els.maxBudget.value=v.toLocaleString(); });
  }

  wireEvents();
  loadData().catch(err=>{
    console.error(err);
    els.sourceMode.textContent="Data load failed";
    els.sourceDetail.textContent="Check that the project is served over HTTP instead of opening index.html directly.";
  });
})();
