export function coreProgram(snippet = '// TODO: Write your Java Core example here.') {
  const body = snippet.trim();
  return `import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.function.*;
import java.util.stream.*;
public class Main {
    public static void main(String[] args) throws Exception {
${body.split('\n').map(line => '        ' + line).join('\n')}
    }
}`;
}
