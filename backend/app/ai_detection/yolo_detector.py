"""YOLOv8 Mobile Phone Detector."""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import logging
from ultralytics import YOLO

from app.configuration.settings import settings

logger = logging.getLogger(__name__)


class Detection:
    """Represents a single detection result."""
    def __init__(
        self,
        class_id: int,
        class_name: str,
        confidence: float,
        bbox: Tuple[int, int, int, int],  # x1, y1, x2, y2
    ):
        self.class_id = class_id
        self.class_name = class_name
        self.confidence = confidence
        self.bbox = bbox  # x1, y1, x2, y2

    @property
    def x1(self) -> int:
        return self.bbox[0]

    @property
    def y1(self) -> int:
        return self.bbox[1]

    @property
    def x2(self) -> int:
        return self.bbox[2]

    @property
    def y2(self) -> int:
        return self.bbox[3]

    @property
    def width(self) -> int:
        return self.x2 - self.x1

    @property
    def height(self) -> int:
        return self.y2 - self.y1

    @property
    def center(self) -> Tuple[int, int]:
        return ((self.x1 + self.x2) // 2, (self.y1 + self.y2) // 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "class_id": self.class_id,
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": {
                "x1": self.x1,
                "y1": self.y1,
                "x2": self.x2,
                "y2": self.y2,
                "width": self.width,
                "height": self.height,
            },
            "center": self.center,
        }


