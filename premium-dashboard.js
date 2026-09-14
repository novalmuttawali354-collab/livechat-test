/* CS COMMAND — Premium interactions v4
   Dashboard is monitor/admin only. Realtime Auto Bot is owned by member-bot.js.
   Hard rule: dashboard browser is NEVER allowed to send msg.from === 'bot' to Firebase.
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

  /* Disable the old dashboard reply engine for realtime Firebase conversations. */
  function installRealtimeObserverMode(){
    const original=window.handleAutoReply;
    if(typeof original==='function' && !original.__dashboardNoBot){
      const observer=function(c,text){
        if(c&&c._firebaseUid){
          console.info('[CSCC] Dashboard bot processing blocked. member-bot.js owns realtime reply.');
          return;
        }
        return original(c,text);
      };
      observer.__dashboardNoBot=true;
      observer.__original=original;
      window.handleAutoReply=observer;
    }

    /* Hard network kill-switch: even if an old callback reaches pushMessage,
       dashboard may only send ADMIN/agent messages, never AUTO BOT messages. */
    const rt=window.csccRealtime;
    if(rt && typeof rt.pushMessage==='function' && !rt.pushMessage.__dashboardNoBot){
      const raw=rt.pushMessage.bind(rt);
      const safePush=function(c,msg){
        if(msg && msg.from==='bot'){
          console.warn('[CSCC] Blocked duplicate dashboard Auto Bot Firebase write.');
          return;
        }
        return raw(c,msg);
      };
      safePush.__dashboardNoBot=true;
      safePush.__original=raw;
      rt.pushMessage=safePush;
    }
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
    try{if(!window.firebase||!firebase.apps.length)return;firebase.auth().onAuthStateChanged(user=>{if(user&&!user.isAnonymous)setTimeout(syncBotPublic,300)})}catch(_){ }
  }

  function observeDynamicUI(){
    let timer;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{enhanceNav();addClock();addSearchHint();installRealtimeObserverMode();wrapBotEditors()},30)});
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function boot(){
    addClock();enhanceNav();addSearchHint();keyboardShortcuts();addRipple();
    installRealtimeObserverMode();wrapBotEditors();watchAdminAuth();observeDynamicUI();
    /* repeat briefly so late-created csccRealtime is also protected */
    let n=0;const t=setInterval(()=>{installRealtimeObserverMode();if(++n>40)clearInterval(t)},100);
    document.documentElement.dataset.premiumUi='4';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
