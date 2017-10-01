import Redux from 'redux'
import {PLAYER_DAMAGE_MULT} from '../../Constants'
import {Enemy, Loot} from '../../reducers/QuestTypes'
import {CombatDifficultySettings, CombatAttack} from './Types'
import {DifficultyType, SettingsType} from '../../reducers/StateTypes'
import {ParserNode, defaultContext} from '../Template'
import {toCard} from '../../actions/Card'
import {COMBAT_DIFFICULTY, PLAYER_TIME_MULT} from '../../Constants'
import {encounters} from '../../Encounters'
import {QuestNodeAction, remoteify} from '../../actions/ActionTypes'
import {loadNode} from '../../actions/Quest'

const cheerio: any = require('cheerio');

export function initCombat(node: ParserNode, settings: SettingsType, custom?: boolean) {
  return (dispatch: Redux.Dispatch<any>): any => {
    let tierSum: number = 0;
    let enemies: Enemy[] = [];
    if (node.elem) {
      enemies = getEnemies(node);
      for (const enemy of enemies) {
        tierSum += enemy.tier;
      }
    }
    node = node.clone();
    node.ctx.templates.combat = {
      custom: custom || false,
      enemies,
      roundCount: 0,
      numAliveAdventurers: settings.numPlayers,
      tier: tierSum,
      roundTimeMillis: settings.timerSeconds * 1000 * (PLAYER_TIME_MULT[settings.numPlayers] || 1),
      ...getDifficultySettings(settings.difficulty),
    };
    dispatch(toCard({name: 'QUEST_CARD', phase: 'DRAW_ENEMIES'}));
    dispatch({type: 'QUEST_NODE', node} as QuestNodeAction);
  };
}

export function initCustomCombat(settings: SettingsType) {
  return initCombat(new ParserNode(cheerio.load('<combat></combat>')('combat'), defaultContext()), settings, true);
}

function getDifficultySettings(difficulty: DifficultyType): CombatDifficultySettings {
  const result = COMBAT_DIFFICULTY[difficulty];
  if (result === null) {
    throw new Error('Unknown difficulty ' + difficulty);
  }
  return result;
}

function getEnemies(node: ParserNode): Enemy[] {
  const enemies: Enemy[] = [];
  node.loopChildren((tag, c) => {
    if (tag !== 'e') {
      return;
    }
    const text = c.text();
    const encounter = encounters[text.toLowerCase()];

    if (!encounter) {
      // If we don't know about the enemy, just assume tier 1.
      enemies.push({name: text, tier: parseInt(c.attr('tier'), 10) || 1});
    } else {
      enemies.push({name: encounter.name, tier: encounter.tier, class: encounter.class});
    }
  });
  return enemies;
}

function generateCombatAttack(node: ParserNode, settings: SettingsType, elapsedMillis: number): CombatAttack {
  const playerMultiplier = PLAYER_DAMAGE_MULT[settings.numPlayers] || 1;
  const combat = node.ctx.templates.combat;

  // enemies each get to hit once - 1.5x if the party took too long
  let attackCount = combat.tier;
  if (combat.roundTimeMillis - elapsedMillis < 0) {
    attackCount = attackCount * 1.5;
  }

  // If the fight's been going on for a while and there's only a tier 1 enemy left,
  // Slowly exponentially increase damage to prevent camping / exploiting game mechanics (like combat heals)
  // Rounds after 6th round: damage multiplier:
  // 1: 1.2
  // 2: 1.4
  // 3: 1.7
  // 4: 2
  // 5: 2.5
  // 6: 3
  if (combat.tier === 1 && combat.roundCount > 6) {
    attackCount = attackCount * Math.pow(1.2, combat.roundCount - 6);
  }

  // If the fight's been going on for a while and there's only one adventurer left (but more than one player IRL),
  // Slowly exponentially increase damage to prevent other players from getting bored
  // Rounds after 6th round: damage multiplier:
  // 1: 1.2
  // 2: 1.4
  // 3: 1.7
  // 4: 2
  // 5: 2.5
  // 6: 3
  if (combat.numAliveAdventurers === 1 && settings.numPlayers > 1 && combat.roundCount > 6) {
    attackCount = attackCount * Math.pow(1.2, combat.roundCount - 6);
  }

  // Attack once for each tier
  let damage = 0;
  attackCount = Math.round(attackCount);
  for (let i = 0; i < attackCount; i++) {
    damage += randomAttackDamage();
  }

  // Scale according to multipliers, then round to nearest whole number and cap at 10 damage/round
  damage = damage * combat.damageMultiplier * playerMultiplier;
  if (damage > 1) {
    damage = Math.round(damage);
  } else { // prevent endless 0's during low-tier, <4 player encounters
    damage = Math.ceil(damage);
  }
  damage = Math.min(10, damage);

  return {
    surge: isSurgeNextRound(node),
    damage,
  }
}

