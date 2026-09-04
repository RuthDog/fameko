import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL("../../app/app/page.tsx", import.meta.url),
  "utf8",
);
const menuSource = readFileSync(
  new URL("../../app/components/anchored-context-menu.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

function count(source: string, value: string) {
  return source.split(value).length - 1;
}

test("desktop month header uses the viewport top because Workspace chrome is not fixed", () => {
  assert.match(
    workspaceSource,
    /const desktopStickyMonthHeader\s*=\s*["']sticky top-0 z-\[15\] bg-white["']/,
  );
  assert.match(workspaceSource, /data-planning-month-header="sticky"/);
  assert.match(workspaceSource, /data-planning-month-scroll="horizontal"/);
  assert.match(
    workspaceSource,
    /<main className="min-h-screen overflow-x-clip bg-\[#f7f5ef\] text-stone-950">/,
  );
  assert.equal(count(globalStyles, "overflow-x: clip"), 2);
  assert.equal(count(globalStyles, "overflow-x: hidden"), 0);
});

test("top-left intersection is above the ordinary sticky label and header cells", () => {
  assert.match(
    workspaceSource,
    /desktopStickyLabelCell\s*=\s*["']sticky left-0 z-10 bg-white/,
  );
  assert.match(
    workspaceSource,
    /desktopStickyLabelCell\} z-20 min-h-14[^>]+data-planning-header-intersection="true"/s,
  );
  assert.match(workspaceSource, /relative z-10 flex min-h-14/);
});

test("the existing current-month background, marker and NU label stay in the sticky header", () => {
  const headerStart = workspaceSource.indexOf(
    'data-planning-month-header="sticky"',
  );
  const bodyStart = workspaceSource.indexOf(
    'data-planning-year-scroll="horizontal"',
  );
  const headerSource = workspaceSource.slice(headerStart, bodyStart);

  assert.match(headerSource, /current\s*\?\s*"bg-\[#edf2ec\] text-stone-950"/);
  assert.match(headerSource, />\s*NU\s*</);
  assert.match(headerSource, /current \? "h-0\.5 bg-emerald-800"/);
  assert.equal(count(workspaceSource, "data-planning-month-header-grid"), 1);
});

test("month header and unchanged year-grid scrollports synchronize only horizontal scroll", () => {
  assert.match(
    workspaceSource,
    /overflow-x-auto overflow-y-hidden overscroll-x-contain[^>]+data-planning-month-scroll="horizontal"/s,
  );
  assert.match(
    workspaceSource,
    /className="mx-auto hidden max-w-\[1560px\] overflow-x-auto overscroll-x-contain lg:block"/,
  );
  assert.match(workspaceSource, /data-planning-year-scroll="horizontal"/);
  assert.match(
    workspaceSource,
    /syncHorizontalScroll\(event\.currentTarget, yearGridScrollRef\.current\)/,
  );
  assert.match(
    workspaceSource,
    /syncHorizontalScroll\(event\.currentTarget, monthHeaderScrollRef\.current\)/,
  );
  assert.doesNotMatch(workspaceSource, /scrollTop\s*=/);
});

test("portal context menus remain above every table layer", () => {
  assert.match(menuSource, /createPortal\(/);
  assert.match(menuSource, /className="fixed z-40/);
  assert.match(workspaceSource, /sticky top-0 z-\[15\]/);
});

test("desktop planning widens only the shared sticky label column", () => {
  const grid = "min-w-[1432px] grid-cols-[256px_96px_repeat(12,minmax(90px,1fr))]";

  assert.equal(count(workspaceSource, grid), 2);
  assert.equal(count(workspaceSource, "grid-cols-[208px_96px_repeat(12,minmax(90px,1fr))]"), 0);
  assert.match(workspaceSource, /desktopStickyLabelCell\s*=\s*["']sticky left-0 z-10/);
  assert.match(workspaceSource, /data-planning-header-intersection="true"/);
});
