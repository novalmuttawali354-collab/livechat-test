/* CS COMMAND — Premium interactions v3
   Dashboard becomes monitor/admin only for realtime bot replies.
   Auto Bot runs from member page, so it works even when admin is not logged in.
*/
(function(){
  'use strict';

  function qs(s,r=document){return r.querySelector(s)}
  function qsa(s,r=document){return [...r.querySelectorAll(s)]}

  function addClock(){
    const topbar=qs('.topbar');
    if(!topbar || qs('#premiumClock')) return;
    const clock=document.createElement('div');
    clock.id='premiumClock';clock.className='pill';
    clock.style.cssText='font-variant-numeric:tabular-nums;min-width:72px;text-align:center';
    const avatar=topbar.querySelector('.avatar');
    if(avatar)topbar.insertBefore(clock,avatar);else topbar.appendChild(clock);
    const tick=()=>{clock.textContent=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});clock.title=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})};
    tick();setInterval(tick,30000);
  }

  function enhanceNav(){
    const labels={overview:'Overview',inbox:'Live Inbox',members:'Members',bot:'Bot Automation',qna:'Q&A Auto Bot',unanswered:'Unanswered Queue',kb:'Knowledge Base',canned:'Canned Replies',issues:'Issues & Categories',channels:'Channels',operators:'Operators',analytics:'Analytics',audit:'Audit Log',settings:'Settings'};
    qsa('.nav button').forEach(btn=>{const id=btn.dataset.page;if(id&&labels[id])btn.title=labels[id]});
  }

  function keyboardShortcuts(){
    document.addEventListener('keydown',e=>{
      const tag=(e.target?.tagName||'').toLowerCase(),typing=['input','textarea','select'].includes(tag);
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const s=qs('#globalSearch');if(s){s.focus();s.select()}}
      if(e.key==='Escape'){const m=qs('#modal.show');if(m&&typeof window.closeModal==='function')window.closeModal()}
      if(!typing&&e.altKey&&/^[1-9]$/.test(e.key)){const b=qsa('.nav button')[Number(e.key)-1];if(b){e.preventDefault();b.click()}}
    });
  }

  function addSearchHint(){const s=qs('#globalSearch');if(s){s.placeholder='Cari member, User ID, chat, rule…  (Ctrl+K)';s.autocomplete='off'}}

  function addRipple(){
    document.addEventListener('pointerdown',e=>{
      const btn=e.target.closest('.btn,.nav button');if(!btn)return;
      const r=document.createElement('span'),rect=btn.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*1.5;
      r.style.cssText=`position:absolute;pointer-events:none;border-radius:50%;width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;background:rgba(255,255,255,.12);transform:scale(0);opacity:.7;animation:premiumRipple .5s ease-out forwards;z-index:0`;
      if(getComputedStyle(btn).position==='static')btn.style.position='relative';btn.style.overflow='hidden';btn.appendChild(r);setTimeout(()=>r.remove(),520);
    });
    if(!qs('#premiumInteractionStyle')){const st=document.createElement('style');st.id='premiumInteractionStyle';st.textContent='@keyframes premiumRipple{to{transform:scale(1);opacity:0}} .btn>*{position:relative;z-index:1}';document.head.appendChild(st)}
  }

  /* Realtime Auto Bot no longer runs in admin browser. */
  function installRealtimeObserverMode(){
    const original=window.handleAutoReply;
    if(typeof original!=='function'||original.__observerMode)return;
    const observer=function(c,text){
      if(c&&c._firebaseUid)return; // member-bot.js owns realtime bot replies
      return original(c,text);
    };
    observer.__observerMode=true;observer.__original=original;window.handleAutoReply=observer;
  }

  async function syncBotPublic(){
    try{
      if(!window.firebase||!firebase.apps.length||typeof state==='undefined')return;
      const user=firebase.auth().currentUser;
      if(!user||user.isAnonymous)return;
      await firebase.database().ref('cscc/botPublic').set({
        rules:Array.isArray(state.rules)?state.rules:[],
        qna:Array.isArray(state.qna)?state.qna:[],
        config:state.botConfig||{},
        updatedAt:firebase.database.ServerValue.TIMESTAMP
      });
    }catch(e){console.warn('[CSCC] Bot public sync skipped:',e?.message||e)}
  }

  function wrapBotEditors(){
    ['saveQna','toggleQna','deleteQna','saveRule','toggleRule','deleteRule','saveBotConfig'].forEach(name=>{
      const fn=window[name];if(typeof fn!=='function'||fn.__syncWrapped)return;
      const wrapped=function(...args){const out=fn.apply(this,args);setTimeout(syncBotPublic,0);return out};
      wrapped.__syncWrapped=true;window[name]=wrapped;
    });
  }

  function watchAdminAuth(){
    try{
      if(!window.firebase||!firebase.apps.length)return;
      firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(syncBotPublic,300)});
    }catch(_){ }
  }

  function observeDynamicUI(){
    let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{enhanceNav();addClock();addSearchHint();installRealtimeObserverMode();wrapBotEditors()},60)});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function boot(){
    addClock();enhanceNav();addSearchHint();keyboardShortcuts();addRipple();
    installRealtimeObserverMode();wrapBotEditors();watchAdminAuth();observeDynamicUI();
    document.documentElement.dataset.premiumUi='3';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
