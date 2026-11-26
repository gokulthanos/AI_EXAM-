#!/usr/bin/env python3
"""
Smart Surveillance - AI Mobile Phone Detection System
Single-command startup script.

Usage:
    python run.py [--check-only] [--backend-only] [--frontend-only] [--port PORT]

This script will:
1. Check Python and Node.js dependencies
2. Initialize the SQLite database
3. Start the FastAPI backend server
4. Start the React Vite frontend development server
5. Display URLs and logs
6. Handle graceful shutdown on Ctrl+C
"""

import argparse
import asyncio
import os
import signal
import subprocess
import sys
import time
import threading
import webbrowser
from pathlib import Path
from typing import Optional, List


# Configuration
ROOT_DIR = Path(__file__).parent.absolute()
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_DIR = BACKEND_DIR / "venv"
BACKEND_PORT = 8000
FRONTEND_PORT = 5173

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


def print_colored(message: str, color: str = Colors.RESET):
    """Print colored message to terminal."""
    print(f"{color}{message}{Colors.RESET}")


def print_header(message: str):
    """Print a header message."""
    print_colored(f"\n{'='*60}", Colors.CYAN)
    print_colored(f"  {message}", Colors.BOLD + Colors.CYAN)
    print_colored(f"{'='*60}", Colors.CYAN)


def print_step(message: str):
    """Print a step message."""
    print_colored(f"  -> {message}", Colors.BLUE)


def print_success(message: str):
    """Print a success message."""
    print_colored(f"  [OK] {message}", Colors.GREEN)


def print_warning(message: str):
    """Print a warning message."""
    print_colored(f"  [WARN] {message}", Colors.YELLOW)


def print_error(message: str):
    """Print an error message."""
    print_colored(f"  [FAIL] {message}", Colors.RED)


def run_command(cmd: List[str], cwd: Path, capture: bool = False, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    try:
        if capture:
            result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=check)
            return result
        else:
            result = subprocess.run(cmd, cwd=cwd, check=check)
            return result
    except subprocess.CalledProcessError as e:
        if capture:
            return e
        raise


def check_python_version() -> bool:
    """Check if Python version is 3.10+."""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 10:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} (OK)")
        return True
    else:
        print_error(f"Python 3.10+ required, found {version.major}.{version.minor}.{version.micro}")
        return False


def check_node_version() -> bool:
    """Check if Node.js is available."""
    # On Windows, node might be node.exe
    node_cmd = ["node.exe", "--version"] if sys.platform == "win32" else ["node", "--version"]
    result = run_command(node_cmd, ROOT_DIR, capture=True, check=False)
    if result.returncode == 0:
        version = result.stdout.strip()
        print_success(f"Node.js {version} (OK)")
        return True
    else:
        print_error("Node.js not found. Please install Node.js 18+")
        return False


def check_npm_version() -> bool:
    """Check if npm is available."""
    # On Windows, npm is npm.cmd
    npm_cmd = ["npm.cmd", "--version"] if sys.platform == "win32" else ["npm", "--version"]
    result = run_command(npm_cmd, ROOT_DIR, capture=True, check=False)
    if result.returncode == 0:
        version = result.stdout.strip()
        print_success(f"npm {version} (OK)")
        return True
    else:
        print_error("npm not found")
        return False


def check_backend_dependencies(python_exe: Optional[str] = None) -> bool:
    """Check if Python dependencies are installed."""
    print_step("Checking Python dependencies...")
    
    if python_exe is None:
        python_exe = sys.executable
    
    # Check if virtual environment exists
    if not VENV_DIR.exists():
        print_warning("Virtual environment not found. Will use system Python if deps available.")
        return False
    
    # Check key packages
    venv_python = VENV_DIR / "Scripts" / "python.exe" if sys.platform == "win32" else VENV_DIR / "bin" / "python"
    if not venv_python.exists():
        print_warning("Virtual environment python not found.")
        return False
    
    result = run_command([str(venv_python), "-c", "import fastapi, uvicorn, sqlalchemy, ultralytics, cv2; print('OK')"], 
                         BACKEND_DIR, capture=True, check=False)
    if result.returncode == 0:
        print_success("Python dependencies installed in venv (OK)")
        return True
    
    # Also check system Python
    result = run_command([python_exe, "-c", "import fastapi, uvicorn, sqlalchemy, ultralytics, cv2; print('OK')"], 
                         BACKEND_DIR, capture=True, check=False)
    if result.returncode == 0:
        print_success("Python dependencies available in system Python (OK)")
        return True
    
    print_warning("Python dependencies missing")
    return False


