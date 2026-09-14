/* CS COMMAND — Premium interactions v2
   Safe enhancement layer: no Firebase/chat logic is replaced.
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

  function observeDynamicUI(){
    let timer;
    const observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{enhanceNav();addClock();addSearchHint();},60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  function boot(){
    addClock();
    enhanceNav();
    addSearchHint();
    keyboardShortcuts();
    addRipple();
    observeDynamicUI();
    document.documentElement.dataset.premiumUi='2';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
