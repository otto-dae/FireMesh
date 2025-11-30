'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Thermometer, Wind, Flame, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeviceData {
  id: string;
  deviceId: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  readings: Array<{
    id: string;
    temperature: number;
    smoke: number;
    flame: number;
    timestamp: string;
  }>;
  alerts: Array<{
    id: string;
    level: string;
    message: string;
    createdAt: string;
    isResolved: boolean;
  }>;
}

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDevice() {
      try {
        const response = await fetch(`/api/devices/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setDevice(data);
        } else {
          console.error('Device not found');
        }
      } catch (error) {
        console.error('Error fetching device:', error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchDevice();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Dispositivo no encontrado</p>
        <Button onClick={() => router.push('/')}>Volver al Dashboard</Button>
      </div>
    );
  }

  const latestReading = device.readings[0];
  const chartData = device.readings
    .slice(0, 50)
    .reverse()
    .map((reading) => ({
      time: format(new Date(reading.timestamp), 'HH:mm:ss'),
      temperature: reading.temperature,
      smoke: reading.smoke,
      flame: reading.flame,
    }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{device.name}</h1>
                <p className="text-sm text-muted-foreground">{device.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={device.isActive ? 'default' : 'secondary'}>
                {device.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
              <span className="text-sm text-muted-foreground">ID: {device.deviceId}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Métricas actuales */}
        {latestReading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temperatura</CardTitle>
                <Thermometer className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestReading.temperature.toFixed(1)}°C</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.timestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nivel de Humo</CardTitle>
                <Wind className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestReading.smoke.toFixed(0)} ppm</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.timestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Detección de Llama</CardTitle>
                <Flame className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestReading.flame.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {format(new Date(latestReading.timestamp), "d 'de' MMM, HH:mm:ss", {
                    locale: es,
                  })}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs con gráficas y tablas */}
        <Tabs defaultValue="charts" className="w-full">
          <TabsList>
            <TabsTrigger value="charts">Gráficas</TabsTrigger>
            <TabsTrigger value="readings">Historial de Lecturas</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Sensores</CardTitle>
                <CardDescription>Últimas 50 lecturas del dispositivo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f97316"
                      name="Temperatura (°C)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="smoke"
                      stroke="#6b7280"
                      name="Humo (ppm)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="flame"
                      stroke="#ef4444"
                      name="Llama"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="readings">
            <Card>
              <CardHeader>
                <CardTitle>Lecturas Recientes</CardTitle>
                <CardDescription>Historial detallado de mediciones</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Temperatura</TableHead>
                      <TableHead>Humo</TableHead>
                      <TableHead>Llama</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {device.readings.slice(0, 20).map((reading) => (
                      <TableRow key={reading.id}>
                        <TableCell>
                          {format(new Date(reading.timestamp), "d 'de' MMM, HH:mm:ss", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>{reading.temperature.toFixed(1)}°C</TableCell>
                        <TableCell>{reading.smoke.toFixed(0)} ppm</TableCell>
                        <TableCell>{reading.flame.toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Alertas</CardTitle>
                <CardDescription>Alertas generadas por este dispositivo</CardDescription>
              </CardHeader>
              <CardContent>
                {device.alerts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay alertas registradas
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha/Hora</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Mensaje</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {device.alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell>
                            {format(new Date(alert.createdAt), "d 'de' MMM, HH:mm:ss", {
                              locale: es,
                            })}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                alert.level === 'CRITICAL'
                                  ? 'destructive'
                                  : alert.level === 'WARNING'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {alert.level}
                            </Badge>
                          </TableCell>
                          <TableCell>{alert.message}</TableCell>
                          <TableCell>
                            {alert.isResolved ? '✓ Resuelta' : '⚠ Activa'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