def check_frontend_dependencies() -> bool:
    """Check if Node.js dependencies are installed."""
    print_step("Checking Node.js dependencies...")
    
    node_modules = FRONTEND_DIR / "node_modules"
    if not node_modules.exists():
        print_warning("node_modules not found. Will install.")
        return False
    
    package_json = FRONTEND_DIR / "package.json"
    if not package_json.exists():
        print_error("package.json not found")
        return False
    
    print_success("Node.js dependencies installed (OK)")
    return True


def create_virtualenv() -> bool:
    """Create Python virtual environment."""
    print_step("Creating Python virtual environment...")
    try:
        run_command([sys.executable, "-m", "venv", str(VENV_DIR)], ROOT_DIR)
        print_success("Virtual environment created")
        return True
    except Exception as e:
        print_error(f"Failed to create virtual environment: {e}")
        return False


def install_python_deps(python_exe: str) -> bool:
    """Install Python dependencies."""
    print_step("Installing Python dependencies (this may take a few minutes)...")
    
    pip_exe = VENV_DIR / "Scripts" / "pip.exe" if sys.platform == "win32" else VENV_DIR / "bin" / "pip"
    
    # Install requirements directly (skip pip upgrade to avoid permission issues)
    req_file = BACKEND_DIR / "requirements.txt"
    if not req_file.exists():
        print_error("requirements.txt not found")
        return False
    
    result = run_command([str(pip_exe), "install", "-r", str(req_file)], BACKEND_DIR, capture=True, check=False)
    if result.returncode != 0:
        print_error(f"Failed to install Python dependencies:\n{result.stderr}")
        return False
    
    print_success("Python dependencies installed")
    return True


def install_node_deps() -> bool:
    """Install Node.js dependencies."""
    print_step("Installing Node.js dependencies (this may take a few minutes)...")
    
    npm_cmd = ["npm.cmd", "install"] if sys.platform == "win32" else ["npm", "install"]
    result = run_command(npm_cmd, FRONTEND_DIR, capture=True, check=False)
    if result.returncode != 0:
        print_error(f"Failed to install Node.js dependencies:\n{result.stderr}")
        return False
    
    print_success("Node.js dependencies installed")
    return True


def init_database(python_exe: str) -> bool:
    """Initialize the SQLite database."""
    print_step("Initializing database...")
    
    # Run database initialization
    init_script = """
import sys
sys.path.insert(0, '.')
from app.database.connection import init_database
init_database()
print("Database initialized successfully")
"""
    result = run_command([python_exe, "-c", init_script], BACKEND_DIR, capture=True, check=False)
    if result.returncode != 0:
        print_error(f"Failed to initialize database:\n{result.stderr}")
        return False
    
    print_success("Database initialized")
    return True


def check_yolo_model() -> bool:
    """Check if YOLO model exists."""
    model_path = BACKEND_DIR / "yolov8n.pt"
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print_success(f"YOLO model found ({size_mb:.1f} MB)")
        return True
    else:
        print_warning("YOLO model (yolov8n.pt) not found - will auto-download on first run (~6 MB)")
        return True  # Not a failure, will auto-download


def start_backend(python_exe: str) -> Optional[subprocess.Popen]:
    """Start the FastAPI backend server."""
    print_step("Starting FastAPI backend...")
    
    # Set environment variables
    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    
    # Start the server - output directly to console to avoid buffer deadlock
    proc = subprocess.Popen(
        [python_exe, "-m", "app.main"],
        cwd=BACKEND_DIR,
        env=env,
    )
    
    # Wait for server to be ready
    print_step("Waiting for backend to be ready...")
    for i in range(60):  # Wait up to 60 seconds
        time.sleep(1)
        if proc.poll() is not None:
            # Process died
            print_error(f"Backend process exited unexpectedly (code: {proc.returncode})")
            return None
        
        # Check if server is responding
        try:
            import urllib.request
            urllib.request.urlopen(f"http://localhost:{BACKEND_PORT}/health", timeout=2)
            print_success(f"Backend running at http://localhost:{BACKEND_PORT}")
            print_success(f"API docs at http://localhost:{BACKEND_PORT}/docs")
            return proc
        except Exception:
            if i % 10 == 0:
                print_step(f"Backend starting... ({i+1}/60)")
            continue
    
    print_error("Backend failed to start within 60 seconds")
    proc.terminate()
    return None


