/* CS COMMAND — Premium interactions v2.2
   Safe enhancement layer + hardened Auto Bot anti-spam.
*/
(function(){
  'use strict';

  function qs(s,r=document){return r.querySelector(s)}
  function qsa(s,r=document){return [...r.querySelectorAll(s)]}

  function addClock(){
    const topbar=qs('.topbar');
    if(!topbar || qs('#premiumClock')) return;
    const clock=document.createElement('div');
    clock.id='premiumClock';
    clock.className='pill';
    clock.style.cssText='font-variant-numeric:tabular-nums;min-width:72px;text-align:center';
    const avatar=topbar.querySelector('.avatar');
    if(avatar) topbar.insertBefore(clock,avatar); else topbar.appendChild(clock);
    const tick=()=>{
      clock.textContent=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      clock.title=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
    };
    tick(); setInterval(tick,30000);
  }

  function enhanceNav(){
    const labels={overview:'Overview',inbox:'Live Inbox',members:'Members',bot:'Bot Automation',qna:'Q&A Auto Bot',unanswered:'Unanswered Queue',kb:'Knowledge Base',canned:'Canned Replies',issues:'Issues & Categories',channels:'Channels',operators:'Operators',analytics:'Analytics',audit:'Audit Log',settings:'Settings'};
    qsa('.nav button').forEach(btn=>{
      const id=btn.dataset.page;
      if(id && labels[id]) btn.title=labels[id];
    });
  }

  function keyboardShortcuts(){
    document.addEventListener('keydown',e=>{
      const tag=(e.target?.tagName||'').toLowerCase();
      const typing=['input','textarea','select'].includes(tag);
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
        e.preventDefault();
        const search=qs('#globalSearch');
        if(search){search.focus();search.select();}
      }
      if(e.key==='Escape'){
        const modal=qs('#modal.show');
        if(modal && typeof window.closeModal==='function') window.closeModal();
        const search=qs('#globalSearch');
        if(document.activeElement===search){search.blur();search.value='';}
      }
      if(!typing && e.altKey && /^[1-9]$/.test(e.key)){
        const buttons=qsa('.nav button');
        const b=buttons[Number(e.key)-1];
        if(b){e.preventDefault();b.click();}
      }
    });
  }

  function addSearchHint(){
    const search=qs('#globalSearch');
    if(!search) return;
    search.placeholder='Cari member, User ID, chat, rule…  (Ctrl+K)';
    search.autocomplete='off';
  }

  function addRipple(){
    document.addEventListener('pointerdown',e=>{
      const btn=e.target.closest('.btn,.nav button');
      if(!btn) return;
      const r=document.createElement('span');
      const rect=btn.getBoundingClientRect();
      const size=Math.max(rect.width,rect.height)*1.5;
      r.style.cssText=`position:absolute;pointer-events:none;border-radius:50%;width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;background:rgba(255,255,255,.12);transform:scale(0);opacity:.7;animation:premiumRipple .5s ease-out forwards;z-index:0`;
      if(getComputedStyle(btn).position==='static') btn.style.position='relative';
      btn.style.overflow='hidden';
      btn.appendChild(r);
      setTimeout(()=>r.remove(),520);
    });
    if(!qs('#premiumInteractionStyle')){
      const st=document.createElement('style');
      st.id='premiumInteractionStyle';
      st.textContent='@keyframes premiumRipple{to{transform:scale(1);opacity:0}} .btn>*{position:relative;z-index:1}';
      document.head.appendChild(st);
    }
  }

  function isFallbackText(text){
    const t=String(text||'').toLowerCase();
    return t.includes('belum dikenali oleh auto bot') ||
           t.includes('masukkan ke antrean admin') ||
           t.includes('masuk ke antrean admin') ||
           t.includes('belum dikenali');
  }

  /* Lock pemrosesan per pesan member. */
  function installBotReplyGuard(){
    const original=window.handleAutoReply;
    if(typeof original!=='function' || original.__csccGuarded) return;

    const guarded=function(c,text){
      try{
        if(!c || !c._firebaseUid || !window.firebase || typeof firebase.database!=='function'){
          return original(c,text);
        }

        const memberMessage=[...(c.messages||[])].reverse().find(m=>
          m && m.from==='member' && m._firebaseKey && String(m.text||'')===String(text||'') && m.processed!==true
        );

        if(!memberMessage || !memberMessage._firebaseKey){
          return original(c,text);
        }

        const lockRef=firebase.database().ref(
          `cscc/conversations/${c._firebaseUid}/messages/${memberMessage._firebaseKey}/botLock`
        );

        const lockOwner=`${Date.now()}_${Math.random().toString(36).slice(2)}`;
        lockRef.transaction(current=>{
          if(current) return;
          return {owner:lockOwner,at:Date.now()};
        },(error,committed)=>{
          if(error){
            console.warn('[CSCC] Bot lock error:',error);
            return;
          }
          if(committed){
            original(c,text);
          }else{
            console.info('[CSCC] Duplicate processing blocked:',memberMessage._firebaseKey);
          }
        },false);
      }catch(err){
        console.warn('[CSCC] Bot guard error:',err);
      }
    };

    guarded.__csccGuarded=true;
    guarded.__original=original;
    window.handleAutoReply=guarded;
  }

  /*
   * Hard dedupe saat balasan BOT ditulis ke Firebase.
   * 1 pesan member = maksimal 1 node balasan bot di database.
   * Jadi walaupun ada dua tab admin atau listener terpanggil dua kali,
   * member tetap hanya menerima satu balasan.
   */
  function installFirebaseReplyDedupe(){
    const rt=window.csccRealtime;
    if(!rt || typeof rt.pushMessage!=='function' || rt.pushMessage.__deduped) return;

    const originalPush=rt.pushMessage.bind(rt);
    const localCooldown=new Map();

    function latestMemberKey(c){
      const arr=[...(c?.messages||[])].reverse();
      const m=arr.find(x=>x && x.from==='member' && x._firebaseKey);
      return m?._firebaseKey||null;
    }

    function recentKey(c,msg){
      return `${c?._firebaseUid||c?.id||'x'}|${String(msg?.text||'').trim().toLowerCase()}`;
    }

    function guardedPush(c,msg){
      if(!msg || msg.from!=='bot') return originalPush(c,msg);

      const cooldownKey=recentKey(c,msg);
      const now=Date.now();
      const last=localCooldown.get(cooldownKey)||0;
      if(now-last<2500){
        console.info('[CSCC] Duplicate bot reply blocked by cooldown');
        return;
      }
      localCooldown.set(cooldownKey,now);
      setTimeout(()=>{
        if(localCooldown.get(cooldownKey)===now)localCooldown.delete(cooldownKey);
      },5000);

      if(!c?._firebaseUid || !window.firebase || typeof firebase.database!=='function'){
        return originalPush(c,msg);
      }

      const sourceKey=latestMemberKey(c);
      if(!sourceKey) return originalPush(c,msg);

      const clean={
        from:'bot',
        text:String(msg.text||''),
        time:msg.time||(typeof window.nowHM==='function'?window.nowHM():new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})),
        ts:msg.ts||Date.now(),
        processed:true,
        sourceMessageKey:sourceKey
      };

      const safeSource=String(sourceKey).replace(/[.#$\[\]\/]/g,'_');
      const replyRef=firebase.database().ref(
        `cscc/conversations/${c._firebaseUid}/messages/bot_${safeSource}`
      );

      const write=()=>replyRef.transaction(current=>{
        if(current) return; // sudah ada balasan untuk pesan member ini
        return clean;
      },(error,committed)=>{
        if(error) console.warn('[CSCC] Reply dedupe transaction error:',error);
        else if(!committed) console.info('[CSCC] Extra bot reply blocked for',sourceKey);
      },false);

      // Fallback sengaja sedikit ditunda. Kalau ada jawaban rule/Q&A yang benar,
      // jawaban itu akan menang dan fallback tidak sempat masuk ke member.
      if(isFallbackText(clean.text)) setTimeout(write,650);
      else write();
    }

    guardedPush.__deduped=true;
    guardedPush.__original=originalPush;
    rt.pushMessage=guardedPush;
  }

  function observeDynamicUI(){
    let timer;
    const observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        enhanceNav();
        addClock();
        addSearchHint();
        installBotReplyGuard();
        installFirebaseReplyDedupe();
      },60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function boot(){
    addClock();
    enhanceNav();
    addSearchHint();
    keyboardShortcuts();
    addRipple();
    installBotReplyGuard();
    installFirebaseReplyDedupe();
    observeDynamicUI();
    document.documentElement.dataset.premiumUi='2.2';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
