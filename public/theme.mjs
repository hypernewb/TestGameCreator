const $=id=>document.getElementById(id);
export const applyTheme=()=>{const on=localStorage.getItem('story-theme')==='persona';document.body.classList.toggle('theme-persona',on);$('theme-toggle').textContent=on?'Theme: Persona':'Theme: Classic';};
export const initTheme=()=>{$('theme-toggle').onclick=()=>{localStorage.setItem('story-theme',localStorage.getItem('story-theme')==='persona'?'classic':'persona');applyTheme();};applyTheme();};
