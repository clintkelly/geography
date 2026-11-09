import { describe, expect, it } from 'vitest';
import { PACK } from '../content/pack';
import { LODGES } from '../content/lodges';
import { canUse, enemyIntent, isBossTurn, resolveTurn, startCombat, type CombatAction } from './combat';
import { canTame, isExpeditionComplete, knownSpecies, newSave, reduce, type Command, type SaveData } from './game';
import { BRAIN_SHIELD, kaijuAlert, kaijuOf, lodgeDifficulty, lodgeFoeStats, lodgeOpen, nextLodge } from './lodges';
import { speciesOf, STAGES, stageOf, xpForLevel, type StageStats } from './progression';
import { Rng } from './rng';
import { trackFor } from '../ui/music';

const NOW = 1_800_000_000_000;
const step = (s: SaveData, cmd: Command) => reduce(s, cmd, PACK, NOW);
const fresh = (profile = 'p1') => newSave(PACK, 7, profile);

function answer(s: SaveData, correct: boolean): SaveData {
  const q = s.expedition!.battle!.question;
  const wrong = q.inputType === 'typed' ? '-987654' : q.options.find((o) => o.id !== q.acceptedId)!.id;
  return step(s, { type: 'answer', optionId: correct ? q.acceptedId : wrong });
}

/** Answers a Lodge quiz: right until `misses` wrong ones are used up. */
function takeQuiz(s: SaveData, misses = 0): SaveData {
  let next = s;
  let left = misses;
  while (next.lodgeQuiz && !next.lodgeQuiz.outcome) {
    const q = next.lodgeQuiz.questions[next.lodgeQuiz.index]!;
    const right = left-- <= 0;
    const wrong = q.inputType === 'typed' ? '-987654' : q.options.find((o) => o.id !== q.acceptedId)!.id;
    next = step(step(next, { type: 'lodgeQuizAnswer', optionId: right ? q.acceptedId : wrong }), { type: 'lodgeQuizNext' });
  }
  return next;
}

/** Plays a whole Lodge with every answer right, and returns the save before claiming. */
function playLodge(s: SaveData, lodgeId: string, seen: string[] = [], tier: 'bronze' | 'silver' | 'gold' = 'bronze'): SaveData {
  let next = step(takeQuiz(step(s, { type: 'startLodge', lodgeId, tier })), { type: 'depart' });
  while (!isExpeditionComplete(next.expedition!)) {
    if (next.expedition!.retreated) throw new Error(`lost in ${lodgeId}`);
    next = step(next, { type: 'enterEncounter' });
    while (next.expedition!.battle) {
      seen.push(next.expedition!.battle.question.topic ?? '');
      next = step(answer(step(next, { type: 'chooseAction', action: 'attack' }), true), { type: 'continue' });
    }
  }
  return next;
}
const beat = (s: SaveData, lodgeId: string, tier: 'bronze' | 'silver' | 'gold' = 'bronze') => step(playLodge(s, lodgeId, [], tier), { type: 'claimReward' });
/** A child with a fully grown lead creature. */
const strong = (s = fresh()): SaveData => ({ ...s, companions: s.companions.map((c) => ({ ...c, bondXp: xpForLevel(10), stageSeen: 3 })) });

