import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../modules/study-design-bias/app.js', import.meta.url), 'utf8');

// A small DOM harness exercises the actual page script without adding a runtime dependency.
function createApp(random = () => 0.999){
  const radios = { threat: [], repair: [] };
  const elements = {};
  for(const id of ['seed', 'scenario', 'target', 'observed', 'design', 'feedback', 'threats', 'repairs', 'same', 'next', 'check']){
    let html = '';
    elements[id] = {
      value: id === 'seed' ? '2150' : '',
      textContent: '',
      get innerHTML(){ return html; },
      set innerHTML(value){
        html = value;
        const name = id === 'threats' ? 'threat' : id === 'repairs' ? 'repair' : null;
        if(name){
          radios[name] = [...value.matchAll(/<input type="radio" name="([^"]+)" value="([^"]+)">/g)]
            .map(([, group, option]) => ({ name: group, value: option, checked: false }));
        }
      }
    };
  }
  const document = {
    querySelector(selector){
      if(selector.startsWith('#')) return elements[selector.slice(1)];
      const name = /^input\[name=(threat|repair)\]:checked$/.exec(selector)?.[1];
      assert.ok(name, `Unexpected selector: ${selector}`);
      return radios[name].find(option => option.checked);
    }
  };
  const math = Object.create(Math);
  math.random = random;
  const context = createContext({ document, Math: math });
  runInContext(source, context);
  return {
    elements,
    read(expression){ return JSON.parse(runInContext(`JSON.stringify(${expression})`, context)); },
    order(name){ return radios[name].map(option => option.value); },
    choose(name, value){
      assert.ok(radios[name].some(option => option.value === value));
      for(const option of radios[name]) option.checked = option.value === value;
    },
    selected(){ return Object.values(radios).flat().filter(option => option.checked); },
    load(seed){ elements.seed.value = String(seed); elements.same.onclick(); }
  };
}

test('each question consumes its own shuffle and retains every answer value', () => {
  const draws = [0.999, 0.999, 0.999, 0.999, 0, 0, 0, 0];
  let calls = 0;
  const app = createApp(() => { calls++; return draws.shift(); });
  assert.equal(calls, 8);
  assert.deepEqual(app.order('threat'), ['coverage', 'confounding', 'measurement', 'processing', 'history']);
  assert.deepEqual(app.order('repair'), ['randomize', 'privacy', 'audit', 'control', 'sample']);
  assert.notEqual(app.order('threat').indexOf('confounding'), app.order('repair').indexOf('randomize'));
  assert.deepEqual(app.read('threatOptions.map(option => option[0])'), ['coverage', 'confounding', 'measurement', 'processing', 'history']);
  assert.deepEqual(app.read('repairOptions.map(option => option[0])'), ['sample', 'randomize', 'privacy', 'audit', 'control']);
});

test('the shuffle can produce all 120 permutations without changing its source list', () => {
  let draws = [];
  const app = createApp(() => draws.shift() ?? 0.999);
  const original = app.read('threatOptions');
  const permutations = new Set();
  for(let a = 0; a < 5; a++) for(let b = 0; b < 4; b++) for(let c = 0; c < 3; c++) for(let d = 0; d < 2; d++){
    draws = [(a + 0.5) / 5, (b + 0.5) / 4, (c + 0.5) / 3, (d + 0.5) / 2];
    const shuffled = app.read('shuffleOptions(threatOptions)');
    assert.deepEqual([...shuffled].sort(), [...original].sort());
    permutations.add(JSON.stringify(shuffled));
  }
  assert.equal(permutations.size, 120);
  assert.deepEqual(app.read('threatOptions'), original);
});

test('matching answer positions remain possible by chance, not forced apart', () => {
  const app = createApp();
  const current = app.read('current');
  assert.equal(app.order('threat').indexOf(current.threat), app.order('repair').indexOf(current.repair));
});

test('checking correct, partial, incorrect, or incomplete answers never reshuffles', () => {
  let calls = 0;
  const app = createApp(() => { calls++; return calls % 2 ? 0.2 : 0.8; });
  const before = [app.order('threat'), app.order('repair')];
  const current = app.read('current');
  const wrongThreat = app.order('threat').find(value => value !== current.threat);
  const wrongRepair = app.order('repair').find(value => value !== current.repair);
  app.elements.check.onclick();
  assert.match(app.elements.feedback.innerHTML, /Complete both choices/);
  app.choose('threat', current.threat);
  app.elements.check.onclick();
  assert.match(app.elements.feedback.innerHTML, /Complete both choices/);
  for(const [threat, repair, summary] of [
    [current.threat, current.repair, 'Well diagnosed'],
    [current.threat, wrongRepair, 'One response is correct'],
    [wrongThreat, current.repair, 'One response is correct'],
    [wrongThreat, wrongRepair, 'Reconsider the design']
  ]){
    app.choose('threat', threat);
    app.choose('repair', repair);
    app.elements.check.onclick();
    assert.match(app.elements.feedback.innerHTML, new RegExp(summary));
    assert.deepEqual([app.order('threat'), app.order('repair')], before);
    assert.equal(app.selected().length, 2);
  }
  assert.equal(calls, 8);
});

test('all five scenarios grade by answer identity at every displayed position', () => {
  let draw = 0;
  const app = createApp(() => { draw = (draw * 1664525 + 1013904223) >>> 0; return draw / 4294967296; });
  const seen = new Map();
  for(let seed = 1; seed <= 500; seed++){
    app.load(seed);
    const current = app.read('current');
    app.choose('threat', current.threat);
    app.choose('repair', current.repair);
    app.elements.check.onclick();
    assert.match(app.elements.feedback.innerHTML, /Primary threat — Correct/);
    assert.match(app.elements.feedback.innerHTML, /Best repair — Correct/);
    const positions = seen.get(current.threat) ?? new Set();
    positions.add(`${app.order('threat').indexOf(current.threat)},${app.order('repair').indexOf(current.repair)}`);
    seen.set(current.threat, positions);
  }
  assert.equal(seen.size, 5);
  for(const positions of seen.values()){
    assert.equal(new Set([...positions].map(pair => pair[0])).size, 5);
    assert.equal(new Set([...positions].map(pair => pair[2])).size, 5);
    assert.ok([...positions].some(pair => pair[0] !== pair[2]));
  }
});

test('rerunning a seed preserves the case but reshuffles and clears answers and feedback', () => {
  let draw = 0.999;
  const app = createApp(() => draw);
  const current = app.read('current');
  const before = [app.order('threat'), app.order('repair')];
  app.choose('threat', current.threat);
  app.choose('repair', current.repair);
  app.elements.check.onclick();
  draw = 0;
  app.elements.same.onclick();
  assert.deepEqual(app.read('current'), current);
  assert.notDeepEqual([app.order('threat'), app.order('repair')], before);
  assert.equal(app.selected().length, 0);
  assert.match(app.elements.feedback.innerHTML, /Case loaded/);
  app.elements.next.onclick();
  assert.equal(Number(app.elements.seed.value), 2151);
  assert.notDeepEqual(app.read('current'), current);
  assert.equal(app.selected().length, 0);
  assert.match(app.elements.feedback.innerHTML, /Case loaded/);
});
