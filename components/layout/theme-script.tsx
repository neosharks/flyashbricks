/**
 * Applies saved display preferences before the first paint: colour theme,
 * text size and bolder text. Without it, someone who chose dark mode or large
 * text would see the page flash in the default first.
 *
 * Deliberately tiny and dependency-free; anything heavier does not belong on
 * the critical path. Values are checked against fixed lists before use.
 */
const SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage;var t=s.getItem('flyash.theme');if(t==='dark'||t==='light'){d.classList.add(t)}var z=s.getItem('flyash.textSize');if(['sm','lg','xl','xxl'].indexOf(z)>-1){d.setAttribute('data-text-size',z)}if(s.getItem('flyash.bold')==='1'){d.setAttribute('data-bold','')}}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
