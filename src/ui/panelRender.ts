// Redesenho central das janelas (mochila, skills, atributos, NPC, masmorras...). Toda janela que se redesenha
// enquanto está aberta passa por aqui, então ajustes de comportamento valem para todas de uma vez.
//
// Em vez de trocar o innerHTML inteiro (o que recria os elementos e joga a rolagem para o topo — e no iPhone corta a
// rolagem com embalo no meio), o HTML novo é comparado com o que já está na tela e só o que mudou é alterado:
// elementos na mesma posição e com a mesma tag são mantidos (só atributos e textos são atualizados). Assim a rolagem,
// o foco e o estado de hover sobrevivem a cada atualização vinda do jogo (XP de skill, ouro, durabilidade...).
//
// Regra: os eventos das janelas ficam no elemento raiz (delegação com closest()), nunca em elementos internos.

const tpl = document.createElement('template');

/** Desenha `html` dentro de `root` mantendo os elementos que não mudaram (e, com eles, a rolagem). */
export function renderPanel(root: HTMLElement, html: string) {
  tpl.innerHTML = html;
  morphChildren(root, tpl.content);
  tpl.innerHTML = '';
}

/** Volta ao topo a rolagem de `root` e de tudo dentro dele (ex.: ao trocar de aba ou de NPC). */
export function resetScroll(root: HTMLElement) {
  if (root.scrollTop) root.scrollTop = 0;
  root.querySelectorAll<HTMLElement>('*').forEach((e) => {
    if (e.scrollTop) e.scrollTop = 0;
  });
}

const same = (a: Node, b: Node) =>
  a.nodeType === b.nodeType &&
  a.nodeName === b.nodeName &&
  (a.nodeType !== 1 || (a as Element).id === (b as Element).id);

function morphChildren(from: Node, to: Node) {
  let a = from.firstChild,
    b = to.firstChild;
  while (b) {
    const nextB = b.nextSibling;
    if (!a) from.appendChild(b);
    else if (same(a, b)) {
      morph(a, b);
      a = a.nextSibling;
    } else {
      const nextA: ChildNode | null = a.nextSibling;
      from.replaceChild(b, a);
      a = nextA;
    }
    b = nextB;
  }
  while (a) {
    const next: ChildNode | null = a.nextSibling;
    from.removeChild(a);
    a = next;
  }
}

function morph(a: Node, b: Node) {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  const ea = a as Element,
    eb = b as Element;
  for (let i = ea.attributes.length - 1; i >= 0; i--) {
    const n = ea.attributes[i].name;
    if (!eb.hasAttribute(n)) ea.removeAttribute(n);
  }
  for (const { name, value } of Array.from(eb.attributes))
    if (ea.getAttribute(name) !== value) ea.setAttribute(name, value);
  // campos de formulário: o atributo não muda o valor mostrado depois que o jogador mexeu; só força quando o jogo mudou
  if (ea instanceof HTMLInputElement && eb instanceof HTMLInputElement) {
    if (eb.type === 'checkbox' || eb.type === 'radio') ea.checked = eb.checked;
    else if (ea !== document.activeElement && ea.value !== eb.value) ea.value = eb.value;
    return;
  }
  if (ea instanceof HTMLTextAreaElement) return; // texto digitado pelo jogador fica
  morphChildren(ea, eb);
}
