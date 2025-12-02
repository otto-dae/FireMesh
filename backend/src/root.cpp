
#include <Arduino.h>
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

// Callbacks
void receivedCallback(uint32_t from, String &msg);
void newConnectionCallback(uint32_t nodeId);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Limpiar buffer serial
  while(Serial.available()) Serial.read();
  Serial.println();
  Serial.flush();
  
  Serial.println("ROOT NODE CON FIREBASE INICIANDO");
  
  // 1. Conectar WiFi
  if (wifiManager.connect()) {
    // 2. Configurar Firebase
    firebaseManager.begin(
      FIREBASE_API_KEY,
      FIREBASE_DATABASE_URL,
      FIREBASE_USER_EMAIL,
      FIREBASE_USER_PASSWORD
    );
  } else {
    Serial.println("\n[ERROR] Sin WiFi. Firebase deshabilitado.");
  }
  
  // 3. Inicializar Mesh (modo híbrido)
  mesh.setDebugMsgTypes(ERROR | STARTUP);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);
  
  // 4. Mantener conexión WiFi
  mesh.stationManual(WIFI_SSID, WIFI_PASSWORD);
  mesh.setHostname("FireMesh_Root");
  
  Serial.println("\n[ROOT] Sistema iniciado completamente\n");
}

void loop() {
  mesh.update();
  
  // Mantener Firebase conectado
  if (firebaseManager.isReady()) {
    // Firebase se mantiene automáticamente
  }
}

// CALLBACK: Mensajes recibidos
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  DeserializationError error = deserializeJson(doc, msg);
  
  if (error) {
    Serial.println("[Root] Error JSON recibido");
    return;
  }
  
  String type = doc["type"];
  
  // Manejo de sincronización NTP
  if (type == "TIME") {
    syncManager.handleSyncRequest(from);
    return;
  }
  
  // Manejo de datos de sensores
  if (type.startsWith("DATA")) {
    if (doc["body"].isNull()) {
      Serial.println("[Root] Error: 'body' no presente");
      return;
    }
    
    int humo = doc["body"]["humo"];
    int fuego = doc["body"]["fuego"];
    unsigned long long ts = doc["body"]["ts"];
    uint32_t srcNode = doc["src"];
    
    Serial.printf("[ROOT] Recibido %s - humo: %d, fuego: %d, ts: %llu (de nodo %u)\n", 
                  type.c_str(), humo, fuego, ts, srcNode);
    
    // Enviar a Firebase
    firebaseManager.sendData(humo, fuego, ts, type, srcNode);
  }
}

// CALLBACK: Nueva conexión
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("Conexión establecida: %u\n", nodeId);
  
  // Enviar mensaje SYNC al child
  StaticJsonDocument<128> syncMsg;
  syncMsg["type"] = "SYNC";
  syncMsg["src"] = mesh.getNodeId();
  
  String msg;
  serializeJson(syncMsg, msg);
  mesh.sendSingle(nodeId, msg);
  Serial.printf("[ROOT] Enviando SYNC a nodo %u\n", nodeId);
}