import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from './firebase';
import { RealtimeDeviceData, FirebaseNode, FirebaseLectura } from './types';
import { calculateAlertLevel } from './alerts';

/**
 * Estructura en Firebase:
 * /nodos/{nodeId}/
 *   - lecturas/
 *     - {key}: {
 *         body: { fuego: boolean, humo: number, ts: number },
 *         src: number (nodeId),
 *         type: string ("DATA" o "DATA_HIST")
 *       }
 */

// Mapeo de nodeId a deviceId y metadatos
export const NODE_TO_DEVICE_MAP: Record<string, {
  deviceId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
}> = {
  '2805856045': {
    deviceId: 'nodo-1',
    name: 'Nodo Sensor 1',
    location: 'Área A',
    latitude: 20.70476770442253,
    longitude: -100.4441135875159,
  },
  '3710082173': {
    deviceId: 'nodo-2',
    name: 'Nodo Sensor 2',
    location: 'Área B',
    latitude: 20.70526770442253,
    longitude: -100.4446135875159,
  },
  '3710087789': {
    deviceId: 'nodo-3',
    name: 'Nodo Sensor 3',
    location: 'Área C',
    latitude: 20.70576770442253,
    longitude: -100.4451135875159,
  },
};

// Cache para guardar el timestamp de la última actualización POR DISPOSITIVO
const lastSeenTimestamps: Record<string, {
  serverTimestamp: number;  // Timestamp del ESP32
  clientTimestamp: number;  // Timestamp local cuando lo vimos
}> = {};

/**
 * Obtener nodeId desde deviceId
 */
export function getNodeIdFromDeviceId(deviceId: string): string | null {
  const entry = Object.entries(NODE_TO_DEVICE_MAP).find(
    ([, info]) => info.deviceId === deviceId
  );
  const result = entry ? entry[0] : null;
  return result;
}

/**
 * Obtener información de dispositivo por deviceId
 */
export function getDeviceInfoByDeviceId(deviceId: string) {
  const entry = Object.entries(NODE_TO_DEVICE_MAP).find(
    ([, info]) => info.deviceId === deviceId
  );
  const result = entry ? entry[1] : null;
  return result;
}

/**
 * Obtener la última lectura de un nodo
 */
function getLatestLectura(lecturas: Record<string, FirebaseLectura>): FirebaseLectura | null {
  const lecturasArray = Object.values(lecturas);
  if (lecturasArray.length === 0) return null;
  
  // Filtrar solo lecturas con datos válidos y ordenar por ts descendente
  return lecturasArray
    .filter(l => l.body && l.body.ts > 0)
    .sort((a, b) => b.body.ts - a.body.ts)[0] || null;
}

/**
 * Convertir nodo de Firebase al formato RealtimeDeviceData
 */
function convertFirebaseNode(
  nodeId: string,
  node: FirebaseNode
): RealtimeDeviceData | null {
  console.log('🔄 Convirtiendo nodo:', nodeId, 'Lecturas:', Object.keys(node.lecturas || {}).length);
  
  const deviceInfo = NODE_TO_DEVICE_MAP[nodeId];
  if (!deviceInfo) {
    console.warn('⚠️ No se encontró deviceInfo para nodeId:', nodeId);
    return null;
  }

  const latestLectura = getLatestLectura(node.lecturas);
  if (!latestLectura) {
    console.warn('⚠️ No hay lecturas para nodeId:', nodeId);
    return null;
  }

  console.log('📊 Última lectura:', latestLectura);

  // No hay sensor de temperatura, usar undefined
  const temperature = undefined;
  
  const alertLevel = calculateAlertLevel({
    temperature,
    smoke: latestLectura.body.humo,
    flame: latestLectura.body.fuego ? 1 : 0,
  });

  // ✅ DETECCIÓN CORRECTA DE ESTADO ONLINE
  const currentServerTimestamp = latestLectura.body.ts;
  const now = Date.now();
  
  // Verificar si ya vimos esta lectura antes
  const lastSeen = lastSeenTimestamps[nodeId];
  
  let isOnline = false;
  let razonamiento = '';
  
  if (!lastSeen) {
    // Primera vez que vemos este dispositivo
    lastSeenTimestamps[nodeId] = {
      serverTimestamp: currentServerTimestamp,
      clientTimestamp: now,
    };
    isOnline = true;
    razonamiento = 'Primera lectura recibida - ONLINE';
  } else if (currentServerTimestamp > lastSeen.serverTimestamp) {
    // El serverTimestamp cambió = nueva lectura = dispositivo activo
    lastSeenTimestamps[nodeId] = {
      serverTimestamp: currentServerTimestamp,
      clientTimestamp: now,
    };
    isOnline = true;
    razonamiento = 'Nueva lectura detectada - ONLINE';
  } else {
    // El serverTimestamp NO cambió, verificar cuánto tiempo pasó desde la última actualización
    const tiempoSinActualizar = now - lastSeen.clientTimestamp;
    const timeoutMs = 60000; // 60 segundos
    
    isOnline = tiempoSinActualizar < timeoutMs;
    razonamiento = isOnline 
      ? `Sin cambios pero dentro del timeout (${Math.floor(tiempoSinActualizar / 1000)}s) - ONLINE`
      : `Sin datos nuevos por ${Math.floor(tiempoSinActualizar / 1000)}s - OFFLINE`;
  }

  console.log('⏰ Estado del dispositivo:', {
    nodeId,
    currentServerTimestamp,
    lastSeenServerTimestamp: lastSeen?.serverTimestamp,
    tiempoTranscurrido: lastSeen ? `${Math.floor((now - lastSeen.clientTimestamp) / 1000)}s` : 'N/A',
    isOnline,
    razonamiento,
  });

  const result = {
    deviceId: deviceInfo.deviceId,
    temperature,
    smoke: latestLectura.body.humo,
    flame: latestLectura.body.fuego ? 1 : 0,
    alertLevel,
    timestamp: latestLectura.body.ts,
    isOnline,
  };

  console.log('✅ Dispositivo convertido:', result);
  return result;
}

