const fs = require('fs');
const vm = require('vm');
class E {
  constructor(id){ this.id=id; this.value=''; this.checked=false; this.textContent=''; this.hidden=false; this.listeners={}; this.classList={classes:new Set(), add(...c){c.forEach(x=>this.classes.add(x))}, remove(...c){c.forEach(x=>this.classes.delete(x))}, contains(c){return this.classes.has(c)}}; }
  addEventListener(t, cb){ (this.listeners[t] ??= []).push(cb); }
  focus(){}
  click(){ (this.listeners.click || []).forEach(cb => cb({ preventDefault(){} })); }
}
const ids = 'ctot tsat taxi expectedPush singleEngineTaxi calculate reset actualPushNow expectedPushRow engineCard status earliestPush latestPush departureWindow taxiSummary tsatSummary actualPushSummary engineStart engineBasis earliestPushCountdown engineCountdown earliestPushCountdownLabel engineCountdownLabel utcClock utcDate earliestCountdownCard engineCountdownCard pushHint'.split(' ');
const els = Object.fromEntries(ids.map(id => [id, new E(id)]));
const docListeners = {};
const fixedDate = class extends Date {
  constructor(...args){ super(...(args.length ? args : ['2026-07-09T14:00:30Z'])); }
  static now(){ return new Date('2026-07-09T14:00:30Z').getTime(); }
};
const context = {
  console,
  setInterval(){ return 1; },
  clearInterval(){},
  Date: fixedDate,
  location: { protocol: 'file:' },
  navigator: { vibrate(){} },
  document: { getElementById: id => els[id], addEventListener: (t,cb) => docListeners[t]=cb, body: { classList: { add(){}, remove(){} } } },
  window: null
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('/mnt/data/ctot-pwa-utc/app.js','utf8'), context, {filename:'app.js'});
docListeners.DOMContentLoaded();
const app = context.CTOTApp;
function eq(n, a, e){ if(a !== e) throw Error(`${n}: ${a} != ${e}`); }

eq('UTC clock', app.formatUtcClock(new Date('2026-07-09T14:00:30Z')), '14:00:30Z');
eq('parse compact', app.parseTime('1430','CTOT').minutes, 870);
eq('parse colon', app.parseTime('14:30','CTOT').minutes, 870);
eq('parse dot', app.parseTime('14.30','CTOT').minutes, 870);
eq('format UTC', app.formatTime(-12), '23:48Z');
let r = app.calculate({ctotText:'1430', tsatText:'', taxiText:'18', singleEngineTaxi:false});
eq('earliest no TSAT', app.formatTime(r.earliestPushback), '14:07Z');
eq('latest', app.formatTime(r.latestPushback), '14:22Z');
r = app.calculate({ctotText:'1430', tsatText:'1410', taxiText:'18', singleEngineTaxi:false});
eq('earliest TSAT', app.formatTime(r.earliestPushback), '14:10Z');
r = app.calculate({ctotText:'1430', tsatText:'1400', taxiText:'18', singleEngineTaxi:false});
eq('early TSAT ignored', app.formatTime(r.earliestPushback), '14:07Z');
r = app.calculate({ctotText:'0003', tsatText:'', taxiText:'10', singleEngineTaxi:false});
eq('rollover', app.formatTime(r.earliestPushback), '23:48Z');
r = app.calculate({ctotText:'1430', tsatText:'', taxiText:'18', singleEngineTaxi:true, expectedPushText:'1412'});
eq('engine expected', app.formatTime(r.engine.latestEngineStart), '14:25Z');
r = app.calculate({ctotText:'1430', tsatText:'', taxiText:'18', singleEngineTaxi:true, expectedPushText:''});
eq('engine latest allowed', app.formatTime(r.engine.latestEngineStart), '14:35Z');
eq('countdown uses UTC', app.formatCountdown(app.minutesUntil(14*60+10, 14*60)), '10:00');
els.ctot.value='1430'; els.tsat.value='1410'; els.taxi.value='18'; els.calculate.click();
eq('button earliest', els.earliestPush.textContent, '14:10Z');
eq('button latest', els.latestPush.textContent, '14:22Z');
eq('button countdown', els.earliestPushCountdown.textContent, '9:30');
els.singleEngineTaxi.checked=true; (els.singleEngineTaxi.listeners.change||[]).forEach(cb=>cb({})); els.expectedPush.value='1412'; els.calculate.click();
eq('button engine', els.engineStart.textContent, '14:25Z');
eq('button engine countdown', els.engineCountdown.textContent, '24:30');
els.actualPushNow.click();
eq('actual push now UTC', els.actualPushSummary.textContent.includes('14:00Z'), true);
console.log('ALL_TESTS_PASS');
