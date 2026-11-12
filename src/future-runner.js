export function futureProgram(snippet = '// TODO: Write your CompletableFuture example here.') {
  let body = snippet.trim();
  if (/^private static void sleep\s*\(/.test(body)) {
    return `import java.util.concurrent.*;
public class Main {
${body}
    public static void main(String[] args) {
        sleep(0);
        System.out.println("sleep helper completed");
    }
}`;
  }
  body = body.replace(/CompletableFuture<String>\s+errorHandled\s*=\s*CompletableFuture\.supplyAsync\(/, 'CompletableFuture<String> errorHandled = CompletableFuture.<String>supplyAsync(');
  body = body.replace(/CompletableFuture<String>\s+handled\s*=\s*CompletableFuture\.supplyAsync\(/, 'CompletableFuture<String> handled = CompletableFuture.<String>supplyAsync(');
  const declarations = name => new RegExp(`\\b${name}\\s*=`).test(body);
  const setup = [];
  if ((/\bfuture\b/.test(body) || /\btransformed\b/.test(body)) && !declarations('future')) setup.push('CompletableFuture<String> future = CompletableFuture.completedFuture("Hello");');
  if (/\btransformed\b/.test(body) && !declarations('transformed')) setup.push('CompletableFuture<String> transformed = future.thenApply(result -> result + " World");');
  if (/\bgreeting\b/.test(body) && !declarations('greeting')) setup.push('CompletableFuture<String> greeting = CompletableFuture.completedFuture("Hi");');
  if (/\bname\b/.test(body) && !declarations('name')) setup.push('CompletableFuture<String> name = CompletableFuture.completedFuture("Shiva");');
  const futureNames = [...body.matchAll(/CompletableFuture<[^>]+>\s+(\w+)\s*=/g)].map(match => match[1]);
  const output = futureNames.map(name => `        System.out.println(${JSON.stringify(name + ' = ')} + ${name}.join());`);
  const values = [...body.matchAll(/^\s*(?:String|int|long|double|boolean)\s+(\w+)\s*=/gm)]
    .map(match => match[1])
    .filter(name => !futureNames.includes(name));
  output.push(...values.map(name => `        System.out.println(${JSON.stringify(name + ' = ')} + ${name});`));
  const waitForCallbacks = /\.(?:thenAccept|thenRun|whenComplete|thenApplyAsync)\b/.test(body)
    ? '        Thread.sleep(1100);\n' : '';
  return `import java.util.concurrent.*;
public class Main {
    static void sleep(int seconds) {
        try { TimeUnit.SECONDS.sleep(seconds); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    public static void main(String[] args) throws Exception {
${setup.map(line => '        ' + line).join('\n')}
${body.split('\n').map(line => '        ' + line).join('\n')}
${output.join('\n')}
${waitForCallbacks}    }
}`;
}
