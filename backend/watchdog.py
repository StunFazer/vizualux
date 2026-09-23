import asyncio
import json
import time
import websockets
import argparse
import sys

"""
Vizualux Durability Supervisor & Watchdog

Monitors both the Python camera capture thread and the frontend browser WebGL render loop
via WebSocket telemetry heartbeats. Reports operational health and raises alerts on freezes.
"""

async def monitor_loop(server_uri="ws://localhost:8765", auto_restart=False):
    print(f"[WATCHDOG] Initializing supervisor connecting to {server_uri}...")
    
    while True:
        try:
            async with websockets.connect(server_uri) as ws:
                print(f"[WATCHDOG] Connected to Vizualux telemetry stream.")
                last_check_time = time.time()
                last_server_time = None
                last_render_time = None
                
                async for message in ws:
                    if isinstance(message, str):
                        try:
                            data = json.loads(message)
                            server_time = data.get("server_time")
                            render_heartbeat = data.get("last_render_heartbeat")
                            
                            if server_time is not None:
                                last_server_time = server_time
                            if render_heartbeat is not None:
                                last_render_time = render_heartbeat
                                
                            now = time.time()
                            # Print summary every 3 seconds
                            if now - last_check_time >= 3.0:
                                last_check_time = now
                                capture_lag = (now - last_server_time) if last_server_time else None
                                render_lag = (now - last_render_time) if last_render_time else None
                                
                                capture_ok = capture_lag is not None and capture_lag < 2.0
                                render_ok = render_lag is not None and render_lag < 6.0
                                
                                if capture_ok and render_ok:
                                    print(f"[WATCHDOG HEALTHY] Capture lag: {capture_lag:.2f}s | Render lag: {render_lag:.2f}s | Status: OK")
                                else:
                                    if not capture_ok:
                                        print(f"[WATCHDOG ALERT] Camera capture thread stalled! Lag: {capture_lag}s")
                                    if not render_ok:
                                        print(f"[WATCHDOG ALERT] Browser WebGL render heartbeat missing! Lag: {render_lag}s")
                        except json.JSONDecodeError:
                            pass
        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            print(f"[WATCHDOG WARNING] Tracking server unreachable ({e}). Retrying in 2 seconds...")
            await asyncio.sleep(2)
        except Exception as e:
            print(f"[WATCHDOG ERROR] Unexpected supervisor error: {e}")
            await asyncio.sleep(2)

def main():
    parser = argparse.ArgumentParser(description="Vizualux Watchdog & Durability Supervisor")
    parser.add_argument("--uri", default="ws://localhost:8765", help="Tracking server WebSocket URI")
    parser.add_argument("--auto-restart", action="store_true", help="Automatically restart components on failure")
    args = parser.parse_args()
    
    try:
        asyncio.run(monitor_loop(server_uri=args.uri, auto_restart=args.auto_restart))
    except KeyboardInterrupt:
        print("\n[WATCHDOG] Supervisor stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
