// CareCompass - BedFinder Blitz | app.js
// Frontend talks to Backend (server.js) via /api/hospitals

let hospitals = [];
let userLat = 17.441;
let userLon = 78.498;
let activeFilters = new Set();
let filters = ["ICU","Ventilator","Oxygen","Cardiology","Trauma","Pediatrics","Cath Lab","Burn Unit"];

// ===== MAP SETUP =====
let map = L.map('map').setView([userLat, userLon], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);
let markers = [];

// ===== HAVERSINE - Fallback if backend fails =====
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// ===== STATUS BADGE LOGIC =====
function getStatus(h){
  if(h.icu === 0 && h.vent === 0) return {t:"ER Full - Divert", c:"red", cls:"divert"};
  if(h.icu <= 2) return {t:"Busy", c:"amber", cls:"busy"};
  return {t:"Beds Available", c:"green", cls:""};
}

// ===== FETCH FROM BACKEND =====
async function fetchHospitals(){
  const search = document.getElementById('search').value || "";
  const maxDist = document.getElementById('maxDist').value || 100;
  const filter = [...activeFilters].join(","); // backend handles first filter, rest in frontend

  try{
    const res = await fetch(`/api/hospitals?lat=${userLat}&lon=${userLon}&search=${encodeURIComponent(search)}&maxDist=${maxDist}`);
    let list = await res.json();
    // Frontend extra filtering for multiple pills
    list = list.filter(h=>{
      for(let f of activeFilters){
        if(f==="ICU" && h.icu<=0) return false;
        if(f==="Ventilator" && h.vent<=0) return false;
        if(f==="Oxygen" && h.oxy<=0) return false;
        if(["Cardiology","Trauma","Pediatrics","Cath Lab","Burn Unit"].includes(f) && !h.specs.includes(f)) return false;
      }
      return true;
    });
    // Sorting
    const s = document.getElementById('sortBy').value;
    if(s==="distance") list.sort((a,b)=>a.dist-b.dist);
    if(s==="icu") list.sort((a,b)=>b.icu-a.icu);
    if(s==="total") list.sort((a,b)=>(b.general+b.icu)-(a.general+a.icu));
    hospitals = list;
    renderList(list);
  }catch(err){
    console.error("Backend failed, using fallback", err);
    document.getElementById('list').innerHTML = `<p style="padding:20px;background:#fff;border-radius:12px">⚠️ Backend not running. Run <b>npm start</b> and refresh.</p>`;
  }
}

function render(){
  fetchHospitals();
}

// ===== RENDER CARDS + MAP =====
function renderList(list){
  document.getElementById('count').innerText = `${list.length} hospitals found • Location: ${userLat.toFixed(3)}, ${userLon.toFixed(3)} • Within ${document.getElementById('maxDist').value} km`;

  // Clear old markers
  markers.forEach(m=>map.removeLayer(m));
  markers = [];

  if(list.length===0){
    document.getElementById('list').innerHTML = '<p style="padding:20px;background:#fff;border-radius:12px">No hospitals match. Clear filters.</p>';
    return;
  }

  document.getElementById('list').innerHTML = list.map(h=>{
    let st = getStatus(h);
    let stale = h.updated > 240 ? `<span class="badge grey">⚠️ STALE DATA</span>` : `<span class="meta">Last Updated: ${h.updated} mins ago</span>`;
    return `
    <div class="card ${st.cls}">
      <div class="card-top">
        <div>
          <h3>${h.name}</h3>
          <p class="meta">📍 ${h.area} • ${h.dist} km • ⏱️ ~${h.eta} mins (Golden Hour)</p>
        </div>
        <span class="badge ${st.c}">${st.t}</span>
      </div>
      <div class="beds">
        <div class="bed"><b>${h.general}</b><span>General</span></div>
        <div class="bed"><b>${h.icu}</b><span>ICU</span></div>
        <div class="bed"><b>${h.vent}</b><span>Ventilator</span></div>
        <div class="bed"><b>${h.oxy}</b><span>Oxygen</span></div>
      </div>
      <p class="specs">✅ ${h.specs.join(" • ")}</p>
      <p class="meta">📞 ${h.phone} • ${stale}</p>
      <div class="actions">
        <a href="tel:${h.phone}"><button class="btn btn-blue" style="width:100%">📞 Call</button></a>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}" target="_blank"><button class="btn btn-red" style="width:100%">🧭 Navigate</button></a>
        <button class="btn btn-outline" onclick="sendAlert('${h.name}', ${h.eta})">🚑 Pre-Alert</button>
      </div>
    </div>`;
  }).join('');

  // Map pins - Green = Available, Orange = Busy, Red = Full
  list.forEach(h=>{
    let st = getStatus(h);
    let color = st.c==="green" ? "green" : st.c==="amber" ? "orange" : "red";
    let m = L.circleMarker([h.lat, h.lon], {radius:10, color:color, fillColor:color, fillOpacity:.9})
      .addTo(map)
      .bindPopup(`<b>${h.name}</b><br>${h.area} • ${h.dist} km<br>ICU: ${h.icu} | Vent: ${h.vent} | Oxy: ${h.oxy}<br><b>${st.t}</b>`);
    markers.push(m);
  });
}

