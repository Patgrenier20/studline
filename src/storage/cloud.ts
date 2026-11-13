import { create } from "zustand";
import type { Project } from "../core/model";

export type Account = {id:string;email:string;name:string};
export type ProjectSummary = {id:string;name:string;updated:string;revision:number};
export async function api<T>(path:string, options?:RequestInit):Promise<T> {
  const response = await fetch("/api/" + path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || "Could not reach Studline account storage."), {status:response.status});
  }
  return response.json();
}

export const useCloud = create<{status:string; pending:number}>(()=>({status:"",pending:0}));
let account:Account | null = null;
const revisions = new Map<string,number>();
const saves = new Map<string,Promise<void>>();
export function configureCloud(user:Account) { account=user; }
export function cloudEnabled() {return account !== null;}
export async function openCloud(id:string) {
  const data=await api<{project:Project;revision:number}>("projects/"+encodeURIComponent(id));
  revisions.set(id,data.revision);
  return data.project;
}
export function saveCloud(project:Project):Promise<void> {
  if (!account) return Promise.resolve();
  const id=project.id;
  const body=JSON.stringify(project);
  useCloud.setState(s=>({status:"Saving to account…",pending:s.pending+1}));
  const previous=saves.get(id) || Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    const result=await api<{revision:number}>("projects/"+encodeURIComponent(id),{
      method:"PUT",body,headers:{"Content-Type":"application/json","X-Project-Revision":String(revisions.get(id)||0)}
    });
    revisions.set(id,result.revision);
  });
  saves.set(id,next);
  void next.then(
    ()=>useCloud.setState(s=>({pending:s.pending-1,status:s.pending>1?s.status:"Saved to account"})),
    error=>useCloud.setState(s=>({pending:s.pending-1,status:error.message}))
  ).finally(()=>{if(saves.get(id)===next)saves.delete(id);});
  return next;
}
