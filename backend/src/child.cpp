// src/child.cpp - CHILD NODE FINAL
#include <Arduino.h>
#include "credentials.hpp"
#include "SyncManager.hpp"

// ========== INSTANCIAS GLOBALES ==========
Scheduler userScheduler;
painlessMesh mesh;
SyncManager syncManager(&mesh);

// ========== PROTOTIPOS ==========
void sendSyncRequest();
void generateSensorData();
void checkRootConnection();
void sendDataToRoot(DataPacket reading, String tipo);
bool isNodeReachable(uint32_t nodeId);

// Callbacks
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);
void changedConnectionCallback();

// ========== TAREAS ==========
Task taskSync(10000, TASK_FOREVER, &sendSyncRequest);
Task taskSensor(5000, TASK_FOREVER, &generateSensorData);
Task taskCheckRoot(15000, TASK_FOREVER, &checkRootConnection);

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("CHILD NODE INICIANDO");

  // Configurar pines
  pinMode(27, INPUT);
  pinMode(35, INPUT);

  // Mesh
  mesh.setDebugMsgTypes(ERROR | STARTUP | CONNECTION);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);
  mesh.onChangedConnections(&changedConnectionCallback);

  // Activar tareas
  userScheduler.addTask(taskSync);
  taskSync.enable();

  userScheduler.addTask(taskSensor);
  taskSensor.enable();

  userScheduler.addTask(taskCheckRoot);
  taskCheckRoot.enable();

  Serial.println("[CHILD] Esperando ROOT...\n");
}

// ========== LOOP ==========
void loop() {
  mesh.update();
}

// ========== HELPER: Verificar si un nodo es alcanzable ==========
bool isNodeReachable(uint32_t nodeId) {
  auto nodes = mesh.getNodeList();
  for (auto &id : nodes) {
    if (id == nodeId) return true;
  }
  return false;
}

// ========== TAREA: Solicitar sincronización NTP ==========
void sendSyncRequest() {
  uint32_t root = syncManager.getRootId();

  if (root != 0 && isNodeReachable(root)) {
    StaticJsonDocument<128> doc;
    doc["type"] = "TIME";
    doc["src"] = mesh.getNodeId();

    String msg;
    serializeJson(doc, msg);
    mesh.sendSingle(root, msg);

    Serial.printf("[SYNC] TIME request → ROOT %u\n", root);
  } else {
    Serial.println("[SYNC] ROOT no alcanzable, esperando broadcast...");
  }
}

// ========== TAREA: Generar y enviar datos de sensores ==========
void generateSensorData() {
  DataPacket lectura;

  lectura.timestamp = syncManager.getSyncStatus() ? 
                      syncManager.getNetworkTime() : 0;

  lectura.humo  = analogRead(35);
  lectura.fuego = digitalRead(27);

  uint32_t root = syncManager.getRootId();
  bool online = (root != 0 && isNodeReachable(root));

  if (!online) {
    Serial.println("[OFFLINE] Sin ROOT, guardando en buffer.");
    syncManager.addToBuffer(lectura);
    return;
  }

  // Enviar datos
  sendDataToRoot(lectura, "DATA");

  // Vaciar buffer pendiente si hay
  if (syncManager.hasBufferedData()) {
    Serial.println("[BUFFER] Vaciando datos pendientes...");
    syncManager.flushBuffer(sendDataToRoot);
  }
}

// ========== TAREA: Verificar conexión con ROOT ==========
void checkRootConnection() {
  uint32_t root = syncManager.getRootId();

  if (root == 0) {
    Serial.println("[CHECK] No tengo ROOT, esperando broadcast...");
    return;
  }

  if (!isNodeReachable(root)) {
    Serial.printf("[CHECK] ROOT %u NO alcanzable → Reseteando...\n", root);
    syncManager.setRootId(0);
    syncManager.setSyncStatus(false);
    Serial.println("[CHECK] Esperando nuevo SYNC...");
  } else {
    auto nodes = mesh.getNodeList();
    Serial.printf("[CHECK] ROOT %u alcanzable (%d nodos visibles)\n", 
                  root, nodes.size());
  }
}

// ========== ENVIAR DATOS AL ROOT ==========
void sendDataToRoot(DataPacket reading, String tipo) {
  String jsonMsg = syncManager.createDataJSON(reading, tipo, mesh.getNodeId());
  mesh.sendSingle(syncManager.getRootId(), jsonMsg);

  Serial.printf("[TX] %s ROOT | humo=%d, fuego=%d | ts=%llu\n",
                tipo.c_str(), reading.humo, reading.fuego, reading.timestamp);
}

// ========== CALLBACK: Mensajes recibidos ==========
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[RX] Error parseando JSON");
    return;
  }

  String type = doc["type"];

  // ROOT discovery via SYNC broadcast
  if (type == "SYNC") {
    uint32_t root = doc["root"];
    uint32_t currentRoot = syncManager.getRootId();

    // Actualizar ROOT si no tengo o el anterior no está alcanzable
    bool shouldUpdate = (currentRoot == 0) || 
                       (root != currentRoot) || 
                       (!isNodeReachable(currentRoot));

    if (shouldUpdate) {
      syncManager.setRootId(root);
      Serial.printf("[SYNC] ROOT actualizado: %u (desde nodo %u)\n", root, from);

      // Solicitar TIME inmediatamente
      StaticJsonDocument<128> req;
      req["type"] = "TIME";
      req["src"] = mesh.getNodeId();

      String out;
      serializeJson(req, out);
      mesh.sendSingle(root, out);

      // Vaciar buffer si hay datos pendientes
      if (syncManager.hasBufferedData()) {
        Serial.println("[SYNC] ROOT recuperado, vaciando buffer...");
        delay(1000);  // Esperar estabilización de ruta
        syncManager.flushBuffer(sendDataToRoot);
      }
    }
    return;
  }

  // Respuesta TIME del ROOT
  if (type == "TIME") {
    syncManager.handleSyncResponse(doc);
    return;
  }
}

// ========== CALLBACK: Nueva conexión ==========
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("[MESH] Nueva conexión: %u\n", nodeId);

  // Si ROOT vuelve a estar alcanzable, vaciar buffer
  uint32_t root = syncManager.getRootId();
  if (root != 0 && isNodeReachable(root) && syncManager.hasBufferedData()) {
    Serial.println("[MESH] ROOT alcanzable, vaciando buffer...");
    delay(500);
    syncManager.flushBuffer(sendDataToRoot);
  }
}

// ========== CALLBACK: Topología cambió ==========
void changedConnectionCallback() {
  auto nodes = mesh.getNodeList();
  Serial.printf("[MESH] Topología cambió (%d nodos visibles)\n", nodes.size());

  uint32_t root = syncManager.getRootId();
  if (root != 0 && !isNodeReachable(root)) {
    Serial.printf("[MESH] ROOT %u perdido en cambio de topología\n", root);
    syncManager.setRootId(0);
    syncManager.setSyncStatus(false);
  }
}