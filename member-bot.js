/* CSCC Member Auto Bot v2
   Runs inside member-chat page, independent of admin login.
   Hard rule: one member message key = one deterministic bot reply node.
*/
(function(){
  'use strict';

  const DEFAULT_RULES=[
    {name:'Greeting',category:'General',priority:20,triggers:['min','halo','hallo','hallo min','bos','bosku'],intent:'greeting',response:['Hallo bosku, ada yang bisa kami bantu?','Halo bosku 👋 Ada yang bisa kami bantu hari ini?','Siap bosku, silakan sampaikan kendalanya ya.'],enabled:true},
    {name:'Withdraw Pending',category:'Withdraw',priority:100,triggers:['wd','withdraw','belum masuk'],intent:'withdraw',required:['userid'],response:['Baik bosku, kirim User ID terlebih dahulu ya.','Siap bosku, boleh kirim User ID untuk kami cek.'],after:'Baik bosku, akan kami cek.',enabled:true},
    {name:'Deposit Pending',category:'Deposit',priority:110,triggers:['dp','depo','deposit'],intent:'deposit',required:['proof'],response:['Boleh kirim bukti transfernya ya bosku, agar dapat kami cek.','Silakan kirim bukti transfer terlebih dahulu bosku.'],after:'Baik bosku, bukti sudah diterima. Akan kami cek.',enabled:true},
    {name:'Status Follow-up',category:'General',priority:80,triggers:['gimana','lama','sudah belum','cek lagi','belum selesai','kamu dimana'],intent:'followup',response:['Masih dalam pengecekan, mohon menunggu.','Mohon bersabar bosku, saat ini masih dalam proses pengecekan.'],enabled:true},
    {name:'Closing',category:'General',priority:10,triggers:['baik','sip','siap','ok','oke','okeoke','okey'],intent:'closing',response:['Baik bosku, terima kasih. Ada lagi yang bisa dibantu?'],enabled:true},
    {name:'Forgot Password',category:'Login',priority:95,triggers:['lupa password','lupa pw','lupa sandi','password lupa','pw lupa','tidak bisa login'],intent:'forgot_password',response:['Mohon kirim data terdaftar: atas nama rekening, nomor rekening, dan bank/e-wallet.'],enabled:true},
    {name:'Forgot User ID',category:'User ID',priority:95,triggers:['lupa user','lupa userid','lupa user id','lupa id'],intent:'forgot_userid',response:['Mohon kirim data terdaftar: atas nama rekening, nomor rekening, dan bank/e-wallet.'],enabled:true},
    {name:'Bonus Info',category:'Bonus/Promo',priority:90,triggers:['bonus','promo','cashback'],intent:'bonus',response:['Promo tersedia dapat dilihat pada menu promo. Jika ingin kami jelaskan promo tertentu, sebutkan nama promonya ya bosku.'],enabled:true},
    {name:'Ganti Rekening',category:'Account',priority:98,triggers:['ganti rekening','gantirek','ubah rekening','rekening baru'],intent:'change_bank',response:['Untuk pergantian nomor rekening, mohon isi data rekening lama dan rekening baru dengan lengkap. Jika nama rekening berbeda, kami sarankan daftar akun baru. Pergantian rekening hanya dapat dibantu 1x. Pergantian nomor rekening bank ke e-wallet tidak diperbolehkan.'],enabled:true},
    {name:'Complaint',category:'General',priority:5,triggers:['anjing','bangsat','lama kali','jelek'],intent:'complaint',response:['Kami bantu cek ya bosku. Mohon sampaikan kendalanya agar bisa kami tindaklanjuti.'],enabled:true}
  ];

  const DEFAULT_QNA=[
    {question:'Bagaimana cara cek status deposit?',keywords:['cek deposit','status deposit','deposit masuk'],category:'Deposit',answer:'Baik bosku, untuk pengecekan deposit silakan kirim bukti transfer terlebih dahulu ya.',enabled:true},
    {question:'Kenapa withdraw belum masuk?',keywords:['kenapa wd','withdraw belum masuk','wd lama'],category:'Withdraw',answer:'Baik bosku, silakan kirim User ID terlebih dahulu agar withdraw dapat kami cek.',enabled:true},
    {question:'Bagaimana jika lupa password?',keywords:['cara reset password','reset sandi','password lupa','lupa pw'],category:'Login',answer:'Mohon kirim data terdaftar: atas nama rekening, nomor rekening, dan bank/e-wallet ya bosku.',enabled:true},
    {question:'Apa promo yang tersedia?',keywords:['promo apa','bonus apa','cashback apa'],category:'Bonus/Promo',answer:'Promo tersedia dapat dilihat pada menu promo. Jika ingin kami jelaskan promo tertentu, sebutkan nama promonya ya bosku.',enabled:true},
    {question:'sapaan hallo',keywords:['hallo','halo','min','bos','bosku'],category:'General',answer:'Hallo bosku, ada yang bisa kami bantu bosku?',enabled:true},
    {question:'ganti rekening',keywords:['gantirek','ganti rekening','ubah rekening'],category:'General',answer:'Untuk pergantian nomor rekening, mohon isi data rekening lama dan rekening baru dengan lengkap. Jika nama rekening berbeda, kami sarankan daftar akun baru. Pergantian rekening hanya dapat dibantu 1x. Pergantian nomor rekening bank ke e-wallet tidak diperbolehkan.',enabled:true}
  ];

  const DEFAULT_CONFIG={delay:450,autoFallback:true,fallback:'Baik bosku, pertanyaan ini belum dikenali oleh Auto Bot. Sudah kami masukkan ke antrean admin untuk dibuatkan jawaban.'};
  let botRules=DEFAULT_RULES,botQna=DEFAULT_QNA,botConfig=DEFAULT_CONFIG;
  let attachedRef=null;

  function norm(s){return String(s||'').toLowerCase().trim().replace(/\s+/g,' ')}
  function lev(a,b){a=norm(a);b=norm(b);const m=Array.from({length:b.length+1},(_,i)=>[i]);for(let j=0;j<=a.length;j++)m[0][j]=j;for(let i=1;i<=b.length;i++)for(let j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:1+Math.min(m[i-1][j],m[i][j-1],m[i-1][j-1]);return m[b.length][a.length]}
  function exactWordMatch(t,k){if(!k)return false;if(k.includes(' '))return t.includes(k);return new RegExp('(^|\\s|[^a-z0-9])'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|\\s|[^a-z0-9])','i').test(t)}
  function safeKey(k){return String(k||'').replace(/[.#$\[\]\/]/g,'_')}

  function ruleScore(text,r){const t=norm(text);let best=0;for(const raw of (r.triggers||[])){const k=norm(raw);if(!k)continue;if(exactWordMatch(t,k))best=Math.max(best,k.length>3?1:.92);else if(k.length>3){for(const w of t.split(/\s+/)){if(lev(w,k)<=1)best=Math.max(best,.72)}}}return best}
  function matchRule(text){const hits=(botRules||[]).filter(r=>r&&r.enabled!==false).map(r=>({r,score:ruleScore(text,r)})).filter(x=>x.score>0);hits.sort((a,b)=>(Number(b.r.priority)||0)-(Number(a.r.priority)||0)||b.score-a.score);return hits[0]?.r||null}
  function qnaScore(text,q){const t=norm(text);let best=0;for(const raw of (q.keywords||[])){const k=norm(raw);if(!k)continue;if(t===k)best=Math.max(best,1.1);else if(exactWordMatch(t,k))best=Math.max(best,1);else if(k.length>3){for(const w of t.split(/\s+/)){if(lev(w,k)<=1)best=Math.max(best,.70)}}}if(norm(q.question)===t)best=Math.max(best,1.2);return best}
  function matchQna(text){const hits=(botQna||[]).filter(q=>q&&q.enabled!==false).map(q=>({q,score:qnaScore(text,q)})).filter(x=>x.score>0);hits.sort((a,b)=>b.score-a.score);return hits[0]?.q||null}

  async function getConversationState(){try{return (await currentRef.once('value')).val()||{}}catch(_){return{}}}
  async function decide(text){
    const conv=await getConversationState();
    if(conv.botPaused===true||conv.status==='human'||conv.status==='resolved')return null;
    const uid=String(conv.userid||'').trim(),r=matchRule(text);
    if(r){
      if(r.intent==='withdraw')return (!uid||uid==='-')?(r.response?.[0]||'Baik bosku, kirim User ID terlebih dahulu ya.'):(r.after||'Baik bosku, akan kami cek.');
      if(r.intent==='deposit'){const hasProof=Boolean(conv.proof)||/\b(bukti|transfer|receipt|struk)\b/i.test(text);return hasProof?(r.after||'Baik bosku, bukti sudah diterima. Akan kami cek.'):(r.response?.[0]||'Silakan kirim bukti transfer terlebih dahulu bosku.');}
      const arr=(r.response||[]).filter(Boolean);return arr.length?arr[Math.floor(Math.random()*arr.length)]:null;
    }
    const q=matchQna(text);if(q?.answer)return q.answer;
    return botConfig.autoFallback===false?null:(botConfig.fallback||DEFAULT_CONFIG.fallback);
  }

  async function claimAndReply(key,m){
    if(!currentRef||!key||m.from!=='member')return;
    const ts=Number(m.ts||0);if(ts&&Date.now()-ts>90000)return;
    const msgRef=currentRef.child('messages/'+key);
    const claimRef=msgRef.child('memberBotClaim');
    let committed=false;
    try{
      const tr=await claimRef.transaction(v=>v?undefined:{at:firebase.database.ServerValue.TIMESTAMP,engine:'member-v2'});
      committed=tr.committed;
    }catch(_){return}
    if(!committed)return;

    try{
      await msgRef.child('processed').set(true);
      const reply=await decide(m.text||'');
      if(!reply)return;
      if(typeof $==='function' && $('typing'))$('typing').textContent='Auto Bot sedang mengetik…';
      await new Promise(r=>setTimeout(r,Math.max(0,Number(botConfig.delay)||0)));

      /* Deterministic reply node. Re-running this exact source message can only
         update the same node, never create a second chat bubble. */
      const replyKey='bot_'+safeKey(key);
      const replyRef=currentRef.child('messages/'+replyKey);
      const replyObj={from:'bot',text:reply,time:typeof nowHM==='function'?nowHM():new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),ts:firebase.database.ServerValue.TIMESTAMP,processed:true,sourceMessageKey:key,engine:'member-v2'};
      const result=await replyRef.transaction(existing=>existing?undefined:replyObj);
      if(!result.committed){
        console.info('[MemberBot] duplicate reply prevented for',key);
        if(typeof $==='function' && $('typing'))$('typing').textContent='';
        return;
      }

      await currentRef.update({status:'bot',updatedAt:firebase.database.ServerValue.TIMESTAMP});
      if(typeof $==='function' && $('typing'))$('typing').textContent='';
    }catch(e){console.warn('[MemberBot] reply failed',e)}
  }

  async function loadRemoteBotData(){
    try{const snap=await db.ref('cscc/botPublic').once('value'),v=snap.val()||{};if(Array.isArray(v.rules)&&v.rules.length)botRules=v.rules;if(Array.isArray(v.qna)&&v.qna.length)botQna=v.qna;if(v.config&&typeof v.config==='object')botConfig={...DEFAULT_CONFIG,...v.config}}catch(_){ }
  }

  function attach(){
    if(typeof currentRef==='undefined'||!currentRef||attachedRef===currentRef)return false;
    attachedRef=currentRef;loadRemoteBotData();
    currentRef.child('messages').on('child_added',snap=>{const m=snap.val()||{};if(m.from==='member'&&m.processed!==true)claimAndReply(snap.key,m)});
    return true;
  }

  const timer=setInterval(()=>{if(attach())clearInterval(timer)},200);
  setTimeout(()=>clearInterval(timer),30000);
})();
