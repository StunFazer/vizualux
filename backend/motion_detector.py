import cv2
import numpy as np

class MotionDetector:
    def __init__(self, min_area=500, blur_size=21, threshold=25, max_blobs=5):
        self.prev_gray = None
        self.min_area = min_area
        self.blur_size = blur_size
        self.threshold = threshold
        self.max_blobs = max_blobs
        self.prev_centroids = {}  # blob_id -> (x, y, time)
        self._frame_time = 0
    
    def process_frame(self, frame):
        """Process frame using frame differencing. Returns tracking data dict."""
        self._frame_time += 1.0 / 60.0  # approximate dt
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (self.blur_size, self.blur_size), 0)
        
        h, w = gray.shape
        
        data = {
            "is_tracking": False,
            "mode": "motion",
            "blobs": [],
            "center_of_mass": None,
            "left_hand": None,
            "right_hand": None,
            "left_foot": None,
            "right_foot": None,
        }
        
        if self.prev_gray is None:
            self.prev_gray = gray
            return data
        
        # Frame differencing
        diff = cv2.absdiff(self.prev_gray, gray)
        _, thresh = cv2.threshold(diff, self.threshold, 255, cv2.THRESH_BINARY)
        
        # Dilate to fill gaps
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter and sort by area
        valid_contours = [c for c in contours if cv2.contourArea(c) > self.min_area]
        valid_contours.sort(key=cv2.contourArea, reverse=True)
        valid_contours = valid_contours[:self.max_blobs]
        
        blobs = []
        for i, contour in enumerate(valid_contours):
            M = cv2.moments(contour)
            if M["m00"] == 0:
                continue
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]
            
            # Normalize to [0,1]
            nx = cx / w
            ny = cy / h
            area = cv2.contourArea(contour) / (w * h)
            
            # Calculate velocity from previous frame
            vx, vy = 0.0, 0.0
            direction = 0.0
            blob_id = i
            if blob_id in self.prev_centroids:
                prev_x, prev_y, prev_t = self.prev_centroids[blob_id]
                dt = self._frame_time - prev_t
                if dt > 0:
                    vx = (nx - prev_x) / dt
                    vy = (ny - prev_y) / dt
                    direction = float(np.arctan2(vy, vx))
            
            self.prev_centroids[blob_id] = (nx, ny, self._frame_time)
            
            blobs.append({
                "x": round(nx, 4),
                "y": round(ny, 4),
                "area": round(area, 6),
                "vx": round(vx, 4),
                "vy": round(vy, 4),
                "direction": round(direction, 4)
            })
        
        # Clean up old centroids
        current_ids = set(range(len(valid_contours)))
        self.prev_centroids = {k: v for k, v in self.prev_centroids.items() if k in current_ids}
        
        self.prev_gray = gray
        
        if blobs:
            data["is_tracking"] = True
            data["blobs"] = blobs
            
            # Map largest blob to left_foot and left_hand for compatibility
            data["left_foot"] = {"x": blobs[0]["x"], "y": blobs[0]["y"], "z": 0, "visibility": 1.0}
            data["left_hand"] = {"x": blobs[0]["x"], "y": blobs[0]["y"], "z": 0, "visibility": 1.0}
            data["center_of_mass"] = {"x": blobs[0]["x"], "y": blobs[0]["y"], "z": 0}
            
            # Map second largest to right_foot and right_hand if available
            if len(blobs) > 1:
                data["right_foot"] = {"x": blobs[1]["x"], "y": blobs[1]["y"], "z": 0, "visibility": 1.0}
                data["right_hand"] = {"x": blobs[1]["x"], "y": blobs[1]["y"], "z": 0, "visibility": 1.0}
            else:
                # If only one blob, mirror it to both hands/feet so interactive elements work
                data["right_foot"] = {"x": blobs[0]["x"], "y": blobs[0]["y"], "z": 0, "visibility": 1.0}
                data["right_hand"] = {"x": blobs[0]["x"], "y": blobs[0]["y"], "z": 0, "visibility": 1.0}
        
        return data
