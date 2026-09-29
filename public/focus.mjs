/** Fit the terminal to the visible viewport, including the phone keyboard. */
export function setupFocus(document,window){
  const focus=document.getElementById('focus');
  const resize=()=>{
    const viewport=window.visualViewport;
    focus.style.setProperty('--focus-height',`${viewport?.height||window.innerHeight}px`);
    focus.style.setProperty('--focus-top',`${viewport?.offsetTop||0}px`);
  };
  window.visualViewport?.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('scroll',resize);
  window.addEventListener('resize',resize);resize();
  return {
    enter(){document.body.classList.add('thread-open');document.getElementById('terminal-keys').hidden=true;},
    leave(){document.body.classList.remove('thread-open');}
  };
}
