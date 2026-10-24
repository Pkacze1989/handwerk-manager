type Token =
  | { type: "num"; value: number }
  | { type: "id"; value: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lp" }
  | { type: "rp" };

const ident = /^[A-Za-z_][A-Za-z0-9_]*/;

export function evaluateExpression(expression: string, inputs: Record<string, number>) {
  const tokens = tokenize(expression);
  let index = 0;

  function peek() {
    return tokens[index];
  }
  function take() {
    const token = tokens[index];
    index += 1;
    return token;
  }

  function parseExpr(): number {
    let value = parseTerm();
    while (peek()?.type === "op" && (peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (take() as { value: "+" | "-" }).value;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek()?.type === "op" && (peek() as { value: string }).value.match(/^[*/]$/)) {
      const op = (take() as { value: "*" | "/" }).value;
      const right = parseFactor();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseFactor(): number {
    const token = peek();
    if (!token) throw new Error("Formel ist unvollständig.");
    if (token.type === "op" && token.value === "-") {
      take();
      return -parseFactor();
    }
    if (token.type === "num") {
      take();
      return token.value;
    }
    if (token.type === "id") {
      take();
      if (!(token.value in inputs)) throw new Error(`Unbekannte Größe „${token.value}“.`);
      return inputs[token.value];
    }
    if (token.type === "lp") {
      take();
      const value = parseExpr();
      if (peek()?.type !== "rp") throw new Error("Schließende Klammer fehlt.");
      take();
      return value;
    }
    throw new Error("Formel enthält ein nicht erlaubtes Zeichen.");
  }

  const result = parseExpr();
  if (index < tokens.length) throw new Error("Formel enthält einen überzähligen Teil.");
  if (!Number.isFinite(result)) throw new Error("Die Formel ergibt keine endliche Zahl.");
  return result;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = expression.trim();
  if (!src) throw new Error("Formel ist leer.");
  while (i < src.length) {
    const char = src[i];
    if (char === " " || char === "\n" || char === "\t") {
      i += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "lp" });
      i += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rp" });
      i += 1;
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if ((char >= "0" && char <= "9") || char === ".") {
      const start = i;
      i += 1;
      while (i < src.length && /[0-9.]/.test(src[i])) i += 1;
      const raw = src.slice(start, i);
      if (!/^\d+(\.\d+)?$/.test(raw) && !/^\.\d+$/.test(raw)) {
        throw new Error(`Zahl „${raw}“ ist ungültig. Bitte den Punkt als Dezimalzeichen verwenden.`);
      }
      tokens.push({ type: "num", value: Number(raw) });
      continue;
    }
    const rest = src.slice(i);
    const match = ident.exec(rest);
    if (match) {
      tokens.push({ type: "id", value: match[0] });
      i += match[0].length;
      continue;
    }
    throw new Error(`Zeichen „${char}“ ist in Formeln nicht erlaubt.`);
  }
  return tokens;
}
