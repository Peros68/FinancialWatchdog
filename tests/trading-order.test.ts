import { describe, it, expect } from "vitest";
import { orderTabs, moveKey, tabKey, resolveSelectedSymbol, type TradingTab } from "../client/src/lib/trading";

const w = (id: number, name: string): TradingTab => ({ key: tabKey("watchlist", id), kind: "watchlist", id, name });
const p = (id: number, name: string): TradingTab => ({ key: tabKey("portfolio", id), kind: "portfolio", id, name });

describe("tabKey", () => {
  it("prefixes by kind", () => {
    expect(tabKey("watchlist", 3)).toBe("w:3");
    expect(tabKey("portfolio", 1)).toBe("p:1");
  });
});

describe("orderTabs", () => {
  const all = [w(1, "Tech"), w(2, "Blue"), p(1, "Reale")];

  it("respects the stored order, then appends new tabs", () => {
    const ordered = orderTabs(all, ["p:1", "w:2"]);
    expect(ordered.map((t) => t.key)).toEqual(["p:1", "w:2", "w:1"]); // w:1 is new → appended
  });

  it("drops stored keys that no longer exist", () => {
    const ordered = orderTabs(all, ["w:99", "p:1"]);
    expect(ordered.map((t) => t.key)).toEqual(["p:1", "w:1", "w:2"]);
  });

  it("with no stored order keeps natural order", () => {
    expect(orderTabs(all, []).map((t) => t.key)).toEqual(["w:1", "w:2", "p:1"]);
  });
});

describe("resolveSelectedSymbol", () => {
  const syms = ["AAPL", "ENI.MI", "MSFT"];

  it("keeps the current symbol when it still belongs to the collection", () => {
    expect(resolveSelectedSymbol(syms, "ENI.MI")).toBe("ENI.MI");
  });

  it("falls back to the first symbol when the current one is null (e.g. after navigation lost it)", () => {
    expect(resolveSelectedSymbol(syms, null)).toBe("AAPL");
  });

  it("falls back to the first symbol when the current one is not in the collection (tab switched)", () => {
    expect(resolveSelectedSymbol(syms, "TSLA")).toBe("AAPL");
  });

  it("preserves the current value while the collection is empty/loading (no flicker to null)", () => {
    expect(resolveSelectedSymbol([], "AAPL")).toBe("AAPL");
    expect(resolveSelectedSymbol([], null)).toBeNull();
  });
});

describe("moveKey", () => {
  it("moves a key to the target position", () => {
    expect(moveKey(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveKey(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("is a no-op for equal or missing keys", () => {
    expect(moveKey(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moveKey(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});
