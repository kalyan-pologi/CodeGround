export function threadProgram(snippet = '// TODO: Write your multithreading example here.') {
  const body = snippet.trim();
  return `import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
public class Main {
    static void await(CyclicBarrier barrier) {
        try { barrier.await(); } catch (Exception error) { throw new RuntimeException(error); }
    }
    static void put(BlockingQueue<String> queue, String value) {
        try { queue.put(value); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    static void takeAndPrint(BlockingQueue<String> queue) {
        try { System.out.println(queue.take()); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    static void usePermit(Semaphore permits) {
        try { permits.acquire(); permits.release(); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    static int getValue(Future<Integer> future) {
        try { return future.get(); } catch (Exception error) { throw new RuntimeException(error); }
    }
    static void exchange(Exchanger<String> exchanger, String value) {
        try { exchanger.exchange(value); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    public static void main(String[] args) throws Exception {
${body.split('\n').map(line => '        ' + line).join('\n')}
    }
}`;
}
