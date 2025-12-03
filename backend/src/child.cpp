
#include <Arduino.h>
#include "credentials.hpp"
#include "SyncManager.hpp"

// Instancias globales
Scheduler userScheduler;
painlessMesh mesh;
SyncManager syncManager(&mesh);

// Prototipos de funciones
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
  delay(1000);
  
  // Limpiar buffer serial
  while(Serial.available()) Serial.read();
  Serial.println();
  Serial.flush();
  
  Serial.println("CHILD NODE INICIANDO");
  
  // Inicializar Mesh
  mesh.setDebugMsgTypes(ERROR | STARTUP);
  mesh.init(MESH_PREFIX, MESH_PASSWORD, &userScheduler, MESH_PORT);
  mesh.onReceive(&receivedCallback);
  mesh.onNewConnection(&newConnectionCallback);
  
  // Activar tareas periódicas
  userScheduler.addTask(taskSync);
  taskSync.enable();
  userScheduler.addTask(taskSensor);
  taskSensor.enable();

  pinMode(27, INPUT);
  pinMode(35, INPUT);

  
  Serial.println("[CHILD] Esperando conexión con ROOT...\n");
}

void loop() {
  mesh.update();
}

// TAREA: Solicitar sincronización periódica
void sendSyncRequest() {
  if (syncManager.getRootId() != 0 && mesh.isConnected(syncManager.getRootId())) {
    StaticJsonDocument<128> syncReq;
    syncReq["type"] = "TIME";
    syncReq["src"] = mesh.getNodeId();
    
    String syncMsg;
    serializeJson(syncReq, syncMsg);
    mesh.sendSingle(syncManager.getRootId(), syncMsg);
  }
}

// TAREA: Generar datos de sensores
void generateSensorData() {
  DataPacket lectura;
  
  // Timestamp sincronizado
  if (syncManager.getSyncStatus()) {
    lectura.timestamp = syncManager.getNetworkTime();
  } else {
    lectura.timestamp = 0; // Marca inválida
  }
  
  // Simular sensores (adaptar a pines reales)
  lectura.humo = analogRead(35);
  lectura.fuego = digitalRead(27);
  
  // Enviar o guardar en buffer
  bool networkOK = (syncManager.getRootId() != 0 && 
                    mesh.isConnected(syncManager.getRootId()));
  
  if (!networkOK) {
    Serial.println("[OFFLINE] Sin red. Guardando en buffer FIFO.");
    syncManager.addToBuffer(lectura);
  } else {
    // Enviar datos
    sendDataToRoot(lectura, "DATA");
    
    // Intentar vaciar buffer si hay datos pendientes
    if (syncManager.hasBufferedData()) {
      syncManager.flushBuffer(sendDataToRoot);
    }
  }
}

// Función auxiliar: Enviar datos al root
void sendDataToRoot(DataPacket reading, String tipo) {
  String jsonMsg = syncManager.createDataJSON(reading, tipo, mesh.getNodeId());
  mesh.sendSingle(syncManager.getRootId(), jsonMsg);
  Serial.printf("[ONLINE] Enviando %s - humo: %d, fuego: %d (TS: %llu)\n", 
                tipo.c_str(), reading.humo, reading.fuego, reading.timestamp);
}

// CALLBACK: Mensajes recibidos
void receivedCallback(uint32_t from, String &msg) {
  StaticJsonDocument<300> doc;
  DeserializationError error = deserializeJson(doc, msg);
  
  if (error) {
    Serial.println("[Child] Error JSON recibido");
    return;
  }
  
  String type = doc["type"];
  
  // Detección del root (protocolo punto 3)
  if (type == "SYNC") {
    syncManager.setRootId(from);
    Serial.printf("[CHILD] Root detectado: %u. Iniciando sincronización...\n", from);
    
    // Solicitar sincronización inmediata
    StaticJsonDocument<128> syncReq;
    syncReq["type"] = "TIME";
    syncReq["src"] = mesh.getNodeId();
    
    String syncMsg;
    serializeJson(syncReq, syncMsg);
    mesh.sendSingle(from, syncMsg);
    return;
  }
  
  // Respuesta de sincronización
  if (type == "TIME") {
    syncManager.handleSyncResponse(doc);
    return;
  }
}

// CALLBACK: Nueva conexión
void newConnectionCallback(uint32_t nodeId) {
  Serial.printf(" Conexión establecida: %u\n", nodeId);
  
  // Intentar vaciar buffer si hay datos pendientes
  if (syncManager.hasBufferedData() && 
      syncManager.getRootId() != 0 && 
      mesh.isConnected(syncManager.getRootId())) {
    syncManager.flushBuffer(sendDataToRoot);
  }
}