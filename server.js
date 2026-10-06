import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 3000;
const root = path.dirname(fileURLToPath(import.meta.url));
const owners = ["alice", "david", "emma", "frank", "grace", "henry", "irene", "jack", "karen", "leo"];
const sections = ["A", "B", "C", "D", "E"];
const tickets = new Map(Array.from({length:50}, (_, index) => {
  const number = index + 1;
  const ticketId = `SISTIC-${String(1000 + number).padStart(4, "0")}`;
  const owner = owners[index % owners.length];
  const section = sections[index % sections.length];
  const row = String(Math.floor(index / 5) + 1);
  const seat = String((index % 10) + 1);
  const originalPrice = 80 + (index % 5) * 5;
  return [ticketId, {
    ticketId, provider:"SISTIC (mock official provider)", eventName:"NUS Music Festival",
    section, row, seat, originalPrice, resalePrice:null, owner, status:"Owned",
    valid:true, transferable:true,
    history:[
      {type:"Issued", owner:"official-provider", status:"Issued"},
      {type:"PrimaryPurchase", owner, status:"Owned"}
    ]
  }];
}));

function json(res, code, data) { res.writeHead(code, {"Content-Type":"application/json"}); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve,reject)=>{ let s=""; req.on("data",c=>s+=c); req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}}); req.on("error",reject); }); }
function history(t,type,extra={}) { t.history.push({type,owner:t.owner,status:t.status,...extra,time:new Date().toISOString()}); }
function verify(id,seller) {
  const t=tickets.get(id);
  if(!t) return {ok:false,message:"Ticket not found in mock official provider."};
  if(!t.valid) return {ok:false,message:"Official provider says the ticket is invalid."};
  if(t.owner!==seller) return {ok:false,message:"Seller is not the current official owner."};
  if(!t.transferable) return {ok:false,message:"Official provider says the ticket is not transferable."};
  if(["Listed","PaymentConfirmed","TransferPending"].includes(t.status)) return {ok:false,message:"Ticket already has an active resale."};
  return {ok:true,message:"Ticket verified by mock official provider.",ticket:t};
}

const server=http.createServer(async (req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host}`);
  try {
    if(req.method==="GET" && url.pathname==="/api/tickets") {
      const event=(url.searchParams.get("event")||"").toLowerCase();
      // Marketplace buyers should be able to discover listed tickets without
      // knowing the ticket ID or current owner beforehand.
      return json(res,200,[...tickets.values()].filter(t=>t.valid && ["Owned","Listed","TransferCompleted"].includes(t.status) && (!event||t.eventName.toLowerCase().includes(event))));
    }
    if(req.method==="GET" && url.pathname.startsWith("/api/tickets/")) {
      const t=tickets.get(url.pathname.split("/").pop());
      return t?json(res,200,t):json(res,404,{message:"Ticket not found"});
    }
    if(req.method==="POST") {
      const data=await body(req);
      if(url.pathname==="/api/verify") { const r=verify(data.ticketId,data.seller); return json(res,r.ok?200:400,r); }
      if(url.pathname==="/api/list") {
        const r=verify(data.ticketId,data.seller); if(!r.ok)return json(res,400,r);
        const t=r.ticket, max=t.originalPrice*1.2;
        if(!Number.isFinite(data.resalePrice)||data.resalePrice<=0)return json(res,400,{message:"Resale price must be positive."});
        if(data.resalePrice>max)return json(res,400,{message:`Resale price cannot exceed S$${max.toFixed(2)}.`});
        t.resalePrice=data.resalePrice;t.status="Listed";history(t,"Listed",{resalePrice:data.resalePrice,maximumPrice:max});
        return json(res,200,{message:"Ticket listed successfully.",ticket:t});
      }
      if(url.pathname==="/api/buy") {
        const t=tickets.get(data.ticketId); if(!t)return json(res,404,{message:"Ticket not found"}); if(t.status!=="Listed")return json(res,400,{message:"Ticket is not listed."});
        const seller=t.owner;t.status="PaymentConfirmed";history(t,"PaymentConfirmed",{buyer:data.buyer,seller,paymentMethod:data.paymentMethod||"Mock payment"});t.status="TransferPending";history(t,"TransferPending",{buyer:data.buyer,seller});t.owner=data.buyer;t.status="TransferCompleted";history(t,"TransferCompleted",{previousOwner:seller,newOwner:data.buyer});
        return json(res,200,{message:"Payment confirmed and mock official transfer completed.",blockchainEvent:"TransferCompleted",ticket:t});
      }
      if(url.pathname==="/api/agent") {
        const q=(data.message||"").toLowerCase(); let reply="I can help you verify a ticket, list a ticket, check the 1.2x price limit, or explain transfer status.";
        if(q.includes("sell")||q.includes("resell"))reply="Enter the official ticket ID and seller account. I will verify ownership and check the 1.2x price limit.";
        else if(q.includes("verify")||q.includes("real"))reply="Verification must come from the official provider. This prototype uses a mock provider; screenshots alone are not accepted.";
        else if(q.includes("price"))reply="Maximum resale price = original price × 1.2. S$100 allows a maximum of S$120.";
        return json(res,200,{reply});
      }
    }
    if(req.method==="GET") {
      const file=path.join(root,"public",url.pathname==="/"?"index.html":url.pathname);
      if(!file.startsWith(path.join(root,"public")))return json(res,403,{message:"Forbidden"});
      return fs.readFile(file,(e,d)=>e?json(res,404,{message:"Not found"}):(res.writeHead(200,{"Content-Type":"text/html"}),res.end(d)));
    }
    return json(res,404,{message:"Route not found"});
  } catch(e) { return json(res,400,{message:"Invalid request",detail:e.message}); }
});

server.listen(PORT,()=>console.log(`TicketGuard prototype running at http://localhost:${PORT}`));
