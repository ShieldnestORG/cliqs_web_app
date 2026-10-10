/**
 * Button Icon Margins Guard
 *
 * File: __tests__/components/button-icon-margins.test.ts
 *
 * The Button spaces its children itself (`gap-2`, 8px, the house style's value; docs/ui/BUTTONS-PRD.md).
 * An icon or text span inside a <Button> that also carries a side margin doubles that space, so
 * the button shows about 16px between icon and label (35 sites in 11 files, removed 2026-10-10).
 * This scans every .tsx under components/ and pages/ and fails when an element INSIDE a
 * <Button>...</Button> carries a numeric (or bracketed) side margin: mr-*, ml-*, mx-*, ms-*, me-*,
 * with or without a variant chain (`sm:ml-2`, `hover:mr-1`, `[&>svg]:mr-2`,
 * `data-[state=open]:ml-1`). The margin on the Button element itself is fine: it spaces the button
 * from its neighbours. What IS flagged on the Button's own className is a margin aimed at its
 * children, such as `[&>svg]:mr-2`, `[&_svg]:ml-1` or `*:mx-1`.
 *
 * What counts as a button: `Button`, `AlertDialogAction` and `AlertDialogCancel` (both render
 * through buttonVariants, so they carry the same gap-2).
 *
 * A class held in a name does not hide: a `className={ICON_CLS}` or `{icon}` inside a Button is
 * followed to the `const` / `function` in the SAME file that defines it, and what that holds is
 * scanned too (a margin held in `const ICON_CLS = "mr-1 h-4 w-4"` was invisible to the first
 * scanner, which read only the class text written inside the attribute).
 *
 * Remaining limits, stated rather than hidden (the guard cannot see these):
 *  - a class passed as a PROP to a component that puts it on an icon inside a Button
 *    (`<Row iconClass="mr-2" />`): the margin is a string in the call, not in the Button's tree;
 *  - an ALIASED import (`import { Button as Btn } from ...`): only the local names `Button`,
 *    `AlertDialogAction` and `AlertDialogCancel` are recognised;
 *  - a class imported from ANOTHER file (a shared `const`, a `cva` helper), and an element
 *    rendered by a component defined in another file whose own markup carries the margin;
 *  - a margin written as an inline `style`, or as a Tailwind plugin class.
 *
 * The scanner is checked on inline sources first, so a scanner that finds nothing goes red here
 * instead of making the real scan pass for the wrong reason.
 *
 * Priority: P2
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

const ROOT = path.resolve(__dirname, "../..");

/** A site that has to keep its margin. Empty on purpose: each entry says why. */
const ALLOWED: ReadonlyArray<{ file: string; classes: string; why: string }> = [];

// A side or all-sides margin, or `space-x`, with a number, `px` or a bracket value (not `auto`), with any variant chain in front:
// `sm:`, `hover:`, `data-[state=open]:`, `[&>svg]:`, `*:`. A variant atom is a word, a word with a
// bracket part, or a bare bracket selector.
const VARIANT = String.raw`(?:[\w*-]*\[\S*?\][\w-]*|[\w*-]+):`;
const MARGIN = new RegExp(
  String.raw`(?<![\w:*\]-])(?:${VARIANT})*-?(?:m[rlxse]?|space-x)-(?:\d|\[|px\b)[^\s"'\`}]*`,
  "g",
);
/** On the Button's own className only a margin aimed at its children counts. */
const CHILD_MARGIN = /\[&[>_ ]|(?:^|:)\*{1,2}:/;

interface Hit {
  file: string;
  line: number;
  classes: string;
}

interface Scan {
  buttons: number;
  hits: Hit[];
}

/** Every name the file declares, with the code behind it: `const X = <init>`, `function X() {...}`. */
function declarationsByName(source: ts.SourceFile): Map<string, ts.Node[]> {
  const declared = new Map<string, ts.Node[]>();
  const add = (name: string, code: ts.Node) =>
    declared.set(name, [...(declared.get(name) ?? []), code]);
  const walk = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      add(node.name.text, node.initializer);
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body) add(node.name.text, node.body);
    ts.forEachChild(node, walk);
  };
  walk(source);
  return declared;
}

