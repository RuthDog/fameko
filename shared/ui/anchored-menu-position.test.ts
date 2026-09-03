import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getAnchoredMenuPosition } from "./anchored-menu-position.ts";

test("menu opens to the right and below its trigger when space is available", () => {
  assert.deepEqual(
    getAnchoredMenuPosition(
      { bottom: 128, height: 28, left: 100, right: 128, top: 100, width: 28 },
      { height: 88, width: 144 },
      { height: 800, width: 1200 },
    ),
    { left: 134, opensUpward: false, top: 134 },
  );
});

test("menu near the right viewport edge opens to the left", () => {
  const position = getAnchoredMenuPosition(
    { bottom: 228, height: 28, left: 1160, right: 1188, top: 200, width: 28 },
    { height: 88, width: 144 },
    { height: 800, width: 1200 },
  );

  assert.equal(position.left, 1_010);
  assert.equal(position.left + 144 <= 1_192, true);
});

test("menu near the bottom viewport edge opens upward", () => {
  const position = getAnchoredMenuPosition(
    { bottom: 788, height: 28, left: 300, right: 328, top: 760, width: 28 },
    { height: 88, width: 144 },
    { height: 800, width: 1200 },
  );

  assert.deepEqual(position, { left: 334, opensUpward: true, top: 666 });
});

test("menu coordinates remain inside a constrained viewport", () => {
  const position = getAnchoredMenuPosition(
    { bottom: 430, height: 28, left: 410, right: 438, top: 402, width: 28 },
    { height: 88, width: 144 },
    { height: 430, width: 430 },
  );

  assert.equal(position.left >= 8, true);
  assert.equal(position.left + 144 <= 422, true);
  assert.equal(position.top >= 8, true);
  assert.equal(position.top + 88 <= 422, true);
});

test("context menu is portaled beyond table clipping and closes on outside, scroll and Escape", () => {
  const menuSource = readFileSync(
    new URL("../../app/components/anchored-context-menu.tsx", import.meta.url),
    "utf8",
  );

  assert.match(menuSource, /createPortal\(/);
  assert.match(menuSource, /document\.body/);
  assert.match(menuSource, /document\.addEventListener\("pointerdown", closeFromOutside\)/);
  assert.match(menuSource, /window\.addEventListener\("scroll", closeFromViewportChange, true\)/);
  assert.match(menuSource, /event\.key === "Escape"/);
  assert.match(menuSource, /triggerRef\.current\?\.focus\(\)/);
  assert.match(menuSource, /role="menu"/);
  assert.match(menuSource, /role="menuitem"/);
  assert.match(menuSource, /className="fixed z-40/);
});

test("expense actions retain edit and destructive delete behavior", () => {
  const workspaceSource = readFileSync(new URL("../../app/app/page.tsx", import.meta.url), "utf8");

  assert.match(workspaceSource, /\{ label: "Ändra", onSelect: onEdit \}/);
  assert.match(
    workspaceSource,
    /\{ label: "Ta bort", onSelect: onDelete, tone: "destructive" \}/,
  );
  assert.match(workspaceSource, /onEdit=\{\(\) => onEditExpense\(itemId\)\}/);
  assert.match(workspaceSource, /onDelete=\{\(\) => onRequestDelete/);
});
