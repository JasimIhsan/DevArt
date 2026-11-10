import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiagram } from '../src/core/dsl.ts';
import { renderDiagram } from '../src/core/render.ts';
import { TEMPLATES, templateById } from '../src/core/templates.ts';
import { DIAGRAM_TYPES } from '../src/core/types.ts';

test('there are six templates with unique ids, names, and descriptions', () => {
  assert.equal(TEMPLATES.length, 6);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(t.name && t.description, t.id);
    assert.ok(DIAGRAM_TYPES.includes(t.type), t.id);
    assert.equal(templateById(t.id), t);
  }
  assert.equal(templateById('nope'), undefined);
});

for (const t of TEMPLATES) {
  test(`template "${t.id}" parses and renders without errors`, () => {
    const parsed = parseDiagram(t.type, t.code);
    assert.deepEqual(parsed.issues.filter((i) => i.severity === 'error'), [], t.id);
    const content = t.type === 'erd' ? parsed.tables.length : t.type === 'sequence' ? parsed.sequence.length : parsed.edges.length;
    assert.ok(content > 3, `${t.id} has content`);
    const r = renderDiagram(t.type, t.code);
    assert.deepEqual(r.issues.filter((i) => i.severity === 'error'), [], t.id);
    assert.match(r.svg, /^<svg /);
    assert.ok(r.width > 100 && r.height > 50);
  });
}
