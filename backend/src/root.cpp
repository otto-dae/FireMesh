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

// Prototipos
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);

// Tarea periódica para anunciar ROOT por broadcast
Task taskAnnounceRoot(5000, TASK_FOREVER, []() {
  StaticJsonDocument<128> doc;
  doc["type"] = "SYNC";
  doc["root"] = mesh.getNodeId();

  String msg;
  serializeJson(doc, msg);
  mesh.sendBroadcast(msg);

  Serial.println("[ROOT] Broadcast SYNC enviado");
});

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nROOT NODE CON FIREBASE INICIANDO\n");

  // Conectar WiFi antes de Firebase
  if (wifiManager.connect()) {
    firebaseManager.begin(
      FIREBASE_API_KEY,
      FIREBASE_DATABASE_URL,
      FIREBASE_USER_EMAIL,
      FIREBASE_USER_PASSWORD
    );
  } else {
    Serial.println("[ERROR] No hay WiFi. Firebase deshabilitado");
  }

  // Inicializar Mesh
  mesh.setDebugMsgTypes(ERROR | STARTUP);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);

  mesh.stationManual(WIFI_SSID, WIFI_PASSWORD);
  mesh.setHostname("FireMesh_Root");

  // Activar anuncio periódico del ROOT
  userScheduler.addTask(taskAnnounceRoot);
  taskAnnounceRoot.enable();
  
  Serial.println("[ROOT] Sistema iniciado correctamente\n");
}

void loop() {
  mesh.update();
}

//
// Procesar mensajes desde los CHILD
//
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  if (deserializeJson(doc, msg)) {
    Serial.println("[ROOT] Error parseando JSON");
    return;
  }

  String type = doc["type"];

  //
  // RESPUESTA A PEDIDO DE SYNC (TIME REQUEST)
  //
  if (type == "TIME") {
    syncManager.handleSyncRequest(from);
    return;
  }

  //
  // RECEPCIÓN DE DATA (sensores)
  //
  if (type.startsWith("DATA")) {
    if (doc["body"].isNull()) return;

    int humo = doc["body"]["humo"];
    int fuego = doc["body"]["fuego"];
    unsigned long long ts = doc["body"]["ts"];
    uint32_t srcNode = doc["src"];

    Serial.printf(
      "[ROOT] DATA recibida - humo: %d | fuego: %d | ts: %llu | nodo: %u\n",
      humo, fuego, ts, srcNode
    );

    firebaseManager.sendData(humo, fuego, ts, type, srcNode);
  }
}

//
// Cuando un CHILD se conecta, el ROOT le envía SYNC directo
//
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("[ROOT] Nuevo nodo: %u -> enviando SYNC directo\n", nodeId);

  StaticJsonDocument<128> doc;
  doc["type"] = "SYNC";
  doc["root"] = mesh.getNodeId();

  String msg;
  serializeJson(doc, msg);

  mesh.sendSingle(nodeId, msg);
}
