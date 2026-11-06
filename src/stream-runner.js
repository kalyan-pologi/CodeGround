import { executeJava } from '../practice/src/services/compiler.js';

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
  const start = modelSource.indexOf('public class Employee');
  const end = modelSource.indexOf('// example data');
  if (start < 0 || end < 0) return;
  const model = modelSource.slice(start, end).trim().replace(/\n}$/, '\n    @Override public String toString() { return getFullName() + " [" + department + ", " + salary + "]"; }\n}');
  const style = doc.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('stream-runner.css', new URL(import.meta.env.BASE_URL, location.href)).href;
  doc.head.append(style);
  let inStreams = true;
  for (const question of [...body.querySelectorAll(':scope > p')].filter(node => node.querySelector('b')?.textContent.trim().startsWith('Q:'))) {
    const heading = (() => { let node = question.previousElementSibling; while (node && node.tagName !== 'H2') node = node.previousElementSibling; return node; })();
    inStreams = heading?.textContent.trim() !== 'CompletableFuture';
    if (!inStreams) continue;
    const nodes = [];
    let node = question.nextElementSibling;
    while (node && node.tagName !== 'H2' && !node.querySelector(':scope > b')?.textContent.trim().startsWith('Q:')) {
      nodes.push(node); node = node.nextElementSibling;
    }
    const primary = nodes.find(element => element.tagName === 'PRE');
    if (!primary) continue;
    const title = question.textContent.replace(/^Q:\s*/, '').replace(/\s+/g, ' ').trim();
    const starter = streamProgram(model);
    const workspace = doc.createElement('section'); workspace.className = 'stream-workspace'; workspace.setAttribute('aria-label', `Code workspace: ${title}`);
    workspace.innerHTML = '<div class="stream-toolbar"><span>Java 17</span><button type="button" data-reset>Reset</button><button type="button" data-run>Run code</button></div><textarea class="stream-code" spellcheck="false" wrap="off"></textarea><p class="stream-service">Runs through Judge0. Print your result to see output.</p><pre class="stream-output" role="status" hidden></pre><button type="button" class="stream-reveal" aria-expanded="false">Reveal solution</button><div class="stream-solution" hidden></div>';
    const editor = workspace.querySelector('textarea'); editor.value = starter; editor.setAttribute('aria-label', `Java code: ${title}`);
    // Start at the editable task, while keeping imports, model and data available above it.
    editor.scrollTop = editor.scrollHeight;
    editor.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      event.preventDefault(); const from = editor.selectionStart, to = editor.selectionEnd;
      editor.setRangeText('    ', from, to, 'end');
    });
    const solutions = workspace.querySelector('.stream-solution');
    const load = (snippet, label, before) => {
      const button = doc.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => { editor.value = streamProgram(model, snippet); editor.focus(); editor.scrollTop = editor.scrollHeight; });
      solutions.insertBefore(button, before);
    };
    question.after(workspace);
    doc.defaultView.requestAnimationFrame(() => { editor.scrollTop = editor.scrollHeight; });
    // Keep descriptions visible; move only answers and their alternatives beneath Reveal solution.
    for (const element of nodes) {
      if (element === primary || element.classList.contains('stream-alternative')) solutions.append(element);
    }
    load(primary.textContent, 'Load solution into editor', primary);
    for (const alternative of solutions.querySelectorAll('.stream-alternative')) {
      load(alternative.querySelector('code').textContent, 'Load alternative into editor', alternative);
    }
    const reveal = workspace.querySelector('.stream-reveal');
    reveal.addEventListener('click', () => { solutions.hidden = !solutions.hidden; reveal.setAttribute('aria-expanded', String(!solutions.hidden)); reveal.textContent = solutions.hidden ? 'Reveal solution' : 'Hide solution'; });
    workspace.querySelector('[data-reset]').addEventListener('click', () => {
      if (editor.value !== starter && !doc.defaultView.confirm('Reset your code to the starter?')) return;
      editor.value = starter; output.hidden = true;
    });
    const output = workspace.querySelector('.stream-output'), run = workspace.querySelector('[data-run]');
    run.addEventListener('click', async () => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      doc.defaultView.addEventListener('pagehide', cancel, { once: true });
      run.disabled = true; output.hidden = false; output.textContent = 'Submitting…';
      try {
        const result = await executeJava(editor.value, '', { signal: controller.signal, onStatus: status => { output.textContent = status.description; } });
        output.textContent = [result.status?.description, result.stdout, result.compile_output, result.stderr, result.message].filter(Boolean).join('\n') + (!result.stdout && result.status?.id === 3 ? '\nNo output. Add System.out.println(...) to print your result.' : '');
      } catch (error) { output.textContent = error.message; }
      finally { run.disabled = false; doc.defaultView?.removeEventListener('pagehide', cancel); }
    });
  }
}
