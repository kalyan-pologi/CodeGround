const fixtures = {
  student: `CREATE TABLE student(student_id INTEGER PRIMARY KEY, name TEXT NOT NULL, major TEXT UNIQUE, std_id INTEGER, rollno INTEGER, student_name TEXT);
INSERT INTO student VALUES (1,'kalyan','maths',1,101,'Kalyan Pologi'),(2,'prabhas','physics',2,102,'Prabhas Kumar'),(7,'Ananya','biology',7,101,'Ananya Rao');`,
  employee: `CREATE TABLE Employee(emp_id INTEGER, EmployeeID INTEGER, employee_no INTEGER, name TEXT, emp_name TEXT, first_name TEXT, salary REAL, dept TEXT, DepartmentID INTEGER, Dept_no INTEGER, ManagerID INTEGER, emp_supv INTEGER, sex TEXT, email TEXT, JoinDate TEXT);
INSERT INTO Employee VALUES
(1,1,101,'Asha','Asha','Asha',15000,'IT',10,10,NULL,NULL,'F','asha@example.com',date('now','-5 days')),
(2,2,102,'John','John','John',12000,'IT',10,10,1,1,'M','john@example.com',date('now','-60 days')),
(3,3,103,'Ananya','Ananya','Ananya',12000,'HR',20,20,1,1,'F','ananya@example.com',date('now','-10 days')),
(4,4,104,'Ravi','Ravi','Ravi',8000,'HR',20,20,2,2,'M','ravi@example.com',date('now','-90 days')),
(5,5,105,'Ravi','Ravi','Ravi',6000,'Sales',30,30,2,2,'M','ravi@example.com',date('now','-20 days')),
(6,6,105,'Lina','Lina','Lina',4000,NULL,NULL,NULL,NULL,NULL,'F','lina@example.com',date('now','-45 days'));`,
  department: `CREATE TABLE Department(Department_no INTEGER PRIMARY KEY, name TEXT); INSERT INTO Department VALUES(10,'IT'),(20,'HR'),(30,'Sales');`,
  work_with: `CREATE TABLE work_with(emp_id INTEGER,total_sales REAL); INSERT INTO work_with VALUES(1,45000),(2,15000),(3,55000);`,
  employeeinfo: `CREATE TABLE EmployeeInfo(EmpID INTEGER PRIMARY KEY,EmpFname TEXT,EmpLname TEXT,Department TEXT,salary REAL);
INSERT INTO EmployeeInfo VALUES(1,'Asha','Rao','IT',15000),(2,'John','Lee','IT',12000),(3,'Ananya','Shah','HR',12000),(4,'Ravi','Kumar','HR',8000),(5,'Lina','Das','Sales',6000),(6,'Bob','Jones','Sales',4000);`,
  employeeposition: `CREATE TABLE EmployeePosition(EmpID INTEGER,EmpPosition TEXT,Salary REAL); INSERT INTO EmployeePosition VALUES(1,'Manager',15000),(2,'Developer',12000),(3,'Manager',12000),(4,'Analyst',8000),(5,'Analyst',6000),(6,'Developer',4000);`,
  dup_employee: `CREATE TABLE dup_employee(e_id INTEGER,name TEXT,age INTEGER); INSERT INTO dup_employee VALUES(1,'Ada',30),(1,'Ada',30),(2,'Bob',35),(3,'Cara',28),(3,'Cara',28);`,
  employees: `CREATE TABLE Employees(ID INTEGER,salary REAL); INSERT INTO Employees VALUES(1,15000),(2,8000),(3,3000);`,
  tablename: `CREATE TABLE TableName(id INTEGER); INSERT INTO TableName VALUES(1),(2);`,
  employeedetails: `CREATE TABLE EmployeeDetails(FullName TEXT); INSERT INTO EmployeeDetails VALUES('Asha Rao'),('John Lee');`,
  worker: `CREATE TABLE Worker(FIRST_NAME TEXT); INSERT INTO Worker VALUES('Amitabh'),('Ada'),('Ravi');`,
  employeesalary: `CREATE TABLE EmployeeSalary(EmpId INTEGER,Salary REAL); INSERT INTO EmployeeSalary VALUES(1,15000),(2,12000),(3,8000);`,
  managersalary: `CREATE TABLE ManagerSalary(EmpId INTEGER,Salary REAL); INSERT INTO ManagerSalary VALUES(1,15000),(3,8000);`,
  customers: `CREATE TABLE customers(customerId INTEGER PRIMARY KEY,name TEXT); INSERT INTO customers VALUES(1,'Ada'),(2,'Bob'),(3,'Cara'),(4,'Dan'),(5,'Eve'),(6,'Finn');`
};

