// Each row is 12 tiles wide. # = ground, ^ = spike, C = checkpoint, F = finish.
// Movement is turn-based: horizontal movement and a two-tile jump.
const names = [
  'Beginner Path','Jump Training','Spike Valley','Lava Escape','Ice Platform',
  'Invisible Blocks','Speed Run','Trap Tower','Impossible Jump','NoobV2 Champion'
];
const patterns = [
  '...#.......F',
  '..^...#....F',
  '..^^..C....F',
  '.^..^^C....F',
  '..^^...C.^.F',
  '.^^..^^C...F',
  '..^.^..C.^.F',
  '.^^.^^.C.^.F',
  '.^^^...C^^.F',
  '.^^.^^.C^^.F'
];
const rewards = [100,150,200,300,400,500,650,800,1000,1500];
module.exports = names.map((name, i) => ({
  id: i + 1,
  name,
  tiles: patterns[i].split(''),
  reward: rewards[i]
}));
