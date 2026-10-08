import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const vn=readFileSync(new URL('../public/vn.mjs',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('sprite figures are reused across refreshes so idle animation does not restart',()=>{
 assert.match(vn,/const syncSprites=\(slots,present,poses,ctxOf=\(\)=>\(\{\}\)\)=>/);
 assert.match(vn,/old\.find\(f=>!used\.has\(f\)&&f\.dataset\.actor===id\)/,'same-actor figures are reused, not recreated');
 assert.match(vn,/stage\.replaceChildren\(\.\.\.kept\)/);
 assert.doesNotMatch(vn,/\$\('sprites'\)\.replaceChildren/,'the sprite stage is only rebuilt through syncSprites');
});

test('entering characters animate in and expression swaps crossfade',()=>{
 assert.match(vn,/if\(!prefs\.reducedMotion\)figure\.classList\.add\('vn-enter'\)/);
 assert.match(vn,/if\(prev&&!prefs\.reducedMotion\)\{const ghost=img\.cloneNode\(\)/);
 assert.match(vn,/ghost\.animate\(\[\{opacity:1\},\{opacity:0\}\]/);
});

test('idle life CSS exists, is foot-anchored, livelier while speaking, and honors reduced motion',()=>{
 assert.match(css,/body\.visual-novel \.stage-character img\{transform-origin:50% 100%;animation:vn-breathe 4\.4s ease-in-out infinite,vn-sway 9s ease-in-out infinite alternate\}/);
 assert.match(css,/body\.visual-novel \.stage-character\.speaking img\{animation-duration:3\.1s,5\.4s\}/);
 assert.match(css,/\.stage-character \.vn-expr-ghost\{position:absolute;inset:0;object-fit:contain;object-position:center bottom/);
 assert.match(css,/@keyframes vn-breathe\{0%,100%\{transform:translateY\(0\) scaleY\(1\)\}50%\{transform:translateY\(-\.4%\) scaleY\(1\.01\)\}\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{body\.visual-novel \.stage-character img,body\.visual-novel \.stage-character\.vn-enter\{animation:none\}\}/);
});

test('animated WebP idle animation is chosen per actor, suppressed under reduced motion, with static fallbacks',()=>{
 assert.match(vn,/const idle=prefs\.reducedMotion\?actor\.idleStill\|\|actor\.portrait:actor\.idleAnimation\|\|actor\.idleStill\|\|actor\.portrait/,'reduced motion shows the still, otherwise the animated WebP plays');
 assert.match(vn,/img\.onerror=\(\)=>\{img\.onerror=null;const next=chain\[chain\.indexOf\(img\.getAttribute\('src'\)\)\+1\];if\(next\)img\.src=next;\}/,'a broken animation falls back statically instead of leaving an empty figure');
});
