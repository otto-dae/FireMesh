#include "FirebaseManager.hpp"

FirebaseManager::FirebaseManager() : ready(false) {}

bool FirebaseManager::begin(const char* apiKey, const char* dbURL, const char* email, const char* password) {
    Serial.println("\n[Firebase] Configurando...");
    Serial.printf("[Firebase] API Key: %s...\n", String(apiKey).substring(0, 15).c_str());
    Serial.printf("[Firebase] Database: %s\n", dbURL);
    Serial.printf("[Firebase] Email: %s\n", email);
    
    // Configuración
    config.api_key = apiKey;
    config.database_url = dbURL;
    
    // Autenticación
    auth.user.email = email;
    auth.user.password = password;
    
    // Callbacks y timeouts
    config.token_status_callback = tokenStatusCallback;
    config.timeout.serverResponse = 15 * 1000;
    config.timeout.socketConnection = 10 * 1000;
    
    // Inicializar
    Serial.println("[Firebase] Iniciando conexión...");
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    
    Serial.println("[Firebase] Esperando autenticación (hasta 15s)...");
    
    // Esperar autenticación
    int timeout = 0;
    while (!Firebase.ready() && timeout < 30) {
        delay(500);
        Serial.print(".");
        timeout++;
        
        if (timeout % 4 == 0) {
            Serial.printf("\n[Debug %ds] Token status: %d | Error: %d\n", 
                         timeout/2, config.signer.tokens.status, config.signer.signupError.code);
        }
    }
    
    if (Firebase.ready()) {
        ready = true;
        Serial.println("\n[Firebase] Conectado y autenticado");
        Serial.printf("[Firebase] User ID: %s\n", auth.token.uid.c_str());
        return true;
    } else {
        ready = false;
        Serial.println("\n[Firebase] Error de autenticación");
        Serial.printf("[Firebase] Error Code: %d\n", config.signer.signupError.code);
        Serial.printf("[Firebase] Error Message: %s\n", config.signer.signupError.message.c_str());
        return false;
    }
}

bool FirebaseManager::isReady() {
    return ready && Firebase.ready();
}

bool FirebaseManager::sendData(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId) {
    if (!ready) {
        Serial.println("[Firebase] No está listo. Ignorando envío.");
        return false;
    }
    
    // Crear JSON
    FirebaseJson json;
    json.set("humo", humo);
    json.set("fuego", fuego);
    json.set("timestamp", (double)ts);
    json.set("type", tipo);
    json.set("nodeId", (int)nodeId);
    json.set("serverTimestamp", (double)millis());
    
    // Construir ruta
    char nodeIdStr[12];
    sprintf(nodeIdStr, "%u", nodeId);
    
    String path = "sensores/node_";
    path += nodeIdStr;
    path += "/lecturas";
    
    // Enviar
    if (Firebase.RTDB.pushJSON(&fbdo, path.c_str(), &json)) {
        Serial.printf("[Firebase] Enviado: %s | humo=%d, fuego=%d\n", tipo.c_str(), humo, fuego);
        
        // Actualizar última conexión
        String lastSeenPath = "sensores/node_";
        lastSeenPath += nodeIdStr;
        lastSeenPath += "/ultimaConexion";
        Firebase.RTDB.setDouble(&fbdo, lastSeenPath.c_str(), (double)millis());
        
        return true;
    } else {
        Serial.printf("[Firebase] Error: %s\n", fbdo.errorReason().c_str());
        return false;
    }
}

void FirebaseManager::reconnect() {
    Firebase.reconnectWiFi(true);
}