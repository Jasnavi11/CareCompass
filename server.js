const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let hospitals = JSON.parse(fs.readFileSync('./data/hospitals.json','utf-8'));

function saveData(){
  fs.writeFileSync('./data/hospitals.json', JSON.stringify(hospitals,null,2));
}

// Haversine Formula
function haversine(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// GET All Hospitals + Distance + ETA
app.get('/api/hospitals', (req,res)=>{
  const {lat=17.441, lon=78.498, search="", filter="", maxDist=100} = req.query;
  let list = hospitals.map(h=>{
    let dist = haversine(parseFloat(lat),parseFloat(lon),h.lat,h.lon);
    let eta = Math.round((dist/28)*60*(1+Math.random()*0.5));
    let status = (h.icu===0 && h.vent===0) ? "ER Full - Divert" : (h.icu<=2 ? "Busy" : "Beds Available");
    return {...h, dist: parseFloat(dist.toFixed(1)), eta, status};
  }).filter(h=>h.dist <= maxDist)
    .filter(h=>(h.name+" "+h.area).toLowerCase().includes(search.toLowerCase()))
    .filter(h=>{
      if(!filter) return true;
      if(filter==="ICU") return h.icu>0;
      if(filter==="Ventilator") return h.vent>0;
      if(filter==="Oxygen") return h.oxy>0;
      return h.specs.includes(filter);
    })
    .sort((a,b)=>a.dist-b.dist);
  res.json(list);
});

// POST Update Bed Count - Admin
app.post('/api/hospitals/:id/update', (req,res)=>{
  const {field, delta, pin} = req.body;
  if(pin!=="1234") return res.status(401).json({error:"Wrong PIN"});
  let h = hospitals.find(x=>x.id==req.params.id);
  if(!h) return res.status(404).json({error:"Not found"});
  h[field] = Math.max(0, h[field]+delta);
  h.updated = 0;
  saveData();
  res.json({success:true, hospital:h});
});

// POST Pre-Arrival Alert
app.post('/api/alert', (req,res)=>{
  const {hospital, eta} = req.body;
  console.log(`🚑 ALERT: Incoming patient to ${hospital}, ETA ${eta} mins`);
  res.json({success:true, message:`Pre-Arrival Alert sent to ${hospital}`});
});

app.listen(PORT, ()=> console.log(`✅ CareCompass running at http://localhost:${PORT}`));