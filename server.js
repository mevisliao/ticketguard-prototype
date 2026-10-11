import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOrCreateWallet } from "./walletService.js";

const PORT = process.env.PORT || 3000;
const root = path.dirname(fileURLToPath(import.meta.url));
const BUYER_SERVICE_FEE_RATE = 0.03;
const SELLER_COMMISSION_RATE = 0.03;
const MAX_BUYER_TOTAL_MULTIPLIER = 1.2;
// Mock estimate used by the demo. In a real deployment this comes from an
// on-chain gas estimate before the transaction is submitted.
const ESTIMATED_BLOCKCHAIN_FEE = 0.50;
// Gas is covered by the platform fees in this pricing model. It is tracked
// for platform accounting, but is not added as a second buyer charge.
const MOCK_ACTUAL_BLOCKCHAIN_FEE = 0.62;
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
function money(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
function buyerPriceCap(t) { return money(t.originalPrice * MAX_BUYER_TOTAL_MULTIPLIER); }
function maxResalePrice(t) {
  return money(buyerPriceCap(t) / (1 + BUYER_SERVICE_FEE_RATE));
}
function pricing(t, resalePrice=t.resalePrice ?? t.originalPrice) {
  const price = money(resalePrice);
  const buyerServiceFee = money(price * BUYER_SERVICE_FEE_RATE);
  const buyerTotal = money(price + buyerServiceFee);
  const sellerCommission = money(price * SELLER_COMMISSION_RATE);
  return {
    resalePrice: price,
    originalPrice: money(t.originalPrice),
    buyerServiceFeeRate: BUYER_SERVICE_FEE_RATE,
    buyerServiceFee,
    estimatedBlockchainFee: ESTIMATED_BLOCKCHAIN_FEE,
    estimatedBuyerTotal: buyerTotal,
    maximumBuyerTotal: buyerPriceCap(t),
    maximumResalePrice: maxResalePrice(t),
    sellerCommissionRate: SELLER_COMMISSION_RATE,
    sellerCommission,
    estimatedSellerPayout: money(price - sellerCommission),
    gasFeePolicy: "Blockchain gas is covered by platform fees and is not charged separately to the buyer or seller."
  };
}
function publicTicket(t) { return {...t, pricing: pricing(t)}; }
function verify(id,seller) {
  const t=tickets.get(id);
  if(!t) return {ok:false,message:"Ticket not found in mock official provider."};
  if(!t.valid) return {ok:false,message:"Official provider says the ticket is invalid."};
  if(t.status==="Used") return {ok:false,message:"Ticket has already been redeemed and cannot be resold."};
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
      return json(res,200,[...tickets.values()].filter(t=>t.valid && ["Owned","Listed","TransferCompleted"].includes(t.status) && (!event||t.eventName.toLowerCase().includes(event))).map(publicTicket));
    }
    if(req.method==="GET" && url.pathname.startsWith("/api/tickets/")) {
      const t=tickets.get(url.pathname.split("/").pop());
      return t?json(res,200,publicTicket(t)):json(res,404,{message:"Ticket not found"});
    }
    if(req.method==="POST") {
      const data=await body(req);
      if(url.pathname==="/api/verify") { const r=verify(data.ticketId,data.seller); return json(res,r.ok?200:400,r); }
      if(url.pathname==="/api/redeem") {
        const t=tickets.get(data.ticketId);
        if(!t) return json(res,404,{message:"Ticket not found in mock official provider."});
        if(t.status==="Used") return json(res,400,{message:"Ticket has already been redeemed."});
        if(t.status!=="Owned") return json(res,400,{message:"Only an owned ticket can be redeemed."});
        t.status="Used";
        t.valid=false;
        t.transferable=false;
        history(t,"Redeemed",{redeemedBy:data.redeemedBy||"official-venue"});
        return json(res,200,{message:"Ticket redeemed at the venue. It can no longer be resold.",blockchainEvent:"TicketRedeemed",ticket:t});
      }
      if(url.pathname==="/api/list") {
        const r=verify(data.ticketId,data.seller); if(!r.ok)return json(res,400,r);
        const t=r.ticket, max=maxResalePrice(t), maximumBuyerTotal=buyerPriceCap(t);
        if(!Number.isFinite(data.resalePrice)||data.resalePrice<=0)return json(res,400,{message:"Resale price must be positive."});
        const quote=pricing(t,data.resalePrice);
        if(data.resalePrice>max)return json(res,400,{message:`This price would make the buyer's estimated total exceed the S$${maximumBuyerTotal.toFixed(2)} cap. Maximum resale price is S$${max.toFixed(2)}.`,pricing:quote});
        t.resalePrice=money(data.resalePrice);t.status="Listed";history(t,"Listed",{resalePrice:t.resalePrice,maximumBuyerTotal,maximumResalePrice:max,pricing:pricing(t)});
        return json(res,200,{message:"Ticket listed successfully. Buyer total stays within the cap.",ticket:publicTicket(t)});
      }
      if(url.pathname==="/api/buy") {
        const t=tickets.get(data.ticketId); if(!t)return json(res,404,{message:"Ticket not found"}); if(t.status!=="Listed")return json(res,400,{message:"Ticket is not listed."});
        const quote=pricing(t);
        if(quote.estimatedBuyerTotal>quote.maximumBuyerTotal)return json(res,400,{message:"This ticket exceeds the buyer total spending cap.",pricing:quote});
        const seller=t.owner;const buyerWallet=getOrCreateWallet(data.buyer);t.status="PaymentConfirmed";history(t,"PaymentConfirmed",{buyer:data.buyer,seller,paymentMethod:data.paymentMethod||"Mock payment",buyerTotal:quote.estimatedBuyerTotal,pricing:quote});t.status="TransferPending";history(t,"TransferPending",{buyer:data.buyer,seller});t.owner=data.buyer;t.status="TransferCompleted";history(t,"TransferCompleted",{previousOwner:seller,newOwner:data.buyer,buyerWallet:buyerWallet.address,chargedBuyerTotal:quote.estimatedBuyerTotal,actualBlockchainFee:MOCK_ACTUAL_BLOCKCHAIN_FEE,platformAbsorbedGasDifference:money(Math.max(0,MOCK_ACTUAL_BLOCKCHAIN_FEE-ESTIMATED_BLOCKCHAIN_FEE))});
        // TransferCompleted is the completed transfer event. The ticket's
        // current state after the event is Owned by the new buyer.
        t.status="Owned";
        return json(res,200,{message:"Payment confirmed and mock official transfer completed. Blockchain gas was covered by platform fees.",blockchainEvent:"TransferCompleted",wallet:buyerWallet,pricing:{...quote,actualBlockchainFee:MOCK_ACTUAL_BLOCKCHAIN_FEE,platformAbsorbedGasDifference:money(Math.max(0,MOCK_ACTUAL_BLOCKCHAIN_FEE-ESTIMATED_BLOCKCHAIN_FEE))},ticket:publicTicket(t)});
      }
      if(url.pathname==="/api/agent") {
        const q=(data.message||"").toLowerCase(); let reply="I can help you verify a ticket, list a ticket, check the 1.2x price limit, or explain transfer status.";
        if(q.includes("sell")||q.includes("resell"))reply="Enter the official ticket ID and seller account. I will verify ownership and check the maximum buyer total cap, including service fee and estimated blockchain fee.";
        else if(q.includes("verify")||q.includes("real"))reply="Verification must come from the official provider. This prototype uses a mock provider; screenshots alone are not accepted.";
        else if(q.includes("price")||q.includes("cap")||q.includes("limit"))reply="The buyer's final payment cannot exceed 1.2 times the original ticket price. The cap includes the ticket price and 3% buyer service fee; gas is covered by platform fees.";
        else if(q.includes("gas")||q.includes("fee"))reply="Blockchain gas is covered by the platform's buyer and seller fees. It is not charged separately to the buyer or seller, and any variance is absorbed by the platform.";
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
