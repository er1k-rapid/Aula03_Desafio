// ============================================================================//
//                     MISSÃO 1: CRIAÇÃO DE ELEMENTOS                          //
// ============================================================================//

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

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  }
}

// ============================================================================//
//            MISSÕES 2 E 3: MODO CONCORRENTE, FIBERS, RENDER E COMMIT         //
// ============================================================================//

// Variáveis globais para o loop de trabalho e a árvore de fibras
let nextUnitOfWork = null; // O próximo trabalho a ser feito
let wipRoot = null;       // A "Work In Progress" root, a árvore de fibras que está sendo construida
let currentRoot = null;   // A raiz da árvore de fibras que está sendo renderizada
let deletions = null;     // Lista de nós que precisam ser removidos

// O método de renderização: cria a raiz da árvore de fibras e inicia o loop de trabalho
function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot, 
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

// O commit: aplica as mudanças da árvore de fibras no DOM real
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

// O commitWork: percorre a árvore de fibras e aplica as mudanças no DOM
function commitWork(fiber) {
  if (!fiber) return;

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

// O commitDeletion: remove um nó do DOM, ou continua descendo na árvore se o nó não tiver um DOM associado
function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    commitDeletion(fiber.child, domParent);
  }
}

// O loop de trabalho: processa unidades de trabalho enquanto houver tempo disponível
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

// O performUnitOfWork: processa uma unidade de trabalho, criando a fibra correspondente e reconciliando os filhos
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

// O updateHostComponent: cria o DOM para a fibra se ainda não existir, e reconciliando os filhos
function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props?.children || []);
}

// O createDom: cria um nó DOM real a partir de uma fibra, e aplica as propriedades iniciais
function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}


const isEvent = key => key.startsWith("on"); // Eventos começam com "on", ex: onClick, onChange
const isProperty = key => key !== "children" && !isEvent(key); // Propriedades são tudo que não é "children" e não é um evento
const isNew = (prev, next) => key => prev[key] !== next[key]; // Verifica se a propriedade mudou entre o antigo e o novo
const isGone = (prev, next) => key => !(key in next); // Verifica se a propriedade foi removida no novo

// O updateDom: compara as propriedades antigas e novas, e aplica as mudanças no DOM real
function updateDom(dom, prevProps, nextProps) {
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(key => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = "";
    });

  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      dom[name] = nextProps[name];
    });

  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
}

// O reconcileChildren: compara os filhos antigos e novos, e cria as fibras correspondentes com as tags de efeito apropriadas
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    const sameType = oldFiber && element && element.type == oldFiber.type;

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

// ============================================================================//
//              MISSÃO 4: FUNCTION COMPONENTS E USESTATE                       //
// ============================================================================//

// Globais para rastrear onde os hooks estão sendo chamados
let wipFiber = null;
let hookIndex = null;

// === 4.1 Atualização de Componentes de Função ===
function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];
  
  // Executa a função do componente. Qualquer useState chamado aqui dentro 
  // vai ler as variáveis globais que foram configuradas acima.
  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
}

// === 4.2 useState ===
function useState(initial) {
  // 1. Busca o estado antigo: tenta encontrar o hook na árvore anterior
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // 2. Inicializa o hook atual: usa o estado antigo se existir, senão usa o inicial
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // 3. Processa a fila (Batching): aplica todas as ações pendentes no estado
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(action => {
    // A ação pode ser um valor direto ou uma função (ex: prev => prev + 1)
    hook.state = typeof action === "function" ? action(hook.state) : action;
  });

  // 4. O despachante setState: joga a ação na fila e acorda o Work Loop (loop de trabalho)
  const setState = action => {
    hook.queue.push(action);
    
    // Configura uma nova árvore rascunho partindo da raiz atual
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  // 5. Avança o cursor para o próximo hook (se houver outro useState no componente)
  wipFiber.hooks.push(hook);
  hookIndex++;
  
  return [hook.state, setState];
}

// Agora é exportado também o useState
const Didact = { createElement, render, useState };
