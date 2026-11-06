import React from 'react';
import { createRoot } from 'react-dom/client';
import StreamLab from './StreamLab';

export function streamProgram(model, snippet = '// TODO: Write your solution here.\n// Print the result with System.out.println(...).') {
  let body = snippet.trim();
  if (/^employees\.stream\(\)/.test(body) && /\.toList\(\);$/.test(body)) {
    body = `System.out.println(${body.slice(0, -1)});`;
  } else {
    const variables = [...body.matchAll(/^[A-Za-z][\w<>, ?.\[\]]*?\s+(\w+)\s*=/gm)].map(match => match[1]);
    if (variables.length) body += '\n' + variables.map(name => `System.out.println("${name} = " + ${name});`).join('\n');
  }
  return `import java.time.*;
import java.util.*;
import java.util.function.*;
import java.util.stream.*;
public class Main {
${model.replace('public class Employee', 'static class Employee')}
    public static void main(String[] args) {
        List<Employee> employees = List.of(
            new Employee(1, "John", "Doe", "M", "IT", 6000, LocalDate.of(2020, 1, 15), LocalDate.of(1990, 5, 20)),
            new Employee(2, "Jane", "Smith", "F", "HR", 7500, LocalDate.of(2019, 3, 10), LocalDate.of(1985, 8, 15)),
            new Employee(3, "Ada", "Lovelace", "F", "IT", 9500, LocalDate.of(2018, 6, 1), LocalDate.of(1996, 12, 10)),
            new Employee(4, "John", "Lee", "M", "HR", 5000, LocalDate.of(2022, 4, 1), LocalDate.of(1993, 2, 5)),
            new Employee(5, "Bob", "Jones", "M", "IT", 9500, LocalDate.of(2021, 7, 1), LocalDate.of(1980, 3, 12)));
${/List<Integer>\s+numbers\s*=/.test(body) ? '' : '        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 7, 10);'}
        List<String> names = Arrays.asList("alice", "apple", "bob", "bat", "apple", "cat");
${body.includes('= avgSalaryByDept.entrySet()') ? '        Map<String, Double> avgSalaryByDept = employees.stream().collect(Collectors.groupingBy(Employee::getDepartment, Collectors.averagingDouble(Employee::getSalary)));\n' : ''}
${body.split('\n').map(line => '        ' + line).join('\n')}
    }
}`;
}


export function mountStreamRunners(doc) {
  const body = doc.querySelector('.note-body');
  if (!body || body.dataset.runners) return;
  body.dataset.runners = 'true';
  const modelSource = body.querySelector('pre code')?.textContent || '';
  const start = modelSource.indexOf('public class Employee'), end = modelSource.indexOf('// example data');
  if (start < 0 || end < 0) return;
  const model = modelSource.slice(start,end).trim().replace(/\n}$/, '\n    @Override public String toString() { return getFullName() + " [" + department + ", " + salary + "]"; }\n}');
  const questions = []; let category = '';
  for (const node of body.children) {
    if (node.tagName === 'H2') category = node.textContent.trim();
    if (node.tagName !== 'P' || !node.querySelector('b')?.textContent.trim().startsWith('Q:')) continue;
    const nodes = []; let next = node.nextElementSibling;
    while (next && next.tagName !== 'H2' && !next.querySelector(':scope > b')?.textContent.trim().startsWith('Q:')) { nodes.push(next); next = next.nextElementSibling; }
    const primary = nodes.find(element => element.tagName === 'PRE'); if (!primary) continue;
    const runnable = category !== 'CompletableFuture';
    const solutions = [{ title:'Main solution', code:primary.textContent, program:runnable ? streamProgram(model,primary.textContent) : primary.textContent }];
    for (const alternative of nodes.filter(element => element.classList.contains('stream-alternative'))) {
      const code = alternative.querySelector('code').textContent;
      solutions.push({ title:alternative.querySelector('.stream-alternative-label').textContent, code, program:streamProgram(model,code), choose:alternative.querySelector('p:last-child').textContent });
    }
    questions.push({ id:questions.length+1, title:node.textContent.replace(/^Q:\s*/,'').replace(/\s+/g,' ').trim(), category, runnable, solutions,
      description:nodes.filter(element => element.tagName === 'P').map(element => element.textContent).join(' '),
      starter:runnable ? streamProgram(model) : primary.textContent });
  }
  for (const file of ['sql-lab.css','stream-lab.css']) { const link=doc.createElement('link'); link.rel='stylesheet'; link.href=new URL(file,new URL(import.meta.env.BASE_URL,location.href)).href; doc.head.append(link); }
  const root = doc.createElement('div'); root.id='stream-lab-root'; doc.body.className='sql-lab-page'; doc.body.replaceChildren(root);
  createRoot(root).render(React.createElement(StreamLab,{questions}));
}
