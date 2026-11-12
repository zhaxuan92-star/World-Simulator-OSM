export default async function handler(req, res) {
 if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({success:false});}
 const token=typeof req.body?.token==="string"?req.body.token:"";
 const secret=process.env.TURNSTILE_SECRET_KEY;
 if(!token||token.length>2048)return res.status(400).json({success:false});
 if(!secret)return res.status(500).json({success:false,error:"Turnstile secret missing"});
 try{const body=new URLSearchParams({secret,response:token});const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});const d=await r.json();if(!r.ok||!d.success)return res.status(403).json({success:false});return res.status(200).json({success:true});}catch{return res.status(502).json({success:false});}
}