function generateLoot(maxTier: number): Loot[] {
  const loot: Loot[] = [
    {tier: 1, count: 0},
    {tier: 2, count: 0},
    {tier: 3, count: 0},
  ];

  // Apply logarithmic curve to loot rewards. Outcomes (tier: loot):
  // 1: 1
  // 2: 1
  // 3: 2
  // 4: 3
  // 5: 3
  // 6: 4
  // 7: 4
  // 8+: 5
  maxTier = Math.max(1, Math.round(Math.log(maxTier - 1) / Math.log(1.5)));

  while (maxTier > 0) {
    const r: number = Math.random();

    if (r < 0.1 && maxTier >= 3) {
      maxTier -= 3;
      loot[2].count++;
    } else if (r < 0.4 && maxTier >= 2) {
      maxTier -= 2;
      loot[1].count++;
    } else {
      maxTier -= 1;
      loot[0].count++;
    }
  }

  for (let i = loot.length-1; i >= 0; i--) {
    if (!loot[i].count) {
      loot.splice(i, 1);
    }
  }

  return loot;
}

function generateRolls(count: number): number[] {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * 20) + 1);
  }
  return rolls;
}

function randomAttackDamage() {
  // D = Damage per ddt (0, 1, or 2 discrete)
  // M = miss, H = hit, C = crit, P(M) + P(H) + P(C) = 1
  // E[D] = Expected damage for a single second
  // P(C) = 1/3 * P(H)
  // P(M) = 1 - 4/3 * P(H)
  // E[D] = 0 * P(M) + 1 * P(H) + 2 * P(C) = 0.9

  const r = Math.random();
  if (r < 0.35) {
    return 0;
  } else if (r < 0.45) {
    return 2;
  } else { // r >= 0.45
    return 1;
  }
};

export function isSurgeRound(rounds: number, surgePd: number): boolean {
  return (surgePd - ((rounds - 1) % surgePd + 1)) === 0;
}

export function isSurgeNextRound(node: ParserNode): boolean {
  const rounds = node.ctx.templates.combat.roundCount;
  const surgePd = node.ctx.templates.combat.surgePeriod;
  return isSurgeRound(rounds + 1, surgePd);
}

export function handleResolvePhase(node: ParserNode) {
  // Handles resolution, with a hook for if a <choice on="round"/> tag is specified.
  // Note that handling new combat nodes within a "round" handler has undefined
  // behavior and should be prevented when compiled.
  return (dispatch: Redux.Dispatch<any>): any => {
    node = node.clone();
    if (node.getVisibleKeys().indexOf('round') !== -1) {
      node.ctx.templates.combat.roleplay = node.getNext('round');
      // Set node *before* navigation to prevent a blank first roleplay card.
      dispatch({type: 'QUEST_NODE', node: node} as QuestNodeAction);
      dispatch(toCard({name: 'QUEST_CARD', phase: 'ROLEPLAY', overrideDebounce: true}));
    } else {
      dispatch(toCard({name: 'QUEST_CARD', phase: 'RESOLVE_ABILITIES', overrideDebounce: true}));
      dispatch({type: 'QUEST_NODE', node: node} as QuestNodeAction);
    }
  }
}

