import cv2
import numpy as np

class BackgroundSegmenter:
    """
    OpenCV MOG2 background subtractor for segmenting arbitrary moving subjects and objects.
    Applies morphological filtering and dynamic projection area masking to eliminate optical feedback loops.
    """
    def __init__(self, history=500, var_threshold=25, detect_shadows=False):
        self.subtractor = cv2.createBackgroundSubtractorMOG2(
            history=history,
            varThreshold=var_threshold,
            detectShadows=detect_shadows
        )
        self.open_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        self.close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        self.projection_corners = None
        self._cached_poly = None
        self._cached_shape = None
        self.min_blob_area = 150  # Filter out transient particle sparks

    def set_projection_corners(self, corners):
        """
        corners: list of 4 dicts [{'x': float, 'y': float}, ...] in normalized [0, 1] coords.
        """
        if corners and len(corners) == 4:
            self.projection_corners = corners
            self._cached_poly = None  # Invalidate cached pixel polygon
        else:
            self.projection_corners = None
            self._cached_poly = None

    def _get_projection_mask(self, shape):
        """Generates a binary mask of the projection area at the given (h, w) shape."""
        if not self.projection_corners:
            return None
        h, w = shape[:2]
        if self._cached_shape != (h, w) or self._cached_poly is None:
            pts = np.array([[int(c['x'] * w), int(c['y'] * h)] for c in self.projection_corners], dtype=np.int32)
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.fillPoly(mask, [pts], 255)
            self._cached_poly = mask
            self._cached_shape = (h, w)
        return self._cached_poly

    def process_frame(self, frame, target_size=(320, 180)):
        """
        Extracts foreground mask, denoises, rejects optical feedback in projection zone,
        and resizes to target streaming dimensions.
        """
        fg_mask = self.subtractor.apply(frame)
        
        # Threshold to binary (0 or 255)
        _, binary_mask = cv2.threshold(fg_mask, 200, 255, cv2.THRESH_BINARY)
        
        # Remove salt-and-pepper noise
        cleaned = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, self.open_kernel)
        # Fill holes within moving subjects
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, self.close_kernel)
        
        # Contour area filtering to reject transient projector particle flashes
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filtered_mask = np.zeros_like(cleaned)
        for cnt in contours:
            if cv2.contourArea(cnt) >= self.min_blob_area:
                cv2.drawContours(filtered_mask, [cnt], -1, 255, thickness=cv2.FILLED)
        
        if (filtered_mask.shape[1], filtered_mask.shape[0]) != target_size:
            filtered_mask = cv2.resize(filtered_mask, target_size, interpolation=cv2.INTER_NEAREST)
            
        return filtered_mask

    def reset(self):
        self.subtractor = cv2.createBackgroundSubtractorMOG2(
            history=500,
            varThreshold=25,
            detectShadows=False
        )
