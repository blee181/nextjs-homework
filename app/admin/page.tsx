import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "./admin.css";

const sections = [
  ["Overview","overview"],["Users","profiles"],["Memes / Images","meme_images"],["Captions","captions"],["Votes","votes"],
  ["Prompt chains","prompt_chains"],["Chain steps","prompt_chain_steps"],["Chain mix","prompt_chain_mix"],
  ["Terms","terms"],["Generation examples","ai_generation_examples"],["Generation requests","generation_requests"],
  ["LLM responses","llm_responses"],["LLM models","llm_models"],["LLM providers","llm_providers"],
  ["Signup domains","allowed_signup_domains"],["Whitelisted emails","whitelisted_emails"]
] as const;
const editable = new Set(["meme_images","terms","ai_generation_examples","llm_models","llm_providers","allowed_signup_domains","whitelisted_emails","prompt_chain_mix"]);
const names = new Set<string>(sections.map(s=>s[1]));
type Row = Record<string, unknown>;
function dateOf(v:unknown){const d=new Date(String(v??""));return Number.isNaN(d.getTime())?"":d.toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function clean(v:unknown){return v===null||v===undefined?"—":typeof v==="object"?JSON.stringify(v):String(v);}
export default async function Admin({searchParams}:{searchParams:Promise<{tab?:string;error?:string;ok?:string}>}){
 const query=await searchParams;const tab=names.has(query.tab??"")?query.tab!:"overview";
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)redirect("/login");
 const permitted=(process.env.ADMIN_EMAILS??"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!user.email||!permitted.includes(user.email.toLowerCase()))return <main style={{padding:60,fontFamily:"sans-serif"}}><h1>Admin access restricted</h1><p>Set ADMIN_EMAILS to your signed-in email in Vercel environment variables.</p><a href="/">Back to CATCAPTION</a></main>;
 async function mutate(form:FormData){"use server";
  const client=await createClient();const {data:{user:actor}}=await client.auth.getUser();
  const allow=(process.env.ADMIN_EMAILS??"").split(",").map(x=>x.trim().toLowerCase());
  if(!actor?.email||!allow.includes(actor.email.toLowerCase()))throw new Error("Unauthorized");
  const table=String(form.get("table")??"");const op=String(form.get("operation")??"");
  if(!editable.has(table))throw new Error("Table not editable");
  const id=String(form.get("id")??"");
  if(op==="delete"){if(!id)throw new Error("Missing ID");const {error}=await client.from(table).delete().eq("id",id);if(error)redirect("/admin?tab="+table+"&error="+encodeURIComponent(error.message));}
  else {
   let data:Row={};try{data=JSON.parse(String(form.get("payload")??"{}"));}catch{redirect("/admin?tab="+table+"&error=Invalid%20JSON");}
   delete data.id;delete data.created_at;delete data.updated_at;
   const result=op==="create"?await client.from(table).insert(data):await client.from(table).update(data).eq("id",id);
   if(result.error)redirect("/admin?tab="+table+"&error="+encodeURIComponent(result.error.message));
  }
  revalidatePath("/admin");redirect("/admin?tab="+table+"&ok=1");
 }
 const read=async(t:string)=>{const {data,error}=await db.from(t).select("*").limit(200);return {rows:(data??[]) as Row[],error:error?.message??null};};
 const all=tab==="overview"?await Promise.all(["profiles","meme_images","captions","votes"].map(read)):[];
 const selected=tab==="overview"?null:await read(tab);
 const users=all[0]?.rows??[],memes=all[1]?.rows??[],captions=all[2]?.rows??[],votes=all[3]?.rows??[];
 const score=votes.reduce((n,r)=>n+(Number(r.vote)===1?1:0),0);
 const dates=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return d.toISOString().slice(0,10)});
 const daily=dates.map(d=>({date:d,caption:captions.filter(c=>String(c.created_at??"").slice(0,10)===d).length,vote:votes.filter(v=>String(v.created_at??"").slice(0,10)===d).length}));
 const max=Math.max(1,...daily.map(d=>Math.max(d.caption,d.vote)));
 return <div className="adm"><aside className="adm-side"><a className="adm-brand" href="/admin"><span>🐱</span> CatCaption Admin</a><a className={tab==="overview"?"chosen":""} href="/admin">◫ &nbsp; Overview</a><div className="adm-nav">{sections.slice(1).map(([label,key],i)=><div key={key}>{[0,4,9,12,14].includes(i)&&<small>{i===0?"CONTENT":i===4?"PROMPTS":i===9?"AI ACTIVITY":i===12?"MODELS":"ACCESS"}</small>}<a className={tab===key?"chosen":""} href={"/admin?tab="+key}>{label}</a></div>)}</div><div className="adm-sidefoot"><a href="/">← Main CATCAPTION site</a><p>{user.email}</p></div></aside><main className="adm-main"><header><div><p className="adm-kicker">CATCAPTION / ADMINISTRATION</p><h1>{sections.find(s=>s[1]===tab)?.[0]??"Overview"}</h1><p>Live data and content management for your AI caption app.</p></div><span className="adm-pill">● Admin access</span></header>
 {query.error&&<div className="adm-alert">{query.error}</div>}{query.ok&&<div className="adm-success">Changes saved successfully.</div>}
 {tab==="overview"?<><div className="adm-cards">{[["USERS",users.length,"Registered profiles"],["MEMES",memes.length,"Image templates"],["CAPTIONS",captions.length,"Generated captions"],["VOTES",votes.length,"Community votes"],["UPVOTE RATE",votes.length?Math.round(score/votes.length*100)+"%":"0%","Positive votes"]].map(([label,value,sub])=><section className="adm-card" key={label}><small>{label}</small><strong>{value}</strong><p>{sub}</p></section>)}</div><div className="adm-columns"><section className="adm-panel"><h2>Pulse, last 14 days</h2><p>Daily caption creation and community votes</p><div className="adm-chart">{daily.map(d=><div className="adm-day" key={d.date} title={d.date+": "+d.caption+" captions, "+d.vote+" votes"}><div className="adm-bars"><i style={{height:(d.vote/max*100)+"%"}}/><b style={{height:(d.caption/max*100)+"%"}}/></div><small>{d.date.slice(5)}</small></div>)}</div><div className="adm-legend"><span>🟠 Votes</span><span>🔵 Captions</span></div></section><section className="adm-panel"><h2>Fun facts</h2><ul><li><b>Top activity:</b> {daily.slice().sort((a,b)=>(b.caption+b.vote)-(a.caption+a.vote))[0]?.date}</li><li><b>Captions per meme:</b> {memes.length?(captions.length/memes.length).toFixed(1):"0"}</li><li><b>Votes per caption:</b> {captions.length?(votes.length/captions.length).toFixed(1):"0"}</li><li><b>Unvoted captions:</b> {captions.filter(c=>!votes.some(v=>v.caption_id===c.id)).length}</li><li><b>Image templates:</b> {memes.length}</li></ul></section></div><section className="adm-panel"><h2>Recent captions</h2><div className="adm-tablewrap"><table><thead><tr><th>Caption</th><th>Created</th><th>User</th></tr></thead><tbody>{captions.slice(-8).reverse().map((r,i)=><tr key={i}><td>{clean(r.caption_text)}</td><td>{dateOf(r.created_at)}</td><td>{clean(r.user_id).slice(0,12)}</td></tr>)}</tbody></table></div></section></>:<section className="adm-panel"><div className="adm-panelhead"><div><h2>{sections.find(s=>s[1]===tab)?.[0]}</h2><p>{selected?.rows.length??0} records loaded (up to 200)</p></div><span className="adm-pill">{editable.has(tab)?"CRUD enabled":"Read only"}</span></div>{selected?.error?<p className="adm-alert">Table unavailable: {selected.error}. Create this table in Supabase if your app needs it.</p>:<><div className="adm-tablewrap"><table><thead><tr>{Object.keys(selected?.rows[0]??{}).slice(0,8).map(k=><th key={k}>{k}</th>)}{editable.has(tab)&&<th>Actions</th>}</tr></thead><tbody>{selected?.rows.map((r,i)=><tr key={i}>{Object.keys(selected.rows[0]??{}).slice(0,8).map(k=><td key={k}>{k==="image_url"&&typeof r[k]==="string"?<a href={String(r[k])} target="_blank" rel="noreferrer">View image ↗</a>:<span title={clean(r[k])}>{clean(r[k]).slice(0,120)}</span>}</td>)}{editable.has(tab)&&<td><details><summary>Edit</summary><form action={mutate}><input type="hidden" name="table" value={tab}/><input type="hidden" name="operation" value="update"/><input type="hidden" name="id" value={String(r.id??"")}/><textarea name="payload" defaultValue={JSON.stringify(r,null,2)} rows={8}/><button>Save changes</button></form></details><form action={mutate} style={{marginTop:8}}><input type="hidden" name="table" value={tab}/><input type="hidden" name="operation" value="delete"/><input type="hidden" name="id" value={String(r.id??"")}/><button className="adm-danger">Delete</button></form></td>}</tr>)}</tbody></table>{!selected?.rows.length&&<p className="adm-empty">No records found in this table.</p>}</div>{editable.has(tab)&&<details className="adm-create"><summary>＋ Create new record</summary><form action={mutate}><input type="hidden" name="table" value={tab}/><input type="hidden" name="operation" value="create"/><p>Enter field names and values as JSON, matching your Supabase table schema.</p><textarea name="payload" rows={7} defaultValue={'{\n  "name": "Example"\n}'}/><button>Create record</button></form></details>}</>}</section>}
 </main></div>;
}
