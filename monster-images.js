(function () {
  const base = "assets/monsters/";
  const normalIds = Array.from({ length: 90 }, (_, i) => 100001 + i);
  const abyssHighFloorIds = Array.from({ length: 90 }, (_, i) => 100091 + i);
  const bossIds = [
    200201, 200202, 200203, 200204,
    301000, 301001, 301002,
    301010, 301011, 301012,
    301020, 301021, 301022,
    301030, 301031, 301032,
    301040, 301050,
    301060, 301061, 301062,
    301070,
    301080, 301081, 301082,
    301100,
    401010, 401020, 401030, 401040, 401050, 401060, 401070,
    401080, 401081, 401082, 401090, 401100,
    401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
    401160, 401161, 401162, 401170, 401071, 401180, 401190, 401200,
    502049, 502098,
    902000,
  ];
  const ids = normalIds.concat(abyssHighFloorIds, bossIds);

  const bossCandidateMap = ids.reduce((map, id) => {
    map[id] = `${base}monster_${id}.png`;
    return map;
  }, {});

  window.MonsterImageMap = Object.assign({}, window.MonsterImageMap || {}, bossCandidateMap);
})();
