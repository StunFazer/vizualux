import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class SkeletonTracker:
    def __init__(self, detection_confidence=0.3, presence_confidence=0.3, tracking_confidence=0.3, enable_segmentation=False, num_poses=4):
        self.enable_segmentation = enable_segmentation
        self.num_poses = num_poses
        
        base_options = python.BaseOptions(model_asset_path='pose_landmarker_full.task')
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            min_pose_detection_confidence=detection_confidence,
            min_pose_presence_confidence=presence_confidence,
            min_tracking_confidence=tracking_confidence,
            num_poses=num_poses if enable_segmentation else 1,
            output_segmentation_masks=enable_segmentation
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)
        self._frame_count = 0

    def process_frame(self, frame, target_size=(320, 180)):
        """
        Takes an OpenCV BGR frame, converts to RGB, and extracts coordinates.
        If segmentation is enabled, also extracts and combines neural segmentation masks.
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
            "segmentation_mask": None
        }
        
        # 1. Process Landmark Coordinates (from primary person or closest pose)
        if results.pose_landmarks and len(results.pose_landmarks) > 0:
            landmarks = results.pose_landmarks[0]
            data["is_tracking"] = True
            
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
            
            com_x = (l_shoulder.x + r_shoulder.x + l_hip.x + r_hip.x) / 4.0
            com_y = (l_shoulder.y + r_shoulder.y + l_hip.y + r_hip.y) / 4.0
            com_z = (l_shoulder.z + r_shoulder.z + l_hip.z + r_hip.z) / 4.0
            data["center_of_mass"] = {"x": com_x, "y": com_y, "z": com_z}
            
        # 2. Extract and combine segmentation masks from all detected people
        if self.enable_segmentation and results.segmentation_masks and len(results.segmentation_masks) > 0:
            first_view = results.segmentation_masks[0].numpy_view()
            combined_mask = np.zeros(first_view.shape, dtype=np.float32)
            
            for mask_img in results.segmentation_masks:
                combined_mask = np.maximum(combined_mask, mask_img.numpy_view())
                
            # Convert float confidence [0.0, 1.0] to uint8 [0, 255]
            uint8_mask = (np.clip(combined_mask, 0.0, 1.0) * 255).astype(np.uint8)
            
            if (uint8_mask.shape[1], uint8_mask.shape[0]) != target_size:
                uint8_mask = cv2.resize(uint8_mask, target_size, interpolation=cv2.INTER_LINEAR)
                
            data["segmentation_mask"] = uint8_mask
            data["is_tracking"] = True
            
        return data
