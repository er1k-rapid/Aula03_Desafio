// ================================================//
//           MISSÃO 1: CRIAÇÃO DE ELEMENTOS        //
// ================================================//

// Transforma JSX em um objeto simples representando um elemento de UI.
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

// Cria um nó virtual para conteúdo de texto bruto (strings e números).
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// =========================================================================//
//           MISSÕES 2 E 3: MODO CONCORRENTE, FIBERS, RENDER E COMMIT       //
// =========================================================================//

// Variáveis globais de controle
let nextUnitOfWork = null;
let wipRoot = null;      // Rascunho da árvore (Work in Progress)
let currentRoot = null;  // A árvore que está atualmente visível na tela
let deletions = null;    // Lista de nós que precisam ser apagados do DOM

// Função temporária que será implementada apenas na Missão 4
function updateFunctionComponent(fiber) {}

// === 3.1 A Nova Função Render e Fase de Commit ===

// Aqui o render não toca no DOM diretamente. 
// Ele apenas cria a estrutura de Fibers e marca o que precisa ser atualizado, criado ou deletado. 
// O DOM só é atualizado na fase de Commit, onde são aplicados todas as mudanças de uma só vez para evitar inconsistências visuais.
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, // Elo com a árvore antiga para que seja possível fazer a comparação
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

// Aplica todas as mudanças calculadas no DOM de uma só vez (Fase de Commit).
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// Executa as alterações no DOM baseadas na etiqueta (effectTag) do fiber.
function commitWork(fiber) {
  if (!fiber) return;

  // Encontra o pai mais próximo que seja um nó DOM real
  let domParentFiber = fiber.parent;
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent;
  }
  const domParent = domParentFiber.dom;

  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === "DELETION") {
    commitDeletion(fiber, domParent);
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

// Remove o nó do DOM.
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}


// === 2.1 e 2.3 O Loop de Trabalho (Work Loop) ===

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  return undefined;
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props?.children || []);
}


// === 2.2 e 3.2 Criação e Atualização de Nós do DOM ===

function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}

// Helpers para filtrar as propriedades
const isEvent = key => key.startsWith("on");
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev, next) => key => prev[key] !== next[key];
const isGone = (prev, next) => key => !(key in next);

// Atualiza o nó DOM reutilizado, limpando lixo antigo e aplicando dados novos.
function updateDom(dom, prevProps, nextProps) {
  // Remove event listeners antigos
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // Remove propriedades antigas
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = "";
    });

  // Adiciona/Atualiza propriedades novas
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });

  // Adiciona event listeners novos
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}


// === 3.3 Reconciliação (Diffing Algorithm) ===

// Compara os elementos novos com a árvore antiga para decidir o que atualizar, criar ou deletar.
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type == oldFiber.type;

    // CASO 1: Mesma tag. É reutilizado o DOM e apenas feito a atualização das props.
    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }
    
    // CASO 2: Nova tag. É preciso fazer a criação do zero.
    if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }
    
    // CASO 3: Tag sumiu ou mudou. É preciso fazer a marcação para exclusão.
    if (oldFiber && !sameType) {
      oldFiber.effectTag = "DELETION";
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }
}

const Didact = { createElement, render };

// =========================================================================//
//                              TESTE DA MISSÃO 3                           //
// =========================================================================//
const container = document.getElementById("root");

function updateApp(title, description) {
  const element = Didact.createElement(
    "div",
    { style: "background: lightblue; padding: 20px; border-radius: 8px; font-family: sans-serif;" },
    Didact.createElement("h1", null, title),
    Didact.createElement("p", null, description)
  );
  Didact.render(element, container);
}

// Render Inicial
updateApp("Missão 3: A árvore de Fibers funciona! ", "Aguarde 2 segundos para a atualização...");

// Teste de Reconciliação
setTimeout(() => {
  updateApp("Missão 3: Reconciliação funciona! ", "O DOM foi atualizado sem recriar a div pai.");
}, 2000);