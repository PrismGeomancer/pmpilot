// Run with node verify-pumpilot.cjs. Checks product logic without dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map(), events = {}, storage = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, { id, innerHTML: '', textContent: '', value: '', hidden: false, open: false,
    classList: { toggle() {} }, addEventListener(type, fn) { this[type] = fn; },
    reset() {}, showModal() { this.open = true; }, close() { this.open = false; }, focus() {}, setSelectionRange() {} });
  return elements.get(id);
}
const context = vm.createContext({ document: { getElementById: element, querySelectorAll: () => [],
  addEventListener(type, fn) { (events[type] ??= []).push(fn); } },
  window: { addEventListener(type, fn) { (events[type] ??= []).push(fn); }, scrollTo() {} },
  location: { hash: '#home' }, localStorage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, val) => storage.set(key, val), removeItem: key => storage.delete(key) },
  setTimeout: () => 1, clearTimeout() {}, crypto: { randomUUID: require('node:crypto').randomUUID }, confirm: () => true });
vm.runInContext(script, context);
const run = code => vm.runInContext(code, context);
function click(data, id = '') { const b = { dataset: data, id }; for (const fn of events.click ?? []) fn({ target: { closest: () => b } }); }
assert.equal(run('PROJECTS.length'), 23);
assert.equal(run('seedReviews.length'), 206);
assert.ok(run('seedPayouts.length') > 100);
assert.equal(run('ratingColor(2)'), '#e34b3f');
assert.equal(run('ratingColor(2.9)'), '#e34b3f');
assert.equal(run('ratingColor(3)'), '#ef941d');
assert.equal(run('ratingColor(3.9)'), '#ef941d');
assert.equal(run('ratingColor(4)'), '#00b67a');
assert.ok(run('stars(3.7)').includes('--rating-color:#ef941d'));
assert.ok(run("PROJECTS.filter(p => p.rug).every(p => stats(p).score < 2 && reviewsFor(p.id).every(r => !r.verified))"));
assert.ok(run("PROJECTS.some(p => !p.rug && stats(p).score >= 3 && stats(p).score < 4)"));
assert.ok(run("projectCard(projectById('moonexit'))").includes('Rug reports'));
assert.equal(run('new Set(seedReviews.map(r => r.rating)).size'), 5);
assert.ok(run('seedPayouts.every(p => seedReviews.some(r => r.id === p.review && r.wallet === p.wallet && r.verified))'));
run("query='PEPE'; chain='All'"); assert.equal(run('filteredProjects().length'), 2);
run("query=''; chain='Solana'"); assert.equal(run('filteredProjects().length'), 11);
run("chain='All'; projectSort='rating'"); assert.ok(run('stats(filteredProjects()[0]).score >= stats(filteredProjects().at(-1)).score'));
for (const route of ['home', 'projects', 'reviews', 'payouts', 'saved', 'my-reviews', 'how-it-works', ...run('PROJECTS.map(p => `project/${p.id}`)')]) {
  context.location.hash = '#' + route; run('page=1; render()'); assert.ok(element('main').innerHTML.length > 100, route);
}
click({ save: 'bonk' }); assert.ok(run("saved.includes('bonk')"));
click({ helpful: 'seed-bonk-0' }); assert.ok(run("liked.includes('seed-bonk-0')"));
element('walletButton').onclick(); click({}, 'connectPreview'); assert.ok(run("wallet.traded.includes('bonk')"));
run("openReview('bonk')"); element('reviewProject').value = 'bonk';
element('reviewName').value = '<script>Trader</script>'; element('reviewTitle').value = 'A thoughtful round-trip trade';
element('reviewText').value = 'I bought and sold a small position and found the community resources helpful.';
element('reviewForm').submit({ preventDefault() {} }); assert.ok(element('formError').textContent.includes('star'));
click({ star: '4' }); element('reviewForm').submit({ preventDefault() {} });
assert.equal(run('localReviews.length'), 1); assert.equal(run('localReviews[0].verified'), true);
assert.ok(storage.has('pumpilot-reviews')); assert.ok(run('reviewCard(localReviews[0])').includes('&lt;script&gt;'));
run("openReview('bonk')"); element('reviewProject').value = 'bonk'; click({ star: '2' });
element('reviewForm').submit({ preventDefault() {} }); assert.equal(run('localReviews.length'), 1);
assert.ok(element('formError').textContent.includes('already'));
run("openReview('dogecoin')"); element('reviewProject').value = 'dogecoin'; click({ star: '3' });
element('reviewForm').submit({ preventDefault() {} }); assert.equal(run('localReviews[1].verified'), false);
run("openPayout(localReviews[0].id)"); assert.ok(element('payoutContent').innerHTML.includes('No reward has been allocated'));
run("openPayout('seed-bonk-1')"); assert.ok(element('payoutContent').innerHTML.includes('SOL'));
run('starFilter=1; reviewSort="lowest"; page=1'); assert.ok(run('reviewList(seedReviews)').includes('1.0 out of 5'));
context.location.hash = '#projects'; run("query='unfindable'; render()"); assert.ok(element('main').innerHTML.includes('No projects match'));
// A fresh page session retains locally submitted reviews and wallet state.
const restored = vm.createContext({ ...context });
vm.runInContext(script, restored);
assert.equal(vm.runInContext('localReviews.length', restored), 2);
assert.equal(vm.runInContext('wallet.address', restored), run('wallet.address'));
console.log('PASS: 23 project pages, 206 reviews, rating color thresholds, rug scenarios, payout integrity, search, filters, sorting, saved projects, helpful votes, wallet eligibility, submission, duplicate protection, escaping and local persistence.');
