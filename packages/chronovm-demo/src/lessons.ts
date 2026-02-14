export type Lesson = {
    id: number;
    title: string;
    topic: string;
    objective: string;
    explanation: string;
    code: string;
};

export const PYTHON_LESSONS: Lesson[] = [
    // ── 1. Variables & Types ──
    {
        id: 1,
        title: '1. Variables & Data Types',
        topic: 'Data Types',
        objective: 'Learn about Python\'s core data types: int, float, str, bool, and None.',
        explanation: `Python has several built-in data types:
• **int**: Whole numbers like 42, -7
• **float**: Decimal numbers like 3.14
• **str**: Text in quotes like "hello"
• **bool**: True or False
• **None**: Represents "nothing"

Variables store values. Python figures out the type automatically.`,
        code: `# Numbers
age = 25
height = 5.9

# Strings
name = "Alice"
greeting = "Hello"

# Booleans
is_student = True

# None
result = None

print(age)
print(name)
print(is_student)`,
    },

    // ── 2. Arithmetic ──
    {
        id: 2,
        title: '2. Arithmetic Operations',
        topic: 'Arithmetic',
        objective: 'Understand arithmetic operators: +, -, *, /, % and operator precedence.',
        explanation: `Python supports standard arithmetic:
• **+** Addition
• **-** Subtraction
• **\\*** Multiplication
• **/** Division
• **%** Modulo (remainder)

Operations follow standard math precedence: multiplication/division before addition/subtraction. Use parentheses to control order.`,
        code: `a = 10
b = 3

# Basic operations
sum = a + b
diff = a - b
product = a * b
quotient = a / b
remainder = a % b

print(sum)
print(diff)
print(product)
print(remainder)

# Precedence
result = 2 + 3 * 4
result_paren = (2 + 3) * 4
print(result)
print(result_paren)`,
    },

    // ── 3. Strings ──
    {
        id: 3,
        title: '3. Strings',
        topic: 'Strings',
        objective: 'Learn string creation and concatenation.',
        explanation: `Strings hold text. You can use single or double quotes.

• **Concatenation**: Use + to join strings
• **Repetition**: Build strings piece by piece

Strings are sequences of characters.`,
        code: `first = "Hello"
second = "World"

# Concatenation
message = first + " " + second
print(message)

# Building strings
prefix = "Python"
suffix = " is fun!"
full = prefix + suffix
print(full)

# String with numbers
version = "Python " + "3"
print(version)`,
    },

    // ── 4. Booleans & Logic ──
    {
        id: 4,
        title: '4. Booleans & Logical Operators',
        topic: 'Logic',
        objective: 'Master boolean values and logical operators: and, or, not.',
        explanation: `Booleans are True or False. Logical operators combine conditions:

• **and**: True only if BOTH sides are True
• **or**: True if EITHER side is True
• **not**: Flips True to False and vice versa

These are essential for decision-making in code.`,
        code: `a = True
b = False

# Logical AND
both = a and b
print(both)

# Logical OR
either = a or b
print(either)

# Logical NOT
flipped = not a
print(flipped)

# Combining
x = 10
check = x > 5 and x < 20
print(check)`,
    },

    // ── 5. Comparisons ──
    {
        id: 5,
        title: '5. Comparison Operators',
        topic: 'Comparisons',
        objective: 'Use comparison operators to evaluate conditions.',
        explanation: `Comparison operators return True or False:

• **==** Equal to
• **!=** Not equal to
• **<** Less than
• **>** Greater than
• **<=** Less than or equal
• **>=** Greater than or equal

These are the building blocks of conditions.`,
        code: `x = 10
y = 20

print(x == y)
print(x != y)
print(x < y)
print(x > y)
print(x <= 10)
print(y >= 20)

# Chaining with logic
age = 25
is_adult = age >= 18
is_young = age < 30
is_young_adult = is_adult and is_young
print(is_young_adult)`,
    },

    // ── 6. Conditionals ──
    {
        id: 6,
        title: '6. If / Elif / Else',
        topic: 'Conditionals',
        objective: 'Control program flow with conditional statements.',
        explanation: `Conditionals let your program make decisions:

• **if**: Runs code when condition is True
• **elif**: Checks another condition if previous was False
• **else**: Runs when all conditions are False

Indentation defines code blocks in Python.`,
        code: `score = 85

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"

print(grade)

# Nested conditions
x = 15
if x > 0:
    if x > 10:
        label = "big positive"
    else:
        label = "small positive"
else:
    label = "not positive"

print(label)`,
    },

    // ── 7. While Loops ──
    {
        id: 7,
        title: '7. While Loops',
        topic: 'Loops',
        objective: 'Repeat code with while loops and counter patterns.',
        explanation: `A while loop repeats code as long as a condition is True:

1. Check the condition
2. If True, run the body
3. Go back to step 1
4. If False, exit the loop

Common pattern: use a counter variable.`,
        code: `# Count from 1 to 5
i = 1
while i <= 5:
    print(i)
    i = i + 1

# Sum of numbers 1 to 10
total = 0
n = 1
while n <= 10:
    total = total + n
    n = n + 1

print(total)`,
    },

    // ── 8. For Loops ──
    {
        id: 8,
        title: '8. For Loops & Range',
        topic: 'For Loops',
        objective: 'Iterate with for loops using range().',
        explanation: `For loops iterate over a sequence:

• **range(n)**: Numbers from 0 to n-1
• **range(start, stop)**: Numbers from start to stop-1

For loops are cleaner than while loops for counting.`,
        code: `# Basic for loop
for i in range(5):
    print(i)

# Sum using for loop
total = 0
for i in range(1, 11):
    total = total + i

print(total)

# Multiplication table
for i in range(1, 6):
    result = 3 * i
    print(result)`,
    },

    // ── 9. Lists ──
    {
        id: 9,
        title: '9. Lists',
        topic: 'Lists',
        objective: 'Create, access, modify, and grow lists.',
        explanation: `Lists store ordered collections of items:

• **Create**: nums = [1, 2, 3]
• **Access**: nums[0] → first item
• **Modify**: nums[1] = 99
• **Append**: nums.append(4) → add to end
• **Length**: len(nums) → number of items

Lists are zero-indexed (first item is at index 0).`,
        code: `# Create a list
nums = [10, 20, 30]

# Access elements
first = nums[0]
print(first)

# Modify an element
nums[1] = 99
print(nums[1])

# Append
nums.append(40)
size = len(nums)
print(size)

# Build a list in a loop
squares = []
for i in range(1, 6):
    squares.append(i * i)

print(squares[0])
print(squares[4])`,
    },

    // ── 10. List Patterns ──
    {
        id: 10,
        title: '10. List Patterns',
        topic: 'List Patterns',
        objective: 'Learn accumulation, filtering, and transformation patterns.',
        explanation: `Common list patterns:

• **Accumulate**: Build a result by processing each item
• **Filter**: Keep only items that match a condition
• **Transform**: Create a new list by changing each item

These patterns are fundamental to programming.`,
        code: `# Accumulation: sum all elements
nums = [3, 7, 2, 9, 4]
total = 0
i = 0
while i < len(nums):
    total = total + nums[i]
    i = i + 1

print(total)

# Find maximum
nums2 = [5, 12, 3, 8, 1]
max_val = nums2[0]
j = 1
while j < len(nums2):
    if nums2[j] > max_val:
        max_val = nums2[j]
    j = j + 1

print(max_val)`,
    },

    // ── 11. Functions ──
    {
        id: 11,
        title: '11. Functions',
        topic: 'Functions',
        objective: 'Define and call functions with parameters and return values.',
        explanation: `Functions are reusable blocks of code:

• **def**: Defines a function
• **Parameters**: Input values in parentheses
• **return**: Sends a value back to the caller
• **Arguments**: Values passed when calling

Functions make code modular and reusable.`,
        code: `# Define a function
def greet(name):
    message = "Hello " + name
    return message

result = greet("Alice")
print(result)

# Function with multiple params
def add(a, b):
    return a + b

total = add(10, 20)
print(total)

# Function that modifies a list
def double_all(lst):
    i = 0
    while i < len(lst):
        lst[i] = lst[i] * 2
        i = i + 1

nums = [1, 2, 3]
double_all(nums)
print(nums[0])
print(nums[1])
print(nums[2])`,
    },

    // ── 12. Scope ──
    {
        id: 12,
        title: '12. Scope & Local Variables',
        topic: 'Scope',
        objective: 'Understand local vs global scope.',
        explanation: `Scope determines where a variable is accessible:

• **Local scope**: Variables inside a function
• **Global scope**: Variables outside all functions
• Each function call creates its own scope

Local variables don't affect variables with the same name in other scopes.`,
        code: `x = 10

def change_x():
    x = 99
    print(x)

change_x()
print(x)

# Each call gets its own scope
def counter(n):
    total = 0
    i = 0
    while i < n:
        total = total + 1
        i = i + 1
    return total

a = counter(5)
b = counter(3)
print(a)
print(b)`,
    },

    // ── 13. Recursion ──
    {
        id: 13,
        title: '13. Recursion',
        topic: 'Recursion',
        objective: 'Understand recursive functions and the call stack.',
        explanation: `Recursion is when a function calls itself:

• **Base case**: When to stop recursing
• **Recursive case**: The function calls itself with simpler input
• **Call stack**: Each call adds a frame; returns pop frames

Recursion is powerful for problems that have self-similar structure.`,
        code: `# Factorial: n! = n * (n-1)!
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

result = factorial(5)
print(result)

# Sum from 1 to n
def sum_to(n):
    if n <= 0:
        return 0
    return n + sum_to(n - 1)

total = sum_to(10)
print(total)`,
    },

    // ── 14. Classes & Objects ──
    {
        id: 14,
        title: '14. Classes & Objects',
        topic: 'OOP Basics',
        objective: 'Define classes with __init__ and create objects.',
        explanation: `Object-Oriented Programming (OOP) organizes code around objects:

• **class**: Blueprint for creating objects
• **__init__**: Constructor — runs when you create an object
• **self**: Reference to the current object instance
• **Attributes**: Data stored on the object (self.name)

Objects bundle data and behavior together.`,
        code: `class Dog:
    def __init__(self, name, age):
        self.name = name
        self.age = age

buddy = Dog("Buddy", 3)
print(buddy.name)
print(buddy.age)

rex = Dog("Rex", 5)
print(rex.name)`,
    },

    // ── 15. Methods & State ──
    {
        id: 15,
        title: '15. Methods & Object State',
        topic: 'OOP Methods',
        objective: 'Add methods to classes that read and modify object state.',
        explanation: `Methods are functions defined inside a class:

• Methods automatically receive **self** as the first argument
• Methods can read attributes: self.count
• Methods can modify attributes: self.count = self.count + 1
• Methods make objects interactive and stateful

This is the core of object-oriented programming.`,
        code: `class Counter:
    def __init__(self):
        self.count = 0

    def increment(self):
        self.count = self.count + 1

    def get_count(self):
        return self.count

c = Counter()
c.increment()
c.increment()
c.increment()
result = c.get_count()
print(result)`,
    },
];
