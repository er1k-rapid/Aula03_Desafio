// Transforms JSX into a plain object representing a UI element.
// Babel calls this function when it compiles JSX like <div id="app" />.
// `type` is the tag name ("div", "h1", etc.) or a component function.
// `props` holds attributes like { id: "app", className: "box" }.
// `...children` collects every nested element as a rest parameter array.
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props, // spread original props (e.g. id, className, event handlers)

      // Normalize children: if a child is already an element object, keep it;
      // if it's a primitive (string, number), wrap it in a TEXT_ELEMENT node.
      // This keeps the render function uniform — it always deals with objects.
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}
// Creates a virtual node for raw text content (strings and numbers).
// Real React just uses the primitive directly, but Didact wraps it in an object so that render() can handle every node the same way, without special-casing "is this a string or an element?".
// `nodeValue` is the actual DOM property that holds the text content assigning it to a text node is equivalent to node.nodeValue = "Hello".
function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT", // sentinel type; render() checks for this string
    props: {
      nodeValue: text,    // will be assigned directly to the DOM text node
      children: [],       // text nodes never have children
    },
  }
}

// Transforma os objetos virtuais (elementos) em nós reais do DOM.
function render(element, container) {
  // 1. Cria o nó DOM: Se for um texto, usa createTextNode. Se não for, irá criar o elemento HTML normal.
  const dom =
    element.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(element.type);

  // 2. Atribui todas as props (exceto a propriedade "children", !== "children") diretamente ao nó DOM.
  const isProperty = key => key !== "children";
  Object.keys(element.props)
    .filter(isProperty)
    .forEach(name => {
      dom[name] = element.props[name];
    });

  // 3. Chama o render recursivamente para cada filho "children", passando o nó recém-criado como um container.
  element.props.children.forEach(child =>
    render(child, dom)
  );

  // 4. Adiciona o nó finalizado ao container pai na tela.
  container.appendChild(dom);
}

const Didact = { createElement, render };

// =======================================================//
// MISSÃO 2: MODO CONCORRENTE E A ÁRVORE DE FIBERS        //
// =======================================================//

// Variáveis globais para o controle do Work Loop
let nextUnitOfWork = null;
let wipRoot = null; // Work in Progress Root (Raiz do trabalho em andamento)

// Variáveis/Funções temporárias (Stubs) para evitar possíveis erros nas Missões futuras
function commitRoot() {}
function updateFunctionComponent(fiber) {}
function reconcileChildren(fiber, elements) {}
function updateDom(dom, prevProps, nextProps) {}


// === 2.1 O Loop de Trabalho (Work Loop) ===
// requestIdleCallback agenda o loop para rodar quando a thread principal estiver ociosa.
// O parâmetro 'deadline' diz quanto tempo tem antes de devolver o controle ao navegador.
function workLoop(deadline) {
  let shouldYield = false;
  
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  // Quando não houver mais trabalho e já haver uma árvore pronta, serão aplicadas as mudanças no DOM
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}
// É iniciado o motor do loop de trabalho
requestIdleCallback(workLoop);


// === 2.2 Criação de Nós do DOM ===
// Este helper cria o nó real do DOM para um dado fiber.
// Ele chama updateDom — uma função que será implementado futuramente na Missão 3.
function createDom(fiber) {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);
  return dom;
}


// === 2.3 performUnitOfWork (A Lógica de Navegação da Árvore) ===
// Este é o núcleo do agendador. Recebe um fiber, processa, e retorna o próximo.
function performUnitOfWork(fiber) {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // 1. Se o fiber tem um filho (child), ele é a próxima unidade de trabalho.
  if (fiber.child) {
    return fiber.child;
  }

  // 2. Se não tem filho, procuramos por um irmão (sibling).
  // Se não houver irmão, subimos para o pai (parent) e procuramos o irmão do pai (uncle).
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
  
  // 3. Se chegar até aqui, é feito uma varredutra de toda a árvore de volta até o topo e o trabalho é encerrado.
  return undefined;
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  reconcileChildren(fiber, fiber.props?.children || []);
}


// ========================================================================//
//  TESTE DA MISSÃO 2: Testando o Algoritmo de Travessia (Traversal)       //
// ========================================================================//
/* Será feito a simulação dessa árvore abaixo (sem precisar renderizar na tela ainda):
      A
     / \
    B   D
   /
  C
*/

// 1. Criando fibers falsos para o teste
const fiberC = { type: "C", props: {} };
const fiberB = { type: "B", props: {}, child: fiberC };
const fiberD = { type: "D", props: {} };
const fiberA = { type: "A", props: {}, child: fiberB };

// 2. Conectando pais e irmãos
fiberC.parent = fiberB;
fiberB.parent = fiberA;
fiberD.parent = fiberA;
fiberB.sibling = fiberD;

// 3. Substituindo a função temporariamente para não mexer no DOM real
const originalUpdateHost = updateHostComponent;
updateHostComponent = (fiber) => { 
  console.log("Visitando nó:", fiber.type); 
};

// 4. Rodando a lógica do Work Loop manualmente para verificar a ordem
console.log("--- Iniciando Teste da Árvore de Fibers ---");
let nextUnit = fiberA;
while (nextUnit) {
  nextUnit = performUnitOfWork(nextUnit);
}
console.log("--- Fim da Travessia ---");

// 5. Restaurando a função original para as próximas missões
updateHostComponent = originalUpdateHost;