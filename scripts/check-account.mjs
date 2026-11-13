import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import worker from "../dist/server/index.js";

const db = new DatabaseSync(":memory:");
db.exec(await readFile(new URL("../drizzle/0000_accounts.sql", import.meta.url), "utf8"));
const DB = {prepare(sql) {
  const statement = db.prepare(sql);
  return {bind(...args) {
    return {
      first: async () => statement.get(...args),
      all: async () => ({results:statement.all(...args)}),
      run: async () => ({meta:statement.run(...args)}),
    };
  }};
}};
function call(path, user, body, rev=0) {
  const headers = user ? {"oai-authenticated-user-id":user,"oai-authenticated-user-email":user+"@example.test"} : {};
  if (body) Object.assign(headers,{"Content-Type":"application/json","X-Project-Revision":String(rev)});
  return worker.fetch(new Request("https://studline.site"+path,{method:body?"PUT":"GET",headers,body:body&&JSON.stringify(body)}),{DB});
}
assert.equal((await call("/")).status,200);
assert.equal((await call("/api/projects")).status,401);
assert.equal((await call("/api/account","a",{name:"Patrick"})).status,200);
assert.equal((await (await call("/api/account","a")).json()).name,"Patrick");
const project = {schemaVersion:2,id:"sample",name:"Test plan",units:"imperial",modifiedAt:new Date().toISOString(),floor:{id:"floor",name:"Main",elevation:0,nodes:[],walls:[],openings:[]}};
assert.equal((await call("/api/projects/sample","a",project)).status,200);
assert.equal((await call("/api/projects/sample","b")).status,404);
assert.deepEqual(await (await call("/api/projects","b")).json(),[]);
assert.equal((await call("/api/projects/sample","b",project,1)).status,409);
assert.equal((await call("/api/projects/sample","a",project,1)).status,200);
assert.equal((await call("/api/projects/sample","a",project,1)).status,409);
assert.equal((await (await call("/api/projects/sample","a")).json()).revision,2);
console.log("Account profile, project persistence, isolation, and stale-write protection passed.");
