export type AlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface Device {
  id: string;
  deviceId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SensorReading {
  id: string;
  deviceId: string;
  temperature: number;
  smoke: number;
  flame: number;
  timestamp: Date;
}

export interface Alert {
  id: string;
  deviceId: string;
  level: AlertLevel;
  message: string;
  temperature?: number;
  smoke?: number;
  flame?: number;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

// Tipo para datos en tiempo real desde Firebase
export interface RealtimeDeviceData {
  deviceId: string;
  temperature?: number;
  smoke: number;
  flame: number;
  alertLevel: AlertLevel;
  timestamp: number;
  isOnline: boolean;
}

// Estructura real de Firebase para lecturas
export interface FirebaseLectura {
  fuego: number;
  humo: number;
  nodeId: number;
  serverTimestamp: number;
  timestamp: number;
  type: string;
}

export interface FirebaseNode {
  lecturas: Record<string, FirebaseLectura>;
  ultimaConexion: number;
}

// Tipo para datos que llegan desde MQTT (ESP32)
export interface MQTTSensorPayload {
  deviceId: string;
  temperature: number;
  smoke: number;
  flame: number;
  timestamp?: string;
}

// Umbrales para cálculo de alertas
export interface AlertThresholds {
  temperature: {
    warning: number;
    critical: number;
  };
  smoke: {
    warning: number;
    critical: number;
  };
  flame: {
    warning: number;
    critical: number;
  };
}

// Estado del dispositivo para el mapa
export interface DeviceMapMarker {
  deviceId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  alertLevel: AlertLevel;
  lastReading?: {
    temperature?: number;
    smoke: number;
    flame: number;
    timestamp: Date;
  };
  isOnline: boolean;
}
