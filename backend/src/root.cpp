// ROOT NODE - Nodo raíz con WiFi y Firebase

#include <Arduino.h>
#include <ArduinoJson.h>
#include "credentials.hpp"
#include "WiFiManager.hpp"
#include "FirebaseManager.hpp"
#include "SyncManager.hpp"

// Instancias globales
Scheduler userScheduler;
painlessMesh mesh;
WiFiManager wifiManager(WIFI_SSID, WIFI_PASSWORD);
FirebaseManager firebaseManager;
SyncManager syncManager(&mesh);
const String DEVICE_ID = "ROOT";


// Callbacks
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);

// Tarea periódica para anunciar ROOT
Task taskAnnounceRoot(5000, TASK_FOREVER, []() {
  StaticJsonDocument<128> doc;
  doc["type"] = "ROOT_ANNOUNCE";
  doc["root"] = mesh.getNodeId();

  String msg;
  serializeJson(doc, msg);

  mesh.sendBroadcast(msg);
  Serial.println("[ROOT] Enviando ROOT_ANNOUNCE (broadcast)");
});

void setup() {
  Serial.begin(115200);
  delay(1000);

  while(Serial.available()) Serial.read();
  Serial.println();
  Serial.flush();
  
  Serial.println("ROOT NODE CON FIREBASE INICIANDO");
  
  if (wifiManager.connect()) {
    firebaseManager.begin(
      FIREBASE_API_KEY,
      FIREBASE_DATABASE_URL,
      FIREBASE_USER_EMAIL,
      FIREBASE_USER_PASSWORD
    );
  } else {
    Serial.println("\n[ERROR] Sin WiFi. Firebase deshabilitado.");
  }
  
  mesh.setDebugMsgTypes(ERROR | STARTUP);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);

  mesh.stationManual(WIFI_SSID, WIFI_PASSWORD);
  mesh.setHostname("FireMesh_Root");

  //  anuncio periódico del ROOT
  userScheduler.addTask(taskAnnounceRoot);
  taskAnnounceRoot.enable();

  Serial.println("\n[ROOT] Sistema iniciado completamente\n");
}

void loop() {
  mesh.update();
}

void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  if (deserializeJson(doc, msg)) return;

  String type = doc["type"];

  if (type == "TIME") {
    syncManager.handleSyncRequest(from);
    return;
  }

  if (type.startsWith("DATA")) {
    if (doc["body"].isNull()) return;

    int humo = doc["body"]["humo"];
    int fuego = doc["body"]["fuego"];
    unsigned long long ts = doc["body"]["ts"];
    uint32_t srcNode = doc["src"];

    Serial.printf("[ROOT] Recibido %s - humo: %d, fuego: %d, ts: %llu (nodo %u)\n", 
                  type.c_str(), humo, fuego, ts, srcNode);

    firebaseManager.sendData(humo, fuego, ts, type, srcNode);
  }
}

void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("Conexión establecida: %u\n", nodeId);

  StaticJsonDocument<128> syncMsg;
  syncMsg["type"] = "SYNC";
  syncMsg["src"] = mesh.getNodeId();

  String msg;
  serializeJson(syncMsg, msg);

  mesh.sendSingle(nodeId, msg);
  Serial.printf("[ROOT] Enviando SYNC a nodo %u\n", nodeId);
}
