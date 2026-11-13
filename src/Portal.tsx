import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowUpRight, Box, FolderOpen, Grid2X2, Plus } from "lucide-react";
import { api, configureCloud, openCloud, saveCloud, useCloud, type Account, type ProjectSummary } from "./storage/cloud";
import { createProject, demoProject, uid } from "./core/model";
import { importProject, listProjects } from "./storage/projects";
import { useEditor } from "./state/store";
import "./styles.css";
import "./portal.css";

const Workspace=lazy(()=>import("./App"));
const signIn=(path:string)=>"/signin-with-chatgpt?return_to="+encodeURIComponent(path);
const route=location.pathname;
const params=new URLSearchParams(location.search);
const demo=route==="/workspace" && params.has("demo");

export default function Portal() {
  const [user,setUser]=useState<Account|null|undefined>(undefined);
  const [projects,setProjects]=useState<ProjectSummary[]>([]);
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const pending=useCloud(s=>s.pending);
  const saveStatus=useCloud(s=>s.status);
  useEffect(()=>{
    if (demo) {
      useEditor.getState().replace(demoProject(),false);
      setReady(true);
      return;
    }
    let cancelled=false;
    void api<Account>("account").then(async account=>{
      if(cancelled)return;
      configureCloud(account);
      setUser(account);
      setName(account.name);
      if(route==="/dashboard") setProjects(await api<ProjectSummary[]>("projects"));
      if(route==="/workspace") {
        const id=params.get("project");
        const project=id ? await openCloud(id) : createProject();
        if(cancelled)return;
        useEditor.getState().replace(project,false);
        setReady(true);
      }
    }).catch(e=>{if(!cancelled){setUser(null);if(e.status!==401)setError(e.message);}});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    if (!pending && (!saveStatus || saveStatus==="Saved to account")) return;
    const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",prevent);
    return ()=>window.removeEventListener("beforeunload",prevent);
  },[pending,saveStatus]);
  if(route==="/workspace"&&ready) return <Suspense fallback={<p className="portal-loading">Opening the drawing workspace…</p>}><Workspace startNew={!demo&&!params.has("project")}/></Suspense>;

  const action=async (task:()=>Promise<void>)=>{
    setBusy(true);setError("");setMessage("");
    try{await task();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <div className="portal">
    <header className="portal-header">
      <a className="portal-logo" href="/"><img src="/mark.svg" alt=""/>studline<span>.</span></a>
      <nav aria-label="Account navigation">{user?<><a href="/dashboard">Projects</a><a href="/settings">Settings</a><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></>:<><a href={signIn("/dashboard")} target="_top">Sign in</a><a className="portal-button" href="/signup">Create account</a></>}</nav>
    </header>
    {route==="/" ? <main>
      <section className="portal-hero">
        <div><p className="portal-kicker">RESIDENTIAL DESIGN STUDIO</p><h1>Draw the plan.<br/>See the space.</h1><p>Draft residential floor plans with precise dimensions, then check the same model in 3D. Keep your projects in your account and pick up where you left off.</p>
        <div className="portal-actions"><a className="portal-button" href={user?"/dashboard":"/signup"}>{user?"Open dashboard":"Create an account"} <ArrowUpRight size={18}/></a><a className="portal-outline" href="/workspace?demo=1">Try the workspace</a></div></div>
        <div className="portal-blueprint" aria-label="Illustrative floor plan" role="img"><div className="blueprint-plan"><span>24′–0″</span><div className="blueprint-room">LIVING</div><div className="blueprint-room">KITCHEN</div><div className="blueprint-room">ENTRY</div></div></div>
      </section>
      <div className="portal-features"><article><Grid2X2/> <h2>Precise drafting</h2><p>Enter exact wall lengths and angles, place openings, and edit dimensions.</p></article><article><Box/> <h2>Plan and 3D</h2><p>Switch views or work side by side using the same geometry.</p></article><article><FolderOpen/> <h2>Your project library</h2><p>Sign in to reopen saved projects from another browser or device.</p></article></div>
    </main> : <main className="portal-page">
      {error&&<p role="alert" className="portal-alert">{error}</p>}
      {message&&<p role="status">{message}</p>}
      {user===undefined ? <p>Checking your session…</p> : !user ? <section className="portal-card">
        <h1>{route==="/signup"?"Create your Studline account":"Sign in to Studline"}</h1>
        <p>Continue with ChatGPT to verify your identity. Your Studline profile and project library are linked to that account.</p>
        <a className="portal-button" href={signIn(route==="/signup"?"/signup":location.pathname+location.search)} target="_top">Continue with ChatGPT <ArrowUpRight size={17}/></a>
      </section> : route==="/signup" || route==="/settings" ? <section className="portal-card">
        <h1>{route==="/signup"?"Set up your Studline profile":"Account settings"}</h1>
        <p>Signed in as {user.email}</p>
        <form onSubmit={e=>{e.preventDefault();void action(async()=>{
          const profile=await api<Account>("account",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
          setName(profile.name);setUser(profile);
          if(route==="/signup") location.assign("/dashboard");
          else setMessage("Profile saved.");
        });}}>
          <label>Display name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
          <button className="portal-button" disabled={busy}>{route==="/signup"?"Create profile":"Save changes"}</button>
        </form>
      </section> : route==="/dashboard" ? <>
        <div className="portal-dashboard-heading"><div><p className="portal-kicker">{user.name || user.email}</p><h1>Your projects</h1></div><a className="portal-button" href="/workspace"><Plus size={18}/> New project</a></div>
        <div className="portal-projects">{projects.map(p=><a key={p.id} className="portal-card" href={"/workspace?project="+encodeURIComponent(p.id)}><FolderOpen size={20}/><strong>{p.name}</strong><small>Updated {new Date(p.updated).toLocaleDateString()}</small><ArrowUpRight size={16}/></a>)}</div>
        {!projects.length&&<p>Create a project or bring in a previous browser save.</p>}
        <details className="portal-card"><summary>Import projects</summary><p>Import a Studline JSON file, or copy a save from this browser. Projects saved on the old hostname can be exported there and imported here.</p>
          <label>Studline JSON file <input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void action(async()=>{if(file.size>1_800_000)throw new Error("Choose a file under 1.8 MB.");await saveCloud(importProject(await file.text()));setProjects(await api<ProjectSummary[]>("projects"));setMessage("Project imported.");});}}/></label>
          {safeLocalProjects().map(project=><button key={project.id} className="portal-outline" disabled={busy} onClick={()=>void action(async()=>{await saveCloud({...project,id:uid()});setProjects(await api<ProjectSummary[]>("projects"));setMessage("Browser save copied to your account.");})}>Copy {project.name}</button>)}
        </details>
      </> : <p>Opening your project…</p>}
    </main>}
  </div>;
}
function safeLocalProjects() {
  try{return listProjects();}catch{return [];}
}