export function sqlExercise(original) {
  let solution = original.trim(), note = '';
  const storedProcedure = /CREATE PROCEDURE/i.test(solution);
  const tableNames = [...new Set([...solution.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w+)/gi)].map(match => match[1].toLowerCase()))].filter(name => fixtures[name]);
  if (/FOREIGN KEY/.test(solution)) {
    tableNames.push('student');
    const cascade = solution.includes('CASCADE');
    solution = `CREATE TABLE child (id INTEGER PRIMARY KEY, mrg_id INTEGER,
    FOREIGN KEY (mrg_id) REFERENCES student(student_id) ON DELETE ${cascade ? 'CASCADE' : 'SET NULL'});
INSERT INTO child VALUES (1,1),(2,2);
DELETE FROM student WHERE student_id = 1;
SELECT * FROM child ORDER BY id;`;
    note = 'A complete child table and delete example demonstrates the foreign-key behavior. Foreign keys are enabled.';
  }
  if (/AUTO_INCREMENT/.test(solution)) { solution = solution.replace('INT PRIMARY KEY AUTO_INCREMENT', 'INTEGER PRIMARY KEY AUTOINCREMENT'); note = 'SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT instead of MySQL AUTO_INCREMENT.'; }
  solution = solution.replace('INSERT INTO student VALUES', 'INSERT INTO student(student_id, name, major) VALUES');
  solution = solution.replace('DELETE FROM student a', 'DELETE FROM student AS a');
  solution = solution.replace('RIGHT(student_name, 5)', 'substr(student_name, -5)');
  solution = solution.replace("BINARY 'a'", "'a'");
  if (/DATE_SUB|INTERVAL 30 DAY/.test(solution)) solution = "SELECT * FROM Employee WHERE JoinDate > date('now', '-30 days');";
  if (/ISDATE/.test(solution)) {
    solution = `-- Use ISO YYYY-MM-DD input; return 1 for valid dates, 0 otherwise.
WITH input(value) AS (VALUES ('2020-01-04'))
SELECT CASE WHEN length(value) = 10 AND value GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND date(value, '+0 days') = value THEN 1 ELSE 0 END AS is_valid_date FROM input;`;
    note = 'SQLite has no ISDATE. This example validates ISO calendar dates; the original uses a dialect-specific date format.';
  }
  if (/WHERE N - 1/.test(solution)) { solution = solution.replace('WHERE N - 1', 'WHERE 3 - 1'); note = 'N is set to 3 for this runnable example. Change 3 to practice another rank.'; }
  if (/ROW_NUMBER\(\) OVER \(\)/.test(solution)) solution = solution.replace('ROW_NUMBER() OVER ()', 'ROW_NUMBER() OVER (ORDER BY customerId)');
  solution = solution.replace('MOD(rowno, 2)', '(rowno % 2)');
  if (solution !== original.trim() && !note) note = 'The runnable version uses SQLite syntax; the original snippet is preserved below.';
  let setup = [...new Set(tableNames)].filter(name => !(name === 'student' && /CREATE TABLE student/i.test(original))).map(name => fixtures[name]).join('\n');
  if (/INSERT INTO student/i.test(original) && !/FOREIGN KEY/.test(original)) setup = setup.replace("(1,'kalyan','maths',1,101,'Kalyan Pologi'),(2,'prabhas','physics',2,102,'Prabhas Kumar'),", '');
  return { original, solution, setup: 'PRAGMA foreign_keys = ON;\n' + setup, note, runnable: !storedProcedure,
    preview: /\b(?:CREATE|ALTER|DROP) TABLE/i.test(solution) ? "SELECT name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%';"
      : /(?:UPDATE|DELETE|INSERT INTO) student/i.test(solution) && !/SELECT \* FROM child/.test(solution) ? 'SELECT * FROM student;'
      : /DELETE FROM Employee/i.test(solution) ? 'SELECT * FROM Employee;' : '' };
}
