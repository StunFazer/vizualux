import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class SkeletonTracker:
    def __init__(self, detection_confidence=0.3, presence_confidence=0.3, tracking_confidence=0.3):
        # Using the new MediaPipe Tasks API since mp.solutions is deprecated/missing in new builds
        base_options = python.BaseOptions(model_asset_path='pose_landmarker_full.task')
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            min_pose_detection_confidence=detection_confidence,
            min_pose_presence_confidence=presence_confidence,
            min_tracking_confidence=tracking_confidence
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)
        self._frame_count = 0

    def process_frame(self, frame):
        """
        Takes an OpenCV BGR frame, converts to RGB, and extracts coordinates.
        Returns a dictionary with normalized coordinates.
        """
        # Convert the BGR image to RGB
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Create MediaPipe Image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        
        # Process the image in VIDEO mode with monotonic timestamp
        self._frame_count += 1
        timestamp_ms = self._frame_count * (1000 // 60)
        results = self.landmarker.detect_for_video(mp_image, timestamp_ms)
        
        data = {
            "is_tracking": False,
            "center_of_mass": None,
            "left_hand": None,
            "right_hand": None,
            "left_foot": None,
            "right_foot": None,
        }
        
        if results.pose_landmarks and len(results.pose_landmarks) > 0:
            landmarks = results.pose_landmarks[0]
            data["is_tracking"] = True
            
            # Landmark indices
            # 15: left wrist, 16: right wrist
            # 27: left ankle, 28: right ankle
            # 11: left shoulder, 12: right shoulder
            # 23: left hip, 24: right hip
            
            l_wrist = landmarks[15]
            r_wrist = landmarks[16]
            l_ankle = landmarks[27]
            r_ankle = landmarks[28]
            
            l_shoulder = landmarks[11]
            r_shoulder = landmarks[12]
            l_hip = landmarks[23]
            r_hip = landmarks[24]
            
            data["left_hand"] = {"x": l_wrist.x, "y": l_wrist.y, "z": l_wrist.z, "visibility": getattr(l_wrist, 'visibility', 1.0)}
            data["right_hand"] = {"x": r_wrist.x, "y": r_wrist.y, "z": r_wrist.z, "visibility": getattr(r_wrist, 'visibility', 1.0)}
            data["left_foot"] = {"x": l_ankle.x, "y": l_ankle.y, "z": l_ankle.z, "visibility": getattr(l_ankle, 'visibility', 1.0)}
            data["right_foot"] = {"x": r_ankle.x, "y": r_ankle.y, "z": r_ankle.z, "visibility": getattr(r_ankle, 'visibility', 1.0)}
            
            # Approximate center of mass using average of shoulders and hips
            com_x = (l_shoulder.x + r_shoulder.x + l_hip.x + r_hip.x) / 4.0
            com_y = (l_shoulder.y + r_shoulder.y + l_hip.y + r_hip.y) / 4.0
            com_z = (l_shoulder.z + r_shoulder.z + l_hip.z + r_hip.z) / 4.0
            data["center_of_mass"] = {"x": com_x, "y": com_y, "z": com_z}
            
        return data
