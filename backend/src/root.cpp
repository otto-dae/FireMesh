// src/root.cpp - ROOT NODE FINAL
#include <Arduino.h>
#include <ArduinoJson.h>
#include "credentials.hpp"
#include "WiFiManager.hpp"
#include "FirebaseManager.hpp"
#include "SyncManager.hpp"

// ========== INSTANCIAS GLOBALES ==========
Scheduler userScheduler;
painlessMesh mesh;
WiFiManager wifiManager(WIFI_SSID, WIFI_PASSWORD);
FirebaseManager firebaseManager;
SyncManager syncManager(&mesh);

// ========== PROTOTIPOS ==========
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);
void changedConnectionCallback();
void announceRoot();

// ========== TAREAS ==========
Task taskAnnounceRoot(10000, TASK_FOREVER, &announceRoot);

// ========== SETUP ==========
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("ROOT NODE CON FIREBASE INICIANDO");

  // 1. WiFi + Firebase
  if (wifiManager.connect()) {
    firebaseManager.begin(
      FIREBASE_API_KEY,
      FIREBASE_DATABASE_URL,
      FIREBASE_USER_EMAIL,
      FIREBASE_USER_PASSWORD
    );
  } else {
    Serial.println("[ERROR] Sin WiFi. Firebase deshabilitado.");
  }

  // 2. Mesh
  mesh.setDebugMsgTypes(ERROR | STARTUP | CONNECTION);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);
  mesh.onChangedConnections(&changedConnectionCallback);
  mesh.stationManual(WIFI_SSID, WIFI_PASSWORD);
  mesh.setHostname("FireMesh_Root");

  // 3. Activar broadcast periódico
  userScheduler.addTask(taskAnnounceRoot);
  taskAnnounceRoot.enable();

  Serial.println("[ROOT] Sistema iniciado - Broadcast activo cada 10s\n");
}

// ========== LOOP ==========
void loop() {
  mesh.update();
}

// ========== BROADCAST: Anunciar ROOT cada 10s ==========
void announceRoot() {
  StaticJsonDocument<128> doc;
  doc["type"] = "SYNC";
  doc["root"] = mesh.getNodeId();

  String msg;
  serializeJson(doc, msg);
  mesh.sendBroadcast(msg);

  auto nodes = mesh.getNodeList();
  Serial.printf("[ROOT] Broadcast SYNC (ID: %u | %d childs visibles)\n", 
                mesh.getNodeId(), nodes.size());
}

// ========== CALLBACK: Mensajes recibidos ==========
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[ROOT] Error parseando JSON");
    return;
  }

  String type = doc["type"];

  // Respuesta a solicitud de sincronización NTP
  if (type == "TIME") {
    syncManager.handleSyncRequest(from);
    return;
  }

  // Recepción de datos de sensores
  if (type.startsWith("DATA")) {
    if (doc["body"].isNull()) {
      Serial.println("[ROOT] Body ausente en DATA");
      return;
    }

    int humo = doc["body"]["humo"];
    int fuego = doc["body"]["fuego"];
    unsigned long long ts = doc["body"]["ts"];
    uint32_t srcNode = doc["src"];

    Serial.printf("[ROOT] DATA de nodo %u | humo=%d, fuego=%d, ts=%llu\n",
                  srcNode, humo, fuego, ts);

    firebaseManager.sendData(humo, fuego, ts, type, srcNode);
  }
}

// ========== CALLBACK: Nueva conexión directa ==========
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("[ROOT] Nueva conexión directa: %u\n", nodeId);

  // Enviar SYNC inmediato al nuevo nodo
  StaticJsonDocument<128> doc;
  doc["type"] = "SYNC";
  doc["root"] = mesh.getNodeId();

  String msg;
  serializeJson(doc, msg);
  mesh.sendSingle(nodeId, msg);
}

//CALLBACK
void changedConnectionCallback() {
  auto nodes = mesh.getNodeList();
  Serial.printf("[ROOT] Topología cambió (%d nodos ahora)\n", nodes.size());
}