import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Obtener alertas (con filtros opcionales)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const level = searchParams.get('level');
    const resolved = searchParams.get('resolved');

    const where: any = {};

    if (deviceId) {
      const device = await prisma.device.findUnique({
        where: { deviceId },
      });
      if (device) {
        where.deviceId = device.id;
      }
    }

    if (level) {
      where.level = level.toUpperCase();
    }

    if (resolved !== null) {
      where.isResolved = resolved === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        device: {
          select: {
            deviceId: true,
            name: true,
            location: true,
          },
        },
      },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Error al obtener alertas' },
      { status: 500 }
    );
  }
}

// POST: Crear una alerta manualmente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, level, message, temperature, smoke, flame } = body;

    if (!deviceId || !level || !message) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { deviceId },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'Dispositivo no encontrado' },
        { status: 404 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        deviceId: device.id,
        level: level.toUpperCase(),
        message,
        temperature,
        smoke,
        flame,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Error al crear alerta' },
      { status: 500 }
    );
  }
}
