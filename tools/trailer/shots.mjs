// Roteiro do trailer: cada tomada é gravada separada (tools/trailer/record.mjs) e a ordem final
// e os textos ficam em tools/trailer/build.mjs.
// As funções abaixo rodam DENTRO da página (são enviadas como texto): só podem usar o que vem em D.
//   setup(D)          antes da tomada (troca de mapa, posição do personagem…)
//   tick(D, i, n)     antes de cada quadro (comandos de jogo: andar, alvo, skills)
//   cam(D, i, n)      depois da lógica do quadro e antes do desenho (câmera)
//   speed(i, n)       1 = normal, 0.3 = câmera lenta
// Coordenadas em tiles do mapa; zoom relativo à visão normal do jogo (1 = como o jogador vê).
// Slots das skills ativas: Tormenta 0 Presas Gêmeas, 1 Passo do Raio, 2 Tempestade de Lâminas, 3 Quebra-Guarda;
// Geada 0 Orbe Gélido, 1 Flor de Gelo, 2 Nevasca, 3 Véu de Névoa.

export const SHOTS = [
  {
    // vista aérea da vila, descendo devagar até a praça do incensário
    name: 'vila',
    frames: 330,
    setup(D) {
      D.w.changeMap('cidade', 16.5, 18.5);
    },
    cam(D, i, n) {
      // a câmera passa sobre a vila sem mostrar a borda do mapa (com zoom < 1.4 o vazio aparece nos cantos)
      const t = D.easeSine(i / (n - 1));
      D.look(D.lerp(13.4, 18.1, t), D.lerp(18.1, 13.4, t), D.lerp(1.45, 1.55, t));
    },
  },
  {
    // aproximação lenta no Mestre da Tormenta e no estandarte da seita
    name: 'mestres',
    frames: 270,
    setup(D) {
      D.w.changeMap('cidade', 16.5, 18.5);
    },
    cam(D, i, n) {
      const t = D.easeSine(i / (n - 1));
      D.look(D.lerp(13.2, 12.4, t), D.lerp(12.2, 12.2, t), D.lerp(1.9, 2.7, t), D.lerp(20, 34, t));
    },
  },
  {
    // o personagem sai pelo portão da vila e chega na floresta (o portal troca o mapa sozinho)
    name: 'portao',
    frames: 240,
    setup(D) {
      D.w.changeMap('cidade', 19.5, 16);
      D.saiu = false;
    },
    tick(D, i) {
      if (i === 0) D.w.moveTo(29.5, 15.5);
      if (D.w.mapId === 'floresta' && !D.saiu) {
        D.saiu = true;
        D.w.moveTo(8.5, 15.5);
      }
    },
    cam(D, i, n) {
      const p = D.w.player;
      D.look(p.x, p.y, 1.55, 30);
    },
  },
  {
    // grua sobre o lago e os lobos
    name: 'floresta',
    frames: 300,
    setup(D) {
      D.w.changeMap('floresta', 5.5, 16.5);
    },
    cam(D, i, n) {
      const t = D.easeSine(i / (n - 1));
      D.look(D.lerp(11.3, 18.5, t), D.lerp(19.5, 13, t), D.lerp(1.5, 1.6, t));
    },
  },
  {
    // Tormenta contra o bando de bandidos: Passo do Raio, Presas Gêmeas, Tempestade (câmera lenta), Quebra-Guarda
    name: 'combate_tormenta',
    frames: 480,
    setup(D) {
      D.w.changeMap('floresta', 18.5, 11.5);
    },
    tick(D, i) {
      const w = D.w,
        p = w.player;
      const alvo = () => D.mon('bandido_espadachim', p) ?? D.mon(null, p);
      if (i === 10) w.setTarget(alvo()?.id ?? null);
      if (i === 25) D.skill(1);
      if (i === 90) D.skill(0);
      if (i === 190) D.skill(2);
      if (i === 300) D.skill(3);
      if (i === 380) D.skill(0);
      if (i > 10 && (!w.targetId || !w.monsters.find((m) => m.id === w.targetId && !m.dead))) {
        const m = alvo();
        if (m && Math.hypot(m.x - p.x, m.y - p.y) < 8) w.setTarget(m.id);
      }
    },
    speed(i) {
      // câmera lenta na Tempestade de Lâminas
      if (i >= 185 && i < 260) return i < 195 ? 1 - (i - 185) * 0.07 : i > 245 ? 0.3 + (i - 245) * 0.047 : 0.3;
      return 1;
    },
    cam(D, i, n) {
      const p = D.w.player;
      D.cx = D.cx === undefined ? p.x : D.lerp(D.cx, p.x, 0.12);
      D.cy = D.cy === undefined ? p.y : D.lerp(D.cy, p.y, 0.12);
      let z = 1.75;
      if (i >= 180 && i < 270) z = 1.75 + 0.55 * Math.sin((Math.PI * (i - 180)) / 90);
      D.look(D.cx, D.cy, z, 24);
    },
  },
  {
    // ruínas de terracota: guerreiros parados, clima pesado
    name: 'ruinas',
    frames: 300,
    setup(D) {
      D.w.changeMap('ruinas', 4.5, 16.5);
    },
    cam(D, i, n) {
      const t = D.easeSine(i / (n - 1));
      D.look(D.lerp(12.5, 17.5, t), D.lerp(18.5, 13.5, t), D.lerp(1.5, 1.6, t));
    },
  },
  {
    // revelação do General: a câmera sai do personagem e empurra até o chefe
    name: 'general_revela',
    frames: 240,
    setup(D) {
      D.w.changeMap('ruinas', 15.5, 16.5);
    },
    cam(D, i, n) {
      const t = D.ease(i / (n - 1));
      D.look(D.lerp(16, 24.5, t), D.lerp(16.5, 16.5, t), D.lerp(1.3, 2.3, t), D.lerp(20, 40, t));
    },
  },
  {
    // luta com o General: aviso de golpe em área, o personagem escapa e contra-ataca
    name: 'general_luta',
    frames: 480,
    setup(D) {
      D.w.changeMap('ruinas', 20.5, 16.5);
      D.cx = undefined;
    },
    tick(D, i) {
      const w = D.w,
        p = w.player;
      const boss = D.mon('general_terracota');
      if (i === 5 && boss) w.setTarget(boss.id);
      // invocação dos guerreiros cedo, para aparecerem na tomada
      if (i === 150 && boss) boss.hp = Math.min(boss.hp, boss.derived.maxHp * 0.49);
      if (i === 60) D.skill(0);
      if (i === 200) D.skill(2);
      if (i === 300) D.skill(3);
      if (i === 400) D.skill(0);
      // sai de dentro do círculo vermelho
      const tg = w.telegraphs[0];
      if (tg && Math.hypot(tg.x - p.x, tg.y - p.y) < tg.radius + 0.3 && !D.fugindo) {
        D.fugindo = true;
        w.moveTo(tg.x - 3, tg.y + 1.5);
      }
      if (!w.telegraphs.length && D.fugindo) {
        D.fugindo = false;
        if (boss) w.setTarget(boss.id);
      }
    },
    cam(D, i, n) {
      const p = D.w.player,
        b = D.mon('general_terracota') ?? p;
      const tx = (p.x * 2 + b.x) / 3,
        ty = (p.y * 2 + b.y) / 3;
      D.cx = D.cx === undefined ? tx : D.lerp(D.cx, tx, 0.08);
      D.cy = D.cy === undefined ? ty : D.lerp(D.cy, ty, 0.08);
      D.look(D.cx, D.cy, 1.55, 24);
    },
  },
  {
    // golpe final em câmera lenta
    name: 'general_final',
    frames: 300,
    setup(D) {
      D.w.changeMap('ruinas', 22, 16.5);
      D.cx = undefined;
    },
    tick(D, i) {
      const w = D.w;
      const boss = D.mon('general_terracota');
      if (i === 5 && boss) w.setTarget(boss.id);
      if (i === 100 && boss) {
        boss.hp = 1;
        D.skill(3);
      }
    },
    speed(i) {
      if (i < 100) return 1;
      if (i < 120) return 1 - (i - 100) * 0.0375; // até 0.25
      if (i < 230) return 0.25;
      return Math.min(1, 0.25 + (i - 230) * 0.02);
    },
    cam(D, i, n) {
      const p = D.w.player,
        b = D.w.monsters.find((m) => m.monsterId === 'general_terracota') ?? p;
      const tx = (p.x + b.x) / 2,
        ty = (p.y + b.y) / 2;
      D.cx = D.cx === undefined ? tx : D.lerp(D.cx, tx, 0.1);
      D.cy = D.cy === undefined ? ty : D.lerp(D.cy, ty, 0.1);
      const z = i < 90 ? 1.8 : 1.8 + 0.6 * D.easeSine(Math.min(1, (i - 90) / 60));
      D.look(D.cx, D.cy, z, 30);
      if (i === 118) {
        D.cam.flash(250, 255, 240, 200);
        D.cam.shake(400, 0.008);
      }
    },
  },
  {
    // segunda seita: Geada (à distância, gelo) contra bandidos — troca o personagem
    name: 'combate_geada',
    frames: 450,
    setup(D) {
      D.newWorld('pavilhao');
      D.step();
      D.step();
      D.hook();
      D.strong();
      D.w.changeMap('floresta', 17, 22.5);
      D.cx = undefined;
    },
    tick(D, i) {
      const w = D.w,
        p = w.player;
      const alvo = () => D.mon('bandido_espadachim', { x: 22, y: 26.5 });
      if (i === 5) D.skill(3);
      if (i === 30) w.setTarget(alvo()?.id ?? null);
      if (i === 45) D.skill(0);
      if (i === 120) D.skill(2);
      if (i === 260) D.skill(1);
      if (i === 340) D.skill(2);
      if (i > 30 && (!w.targetId || !w.monsters.find((m) => m.id === w.targetId && !m.dead))) {
        const m = D.mon(null, p);
        if (m && Math.hypot(m.x - p.x, m.y - p.y) < 8) w.setTarget(m.id);
      }
    },
    speed(i) {
      if (i >= 120 && i < 200) return i < 130 ? 1 - (i - 120) * 0.065 : i > 185 ? 0.35 + (i - 185) * 0.043 : 0.35;
      return 1;
    },
    cam(D, i, n) {
      const p = D.w.player;
      const tx = p.x + 2.2,
        ty = p.y + 1.8;
      D.cx = D.cx === undefined ? tx : D.lerp(D.cx, tx, 0.08);
      D.cy = D.cy === undefined ? ty : D.lerp(D.cy, ty, 0.08);
      let z = 1.5;
      if (i >= 115 && i < 215) z = 1.5 + 0.35 * Math.sin((Math.PI * (i - 115)) / 100);
      D.look(D.cx, D.cy, z, 24);
    },
  },
];
