import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../../../lib/concurrency";
test("worker pool은 최대 동시성과 결과 순서를 보존한다",async()=>{ let active=0; let maximum=0; const result=await mapWithConcurrency([1,2,3,4,5],2,async(value)=>{active+=1;maximum=Math.max(maximum,active);await new Promise((resolve)=>setTimeout(resolve,5));active-=1;return value*2;});assert.equal(maximum,2);assert.deepEqual(result,[2,4,6,8,10]); });
test("worker 실패 후에도 나머지 작업을 누락하지 않는다",async()=>{ const visited:number[]=[]; await assert.rejects(()=>mapWithConcurrency([1,2,3,4],0,async(value)=>{visited.push(value);if(value===2)throw new Error("expected");return value;}),/expected/);assert.deepEqual(visited,[1,2,3,4]);assert.deepEqual(await mapWithConcurrency([],3,async(value)=>value),[]); });
