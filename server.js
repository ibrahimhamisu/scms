// SCMS server - no external packages needed (Node 18+)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'db.json'),PUB=path.join(__dirname,'public');
const S=['Submitted','Under Review','In Progress','Resolved','Closed'],CATS=['Academic','Hostel','Fees','Examination','Registration','Others'];
fs.mkdirSync(DIR,{recursive:true});
const SECRET=process.env.SECRET||(()=>{const f=path.join(DIR,'secret.key');try{return fs.readFileSync(f,'utf8')}catch(e){const s=crypto.randomBytes(32).toString('hex');fs.writeFileSync(f,s);return s}})();
const hash=(p,salt=crypto.randomBytes(16).toString('hex'))=>salt+':'+crypto.scryptSync(p,salt,32).toString('hex');
const check=(p,h)=>{const[s,x]=h.split(':');return crypto.timingSafeEqual(Buffer.from(hash(p,s).split(':')[1],'hex'),Buffer.from(x,'hex'))};
const sign=d=>{const p=Buffer.from(JSON.stringify(d)).toString('base64url');return p+'.'+crypto.createHmac('sha256',SECRET).update(p).digest('base64url')};
const verify=t=>{try{const[p,s]=t.split('.');const e=crypto.createHmac('sha256',SECRET).update(p).digest('base64url');if(s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;const d=JSON.parse(Buffer.from(p,'base64url'));return d.exp>Date.now()?d:null}catch(e){return null}};
const now=()=>new Date().toISOString().slice(0,16).replace('T',' ');
const str=(v,n)=>String(v==null?'':v).trim().slice(0,n);
let db;
function save(){const t=FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(db));fs.renameSync(t,FILE)}
function seed(){const t='2026-09-05 10:24',ap=process.env.ADMIN_PASSWORD;if(!ap)console.log('WARNING: using default admin password. Set ADMIN_PASSWORD or change it in Settings.');
db={seq:2,depts:['Academic Affairs','Hostel Unit','Bursary','Examinations','Registry'],
users:[{id:1,role:'student',name:'Ibrahim Hamisu',reg:'NID/CSE/25/0102',email:'ibrahim@example.com',dept:'Computer Science',pw:hash('1234')},{id:2,role:'admin',name:'Admin',reg:'admin',email:'admin@scms.edu',pw:hash(ap||'admin123')},{id:3,role:'dept',name:'Academic Affairs Staff',reg:'dept',email:'dept@scms.edu',dept:'Academic Affairs',pw:hash('dept123')}],
complaints:[{id:'CMP-2026-0001',uid:1,title:'Missing examination result',cat:'Examination',desc:'My result is not on the portal.',dept:'Examinations',status:'Resolved',date:'2026-09-05',hist:[{s:'Submitted',t},{s:'Under Review',t:'2026-09-06 09:15'},{s:'In Progress',t:'2026-09-08 02:30'},{s:'Resolved',t:'2026-09-10 11:20'}]},{id:'CMP-2026-0002',uid:1,title:'Hostel water problem',cat:'Hostel',desc:'No water for 3 days.',dept:'Hostel Unit',status:'Submitted',date:'2026-09-10',hist:[{s:'Submitted',t:'2026-09-10 08:00'}]}],
notes:[{uid:1,m:'Welcome to the Student Complaint Management System!',t}]};save()}
try{db=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){seed()}
const pub=u=>{const{pw,...r}=u;return r};
function view(u){const cs=u.role==='admin'?db.complaints:u.role==='dept'?db.complaints.filter(c=>c.dept===u.dept):db.complaints.filter(c=>c.uid===u.id);
const us=u.role==='admin'?db.users:db.users.filter(x=>x.id===u.id||cs.some(c=>c.uid===x.id));
return{depts:db.depts,users:us.map(x=>u.role==='admin'||x.id===u.id?pub(x):{id:x.id,name:x.name,role:x.role}),complaints:cs,notes:db.notes.filter(n=>n.uid===u.id)}}
const fail=(c,m)=>{const e=new Error(m);e.code=c;return e};
const tries={};
function body(req){return new Promise((ok,no)=>{let b='',n=0;req.on('data',c=>{n+=c.length;if(n>1.5e6){no(fail(413,'Too large'));req.destroy()}else b+=c});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(fail(400,'Bad request'))}})})}
async function api(req,res,p){const m=req.method,b=m==='GET'?{}:await body(req);
const au=()=>{const d=verify((req.headers.authorization||'').slice(7));const x=d&&db.users.find(x=>x.id===d.id);if(!x)throw fail(401,'Please login again.');return x};
const out=o=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const note=(uid,m)=>db.notes.push({uid,m,t:now()});
if(m==='POST'&&p==='/api/register'){const n=str(b.name,80),r=str(b.reg,40),e=str(b.email,100),d=str(b.dept,80),pw=String(b.pw||'');
if(!n||!r||!e||!d)throw fail(400,'Please fill all fields.');if(pw.length<4)throw fail(400,'Password must be at least 4 characters.');
if(db.users.some(u=>u.reg.toLowerCase()===r.toLowerCase()))throw fail(409,'Registration number already exists.');
const u={id:Date.now(),role:'student',name:n,reg:r,email:e,dept:d,pw:hash(pw)};db.users.push(u);note(u.id,'Welcome to the Student Complaint Management System!');save();return out({ok:1})}
if(m==='POST'&&p==='/api/login'){const ip=req.socket.remoteAddress,t=tries[ip]||{n:0,t:Date.now()};if(Date.now()-t.t>9e5){t.n=0;t.t=Date.now()}if(t.n>=10)throw fail(429,'Too many attempts. Try again later.');
const k=str(b.k,100).toLowerCase(),u=db.users.find(u=>u.reg.toLowerCase()===k||u.email.toLowerCase()===k);
if(!u||!check(String(b.pw||''),u.pw)){t.n++;tries[ip]=t;throw fail(401,'Incorrect details. Try again.')}delete tries[ip];
return out({token:sign({id:u.id,exp:Date.now()+6048e5}),user:pub(u)})}
if(m==='POST'&&p==='/api/forgot'){const k=str(b.k,100).toLowerCase(),e=str(b.email,100).toLowerCase(),pw=String(b.pw||'');
const u=db.users.find(u=>u.role==='student'&&(u.reg.toLowerCase()===k||u.email.toLowerCase()===k)&&u.email.toLowerCase()===e);
if(!u||pw.length<4)throw fail(400,'Account not found, details do not match, or password too short.');u.pw=hash(pw);save();return out({ok:1})}
const u=au();
if(m==='GET'&&p==='/api/me')return out(pub(u));
if(m==='GET'&&p==='/api/data')return out(view(u));
if(m==='POST'&&p==='/api/me/name'){const n=str(b.name,80);if(!n)throw fail(400,'Name cannot be empty.');u.name=n;save();return out({ok:1})}
if(m==='POST'&&p==='/api/me/photo'){const ph=String(b.photo||'');if(ph&&(!ph.startsWith('data:image/')||ph.length>2e5))throw fail(400,'Invalid photo.');u.photo=ph;save();return out({ok:1})}
if(m==='POST'&&p==='/api/me/password'){if(!check(String(b.cur||''),u.pw))throw fail(400,'Current password is wrong.');const n=String(b.pw||'');if(n.length<4)throw fail(400,'New password must be at least 4 characters.');u.pw=hash(n);save();return out({ok:1})}
if(m==='POST'&&p==='/api/complaints'){if(u.role!=='student')throw fail(403,'Only students can submit.');const cat=str(b.cat,30),t=str(b.title,120),d=str(b.desc,2000);
if(!CATS.includes(cat)||!t||!d)throw fail(400,'Please fill title and description.');const id='CMP-'+new Date().getFullYear()+'-'+String(++db.seq).padStart(4,'0');
db.complaints.push({id,uid:u.id,title:t,cat,desc:d,dept:db.depts[0]||'Unassigned',status:'Submitted',date:now().slice(0,10),hist:[{s:'Submitted',t:now()}]});note(u.id,`Your complaint ${id} was submitted.`);save();return out({id})}
let r=p.match(/^\/api\/complaints\/([\w-]+)$/);
if(m==='POST'&&r){const c=db.complaints.find(c=>c.id===r[1]);if(!c||u.role==='student'||(u.role==='dept'&&c.dept!==u.dept))throw fail(403,'Not allowed.');
const s=str(b.status,30),n=str(b.note,300);if(!S.includes(s))throw fail(400,'Invalid status.');if(u.role==='admin'&&b.dept&&db.depts.includes(b.dept))c.dept=b.dept;
if(s!==c.status||n){c.status=s;c.hist.push({s,t:now(),n});note(c.uid,`Your complaint ${c.id} is now: ${s}.${n?' Note: '+n:''}`)}save();return out({ok:1})}
if(u.role!=='admin'&&p.startsWith('/api/'))throw fail(403,'Not allowed.');
if(m==='POST'&&p==='/api/depts'){const n=str(b.name,80);if(n&&!db.depts.includes(n)){db.depts.push(n);save()}return out({ok:1})}
if(m==='POST'&&p==='/api/depts/rename'){const f=str(b.from,80),t=str(b.to,80),i=db.depts.indexOf(f);if(i<0||!t)throw fail(400,'Invalid.');db.depts[i]=t;db.complaints.forEach(c=>{if(c.dept===f)c.dept=t});db.users.forEach(x=>{if(x.role==='dept'&&x.dept===f)x.dept=t});save();return out({ok:1})}
if(m==='POST'&&p==='/api/depts/delete'){db.depts=db.depts.filter(d=>d!==str(b.name,80));save();return out({ok:1})}
if(m==='POST'&&p==='/api/users/delete'){const x=db.users.find(x=>x.id===b.id);if(!x||x.role!=='student')throw fail(400,'Invalid.');db.users=db.users.filter(y=>y!==x);save();return out({ok:1})}
throw fail(404,'Not found')}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json'};
http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
const p=decodeURIComponent(req.url.split('?')[0]);
try{if(p.startsWith('/api/'))return await api(req,res,p);
let f=path.join(PUB,p==='/'?'index.html':p);if(!f.startsWith(PUB))throw fail(403,'Forbidden');
fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(d)})}
catch(e){res.writeHead(e.code||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code?e.message:'Server error'}));if(!e.code)console.error(e)}
}).listen(PORT,()=>console.log('SCMS running on http://localhost:'+PORT));
