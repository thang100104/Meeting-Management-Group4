"""
Master Test Runner - Meeting Management System (Group 4)
Chạy tuần tự toàn bộ 7 bộ kịch bản kiểm thử (155 test cases) và tổng hợp kết quả.
"""

import os
import sys
import subprocess
from datetime import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

TEST_SUITES = [
    {
        "file": "qa_verification_suite.py",
        "name": "QA Verification Suite (Bộ kiểm thử 24 test cases độc lập)",
        "expected_tests": 24
    },
    {
        "file": "qa_full_test.py",
        "name": "QA Full Regression Suite (Bộ kiểm thử 81 test cases toàn diện)",
        "expected_tests": 81
    },
    {
        "file": "test_phase1.py",
        "name": "Phase 1: Authentication & RBAC (9 test cases)",
        "expected_tests": 9
    },
    {
        "file": "test_phase2.py",
        "name": "Phase 2: Rooms & Role Restrictions (11 test cases)",
        "expected_tests": 11
    },
    {
        "file": "test_phase3.py",
        "name": "Phase 3: Booking & Conflict Engine (9 test cases)",
        "expected_tests": 9
    },
    {
        "file": "test_phase4.py",
        "name": "Phase 4: Equipment Management & Booking (13 test cases)",
        "expected_tests": 13
    },
    {
        "file": "test_approvals.py",
        "name": "Admin Approval Workflow (8 test cases)",
        "expected_tests": 8
    }
]

def main():
    print("=" * 80)
    print("🚀 BẮT ĐẦU CHẠY TOÀN BỘ CÁC BỘ KIỂM THỬ HỆ THỐNG (MASTER TEST RUNNER)")
    print(f"⏰ Thời gian khởi động: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    results = []

    for idx, suite in enumerate(TEST_SUITES, 1):
        test_path = os.path.join(BACKEND_DIR, suite["file"])
        print(f"\n[{idx}/{len(TEST_SUITES)}] Đang thực thi: {suite['name']} ({suite['file']})...")
        print("-" * 70)
        
        start_time = datetime.now()
        proc = subprocess.run(
            [sys.executable, test_path],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        duration = (datetime.now() - start_time).total_seconds()

        passed = (proc.returncode == 0)
        print(proc.stdout.strip())
        if proc.stderr.strip() and not passed:
            print("STDERR:")
            print(proc.stderr.strip())

        status_str = "✅ PASS" if passed else "❌ FAIL"
        print(f"\n--> Kết quả [{suite['file']}]: {status_str} (Thời gian: {duration:.2f}s)")
        results.append({
            "suite": suite["name"],
            "file": suite["file"],
            "tests": suite["expected_tests"],
            "passed": passed,
            "duration": duration
        })

    print("\n" + "=" * 80)
    print("📊 BẢNG TỔNG KẾT TOÀN DIỆN KẾT QUẢ KIỂM THỬ")
    print("=" * 80)
    print(f"{'STT':<4} | {'Tên Bộ Test Suite':<45} | {'Số Tests':<8} | {'Trạng Thái':<10} | {'Thời gian'}")
    print("-" * 80)

    total_tests = sum(r["tests"] for r in results)
    all_passed = all(r["passed"] for r in results)

    for i, r in enumerate(results, 1):
        st = "PASS" if r["passed"] else "FAIL"
        print(f"{i:<4} | {r['suite'][:45]:<45} | {r['tests']:<8} | {st:<10} | {r['duration']:.2f}s")

    print("-" * 80)
    print(f"TỔNG CỘNG: {total_tests} test cases | 7/7 suites: {'100% PASS' if all_passed else 'CÓ LỖI'}")
    print("=" * 80)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
