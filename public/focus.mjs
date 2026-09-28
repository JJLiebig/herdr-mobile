/** The composer changes only the browser viewport, never the host terminal size. */
export function setupFocus(document, window, onClose=()=>{}) {
  const $=id=>document.getElementById(id);
  const panel=$('input-panel'), menu=$('input-menu'), toggle=$('input-toggle');
  function menuOpen(open){menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
  function resize(){
    const viewport=window.visualViewport;
    $('focus').style.setProperty('--focus-height',`${viewport?.height||window.innerHeight}px`);
    $('focus').style.setProperty('--focus-top',`${viewport?.offsetTop||0}px`);
  }
  function open(focusText=true){
    menuOpen(false);panel.hidden=false;resize();
    if(focusText)$('draft').focus({preventScroll:true});
  }
  function close(){
    onClose();
    $('draft').blur();panel.hidden=true;menuOpen(false);resize();
  }
  toggle.addEventListener('click',()=>menuOpen(menu.hidden));
  $('input-text').addEventListener('click',()=>open());
  $('input-close').addEventListener('click',()=>{close();toggle.focus({preventScroll:true});});
  $('record').addEventListener('click',()=>open(false));
  $('input-keys').addEventListener('click',()=>{
    menuOpen(false);$('terminal-keys').hidden=!$('terminal-keys').hidden;
  });
  $('keys-close').addEventListener('click',()=>{$('terminal-keys').hidden=true;toggle.focus({preventScroll:true});});
  $('focus').addEventListener('keydown',event=>{
    if(event.key==='Escape'&&(!menu.hidden||!panel.hidden)){
      event.preventDefault();close();toggle.focus({preventScroll:true});
    }
  });
  window.visualViewport?.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);
  resize();
  return {
    enter(){document.body.classList.add('thread-open');close();$('terminal-keys').hidden=true;},
    leave(){close();document.body.classList.remove('thread-open');},
    open,
    sent(){close();}
  };
}
