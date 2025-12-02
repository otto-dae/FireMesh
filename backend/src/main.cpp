/**
 * FireMesh-DX: Sistema Completo ROOT NODE con Firebase
 * Incluye: NTP, Buffer FIFO, Burst Recovery + Firebase Realtime Database
 * ADAPTADO AL PROTOCOLO INTERNO DEL GRUPO 31
 */

#include <Arduino.h>
#include <painlessMesh.h>
#include <ArduinoJson.h>
#include <deque>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// 1. CONFIGURACIÓN Y DEFINICIONES

// --- ¡CAMBIAR ESTO SEGÚN LA PLACA QUE ESTÉS GRABANDO! ---
#define IS_ROOT true  // true para ROOT, false para CHILD

// Credenciales de la Malla
#define MESH_PREFIX     "videoetica"
#define MESH_PASSWORD   "12345678"
#define MESH_PORT       5555

#define WIFI_SSID       "LabPercepcion_Guest"
#define WIFI_PASSWORD   ""

// Estas son las credenciales de tu Firebase Console
#define FIREBASE_API_KEY         "AIzaSyD68kCuCDHIfppOnqTvHQuPEx3-0aoBVQY"
#define FIREBASE_AUTH_DOMAIN     "equipo-naranja-20606.firebaseapp.com"
#define FIREBASE_DATABASE_URL    "https://equipo-naranja-20606-default-rtdb.firebaseio.com/"
#define FIREBASE_PROJECT_ID      "equipo-naranja-20606"
#define FIREBASE_STORAGE_BUCKET  "equipo-naranja-20606.firebasestorage.app"
#define FIREBASE_MESSAGING_SENDER_ID  "973639775100"
#define FIREBASE_APP_ID          "1:973639775100:web:f2e305094653d66343eaf9"

// Credenciales de Usuario Firebase (Authentication)
#define FIREBASE_USER_EMAIL     "otto.acha.28@gmail.com"
#define FIREBASE_USER_PASSWORD  ""

// Configuración de Memoria Offline
#define MAX_BUFFER_SIZE 20

// 2. ESTRUCTURAS DE DATOS Y OBJETOS

Scheduler userScheduler; 
painlessMesh mesh;

// Variables de Sincronización
double timeOffset = 0.0;
bool isSynchronized = false;
uint32_t rootNodeId = 0;

// Firebase Objects (Solo ROOT)
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool firebaseReady = false;

// Estructura para guardar lecturas (según protocolo)
struct DataPacket {
    unsigned long long timestamp; 
    int humo;  
    int fuego;
};

// Buffer FIFO
std::deque<DataPacket> offlineBuffer;

// Prototipos de funciones
void sendSyncRequest(); 
void generateSensorData();
void checkAndFlushBuffer();
String crearJsonDatos(DataPacket data, String tipo);
void enviarAFirebase(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId);
void setupWiFi();
void setupFirebase();

// Tareas
Task taskSync(10000, TASK_FOREVER, &sendSyncRequest);
Task taskSensor(5000, TASK_FOREVER, &generateSensorData);

// 3. LÓGICA DE TIEMPO Y BUFFER (Auxiliares)

unsigned long long getNetworkTime() {
  return (unsigned long long)millis() + (long long)timeOffset; 
}

String crearJsonDatos(DataPacket data, String tipo) {
    StaticJsonDocument<256> doc;
    doc["type"] = tipo;
    doc["src"] = mesh.getNodeId();
    
    JsonObject body = doc.createNestedObject("body");
    body["ts"] = data.timestamp;
    body["humo"] = data.humo;
    body["fuego"] = data.fuego;
    
    String output;
    serializeJson(doc, output);
    return output;
}

void sendToRoot(DataPacket reading) {
    bool networkOK = (rootNodeId != 0 && mesh.isConnected(rootNodeId));
    
    if (!networkOK) {
        Serial.printf("[OFFLINE] Sin red. Guardando lectura en buffer FIFO.\n");
        offlineBuffer.push_back(reading);

        if (offlineBuffer.size() > MAX_BUFFER_SIZE) {
            offlineBuffer.pop_front();
            Serial.println("[BUFFER FULL] Memoria llena. Borrando dato más antiguo.");
        }
    } else {
        String jsonMsg = crearJsonDatos(reading, "DATA");
        mesh.sendSingle(rootNodeId, jsonMsg);
        Serial.printf("[ONLINE] Enviando lectura humo: %d, fuego: %d (TS: %llu)\n", 
                      reading.humo, reading.fuego, reading.timestamp);
        checkAndFlushBuffer();
    }
}

