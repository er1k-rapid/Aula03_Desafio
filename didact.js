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

// ====================================//
//          TESTE DA MISSÃO 1          //                                                
// ====================================//

// const element = Didact.createElement(
//   "div",
//   { style: "background: salmon; padding: 20px; border-radius: 8px;" },
//   Didact.createElement("h1", null, "Missão 1: A missão foi um sucesso!"),
//   Didact.createElement("p", null, "Caso essa mensagem seja exibida, é porque você conseguiu criar o seu DOM com sucesso.")
// );

// const container = document.getElementById("root");
// Didact.render(element, container);