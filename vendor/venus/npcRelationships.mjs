// Adapted from Venus University shared/npcRelationships.ts
// Snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE and NOTICE.md.
                                                  
const hasTrait=(character,trait)=>Boolean(character?.traits?.includes(trait));

/**
 * How the roster feels about *each other* — the pair map, its zones, and every roll
 * that moves one.
 */

/** The band an affinity falls in. Strangers are the absence of an entry, not a band. */
                                                       

/** The affinity a pair can hold, inclusive both ends. */
export const MIN_AFFINITY = -6
export const MAX_AFFINITY = 6

/** At or above is friends; at or below `-FRIENDS_AT` is enemies. */
const FRIENDS_AT = 4

/** The widest an affinity rolled at a first off-screen meeting can be. */
const MEETING_SPREAD = 4

/** What one pair did together, and how it went — at most one, newest overwriting. */
                               
                                                                                
              
                                    
     
                                                                                      
                
     
             
                                                                               
                   
                                                                           
                 
 

/** One pair's standing. */
                                  
                                                                 
                  
                          
 

/** Keyed by {@link pairKeyOf} — one entry per unordered pair, never two. */
                                                                

/** A set of characters spending one slot in one place. */
                           
                                                                     
                  
                                                                                
               
                                                                            
                   
 

/** Who is with whom this slot, stamped with the slot it was rolled for. */
                                 
                                 
              
                
                    
     
                                                                                         
                                
     
                   
 

