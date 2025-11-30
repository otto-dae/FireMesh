import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateAlertLevel } from '@/lib/alerts';

// POST: Guardar una nueva lectura de sensor (desde ESP32/MQTT)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, temperature, smoke, flame } = body;

    if (!deviceId || temperature === undefined || smoke === undefined || flame === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el dispositivo existe
    const device = await prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Dispositivo no encontrado' },
        { status: 404 }
      );
    }

    // Guardar lectura
    const reading = await prisma.sensorReading.create({
      data: {
        deviceId: device.id,
        temperature,
        smoke,
        flame,
      },
    });

    // Calcular nivel de alerta
    const alertLevel = calculateAlertLevel({ temperature, smoke, flame });

    // Crear alerta si es WARNING o CRITICAL
    if (alertLevel !== 'NORMAL') {
      const messages = [];
      if (temperature > 50) messages.push(`Temperatura alta: ${temperature}°C`);
      if (smoke > 300) messages.push(`Humo detectado: ${smoke} ppm`);
      if (flame > 500) messages.push(`Llama detectada: ${flame}`);

      await prisma.alert.create({
        data: {
          deviceId: device.id,
          level: alertLevel,
          message: messages.join(', '),
          temperature,
          smoke,
          flame,
        },
      });
    }

    return NextResponse.json({ reading, alertLevel }, { status: 201 });
  } catch (error) {
    console.error('Error saving reading:', error);
    return NextResponse.json(
      { error: 'Error al guardar lectura' },
      { status: 500 }
    );
  }
}

// GET: Obtener lecturas de un dispositivo (con filtros opcionales)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { deviceId },
      });
      if (device) {
        where.deviceId = device.id;
      }
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const readings = await prisma.sensorReading.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        device: {
          select: {
            deviceId: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(readings);
  } catch (error) {
    console.error('Error fetching readings:', error);
    return NextResponse.json(
      { error: 'Error al obtener lecturas' },
      { status: 500 }
    );
  }
}
