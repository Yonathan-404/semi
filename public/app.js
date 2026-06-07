// public/app.js — shared client for all pages
const LOGO='https://www.bankofabyssinia.com/wp-content/uploads/2020/09/Asset-1@4x.png';
const API='/api'; // redirected to /.netlify/functions

function $(id){return document.getElementById(id);}
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}
function fmt(n){return Number(n||0).toLocaleString();}
function fmtETB(n){n=Number(n||0);if(n>=1e9)return (n/1e9).toFixed(2)+'B';if(n>=1e6)return (n/1e6).toFixed(1)+'M';if(n>=1e3)return (n/1e3).toFixed(0)+'K';return fmt(n);}
function pct(a,b){return b>0?(a/b*100):0;}
function toast(msg,type){var t=$('toast');if(!t){t=el('div');t.id='toast';document.body.appendChild(t);}t.className=(type==='err'?'err':'ok');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3000);}

// ---- session ----
function saveSession(s){localStorage.setItem('boa_session',JSON.stringify(s));}
function getSession(){try{return JSON.parse(localStorage.getItem('boa_session')||'null');}catch(e){return null;}}
function logout(){localStorage.removeItem('boa_session');location.href='index.html';}
function requireRole(role){var s=getSession();if(!s||(role&&s.role!==role)){location.href='index.html';return null;}return s;}

// ---- api ----
async function api(action,opts){
  opts=opts||{};var s=getSession();
  var headers={'Content-Type':'application/json'};
  if(s&&s.token)headers['Authorization']='Bearer '+s.token;
  var url=API+'/data?action='+action+(opts.qs?('&'+opts.qs):'');
  var res=await fetch(url,{method:opts.method||'GET',headers:headers,body:opts.body?JSON.stringify(opts.body):undefined});
  var data=await res.json();
  if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
  return data;
}
async function login(role,scopeId,password){
  var res=await fetch(API+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:role,scopeId:scopeId,password:password})});
  var data=await res.json();
  if(!res.ok)throw new Error(data.error||'Login failed');
  return data;
}

// ---- shared header ----
function renderHeader(roleLabel,roleIcon){
  var s=getSession();
  return '<header class="hdr"><div class="hdr-l">'
    +'<div class="logo"><img src="'+LOGO+'" alt="BoA" onerror="this.parentNode.innerHTML=\'<span>አ</span>\'"></div>'
    +'<div><div class="bname">Dare to <em>Serve</em></div><div class="bsub">Campaign Command Center</div></div></div>'
    +'<div class="hdr-r"><span class="rolechip"><i class="'+roleIcon+'"></i> '+roleLabel+(s&&s.name?(' · '+s.name):'')+'</span>'
    +'<button class="btn bo bsm" onclick="logout()"><i class="fas fa-right-from-bracket"></i> Logout</button></div></header>';
}
// phase helper
function currentPhase(campaign){
  if(!campaign||!campaign.phases)return null;
  var today=new Date().toISOString().slice(0,10);
  for(var i=0;i<campaign.phases.length;i++){var p=campaign.phases[i];if(today>=p.start&&today<=p.end)return p;}
  return null;
}
function daysLeft(campaign){
  if(!campaign)return '—';
  var end=new Date(campaign.endDate),now=new Date();
  var d=Math.ceil((end-now)/86400000);return d>0?d:0;
}
function scoreBadge(s){if(s>=90)return '<span class="bdg bx">Excellent</span>';if(s>=60)return '<span class="bdg bf">On Track</span>';if(s>=30)return '<span class="bdg bf">Building</span>';return '<span class="bdg bl">Needs Push</span>';}
function rankCls(i){return i===0?'r1':i===1?'r2':i===2?'r3':'rn';}