/** The key for one unordered pair: sorted, so `(a, b)` and `(b, a)` are one entry. */
export function pairKeyOf(a        , b        )         {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Holds an affinity inside the range; a step off either end is simply the end. */
function clampAffinity(affinity        )         {
  return Math.max(MIN_AFFINITY, Math.min(MAX_AFFINITY, Math.round(affinity)))
}

/** Which band an affinity sits in. */
export function zoneOf(affinity        )          {
  if (affinity >= FRIENDS_AT) return 'friends'
  if (affinity <= -FRIENDS_AT) return 'enemies'
  return 'neutral'
}

/** The pair's standing, or `undefined` for two strangers. */
export function npcPairOf(
  map                                ,
  a        ,
  b        
)                              {
  return map?.[pairKeyOf(a, b)]
}

/** Are these two friends? The one test the hangout passes are built on. */
export function areNpcFriends(map                                , a        , b        )          {
  const pair = npcPairOf(map, a, b)
  return pair !== undefined && zoneOf(pair.affinity) === 'friends'
}

/**
 * One pair's **first** crossing into {@link zoneOf}'s friends band, stamped with the slot
 * it happened in — a permanent record on the save, which is what makes the feed say it once.
 */
                                
                                                             
           
           
              
                
 

/**
 * Which pairs the settle just made friends **for the first time**: friends after, not before,
 * unrecorded. Pure. **The before-reading makes this a crossing, not a census**: without it every
 * standing friendship on a save with no record yet would report itself the next boundary.
 */
export function newFriendships(
  before                    ,
  after                    ,
  recorded                                           
)                                   {
  const known = new Set(recorded.map((pair) => pairKeyOf(pair.a, pair.b)))
  const fresh                                   = []
  for (const [key, pair] of Object.entries(after)) {
    if (zoneOf(pair.affinity) !== 'friends' || known.has(key)) continue
    const was = before[key]
    if (was !== undefined && zoneOf(was.affinity) === 'friends') continue
    // Every key here was minted by `pairKeyOf`, so the split is always the two ids.
    const [a, b] = key.split('|')
    fresh.push({ a, b })
  }
  return fresh
}

/**
 * Who each character spent the slot with, off the slot's encounter groups: the other
 * members of every group she is in, deduped, herself excluded.
 */
export function listenersOf(groups                              )                           {
  const listeners                              = {}
  for (const group of groups) {
    for (const member of group.members) {
      const set = (listeners[member] ??= new Set())
      for (const other of group.members) {
        if (other !== member) set.add(other)
      }
    }
  }
  const result                           = {}
  for (const [charId, set] of Object.entries(listeners)) {
    result[charId] = [...set]
  }
  return result
}

/** Everyone `charId` counts as a friend, in roster order. */
export function npcFriendsOf(
  map                                ,
  charId        ,
  roster                   
)           {
  return roster.filter((other) => other !== charId && areNpcFriends(map, charId, other))
}

/** Everyone `charId` counts as an enemy, in roster order — {@link npcFriendsOf}'s mirror. */
export function npcEnemiesOf(
  map                                ,
  charId        ,
  roster                   
)           {
  const enemy = (other        )          => {
    const pair = npcPairOf(map, charId, other)
    return pair !== undefined && zoneOf(pair.affinity) === 'enemies'
  }
  return roster.filter((other) => other !== charId && enemy(other))
}

/**
 * Whoever out of `candidates` `charId` is closest to, or null where none of them is a friend
 * at all — the one the prompts name as her best friend.
 */
export function npcBestFriendOf(
  map                                ,
  charId        ,
  candidates                   
)                {
  let best                = null
  let bestAffinity = -Infinity
  for (const other of npcFriendsOf(map, charId, candidates)) {
    const affinity = npcPairOf(map, charId, other)?.affinity ?? 0
    if (affinity <= bestAffinity) continue
    best = other
    bestAffinity = affinity
  }
  return best
}

/** One character as the initial deal reads her: her id and her year. */
                                 
                
              
 

/** The relationships a playthrough starts with, rolled once at New Game. */
export function rollInitialNpcRelationships(
  roster                           ,
  rand               = Math.random
)                     {
  const map                     = {}
  for (let i = 0; i < roster.length; i++) {
    for (let j = i + 1; j < roster.length; j++) {
      const a = roster[i]
      const b = roster[j]
      if (a.year === 1 || b.year === 1) continue
      if (rand() < 0.5) continue
      map[pairKeyOf(a.charId, b.charId)] = { affinity: rollAffinitySpread(rand, MAX_AFFINITY) }
    }
  }
  return map
}

/** A uniform integer in `[-spread, spread]`. */
function rollAffinitySpread(rand              , spread        )         {
  return Math.floor(rand() * (spread * 2 + 1)) - spread
}

/** What two strangers who just met off-screen think of each other, within ±MEETING_SPREAD. */
export function rollMeetingAffinity(rand               = Math.random)         {
  return rollAffinitySpread(rand, MEETING_SPREAD)
}

/**
 * The base odds by where the pair already stands, in percentage points: making up is easier
 * than becoming close, and a friendship takes upkeep.
 */
const UP_PERCENT = { sour: 65, warming: 60, close: 50 }

/** What either of the two social traits is worth on top, in the same points. */
const TRAIT_PERCENT = 10

/**
 * The odds an encounter between these two goes *well* — where they already stand, and what
 * the two social traits do to it.
 */
export function affinityUpChance(
  a                       ,
  b                       ,
  affinity        
)         {
  const base =
    affinity >= FRIENDS_AT
      ? UP_PERCENT.close
      : affinity < 0
        ? UP_PERCENT.sour
        : UP_PERCENT.warming
  const disagreeable = hasTrait(a, 'Disagreeable') || hasTrait(b, 'Disagreeable')
  const goodNatured = hasTrait(a, 'Good-natured') || hasTrait(b, 'Good-natured')
  if (disagreeable === goodNatured) return base / 100
  return (base + (goodNatured ? TRAIT_PERCENT : -TRAIT_PERCENT)) / 100
}

/** One set of people who were together this slot, as the settle pass reads it. */
                                    
                            
                                                                                             
             
                            
                                            
               
 

/** Everything {@link settleNpcPairs} folds over. Pure in, pure out. */
                                 
                                                                                
              
                                   
                                                               
                         
     
                                                                                            
                      
     
                            
                                      
                                       
 

/**
 * The slot's affinity movement: who met, who got on, and what each pair now thinks of
 * the other.
 */
export function settleNpcPairs(
  input                ,
  rand               = Math.random
)                     {
  const { date, cast, groups, characters } = input
  const next                     = { ...input.relationships }
  const inScene = new Set(cast)

  // Two strangers who shared the scene have met, whatever else the hour did.
  for (let i = 0; i < cast.length; i++) {
    for (let j = i + 1; j < cast.length; j++) {
      const key = pairKeyOf(cast[i], cast[j])
      if (next[key] === undefined) next[key] = { affinity: 0 }
    }
  }

  // Everybody the hour went well for, with each other: cast only, one step up, no encounter.
  const bonded = (input.bonded ?? []).filter((charId) => inScene.has(charId))
  for (let i = 0; i < bonded.length; i++) {
    for (let j = i + 1; j < bonded.length; j++) {
      const key = pairKeyOf(bonded[i], bonded[j])
      const current = next[key]
      next[key] = { ...current, affinity: clampAffinity((current?.affinity ?? 0) + 1) }
    }
  }

  for (const group of groups) {
    const members = group.members
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const [a, b] = [members[i], members[j]]
        if (inScene.has(a) || inScene.has(b)) continue

        const key = pairKeyOf(a, b)
        const current = next[key]
        const encounter               = {
          date,
          kind: group.kind,
          ref: group.ref,
          positive: true,
          ...(group.host ? { roomOf: group.host } : {})
        }

        if (current === undefined) {
          // A first meeting rolls its own start.
          const affinity = rollMeetingAffinity(rand)
          next[key] = { affinity, encounter: { ...encounter, positive: affinity >= 0 } }
          continue
        }

        const up = rand() < affinityUpChance(characters[a], characters[b], current.affinity)
        next[key] = {
          affinity: clampAffinity(current.affinity + (up ? 1 : -1)),
          encounter: { ...encounter, positive: up }
        }
      }
    }
  }

  return next
}
