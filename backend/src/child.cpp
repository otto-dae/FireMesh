#include <Arduino.h>
#include "credentials.hpp"
#include "SyncManager.hpp"

// Instancias globales
Scheduler userScheduler;
painlessMesh mesh;
SyncManager syncManager(&mesh);

// Prototipos
void sendSyncRequest();
void generateSensorData();
void sendDataToRoot(DataPacket reading, String tipo);

// Tareas periódicas
Task taskSync(10000, TASK_FOREVER, &sendSyncRequest);       // Sync cada 10s
Task taskSensor(5000, TASK_FOREVER, &generateSensorData);   // Sensores cada 5s

// Callbacks
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);

void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("CHILD NODE INICIANDO\n");

  mesh.setDebugMsgTypes(ERROR | STARTUP);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);

  userScheduler.addTask(taskSync);
  taskSync.enable();

  userScheduler.addTask(taskSensor);
  taskSensor.enable();

  pinMode(27, INPUT);
  pinMode(35, INPUT);

  Serial.println("[CHILD] Esperando ROOT...");
}

void loop() {
  mesh.update();
}

//
// TASK: Enviar petición de sincronización cada 10s
//
void sendSyncRequest() {
  uint32_t root = syncManager.getRootId();

  if (root != 0 && mesh.isConnected(root)) {
    StaticJsonDocument<128> doc;
    doc["type"] = "TIME";
    doc["src"] = mesh.getNodeId();

    String msg;
    serializeJson(doc, msg);
    mesh.sendSingle(root, msg);

    Serial.printf("[SYNC] Solicitud TIME enviada a %u\n", root);
  }
}

//
// TASK: Generar lectura y enviarla al ROOT
//
void generateSensorData() {
  DataPacket lectura;

  // timestamp sincronizado
  lectura.timestamp = syncManager.getSyncStatus() ? 
                      syncManager.getNetworkTime() : 0;

  lectura.humo  = analogRead(35);
  lectura.fuego = digitalRead(27);

  uint32_t root = syncManager.getRootId();
  bool online = (root != 0 && mesh.isConnected(root));

  if (!online) {
    Serial.println("[OFFLINE] Sin ROOT, guardando en buffer.");
    syncManager.addToBuffer(lectura);
    return;
  }

  // enviar
  sendDataToRoot(lectura, "DATA");

  // vaciar buffer si aplica
  if (syncManager.hasBufferedData()) {
    syncManager.flushBuffer(sendDataToRoot);
  }
}

//
// Enviar lectura al ROOT
//
void sendDataToRoot(DataPacket reading, String tipo) {
  String jsonMsg = syncManager.createDataJSON(reading, tipo, mesh.getNodeId());
  mesh.sendSingle(syncManager.getRootId(), jsonMsg);

  Serial.printf("[ONLINE] Enviando %s | humo=%d, fuego=%d | ts=%llu\n",
                tipo.c_str(), reading.humo, reading.fuego, reading.timestamp);
}

//
// Recibir mensajes MESH
//
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[Child] Error parseando JSON");
    return;
  }

  String type = doc["type"];

  // ROOT discovery (SYNC broadcast o directo)
  if (type == "SYNC") {
    uint32_t root = doc["root"]; // siempre viene aquí
    syncManager.setRootId(root);

    Serial.printf("[CHILD] ROOT detectado: %u\n", root);

    // Solicitamos TIME inmediatamente
    StaticJsonDocument<128> req;
    req["type"] = "TIME";
    req["src"] = mesh.getNodeId();

    String out;
    serializeJson(req, out);
    mesh.sendSingle(root, out);

    return;
  }

  // respuesta TIME del ROOT
  if (type == "TIME") {
    syncManager.handleSyncResponse(doc);
    return;
  }
}

//
// Evento: nuevo vecino
//
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("[CHILD] Nueva conexión: %u\n", nodeId);

  // intentar enviar el buffer pendiente si el root regresó
  if (syncManager.getRootId() != 0 &&
      mesh.isConnected(syncManager.getRootId()) &&
      syncManager.hasBufferedData()) {

    syncManager.flushBuffer(sendDataToRoot);
  }
}
