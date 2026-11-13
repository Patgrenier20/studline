import { deserialize } from "../src/storage/projects";

declare const STUDLINE_ASSETS: Record<string,string>;
interface Database {
  prepare(sql:string): {bind(...values:(string|number)[]): {
    first():Promise<Record<string,string|number>|null>;
    all():Promise<{results:unknown[]}>;
    run():Promise<{meta:{changes:number}}>;
  }};
}
const json = (data: unknown, status = 200) => Response.json(data, {status, headers:{"Cache-Control":"no-store"}});
const types: Record<string,string> = {html:"text/html",js:"text/javascript",css:"text/css",svg:"image/svg+xml"};
export default {
  async fetch(request: Request, {DB}: {DB: Database}) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) {
      if (!["GET","HEAD"].includes(request.method)) return new Response(null,{status:405});
      const key = ["/","/signup","/dashboard","/settings","/workspace"].includes(path) ? "/index.html" : path;
      if (!Object.hasOwn(STUDLINE_ASSETS,key)) return new Response("Not found",{status:404});
      return new Response(request.method === "HEAD" ? null : STUDLINE_ASSETS[key],{headers:{
        "Content-Type":types[key.split(".").at(-1) || ""] || "application/octet-stream",
        "Cache-Control":key.startsWith("/assets/") ? "public,max-age=31536000,immutable" : "no-cache",
        "X-Content-Type-Options":"nosniff"
      }});
    }
    const owner = request.headers.get("oai-authenticated-user-id");
    const email = request.headers.get("oai-authenticated-user-email");
    if (!owner || !email) return json({error:"Sign in to access your account."},401);
    const write = request.method === "PUT";
    if (write && (!request.headers.get("content-type")?.startsWith("application/json") ||
      (request.headers.has("origin") && request.headers.get("origin") !== url.origin))) {
      return json({error:"Invalid request origin or format."},403);
    }
    try {
      if (path === "/api/account") {
        if (request.method === "GET") {
          const profile = await DB.prepare("SELECT display_name FROM profiles WHERE user_id=?").bind(owner).first();
          return json({email,name:profile?.display_name ?? "",id:owner});
        }
        if (write) {
          const raw = await readBody(request,2048);
          const name = JSON.parse(raw)?.name;
          if (typeof name !== "string" || !name.trim() || name.trim().length > 80) return json({error:"Enter a display name of up to 80 characters."},400);
          await DB.prepare("INSERT INTO profiles VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name").bind(owner,name.trim()).run();
          return json({email,name:name.trim(),id:owner});
        }
      }
      if (path === "/api/projects" && request.method === "GET") {
        const result = await DB.prepare("SELECT id,name,updated,revision FROM projects WHERE owner_id=? ORDER BY updated DESC").bind(owner).all();
        return json(result.results);
      }
      const id = /^\/api\/projects\/([a-zA-Z0-9_-]{1,120})$/.exec(path)?.[1];
      if (id && request.method === "GET") {
        const row = await DB.prepare("SELECT document,revision FROM projects WHERE owner_id=? AND id=?").bind(owner,id).first();
        return row ? json({project:JSON.parse(String(row.document)),revision:row.revision}) : json({error:"Project not found."},404);
      }
      if (id && write) {
        const version = request.headers.get("x-project-revision");
        if (version === null || !/^\d{1,12}$/.test(version)) return json({error:"Project revision required."},400);
        const revision = Number(version);
        const raw = await readBody(request,1_800_000);
        let project;
        try {project=deserialize(raw);} catch {return json({error:"Invalid project file."},400);}
        if (project.id !== id) return json({error:"Project ID mismatch."},400);
        const updated = new Date().toISOString();
        const result = revision === 0
          ? await DB.prepare("INSERT OR IGNORE INTO projects VALUES (?,?,?,?,1,?)").bind(owner,id,project.name,updated,raw).run()
          : await DB.prepare("UPDATE projects SET name=?,updated=?,document=?,revision=revision+1 WHERE owner_id=? AND id=? AND revision=?").bind(project.name,updated,raw,owner,id,revision).run();
        return result.meta.changes ? json({revision:revision+1}) : json({error:"This project changed in another session. Export your work before reopening the cloud version."},409);
      }
      return json({error:"Not found."},404);
    } catch (error) {
      if (error instanceof RangeError) return json({error:"Request is too large."},413);
      if (error instanceof SyntaxError) return json({error:"Invalid JSON."},400);
      return json({error:"Account storage is temporarily unavailable."},503);
    }
  }
};

async function readBody(request: Request, limit: number) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let raw = "", bytes = 0;
  while (true) {
    const {value,done} = await reader.read();
    if (done) return raw + decoder.decode();
    bytes += value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new RangeError(); }
    raw += decoder.decode(value,{stream:true});
  }
}
