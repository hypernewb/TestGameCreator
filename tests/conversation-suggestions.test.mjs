import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationSuggestionView} from '../public/conversation-suggestions.mjs';

const actions=[{type:'core.inspect',label:'Look around'},{type:'core.wait',label:'Wait'},{type:'core.endScene',label:'End conversation'},{type:'core.move',label:'Leave'},{type:'social.speak',label:'Talk to Mina'}];
const pack={actors:[{id:'player',name:'You'},{id:'mina',name:'Mina',conversationStarters:['Ask about the gallery.']}]};

test('continuous conversation suggestions offer authored dialogue and only useful scene controls',()=>{
 const view=conversationSuggestionView({scene:{characters:['mina']}},pack,actions);
 assert.deepEqual(view.prompts,['Ask about the gallery.']);
 assert.deepEqual(view.controls.map(action=>action.type),['core.endScene','core.move']);
});

test('outside a conversation the ordinary action menu remains intact',()=>{
 const view=conversationSuggestionView({scene:null},pack,actions);
 assert.deepEqual(view.prompts,[]);assert.equal(view.controls,actions);
});

test('a group conversation offers prompts for the character who spoke last',()=>{
 const groupPack={actors:[...pack.actors,{id:'rowan',name:'Rowan',conversationStarters:['Ask about the letter.']}]},state={scene:{characters:['mina','rowan']},turns:{one:{sceneLines:[{speaker:'mina',text:'Hi.'},{speaker:'rowan',text:'Look at this.'}]}}};
 const view=conversationSuggestionView(state,groupPack,actions);
 assert.equal(view.character,'Rowan');assert.deepEqual(view.prompts,['Ask about the letter.']);
});
