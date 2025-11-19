#!/usr/bin/env python3
"""測試 Claude CLI 的輸出格式"""

import subprocess
import uuid

# 生成測試用的 session ID
session_id = str(uuid.uuid4())
test_message = "你好，請說 'Hello World'"

# 建構指令
cmd = [
    "claude",
    "--print",
    "--verbose",
    "--output-format", "stream-json",
    "--session-id", session_id,
    "--dangerously-skip-permissions",
    test_message
]

print(f"執行指令: {' '.join(cmd)}\n")
print("=" * 60)

# 執行指令
process = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    bufsize=1
)

print("STDOUT 輸出:")
print("-" * 60)
for line in process.stdout:
    print(f">>> {line.rstrip()}")

process.wait()

print("\n" + "=" * 60)
print(f"Return code: {process.returncode}")

if process.returncode != 0:
    stderr = process.stderr.read()
    print(f"\nSTDERR 輸出:")
    print("-" * 60)
    print(stderr)