export function midCombatChoice(settings: SettingsType, parent: ParserNode, index: number) {
  return (dispatch: Redux.Dispatch<any>): any => {
    parent = parent.clone();
    const node = parent.ctx.templates.combat.roleplay;
    let next = node.getNext(index);

    // Check for and resolve non-goto triggers
    const tag = next && next.getTag();
    if (tag === 'trigger' && !next.elem.text().toLowerCase().startsWith('goto')) {

      // End the quest if end trigger
      const triggerName = next.elem.text().trim();
      if (triggerName === 'end') {
        return dispatch(toCard({name: 'QUEST_END'}));
      }

      next = next.handleTriggerEvent();

      // If the trigger exits via the win/lose handlers, load it as normal.
      // Otherwise, we're still in combat.
      const parentCondition = next.elem.parent().attr('on');
      if (parentCondition === 'win' || parentCondition === 'lose') {
        return dispatch(loadNode(settings, next));
      }
    }

    // Check if the next node is inside a combat node. Note that nested combat nodes are
    // not currently supported.
    let ptr = next && next.elem;
    while (ptr !== null && ptr.length > 0 && ptr.get(0).tagName.toLowerCase() !== 'combat') {
      ptr = ptr.parent();
    }

    // Check if we're still a child of the combat node or else doing something weird.
    if (!next || next.getTag() !== 'roleplay' || !ptr || ptr.length === 0) {
      // If so, then continue with the resolution phase.
      parent.ctx.templates.combat.roleplay = null;
      dispatch(toCard({name: 'QUEST_CARD', phase: 'RESOLVE_ABILITIES', overrideDebounce: true}));
    } else {
      // Otherwise continue the roleplay phase.
      parent.ctx.templates.combat.roleplay = next;
      dispatch(toCard({name: 'QUEST_CARD', phase: 'ROLEPLAY', overrideDebounce: true}));
    }
    dispatch({type: 'QUEST_NODE', node: parent} as QuestNodeAction);
  };
}

export function handleCombatTimerStop(node: ParserNode, settings: SettingsType, elapsedMillis: number) {
  return (dispatch: Redux.Dispatch<any>): any => {
    node = node.clone();
    node.ctx.templates.combat.mostRecentAttack = generateCombatAttack(node, settings, elapsedMillis);
    node.ctx.templates.combat.mostRecentRolls = generateRolls(settings.numPlayers);
    node.ctx.templates.combat.roundCount++;

    if (node.ctx.templates.combat.mostRecentAttack.surge) {
      // Since we always skip the previous card (the timer) when going back,
      // We can preset the quest node here. This populates context in a way that
      // the latest round is considered when the "on round" branch is evaluated.
      dispatch({type: 'QUEST_NODE', node: node} as QuestNodeAction);
      dispatch(toCard({name: 'QUEST_CARD', phase: 'SURGE', overrideDebounce: true}));

    } else {
      dispatch(handleResolvePhase(node));
    }
  };
}

interface HandleCombatEndArgs {
  node?: ParserNode;
  serializedNode?: ParserNode;
  settings: SettingsType;
  victory: boolean;
  maxTier: number;
}
export const handleCombatEnd = remoteify(function handleCombatEnd(a: HandleCombatEndArgs, dispatch: Redux.Dispatch<any>) {
  if (a.serializedNode) {
    console.error('Unimplemented: remote play combat end deserialization');
  }

  // Edit the final card before cloning
  if (a.victory) {
    a.node.ctx.templates.combat.tier = 0;
  } else {
    a.node.ctx.templates.combat.numAliveAdventurers = 0;
  }
  a.node = a.node.clone();
  a.node.ctx.templates.combat.levelUp = (a.victory) ? (a.settings.numPlayers <= a.maxTier) : false;
  a.node.ctx.templates.combat.loot = (a.victory) ? generateLoot(a.maxTier) : [];

  dispatch(toCard({name: 'QUEST_CARD', phase: (a.victory) ? 'VICTORY' : 'DEFEAT',  overrideDebounce: true}));
  dispatch({type: 'QUEST_NODE', node: a.node} as QuestNodeAction);

  return {...a, serializedNode: a.node.getComparisonKey(), node: null};
});

export function tierSumDelta(node: ParserNode, current: number, delta: number): QuestNodeAction {
  node = node.clone();
  node.ctx.templates.combat.tier = Math.max(current + delta, 0);
  return {type: 'QUEST_NODE', node};
}

export function adventurerDelta(node: ParserNode, settings: SettingsType, current: number, delta: number): QuestNodeAction {
  const newAdventurerCount = Math.min(Math.max(0, current + delta), settings.numPlayers);
  node = node.clone();
  node.ctx.templates.combat.numAliveAdventurers = newAdventurerCount;
  return {type: 'QUEST_NODE', node};
}