void checkAndFlushBuffer() {
    bool networkOK = (rootNodeId != 0 && mesh.isConnected(rootNodeId));
    
    if (!offlineBuffer.empty() && networkOK) {
        Serial.println("\n>> RECONEXIÓN: Vaciando memoria (Burst)...");
        while (!offlineBuffer.empty()) {
            DataPacket saved = offlineBuffer.front();
            String jsonMsg = crearJsonDatos(saved, "DATA_HIST");
            mesh.sendSingle(rootNodeId, jsonMsg);
            
            Serial.printf(">> RECUPERADO: humo=%d, fuego=%d (TS Original: %llu)\n", 
                         saved.humo, saved.fuego, saved.timestamp);
            offlineBuffer.pop_front();
            delay(50);
        }
        Serial.println(">> Memoria vaciada.\n");
    }
}

// 4. FIREBASE (SOLO ROOT)

void setupWiFi() {
    Serial.printf("\n[WiFi] Conectando a %s...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, 9);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Conectado. IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WiFi] Fallo de conexión");
    }
}

void setupFirebase() {
    Serial.println("\n[Firebase] Configurando...");
    
    // Configuración usando todas las credenciales
    config.api_key = FIREBASE_API_KEY;
    config.database_url = FIREBASE_DATABASE_URL;
    
    // Opcional pero recomendado (metadata del proyecto)
    // Nota: Estos no son estrictamente necesarios para Realtime Database
    // pero los incluyo por completitud
    
    // Autenticación
    auth.user.email = FIREBASE_USER_EMAIL;
    auth.user.password = FIREBASE_USER_PASSWORD;
    
    // Callbacks de token
    config.token_status_callback = tokenStatusCallback;
    
    // Configuración de timeout
    config.timeout.serverResponse = 10 * 1000; // 10 segundos
    
    // Inicializar
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    
    Serial.println("[Firebase] Esperando autenticación...");
    
    // Esperar hasta 10 segundos para autenticación
    int timeout = 0;
    while (!Firebase.ready() && timeout < 20) {
        delay(500);
        Serial.print(".");
        timeout++;
    }
    
    if (Firebase.ready()) {
        firebaseReady = true;
        Serial.println("\n[Firebase] Conectado y autenticado");
        Serial.printf("[Firebase] User ID: %s\n", auth.token.uid.c_str());
    } else {
        Serial.println("\n[Firebase] Error de autenticación");
        Serial.printf("[Firebase] Error: %s\n", config.signer.signupError.message.c_str());
    }
}

void enviarAFirebase(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId) {
    if (!firebaseReady) {
        Serial.println("[Firebase] No está listo. Ignorando envío.");
        return;
    }
    
    // Crear JSON para Firebase
    FirebaseJson json;
    json.set("humo", humo);
    json.set("fuego", fuego);
    json.set("timestamp", (double)ts);
    json.set("type", tipo);
    json.set("nodeId", (int)nodeId);
    json.set("serverTimestamp", (double)millis());
    
    // Estructura de datos en Firebase:
    // sensores/
    //   node_{ID}/
    //     lecturas/
    //       {push_id}/
    //         humo: 450
    //         fuego: 1
    //         timestamp: 1234567890
    //         type: "DATA"
    //         nodeId: 123456789
    //         serverTimestamp: 1234567890
    
    // Construir rutas (conversión explícita de uint32_t a String)
    char nodeIdStr[12];
    sprintf(nodeIdStr, "%u", nodeId);
    
    String path = "sensores/node_";
    path += nodeIdStr;
    path += "/lecturas";
    
    // Enviar a Firebase (push crea ID único automáticamente)
    if (Firebase.RTDB.pushJSON(&fbdo, path.c_str(), &json)) {
        Serial.printf("[Firebase] Enviado: %s | humo=%d, fuego=%d\n", 
                      tipo.c_str(), humo, fuego);
    } else {
        Serial.printf("[Firebase] ✗ Error: %s\n", fbdo.errorReason().c_str());
    }
    
    // Actualizar última conexión del nodo
    String lastSeenPath = "sensores/node_";
    lastSeenPath += nodeIdStr;
    lastSeenPath += "/ultimaConexion";

    Firebase.RTDB.setDouble(&fbdo, lastSeenPath.c_str(), (double)millis());
}

// 5. CALLBACKS DE LA MALLA

