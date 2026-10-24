/* global fetch, AbortSignal */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { testAccounts } from "./lib/test-accounts.mjs";

// One ordinary explanation task, then a cache read. No interpreter call or new qualification.
const accounts = testAccounts(); let stage = "temporary identity";
try {
  const member = await accounts.member(), headers = { Origin: accounts.origin, Cookie: member.cookies.map((c)=>`${c.name}=${c.value}`).join("; "), "Content-Type":"application/json" };
  async function post(path, body, extra={}) {
    const response=await fetch(`${accounts.origin}/api/v1${path}`,{method:"POST",headers:{...headers,...extra},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)}), value=await response.json();
    if(!response.ok)throw new Error(`HTTP_${response.status}_${value.error?.code??"UNKNOWN"}`);return value.data;
  }
  const first=Math.ceil((Date.now()+7200000)/1800000)*1800000, iso=(time)=>new Date(time).toISOString().replace(".000Z","Z");
  stage="real grid comparison";
  const comparison=await post("/comparisons",{geography:"GB_NATIONAL",timezone:"Europe/London",earliestStartUtc:iso(first),deadlineUtc:iso(first+14400000),durationMinutes:60,energyWh:875,energyBasis:"user_estimate",blockedIntervals:[],baseline:{kind:"earliest_feasible"},constraintsConfirmed:true});
  stage="ordinary explanation route";
  const result=await post(`/comparisons/${comparison.id}/explanation`,{aiConsent:true},{"AI-Task-Key":randomUUID()});
  if(result.source!=="ai"||!result.selection.limitationCodes.includes("ASSUMED_ENERGY")||!result.selection.limitationCodes.includes("NATIONAL_SIGNAL"))throw new Error("INVALID_GROUNDING");
  stage="cache recovery";
  const cached=await post(`/comparisons/${comparison.id}/explanation`,{aiConsent:true},{"AI-Task-Key":randomUUID()});if(cached.source!=="cache")throw new Error("CACHE_MISMATCH");
  await mkdir("research/phase-9",{recursive:true});
  await writeFile("research/phase-9/live-explanation-route.json",JSON.stringify({checkedAtUtc:new Date().toISOString(),passed:true,source:result.source,comparisonId:comparison.id,cacheSource:cached.source,checks:["real Auth/ownership","real national forecast","ordinary admitted explanation endpoint","grounded limitations","cache without another AI task"],maximumProviderAttempts:2,physicalExecutionVerified:false},null,2)+"\n");
  console.log("Ordinary live AI explanation route and owner cache passed against a real grid comparison.");
}catch(error){console.error(`Explanation integration failed at ${stage}${error instanceof Error&&/^HTTP_\d+_[A-Z_]+$/.test(error.message)?`: ${error.message}`:""}. Provider content/credentials omitted.`);process.exitCode=1;}
finally{try{await accounts.cleanup();}catch{console.error("Fixture cleanup requires review.");process.exitCode=1;}}
