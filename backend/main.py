import asyncio
import json
import cv2
import websockets
from tracker import SkeletonTracker
from motion_detector import MotionDetector
import cv2.aruco as aruco
import base64
import argparse
import platform

# Global variables
latest_data = {"is_tracking": False}
current_camera_index = 0
camera_changed = False
is_calibrating = False
tracking_mode = "pose"  # "pose" or "motion"
tracking_mode_changed = False
tracker_config = {"detection": 0.3, "presence": 0.3, "tracking": 0.3}
tracker_config_changed = False
is_auto_calibrating = False

async def capture_loop(debug_mode=False):
    """
    Continuously capture frames from the camera and process them.
    Runs asynchronously alongside the websocket server.
    """
    global latest_data, current_camera_index, camera_changed, is_calibrating
    global tracking_mode, tracking_mode_changed, tracker_config, tracker_config_changed, is_auto_calibrating
    
    cap = None
    tracker = SkeletonTracker()
    motion_det = MotionDetector()
    
    while True:
        # If camera changed or not initialized, open the new camera
        if cap is None or camera_changed:
            if cap is not None:
                print(f"Releasing camera {cap}")
                cap.release()
                
            print(f"Starting camera capture on index {current_camera_index}")
            
            if platform.system() == 'Windows':
                print(f"Using DirectShow backend for camera {current_camera_index} on Windows...")
                cap = cv2.VideoCapture(current_camera_index, cv2.CAP_DSHOW)
                if not cap.isOpened():
                    print("DirectShow failed to open camera. Falling back to default Windows media backend...")
                    cap.release()
                    cap = cv2.VideoCapture(current_camera_index)
            else:
                cap = cv2.VideoCapture(current_camera_index)

            # Try to set 60fps and HD resolution if possible
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            cap.set(cv2.CAP_PROP_FPS, 60)
            
            camera_changed = False

            if tracker_config_changed:
                print(f"Re-initializing tracker with config: {tracker_config}")
                tracker = SkeletonTracker(
                    detection_confidence=tracker_config["detection"],
                    presence_confidence=tracker_config["presence"],
                    tracking_confidence=tracker_config["tracking"]
                )
                tracker_config_changed = False
            
        ret, frame = cap.read()
        if not ret:
            print(f"Failed to grab frame from camera {current_camera_index}. Retrying...")
            await asyncio.sleep(1)
            continue
            
        # Flip the frame horizontally for a mirror effect
        frame = cv2.flip(frame, 1)
        
        # Process the frame
        if tracking_mode == "pose":
            latest_data = tracker.process_frame(frame)
        else:
            latest_data = motion_det.process_frame(frame)
        
        if is_calibrating:
            # Resize for faster encoding and smaller payload
            small_frame = cv2.resize(frame, (640, 360))
            _, buffer = cv2.imencode('.jpg', small_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            latest_data['frame'] = 'data:image/jpeg;base64,' + base64.b64encode(buffer).decode('utf-8')

        if is_auto_calibrating:
            aruco_dict = aruco.getPredefinedDictionary(aruco.DICT_4X4_50)
            parameters = aruco.DetectorParameters()
            detector = aruco.ArucoDetector(aruco_dict, parameters)
            corners, ids, _ = detector.detectMarkers(frame)
            if ids is not None and len(ids) >= 4:
                h_frame, w_frame = frame.shape[:2]
                marker_centers = {}
                for i, marker_id in enumerate(ids.flatten()):
                    if marker_id in [0, 1, 2, 3]:
                        c = corners[i][0]
                        center_x = float(c[:, 0].mean()) / w_frame
                        center_y = float(c[:, 1].mean()) / h_frame
                        marker_centers[int(marker_id)] = {"x": round(center_x, 4), "y": round(center_y, 4)}
                if all(mid in marker_centers for mid in [0, 1, 2, 3]):
                    latest_data['auto_calibrate_result'] = [
                        marker_centers[0], marker_centers[1],
                        marker_centers[2], marker_centers[3]
                    ]
                    is_auto_calibrating = False
                    print(f"Auto-calibration successful: {marker_centers}")
        
        if debug_mode:
            if latest_data["is_tracking"]:
                h, w, _ = frame.shape
                for key in ["left_hand", "right_hand", "left_foot", "right_foot", "center_of_mass"]:
                    pt = latest_data[key]
                    if pt:
                        cx, cy = int(pt["x"] * w), int(pt["y"] * h)
                        cv2.circle(frame, (cx, cy), 10, (0, 255, 0), -1)
                        cv2.putText(frame, key, (cx + 10, cy), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                        
            cv2.imshow('Tracking Debug (Press Q to quit)', frame)
            
        # OpenCV requires the event pump to run on Windows to keep DirectShow buffers flushing
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
        # Yield control back to the event loop
        await asyncio.sleep(0.001)

    if cap:
        cap.release()
    cv2.destroyAllWindows()

async def websocket_receive(websocket):
    """
    Task to handle incoming messages from the frontend
    """
    global current_camera_index, camera_changed, is_calibrating
    global tracking_mode, tracking_mode_changed, tracker_config, tracker_config_changed, is_auto_calibrating
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("type") == "set_camera":
                    new_index = data.get("index")
                    if new_index is not None and new_index != current_camera_index:
                        print(f"Received request to change camera to {new_index}")
                        current_camera_index = new_index
                        camera_changed = True
                elif data.get("type") == "set_calibrating":
                    is_calibrating = bool(data.get("value"))
                    print(f"Calibration mode set to {is_calibrating}")
                elif data.get("type") == "set_thresholds":
                    tracker_config["detection"] = float(data.get("detection", 0.3))
                    tracker_config["presence"] = float(data.get("presence", 0.3))
                    tracker_config["tracking"] = float(data.get("tracking", 0.3))
                    tracker_config_changed = True
                    print(f"Tracker thresholds updated: {tracker_config}")
                elif data.get("type") == "set_tracking_mode":
                    new_mode = data.get("mode", "pose")
                    if new_mode in ["pose", "motion"]:
                        tracking_mode = new_mode
                        print(f"Tracking mode set to: {tracking_mode}")
                elif data.get("type") == "start_auto_calibrate":
                    is_auto_calibrating = True
                    print("Auto-calibration started, looking for ArUco markers...")
            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass

def get_camera_list():
    cameras = []
    if platform.system() == 'Windows':
        try:
            from pygrabber.dshow_graph import FilterGraph
            graph = FilterGraph()
            devices = graph.get_input_devices()
            for idx, name in enumerate(devices):
                cameras.append({"index": idx, "name": f"Camera {idx}: {name}"})
        except Exception as e:
            print(f"Error listing cameras via pygrabber: {e}")
    
    # Fallback if empty or not Windows
    if not cameras:
        for idx in range(10):
            cameras.append({"index": idx, "name": f"Camera {idx}"})
    return cameras

async def websocket_handler(websocket, path=None):
    """
    Handle incoming websocket connections and broadcast tracking data.
    """
    print(f"Client connected from {websocket.remote_address}")
    
    # Send current camera list to the client
    cameras = get_camera_list()
    await websocket.send(json.dumps({"type": "camera_list", "cameras": cameras}))
    
    # Start the receive task concurrently
    receive_task = asyncio.create_task(websocket_receive(websocket))
    
    try:
        while True:
            # Broadcast the latest data at ~60fps
            await websocket.send(json.dumps(latest_data))
            await asyncio.sleep(1/60)
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    finally:
        receive_task.cancel()

async def main():
    global current_camera_index
    parser = argparse.ArgumentParser(description='Run tracking backend.')
    parser.add_argument('--camera', type=int, default=0, help='Camera input index (default: 0)')
    parser.add_argument('--debug', action='store_true', help='Show a debug window with the camera feed and tracking dots')
    args = parser.parse_args()
    
    current_camera_index = args.camera

    # Start the websocket server
    server = await websockets.serve(websocket_handler, "0.0.0.0", 8765)
    print("WebSocket server listening on ws://0.0.0.0:8765")
    if args.debug:
        print("Debug mode enabled. A window will open showing the camera feed.")
    
    # Run the capture loop concurrently
    await capture_loop(debug_mode=args.debug)

if __name__ == "__main__":
    asyncio.run(main())