/**
 * Obtener información estática de todos los dispositivos
 */
export async function getAllDeviceInfo() {
  const result = Object.entries(NODE_TO_DEVICE_MAP).reduce((acc, [, info]) => {
    acc[info.deviceId] = {
      name: info.name,
      location: info.location,
      latitude: info.latitude,
      longitude: info.longitude,
    };
    return acc;
  }, {} as Record<string, { name: string; location: string; latitude: number; longitude: number }>);
  return result;
}

/**
 * Escucha cambios en tiempo real de un nodo específico
 */
export function subscribeToDevice(
  nodeId: string,
  callback: (data: RealtimeDeviceData | null) => void
): () => void {
  const nodeRef = ref(database, `nodos/${nodeId}`);

  onValue(nodeRef, (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const nodeData = snapshot.val() as FirebaseNode;
      const deviceData = convertFirebaseNode(nodeId, nodeData);
      callback(deviceData);
    } else {
      callback(null);
    }
  });

  return () => {
    off(nodeRef);
  };
}

/**
 * Escucha cambios en tiempo real de todos los sensores
 */
export function subscribeToAllDevices(
  callback: (devices: Record<string, RealtimeDeviceData>) => void
): () => void {
  const nodosRef = ref(database, 'nodos');

  onValue(nodosRef, (snapshot: DataSnapshot) => {
    console.log('📨 Snapshot recibido. Existe:', snapshot.exists());
    
    if (snapshot.exists()) {
      const nodos = snapshot.val() as Record<string, FirebaseNode>;
      console.log('📦 Nodos encontrados:', Object.keys(nodos));
      const devicesData: Record<string, RealtimeDeviceData> = {};

      Object.entries(nodos).forEach(([nodeId, nodeData]) => {
        console.log(`🔄 Procesando nodo: ${nodeId}`);
        const deviceData = convertFirebaseNode(nodeId, nodeData);
        if (deviceData) {
          devicesData[deviceData.deviceId] = deviceData;
        }
      });

      console.log('🔥 Datos actualizados en firebase', devicesData);
      callback(devicesData);
    } else {
      console.error('❌ No existen datos en /nodos');
      callback({});
    }
  }, (error) => {
    console.error('❌ Error en subscribeToAllDevices:', error);
  });

  return () => {
    console.log('🔕 Desuscribiendo de todos los nodos');
    off(nodosRef);
  };
}

/**
 * Obtener todas las lecturas de un dispositivo específico (para historial)
 */
export function subscribeToDeviceReadings(
  deviceId: string,
  callback: (readings: FirebaseLectura[]) => void
): () => void {
  console.log('🔔 subscribeToDeviceReadings para:', deviceId);
  
  const nodeId = getNodeIdFromDeviceId(deviceId);
  if (!nodeId) {
    console.error('❌ No se encontró nodeId para deviceId:', deviceId);
    callback([]);
    return () => {};
  }

  const lecturasRef = ref(database, `nodos/${nodeId}/lecturas`);
  console.log('📡 Suscribiendo a lecturas en:', `nodos/${nodeId}/lecturas`);

  onValue(lecturasRef, (snapshot: DataSnapshot) => {
    console.log('📨 Lecturas recibidas. Existe:', snapshot.exists());
    
    if (snapshot.exists()) {
      const lecturasObj = snapshot.val() as Record<string, FirebaseLectura>;
      const lecturasArray = Object.values(lecturasObj)
        .filter(l => l.body && l.body.ts > 0)
        .sort((a, b) => b.body.ts - a.body.ts);
      console.log('✅ Lecturas procesadas:', lecturasArray.length);
      callback(lecturasArray);
    } else {
      console.warn('⚠️ No hay lecturas para:', deviceId);
      callback([]);
    }
  }, (error) => {
    console.error('❌ Error en subscribeToDeviceReadings:', error);
  });

  return () => {
    console.log('🔕 Desuscribiendo de lecturas:', deviceId);
    off(lecturasRef);
  };
}