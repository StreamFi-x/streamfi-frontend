export interface CameraAngle {
  id: string;
  label: string;
  playback_id: string;
}

export interface MultiAngleStream {
  stream_id: string;
  title: string;
  angles: CameraAngle[];
}

export interface AnglesListResponse {
  angles: CameraAngle[];
}

export interface SelectAngleBody {
  viewer_id: string;
  stream_id: string;
  angle_id: string;
}

export interface SelectAngleResponse {
  viewer_id: string;
  stream_id: string;
  angle_id: string;
}

export interface ViewerAngleSelection {
  viewer_id: string;
  stream_id: string;
  angle_id: string;
  selected_at: string;
}
