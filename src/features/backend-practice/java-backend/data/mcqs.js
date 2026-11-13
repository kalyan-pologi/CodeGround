import { topics } from './topics.js';
import { groups } from './mcq-bank.js';
export { topics } from './topics.js';
const hardCounts = [1,2,3,3,1,1,3,1,2,1,2,1,1,2,3,3,2,1,2,2,1,2];
let id = 0;
export const mcqs = groups.flatMap((rows, group) => rows.map((row, index) => ({
  id: ++id, topic: topics[group], difficulty: index >= rows.length - hardCounts[group] ? 'Hard' : 'Medium',
  title: row[0], code: row[1], prompt: row[2], options: row[3], answer: row[4], explanation: row[5],
})));
