import { XMLParser } from "fast-xml-parser";
import { parseAmount, round2 } from "./money";

export type GaebItem = {
  rno: string;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
};

export type GaebFile = {
  dp: string;
  projectName: string;
  boqName: string;
  currency: string;
  date: string;
  items: GaebItem[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function asArray(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ").replace(/\s+/g, " ").trim();
  if (typeof node === "object") {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, value]) => textOf(value))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function readItem(node: unknown, prefix: string): GaebItem {
  const item = node as Record<string, unknown>;
  const part = String(item["@_RNoPart"] ?? item["@_RNoIndex"] ?? "").trim();
  const description = item.Description as Record<string, unknown> | undefined;
  const complete = description?.CompleteText as Record<string, unknown> | undefined;
  const outline = textOf(complete?.OutlineText);
  const detail = textOf(complete?.DetailTxt);
  const title = outline || detail || textOf(description) || "Position";
  const quantity = parseAmount(textOf(item.Qty));
  const unit = textOf(item.QU) || "Stk";
  const priceRaw = item.UP === undefined ? undefined : parseAmount(textOf(item.UP));
  return {
    rno: [prefix, part].filter(Boolean).join("."),
    title,
    description: detail && detail !== title ? detail : undefined,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    unit,
    unitPrice: priceRaw !== undefined && Number.isFinite(priceRaw) ? priceRaw : undefined,
  };
}

function walkBody(body: unknown, prefix: string, items: GaebItem[]) {
  for (const node of asArray(body as Record<string, unknown>)) {
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    for (const category of asArray(record.BoQCtgy)) {
      const part = String(category["@_RNoPart"] ?? "").trim();
      const next = [prefix, part].filter(Boolean).join(".");
      walkBody(category.BoQBody, next, items);
    }
    for (const list of asArray(record.Itemlist)) {
      for (const item of asArray(list.Item)) {
        items.push(readItem(item, prefix));
      }
    }
    if (record.Qty !== undefined && record.Description) {
      items.push(readItem(record, prefix));
    }
  }
}

export function parseGaeb(xml: string): GaebFile {
  const root = parser.parse(xml) as Record<string, unknown>;
  const gaeb = (root.GAEB ?? root) as Record<string, unknown>;
  const award = (gaeb.Award ?? {}) as Record<string, unknown>;
  const boq = asArray(award.BoQ)[0] ?? {};
  const info = (boq.BoQInfo ?? {}) as Record<string, unknown>;
  const project = (gaeb.PrjInfo ?? {}) as Record<string, unknown>;
  const items: GaebItem[] = [];
  walkBody(boq.BoQBody, "", items);
  if (items.length === 0) throw new Error("Die GAEB-Datei enthält keine Positionen der unterstützten Teilmenge.");
  return {
    dp: textOf(award.DP) || "83",
    projectName: textOf(project.NamePrj) || textOf(project.LblPrj) || "Import",
    boqName: textOf(info.Name) || textOf(info.LblBoQ) || "Leistungsverzeichnis",
    currency: textOf(project.Cur) || "EUR",
    date: textOf(info.Date) || new Date().toISOString().slice(0, 10),
    items,
  };
}

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportGaeb(file: GaebFile) {
  const groups = new Map<string, { part: string; item: GaebItem }[]>();
  for (const item of file.items) {
    const bits = item.rno.split(".").filter(Boolean);
    const category = bits.length > 1 ? bits[0] : "01";
    const part = bits.length > 1 ? bits.slice(1).join(".") : item.rno || "0010";
    const list = groups.get(category) ?? [];
    list.push({ part, item });
    groups.set(category, list);
  }
  const categories = [...groups.entries()]
    .map(([category, entries]) => {
      const items = entries
        .map(({ part, item }) => {
          const total =
            item.unitPrice === undefined ? "" : `<IT>${round2(item.quantity * item.unitPrice).toFixed(2)}</IT>`;
          const price = item.unitPrice === undefined ? "" : `<UP>${round2(item.unitPrice).toFixed(2)}</UP>`;
          return `              <Item RNoPart="${xml(part)}">
                <Qty>${item.quantity}</Qty>
                <QU>${xml(item.unit || "Stk")}</QU>
                <Description>
                  <CompleteText>
                    <OutlineText><OutlTxt><TextOutlTxt><span>${xml(item.title)}</span></TextOutlTxt></OutlTxt></OutlineText>
                    <DetailTxt><Text><span>${xml(item.description || item.title)}</span></Text></DetailTxt>
                  </CompleteText>
                </Description>
                ${price}
                ${total}
              </Item>`;
        })
        .join("\n");
      return `        <BoQCtgy RNoPart="${xml(category)}">
          <LblTx><span>Bereich ${xml(category)}</span></LblTx>
          <BoQBody>
            <Itemlist>
${items}
            </Itemlist>
          </BoQBody>
        </BoQCtgy>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Werkplan GAEB-Teilmenge DA XML, Austauschphase X${xml(file.dp)} -->
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.3">
  <GAEBInfo>
    <Version>3.3</Version>
    <VersDate>2019-05</VersDate>
    <Date>${xml(file.date)}</Date>
    <ProgSystem>Werkplan</ProgSystem>
    <ProgName>Werkplan</ProgName>
  </GAEBInfo>
  <PrjInfo>
    <NamePrj>${xml(file.projectName)}</NamePrj>
    <LblPrj>${xml(file.boqName)}</LblPrj>
    <Cur>${xml(file.currency || "EUR")}</Cur>
  </PrjInfo>
  <Award>
    <DP>${xml(file.dp)}</DP>
    <BoQ>
      <BoQInfo>
        <Name>${xml(file.boqName)}</Name>
        <LblBoQ>${xml(file.boqName)}</LblBoQ>
        <Date>${xml(file.date)}</Date>
      </BoQInfo>
      <BoQBody>
${categories}
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>
`;
}
