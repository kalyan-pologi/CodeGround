export const reactTasks = [
  {
    id: 1, title: 'Training seats counter', topic: 'Components and state', difficulty: 'Easy',
    statement: 'Build a lender training seat counter. Keep the count in App and pass it to a reusable SeatControls child component.',
    requirements: [
      'Display the current count, starting at 0, and a maximum capacity of 5.',
      'Increment and decrement by one; keep the value between 0 and 5.',
      'Put the buttons in SeatControls and pass count and callback props from App.',
      'Show “Session full” at 5 seats and “No seats booked” at 0.'
    ],
    expected: 'Book five seats → Session full. Book again → still 5. Release six times → 0 and No seats booked.',
    notes: 'Practice explaining why App owns the state and the child receives props. Click Run preview to try your code.',
    hints: ['Start with React.useState(0) in App.', 'Pass onBook and onRelease functions to SeatControls.', 'Clamp updates with Math.min and Math.max.'],
    starter: `function SeatControls({ count, onBook, onRelease, onReset }) {
  return (
    <div>
      <button>Book seat</button>
      <button>Release seat</button>
      <button>Reset</button>
    </div>
  );
}

function App() {
  // Own the seat count here and pass props to SeatControls.
  return (
    <main>
      <h1>Lender training seats</h1>
      <p>Booked: 0 / 5</p>
      <SeatControls />
    </main>
  );
}`,
    solution: `function SeatControls({ count, onBook, onRelease, onReset }) {
  return (
    <div>
      <button onClick={onBook} disabled={count === 5}>Book seat</button>
      <button onClick={onRelease} disabled={count === 0}>Release seat</button>
      <button onClick={onReset}>Reset</button>
    </div>
  );
}

function App() {
  const [count, setCount] = React.useState(0);
  return (
    <main>
      <h1>Lender training seats</h1>
      <p>Booked: {count} / 5</p>
      {count === 5 && <p>Session full</p>}
      {count === 0 && <p>No seats booked</p>}
      <SeatControls count={count}
        onBook={() => setCount(previous => Math.min(5, previous + 1))}
        onRelease={() => setCount(previous => Math.max(0, previous - 1))}
        onReset={() => setCount(0)} />
    </main>
  );
}`
  },
  {
    id: 2, title: 'Search lender training courses', topic: 'Lists and UI performance', difficulty: 'Easy',
    statement: 'Search a training catalog. Keep the input responsive when the catalog grows.',
    requirements: [
      'Use a controlled input and match course titles without case sensitivity or extra search spaces.',
      'Use stable keys and show “No courses found” when nothing matches.',
      'Show the match count and render only the first 20 results.',
      'Use useMemo for filtering this larger catalog; explain when memoization actually helps.'
    ],
    expected: 'Search “ mortgage ” → Mortgage Basics and 1 match. Search “xyz” → No courses found. Empty search → 203 matches, 20 displayed.',
    notes: 'For three rows, useMemo is unnecessary; this task uses a larger list so you can discuss the performance tradeoff.',
    hints: ['Store the search text with React.useState.', 'Use React.useMemo with query as a dependency.', 'Filter all courses, then slice the visible rows to 20.'],
    starter: `const courses = [
  { id: 1, title: 'Mortgage Basics' },
  { id: 2, title: 'Fraud Prevention' },
  { id: 3, title: 'Loan Compliance' },
  ...Array.from({ length: 200 }, (_, index) => ({ id: index + 4, title: 'Training ' + (index + 1) }))
];

function App() {
  return (
    <main>
      <h1>Training catalog</h1>
      <input aria-label="Search courses" placeholder="Search courses" />
      <ul>{courses.map(course => <li key={course.id}>{course.title}</li>)}</ul>
    </main>
  );
}`,
    solution: `const courses = [
  { id: 1, title: 'Mortgage Basics' },
  { id: 2, title: 'Fraud Prevention' },
  { id: 3, title: 'Loan Compliance' },
  ...Array.from({ length: 200 }, (_, index) => ({ id: index + 4, title: 'Training ' + (index + 1) }))
];

function App() {
  const [query, setQuery] = React.useState('');
  const matches = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    return courses.filter(course => course.title.toLowerCase().includes(search));
  }, [query]);
  return (
    <main>
      <h1>Training catalog</h1>
      <input aria-label="Search courses" placeholder="Search courses"
        value={query} onChange={event => setQuery(event.target.value)} />
      <p>{matches.length} matches</p>
      {matches.length ? <ul>{matches.slice(0, 20).map(course =>
        <li key={course.id}>{course.title}</li>
      )}</ul> : <p>No courses found</p>}
    </main>
  );
}`
  },
  {
    id: 3, title: 'Trainer preparation checklist', topic: 'State management and props', difficulty: 'Easy',
    statement: 'Build a trainer checklist with add, complete, and delete actions. Keep the list in App and render each row through a child component.',
    requirements: [
      'Ignore blank or whitespace-only entries and clear the input after adding.',
      'Toggle a todo between complete and incomplete.',
      'Delete only the selected item; update the array without mutating it.',
      'Create a ChecklistItem child component that receives the item and action callbacks through props.',
      'Expose the checklist count through ChecklistContext and read it with useContext in the header.'
    ],
    expected: 'Add “Prepare lender slides” → one item. Toggle it → completed label. Delete it → empty list.',
    notes: 'This models simple local state management. A counter outside the component gives new items stable IDs.',
    followUpTitle: 'State management follow-up',
    followUp: 'Refactor the list actions into a useReducer with ADD, TOGGLE, and DELETE actions. If several distant components need the list, explain when Context or a shared store would help.',
    hints: ['Keep input text and checklist items in separate state values.', 'Use map to toggle an item and filter to delete one.', 'Pass item, onToggle, and onDelete props to ChecklistItem.'],
    starter: `let nextId = 1;

function ChecklistItem({ item, onToggle, onDelete }) {
  return <li>{item.text}</li>;
}

function App() {
  const [text, setText] = React.useState('');
  const [todos, setTodos] = React.useState([]);
  function addTodo(event) {
    event.preventDefault();
    // Add a nonblank todo and clear the input.
  }
  return (
    <main>
      <h1>Trainer checklist</h1>
      <form onSubmit={addTodo}>
        <input aria-label="New todo" value={text}
          onChange={event => setText(event.target.value)} />
        <button>Add</button>
      </form>
      <ul>{todos.map(todo => <ChecklistItem key={todo.id} item={todo} />)}</ul>
    </main>
  );
}`,
    solution: `let nextId = 1;
const ChecklistContext = React.createContext({ count: 0 });

function ChecklistItem({ item, onToggle, onDelete }) {
  return <li>
    <span>{item.text} {item.done ? '(completed)' : ''}</span>
    <button onClick={() => onToggle(item.id)}>Toggle</button>
    <button onClick={() => onDelete(item.id)}>Delete</button>
  </li>;
}

function App() {
  const [text, setText] = React.useState('');
  const [todos, setTodos] = React.useState([]);
  function addTodo(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setTodos(previous => [...previous, { id: nextId++, text: value, done: false }]);
    setText('');
  }
  return <ChecklistContext.Provider value={{ count: todos.length }}>
    <main>
      <h1>Trainer checklist</h1>
      <ChecklistHeader />
      <form onSubmit={addTodo}>
        <input aria-label="New todo" value={text}
          onChange={event => setText(event.target.value)} />
        <button>Add</button>
      </form>
      {todos.length === 0 && <p>No tasks yet</p>}
      <ul>{todos.map(todo => <ChecklistItem key={todo.id} item={todo}
        onToggle={id => setTodos(previous => previous.map(item =>
          item.id === id ? { ...item, done: !item.done } : item
        ))}
        onDelete={id => setTodos(previous => previous.filter(item => item.id !== id))}
      />)}</ul>
    </main>
  </ChecklistContext.Provider>;
}

function ChecklistHeader() {
  const { count } = React.useContext(ChecklistContext);
  return <p>{count} task{count === 1 ? '' : 's'} total</p>;
}`
  },
  {
    id: 4, title: 'Trainer form with two routes', topic: 'Forms and routing', difficulty: 'Easy',
    statement: 'Build a trainer registration form with a form route and a confirmation route.',
    requirements: [
      'Require a nonblank trainer name and an email containing @.',
      'Show useful errors after Submit for invalid values.',
      'On success, navigate to #/summary and show the registered trainer.',
      'Support #/new and #/summary using the URL hash, including browser Back and Forward.'
    ],
    expected: 'Submit empty form → errors. Submit Ada and ada@example.com → Route: #/summary and confirmation appear. New trainer → form route.',
    notes: 'This is a small hash router for interview practice. In a larger React app, use a routing library for nested routes and links.',
    followUpTitle: 'React Router follow-up',
    followUp: 'In a local React project, replace the hash switch with React Router Routes for /new and /summary and use Link for navigation. Explain how the URL selects a component.',
    hints: ['Use state for inputs, errors, saved trainer, and current hash.', 'Listen for hashchange in an effect and remove the listener during cleanup.', 'After valid submit, set location.hash to #/summary.'],
    starter: `function App() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  function submit(event) {
    event.preventDefault();
    // Validate, save the trainer, and navigate to #/summary.
  }
  return (
    <main>
      <h1>Register trainer</h1>
      <form onSubmit={submit}>
        <label>Name <input value={name}
          onChange={event => setName(event.target.value)} /></label>
        <label>Work email <input value={email}
          onChange={event => setEmail(event.target.value)} /></label>
        <button>Save</button>
      </form>
    </main>
  );
}`,
    solution: `function App() {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [errors, setErrors] = React.useState({});
  const [saved, setSaved] = React.useState(null);
  const [route, setRoute] = React.useState(location.hash || '#/new');
  React.useEffect(() => {
    const syncRoute = () => setRoute(location.hash || '#/new');
    addEventListener('hashchange', syncRoute);
    return () => removeEventListener('hashchange', syncRoute);
  }, []);
  function navigate(path) {
    location.hash = path;
    setRoute(path);
  }
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Name is required';
    if (!email.trim().includes('@')) nextErrors.email = 'Enter a valid email';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaved({ name: name.trim(), email: email.trim() });
    setName('');
    setEmail('');
    navigate('#/summary');
  }
  return (
    <main>
      <h1>Trainer registration</h1>
      <p>Route: {route}</p>
      <nav><button onClick={() => navigate('#/new')}>New trainer</button>
        <button onClick={() => navigate('#/summary')}>Summary</button></nav>
      {route === '#/summary' ? <section>
        <h2>Registration summary</h2>
        {saved ? <p>Saved: {saved.name} ({saved.email})</p> : <p>No trainer registered yet</p>}
      </section> : <form onSubmit={submit}>
        <label>Name <input value={name}
          onChange={event => setName(event.target.value)} /></label>
        {errors.name && <p role="alert">{errors.name}</p>}
        <label>Work email <input value={email}
          onChange={event => setEmail(event.target.value)} /></label>
        {errors.email && <p role="alert">{errors.email}</p>}
        <button>Save</button>
      </form>}
    </main>
  );
}`
  },
  {
    id: 5, title: 'Training staff CRUD with an API', topic: 'Services and API integration', difficulty: 'Easy',
    statement: 'Build a small staff admin screen backed by a dummy Spring Boot style REST API. Load, create, edit, and delete training staff.',
    requirements: [
      'Show a loading message while waiting for the response.',
      'Render employee names from the JSON response with stable keys.',
      'Show an error message when the request fails; include a way to retry.',
      'Put fetch, response.ok handling, and JSON parsing in service functions outside App.',
      'Use POST to add a staff member, PUT to edit a name, and DELETE to remove a staff member.',
      'Validate blank names before POST and show server errors without losing the current list.',
      'Use useEffect cleanup with AbortController so an old request cannot update an unmounted component.'
    ],
    expected: 'Run preview → Ada and Ben. Add Cara → appears. Edit Cara → updated name. Delete Cara → removed. Simulate failure → an error appears for the next request.',
    notes: 'The preview provides an in-memory mock for GET, POST, PUT, and DELETE /api/employees. It represents a Spring Boot REST controller and works offline.',
    hints: ['Create request helpers for GET, POST, PUT, and DELETE. Each helper should check response.ok.', 'Keep form state separate from the server list; refresh the list after a successful mutation.', 'Create an AbortController in the effect and abort it in cleanup.'],
    starter: `async function getEmployees(signal) { /* GET /api/employees */ }
async function createEmployee(name) { /* POST /api/employees */ }
async function updateEmployee(id, name) { /* PUT /api/employees/:id */ }
async function removeEmployee(id) { /* DELETE /api/employees/:id */ }

function App() {
  const [employees, setEmployees] = React.useState([]);
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');
  // Add loading, load, create, edit, and delete behavior.
  return <main><h1>Training staff</h1><input aria-label="Staff name" value={name} onChange={event => setName(event.target.value)} /><button>Add staff</button><ul>{employees.map(employee => <li key={employee.id}>{employee.name}</li>)}</ul></main>;
}`,
    solution: `// API service layer
async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }

  return response.status === 204 ? null : response.json();
}

const getEmployees = signal => request('/api/employees', { signal });

const createEmployee = name => request('/api/employees', {
  method: 'POST',
  body: JSON.stringify({ name })
});

const updateEmployee = (id, name) => request('/api/employees/' + id, {
  method: 'PUT',
  body: JSON.stringify({ name })
});

const removeEmployee = id => request('/api/employees/' + id, {
  method: 'DELETE'
});

function App() {
  const [employees, setEmployees] = React.useState([]);
  const [name, setName] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();

    setLoading(true); setError('');

    getEmployees(controller.signal)
      .then(setEmployees)
      .catch(failure => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retry]);

  async function save(event) {
    event.preventDefault();

    const value = name.trim();
    if (!value) {
      setError('Name is required');
      return;
    }

    try {
      setError('');
      if (editingId) await updateEmployee(editingId, value);
      else await createEmployee(value);
      setName('');
      setEditingId(null);
      setRetry(previous => previous + 1);
    } catch (failure) {
      setError(failure.message);
    }
  }

  async function remove(id) {
    try {
      setError('');
      await removeEmployee(id);
      setRetry(previous => previous + 1);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main>
      <h1>Training staff</h1>
      <form onSubmit={save}>
        <input aria-label="Staff name" value={name}
          onChange={event => setName(event.target.value)} placeholder="Name" />
        <button>{editingId ? 'Update staff' : 'Add staff'}</button>
        {editingId && <button type="button" onClick={() => {
          setEditingId(null);
          setName('');
        }}>Cancel</button>}
      </form>
      <button onClick={() => setRetry(previous => previous + 1)}>Retry</button>
      {loading && <p>Loading staff...</p>}
      {error && <p role="alert">{error}</p>}
      <ul>{employees.map(employee => (
        <li key={employee.id}>
          {employee.name}
          <button onClick={() => {
            setEditingId(employee.id);
            setName(employee.name);
          }}>Edit</button>
          <button onClick={() => remove(employee.id)}>Delete</button>
        </li>
      ))}</ul>
    </main>
  );
}`
  }
];
