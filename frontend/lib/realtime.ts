import { ref, onValue, off, DataSnapshot } from 'firebase/database';
import { database } from './firebase';
import { RealtimeDeviceData } from './types';

/**
 * Escucha cambios en tiempo real de un dispositivo específico
 * Estructura en Firebase: /devices/{deviceId}
 */
export function subscribeToDevice(
  deviceId: string,
  callback: (data: RealtimeDeviceData | null) => void
): () => void {
  const deviceRef = ref(database, `devices/${deviceId}`);

  onValue(deviceRef, (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val() as RealtimeDeviceData;
      callback(data);
    } else {
      callback(null);
    }
  });

  // Retornar función para desuscribirse
  return () => off(deviceRef);
}

/**
 * Escucha cambios en tiempo real de todos los dispositivos
 * Estructura en Firebase: /devices/
 */
export function subscribeToAllDevices(
  callback: (devices: Record<string, RealtimeDeviceData>) => void
): () => void {
  const devicesRef = ref(database, 'devices');

  onValue(devicesRef, (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val() as Record<string, RealtimeDeviceData>;
      callback(data);
    } else {
      callback({});
    }
  });

  // Retornar función para desuscribirse
  return () => off(devicesRef);
}

/**
 * Hook personalizado para usar en componentes React
 * (usar con useState/useEffect)
 */
export function useRealtimeDevices() {
  // Este es un helper que puedes usar en tus componentes
  // Ejemplo de uso en componente:
  /*
  const [devices, setDevices] = useState<Record<string, RealtimeDeviceData>>({});
  
  useEffect(() => {
    const unsubscribe = subscribeToAllDevices(setDevices);
    return () => unsubscribe();
  }, []);
  */
  
  return {
    subscribeToAllDevices,
    subscribeToDevice,
  };
}