// ===== FILTER PILLS =====
function renderPills(){
  document.getElementById('pills').innerHTML = filters.map(f=>
    `<button class="pill ${activeFilters.has(f)?'active':''}" onclick="toggleFilter('${f}')">${f}</button>`
  ).join('') + `<button class="pill" onclick="clearFilters()">Clear All</button>`;
}
function toggleFilter(f){
  activeFilters.has(f) ? activeFilters.delete(f) : activeFilters.add(f);
  renderPills();
  render();
}
function clearFilters(){
  activeFilters.clear();
  renderPills();
  render();
}

// ===== LOCATION =====
function setDemoLoc(v){
  let [la, lo] = v.split(',').map(Number);
  userLat = la; userLon = lo;
  map.setView([la, lo], 12);
  render();
}
function useMyLocation(){
  if(!navigator.geolocation) return alert("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(p=>{
    userLat = p.coords.latitude;
    userLon = p.coords.longitude;
    map.setView([userLat, userLon], 12);
    render();
  }, ()=> alert("Location denied - using demo location"));
}

// ===== PRE-ARRIVAL ALERT =====
async function sendAlert(name, eta){
  try{
    await fetch('/api/alert', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({hospital:name, eta:eta})
    });
  }catch(e){ console.log("Alert demo mode", e); }
  let box = document.getElementById('alertBox');
  box.style.display = 'block';
  box.innerHTML = `✅ Pre-Arrival Alert Sent to <b>${name}</b> Emergency Desk! 🚑 Incoming patient - ETA ~${eta} mins. Please keep 1 ICU bed ready.`;
  setTimeout(()=> box.style.display='none', 5000);
}

// ===== ADMIN CONSOLE =====
async function unlockAdmin(){
  if(document.getElementById('pin').value !== "1234"){
    alert("Wrong PIN. Demo PIN is 1234");
    return;
  }
  // Fetch fresh full list for admin (no distance limit)
  const res = await fetch(`/api/hospitals?lat=${userLat}&lon=${userLon}&maxDist=100`);
  let all = await res.json();
  // Sort by ID for admin view
  all.sort((a,b)=>a.id-b.id);

  document.getElementById('adminList').innerHTML = all.map(h=>`
    <div class="admin-row">
      <span><b>${h.name}</b> - ${h.area} <span class="badge ${getStatus(h).c}" style="font-size:10px">${getStatus(h).t}</span></span>
      <span>
        Gen <button onclick="updateBed(${h.id},'general',-1)">-</button> ${h.general} <button onclick="updateBed(${h.id},'general',1)">+</button> &nbsp;
        ICU <button onclick="updateBed(${h.id},'icu',-1)">-</button> ${h.icu} <button onclick="updateBed(${h.id},'icu',1)">+</button> &nbsp;
        Vent <button onclick="updateBed(${h.id},'vent',-1)">-</button> ${h.vent} <button onclick="updateBed(${h.id},'vent',1)">+</button> &nbsp;
        Oxy <button onclick="updateBed(${h.id},'oxy',-1)">-</button> ${h.oxy} <button onclick="updateBed(${h.id},'oxy',1)">+</button>
      </span>
    </div>`).join('');
}

async function updateBed(id, field, delta){
  const pin = document.getElementById('pin').value;
  const res = await fetch(`/api/hospitals/${id}/update`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({field, delta, pin})
  });
  const data = await res.json();
  if(!res.ok){ alert(data.error || "Update failed"); return; }
  await unlockAdmin();
  await render();
  alert(`${data.hospital.name} - ${field.toUpperCase()} updated to ${data.hospital[field]}. Live synced! Status: ${getStatus(data.hospital).t}`);
}

// ===== INIT =====
renderPills();
render();