/**
 * The class text a className expression can produce: what is written in it, plus (transitively)
 * the code behind every name in it that this file declares. Over-inclusive on purpose: a name
 * that also exists in another scope only makes the guard stricter, never blind.
 */
function classTexts(expr: ts.Node, declared: Map<string, ts.Node[]>): string[] {
  const texts = [expr.getText()];
  const seen = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      seen.add(node.text);
      for (const code of declared.get(node.text) ?? []) {
        texts.push(code.getText());
        visit(code);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(expr);
  return texts;
}

/** Elements that render through buttonVariants and so carry its gap-2. */
const BUTTON_TAGS = new Set(["Button", "AlertDialogAction", "AlertDialogCancel"]);

function scanSource(file: string, text: string): Scan {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declared = declarationsByName(source);
  const result: Scan = { buttons: 0, hits: [] };
  const reported = new Set<string>();

  // `seen` is per Button: a name used inside it is expanded once, so a loop of names ends.
  const checkInside = (node: ts.Node, seen: Set<string>) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && attr.name.getText() === "className" && attr.initializer) {
          const found = [
            ...new Set(
              classTexts(attr.initializer, declared).flatMap((t) => t.match(MARGIN) ?? []),
            ),
          ];
          const { line } = source.getLineAndCharacterOfPosition(attr.getStart());
          const key = `${line}:${found.join(" ")}`;
          if (found.length && !reported.has(key)) {
            reported.add(key);
            result.hits.push({ file, line: line + 1, classes: found.join(" ") });
          }
        }
      }
    }
    // `{icon}` inside a Button: the element it names is inside the Button too
    if (ts.isIdentifier(node) && !seen.has(node.text)) {
      seen.add(node.text);
      for (const code of declared.get(node.text) ?? []) checkInside(code, seen);
    }
    ts.forEachChild(node, (child) => checkInside(child, seen));
  };

  /** The Button's own className: a margin aimed at its children doubles the gap too. */
  const checkOwn = (opening: ts.JsxOpeningElement) => {
    for (const attr of opening.attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.name.getText() === "className" && attr.initializer) {
        const found = [
          ...new Set(classTexts(attr.initializer, declared).flatMap((t) => t.match(MARGIN) ?? [])),
        ].filter((cls) => CHILD_MARGIN.test(cls));
        const { line } = source.getLineAndCharacterOfPosition(attr.getStart());
        const key = `${line}:${found.join(" ")}`;
        if (found.length && !reported.has(key)) {
          reported.add(key);
          result.hits.push({ file, line: line + 1, classes: found.join(" ") });
        }
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && BUTTON_TAGS.has(node.openingElement.tagName.getText())) {
      result.buttons += 1;
      checkOwn(node.openingElement);
      const seen = new Set<string>();
      for (const child of node.children) checkInside(child, seen);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
}

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("Button icon margin scanner: P2", () => {
  it("flags mr-* and ml-* on an icon, a span and a link inside a Button", () => {
    const { hits, buttons } = scanSource(
      "a.tsx",
      `const A = () => (
        <>
          <Button><Plus className="mr-2 h-4 w-4" />Add</Button>
          <Button>Go <ArrowRight className="ml-1" /></Button>
          <Button><span className="text-xs mr-1">3</span></Button>
          <Button asChild><a href="x"><Icon className={\`h-4 \${busy ? "animate-spin" : ""} mr-1.5\`} /></a></Button>
          <Button><Icon className="sm:ml-2" /><Icon className="ml-[3px]" /></Button>
        </>
      );`,
    );

    expect(buttons).toBe(5);
    expect(hits.map((h) => h.classes)).toEqual([
      "mr-2",
      "ml-1",
      "mr-1",
      "mr-1.5",
      "sm:ml-2",
      "ml-[3px]",
    ]);
  });

  it("lets the Button's own margin, mx-auto and spacing from siblings alone", () => {
    const { hits, buttons } = scanSource(
      "b.tsx",
      `const B = () => (
        <>
          <Button className="ml-2">Add</Button>
          <Button className="ml-auto"><Plus className="h-4 w-4" />Add</Button>
          <Button><Icon className="mx-auto h-4" /></Button>
          <span className="mr-2"><Button>Add</Button></span>
          <Icon className="mr-2" />
        </>
      );`,
    );

    expect(buttons).toBe(4);
    expect(hits).toEqual([]);
  });
});

describe("Button icon margin scanner covers every side margin and bracketed selectors: P2", () => {
  it("flags mx-*, ms-* and me-* like mr-* and ml-*, negative and bracketed ones too", () => {
    const { hits } = scanSource(
      "h.tsx",
      `const H = () => (
        <>
          <Button><Plus className="mx-1 h-4" />Add</Button>
          <Button><Plus className="ms-2" />Add</Button>
          <Button><Plus className="me-1.5" />Add</Button>
          <Button><Plus className="-mx-1" />Add</Button>
          <Button><Plus className="mx-[3px]" />Add</Button>
          <Button><Plus className="md:mx-2" />Add</Button>
        </>
      );`,
    );

    expect(hits.map((h) => h.classes)).toEqual([
      "mx-1",
      "ms-2",
      "me-1.5",
      "-mx-1",
      "mx-[3px]",
      "md:mx-2",
    ]);
  });

  it("flags an all-sides margin, space-x and a px value too", () => {
    const { hits } = scanSource(
      "n.tsx",
      `const N = () => (
        <>
          <Button><Plus className="m-2 h-4" />Add</Button>
          <Button><span className="space-x-2"><Plus /><Plus /></span>Add</Button>
          <Button><Plus className="mr-px" />Add</Button>
        </>
      );`,
    );

    expect(hits.map((h) => h.classes)).toEqual(["m-2", "space-x-2", "mr-px"]);
  });

  it("flags a margin behind a bracketed selector or a bracketed variant on a child", () => {
    const { hits } = scanSource(
      "i.tsx",
      `const I = () => (
        <>
          <Button><span className="[&>svg]:mr-2">x</span></Button>
          <Button><span className="hover:[&_svg]:ml-1">x</span></Button>
          <Button><span className="data-[state=open]:mr-2">x</span></Button>
          <Button><span className="has-[>svg]:ml-1">x</span></Button>
          <Button><span className="[&_svg:not([class*='size-'])]:mr-2">x</span></Button>
          <Button><span className="group-data-[open=true]:sm:mx-1">x</span></Button>
        </>
      );`,
    );

    expect(hits.map((h) => h.classes)).toEqual([
      "[&>svg]:mr-2",
      "hover:[&_svg]:ml-1",
      "data-[state=open]:mr-2",
      "has-[>svg]:ml-1",
      "[&_svg:not([class*='size-'])]:mr-2",
      "group-data-[open=true]:sm:mx-1",
    ]);
  });

  it("flags a margin aimed at the children from the Button's own className, not its own margin", () => {
    const { hits, buttons } = scanSource(
      "j.tsx",
      `const J = () => (
        <>
          <Button className="[&>svg]:mr-2">Add</Button>
          <Button className="px-3 [&_svg]:ml-1 *:mx-1">Add</Button>
          <Button className="ml-2 mr-4 mx-auto sm:mr-4 [&>svg]:size-4 [&>svg]:mr-auto">Add</Button>
          <Button className="[&:hover]:ml-2 data-[state=open]:mr-2">Add</Button>
        </>
      );`,
    );

    expect(buttons).toBe(4);
    expect(hits.map((h) => h.classes)).toEqual(["[&>svg]:mr-2", "[&_svg]:ml-1 *:mx-1"]);
  });

  it("still lets mx-auto and the auto margins alone, bracketed or not", () => {
    const { hits } = scanSource(
      "k.tsx",
      `const K = () => (
        <>
          <Button><Icon className="mx-auto" /></Button>
          <Button><Icon className="[&>svg]:mx-auto ml-auto me-auto" /></Button>
        </>
      );`,
    );

    expect(hits).toEqual([]);
  });

  it("treats AlertDialogAction and AlertDialogCancel as buttons", () => {
    const { hits, buttons } = scanSource(
      "l.tsx",
      `const L = () => (
        <AlertDialog>
          <AlertDialogTitle><Icon className="mr-2" />Title, not a button</AlertDialogTitle>
          <AlertDialogCancel><Icon className="mr-2" />Cancel</AlertDialogCancel>
          <AlertDialogAction><Icon className="sm:ml-1" />Go</AlertDialogAction>
          <AlertDialogCancel className="[&>svg]:ml-1">Cancel</AlertDialogCancel>
          <AlertDialogAction className="ml-2">Go</AlertDialogAction>
        </AlertDialog>
      );`,
    );

    expect(buttons).toBe(4);
    expect(hits.map((h) => h.classes)).toEqual(["mr-2", "sm:ml-1", "[&>svg]:ml-1"]);
  });

  it("does not see what the header says it cannot: an aliased import and a class passed as a prop", () => {
    const { hits, buttons } = scanSource(
      "m.tsx",
      `import { Button as Btn } from "@/components/ui/button";
      const M = () => (
        <>
          <Btn><Icon className="mr-2" />Aliased</Btn>
          <Button><Row iconClass="mr-2" />Prop</Button>
        </>
      );`,
    );

    expect(buttons).toBe(1);
    expect(hits).toEqual([]);
  });
});

describe("Button icon margin scanner follows names declared in the file: P2", () => {
  it("flags a margin held in a const string", () => {
    const { hits, buttons } = scanSource(
      "c.tsx",
      `const ICON_CLS = "mr-1 h-4 w-4";
      const C = () => <Button><Plus className={ICON_CLS} />Add</Button>;`,
    );

    expect(buttons).toBe(1);
    expect(hits.map((h) => `${h.line} ${h.classes}`)).toEqual(["2 mr-1"]);
  });

  it("follows a chain of names, a template, an object property and a function", () => {
    const { hits } = scanSource(
      "d.tsx",
      `const GAP = "ml-2";
      const ICON = \`h-4 \${GAP}\`;
      const styles = { icon: "mr-2 h-4" };
      function spin(busy: boolean) { return busy ? "mr-1.5 animate-spin" : "mr-1.5"; }
      const D = () => (
        <>
          <Button><Icon className={cn("w-4", ICON)} /></Button>
          <Button><Icon className={styles.icon} /></Button>
          <Button><Icon className={spin(busy)} /></Button>
        </>
      );`,
    );

    expect(hits.map((h) => h.classes)).toEqual(["ml-2", "mr-2", "mr-1.5"]);
  });

  it("flags an element held in a variable and used inside a Button", () => {
    const { hits } = scanSource(
      "e.tsx",
      `const icon = <Plus className="mr-2 h-4" />;
      const E = () => <Button>{icon}Add</Button>;`,
    );

    expect(hits.map((h) => h.classes)).toEqual(["mr-2"]);
  });

  it("ends on a loop of names instead of hanging", () => {
    const { hits, buttons } = scanSource(
      "f.tsx",
      `const A = B;
      const B = A;
      const F = () => <Button><Icon className={A} />{A}</Button>;`,
    );

    expect(buttons).toBe(1);
    expect(hits).toEqual([]);
  });

  it("leaves a margin name alone when it is not used inside a Button", () => {
    const { hits, buttons } = scanSource(
      "g.tsx",
      `const GAP = "mr-2";
      const icon = <Plus className={GAP} />;
      const G = () => (
        <>
          <span className={GAP}><Button>Add</Button></span>
          <Button className={GAP}><Plus className="h-4 w-4" />Add</Button>
          {icon}
        </>
      );`,
    );

    expect(buttons).toBe(2);
    expect(hits).toEqual([]);
  });
});

describe("Button icon margins in the app: P2", () => {
  const files = [...tsxFiles(path.join(ROOT, "components")), ...tsxFiles(path.join(ROOT, "pages"))];
  const scans = files.map((file) =>
    scanSource(path.relative(ROOT, file), fs.readFileSync(file, "utf8")),
  );

  it("really scans the app (a scan that sees no Buttons proves nothing)", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(scans.reduce((n, s) => n + s.buttons, 0)).toBeGreaterThan(150);
  });

  it("finds no mr-* / ml-* on anything inside a Button outside the allowlist", () => {
    const allowed = (hit: Hit) =>
      ALLOWED.some((a) => a.file === hit.file && a.classes === hit.classes);
    const offenders = scans
      .flatMap((s) => s.hits)
      .filter((hit) => !allowed(hit))
      .map((hit) => `${hit.file}:${hit.line} ${hit.classes}`);

    expect(offenders).toEqual([]);
  });

  it("keeps a reason on every allowlist line", () => {
    for (const entry of ALLOWED) expect(entry.why.length).toBeGreaterThan(10);
  });
});
