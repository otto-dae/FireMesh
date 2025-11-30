'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceMapMarker } from '@/lib/types';
import { Flame, Wind, Thermometer, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface DeviceListProps {
  devices: DeviceMapMarker[];
  onDeviceSelect?: (deviceId: string) => void;
}

export default function DeviceList({ devices, onDeviceSelect }: DeviceListProps) {
  return (
    <div className="space-y-3 h-full overflow-y-auto">
      {devices.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No hay dispositivos disponibles
        </div>
      ) : (
        devices.map((device) => (
          <Card
            key={device.deviceId}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onDeviceSelect?.(device.deviceId)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{device.name}</CardTitle>
                  <CardDescription className="text-xs">{device.location}</CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Badge
                    variant={
                      device.alertLevel === 'CRITICAL'
                        ? 'destructive'
                        : device.alertLevel === 'WARNING'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {device.alertLevel}
                  </Badge>
                  <span
                    className={`text-xs ${
                      device.isOnline ? 'text-green-500' : 'text-gray-400'
                    }`}
                  >
                    {device.isOnline ? '● Online' : '○ Offline'}
                  </span>
                </div>
              </div>
            </CardHeader>
            {device.lastReading && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Thermometer className="h-3 w-3 text-orange-500" />
                    <span>{device.lastReading.temperature.toFixed(1)}°C</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Wind className="h-3 w-3 text-gray-500" />
                    <span>{device.lastReading.smoke.toFixed(0)} ppm</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-red-500" />
                    <span>{device.lastReading.flame.toFixed(0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Clock className="h-3 w-3" />
                  <span>{format(device.lastReading.timestamp, 'HH:mm:ss')}</span>
                </div>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
