import os
import sys
import subprocess

current_dir = os.path.dirname(os.path.abspath(__file__))
target_script = os.path.join(current_dir, "qa_full_test.py")

result = subprocess.run([sys.executable, target_script], cwd=current_dir, capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr)
sys.exit(result.returncode)