def start_frontend() -> Optional[subprocess.Popen]:
    """Start the Vite frontend development server."""
    print_step("Starting React Vite frontend...")
    
    env = os.environ.copy()
    env["VITE_API_URL"] = f"http://localhost:{BACKEND_PORT}/api"
    env["VITE_WS_URL"] = f"ws://localhost:{BACKEND_PORT}"
    
    npm_cmd = ["npm.cmd", "run", "dev", "--", "--host"] if sys.platform == "win32" else ["npm", "run", "dev", "--", "--host"]
    
    proc = subprocess.Popen(
        npm_cmd,
        cwd=FRONTEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    
    # Start a thread to read and display frontend output
    def read_frontend_output():
        try:
            for line in iter(proc.stdout.readline, ''):
                if line:
                    # Filter out noisy logs
                    if "webpack" in line.lower() or "vite" in line.lower() or "compiled" in line.lower():
                        print_colored(f"  [Frontend] {line.rstrip()}", Colors.CYAN)
        except Exception:
            pass
    
    output_thread = threading.Thread(target=read_frontend_output, daemon=True)
    output_thread.start()
    
    # Wait for server to be ready
    print_step("Waiting for frontend to be ready...")
    for i in range(60):
        time.sleep(1)
        if proc.poll() is not None:
            print_error(f"Frontend process exited unexpectedly (code: {proc.returncode})")
            return None
        
        try:
            import urllib.request
            urllib.request.urlopen(f"http://localhost:{FRONTEND_PORT}", timeout=2)
            print_success(f"Frontend running at http://localhost:{FRONTEND_PORT}")
            return proc
        except Exception:
            if i % 10 == 0:
                print_step(f"Frontend starting... ({i+1}/60)")
            continue
    
    print_error("Frontend failed to start within 60 seconds")
    proc.terminate()
    return None


def monitor_process(name: str, proc: subprocess.Popen, stop_event: threading.Event):
    """Monitor a process and print its output."""
    if proc.stdout is None:
        # Process output goes directly to console
        proc.wait()
        return
    
    try:
        for line in iter(proc.stdout.readline, ''):
            if stop_event.is_set():
                break
            if line:
                # Filter out noisy logs
                if "INFO:     127.0.0.1" in line and ("/health" in line or "/v1/models" in line):
                    continue
                print_colored(f"  [{name}] {line.rstrip()}", Colors.CYAN)
    except Exception:
        pass


def open_browser():
    """Open the frontend in the default browser."""
    time.sleep(2)
    try:
        webbrowser.open(f"http://localhost:{FRONTEND_PORT}")
        print_success("Opened frontend in browser")
    except Exception:
        print_warning("Could not open browser automatically")


def check_only_mode() -> int:
    """Run only dependency checks."""
    print_header("Smart Surveillance - Dependency Check")
    
    all_ok = True
    all_ok &= check_python_version()
    all_ok &= check_node_version()
    all_ok &= check_npm_version()
    all_ok &= check_backend_dependencies()
    all_ok &= check_frontend_dependencies()
    all_ok &= check_yolo_model()
    
    print()
    if all_ok:
        print_header("All checks passed! Ready to run.")
        return 0
    else:
        print_header("Some checks failed. Run without --check-only to auto-fix.")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Smart Surveillance - AI Mobile Phone Detection System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run.py                    # Start full application
  python run.py --check-only       # Only check dependencies
  python run.py --backend-only     # Start only backend
  python run.py --frontend-only    # Start only frontend (requires running backend)
  python run.py --port 9000        # Use custom backend port
        """
    )
    parser.add_argument("--check-only", action="store_true", help="Only check dependencies, don't start servers")
    parser.add_argument("--backend-only", action="store_true", help="Start only the backend server")
    parser.add_argument("--frontend-only", action="store_true", help="Start only the frontend server")
    parser.add_argument("--port", type=int, default=8000, help="Backend port (default: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser automatically")
    
    args = parser.parse_args()
    
    global BACKEND_PORT
    BACKEND_PORT = args.port
    
    # Check-only mode
    if args.check_only:
        return check_only_mode()
    
    print_header("Smart Surveillance - AI Mobile Phone Detection System")
    print_colored(f"  Project: {ROOT_DIR}", Colors.CYAN)
    print_colored(f"  Backend: http://localhost:{BACKEND_PORT}", Colors.CYAN)
    print_colored(f"  Frontend: http://localhost:{FRONTEND_PORT}", Colors.CYAN)
    
    # Check prerequisites
    print_header("Checking Prerequisites")
    
    if not check_python_version():
        return 1
    if not check_node_version():
        return 1
    if not check_npm_version():
        return 1
    
    # Check and setup Python environment
    # First check if system Python has the dependencies
    system_python_ok = check_backend_dependencies(sys.executable)
    
    if not system_python_ok:
        # System Python doesn't have deps, check venv
        venv_python = VENV_DIR / "Scripts" / "python.exe" if sys.platform == "win32" else VENV_DIR / "bin" / "python"
        venv_ok = False
        if VENV_DIR.exists() and venv_python.exists():
            venv_ok = check_backend_dependencies(str(venv_python))
        
        if not venv_ok:
            # Need to create venv and install
            if not VENV_DIR.exists():
                if not create_virtualenv():
                    return 1
            if not install_python_deps(sys.executable):
                return 1
            python_exe = VENV_DIR / "Scripts" / "python.exe" if sys.platform == "win32" else VENV_DIR / "bin" / "python"
        else:
            python_exe = str(venv_python)
    else:
        # Use system Python directly
        python_exe = sys.executable
        print_success("Using system Python environment")
    
    # Check and setup Node.js environment
    if not check_frontend_dependencies():
        if not install_node_deps():
            return 1
    
    # Initialize database
    if not init_database(python_exe):
        return 1
    
    # Check YOLO model
    check_yolo_model()
    
    # Frontend-only mode
    if args.frontend_only:
        print_header("Starting Frontend Only")
        frontend_proc = start_frontend()
        if not frontend_proc:
            return 1
        
        if not args.no_browser:
            threading.Thread(target=open_browser, daemon=True).start()
        
        # Monitor frontend
        stop_event = threading.Event()
        monitor_thread = threading.Thread(target=monitor_process, args=("Frontend", frontend_proc, stop_event), daemon=True)
        monitor_thread.start()
        
        try:
            frontend_proc.wait()
        except KeyboardInterrupt:
            print_colored("\n\nShutting down...", Colors.YELLOW)
        finally:
            stop_event.set()
            frontend_proc.terminate()
        return 0
    
    # Start backend
    print_header("Starting Backend")
    backend_proc = start_backend(python_exe)
    if not backend_proc:
        return 1
    
    print_success("Backend started successfully")
    
    # Backend-only mode
    if args.backend_only:
        print_colored("\nBackend running. Press Ctrl+C to stop.", Colors.GREEN)
        stop_event = threading.Event()
        monitor_thread = threading.Thread(target=monitor_process, args=("Backend", backend_proc, stop_event), daemon=True)
        monitor_thread.start()
        
        try:
            backend_proc.wait()
        except KeyboardInterrupt:
            print_colored("\n\nShutting down...", Colors.YELLOW)
        finally:
            stop_event.set()
            backend_proc.terminate()
        return 0
    
    # Start frontend
    print_header("Starting Frontend")
    frontend_proc = start_frontend()
    if not frontend_proc:
        backend_proc.terminate()
        return 1
    
    # Open browser
    if not args.no_browser:
        threading.Thread(target=open_browser, daemon=True).start()
    
    # Monitor both processes
    print_header("Application Running")
    print_colored(f"  Backend:  http://localhost:{BACKEND_PORT}", Colors.CYAN)
    print_colored(f"  Frontend: http://localhost:{FRONTEND_PORT}", Colors.CYAN)
    print_colored(f"  API Docs: http://localhost:{BACKEND_PORT}/docs", Colors.CYAN)
    print_colored(f"  WebSocket: ws://localhost:{BACKEND_PORT}/ws", Colors.CYAN)
    print_colored("\n  Press Ctrl+C to stop both servers\n", Colors.YELLOW)
    
    stop_event = threading.Event()
    backend_thread = threading.Thread(target=monitor_process, args=("Backend", backend_proc, stop_event), daemon=True)
    frontend_thread = threading.Thread(target=monitor_process, args=("Frontend", frontend_proc, stop_event), daemon=True)
    backend_thread.start()
    frontend_thread.start()
    
    try:
        # Wait for either process to exit
        while backend_proc.poll() is None and frontend_proc.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print_colored("\n\nShutting down...", Colors.YELLOW)
    finally:
        stop_event.set()
        
        # Terminate both processes
        for name, proc in [("Backend", backend_proc), ("Frontend", frontend_proc)]:
            if proc.poll() is None:
                print_step(f"Stopping {name}...")
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                    print_success(f"{name} stopped")
                except subprocess.TimeoutExpired:
                    proc.kill()
                    print_warning(f"{name} force killed")
        
        print_success("Shutdown complete")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())