import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Crear dispositivos de ejemplo
  const devices = [
  {
    deviceId: "estacionamiento",
    name: "Estacionamiento",
    location: "Estacionamiento",
    latitude: 20.70476770442253,
    longitude: -100.4441135875159,
    isActive: true,
  },
  {
    deviceId: "salones_d",
    name: "Entrada Principal",
    location: "Entrada",
    latitude: 20.7037869485072,
    longitude: -100.4429250984333,
    isActive: true,
  },
  {
    deviceId: "cafeteria",
    name: "Entrada Edificio",
    location: "Entrada / Fachada",
    latitude: 20.7042037705179,
    longitude: -100.4436296150508,
    isActive: true,
  },
  {
    deviceId: "innovacion",
    name: "Patio Trasero",
    location: "Exterior / Patio trasero",
    latitude: 20.70284786439671,
    longitude: -100.4430410311724,
    isActive: true,
  },
  ];

  for (const device of devices) {
    const created = await prisma.device.upsert({
      where: { deviceId: device.deviceId },
      update: {},
      create: device,
    });
    console.log(`✅ Dispositivo creado: ${created.name}`);

    // Crear lecturas de ejemplo para cada dispositivo
    const now = new Date();
    const readings = [];

    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(now.getTime() - i * 60000); // Cada minuto
      readings.push({
        deviceId: created.id,
        temperature: 20 + Math.random() * 10, // 20-30°C
        smoke: Math.random() * 200, // 0-200 ppm
        flame: Math.random() * 100, // 0-100
        timestamp,
      });
    }

    await prisma.sensorReading.createMany({
      data: readings,
    });
    console.log(`   📊 ${readings.length} lecturas creadas`);
  }
  console.log("✅ Seeding completado!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
