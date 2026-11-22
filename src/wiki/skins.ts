// Página dos trajes (skins) das seitas, gerada de src/data/skins.json (vendidos pelo Governador Bai, World.buySkin).
import { CLASSES, SKINS, esc } from './data';

export function skinIndexPage(): string {
  const bySect = new Map<string, [string, (typeof SKINS)[string]][]>();
  for (const e of Object.entries(SKINS)) bySect.set(e[1].sect, [...(bySect.get(e[1].sect) ?? []), e]);
  const sects = [...bySect.entries()]
    .map(
      ([sect, list]) =>
        `<h2><a href="#/seita/${sect}">${esc(CLASSES[sect]?.name ?? sect)}</a></h2><ul>${list
          .map(
            ([id, s]) =>
              `<li><img class="skin-pic" src="../sprites/${id}_retrato.png" alt="" loading="lazy"> <b>${esc(s.name)}</b>: ${esc(s.desc)} <span class="price">${s.price.toLocaleString('pt-BR')} ouro</span></li>`,
          )
          .join('')}</ul>`,
    )
    .join('');
  return `<h1>Trajes</h1>
  <p>Roupas novas para o seu personagem, vendidas pelo <a href="#/npc/governador">Governador Bai</a> na
  <a href="#/mapa/cidadela">Cidadela de Jade</a>. Cada traje é de uma <a href="#/seitas">seita</a> e só aparece para quem é dela;
  só muda a aparência (no jogo e no retrato da mochila), sem efeito no combate.</p>
  <p>Depois de comprado, o traje fica seu: vista e volte ao traje da seita quando quiser, de graça, na mesma janela. Antes de
  comprar, dá para girar cada traje 360° (arrastando ou pelas setas) e abrir em tela cheia (⛶); o mesmo vale para o seu
  personagem na janela Personagem (tecla <b>C</b>).</p>${sects}`;
}
