// Bug roulette: selection rules and each bug's effect on the player.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({ Math, console });
for (const file of ['Player', 'BugRoulette']) vm.runInContext(fs.readFileSync(path.join(root, `js/${file}.js`), 'utf8'), ctx);
const Player = vm.runInContext('Player', ctx);
const BugRoulette = vm.runInContext('BugRoulette', ctx);
const skin = { color: '#ff5a5a' };
const make = id => { const p = new Player(skin, {}, 1000, 1000); p.setBug(BugRoulette.get(id)); return p; };
const step = (p, input, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) p.update(input, 1 / 60, 5000); };
const right = { active: true, dx: 1, dy: 0, ratio: 1 };
const idle = { active: false, dx: 0, dy: 0, ratio: 0 };

assert.deepEqual([...BugRoulette.BUGS.map(b => b.id)], ['mini', 'giant', 'confuse', 'slippery', 'none']);
assert.equal(BugRoulette.enabledFor(1), false, 'Stages 1-3 have no bug roulette');
assert.equal(BugRoulette.enabledFor(3), false);
assert.equal(BugRoulette.enabledFor(4), true);
assert.equal(BugRoulette.enabledFor(20), true);
assert.equal(BugRoulette.pick(() => 0).id, 'mini');
assert.equal(BugRoulette.pick(() => 0.9999).id, 'none');
assert.equal(BugRoulette.pick(() => 0.7).id, 'slippery');

const normal = new Player(skin, {}, 1000, 1000);
const mini = make('mini'), giant = make('giant');
assert.ok(mini.bodyR < normal.bodyR && mini.mouthRadius < normal.mouthRadius);
assert.ok(giant.bodyR > normal.bodyR && giant.mouthRadius > normal.mouthRadius);
assert.ok(mini.moveSpeed > normal.moveSpeed);
assert.equal(normal.eatScale, 1);
assert.equal(mini.eatScale, 1, 'Small Cosmii can still eat level-1 items');
assert.equal(giant.eatScale, 2, 'Big Cosmii eats one size tier higher');

const confused = make('confuse');
step(confused, right, 0.5);
assert.ok(confused.x < 1000, 'Confusion reverses the controls');
step(normal, right, 0.5);
assert.ok(normal.x > 1000);

const slippery = make('slippery');
step(slippery, right, 0.1);
const early = slippery.x - 1000;
const plain = new Player(skin, {}, 1000, 1000);
step(plain, right, 0.1);
assert.ok(early < plain.x - 1000, 'Slippery accelerates slowly');
step(slippery, right, 1);
const released = slippery.x;
step(slippery, idle, 0.5);
assert.ok(slippery.x > released + 50, 'Slippery keeps sliding after release');
step(slippery, idle, 10);
const stopped = slippery.x;
step(slippery, idle, 1);
assert.ok(Math.abs(slippery.x - stopped) < 5, 'Sliding eventually stops');
// Walls stop sliding instead of pinning velocity forever.
const wall = make('slippery'); wall.x = 4990;
step(wall, right, 1); step(wall, idle, 0.2);
assert.equal(wall.vx, 0);
// Clearing the bug restores normal play.
giant.setBug(null);
assert.equal(giant.bodyR, normal.bodyR);
// Wheel: always lands on the chosen bug under the top pointer, with peg clicks in sync.
const mod = (a, n) => ((a % n) + n) % n;
for (const bug of BugRoulette.BUGS) {
  for (const r of [0, 0.5, 0.99]) {
    const plan = BugRoulette.wheelPlan(bug, () => r);
    const step = 360 / BugRoulette.BUGS.length;
    // Angle of the top pointer in wheel coordinates must fall inside the bug's segment.
    const atPointer = mod(-plan.final, 360);
    assert.equal(Math.floor(atPointer / step), BugRoulette.BUGS.indexOf(bug), `${bug.id} lands under the pointer`);
    assert.ok(Math.abs(atPointer - (plan.index * step + step / 2)) <= 30, 'Never on a segment edge');
    assert.equal(BugRoulette.wheelAngle(plan, 0), plan.start);
    assert.equal(BugRoulette.wheelAngle(plan, BugRoulette.SPIN), plan.final);
    assert.equal(plan.final - plan.start, BugRoulette.TURN_DEG);
    // The baked click track assumes pegs cross the pointer at 15, 45, 75... degrees of travel.
    assert.equal(mod(plan.start, BugRoulette.PEG_DEG), 15);
  }
}
const mid = BugRoulette.wheelPlan(BugRoulette.BUGS[0], () => 0.5);
assert.ok(BugRoulette.wheelAngle(mid, 1.3) - mid.start > BugRoulette.TURN_DEG * 0.8, 'Fast start, slow finish');
console.log('PASS: bug roulette selection, mini/giant size + eat tier, confusion, slippery inertia and walls.');
