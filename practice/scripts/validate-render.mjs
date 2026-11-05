import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { mcqs } from '../src/data/mcqs.js';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: McqPractice } = await server.ssrLoadModule('/src/components/McqPractice.jsx');
  const html = renderToStaticMarkup(React.createElement(McqPractice, { questions: mcqs }));
  assert.equal((html.match(/<optgroup /g) || []).length, 2);
  assert.equal((html.match(/<option /g) || []).length, 23);
  assert.equal((html.match(/aria-label="Question \d/g) || []).length, 20);
  assert.equal((html.match(/type="radio"/g) || []).length, 4);
  assert.ok(html.includes('Core Java') && html.includes('Spring Framework'));
  assert.ok(!html.includes(mcqs[0].explanation));
  assert.ok(!html.includes('Answer:'));
  assert.ok(!html.includes('Sample:') && !html.includes('Planned:'));
  console.log('React render checks passed: grouped topics, 20-question navigator page, four options, and hidden unsubmitted explanation.');
} finally {
  await server.close();
}
