import sys

# Read all input from standard input
data = sys.stdin.read().strip()

if not data:
    exit()

# Convert to integer
n = int(data)

# Print the square to standard output
print(n * n)