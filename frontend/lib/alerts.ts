import { AlertLevel, AlertThresholds, MQTTSensorPayload } from './types';

// Umbrales por defecto para alertas
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  temperature: {
    warning: 35, // °C
    critical: 50, // °C
  },
  smoke: {
    warning: 300, // ppm o valor de sensor
    critical: 600, // ppm o valor de sensor
  },
  flame: {
    warning: 200, // 0-1023 scale
    critical: 500, // 0-1023 scale
  },
};

/**
 * Calcula el nivel de alerta basado en lecturas de sensores
 */
export function calculateAlertLevel(
  data: MQTTSensorPayload,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): AlertLevel {
  const { temperature, smoke, flame } = data;

  // Verificar niveles críticos
  if (
    temperature >= thresholds.temperature.critical ||
    smoke >= thresholds.smoke.critical ||
    flame >= thresholds.flame.critical
  ) {
    return 'CRITICAL';
  }

  // Verificar niveles de advertencia
  if (
    temperature >= thresholds.temperature.warning ||
    smoke >= thresholds.smoke.warning ||
    flame >= thresholds.flame.warning
  ) {
    return 'WARNING';
  }

  return 'NORMAL';
}

/**
 * Genera mensaje de alerta basado en nivel y lecturas
 */
export function generateAlertMessage(
  level: AlertLevel,
  data: MQTTSensorPayload
): string {
  const { temperature, smoke, flame } = data;

  if (level === 'CRITICAL') {
    const reasons = [];
    if (temperature >= DEFAULT_THRESHOLDS.temperature.critical) {
      reasons.push(`Temperatura crítica: ${temperature}°C`);
    }
    if (smoke >= DEFAULT_THRESHOLDS.smoke.critical) {
      reasons.push(`Humo crítico: ${smoke} ppm`);
    }
    if (flame >= DEFAULT_THRESHOLDS.flame.critical) {
      reasons.push(`Llama detectada: ${flame}`);
    }
    return `⚠️ ALERTA CRÍTICA: ${reasons.join(', ')}`;
  }

  if (level === 'WARNING') {
    const reasons = [];
    if (temperature >= DEFAULT_THRESHOLDS.temperature.warning) {
      reasons.push(`Temperatura elevada: ${temperature}°C`);
    }
    if (smoke >= DEFAULT_THRESHOLDS.smoke.warning) {
      reasons.push(`Humo detectado: ${smoke} ppm`);
    }
    if (flame >= DEFAULT_THRESHOLDS.flame.warning) {
      reasons.push(`Posible llama: ${flame}`);
    }
    return `⚠️ Advertencia: ${reasons.join(', ')}`;
  }

  return 'Estado normal';
}

/**
 * Obtiene color para badge/marcador según nivel de alerta
 */
export function getAlertColor(level: AlertLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'red';
    case 'WARNING':
      return 'yellow';
    case 'NORMAL':
      return 'green';
    default:
      return 'gray';
  }
}

/**
 * Obtiene color hexadecimal para mapas
 */
export function getAlertHexColor(level: AlertLevel): string {
  switch (level) {
    case 'CRITICAL':
      return '#ef4444'; // red-500
    case 'WARNING':
      return '#eab308'; // yellow-500
    case 'NORMAL':
      return '#22c55e'; // green-500
    default:
      return '#6b7280'; // gray-500
  }
}