void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  DeserializationError error = deserializeJson(doc, msg);
  
  if (error) {
    Serial.println("Error JSON recibido");
    return;
  }
  
  String type = doc["type"];

  // --- LÓGICA ROOT ---
  if (IS_ROOT && type == "TIME") {
    StaticJsonDocument<256> res;
    res["type"] = "TIME";
    res["src"] = mesh.getNodeId();
    
    JsonObject body = res.createNestedObject("body");
    body["T2"] = (unsigned long long)millis();
    body["T3"] = (unsigned long long)millis();
    
    String resMsg;
    serializeJson(res, resMsg);
    mesh.sendSingle(from, resMsg);
    Serial.printf("[ROOT] Enviando tiempos T2 y T3 a nodo %u\n", from);
  }
  
  if (IS_ROOT && type.startsWith("DATA")) {
    if (doc["body"].isNull()) {
      Serial.println("Error: 'body' no presente");
      return;
    }
    
    int humo = doc["body"]["humo"];
    int fuego = doc["body"]["fuego"];
    unsigned long long ts = doc["body"]["ts"];
    uint32_t srcNode = doc["src"];
    
    Serial.printf("[ROOT] Recibido %s - humo: %d, fuego: %d, ts: %llu (de nodo %u)\n", 
                  type.c_str(), humo, fuego, ts, srcNode);
    
    enviarAFirebase(humo, fuego, ts, type, srcNode);
  }

  // --- LÓGICA CHILD ---
  if (!IS_ROOT && type == "SYNC") {
    rootNodeId = from;
    Serial.printf("[CHILD] Root detectado: %u. Iniciando sincronización...\n", rootNodeId);
    
    StaticJsonDocument<128> syncReq;
    syncReq["type"] = "TIME";
    syncReq["src"] = mesh.getNodeId();
    
    String syncMsg;
    serializeJson(syncReq, syncMsg);
    mesh.sendSingle(rootNodeId, syncMsg);
  }
  
  if (!IS_ROOT && type == "TIME") {
    if (doc["body"].isNull()) {
      Serial.println("Error: 'body' no presente en TIME");
      return;
    }
    
    unsigned long long T2 = doc["body"]["T2"];
    unsigned long long T3 = doc["body"]["T3"];
    unsigned long long T1 = millis();
    unsigned long long T4 = millis();

    double offset = ((double)(T2 - T1) + (double)(T3 - T4)) / 2.0;
    timeOffset = offset;
    isSynchronized = true;
    Serial.printf("[NTP] Sincronizado. Offset: %.2f ms\n", timeOffset);
  }
}

void newConnectionCallback(uint32_t nodeId) {
  Serial.printf("Conexión establecida: %u\n", nodeId);
  
  if (IS_ROOT) {
    StaticJsonDocument<128> syncMsg;
    syncMsg["type"] = "SYNC";
    syncMsg["src"] = mesh.getNodeId();
    
    String msg;
    serializeJson(syncMsg, msg);
    mesh.sendSingle(nodeId, msg);
    Serial.printf("[ROOT] Enviando SYNC a nodo %u\n", nodeId);
  }
  
  if (!IS_ROOT) {
    checkAndFlushBuffer();
  }
}

// 6. TAREAS

void sendSyncRequest() {
  if (!IS_ROOT && rootNodeId != 0 && mesh.isConnected(rootNodeId)) {
    StaticJsonDocument<128> syncReq;
    syncReq["type"] = "TIME";
    syncReq["src"] = mesh.getNodeId();
    
    String syncMsg;
    serializeJson(syncReq, syncMsg);
    mesh.sendSingle(rootNodeId, syncMsg);
  }
}

void generateSensorData() {
  if (!IS_ROOT) {
    DataPacket lectura;
    
    if (isSynchronized) {
      lectura.timestamp = getNetworkTime();
    } else {
      lectura.timestamp = 0;
    }
    
    // Simular Sensores (adaptar a pines reales)
    lectura.humo = random(300, 900);
    lectura.fuego = random(0, 2);
    
    sendToRoot(lectura);
  }
}

// 7. SETUP & LOOP

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  if (IS_ROOT) {
    Serial.println("ROOT NODE CON FIREBASE INICIANDO");
    
    // 1. Conectar WiFi primero
    setupWiFi();
    
    // 2. Configurar Firebase
    if (WiFi.status() == WL_CONNECTED) {
      setupFirebase();
    } else {
      Serial.println("Sin WiFi. Firebase deshabilitado.");
    }
    
    // 3. Inicializar Mesh (modo híbrido)
    mesh.setDebugMsgTypes(ERROR | STARTUP);
    mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
    mesh.onReceive(&receivedCallback);
    mesh.onNewConnection(&newConnectionCallback);
    
    // 4. Mantener conexión WiFi mientras mesh está activo
    mesh.stationManual(WIFI_SSID, WIFI_PASSWORD);
    mesh.setHostname("FireMesh_Root");
    
    Serial.println("[ROOT]Sistema iniciado completamente");
    
  } else {
    Serial.println("CHILD NODE INICIANDO");
    
    // Solo inicializar Mesh
    mesh.setDebugMsgTypes(ERROR | STARTUP);
    mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
    mesh.onReceive(&receivedCallback);
    mesh.onNewConnection(&newConnectionCallback);
    
    // Activar tareas de sensores
    userScheduler.addTask(taskSync);
    taskSync.enable();
    userScheduler.addTask(taskSensor);
    taskSensor.enable();
    
    Serial.println("Esperando conexión con ROOT...\n");
  }
}

void loop() {
  mesh.update();
  
  // Mantener Firebase vivo (solo ROOT)
  if (IS_ROOT && firebaseReady) {
    // Firebase mantiene conexión automáticamente
    // La librería gestiona reconexiones internas
  }
}