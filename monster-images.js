(function () {
  const base = "monster/img/";
  const normalIds = Array.from({ length: 90 }, (_, i) => 100001 + i);
  const bossIds = [
    200201, 200202, 200203, 200204,
    301000,
    401010, 401020, 401030, 401040, 401050, 401060, 401070,
    401080, 401081, 401082, 401090, 401100,
    401110, 401120, 401130, 401140, 401150, 401151, 401152, 401153,
    401160, 401161, 401162, 401170, 401180, 401190, 401200,
    902000,
  ];
  const ids = normalIds.concat(bossIds);

  const bossCandidateMap = ids.reduce((map, id) => {
    map[id] = `${base}monster_${id}.png`;
    return map;
  }, {});

  window.MonsterImageMap = Object.assign({}, window.MonsterImageMap || {}, bossCandidateMap);
})();