class YOLOPhoneDetector:
    """YOLOv8-based mobile phone detector for COCO 'cell phone' class."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
        device: Optional[str] = None,
        target_class_id: Optional[int] = None,
        target_class_name: Optional[str] = None,
    ):
        """
        Initialize the YOLO phone detector.

        Args:
            model_path: Path to YOLO model file (default: yolov8n.pt)
            confidence_threshold: Minimum confidence for detections
            iou_threshold: IoU threshold for NMS
            device: Device to run inference on ('cpu' or 'cuda')
            target_class_id: COCO class ID to detect (default: 67 for cell phone)
            target_class_name: COCO class name to detect (default: 'cell phone')
        """
        self.model_path = model_path or settings.yolo_model_path
        self.confidence_threshold = confidence_threshold or settings.yolo_confidence_threshold
        self.iou_threshold = iou_threshold or settings.yolo_iou_threshold
        self.device = device or settings.yolo_device
        self.target_class_id = target_class_id or settings.detection_target_class_id
        self.target_class_name = target_class_name or settings.detection_target_class_name

        self.model: Optional[YOLO] = None
        self._is_loaded = False
        self._class_names: Dict[int, str] = {}

        # Load model on initialization
        self.load_model()

    def load_model(self) -> bool:
        """
        Load the YOLO model.

        Returns:
            True if model loaded successfully, False otherwise.
        """
        try:
            logger.info(f"Loading YOLO model from {self.model_path} on {self.device}...")
            self.model = YOLO(self.model_path)
            self.model.to(self.device)

            # Get class names from model
            self._class_names = self.model.names

            # Verify target class exists
            if self.target_class_id not in self._class_names:
                logger.warning(
                    f"Target class ID {self.target_class_id} not found in model. "
                    f"Available classes: {self._class_names}"
                )
                # Try to find by name
                for class_id, class_name in self._class_names.items():
                    if class_name.lower() == self.target_class_name.lower():
                        self.target_class_id = class_id
                        logger.info(f"Found target class '{self.target_class_name}' at ID {class_id}")
                        break

            self._is_loaded = True
            logger.info(f"YOLO model loaded successfully. Target class: {self.target_class_id} ({self._class_names.get(self.target_class_id, 'unknown')})")
            return True

        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self._is_loaded = False
            return False

    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._is_loaded and self.model is not None

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect mobile phones in a frame.

        Args:
            frame: Input frame as numpy array (BGR format from OpenCV)

        Returns:
            List of Detection objects for mobile phones only
        """
        if not self.is_loaded():
            logger.warning("Model not loaded, attempting to reload...")
            if not self.load_model():
                return []

        try:
            # Run inference
            results = self.model(
                frame,
                conf=self.confidence_threshold,
                iou=self.iou_threshold,
                device=self.device,
                verbose=False,
                classes=[self.target_class_id],  # Only detect target class
            )

            detections = []
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get box coordinates (xyxy format)
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = self._class_names.get(class_id, f"class_{class_id}")

                        detection = Detection(
                            class_id=class_id,
                            class_name=class_name,
                            confidence=confidence,
                            bbox=(x1, y1, x2, y2),
                        )
                        detections.append(detection)

            return detections

        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []

    def detect_all(self, frame: np.ndarray) -> List[Detection]:
        """
        Detect all objects in a frame (not just phones).

        Args:
            frame: Input frame as numpy array

        Returns:
            List of all Detection objects
        """
        if not self.is_loaded():
            if not self.load_model():
                return []

        try:
            results = self.model(
                frame,
                conf=self.confidence_threshold,
                iou=self.iou_threshold,
                device=self.device,
                verbose=False,
            )

            detections = []
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        confidence = float(box.conf[0].cpu().numpy())
                        class_id = int(box.cls[0].cpu().numpy())
                        class_name = self._class_names.get(class_id, f"class_{class_id}")

                        detection = Detection(
                            class_id=class_id,
                            class_name=class_name,
                            confidence=confidence,
                            bbox=(x1, y1, x2, y2),
                        )
                        detections.append(detection)

            return detections

        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []

    def draw_detections(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        color: Tuple[int, int, int] = (0, 255, 0),
        thickness: int = 2,
        font_scale: float = 0.6,
    ) -> np.ndarray:
        """
        Draw detection bounding boxes and labels on frame.

        Args:
            frame: Input frame
            detections: List of detections to draw
            color: BGR color for boxes
            thickness: Line thickness
            font_scale: Font scale for labels

        Returns:
            Frame with drawn detections
        """
        annotated_frame = frame.copy()

        for detection in detections:
            x1, y1, x2, y2 = detection.bbox

            # Draw bounding box
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, thickness)

            # Prepare label
            label = f"{detection.class_name}: {detection.confidence:.2%}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)

            # Draw label background
            cv2.rectangle(
                annotated_frame,
                (x1, y1 - label_size[1] - 10),
                (x1 + label_size[0], y1),
                color,
                -1,
            )

            # Draw label text
            cv2.putText(
                annotated_frame,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (0, 0, 0),
                thickness,
            )

        return annotated_frame

    def update_confidence_threshold(self, threshold: float) -> None:
        """Update confidence threshold."""
        self.confidence_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"Confidence threshold updated to {self.confidence_threshold}")

    def update_iou_threshold(self, threshold: float) -> None:
        """Update IoU threshold."""
        self.iou_threshold = max(0.0, min(1.0, threshold))
        logger.info(f"IoU threshold updated to {self.iou_threshold}")

    def get_model_info(self) -> Dict[str, Any]:
        """Get model information."""
        return {
            "model_path": self.model_path,
            "device": self.device,
            "confidence_threshold": self.confidence_threshold,
            "iou_threshold": self.iou_threshold,
            "target_class_id": self.target_class_id,
            "target_class_name": self.target_class_name,
            "is_loaded": self.is_loaded(),
            "class_names": self._class_names if self._class_names else {},
        }


# Global detector instance
_detector_instance: Optional[YOLOPhoneDetector] = None


def get_detector() -> YOLOPhoneDetector:
    """Get or create global detector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = YOLOPhoneDetector()
    return _detector_instance


def reset_detector() -> YOLOPhoneDetector:
    """Reset and recreate global detector instance."""
    global _detector_instance
    _detector_instance = YOLOPhoneDetector()
    return _detector_instance