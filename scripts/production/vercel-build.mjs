#!/usr/bin/env node
import { spawn } from "node:child_process";
function run(command,args){return new Promise((ok,fail)=>{const child=spawn(command,args,{stdio:"inherit",env:process.env});child.once("error",fail);child.once("exit",(code)=>code===0?ok():fail(new Error(`${command} ${args.join(" ")} encerrou com código ${code}.`)));});}
if(process.env.VERCEL_ENV==="production")await run("npm",["run","check:production-env"]);await run("npm",["run","build"]);
