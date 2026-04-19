const { useEffect, useRef, useState, startTransition } = React;

const EPSILON = "epsilon";
const CONCAT = ".";
const EXAMPLES = [
  "(a|b)*abb",
  "a(b|c)*",
  "ab?a+",
  "1(0|1)*01",
  "(a|b|c)+ca"
];

function App() {
  const [regex, setRegex] = useState("(a|b)*abb");
  const [result, setResult] = useState(null);
  const [activeView, setActiveView] = useState("all");
  const [stepFilter, setStepFilter] = useState("");
  const [message, setMessage] = useState({
    text: "Try a sample expression or enter your own regex to generate the automata.",
    isError: false
  });

  useEffect(() => {
    runConversion("(a|b)*abb");
  }, []);

  function runConversion(nextRegex = regex) {
    const trimmed = nextRegex.trim();

    if (!trimmed) {
      setResult(null);
      setMessage({
        text: "Please enter a regular expression first.",
        isError: true
      });
      return;
    }

    try {
      const normalized = insertConcatenation(trimmed);
      const postfix = toPostfix(normalized);
      const nfa = buildNFAFromPostfix(postfix);
      const dfa = convertToDFA(nfa);
      const nextResult = buildResultPayload(trimmed, normalized, postfix, nfa, dfa);

      startTransition(() => {
        setResult(nextResult);
        setMessage({
          text: "Conversion completed successfully.",
          isError: false
        });
      });
    } catch (error) {
      setResult(null);
      setMessage({
        text: error.message,
        isError: true
      });
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runConversion();
  }

  function handleExample(example) {
    setRegex(example);
    runConversion(example);
  }

  function handleClear() {
    setRegex("");
    setResult(null);
    setMessage({
      text: "Input cleared. Enter another regex whenever you are ready.",
      isError: false
    });
  }

  function handleExport() {
    if (!result) {
      return;
    }

    const exportData = {
      regex: result.regex,
      normalized: result.normalized,
      postfix: result.postfix,
      alphabet: result.alphabet,
      nfa: {
        start: result.nfa.start,
        accept: result.nfa.accept,
        states: result.nfa.states,
        transitions: result.nfa.transitions
      },
      dfa: {
        startLabel: result.dfa.startLabel,
        acceptLabels: result.dfa.acceptLabels,
        alphabet: result.dfa.alphabet,
        states: result.dfa.states,
        transitionMap: result.dfa.transitionMap
      },
      insights: result.insights
    };

    downloadTextFile(
      `automata-${sanitizeFileName(result.regex) || "regex"}.json`,
      JSON.stringify(exportData, null, 2),
      "application/json"
    );
  }

  function handleRandomExample() {
    const randomExample = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    setRegex(randomExample);
    runConversion(randomExample);
  }

  function handleCopyRegex() {
    if (!result?.regex || !navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(result.regex).then(() => {
      setMessage({
        text: "Regex copied.",
        isError: false
      });
    });
  }

  const filteredSteps = result
    ? result.dfa.steps.filter((step) => {
        if (!stepFilter.trim()) {
          return true;
        }

        const keyword = stepFilter.trim().toLowerCase();
        return (
          step.title.toLowerCase().includes(keyword) ||
          step.description.toLowerCase().includes(keyword) ||
          step.tokens.some((token) => token.toLowerCase().includes(keyword))
        );
      })
    : [];

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Automata Visualizer</p>
            <h1 className="hero-title">Regex to NFA and DFA.</h1>
          </div>

          <div className="hero-stats hero-badges">
            <div className="spotlight spotlight-stat">
              <span className="spotlight-number">{result ? result.insights.nfaStates : "--"}</span>
              <span className="spotlight-caption">NFA states</span>
            </div>
            <div className="spotlight spotlight-stat">
              <span className="spotlight-number">{result ? result.insights.dfaStates : "--"}</span>
              <span className="spotlight-caption">DFA states</span>
            </div>
            <div className="spotlight spotlight-stat">
              <span className="spotlight-number">{result ? result.insights.stepCount : "--"}</span>
              <span className="spotlight-caption">Steps</span>
            </div>
          </div>
        </div>
      </section>

      <div className="layout-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Regex Input</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="controls-grid">
              <div className="input-shell">
                <input
                  className="regex-input"
                  type="text"
                  value={regex}
                  onChange={(event) => setRegex(event.target.value)}
                  placeholder="Examples: (a|b)*abb, a(b|c)*, ab?a+"
                />
              </div>
              <button className="btn btn-primary" type="submit">Convert</button>
              <button className="btn btn-secondary" type="button" onClick={handleClear}>Clear</button>
            </div>
          </form>

          <div className="toolbar">
            <button type="button" className="chip chip-accent" onClick={handleRandomExample}>
              Random Example
            </button>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="chip"
                onClick={() => handleExample(example)}
              >
                {example}
              </button>
            ))}
          </div>

          <div className={`message${message.isError ? " error" : ""}`} aria-live="polite">
            <strong>{message.isError ? "Validation" : "Status"}</strong>
            <span>{message.text}</span>
          </div>
        </section>

        {!result ? (
          <section className="panel empty-state">
            <h2>Ready for a regex</h2>
          </section>
        ) : (
          <div className="results-stack">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Overview</h2>
                </div>
                <div className="button-group">
                  <button className="btn btn-secondary" type="button" onClick={handleCopyRegex}>
                    Copy Regex
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={handleExport}>
                    Export JSON
                  </button>
                </div>
              </div>

              <div className="summary-grid">
                <SummaryCard label="Input Regex" value={result.regex} />
                <SummaryCard label="Explicit Concatenation" value={result.normalized} />
                <SummaryCard label="Postfix Form" value={result.postfix.join(" ")} />
                <SummaryCard label="Alphabet" value={result.alphabet.join(", ") || "None"} />
              </div>

              <div className="token-row">
                <span className="token">NFA Start: q{result.nfa.start}</span>
                <span className="token">NFA Accept: q{result.nfa.accept}</span>
                <span className="token">DFA Start: {result.dfa.startLabel}</span>
                <span className="token">DFA Accepts: {result.dfa.acceptLabels.join(", ") || "None"}</span>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Quick Insights</h2>
                </div>
                <div className="view-switcher">
                  <button
                    type="button"
                    className={`mini-btn${activeView === "all" ? " active" : ""}`}
                    onClick={() => setActiveView("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`mini-btn${activeView === "graphs" ? " active" : ""}`}
                    onClick={() => setActiveView("graphs")}
                  >
                    Graphs
                  </button>
                  <button
                    type="button"
                    className={`mini-btn${activeView === "tables" ? " active" : ""}`}
                    onClick={() => setActiveView("tables")}
                  >
                    Tables
                  </button>
                  <button
                    type="button"
                    className={`mini-btn${activeView === "steps" ? " active" : ""}`}
                    onClick={() => setActiveView("steps")}
                  >
                    Steps
                  </button>
                </div>
              </div>

              <div className="insight-grid">
                <InsightCard label="NFA States" value={String(result.insights.nfaStates)} />
                <InsightCard label="NFA Transitions" value={String(result.insights.nfaTransitions)} />
                <InsightCard label="DFA States" value={String(result.insights.dfaStates)} />
                <InsightCard label="Conversion Steps" value={String(result.insights.stepCount)} />
              </div>
            </section>

            {(activeView === "all" || activeView === "tables") && (
              <section className="panel">
                <h2 className="panel-title">NFA</h2>
                <div className="token-row">
                  <span className="token">Start: q{result.nfa.start}</span>
                  <span className="token">Accept: q{result.nfa.accept}</span>
                  <span className="token">States: {result.nfa.states.length}</span>
                </div>
                <Table
                  headers={["From", "Symbol", "To"]}
                  rows={result.nfa.transitions.map((transition) => [
                    `q${transition.from}`,
                    transition.symbol,
                    `q${transition.to}`
                  ])}
                />
              </section>
            )}

            {(activeView === "all" || activeView === "graphs") && (
              <section className="panel panel-graph">
                <h2 className="panel-title">NFA Transition Diagram</h2>
                <CanvasDiagram kind="nfa" data={result.nfa} />
              </section>
            )}

            {(activeView === "all" || activeView === "steps") && (
              <section className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">NFA to DFA Steps</h2>
                  <input
                    className="step-search"
                    type="text"
                    value={stepFilter}
                    onChange={(event) => setStepFilter(event.target.value)}
                    placeholder="Filter steps"
                  />
                </div>
                <div className="steps-grid">
                  {filteredSteps.map((step, index) => (
                    <article className="step-card" key={`${step.title}-${index}`}>
                      <h3>Step {index + 1}: {step.title}</h3>
                      <p>{step.description}</p>
                      <div className="token-row">
                        {step.tokens.map((token, tokenIndex) => (
                          <span className="token" key={`${token}-${tokenIndex}`}>{token}</span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(activeView === "all" || activeView === "tables") && (
              <section className="panel">
                <h2 className="panel-title">DFA</h2>
                <div className="token-row">
                  <span className="token">Start: {result.dfa.startLabel}</span>
                  <span className="token">Accept States: {result.dfa.acceptLabels.join(", ") || "None"}</span>
                  <span className="token">Total States: {result.dfa.states.length}</span>
                </div>
                <Table
                  headers={["State", "NFA Set", "Accept?", ...result.dfa.alphabet]}
                  rows={result.dfa.states.map((state) => {
                    const transitionMap = result.dfa.alphabet.map((symbol) => {
                      const nextKey = result.dfa.transitionMap[state.key]?.[symbol];
                      return nextKey ? result.dfa.stateLabels[nextKey] : "empty";
                    });

                    return [
                      result.dfa.stateLabels[state.key],
                      state.label,
                      state.isAccept ? "Yes" : "No",
                      ...transitionMap
                    ];
                  })}
                />
              </section>
            )}

            {(activeView === "all" || activeView === "graphs") && (
              <section className="panel panel-graph">
                <h2 className="panel-title">DFA Transition Diagram</h2>
                <CanvasDiagram kind="dfa" data={result.dfa} />
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span className="summary-label">{label}</span>
      <strong className="summary-value">{value}</strong>
    </article>
  );
}

function InsightCard({ label, value }) {
  return (
    <article className="insight-card">
      <span className="insight-label">{label}</span>
      <strong className="insight-value">{value}</strong>
    </article>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CanvasDiagram({ kind, data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) {
      return undefined;
    }

    function render() {
      if (kind === "nfa") {
        drawNFA(data, canvas);
      } else {
        drawDFA(data, canvas);
      }
    }

    render();
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [kind, data]);

  return (
    <div className="diagram-wrap">
      <canvas ref={canvasRef} className="diagram-canvas" />
    </div>
  );
}

function buildResultPayload(regex, normalized, postfix, nfa, dfa) {
  return {
    regex,
    normalized,
    postfix,
    alphabet: nfa.alphabet,
    nfa,
    dfa,
    insights: {
      nfaStates: nfa.states.length,
      nfaTransitions: nfa.transitions.length,
      dfaStates: dfa.states.length,
      stepCount: dfa.steps.length
    }
  };
}

function insertConcatenation(regex) {
  const cleaned = regex.replace(/\s+/g, "");

  if (!cleaned) {
    throw new Error("The regular expression is empty after removing spaces.");
  }

  const result = [];

  for (let index = 0; index < cleaned.length; index += 1) {
    const current = cleaned[index];
    const next = cleaned[index + 1];

    validateCharacter(current);
    result.push(current);

    if (next && needsConcatenation(current, next)) {
      result.push(CONCAT);
    }
  }

  validateParentheses(result);
  return result.join("");
}

function validateCharacter(char) {
  if (!isLiteral(char) && !["|", "*", "+", "?", "(", ")"].includes(char)) {
    throw new Error(`Unsupported character "${char}". Use letters, digits, parentheses, and operators | * + ?`);
  }
}

function validateParentheses(tokens) {
  let depth = 0;

  tokens.forEach((token) => {
    if (token === "(") {
      depth += 1;
    } else if (token === ")") {
      depth -= 1;
    }

    if (depth < 0) {
      throw new Error("Parentheses are not balanced.");
    }
  });

  if (depth !== 0) {
    throw new Error("Parentheses are not balanced.");
  }
}

function needsConcatenation(current, next) {
  const currentCanEnd = isLiteral(current) || current === ")" || current === "*" || current === "+" || current === "?";
  const nextCanStart = isLiteral(next) || next === "(";
  return currentCanEnd && nextCanStart;
}

function isLiteral(char) {
  return /^[a-zA-Z0-9]$/.test(char);
}

function toPostfix(regex) {
  const output = [];
  const operators = [];
  const precedence = {
    "|": 1,
    [CONCAT]: 2,
    "*": 3,
    "+": 3,
    "?": 3
  };

  for (const token of regex) {
    if (isLiteral(token)) {
      output.push(token);
      continue;
    }

    if (token === "(") {
      operators.push(token);
      continue;
    }

    if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") {
        output.push(operators.pop());
      }

      if (!operators.length) {
        throw new Error("Invalid expression: closing parenthesis without matching opening parenthesis.");
      }

      operators.pop();
      continue;
    }

    while (
      operators.length &&
      operators[operators.length - 1] !== "(" &&
      precedence[operators[operators.length - 1]] >= precedence[token]
    ) {
      output.push(operators.pop());
    }

    operators.push(token);
  }

  while (operators.length) {
    const operator = operators.pop();
    if (operator === "(") {
      throw new Error("Invalid expression: opening parenthesis without matching closing parenthesis.");
    }
    output.push(operator);
  }

  return output;
}

function buildNFAFromPostfix(postfix) {
  let nextStateId = 0;
  const stack = [];
  const transitions = [];
  const alphabet = new Set();

  function createState() {
    const id = nextStateId;
    nextStateId += 1;
    return id;
  }

  function addTransition(from, symbol, to) {
    transitions.push({ from, symbol, to });
    if (symbol !== EPSILON) {
      alphabet.add(symbol);
    }
  }

  function pushLiteral(symbol) {
    const start = createState();
    const accept = createState();
    addTransition(start, symbol, accept);
    stack.push({ start, accept });
  }

  for (const token of postfix) {
    if (isLiteral(token)) {
      pushLiteral(token);
      continue;
    }

    if (token === CONCAT) {
      const right = stack.pop();
      const left = stack.pop();
      ensureFragments(left, right, "concatenation");
      addTransition(left.accept, EPSILON, right.start);
      stack.push({ start: left.start, accept: right.accept });
      continue;
    }

    if (token === "|") {
      const right = stack.pop();
      const left = stack.pop();
      ensureFragments(left, right, "union");
      const start = createState();
      const accept = createState();
      addTransition(start, EPSILON, left.start);
      addTransition(start, EPSILON, right.start);
      addTransition(left.accept, EPSILON, accept);
      addTransition(right.accept, EPSILON, accept);
      stack.push({ start, accept });
      continue;
    }

    if (token === "*") {
      const fragment = stack.pop();
      ensureFragments(fragment, fragment, "Kleene star", true);
      const start = createState();
      const accept = createState();
      addTransition(start, EPSILON, fragment.start);
      addTransition(start, EPSILON, accept);
      addTransition(fragment.accept, EPSILON, fragment.start);
      addTransition(fragment.accept, EPSILON, accept);
      stack.push({ start, accept });
      continue;
    }

    if (token === "+") {
      const fragment = stack.pop();
      ensureFragments(fragment, fragment, "plus", true);
      const start = createState();
      const accept = createState();
      addTransition(start, EPSILON, fragment.start);
      addTransition(fragment.accept, EPSILON, fragment.start);
      addTransition(fragment.accept, EPSILON, accept);
      stack.push({ start, accept });
      continue;
    }

    if (token === "?") {
      const fragment = stack.pop();
      ensureFragments(fragment, fragment, "optional", true);
      const start = createState();
      const accept = createState();
      addTransition(start, EPSILON, fragment.start);
      addTransition(start, EPSILON, accept);
      addTransition(fragment.accept, EPSILON, accept);
      stack.push({ start, accept });
    }
  }

  if (stack.length !== 1) {
    throw new Error("Invalid regular expression. Please check the operator placement.");
  }

  const finalFragment = stack.pop();

  return {
    states: Array.from({ length: nextStateId }, (_, index) => index),
    transitions,
    start: finalFragment.start,
    accept: finalFragment.accept,
    alphabet: Array.from(alphabet).sort()
  };
}

function ensureFragments(left, right, operation, isUnary = false) {
  if (isUnary) {
    if (!left) {
      throw new Error(`Invalid expression: missing operand for ${operation}.`);
    }
    return;
  }

  if (!left || !right) {
    throw new Error(`Invalid expression: ${operation} requires two operands.`);
  }
}

function convertToDFA(nfa) {
  const alphabet = [...nfa.alphabet];
  const stateMap = {};
  const stateOrder = [];
  const transitionMap = {};
  const acceptLabels = [];
  const steps = [];
  const queue = [];

  const startClosure = epsilonClosure([nfa.start], nfa.transitions);
  const startKey = keyFromSet(startClosure);

  queue.push(startClosure);

  while (queue.length) {
    const currentSet = queue.shift();
    const currentKey = keyFromSet(currentSet);

    if (stateMap[currentKey]) {
      continue;
    }

    const stateLabel = `D${stateOrder.length}`;
    const isAccept = currentSet.includes(nfa.accept);
    stateMap[currentKey] = {
      key: currentKey,
      label: stateLabel,
      set: currentSet,
      isAccept
    };
    stateOrder.push(currentKey);

    if (isAccept) {
      acceptLabels.push(stateLabel);
    }

    steps.push({
      title: `Create ${stateLabel}`,
      description:
        `Take the ${EPSILON}-closure of ${stateOrder.length === 1 ? `the NFA start state q${nfa.start}` : "this discovered subset"}. ` +
        `That gives ${formatSet(currentSet)}, which becomes ${stateLabel}.`,
      tokens: [`Subset ${formatSet(currentSet)}`, isAccept ? "Contains accept state" : "Non-accept state"]
    });

    transitionMap[currentKey] = {};

    alphabet.forEach((symbol) => {
      const moveResult = move(currentSet, symbol, nfa.transitions);
      const closure = epsilonClosure(moveResult, nfa.transitions);

      if (!closure.length) {
        steps.push({
          title: `${stateLabel} on ${symbol}`,
          description: `From ${formatSet(currentSet)} on symbol "${symbol}", no NFA state is reachable, so no DFA transition is added.`,
          tokens: [`move(${formatSet(currentSet)}, ${symbol}) = empty`]
        });
        return;
      }

      const nextKey = keyFromSet(closure);
      transitionMap[currentKey][symbol] = nextKey;

      steps.push({
        title: `${stateLabel} on ${symbol}`,
        description:
          `Compute move(${formatSet(currentSet)}, "${symbol}") and then its ${EPSILON}-closure. ` +
          `The reachable subset is ${formatSet(closure)}.`,
        tokens: [
          `move = ${formatSet(moveResult)}`,
          `${EPSILON}-closure = ${formatSet(closure)}`,
          `Transition: ${stateLabel} --${symbol}--> ${stateMap[nextKey]?.label || `D${stateOrder.length}`}`
        ]
      });

      if (!stateMap[nextKey]) {
        queue.push(closure);
      }
    });
  }

  const states = stateOrder.map((key) => ({
    key,
    label: formatSet(stateMap[key].set),
    isAccept: stateMap[key].isAccept
  }));

  return {
    alphabet,
    states,
    transitionMap,
    startKey,
    startLabel: stateMap[startKey].label,
    acceptLabels,
    stateLabels: Object.fromEntries(stateOrder.map((key) => [key, stateMap[key].label])),
    steps
  };
}

function epsilonClosure(states, transitions) {
  const stack = [...new Set(states)];
  const visited = new Set(stack);

  while (stack.length) {
    const state = stack.pop();

    transitions.forEach((transition) => {
      if (transition.from === state && transition.symbol === EPSILON && !visited.has(transition.to)) {
        visited.add(transition.to);
        stack.push(transition.to);
      }
    });
  }

  return [...visited].sort((a, b) => a - b);
}

function move(states, symbol, transitions) {
  const nextStates = new Set();

  states.forEach((state) => {
    transitions.forEach((transition) => {
      if (transition.from === state && transition.symbol === symbol) {
        nextStates.add(transition.to);
      }
    });
  });

  return [...nextStates].sort((a, b) => a - b);
}

function keyFromSet(states) {
  return states.join(",");
}

function formatSet(states) {
  return states.length ? `{${states.map((state) => `q${state}`).join(", ")}}` : "empty";
}

function drawNFA(nfa, canvas) {
  const columns = Math.max(3, Math.ceil(Math.sqrt(nfa.states.length)));
  const horizontalGap = nfa.states.length > 16 ? 165 : 150;
  const verticalGap = 170;
  const rows = Math.max(1, Math.ceil(nfa.states.length / columns));
  const width = Math.max(canvas.parentElement.clientWidth, columns * horizontalGap + 140);
  const height = Math.max(620, rows * verticalGap + 140);
  const { context } = prepareCanvas(canvas, width, height);

  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#0e6b61";
  context.fillStyle = "#1f1a14";
  context.lineWidth = 2.5;
  context.font = "16px Space Grotesk";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const positions = {};

  nfa.states.forEach((state, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 90 + column * horizontalGap;
    const y = 110 + row * verticalGap;
    positions[state] = { x, y };
  });

  nfa.transitions.forEach((transition, index) => {
    const from = positions[transition.from];
    const to = positions[transition.to];

    if (!from || !to) {
      return;
    }

    if (transition.from === transition.to) {
      drawLoop(context, from.x, from.y, transition.symbol);
      return;
    }

    const isReverseEdge = nfa.transitions.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index &&
        candidate.from === transition.to &&
        candidate.to === transition.from
    );

    drawArrow(context, from.x, from.y, to.x, to.y, transition.symbol, isReverseEdge ? 34 : 0);
  });

  nfa.states.forEach((state) => {
    const { x, y } = positions[state];
    context.beginPath();
    context.fillStyle = "#fffdfa";
    context.arc(x, y, 32, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (state === nfa.accept) {
      context.beginPath();
      context.arc(x, y, 25, 0, Math.PI * 2);
      context.stroke();
    }

    context.fillStyle = "#1f1a14";
    context.fillText(`q${state}`, x, y + 5);
  });

  const start = positions[nfa.start];
  context.beginPath();
  context.moveTo(start.x - 70, start.y);
  context.lineTo(start.x - 34, start.y);
  context.stroke();
  drawArrowHead(context, start.x - 34, start.y, start.x - 18, start.y);
}

function drawDFA(dfa, canvas) {
  const columns = Math.max(3, Math.ceil(Math.sqrt(dfa.states.length)));
  const horizontalGap = dfa.states.length > 12 ? 250 : 225;
  const verticalGap = 225;
  const rows = Math.max(1, Math.ceil(dfa.states.length / columns));
  const width = Math.max(canvas.parentElement.clientWidth, columns * horizontalGap + 170);
  const height = Math.max(620, rows * verticalGap + 150);
  const { context } = prepareCanvas(canvas, width, height);

  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#0e6b61";
  context.fillStyle = "#1f1a14";
  context.lineWidth = 2.5;
  context.font = "16px Space Grotesk";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const positions = {};

  dfa.states.forEach((state, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 110 + column * horizontalGap;
    const y = 130 + row * verticalGap;
    positions[state.key] = { x, y };
  });

  const drawn = new Set();

  dfa.states.forEach((state) => {
    const from = positions[state.key];
    const transitions = dfa.transitionMap[state.key] || {};

    Object.entries(transitions).forEach(([symbol, nextKey]) => {
      const edgeKey = `${state.key}-${symbol}-${nextKey}`;
      if (drawn.has(edgeKey)) {
        return;
      }
      drawn.add(edgeKey);

      const to = positions[nextKey];
      if (!to) {
        return;
      }

      if (state.key === nextKey) {
        drawLoop(context, from.x, from.y, symbol);
        return;
      }

      const isReverseEdge = Object.entries(dfa.transitionMap[nextKey] || {}).some(
        ([nextSymbol, returnKey]) => returnKey === state.key && nextSymbol !== symbol
      );

      drawArrow(context, from.x, from.y, to.x, to.y, symbol, isReverseEdge ? 36 : 0);
    });
  });

  dfa.states.forEach((state) => {
    const { x, y } = positions[state.key];
    context.beginPath();
    context.fillStyle = "#fffdfa";
    context.arc(x, y, 32, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (state.isAccept) {
      context.beginPath();
      context.arc(x, y, 25, 0, Math.PI * 2);
      context.stroke();
    }

    context.fillStyle = "#1f1a14";
    context.fillText(dfa.stateLabels[state.key], x, y);
    drawStateDetails(context, state.label, x, y + 58);
  });

  const start = positions[dfa.startKey];
  context.beginPath();
  context.moveTo(start.x - 70, start.y);
  context.lineTo(start.x - 34, start.y);
  context.stroke();
  drawArrowHead(context, start.x - 34, start.y, start.x - 18, start.y);
}

function drawArrow(context, x1, y1, x2, y2, label, curveOffset = 0) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const startX = x1 + Math.cos(angle) * 36;
  const startY = y1 + Math.sin(angle) * 36;
  const endX = x2 - Math.cos(angle) * 36;
  const endY = y2 - Math.sin(angle) * 36;

  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const controlX = midX + normalX * curveOffset;
  const controlY = midY + normalY * curveOffset;

  context.beginPath();
  context.moveTo(startX, startY);

  if (curveOffset === 0) {
    context.lineTo(endX, endY);
  } else {
    context.quadraticCurveTo(controlX, controlY, endX, endY);
  }

  context.stroke();

  const arrowBaseX = curveOffset === 0 ? startX : controlX;
  const arrowBaseY = curveOffset === 0 ? startY : controlY;
  drawArrowHead(context, arrowBaseX, arrowBaseY, endX, endY);

  const labelY = controlY - (curveOffset === 0 ? 16 : 8);
  drawEdgeLabel(context, label, controlX, labelY);
}

function drawArrowHead(context, startX, startY, endX, endY) {
  const angle = Math.atan2(endY - startY, endX - startX);
  const size = 11;

  context.beginPath();
  context.moveTo(endX, endY);
  context.lineTo(endX - size * Math.cos(angle - Math.PI / 6), endY - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(endX - size * Math.cos(angle + Math.PI / 6), endY - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fillStyle = "#0e6b61";
  context.fill();
}

function drawLoop(context, x, y, label) {
  const radiusX = 24;
  const radiusY = 30;
  const loopCenterY = y - 52;

  context.beginPath();
  context.ellipse(x, loopCenterY, radiusX, radiusY, 0, 0.18 * Math.PI, 1.82 * Math.PI);
  context.stroke();

  const arrowTipX = x + 10;
  const arrowTipY = y - 22;
  const arrowBaseX = x + 24;
  const arrowBaseY = y - 34;

  drawArrowHead(context, arrowBaseX, arrowBaseY, arrowTipX, arrowTipY);
  drawEdgeLabel(context, label, x, loopCenterY - radiusY - 14);
}

function drawEdgeLabel(context, label, x, y) {
  context.save();
  context.font = "bold 15px Space Grotesk";

  const paddingX = 8;
  const metrics = context.measureText(label);
  const width = metrics.width + paddingX * 2;
  const height = 24;
  const left = x - width / 2;
  const top = y - height / 2;

  context.fillStyle = "rgba(255, 253, 250, 0.96)";
  context.strokeStyle = "rgba(187, 108, 47, 0.35)";
  context.lineWidth = 1;
  roundRectPath(context, left, top, width, height, 8);
  context.fill();
  context.stroke();

  context.fillStyle = "#8a4f1e";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x, y + 1);
  context.restore();
}

function drawStateDetails(context, text, x, y) {
  context.save();
  context.font = "13px Space Grotesk";

  const lines = wrapText(text, 22);
  const lineHeight = 17;
  const paddingX = 10;
  const paddingY = 8;
  const maxWidth = Math.max(...lines.map((line) => context.measureText(line).width), 34);
  const boxWidth = maxWidth + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const left = x - boxWidth / 2;
  const top = y - boxHeight / 2;

  context.fillStyle = "rgba(255, 253, 250, 0.96)";
  context.strokeStyle = "rgba(14, 107, 97, 0.22)";
  context.lineWidth = 1;
  roundRectPath(context, left, top, boxWidth, boxHeight, 10);
  context.fill();
  context.stroke();

  context.fillStyle = "#4a4034";
  context.textAlign = "center";
  context.textBaseline = "middle";

  lines.forEach((line, index) => {
    const lineY = top + paddingY + lineHeight / 2 + index * lineHeight;
    context.fillText(line, x, lineY);
  });

  context.restore();
}

function roundRectPath(context, x, y, width, height, radius) {
  if (typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    return;
  }

  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function wrapText(text, maxCharsPerLine) {
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const parts = text.split(", ");
  const lines = [];
  let currentLine = "";

  parts.forEach((part, index) => {
    const segment = index === parts.length - 1 ? part : `${part}, `;

    if ((currentLine + segment).length <= maxCharsPerLine) {
      currentLine += segment;
      return;
    }

    if (currentLine) {
      lines.push(currentLine.trim());
    }

    currentLine = segment;
  });

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines.length ? lines : [text];
}

function prepareCanvas(canvas, logicalWidth, logicalHeight) {
  const context = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.width = Math.floor(logicalWidth * dpr);
  canvas.height = Math.floor(logicalHeight * dpr);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(dpr, dpr);

  return { context, logicalWidth, logicalHeight };
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
}

function downloadTextFile(fileName, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