describe('Ranger Lodges content', () => {
  it('has eight Lodges in rank order, each with its own type, then the League', () => {
    const notKaiju = LODGES.filter((l) => !l.kaiju);
    expect(notKaiju.map((l) => l.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(notKaiju.at(-1)!.gauntlet).toBeDefined();
    const ladder = LODGES.filter((l) => !l.gauntlet && !l.kaiju);
    expect(new Set(ladder.map((l) => l.type)).size).toBe(ladder.length);
    expect(new Set(LODGES.map((l) => l.prizeSpeciesId)).size).toBe(LODGES.length);
  });

  it('every ranger fields creatures of the Lodge type, and the prize is that type too', () => {
    for (const l of LODGES.filter((o) => !o.gauntlet && !o.kaiju)) {
      for (const f of [...l.juniors, ...l.team]) {
        const sp = speciesOf(PACK, f.speciesId);
        expect(sp, f.speciesId).toBeDefined();
        expect(sp.type, `${l.id}: ${f.speciesId}`).toBe(l.type);
        if (f.stage > 1) expect(sp.evolutions?.[f.stage - 2], f.speciesId).toBeDefined();
      }
      const prize = speciesOf(PACK, l.prizeSpeciesId);
      expect(prize.type, l.id).toBe(l.type);
      // Prizes live nowhere else.
      expect(prize.homes, l.id).toEqual([]);
      expect(prize.subject, l.id).toBeUndefined();
    }
  });

  it('prize creatures are new animals, not already in the game', () => {
    const prizes = new Set(LODGES.map((l) => l.prizeSpeciesId));
    const others = PACK.species.filter((o) => !prizes.has(o.id)).map((o) => o.displayName);
    for (const id of prizes) expect(others).not.toContain(speciesOf(PACK, id).displayName);
  });

  it('gets harder up the ladder', () => {
    for (const role of ['junior', 'leader', 'ace'] as const) {
      const hp = LODGES.filter((l) => !l.kaiju).map((l) => lodgeFoeStats(l.rank, role, 1).opponentMaxHp);
      expect(hp).toEqual([...hp].sort((a, b) => a - b));
    }
    const ladder = LODGES.filter((l) => !l.kaiju);
    expect(ladder.map((l) => l.recommendedLevel)).toEqual([...ladder.map((l) => l.recommendedLevel)].sort((a, b) => a - b));
    expect(lodgeDifficulty(LODGES[0]!, { minDifficulty: 'scout', maxDifficulty: 'expert' })).toBe('scout');
    expect(lodgeDifficulty(LODGES[7]!, { minDifficulty: 'scout', maxDifficulty: 'expert' })).toBe('expert');
    // A parent's limits still apply.
    expect(lodgeDifficulty(LODGES[7]!, { minDifficulty: 'scout', maxDifficulty: 'ranger' })).toBe('ranger');
  });
});

describe('Ranger Lodges play', () => {
  it('plays the Lodge hall, leader and Summit themes', () => {
    let s = step(step(fresh(), { type: 'startLodge', lodgeId: 'wildwood' }), { type: 'depart' });
    expect(trackFor(s)).toBe('lodge');
    s = step(s, { type: 'enterEncounter' });
    expect(trackFor(s)).toBe('battle');
    const e = s.expedition!;
    const leader = e.slots.map((o, i) => (i === e.battle!.slotIndex ? { ...o, role: 'leader' as const } : o));
    expect(trackFor({ ...s, expedition: { ...e, slots: leader } })).toBe('leader');
    expect(trackFor({ ...s, expedition: { ...e, slots: leader, lodgeId: 'summit' } })).toBe('summit');
    expect(trackFor(playLodge(fresh(), 'wildwood'))).toBe('victory');
  });

  it('must be beaten in order', () => {
    const s = fresh();
    expect(lodgeOpen(PACK, [], 'wildwood')).toBe(true);
    expect(lodgeOpen(PACK, [], 'banner')).toBe(false);
    expect(step(s, { type: 'startLodge', lodgeId: 'banner' })).toBe(s);
    expect(nextLodge(PACK, [])?.id).toBe('wildwood');
  });

  it('asks only about its subject, and its creatures can\'t be befriended or turn rare', () => {
    const topics: string[] = [];
    const done = playLodge(fresh(), 'wildwood', topics);
    expect(new Set(topics)).toEqual(new Set(['animal']));
    expect(done.expedition!.slots.every((x) => !x.rare)).toBe(true);
    expect(done.expedition!.slots.map((x) => x.trainer)).toEqual(['Junior Ranger Milo', 'Junior Ranger June', 'Ranger Hazel', 'Ranger Hazel']);
    expect(done.expedition!.discovery).toBe('found');
  });

  it('never offers Bold Befriend', () => {
    let s = step(step(step(fresh(), { type: 'startLodge', lodgeId: 'wildwood' }), { type: 'depart' }), { type: 'enterEncounter' });
    s = { ...s, expedition: { ...s.expedition!, battle: { ...s.expedition!.battle!, combat: { ...s.expedition!.battle!.combat, charge: 2, opponentHp: 1 } } } };
    expect(canTame(s, s.expedition!.battle!, s.expedition!.slots[0]!)).toBe(false);
  });

  it('a win gives the prize creature once, a patch, and opens the next Lodge', () => {
    const won = beat(fresh(), 'wildwood');
    expect(won.lodgesBeaten).toEqual(['wildwood']);
    expect(won.companions.map((c) => c.speciesId)).toContain('rustlepaw');
    expect(won.lastSummary).toMatchObject({ lodgeId: 'wildwood', prizeId: 'rustlepaw' });
    expect(won.badges).toContain('lodge-first');
    expect(nextLodge(PACK, won.lodgesBeaten!)?.id).toBe('banner');
    expect(won.expedition).toBeNull();

    // A rematch earns XP but no second prize.
    const again = beat(won, 'wildwood');
    expect(again.companions.filter((c) => c.speciesId === 'rustlepaw')).toHaveLength(1);
    expect(again.lodgesBeaten).toEqual(['wildwood']);
    expect(again.lastSummary?.prizeId).toBeUndefined();
  });

  it('keeps each explorer\'s Lodges separate', () => {
    const one = beat(fresh('p1'), 'wildwood');
    const two = fresh('p2');
    expect(one.lodgesBeaten).toEqual(['wildwood']);
    expect(two.lodgesBeaten ?? []).toEqual([]);
    expect(step(two, { type: 'startLodge', lodgeId: 'banner' })).toBe(two);
  });

  it('the whole ladder can be climbed', () => {
    // The Summit needs a Gold math patch, which has its own test below.
    let s: SaveData = { ...strong(), lodgeTiers: { gearworks: 'gold' } };
    for (const l of LODGES.filter((o) => !o.kaiju)) {
      s = beat(s, l.id);
      expect(s.lodgesBeaten, l.id).toContain(l.id);
    }
    expect(nextLodge(PACK, s.lodgesBeaten!)).toBeUndefined();
    expect(s.badges).toContain('grand-ranger');
    for (const l of LODGES.filter((o) => !o.kaiju)) expect(s.companions.some((c) => c.speciesId === l.prizeSpeciesId), l.id).toBe(true);
  });

  it('a loss keeps your place, so you can try that battle again', () => {
    let s = step(step(step(fresh(), { type: 'startLodge', lodgeId: 'wildwood' }), { type: 'depart' }), { type: 'enterEncounter' });
    while (s.expedition!.battle) s = step(answer(step(s, { type: 'chooseAction', action: 'attack' }), false), { type: 'continue' });
    expect(s.expedition!.retreated).toBe(true);
    expect(s.expedition!.slots[0]!.status).toBe('pending');
    expect(step(s, { type: 'enterEncounter' }).expedition!.battle).not.toBeNull();
  });
});

/** One creature, playing simply: Special when charged, Guard against a boss's big hit, otherwise Attack. */
function winRate(rank: number, role: 'junior' | 'leader' | 'ace', stats: StageStats, accuracy: number, runs = 3000, shield = 0): number {
  const rng = new Rng(rank * 100 + accuracy * 10);
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    let c = startCombat({ playerMaxHp: stats.maxHp, playerAttack: stats.attack, special: 'strong', specialBonus: stats.specialBonus, ...lodgeFoeStats(rank, role, 1, role === 'junior' ? 0 : shield) });
    c = { ...c, charge: stats.startCharge };
    while (c.outcome === 'active') {
      const action: CombatAction = canUse(c, 'special') ? 'special' : isBossTurn(c) || enemyIntent(c) >= c.playerHp ? 'guard' : 'attack';
      c = resolveTurn(c, action, rng.next() < accuracy).state;
    }
    if (c.outcome === 'victory') wins++;
  }
  return wins / runs;
}

describe('Lodge balance', () => {
  const recommended = (level: number) => STAGES[stageOf(xpForLevel(level))];
  it('is fair at the recommended level for a child who knows most answers', () => {
    const table = LODGES.map((l) => {
      const st = recommended(l.recommendedLevel);
      const sh = l.shield ? BRAIN_SHIELD : 0;
      return { lodge: l.id, junior: winRate(l.rank, 'junior', st, 0.8), leader: winRate(l.rank, 'leader', st, 0.8, 3000, sh), ace: winRate(l.rank, 'ace', st, 0.8, 3000, sh) };
    });
    console.table(table);
    for (const row of table) {
      expect(row.junior, row.lodge).toBeGreaterThan(0.85);
      expect(row.ace, row.lodge).toBeGreaterThan(0.5);
    }
  });

  it('is hard to win with an under-leveled creature high up the ladder', () => {
    expect(winRate(8, 'ace', STAGES[1], 0.8)).toBeLessThan(0.35);
  });
});

describe('Lodge gates, shields and tiers', () => {
  const upTo = (id: string) => ({ ...strong(), lodgesBeaten: LODGES.filter((l) => l.rank < LODGES.find((o) => o.id === id)!.rank).map((l) => l.id) });

  it('the math Lodge opens with a gate quiz: 6 of 8 to get in, and a retry after a miss too many', () => {
    const s = step(upTo('gearworks'), { type: 'startLodge', lodgeId: 'gearworks' });
    expect(s.expedition).toBeNull();
    expect(s.lodgeQuiz).toMatchObject({ kind: 'gate', lodgeId: 'gearworks' });
    expect(s.lodgeQuiz!.questions).toHaveLength(8);
    expect(new Set(s.lodgeQuiz!.questions.map((q) => q.topic))).toEqual(new Set(['math']));
    const failed = takeQuiz(s, 3);
    expect(failed.lodgeQuiz!.outcome).toBe('failed');
    expect(failed.expedition).toBeNull();
    const passed = takeQuiz(step(step(failed, { type: 'closeLodgeQuiz' }), { type: 'startLodge', lodgeId: 'gearworks' }), 2);
    expect(passed.lodgeQuiz).toBeNull();
    expect(passed.expedition).toMatchObject({ lodgeId: 'gearworks', gateScore: { right: 6, of: 8 } });
  });

  it('the leader in a math Lodge has a Brain Shield that soaks three right answers', () => {
    let s = step(takeQuiz(step(upTo('gearworks'), { type: 'startLodge', lodgeId: 'gearworks' })), { type: 'depart' });
    const e = s.expedition!;
    s = { ...s, expedition: { ...e, slots: e.slots.map((o) => (o.role === 'junior' ? { ...o, status: 'won' as const } : o)) } };
    s = step(s, { type: 'enterEncounter' });
    expect(s.expedition!.battle!.combat.shield).toBe(3);
    const hp = s.expedition!.battle!.combat.opponentHp;
    s = answer(step(s, { type: 'chooseAction', action: 'attack' }), true);
    expect(s.expedition!.battle!.combat).toMatchObject({ shield: 2, opponentHp: hp });
    expect(s.expedition!.battle!.result!.events.shieldHit).toBe(true);
  });

  it('Silver opens after Bronze and lays a rare egg; Gold battles lead to a 90% Mastery Test', () => {
    let s = beat(strong(), 'wildwood');
    expect(lodgeOpen(PACK, s, 'wildwood', 'silver')).toBe(true);
    expect(lodgeOpen(PACK, s, 'wildwood', 'gold')).toBe(false);
    expect(step(s, { type: 'startLodge', lodgeId: 'wildwood', tier: 'gold' })).toBe(s);
    s = beat(s, 'wildwood', 'silver');
    expect(s.lodgeTiers).toEqual({ wildwood: 'silver' });
    expect(s.eggs?.map((e) => e.kind)).toEqual(['rare']);
    expect(s.lastSummary).toMatchObject({ newPatch: 'silver', eggLaid: 'rare' });

    s = beat(s, 'wildwood', 'gold');
    expect(s.lodgeTestReady).toEqual(['wildwood']);
    expect(s.lodgeQuiz).toMatchObject({ kind: 'mastery', difficulty: 'expert' });
    expect(s.lodgeQuiz!.questions).toHaveLength(10);
    // Two misses is 80%: not enough. The test can be taken again.
    const failed = takeQuiz(s, 2);
    expect(failed.lodgeQuiz!.outcome).toBe('failed');
    expect(failed.lodgeTiers).toEqual({ wildwood: 'silver' });
    const retake = step(step(failed, { type: 'closeLodgeQuiz' }), { type: 'startLodgeTest', lodgeId: 'wildwood' });
    // One miss is 90%: Gold.
    const gold = takeQuiz(retake, 1);
    expect(gold.lodgeQuiz!.outcome).toBe('passed');
    expect(gold.lodgeTiers).toEqual({ wildwood: 'gold' });
    expect(gold.lodgeTestReady).toEqual([]);
    expect(gold.companions.some((c) => c.speciesId === 'qiloom')).toBe(true);
    expect(gold.companions.some((c) => c.speciesId === 'rustlepaw' && c.shiny)).toBe(true);
    expect(gold.lastSummary).toMatchObject({ newPatch: 'gold', lodgeId: 'wildwood' });
    expect(step(gold, { type: 'startLodgeTest', lodgeId: 'wildwood' }).lodgeQuiz?.outcome).toBe('passed');
  });

  it('the Summit needs a Gold math patch', () => {
    const below = upTo('summit');
    expect(lodgeOpen(PACK, below, 'summit')).toBe(false);
    expect(lodgeOpen(PACK, { ...below, lodgeTiers: { gearworks: 'gold' } }, 'summit')).toBe(true);
  });
});


describe('Starfall League', () => {
  const lodgesOnly = LODGES.filter((l) => !l.gauntlet && !l.kaiju).map((l) => l.id);
  const champ = (): SaveData => ({ ...strong(), lodgesBeaten: lodgesOnly });

  it('opens only once all eight Lodges are beaten, and has no Silver or Gold', () => {
    expect(lodgeOpen(PACK, { lodgesBeaten: lodgesOnly.slice(0, 7) }, 'league')).toBe(false);
    expect(lodgeOpen(PACK, { lodgesBeaten: lodgesOnly }, 'league')).toBe(true);
    expect(lodgeOpen(PACK, { lodgesBeaten: [...lodgesOnly, 'league'] }, 'league', 'silver')).toBe(false);
    expect(nextLodge(PACK, lodgesOnly)).toBeUndefined();
  });

  it('runs four Elite Rangers then the Champion; each Elite gives a star creature, the Champion a last one and a Hall of Fame entry', () => {
    let s = step(champ(), { type: 'startLodge', lodgeId: 'league' });
    const slots = s.expedition!.slots;
    expect(slots).toHaveLength(11);
    expect(slots.filter((o) => o.prize).map((o) => o.prize)).toEqual(['solarion', 'delphinova', 'ursastar', 'dracostar']);
    expect(slots.at(-1)).toMatchObject({ trainer: 'Champion Celeste', role: 'ace', power: 11 });
    s = step(s, { type: 'depart' });
    const prizes: string[] = [];
    while (!isExpeditionComplete(s.expedition!)) {
      if (s.expedition!.retreated) throw new Error('lost in the League');
      s = step(s, { type: 'enterEncounter' });
      while (s.expedition!.battle) {
        s = answer(step(s, { type: 'chooseAction', action: 'attack' }), true);
        const won = s.expedition!.battle?.result?.prize;
        if (won) prizes.push(won);
        s = step(s, { type: 'continue' });
      }
    }
    expect(prizes).toEqual(['solarion', 'delphinova', 'ursastar', 'dracostar']);
    s = step(s, { type: 'claimReward' });
    expect(s.companions.map((c) => c.speciesId)).toEqual(expect.arrayContaining(['solarion', 'delphinova', 'ursastar', 'dracostar', 'cosmobill']));
    expect(s.lodgesBeaten).toContain('league');
    expect(s.hallOfFame).toHaveLength(1);
    expect(s.hallOfFame![0]!.team.length).toBeGreaterThan(0);
  });

  it('is beatable with a fully grown creature that knows most answers', () => {
    const grown = STAGES[stageOf(xpForLevel(12))];
    // The Elite Rangers are fair; the Champion is the hardest fight in the game, and can be retried.
    for (const power of [9, 10]) expect(winRate(power, 'ace', grown, 0.8), `power ${power}`).toBeGreaterThan(0.5);
    expect(winRate(11, 'ace', grown, 0.8)).toBeGreaterThan(0.3);
    expect(winRate(11, 'ace', grown, 0.9)).toBeGreaterThan(0.55);
  });
});

describe('Kaiju Alerts', () => {
  it('twelve original kaiju threaten real cities, easiest first, and none are on the Lodge ladder', () => {
    const all = kaijuOf(PACK);
    expect(all.map((l) => l.kaiju!.threat)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const l of all) expect(PACK.places.some((p) => p.id === l.kaiju!.placeId), l.id).toBe(true);
    expect(kaijuAlert(PACK, [], '2026-11-06')!.id).toBe('kaiju-quakeback');
    expect(kaijuAlert(PACK, ['kaiju-quakeback'], '2026-11-06')!.id).toBe('kaiju-tidalorn');
    const everyone = all.map((l) => l.id);
    expect(everyone).toContain(kaijuAlert(PACK, everyone, '2026-11-07')!.id);
    expect(nextLodge(PACK, [])!.id).toBe('wildwood');
  });

  it("three phases against the giant, questions from its city's region, and a baby kaiju joins the first time", () => {
    let s = step(strong(), { type: 'startLodge', lodgeId: 'kaiju-tidalorn' });
    const e = s.expedition!;
    expect(e.regionId).toBe('asia-east');
    expect(e.slots.map((o) => [o.opponentId, o.opponentStage, o.role])).toEqual([['tidalorn', 3, 'leader'], ['tidalorn', 3, 'leader'], ['tidalorn', 3, 'ace']]);
    expect(step(s, { type: 'startLodge', lodgeId: 'kaiju-tidalorn', tier: 'silver' })).toBe(s);
    s = step(s, { type: 'depart' });
    const regions = new Set<string>();
    while (!isExpeditionComplete(s.expedition!)) {
      if (s.expedition!.retreated) throw new Error('lost to the kaiju');
      s = step(s, { type: 'enterEncounter' });
      while (s.expedition!.battle) {
        const q = s.expedition!.battle.question;
        if (q.regionId) regions.add(q.regionId);
        s = step(answer(step(s, { type: 'chooseAction', action: 'attack' }), true), { type: 'continue' });
      }
    }
    expect([...regions]).toEqual(['asia-east']);
    s = step(s, { type: 'claimReward' });
    expect(s.companions.some((c) => c.speciesId === 'tidalorn')).toBe(true);
    expect(s.lodgesBeaten).toContain('kaiju-tidalorn');
  });

  it('every kaiju win, rematches too, leaves another baby', () => {
    const win = (s: SaveData) => {
      let n = step(step(s, { type: 'startLodge', lodgeId: 'kaiju-quakeback' }), { type: 'depart' });
      while (!isExpeditionComplete(n.expedition!)) {
        n = step(n, { type: 'enterEncounter' });
        while (n.expedition!.battle) n = step(answer(step(n, { type: 'chooseAction', action: 'attack' }), true), { type: 'continue' });
      }
      return step(n, { type: 'claimReward' });
    };
    const twice = win(win(strong()));
    expect(twice.companions.filter((c) => c.speciesId === 'quakeback')).toHaveLength(2);
    expect(twice.lastSummary!.prizeId).toBe('quakeback');
  });

  it('one payment buys five Kaiju Radar rolls for the day, and any kaiju the radar found can be picked', () => {
    const day = '2026-11-06';
    const base = strong();
    // No points and nothing to trade: no radar.
    expect(step(base, { type: 'rerollKaiju', day, pay: 'points' })).toBe(base);
    let s: SaveData = { ...base, bankedPoints: 5 };
    s = step(s, { type: 'rerollKaiju', day, pay: 'points' });
    expect(s.bankedPoints).toBe(2);
    expect(s.kaijuRadar).toMatchObject({ day, rollsLeft: 4 });
    expect(kaijuAlert(PACK, [], day, s.kaijuReroll)!.id).not.toBe('kaiju-quakeback');
    // The other four rolls are free, and each finds a new kaiju.
    for (let i = 0; i < 4; i++) s = step(s, { type: 'rerollKaiju', day, pay: 'points' });
    expect(s.bankedPoints).toBe(2);
    expect(s.kaijuRadar!.rollsLeft).toBe(0);
    expect(new Set(s.kaijuRadar!.seen).size).toBe(6);
    // Pick any of them; one it never found can't be picked.
    const found = s.kaijuRadar!.seen.find((id) => id !== s.kaijuReroll!.lodgeId)!;
    const unseen = kaijuOf(PACK).find((l) => !s.kaijuRadar!.seen.includes(l.id))!.id;
    const picked = step(s, { type: 'pickKaiju', day, lodgeId: found });
    expect(kaijuAlert(PACK, [], day, picked.kaijuReroll)!.id).toBe(found);
    expect(step(s, { type: 'pickKaiju', day, lodgeId: unseen }).kaijuReroll).toEqual(s.kaijuReroll);
    // Tomorrow the radar and the reroll are gone.
    expect(kaijuAlert(PACK, [], '2026-11-07', picked.kaijuReroll)!.id).toBe('kaiju-quakeback');
  });

  it('the radar can be paid for with a trade from the Wild, never losing a kind or a shiny', () => {
    const day = '2026-11-06';
    const base = strong();
    const wild = [
      { instanceId: 'w1', speciesId: 'slatepaw', bondXp: 0 },
      { instanceId: 'w2', speciesId: 'slatepaw', bondXp: 0 },
      { instanceId: 'w3', speciesId: 'lobsnap', bondXp: 0 },
      { instanceId: 'w4', speciesId: 'slatepaw', bondXp: 0, shiny: true },
    ];
    const traded = step({ ...base, wild }, { type: 'rerollKaiju', day, pay: 'wild' });
    expect(traded.wild!.map((c) => c.instanceId).sort()).toEqual(['w3', 'w4']);
    expect(knownSpecies(traded).has('slatepaw')).toBe(true);
    expect(traded.kaijuRadar!.rollsLeft).toBe(4);
    expect(step({ ...base, wild: wild.slice(2) }, { type: 'rerollKaiju', day, pay: 'wild' }).kaijuRadar).toBeUndefined();
  });

});

