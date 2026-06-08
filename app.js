/** @jsx Didact.createElement */

function Counter() {
  const [count, setCount] = Didact.useState(1);

  return (
    <div style="font-family: sans-serif; padding: 40px;">
      <h1>Contagem: {count}</h1>
      
      <button onClick={() => setCount(c => c + 1)}>
        + Incrementar
      </button>
      
      <button onClick={() => setCount(c => c - 1)}>
        - Decrementar
      </button>
    </div>
  );
}

const container = document.getElementById("root");
Didact.render(<Counter />, container);